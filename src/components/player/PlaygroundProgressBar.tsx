import React, { useState, useEffect, useRef } from 'react';
import { EngagementOpportunity } from '../playground/Playground';
import TimelineMarkers from './TimelineMarkers';

// Get the ConfigTab type from the same source as Playground.tsx
type ConfigTab = 'teaching-persona' | 'voice-clone' | 'chat' | 'share' | 'engagement';

interface PlaygroundProgressBarProps {
    currentTime: number;
    duration: number;
    videoRef: React.RefObject<HTMLVideoElement>;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    isPlaying: boolean;
    engagementOpportunities: EngagementOpportunity[];
    setActiveTab: (tab: ConfigTab) => void;
}

/**
 * A custom progress bar component that includes engagement markers
 */
const PlaygroundProgressBar: React.FC<PlaygroundProgressBarProps> = ({
    currentTime,
    duration,
    videoRef,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    engagementOpportunities,
    setActiveTab
}) => {
    const progressBarRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
    const [isHovering, setIsHovering] = useState(false);

    // Update progress bar width when component mounts and on window resize
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

    // Add a CSS class for engagement highlighting
    useEffect(() => {
        // Add the CSS for the highlight-pulse animation
        const style = document.createElement('style');
        style.textContent = `
      @keyframes highlightPulse {
        0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(34, 211, 238, 0); }
        100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
      }
      .highlight-pulse {
        animation: highlightPulse 1s ease-out;
        border-color: rgba(34, 211, 238, 0.6) !important;
        background-color: rgba(34, 211, 238, 0.1) !important;
      }
    `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Handle clicks and drags on the progress bar
    const handleProgressBarInteraction = (e: React.MouseEvent) => {
        if (!progressBarRef.current || !videoRef.current || !videoRef.current.duration) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * videoRef.current.duration;

        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

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

    const handleMouseEnter = () => {
        setIsHovering(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
    };

    // Handle marker click to navigate to the engagement opportunities tab
    const handleMarkerClick = (engagementId: string) => {
        // Update selected engagement for highlighting in markers
        setSelectedEngagementId(engagementId);

        // Find the engagement
        const engagement = engagementOpportunities.find(e => e.id === engagementId);
        if (engagement) {
            // Set active tab to engagement
            setActiveTab('engagement');

            // Scroll to the engagement element with a short delay to ensure tab switch is complete
            setTimeout(() => {
                // The ID format used here needs to match the format in the EngagementCard component
                const engagementElementId = `engagement-card-${engagementId}`;
                const engagementElement = document.getElementById(engagementElementId);

                if (engagementElement) {
                    engagementElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Highlight the element temporarily
                    engagementElement.classList.add('highlight-pulse');
                    setTimeout(() => {
                        engagementElement.classList.remove('highlight-pulse');
                    }, 2000);
                } else {
                    console.log(`Could not find element with ID ${engagementElementId}`);
                }
            }, 100);

            // Optionally pause the video
            if (isPlaying && videoRef.current) {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    return (
        <div className="flex-1 relative">
            {/* Outer bar (full width) */}
            <div
                ref={progressBarRef}
                className={`h-4 bg-gray-800/70 rounded-full cursor-pointer 
                   transition-all duration-300 relative
                   ${isHovering || isDragging ? 'bg-gray-700/80 shadow-inner' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => {
                    handleMouseUp();
                    handleMouseLeave();
                }}
            >
                {/* Filled progress */}
                <div
                    className="h-full bg-gradient-to-r from-[#7C1D1D] to-[#7C1D1D] rounded-full transition-all duration-150 relative"
                    style={{
                        width: duration > 0
                            ? `${(currentTime / duration) * 100}%`
                            : '0%',
                    }}
                >
                </div>

                {/* Draggable Thumb */}
                {duration > 0 && (
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 
                           rounded-full
                           border-2 border-white
                           transition-all duration-200
                           ${isDragging || isHovering
                                ? 'w-5 h-5 bg-[#7C1D1D] border-[#A83838] shadow-[0_0_10px_rgba(124,29,29,0.5)]'
                                : 'w-4 h-4 bg-[#7C1D1D] border-[#A83838] shadow-[0_0_6px_rgba(124,29,29,0.3)] opacity-90'}`}
                        style={{
                            left: `${(currentTime / duration) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                )}

                {/* Timeline Markers */}
                {engagementOpportunities && engagementOpportunities.length > 0 && (
                    <TimelineMarkers
                        engagementOpportunities={engagementOpportunities}
                        duration={duration}
                        currentTime={currentTime}
                        containerWidth={progressBarWidth}
                        onMarkerClick={handleMarkerClick}
                        selectedEngagementId={selectedEngagementId || undefined}
                    />
                )}
            </div>
        </div>
    );
};

export default PlaygroundProgressBar; 