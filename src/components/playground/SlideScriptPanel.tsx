import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/api';

// Add this interface to define the script content structure
interface ScriptContent {
    script: string;
    agent: string;
}

interface SlideScriptPanelProps {
    currentSlide: number;
    scripts: Record<string, ScriptContent> | null;
    onScriptChange?: (slideNumber: string, content: string) => void;
    onScriptsUpdate?: (scripts: Record<string, ScriptContent>) => void;
    brdgeId?: string | number | null;
    isGenerating?: boolean;
    onScriptsGenerated?: (newScripts: Record<string, ScriptContent>) => void;
    onAIEdit: (fn: (instruction: string) => Promise<void>) => void;
}

type TabType = 'script' | 'agent';

// Add new interface for AI editing state
interface AIEditState {
    isProcessing: boolean;
    streamContent: string;
    error: string | null;
}

export const SlideScriptPanel = ({ currentSlide, scripts, onScriptChange, onScriptsUpdate, onScriptsGenerated, brdgeId, isGenerating = false, onAIEdit }: SlideScriptPanelProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('script');
    const [editedScript, setEditedScript] = useState('');
    const [editedAgent, setEditedAgent] = useState('');
    const [hasScriptChanges, setHasScriptChanges] = useState(false);
    const [hasAgentChanges, setHasAgentChanges] = useState(false);
    const [isSavingScript, setIsSavingScript] = useState(false);
    const [isSavingAgent, setIsSavingAgent] = useState(false);
    const [aiEditState, setAIEditState] = useState<AIEditState>({
        isProcessing: false,
        streamContent: '',
        error: null
    });
    const eventSourceRef = useRef<EventSource | null>(null);
    const accumulatedContentRef = useRef<{
        script: string;
        agent: string;
    }>({
        script: '',
        agent: ''
    });
    const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [streamingContent, setStreamingContent] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        // Skip effect if no scripts or during generation
        if (!scripts || isGenerating) {
            if (isGenerating) {
                setEditedScript('');
                setEditedAgent('');
            }
            return;
        }

        const currentContent = scripts[currentSlide];
        if (!currentContent) {
            setEditedScript('');
            setEditedAgent('');
            return;
        }

        // Only update if content actually changed
        const newScript = typeof currentContent === 'object' ? currentContent.script : currentContent;
        const newAgent = typeof currentContent === 'object' ? currentContent.agent : '';

        setEditedScript(prev => {
            if (prev !== (newScript || '')) {
                return newScript || '';
            }
            return prev;
        });

        setEditedAgent(prev => {
            if (prev !== (newAgent || '')) {
                return newAgent || '';
            }
            return prev;
        });

        // Reset change flags only when slide changes or new content is loaded
        setHasScriptChanges(false);
        setHasAgentChanges(false);

    }, [scripts, currentSlide, isGenerating]);

    const handleContentChange = useCallback((content: string, type: TabType) => {
        if (type === 'script') {
            setEditedScript(content);
            setHasScriptChanges(true);
        } else {
            setEditedAgent(content);
            setHasAgentChanges(true);
        }
    }, []);

    const handleSaveScript = useCallback(async () => {
        if (!brdgeId || !scripts) return;

        setIsSavingScript(true);
        try {
            const updatedScripts = { ...scripts };
            updatedScripts[currentSlide] = {
                script: editedScript,
                agent: (typeof scripts[currentSlide] === 'object'
                    ? (scripts[currentSlide] as ScriptContent).agent
                    : '') || editedAgent
            };

            const response = await api.put(`/brdges/${brdgeId}/scripts/update`, {
                scripts: updatedScripts
            });

            if (response.data.scripts) {
                onScriptsUpdate?.(response.data.scripts);
            }

            setHasScriptChanges(false);
        } catch (error) {
            console.error('Error updating script:', error);
            if (scripts[currentSlide]) {
                const content = typeof scripts[currentSlide] === 'object'
                    ? (scripts[currentSlide] as ScriptContent).script
                    : scripts[currentSlide];
                setEditedScript(content || '');
            }
        } finally {
            setIsSavingScript(false);
        }
    }, [brdgeId, scripts, currentSlide, editedScript, editedAgent, onScriptsUpdate]);

    const handleSaveAgent = useCallback(async () => {
        if (!brdgeId || !scripts) return;

        setIsSavingAgent(true);
        try {
            const updatedScripts = { ...scripts };
            updatedScripts[currentSlide] = {
                script: (typeof scripts[currentSlide] === 'object'
                    ? (scripts[currentSlide] as ScriptContent).script
                    : scripts[currentSlide]) || editedScript,
                agent: editedAgent
            };

            const response = await api.put(`/brdges/${brdgeId}/scripts/update`, {
                scripts: updatedScripts
            });

            if (response.data.scripts) {
                onScriptsUpdate?.(response.data.scripts);
            }

            setHasAgentChanges(false);
        } catch (error) {
            console.error('Error updating agent instructions:', error);
            if (scripts[currentSlide]) {
                const content = typeof scripts[currentSlide] === 'object'
                    ? (scripts[currentSlide] as ScriptContent).agent
                    : '';
                setEditedAgent(content || '');
            }
        } finally {
            setIsSavingAgent(false);
        }
    }, [brdgeId, scripts, currentSlide, editedScript, editedAgent, onScriptsUpdate]);

    const handleAIEdit = useCallback(async (instruction: string) => {
        if (!brdgeId || !currentSlide || aiEditState.isProcessing || !instruction) return;

        console.log('Starting AI edit with instruction:', instruction);

        // Reset state and refs
        setAIEditState(prev => ({
            ...prev,
            isProcessing: true,
            streamContent: '',
            error: null
        }));
        setIsStreaming(true);

        // Initialize streaming with empty content
        setStreamingContent('');
        let currentJsonStr = '';

        try {
            const params = new URLSearchParams({
                slideNumber: currentSlide.toString(),
                instruction: instruction,
                currentContent: JSON.stringify({
                    script: editedScript || '',
                    agent: editedAgent || ''
                })
            });

            // Create EventSource for SSE connection
            const eventSource = new EventSource(
                `${api.defaults.baseURL}/brdges/${brdgeId}/scripts/ai-edit?${params.toString()}`
            );

            eventSource.onmessage = (event) => {
                if (event.data === '[DONE]') {
                    console.log('Stream complete. Final content:', accumulatedContentRef.current);

                    // Final update
                    const finalContent = {
                        script: accumulatedContentRef.current.script,
                        agent: accumulatedContentRef.current.agent
                    };

                    // Update local state and mark as changed
                    setEditedScript(finalContent.script);
                    setEditedAgent(finalContent.agent);
                    setHasScriptChanges(true);
                    setHasAgentChanges(true);

                    setAIEditState(prev => ({
                        ...prev,
                        isProcessing: false
                    }));
                    setIsStreaming(false);
                    setStreamingContent('');

                    // Clean up
                    eventSource.close();
                    return;
                }

                try {
                    const parsed = JSON.parse(event.data);
                    console.log('Received token:', parsed);

                    if (parsed.error) {
                        console.error('Error from server:', parsed.error);
                        setAIEditState(prev => ({
                            ...prev,
                            isProcessing: false,
                            error: parsed.error
                        }));
                        setIsStreaming(false);
                        eventSource.close();
                        return;
                    }

                    if (parsed.token) {
                        // Accumulate JSON string
                        currentJsonStr += parsed.token;
                        console.log('Current JSON string:', currentJsonStr);

                        try {
                            // Try to parse the accumulated JSON
                            const content = JSON.parse(currentJsonStr);
                            console.log('Parsed content:', content);

                            // Update the streaming content in real-time
                            if (content.script !== undefined) {
                                setStreamingContent(content.script);
                                accumulatedContentRef.current.script = content.script;
                            }
                            if (content.agent !== undefined) {
                                accumulatedContentRef.current.agent = content.agent;
                            }
                        } catch (e) {
                            // Not valid JSON yet, just show the accumulated tokens
                            const scriptMatch = currentJsonStr.match(/"script"\s*:\s*"([^"]*)/);
                            if (scriptMatch && scriptMatch[1]) {
                                setStreamingContent(scriptMatch[1]);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error processing token:', e);
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                setAIEditState(prev => ({
                    ...prev,
                    isProcessing: false,
                    error: 'Connection error occurred'
                }));
                setIsStreaming(false);
                eventSource.close();
            };

            // Store EventSource reference for cleanup
            eventSourceRef.current = eventSource;

        } catch (error) {
            console.error('Error in AI edit:', error);
            setAIEditState(prev => ({
                ...prev,
                isProcessing: false,
                error: 'Failed to process AI edit'
            }));
            setIsStreaming(false);
        }
    }, [
        brdgeId,
        currentSlide,
        editedScript,
        editedAgent
    ]);

    // Update the textarea value based on streaming state
    const textareaValue = useMemo(() => {
        if (isStreaming) {
            return streamingContent;
        }
        return activeTab === 'script' ? editedScript : editedAgent;
    }, [isStreaming, streamingContent, activeTab, editedScript, editedAgent]);

    // Cleanup EventSource on unmount or when changing slides
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (streamTimeoutRef.current) {
                clearTimeout(streamTimeoutRef.current);
            }
        };
    }, [currentSlide]);

    // Add effect to monitor script changes
    useEffect(() => {
        console.log('Script/Agent content updated:', {
            script: editedScript,
            agent: editedAgent,
            currentSlide,
            hasScriptChanges,
            hasAgentChanges
        });
    }, [editedScript, editedAgent, currentSlide, hasScriptChanges, hasAgentChanges]);

    const handleAIEditSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('aiEdit') as HTMLInputElement;
        if (input.value.trim()) {
            handleAIEdit(input.value.trim());
            input.value = '';
        }
    }, [handleAIEdit]);

    // Pass the handleAIEdit function to parent on mount
    useEffect(() => {
        if (onAIEdit) {
            onAIEdit(handleAIEdit);
        }
    }, [onAIEdit, handleAIEdit]);

    return (
        <div className="flex flex-col h-full bg-gray-900/50" role="tabpanel">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-medium text-gray-400">
                        Slide {currentSlide}
                        {(!scripts || !scripts[currentSlide]) && (
                            <span className="ml-2 text-gray-500">
                                {isGenerating ? 'Generating...' : '(No content available)'}
                            </span>
                        )}
                    </h3>
                    {isGenerating && (
                        <div className="animate-pulse flex space-x-1">
                            <div className="h-1.5 w-1.5 bg-cyan-400 rounded-full"></div>
                            <div className="h-1.5 w-1.5 bg-cyan-400 rounded-full"></div>
                            <div className="h-1.5 w-1.5 bg-cyan-400 rounded-full"></div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-800/80 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setActiveTab('script')}
                            className={`px-3 py-1.5 text-xs transition-colors ${activeTab === 'script'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            Script
                        </button>
                        <button
                            onClick={() => setActiveTab('agent')}
                            className={`px-3 py-1.5 text-xs transition-colors ${activeTab === 'agent'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            Agent
                        </button>
                    </div>
                    {((activeTab === 'script' && hasScriptChanges) || (activeTab === 'agent' && hasAgentChanges)) && (
                        <button
                            onClick={activeTab === 'script' ? handleSaveScript : handleSaveAgent}
                            disabled={activeTab === 'script' ? isSavingScript : isSavingAgent}
                            className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded-lg 
                                hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z" />
                            </svg>
                            {(activeTab === 'script' ? isSavingScript : isSavingAgent) ? 'Saving...' : 'Save'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <textarea
                    value={textareaValue}
                    onChange={(e) => !isStreaming && handleContentChange(e.target.value, activeTab)}
                    placeholder={
                        isStreaming
                            ? "AI is rewriting content..."
                            : activeTab === 'script'
                                ? "Enter script for this slide..."
                                : "Enter agent instructions for this slide..."
                    }
                    className={`w-full min-h-[280px] max-h-[400px] bg-gray-800/80 
                        ${isStreaming ? 'cursor-not-allowed' : ''}
                        ${aiEditState.error ? 'border-red-500' : ''}
                        text-gray-200 rounded-lg px-4 py-3 resize-y
                        text-[13px] font-mono leading-relaxed tracking-wide
                        border border-gray-700/50
                        focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50
                        placeholder:text-gray-600
                        shadow-[0_0_15px_rgba(255,255,255,0.03)]
                        transition-colors duration-150
                    `}
                    disabled={isStreaming}
                    style={{
                        boxShadow: '0 0 15px rgba(255,255,255,0.03), inset 0 0 20px rgba(255,255,255,0.02)'
                    }}
                />

                {aiEditState.error && (
                    <div className="text-red-500 text-sm mt-2">
                        {aiEditState.error}
                    </div>
                )}
            </div>
        </div>
    );
}; 