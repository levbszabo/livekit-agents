import React from 'react';
import { ConnectionState } from 'livekit-client';

interface ViewerHeaderProps {
    title: string;
    height: number;
    currentSlide: number;
    totalSlides: number;
    connectionState?: ConnectionState;
}

export const ViewerHeader: React.FC<ViewerHeaderProps> = ({
    title,
    height,
    currentSlide,
    totalSlides,
    connectionState
}) => {
    return (
        <div
            className="w-full bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between"
            style={{ height: `${height}px` }}
        >
            <div className="flex items-center gap-4">
                <h1 className="text-white text-lg font-medium">{title}</h1>
                {connectionState === ConnectionState.Connected && (
                    <span className="flex items-center gap-2 text-cyan-400 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        AI Assistant Ready
                    </span>
                )}
            </div>
            <div className="text-gray-400 text-sm">
                Slide {currentSlide} of {totalSlides}
            </div>
        </div>
    );
}; 