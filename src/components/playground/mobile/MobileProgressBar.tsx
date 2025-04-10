import React, { useState, useRef, useEffect } from 'react';
import { MobileTimelineMarkers } from './MobileTimelineMarkers';
import { EngagementOpportunity } from '../PlaygroundMobile';

interface MobileProgressBarProps {
    currentTime: number;
    duration: number;
    videoRef: React.RefObject<HTMLVideoElement>;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    isPlaying: boolean;
    engagementOpportunities: EngagementOpportunity[];
    onMarkerClick?: (timestamp: string) => void;
}

export const MobileProgressBar: React.FC<MobileProgressBarProps> = ({
    currentTime,
    duration,
    videoRef,
    setCurrentTime,
    setIsPlaying,
    isPlaying,
    engagementOpportunities,
    onMarkerClick,
}) => {
    const progressBarRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    // Calculate the progress bar width for proper marker positioning
    useEffect(() => {
        const updateProgressBarWidth = () => {
            if (progressBarRef.current) {
                setProgressBarWidth(progressBarRef.current.offsetWidth);
            }
        };

        // Initial update
        updateProgressBarWidth();

        // Add resize listener
        window.addEventListener('resize', updateProgressBarWidth);

        // Clean up
        return () => {
            window.removeEventListener('resize', updateProgressBarWidth);
        };
    }, []);

    // Handle touch and mouse events for seeking
    const handleProgressBarInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || !videoRef.current || !videoRef.current.duration) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * videoRef.current.duration;

        if (isFinite(newTime) && !isNaN(newTime)) {
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    // Touch handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        handleProgressBarInteraction(e);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isDragging) {
            handleProgressBarInteraction(e);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        handleProgressBarInteraction(e);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            handleProgressBarInteraction(e);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Format time for display
    const formatTime = (time: number): string => {
        if (!isFinite(time) || isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="px-4 py-3 flex flex-col">
            {/* Time display */}
            <div className="flex justify-between text-[11px] text-[#1E2A42] mb-1 px-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Progress bar container */}
            <div className="relative h-10 flex items-center">
                {/* Main progress bar track */}
                <div
                    ref={progressBarRef}
                    className={`h-5 bg-gray-800/70 rounded-full cursor-pointer 
            w-full transition-all duration-300 relative
            ${isHovering || isDragging ? 'bg-gray-700/80 shadow-inner' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => {
                        handleMouseUp();
                        setIsHovering(false);
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Filled progress */}
                    <div
                        className="h-full bg-gradient-to-r from-[#7C1D1D] to-[#7C1D1D] rounded-full 
              transition-all duration-150 relative"
                        style={{
                            width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                        }}
                    />

                    {/* Timeline markers */}
                    {engagementOpportunities && engagementOpportunities.length > 0 && (
                        <MobileTimelineMarkers
                            engagementOpportunities={engagementOpportunities}
                            duration={duration}
                            currentTime={currentTime}
                            containerWidth={progressBarWidth}
                            onMarkerClick={onMarkerClick}
                        />
                    )}

                    {/* Draggable thumb - larger for touch */}
                    {duration > 0 && (
                        <div
                            className={`absolute top-1/2 -translate-y-1/2 
                rounded-full
                border-2 border-white
                transition-all duration-200
                ${isDragging || isHovering
                                    ? 'w-7 h-7 bg-[#7C1D1D] border-[#A83838] shadow-[0_0_10px_rgba(124,29,29,0.5)]'
                                    : 'w-6 h-6 bg-[#7C1D1D] border-[#A83838] shadow-[0_0_6px_rgba(124,29,29,0.3)]'
                                }`}
                            style={{
                                left: `${(currentTime / duration) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}; 