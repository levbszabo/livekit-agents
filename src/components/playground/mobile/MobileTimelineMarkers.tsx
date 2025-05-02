import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EngagementOpportunity } from '../PlaygroundMobile';

// Import the logo directly to let webpack handle it
// import stampLogo from '../../../assets/stamp-logo.png'; // Removed import
// Extract the src property for TypeScript compatibility
// const stampLogoPath = stampLogo.src; // Removed logo path

// Smaller marker size for mobile view
const MARKER_SIZE = 16;
const MARKER_HOVER_SCALE = 1.15;

// Glow effects for markers - Updated to blue
const MARKER_GLOW_ACTIVE = 'shadow-[0_0_10px_rgba(59,130,246,0.8)]';
const MARKER_GLOW_INACTIVE = 'shadow-[0_0_6px_rgba(59,130,246,0.5)]';

interface MobileTimelineMarkersProps {
    engagementOpportunities: EngagementOpportunity[];
    duration: number;
    currentTime: number;
    containerWidth: number;
    onMarkerClick?: (timestamp: string) => void;
}

export const MobileTimelineMarkers: React.FC<MobileTimelineMarkersProps> = ({
    engagementOpportunities,
    duration,
    currentTime,
    containerWidth,
    onMarkerClick,
}) => {
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

    // Don't render if no duration available
    if (!duration || duration === 0) {
        return null;
    }

    // Helper function to convert timestamp (00:00:00) to seconds
    const timestampToSeconds = (timestamp: string): number => {
        if (!timestamp) return 0;

        const parts = timestamp.split(':');
        if (parts.length === 3) {
            return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        } else if (parts.length === 2) {
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
        return 0;
    };

    // Group markers by timestamp to avoid complete overlaps
    const groupedMarkers: Record<string, EngagementOpportunity[]> = {};

    engagementOpportunities.forEach(engagement => {
        const key = engagement.timestamp;
        if (!groupedMarkers[key]) {
            groupedMarkers[key] = [];
        }
        groupedMarkers[key].push(engagement);
    });

    // Calculate positions with minimum distance to avoid visual overlapping
    const MIN_MARKER_DISTANCE = 5; // percentage
    const adjustedPositions: Record<string, number> = {};
    const markerPositions = Object.keys(groupedMarkers).map(timestamp => {
        return {
            timestamp,
            position: (timestampToSeconds(timestamp) / duration) * 100
        };
    });

    // Sort markers by position
    markerPositions.sort((a, b) => a.position - b.position);

    // Adjust positions for markers that are too close
    for (let i = 0; i < markerPositions.length; i++) {
        const current = markerPositions[i];
        adjustedPositions[current.timestamp] = current.position;

        if (i < markerPositions.length - 1) {
            const next = markerPositions[i + 1];
            const distance = next.position - current.position;

            if (distance < MIN_MARKER_DISTANCE) {
                next.position = current.position + MIN_MARKER_DISTANCE;
            }
        }
    }

    // Add click handler for marker interactions
    const handleMarkerClick = (timestamp: string) => {
        if (onMarkerClick) {
            onMarkerClick(timestamp);
        }
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            {Object.entries(groupedMarkers).map(([timestamp, engagements]) => {
                const seconds = timestampToSeconds(timestamp);
                const position = adjustedPositions[timestamp] || (seconds / duration) * 100;

                return engagements.map((engagement, index) => {
                    // Determine if this marker is active
                    const isActive = currentTime >= seconds && currentTime <= seconds + 1;
                    const isHovered = engagement.id === hoveredMarkerId;

                    return (
                        <React.Fragment key={engagement.id}>
                            {/* The stamp logo marker */}
                            <motion.div
                                className="absolute top-1/2 pointer-events-auto"
                                style={{
                                    left: `${position}%`,
                                    marginTop: "-10px", // Half of marker size
                                    zIndex: isHovered ? 20 : 10,
                                    transform: 'translateX(-50%)',
                                }}
                                animate={{
                                    scale: isHovered ? MARKER_HOVER_SCALE : 1,
                                    y: isHovered ? -2 : 0 // Slight raise on hover
                                }}
                                transition={{ duration: 0.2 }}
                                onMouseEnter={() => setHoveredMarkerId(engagement.id)}
                                onMouseLeave={() => setHoveredMarkerId(null)}
                                onTouchStart={() => setHoveredMarkerId(engagement.id)}
                                onTouchEnd={() => setHoveredMarkerId(null)}
                                onClick={() => handleMarkerClick(timestamp)}
                            >
                                {/* Circular background */}
                                <div
                                    className={`
                                        rounded-full bg-blue-500/80 p-0
                                        flex items-center justify-center
                                        ${isActive ? MARKER_GLOW_ACTIVE : MARKER_GLOW_INACTIVE}
                                        ${isActive || isHovered ? 'border-[0.5px] border-blue-300' : ''}
                                    `}
                                    style={{
                                        width: `${MARKER_SIZE}px`,
                                        height: `${MARKER_SIZE}px`,
                                    }}
                                >
                                    {/* Stamp logo image - REMOVED */}
                                    {/* 
                                    <img
                                        src={stampLogoPath}
                                        alt="Marker"
                                        className="w-[90%] h-[90%] object-contain"
                                        style={{
                                            opacity: isActive || isHovered ? 1 : 0.8,
                                            filter: `brightness(${isActive || isHovered ? 1.2 : 1})`
                                        }}
                                    />
                                    */}
                                </div>
                            </motion.div>
                        </React.Fragment>
                    );
                });
            })}
        </div>
    );
}; 