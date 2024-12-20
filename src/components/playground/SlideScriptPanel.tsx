import React, { useState, useEffect } from 'react';
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
}

type TabType = 'script' | 'agent';

export const SlideScriptPanel = ({ currentSlide, scripts, onScriptChange, onScriptsUpdate, onScriptsGenerated, brdgeId, isGenerating = false }: SlideScriptPanelProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('script');
    const [editedScript, setEditedScript] = useState('');
    const [editedAgent, setEditedAgent] = useState('');
    const [hasScriptChanges, setHasScriptChanges] = useState(false);
    const [hasAgentChanges, setHasAgentChanges] = useState(false);
    const [isSavingScript, setIsSavingScript] = useState(false);
    const [isSavingAgent, setIsSavingAgent] = useState(false);

    useEffect(() => {
        if (scripts && !isGenerating) {
            try {
                // Check if the content is already in the new format
                const content = typeof scripts[currentSlide] === 'object'
                    ? scripts[currentSlide]
                    : { script: scripts[currentSlide], agent: '' };

                // Always update the state with the latest content
                setEditedScript(content.script || '');
                setEditedAgent(content.agent || '');
                setHasScriptChanges(false);
                setHasAgentChanges(false);

                // Log for debugging
                console.log('Updated script content:', content);
            } catch (error) {
                console.error('Error parsing script content:', error);
                setEditedScript('');
                setEditedAgent('');
            }
        } else if (isGenerating) {
            // Clear content while generating
            setEditedScript('');
            setEditedAgent('');
        }
    }, [scripts, currentSlide, isGenerating]);

    const handleContentChange = (content: string, type: TabType) => {
        if (type === 'script') {
            setEditedScript(content);
            setHasScriptChanges(true);
        } else {
            setEditedAgent(content);
            setHasAgentChanges(true);
        }
    };

    const handleSaveScript = async () => {
        if (!brdgeId || !scripts) return;

        setIsSavingScript(true);
        try {
            const updatedScripts = { ...scripts };

            // Now TypeScript knows this can be a ScriptContent object
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
    };

    const handleSaveAgent = async () => {
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
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
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
                    value={activeTab === 'script' ? editedScript : editedAgent}
                    onChange={(e) => handleContentChange(e.target.value, activeTab)}
                    placeholder={isGenerating
                        ? "Generating content..."
                        : activeTab === 'script'
                            ? "Enter script for this slide..."
                            : "Enter agent instructions for this slide..."
                    }
                    className={`w-full min-h-[400px] bg-gray-800/80 text-gray-200 rounded-lg px-4 py-3 resize-y
                        text-[13px] font-mono leading-relaxed tracking-wide
                        border border-gray-700/50
                        focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50
                        placeholder:text-gray-600
                        shadow-[0_0_15px_rgba(255,255,255,0.03)]
                        ${isGenerating ? 'opacity-50 cursor-wait' : ''}`}
                    disabled={isGenerating || isSavingScript || isSavingAgent}
                    style={{
                        boxShadow: '0 0 15px rgba(255,255,255,0.03), inset 0 0 20px rgba(255,255,255,0.02)'
                    }}
                />
            </div>
        </div>
    );
}; 