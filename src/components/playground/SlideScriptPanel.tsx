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
    isEditPage?: boolean;
}

type TabType = 'speech' | 'knowledge';

// Add this type for edit targets
interface EditTargets {
    speech: boolean;
    knowledge: boolean;
}

// Add new interface for AI editing state
interface AIEditState {
    isProcessing: boolean;
    scriptStream: string;
    agentStream: string;
    error: string | null;
    targets: EditTargets;
    hasReceivedFirstToken: boolean;
}

export const SlideScriptPanel = ({ currentSlide, scripts, onScriptChange, onScriptsUpdate, onScriptsGenerated, brdgeId, isGenerating = false, onAIEdit, isEditPage = true }: SlideScriptPanelProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('speech');
    const [editedScript, setEditedScript] = useState('');
    const [editedAgent, setEditedAgent] = useState('');
    const [hasScriptChanges, setHasScriptChanges] = useState(false);
    const [hasAgentChanges, setHasAgentChanges] = useState(false);
    const [isSavingScript, setIsSavingScript] = useState(false);
    const [isSavingAgent, setIsSavingAgent] = useState(false);
    const [aiEditState, setAIEditState] = useState<AIEditState>({
        isProcessing: false,
        scriptStream: '',
        agentStream: '',
        error: null,
        targets: { speech: true, knowledge: true },
        hasReceivedFirstToken: false
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
        if (type === 'speech') {
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

        // Reset streaming state
        setAIEditState(prev => ({
            ...prev,
            isProcessing: true,
            scriptStream: '',
            agentStream: '',
            error: null,
            hasReceivedFirstToken: false
        }));

        try {
            const params = new URLSearchParams({
                slideNumber: currentSlide.toString(),
                instruction: instruction,
                currentContent: JSON.stringify({
                    script: editedScript || '',
                    agent: editedAgent || ''
                }),
                editSpeech: aiEditState.targets.speech.toString(),
                editKnowledge: aiEditState.targets.knowledge.toString()
            });

            const eventSource = new EventSource(
                `${api.defaults.baseURL}/brdges/${brdgeId}/scripts/ai-edit?${params.toString()}`
            );

            eventSource.onmessage = (event) => {
                if (event.data === '[DONE]') {
                    console.log('Stream complete');
                    setAIEditState(prev => ({
                        ...prev,
                        isProcessing: false,
                    }));
                    eventSource.close();
                    return;
                }

                try {
                    const parsed = JSON.parse(event.data);

                    if (parsed.error) {
                        console.error('Error from server:', parsed.error);
                        setAIEditState(prev => ({
                            ...prev,
                            isProcessing: false,
                            error: parsed.error,
                            scriptStream: '',
                            agentStream: '',
                            hasReceivedFirstToken: false
                        }));
                        eventSource.close();
                        return;
                    }

                    // Immediately update state with each token
                    if (parsed.token) {
                        setAIEditState(prev => {
                            const newState = { ...prev, hasReceivedFirstToken: true };

                            if (parsed.type === 'script' && aiEditState.targets.speech) {
                                newState.scriptStream = prev.scriptStream + parsed.token;
                            } else if (parsed.type === 'agent' && aiEditState.targets.knowledge) {
                                newState.agentStream = prev.agentStream + parsed.token;
                            }

                            return newState;
                        });
                    }

                    // Handle final content
                    if (parsed.final) {
                        if (parsed.final.script && aiEditState.targets.speech) {
                            setEditedScript(parsed.final.script);
                            setHasScriptChanges(true);
                        }
                        if (parsed.final.agent && aiEditState.targets.knowledge) {
                            setEditedAgent(parsed.final.agent);
                            setHasAgentChanges(true);
                        }
                    }

                } catch (e) {
                    console.error('Error processing message:', e);
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                setAIEditState(prev => ({
                    ...prev,
                    isProcessing: false,
                    error: 'Connection error occurred',
                    scriptStream: '',
                    agentStream: '',
                    hasReceivedFirstToken: false
                }));
                eventSource.close();
            };

            eventSourceRef.current = eventSource;

        } catch (error) {
            console.error('Error in AI edit:', error);
            setAIEditState(prev => ({
                ...prev,
                isProcessing: false,
                error: 'Failed to process AI edit',
                scriptStream: '',
                agentStream: '',
                hasReceivedFirstToken: false
            }));
        }
    }, [
        brdgeId,
        currentSlide,
        editedScript,
        editedAgent,
        aiEditState.targets
    ]);

    // Update the textarea value based on streaming state
    const textareaValue = useMemo(() => {
        if (isStreaming) {
            return streamingContent;
        }
        return activeTab === 'speech' ? editedScript : editedAgent;
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

    // Update the suggestions to be a simple array
    const quickSuggestions = [
        'Make it conversational',
        'Add examples',
        'More technical',
        'Simplify language',
        'Make it concise'
    ];

    return (
        <div className="flex flex-col h-full bg-gray-900/50" role="tabpanel">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
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

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Speech Script Section */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-300">Speech Script</div>
                        {hasScriptChanges && (
                            <button
                                onClick={handleSaveScript}
                                disabled={isSavingScript}
                                className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg 
                                    hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z" />
                                </svg>
                                {isSavingScript ? 'Saving...' : 'Save'}
                            </button>
                        )}
                    </div>
                    <textarea
                        value={aiEditState.isProcessing && aiEditState.targets.speech
                            ? (aiEditState.hasReceivedFirstToken ? aiEditState.scriptStream : '')
                            : editedScript}
                        onChange={(e) => !aiEditState.isProcessing && handleContentChange(e.target.value, 'speech')}
                        placeholder={aiEditState.isProcessing && aiEditState.targets.speech && !aiEditState.hasReceivedFirstToken
                            ? "Generating..."
                            : "Enter your presentation script for this slide..."}
                        className={`w-full h-[120px] bg-gray-800/80 
                            text-gray-200 rounded-lg px-4 py-3 resize-none
                            text-[13px] font-mono leading-relaxed tracking-wide
                            border border-gray-700/50
                            focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50
                            placeholder:text-gray-600
                            ${aiEditState.isProcessing && aiEditState.targets.speech
                                ? `border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]
                                   ${!aiEditState.hasReceivedFirstToken ? 'placeholder:text-cyan-500 placeholder:animate-pulse' : ''}`
                                : ''}`}
                        disabled={aiEditState.isProcessing}
                    />
                </div>

                {/* AI Knowledge Section */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-300">AI Knowledge</div>
                        {hasAgentChanges && (
                            <button
                                onClick={handleSaveAgent}
                                disabled={isSavingAgent}
                                className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg 
                                    hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z" />
                                </svg>
                                {isSavingAgent ? 'Saving...' : 'Save'}
                            </button>
                        )}
                    </div>
                    <textarea
                        value={aiEditState.isProcessing && aiEditState.targets.knowledge
                            ? (aiEditState.hasReceivedFirstToken ? aiEditState.agentStream : '')
                            : editedAgent}
                        onChange={(e) => !aiEditState.isProcessing && handleContentChange(e.target.value, 'knowledge')}
                        placeholder={aiEditState.isProcessing && aiEditState.targets.knowledge && !aiEditState.hasReceivedFirstToken
                            ? "Generating..."
                            : "Enter context and knowledge for AI responses..."}
                        className={`w-full h-[120px] bg-gray-800/80 
                            text-gray-200 rounded-lg px-4 py-3 resize-none
                            text-[13px] font-mono leading-relaxed tracking-wide
                            border border-gray-700/50
                            focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50
                            placeholder:text-gray-600
                            ${aiEditState.isProcessing && aiEditState.targets.knowledge
                                ? `border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]
                                   ${!aiEditState.hasReceivedFirstToken ? 'placeholder:text-cyan-500 placeholder:animate-pulse' : ''}`
                                : ''}`}
                        disabled={aiEditState.isProcessing}
                    />
                </div>

                {/* AI Edit Section */}
                {isEditPage && (
                    <div className="relative bg-gray-800/30 rounded-xl p-4 border border-gray-700/50
                        transition-all duration-300 hover:border-cyan-500/30
                        hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]
                        group
                    ">
                        {/* Header with checkboxes */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 
                                    group-hover:animate-[pulse_2s_ease-in-out_infinite]
                                "/>
                                <h3 className="text-sm font-medium text-gray-300 tracking-tight
                                    group-hover:text-cyan-400 transition-colors duration-300
                                ">
                                    AI Edit
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <button
                                    onClick={() => setAIEditState(prev => ({
                                        ...prev,
                                        targets: { ...prev.targets, speech: !prev.targets.speech }
                                    }))}
                                    className={`px-2 py-1 rounded flex items-center gap-1.5 ${aiEditState.targets.speech
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'text-gray-400 hover:text-gray-300'
                                        }`}
                                >
                                    <div className={`w-3 h-3 rounded border ${aiEditState.targets.speech
                                        ? 'border-cyan-400 bg-cyan-500/20'
                                        : 'border-gray-600'
                                        }`}>
                                        {aiEditState.targets.speech && (
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                            </svg>
                                        )}
                                    </div>
                                    Speech
                                </button>
                                <button
                                    onClick={() => setAIEditState(prev => ({
                                        ...prev,
                                        targets: { ...prev.targets, knowledge: !prev.targets.knowledge }
                                    }))}
                                    className={`px-2 py-1 rounded flex items-center gap-1.5 ${aiEditState.targets.knowledge
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'text-gray-400 hover:text-gray-300'
                                        }`}
                                >
                                    <div className={`w-3 h-3 rounded border ${aiEditState.targets.knowledge
                                        ? 'border-cyan-400 bg-cyan-500/20'
                                        : 'border-gray-600'
                                        }`}>
                                        {aiEditState.targets.knowledge && (
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                            </svg>
                                        )}
                                    </div>
                                    Knowledge
                                </button>
                            </div>
                        </div>

                        {/* Input Form */}
                        <form onSubmit={handleAIEditSubmit} className="relative">
                            <input
                                type="text"
                                name="aiEdit"
                                placeholder="Type instructions like 'Make this longer' or 'Simplify language'..."
                                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-lg
                                    px-4 py-2.5 pr-12 text-[13px] text-gray-300
                                    placeholder:text-gray-500 placeholder:text-[12px]
                                    transition-all duration-300
                                    focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                                    hover:border-cyan-500/30
                                    hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]
                                    group-hover:border-cyan-500/20
                                "
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-1/2 -translate-y-1/2
                                    p-2 rounded-lg
                                    text-gray-400 
                                    transition-all duration-300
                                    hover:text-cyan-400
                                    hover:scale-110
                                    active:scale-95
                                    focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                                "
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                            </button>
                        </form>

                        {/* Quick Suggestions */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {quickSuggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        const input = document.querySelector('input[name="aiEdit"]') as HTMLInputElement;
                                        if (input) input.value = suggestion;
                                    }}
                                    className="px-2 py-1 text-[11px] rounded
                                        bg-gray-800/80 backdrop-blur-sm
                                        text-gray-400 border border-gray-700/50
                                        transition-all duration-200
                                        hover:text-cyan-400 hover:border-cyan-500/50
                                        hover:shadow-[0_0_10px_rgba(0,255,255,0.1)]
                                        active:scale-95"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}; 