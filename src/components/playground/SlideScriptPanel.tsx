import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/api';
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ArrowRight, ChevronDown, ChevronUp, History, Save } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// Add this interface to define the script content structure
interface ScriptContent {
    script: string;
    agent: string;
}

interface ScriptVersion {
    script: string;
    agent: string;
    timestamp: string;
}

interface ScriptHistory {
    versions: ScriptVersion[];
    currentIndex: number;
}

interface HistoryEntry {
    script: string;
    knowledge: string;
    timestamp: Date;
    isSaved: boolean;
}

interface HistoryState {
    entries: HistoryEntry[];
    currentIndex: number;
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

interface AIEditComponentProps {
    onEdit: (instruction: string) => Promise<void>;
    isProcessing: boolean;
    targets: EditTargets;
    onTargetsChange: (targets: EditTargets) => void;
}

// Move quickSuggestions outside of components
const quickSuggestions: string[] = [
    'Make it conversational',
    'Add examples',
    'Simplify language'
];

const AIEditComponent: React.FC<AIEditComponentProps> = ({
    onEdit,
    isProcessing,
    targets,
    onTargetsChange
}) => {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const input = form.querySelector('input[name="aiEdit"]') as HTMLInputElement;
        if (input?.value) {
            onEdit(input.value);
            input.value = '';
        }
    };

    return (
        <div className="relative bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    <h3 className="text-sm font-medium text-gray-300">AI Edit</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <button
                        onClick={() => onTargetsChange({ ...targets, speech: !targets.speech })}
                        className={`px-2 py-1 rounded ${targets.speech ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                    >
                        Speech
                    </button>
                    <button
                        onClick={() => onTargetsChange({ ...targets, knowledge: !targets.knowledge })}
                        className={`px-2 py-1 rounded ${targets.knowledge ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                    >
                        Knowledge
                    </button>
                </div>
            </div>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    name="aiEdit"
                    placeholder="Type instructions like 'Make this longer' or 'Simplify language'..."
                    className="w-full bg-gray-900/50 border border-gray-700/50 rounded p-2"
                    disabled={isProcessing}
                />
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion: string, index: number) => (
                    <button
                        key={index}
                        onClick={() => onEdit(suggestion)}
                        disabled={isProcessing}
                        className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        </div>
    );
};

// Keep only the framer-motion variants
const slideAnimation = {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
};

const fadeAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
};

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
    const [scriptHistory, setScriptHistory] = useState<Record<string, ScriptHistory>>({});
    const [collapsedSections, setCollapsedSections] = useState<{
        speech: boolean;
        knowledge: boolean;
    }>({
        speech: false,
        knowledge: false
    });
    const [history, setHistory] = useState<HistoryState>({
        entries: [],
        currentIndex: -1
    });

    // Add undo/redo state
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Update undo/redo state whenever history changes
    useEffect(() => {
        setCanUndo(history.currentIndex > 0);
        setCanRedo(history.currentIndex < history.entries.length - 1);

        console.log('History updated:', {
            entries: history.entries.length,
            currentIndex: history.currentIndex,
            canUndo: history.currentIndex > 0,
            canRedo: history.currentIndex < history.entries.length - 1
        });
    }, [history]);

    // Update the effect that handles final AI edit content
    useEffect(() => {
        if (!aiEditState.isProcessing && aiEditState.hasReceivedFirstToken) {
            // Create a new history entry for the AI edit
            const newEntry = {
                script: aiEditState.targets.speech ? aiEditState.scriptStream : editedScript,
                knowledge: aiEditState.targets.knowledge ? aiEditState.agentStream : editedAgent,
                timestamp: new Date(),
                isSaved: false  // Mark as unsaved so user needs to explicitly save
            };

            // Update the content
            if (aiEditState.targets.speech && aiEditState.scriptStream) {
                setEditedScript(aiEditState.scriptStream);
                setHasScriptChanges(true);  // Show save button
            }
            if (aiEditState.targets.knowledge && aiEditState.agentStream) {
                setEditedAgent(aiEditState.agentStream);
                setHasAgentChanges(true);  // Show save button
            }

            // Add the AI edit to history
            setHistory(prev => {
                const newEntries = [...prev.entries.slice(0, prev.currentIndex + 1), newEntry];
                return {
                    entries: newEntries,
                    currentIndex: newEntries.length - 1
                };
            });
        }
    }, [aiEditState.isProcessing, aiEditState.hasReceivedFirstToken]);

    // Update the script initialization effect
    useEffect(() => {
        if (!scripts || !scripts[currentSlide]) return;

        const currentContent = scripts[currentSlide];

        // Only initialize history if it's empty or if we're switching slides
        if (history.entries.length === 0 || history.entries[0]?.script !== currentContent.script || history.entries[0]?.knowledge !== currentContent.agent) {
            console.log('Initializing history with:', currentContent);

            // Initialize with current content as first history entry
            setHistory({
                entries: [{
                    script: currentContent.script || '',
                    knowledge: currentContent.agent || '',
                    timestamp: new Date(),
                    isSaved: true
                }],
                currentIndex: 0
            });

            // Also set the current content
            setEditedScript(currentContent.script || '');
            setEditedAgent(currentContent.agent || '');
            setHasScriptChanges(false);
            setHasAgentChanges(false);
        }
    }, [currentSlide, scripts]);

    const handleContentChange = useCallback((content: string, type: TabType) => {
        // Update the content
        if (type === 'speech') {
            setEditedScript(content);
            setHasScriptChanges(true);
        } else {
            setEditedAgent(content);
            setHasAgentChanges(true);
        }

        // Add new entry to history
        setHistory(prev => {
            // Get the current content
            const newEntry = {
                script: type === 'speech' ? content : editedScript,
                knowledge: type === 'knowledge' ? content : editedAgent,
                timestamp: new Date(),
                isSaved: false
            };

            // Remove any future entries if we're not at the latest point
            const newEntries = [...prev.entries.slice(0, prev.currentIndex + 1), newEntry];

            return {
                entries: newEntries,
                currentIndex: newEntries.length - 1
            };
        });
    }, [editedScript, editedAgent]);

    const handleSaveScript = useCallback(async () => {
        if (!brdgeId || !scripts) return;

        setIsSavingScript(true);
        try {
            const updatedScripts = { ...scripts };
            updatedScripts[currentSlide] = {
                ...updatedScripts[currentSlide],
                script: editedScript
            };

            const response = await api.put(`/brdges/${brdgeId}/scripts/update`, {
                scripts: updatedScripts
            });

            if (response.data.scripts) {
                // Create a new saved entry in history
                const newEntry = {
                    script: editedScript,
                    knowledge: editedAgent,
                    timestamp: new Date(),
                    isSaved: true
                };

                setHistory(prev => {
                    const newEntries = [...prev.entries.slice(0, prev.currentIndex + 1), newEntry];
                    return {
                        entries: newEntries,
                        currentIndex: newEntries.length - 1
                    };
                });

                onScriptsUpdate?.(updatedScripts);
                setHasScriptChanges(false);
            }
        } catch (error) {
            console.error('Error updating script:', error);
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
                ...updatedScripts[currentSlide],
                agent: editedAgent
            };

            const response = await api.put(`/brdges/${brdgeId}/scripts/update`, {
                scripts: updatedScripts
            });

            if (response.data.scripts) {
                // Create a new saved entry in history
                const newEntry = {
                    script: editedScript,
                    knowledge: editedAgent,
                    timestamp: new Date(),
                    isSaved: true
                };

                setHistory(prev => {
                    const newEntries = [...prev.entries.slice(0, prev.currentIndex + 1), newEntry];
                    return {
                        entries: newEntries,
                        currentIndex: newEntries.length - 1
                    };
                });

                onScriptsUpdate?.(updatedScripts);
                setHasAgentChanges(false);
            }
        } catch (error) {
            console.error('Error updating agent:', error);
        } finally {
            setIsSavingAgent(false);
        }
    }, [brdgeId, scripts, currentSlide, editedScript, editedAgent, onScriptsUpdate]);

    const handleAIEdit = useCallback(async (instruction: string) => {
        if (!brdgeId || !currentSlide || aiEditState.isProcessing || !instruction) return;

        // Reset streaming state with empty strings to show fresh content
        setAIEditState(prev => ({
            ...prev,
            isProcessing: true,
            scriptStream: '',  // Start empty to show fresh stream
            agentStream: '',   // Start empty to show fresh stream
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

            const baseUrl = api.defaults.baseURL || 'http://localhost:5000';
            const eventSource = new EventSource(
                `${baseUrl.replace('/api', '')}/api/brdges/${brdgeId}/scripts/ai-edit?${params.toString()}`
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
                            scriptStream: '',  // Reset on error
                            agentStream: '',   // Reset on error
                            hasReceivedFirstToken: false
                        }));
                        eventSource.close();
                        return;
                    }

                    // Handle token-by-token updates
                    if (parsed.type === 'script' && parsed.token) {
                        setAIEditState(prev => ({
                            ...prev,
                            hasReceivedFirstToken: true,
                            scriptStream: prev.scriptStream + parsed.token
                        }));
                    } else if (parsed.type === 'agent' && parsed.token) {
                        setAIEditState(prev => ({
                            ...prev,
                            hasReceivedFirstToken: true,
                            agentStream: prev.agentStream + parsed.token
                        }));
                    }

                    // Remove the automatic content update on final
                    if (parsed.final) {
                        // Don't update editedScript/editedAgent here
                        // Let the user explicitly save the changes
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
                    scriptStream: '',  // Reset on error
                    agentStream: '',   // Reset on error
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
                scriptStream: '',  // Reset on error
                agentStream: '',   // Reset on error
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

    // Update the textarea styles to make the generating text more prominent
    const generatingTextStyles = `
        after:content-["Generating..."] 
        after:absolute after:top-1/2 after:left-1/2 
        after:-translate-x-1/2 after:-translate-y-1/2 
        after:text-cyan-400 
        after:text-sm after:font-medium
        after:animate-[pulse_1.5s_ease-in-out_infinite]
        after:pointer-events-none
        after:whitespace-nowrap
        after:tracking-wide
        after:shadow-[0_0_10px_rgba(34,211,238,0.3)]
    `;

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

    // Add function to fetch script history
    const fetchScriptHistory = useCallback(async () => {
        if (!brdgeId || !currentSlide) return;

        try {
            const response = await api.get(`/brdges/${brdgeId}/scripts/history`);
            const versions = response.data;

            // Organize versions by slide
            const slideVersions = versions.filter((v: any) =>
                v.scripts && v.scripts[currentSlide.toString()] && v.metadata?.generated_at
            ).map((v: any) => ({
                script: v.scripts[currentSlide.toString()].script,
                agent: v.scripts[currentSlide.toString()].agent,
                timestamp: v.metadata.generated_at
            }));

            if (slideVersions.length > 0) {
                setScriptHistory(prev => ({
                    ...prev,
                    [currentSlide]: {
                        versions: slideVersions,
                        currentIndex: slideVersions.length - 1
                    }
                }));
            }
        } catch (error) {
            console.error('Error fetching script history:', error);
        }
    }, [brdgeId, currentSlide]);

    // Fetch history when slide changes
    useEffect(() => {
        fetchScriptHistory();
    }, [currentSlide, fetchScriptHistory]);

    // Add undo/redo handlers
    const handleUndo = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation(); // Prevent click from propagating to collapse handler
        if (!canUndo) return;

        setHistory(prev => {
            const newIndex = prev.currentIndex - 1;
            const prevEntry = prev.entries[newIndex];

            // Update content
            setEditedScript(prevEntry.script);
            setEditedAgent(prevEntry.knowledge);

            // Set change flags by comparing with the latest saved entry
            const latestSavedEntry = prev.entries.findLast(entry => entry.isSaved);
            if (latestSavedEntry) {
                setHasScriptChanges(prevEntry.script !== latestSavedEntry.script);
                setHasAgentChanges(prevEntry.knowledge !== latestSavedEntry.knowledge);
            }

            return {
                ...prev,
                currentIndex: newIndex
            };
        });
    }, [canUndo]);

    const handleRedo = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation(); // Prevent click from propagating to collapse handler
        if (!canRedo) return;

        setHistory(prev => {
            const newIndex = prev.currentIndex + 1;
            const nextEntry = prev.entries[newIndex];

            // Update content
            setEditedScript(nextEntry.script);
            setEditedAgent(nextEntry.knowledge);

            // Set change flags by comparing with the latest saved entry
            const latestSavedEntry = prev.entries.findLast(entry => entry.isSaved);
            if (latestSavedEntry) {
                setHasScriptChanges(nextEntry.script !== latestSavedEntry.script);
                setHasAgentChanges(nextEntry.knowledge !== latestSavedEntry.knowledge);
            }

            return {
                ...prev,
                currentIndex: newIndex
            };
        });
    }, [canRedo]);

    // Update the history controls render function
    const renderHistoryControls = () => (
        <div className="flex items-center space-x-1 text-gray-400" onClick={e => e.stopPropagation()}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    <button
                        onClick={handleUndo}
                        disabled={!canUndo}
                        className={`p-1 rounded hover:bg-gray-700/50 transition-colors ${!canUndo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                    </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded shadow-lg border border-gray-800"
                        sideOffset={5}
                    >
                        {canUndo ? 'Undo changes' : 'No changes to undo'}
                        <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>

            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    <button
                        onClick={handleRedo}
                        disabled={!canRedo}
                        className={`p-1 rounded hover:bg-gray-700/50 transition-colors ${!canRedo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded shadow-lg border border-gray-800"
                        sideOffset={5}
                    >
                        {canRedo ? 'Redo changes' : 'No changes to redo'}
                        <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </div>
    );

    // Update the debug logging
    useEffect(() => {
        console.log('History updated:', {
            entries: history.entries.length,
            currentIndex: history.currentIndex,
            canUndo,
            canRedo,
            latestEntry: history.entries[history.currentIndex]
        });
    }, [history, canUndo, canRedo]);

    return (
        <Tooltip.Provider delayDuration={200}>
            <motion.div
                className="flex flex-col h-full space-y-4 pb-4 text-gray-300 px-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {isEditPage && (
                    <motion.div
                        className="sticky top-0 bg-gray-900/95 backdrop-blur-sm pt-4 pb-3 -mx-8 px-6 border-b border-gray-800/60 z-10"
                        initial={slideAnimation.initial}
                        animate={slideAnimation.animate}
                        exit={slideAnimation.exit}
                    >
                        <motion.div
                            className="relative bg-gray-800/50 rounded-lg p-3.5 border border-gray-700/50 shadow-lg transition-all duration-200 hover:border-gray-600/50"
                            whileHover={{ scale: 1.002 }}
                            transition={{ type: "spring", stiffness: 300 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                    <h3 className="text-sm font-medium text-cyan-400">AI Edit</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAIEditState(prev => ({
                                            ...prev,
                                            targets: { ...prev.targets, speech: !prev.targets.speech }
                                        }))}
                                        className={`px-2 py-0.5 text-xs rounded-md border transition-all duration-150 ${aiEditState.targets.speech
                                            ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30'
                                            : 'border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                                            }`}
                                    >
                                        Script
                                    </button>
                                    <button
                                        onClick={() => setAIEditState(prev => ({
                                            ...prev,
                                            targets: { ...prev.targets, knowledge: !prev.targets.knowledge }
                                        }))}
                                        className={`px-2 py-0.5 text-xs rounded-md border transition-all duration-150 ${aiEditState.targets.knowledge
                                            ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30'
                                            : 'border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                                            }`}
                                    >
                                        Knowledge
                                    </button>
                                </div>
                            </div>
                            <div className="relative mb-2">
                                <form onSubmit={handleAIEditSubmit} className="group flex gap-1.5">
                                    <input
                                        type="text"
                                        name="aiEdit"
                                        placeholder="Type instructions like 'Make this longer' or 'Simplify language'..."
                                        className="flex-1 bg-gray-900/80 border border-gray-700/50 rounded-md p-2 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 placeholder:text-gray-500 placeholder:text-xs transition-all duration-200 group-hover:border-gray-600/50"
                                        disabled={aiEditState.isProcessing}
                                    />
                                    <Tooltip.Root>
                                        <Tooltip.Trigger asChild>
                                            <motion.button
                                                type="submit"
                                                disabled={aiEditState.isProcessing}
                                                className="relative px-2 py-1.5 rounded-md bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 transition-all duration-150 group overflow-hidden border border-cyan-500/20"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent group-hover:via-cyan-500/20 translate-x-[-200%] group-hover:translate-x-[200%] transition-all duration-1000 ease-out" />
                                                <div className="relative flex items-center">
                                                    <ArrowRight className="w-4 h-4 mr-[-4px]" />
                                                    <ArrowRight className="w-4 h-4" />
                                                </div>
                                            </motion.button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content
                                                className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded shadow-lg border border-gray-800"
                                                sideOffset={5}
                                            >
                                                Generate AI response
                                                <Tooltip.Arrow className="fill-gray-900" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>
                                </form>
                            </div>
                            <AnimatePresence>
                                <motion.div
                                    className="flex flex-wrap gap-1"
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    {quickSuggestions.map((suggestion: string, index: number) => (
                                        <motion.button
                                            key={index}
                                            onClick={() => {
                                                const input = document.querySelector('input[name="aiEdit"]') as HTMLInputElement;
                                                if (input) {
                                                    input.value = suggestion;
                                                    input.focus();
                                                }
                                            }}
                                            disabled={aiEditState.isProcessing}
                                            className="px-2 py-0.5 text-[11px] rounded-full border border-gray-700/50 bg-gray-900/80 text-gray-400 hover:bg-gray-800 hover:text-cyan-400 hover:border-cyan-500/30 disabled:opacity-50 transition-all duration-150"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {suggestion}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}

                <motion.div
                    className="flex flex-col flex-1 min-h-0 space-y-4"
                    variants={fadeAnimation}
                    initial="initial"
                    animate="animate"
                >
                    <motion.div
                        className={`flex flex-col flex-1 min-h-0 group transition-all duration-200 ${collapsedSections.speech ? 'mb-0' : ''}`}
                        layout
                    >
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <motion.div
                                    className="flex items-center justify-between mb-2 cursor-pointer select-none"
                                    onClick={() => setCollapsedSections(prev => ({ ...prev, speech: !prev.speech }))}
                                    whileHover={{ opacity: 0.9 }}
                                >
                                    <div className="text-sm font-medium text-cyan-400 flex items-center gap-2 group-hover:text-cyan-300 transition-colors duration-150">
                                        <span className="flex items-center gap-1.5">
                                            {collapsedSections.speech ? (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            )}
                                            Speech Script
                                        </span>
                                        {hasScriptChanges && (
                                            <motion.div
                                                className="w-1 h-1 rounded-full bg-cyan-500"
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-1 text-gray-400">
                                            {renderHistoryControls()}
                                        </div>
                                        <AnimatePresence>
                                            {(hasScriptChanges || (!aiEditState.isProcessing && aiEditState.targets.speech && aiEditState.scriptStream)) && (
                                                <motion.button
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (aiEditState.scriptStream) {
                                                            setEditedScript(aiEditState.scriptStream);
                                                            setHasScriptChanges(true);
                                                            setAIEditState(prev => ({
                                                                ...prev,
                                                                scriptStream: ''
                                                            }));
                                                        }
                                                        handleSaveScript();
                                                    }}
                                                    disabled={isSavingScript || aiEditState.isProcessing}
                                                    className="px-2 py-0.5 text-xs rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 transition-all duration-150 flex items-center gap-1"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Save className="w-3 h-3" />
                                                    {isSavingScript ? 'Saving...' : 'Save Changes'}
                                                </motion.button>
                                            )}

                                            {(hasAgentChanges || (!aiEditState.isProcessing && aiEditState.targets.knowledge && aiEditState.agentStream)) && (
                                                <motion.button
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (aiEditState.agentStream) {
                                                            setEditedAgent(aiEditState.agentStream);
                                                            setHasAgentChanges(true);
                                                            setAIEditState(prev => ({
                                                                ...prev,
                                                                agentStream: ''
                                                            }));
                                                        }
                                                        handleSaveAgent();
                                                    }}
                                                    disabled={isSavingAgent || aiEditState.isProcessing}
                                                    className="px-2 py-0.5 text-xs rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 transition-all duration-150 flex items-center gap-1"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Save className="w-3 h-3" />
                                                    {isSavingAgent ? 'Saving...' : 'Save Changes'}
                                                </motion.button>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content
                                    className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded shadow-lg border border-gray-800"
                                    sideOffset={5}
                                >
                                    Click to {collapsedSections.speech ? 'expand' : 'collapse'}
                                    <Tooltip.Arrow className="fill-gray-900" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <AnimatePresence>
                            {!collapsedSections.speech && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                >
                                    <textarea
                                        value={aiEditState.isProcessing && aiEditState.targets.speech ? aiEditState.scriptStream : editedScript}
                                        onChange={(e) => handleContentChange(e.target.value, 'speech')}
                                        className={`flex-1 w-full bg-gray-800/50 border border-gray-700/50 rounded-md p-3 text-xs leading-relaxed text-gray-100 resize-none min-h-[140px] focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200 group-hover:border-gray-600/50 ${aiEditState.isProcessing && aiEditState.targets.speech && !aiEditState.hasReceivedFirstToken ? generatingTextStyles : ''
                                            }`}
                                        placeholder="Enter speech script..."
                                        disabled={aiEditState.isProcessing && aiEditState.targets.speech}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <div className={`flex flex-col flex-1 min-h-0 group transition-all duration-200 ${collapsedSections.knowledge ? 'mb-0' : ''}`}>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <motion.div
                                    className="flex items-center justify-between mb-2 cursor-pointer select-none"
                                    onClick={() => setCollapsedSections(prev => ({ ...prev, knowledge: !prev.knowledge }))}
                                    whileHover={{ opacity: 0.9 }}
                                >
                                    <div className="text-sm font-medium text-cyan-400 flex items-center gap-2 group-hover:text-cyan-300 transition-colors duration-150">
                                        <span className="flex items-center gap-1.5">
                                            {collapsedSections.knowledge ? (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            )}
                                            AI Knowledge
                                        </span>
                                        {hasAgentChanges && (
                                            <motion.div
                                                className="w-1 h-1 rounded-full bg-cyan-500"
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-1 text-gray-400">
                                            {renderHistoryControls()}
                                        </div>
                                        <AnimatePresence>
                                            {(hasAgentChanges || aiEditState.isProcessing) && (
                                                <motion.button
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSaveAgent();
                                                    }}
                                                    disabled={isSavingAgent || aiEditState.isProcessing}
                                                    className="px-2 py-0.5 text-xs rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 transition-all duration-150 flex items-center gap-1"
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Save className="w-3 h-3" />
                                                    {isSavingAgent ? 'Saving...' : 'Save Changes'}
                                                </motion.button>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content
                                    className="bg-gray-900 text-gray-300 text-xs px-2 py-1 rounded shadow-lg border border-gray-800"
                                    sideOffset={5}
                                >
                                    Click to {collapsedSections.knowledge ? 'expand' : 'collapse'}
                                    <Tooltip.Arrow className="fill-gray-900" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <AnimatePresence>
                            {!collapsedSections.knowledge && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                >
                                    <textarea
                                        value={aiEditState.isProcessing && aiEditState.targets.knowledge ? aiEditState.agentStream : editedAgent}
                                        onChange={(e) => handleContentChange(e.target.value, 'knowledge')}
                                        className={`flex-1 w-full bg-gray-800/50 border border-gray-700/50 rounded-md p-3 text-xs leading-relaxed text-gray-100 resize-none min-h-[140px] focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200 group-hover:border-gray-600/50 ${aiEditState.isProcessing && aiEditState.targets.knowledge && !aiEditState.hasReceivedFirstToken ? generatingTextStyles : ''
                                            }`}
                                        placeholder="Enter AI knowledge..."
                                        disabled={aiEditState.isProcessing && aiEditState.targets.knowledge}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </Tooltip.Provider>
    );
}; 