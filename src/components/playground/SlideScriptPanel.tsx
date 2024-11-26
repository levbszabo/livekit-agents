import React from 'react';

interface SlideScriptPanelProps {
    currentSlide: number;
    scripts: Record<string, string> | null;
    isGenerating: boolean;
}

export const SlideScriptPanel = ({
    currentSlide,
    scripts,
    isGenerating
}: SlideScriptPanelProps) => {
    if (isGenerating) {
        return (
            <div className="p-6 bg-gray-900 border-t border-gray-800">
                <div className="flex items-center justify-center text-gray-400">
                    <span className="animate-pulse">Generating scripts...</span>
                </div>
            </div>
        );
    }

    if (!scripts) {
        return (
            <div className="p-6 bg-gray-900 border-t border-gray-800">
                <div className="flex items-center justify-center text-gray-400">
                    <span>No script generated yet</span>
                </div>
            </div>
        );
    }

    const currentScript = scripts[currentSlide.toString()];

    return (
        <div className="p-6 bg-gray-900 border-t border-gray-800">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-300">Script for Slide {currentSlide}</span>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-gray-300 leading-relaxed min-h-[100px]">
                    {currentScript || 'No script available for this slide'}
                </div>
            </div>
        </div>
    );
}; 