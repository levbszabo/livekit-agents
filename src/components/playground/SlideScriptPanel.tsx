import React, { useState, useEffect } from 'react';
import { api } from '@/api';

interface SlideScriptPanelProps {
    currentSlide: number;
    scripts: Record<string, string> | null;
    onScriptChange?: (slideNumber: string, content: string) => void;
    onScriptsUpdate?: (scripts: Record<string, string>) => void;
    brdgeId?: string | number | null;
    isGenerating?: boolean;
    onScriptsGenerated?: (newScripts: Record<string, any>) => void;
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
            // Create a new scripts object that includes all existing scripts
            const updatedScripts = { ...scripts };

            // Update or add the current slide's content
            updatedScripts[currentSlide] = {
                script: editedScript,
                agent: (typeof scripts[currentSlide] === 'object'
                    ? scripts[currentSlide].agent
                    : '') || editedAgent
            };

            const response = await api.put(`/brdges/${brdgeId}/scripts/update`, {
                scripts: updatedScripts
            });

            if (response.data.scripts) {
                onScriptsUpdate?.(response.data.scripts);
            }

            setHasScriptChanges(false);
            console.log('Script updated successfully');
        } catch (error) {
            console.error('Error updating script:', error);
            // Revert to previous script if update fails
            if (scripts[currentSlide]) {
                try {
                    const content = typeof scripts[currentSlide] === 'object'
                        ? scripts[currentSlide]
                        : JSON.parse(scripts[currentSlide]);
                    setEditedScript(content.script || '');
                } catch {
                    setEditedScript(scripts[currentSlide]);
                }
            }
        } finally {
            setIsSavingScript(false);
        }
    };

    const handleSaveAgent = async () => {
        if (!brdgeId || !scripts) return;

        setIsSavingAgent(true);
        try {
            // Create a new scripts object that includes all existing scripts
            const updatedScripts = { ...scripts };

            // Update or add the current slide's content
            updatedScripts[currentSlide] = {
                script: (typeof scripts[currentSlide] === 'object'
                    ? scripts[currentSlide].script
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
            console.log('Agent instructions updated successfully');
        } catch (error) {
            console.error('Error updating agent instructions:', error);
            // Revert to previous agent text if update fails
            if (scripts[currentSlide]) {
                try {
                    const content = typeof scripts[currentSlide] === 'object'
                        ? scripts[currentSlide]
                        : JSON.parse(scripts[currentSlide]);
                    setEditedAgent(content.agent || '');
                } catch {
                    setEditedAgent('');
                }
            }
        } finally {
            setIsSavingAgent(false);
        }
    };

    return (
        <div className="p-4 bg-gray-900 border-t border-gray-800">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-400">
                            Slide {currentSlide}
                            {(!scripts || !scripts[currentSlide]) && (
                                <span className="ml-2 text-gray-500">
                                    {isGenerating ? 'Generating...' : '(No content available)'}
                                </span>
                            )}
                        </h3>
                        {isGenerating && (
                            <div className="animate-pulse flex space-x-2">
                                <div className="h-2 w-2 bg-cyan-400 rounded-full"></div>
                                <div className="h-2 w-2 bg-cyan-400 rounded-full"></div>
                                <div className="h-2 w-2 bg-cyan-400 rounded-full"></div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-gray-800 rounded-md overflow-hidden">
                            <button
                                onClick={() => setActiveTab('script')}
                                className={`px-3 py-1 text-xs transition-colors ${activeTab === 'script'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-gray-400 hover:text-gray-300'
                                    }`}
                            >
                                Script
                            </button>
                            <button
                                onClick={() => setActiveTab('agent')}
                                className={`px-3 py-1 text-xs transition-colors ${activeTab === 'agent'
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
                                className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded-md hover:bg-green-500/30 disabled:opacity-50"
                            >
                                {(activeTab === 'script' ? isSavingScript : isSavingAgent) ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </div>
                <textarea
                    value={activeTab === 'script' ? editedScript : editedAgent}
                    onChange={(e) => handleContentChange(e.target.value, activeTab)}
                    placeholder={isGenerating
                        ? "Generating content..."
                        : activeTab === 'script'
                            ? "Enter script for this slide..."
                            : "Enter agent instructions for this slide..."
                    }
                    className={`w-full h-24 bg-gray-800 text-gray-200 rounded-md px-3 py-2 resize-none placeholder:text-gray-600
                        ${isGenerating ? 'opacity-50 cursor-wait' : ''}`}
                    disabled={isGenerating || isSavingScript || isSavingAgent}
                />
            </div>
        </div>
    );
}; 