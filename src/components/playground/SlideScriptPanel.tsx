import React, { useState, useEffect } from 'react';
import { api } from '@/api';

interface SlideScriptPanelProps {
    currentSlide: number;
    scripts: Record<string, string> | null;
    onScriptChange?: (slideNumber: string, content: string) => void;
    onScriptsUpdate?: (scripts: Record<string, string>) => void;
    brdgeId?: string | number | null;
}

export const SlideScriptPanel = ({ currentSlide, scripts, onScriptChange, onScriptsUpdate, brdgeId }: SlideScriptPanelProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedScript, setEditedScript] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (scripts && scripts[currentSlide]) {
            setEditedScript(scripts[currentSlide]);
        } else {
            setEditedScript('');
        }
        setHasChanges(false);
    }, [currentSlide, scripts]);

    const handleScriptChange = (content: string) => {
        setEditedScript(content);
        setHasChanges(true);
        onScriptChange?.(currentSlide.toString(), content);
    };

    const handleSaveChanges = async () => {
        if (!brdgeId || !scripts) return;

        setIsSaving(true);
        try {
            const response = await api.put(`/brdges/${brdgeId}/scripts/update`, {
                scripts: {
                    ...scripts,
                    [currentSlide]: editedScript
                }
            });

            if (response.data.scripts) {
                setEditedScript(response.data.scripts[currentSlide]);
                onScriptsUpdate?.(response.data.scripts);
            }

            setHasChanges(false);
            console.log('Scripts updated successfully');
        } catch (error) {
            console.error('Error updating scripts:', error);
            if (scripts[currentSlide]) {
                setEditedScript(scripts[currentSlide]);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 bg-gray-900 border-t border-gray-800">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-400">
                        Script for Slide {currentSlide}
                        {(!scripts || !scripts[currentSlide]) && (
                            <span className="ml-2 text-gray-500">(No script available)</span>
                        )}
                    </h3>
                    {hasChanges && (
                        <button
                            onClick={handleSaveChanges}
                            disabled={isSaving}
                            className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded-md hover:bg-green-500/30 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
                <textarea
                    value={editedScript}
                    onChange={(e) => handleScriptChange(e.target.value)}
                    placeholder={(!scripts || !scripts[currentSlide]) ? "No script available for this slide" : ""}
                    className="w-full h-24 bg-gray-800 text-gray-200 rounded-md px-3 py-2 resize-none placeholder:text-gray-600"
                    disabled={isSaving}
                />
            </div>
        </div>
    );
}; 