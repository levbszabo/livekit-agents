import React, { useState, useEffect } from 'react';
import { api } from '@/api';

interface SlideScriptPanelProps {
    currentSlide: number;
    scripts: Record<string, string> | null;
    onScriptChange?: (slideNumber: string, content: string) => void;
    brdgeId?: string | number | null;
}

export const SlideScriptPanel = ({ currentSlide, scripts, onScriptChange, brdgeId }: SlideScriptPanelProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedScript, setEditedScript] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (scripts && scripts[currentSlide]) {
            setEditedScript(scripts[currentSlide]);
        }
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
            await api.put(`/api/brdges/${brdgeId}/scripts/update`, {
                scripts: {
                    ...scripts,
                    [currentSlide]: editedScript
                }
            });
            setHasChanges(false);
            console.log('Scripts updated successfully');
        } catch (error) {
            console.error('Error updating scripts:', error);
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
                    className="w-full h-24 bg-gray-800 text-gray-200 rounded-md px-3 py-2 resize-none"
                />
            </div>
        </div>
    );
}; 