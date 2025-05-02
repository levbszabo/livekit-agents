import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EngagementOpportunity } from '../playground/Playground';

// Removed stamp logo import

// Increase marker size for better visibility
const MARKER_SIZE = 16; // Adjusted size for a simple circle marker
const MARKER_HOVER_SCALE = 1.2;

// Azure Blue glow effects for markers
const MARKER_GLOW_ACTIVE = 'shadow-[0_0_10px_rgba(59,130,246,0.7)]'; // Azure blue
const MARKER_GLOW_INACTIVE = 'shadow-[0_0_6px_rgba(59,130,246,0.4)]'; // Azure blue

interface TimelineMarkersProps {
    engagementOpportunities: EngagementOpportunity[];
    duration: number;
    currentTime: number;
    onMarkerClick: (engagementId: string) => void;
    containerWidth: number;
    selectedEngagementId?: string;
    // Optional: Pass color prop if needed
    // markerColor?: string;
}

// Helper function to convert timestamp (00:00:00) to seconds
const timestampToSeconds = (timestamp: string): number => {
    // Handle empty timestamps
    if (!timestamp) return 0;

    const parts = timestamp.split(':');
    // Handle different formats (00:00:00 vs 00:00)
    if (parts.length === 3) {
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    } else if (parts.length === 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
};

const TimelineMarkers: React.FC<TimelineMarkersProps> = ({
    engagementOpportunities,
    duration,
    currentTime,
    onMarkerClick,
    containerWidth,
    selectedEngagementId
    // markerColor = 'rgba(59, 130, 246)' // Default to azure blue if prop is added
}) => {
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

    // Don't try to render markers if duration is not yet available
    if (!duration || duration === 0) {
        return null;
    }

    // Group markers by timestamp, for avoiding complete overlaps
    const groupedMarkers: Record<string, EngagementOpportunity[]> = {};

    engagementOpportunities.forEach(engagement => {
        const key = engagement.timestamp;
        if (!groupedMarkers[key]) {
            groupedMarkers[key] = [];
        }
        groupedMarkers[key].push(engagement);
    });

    // Minimum distance between markers to avoid visual overlapping (in percentage of total width)
    const MIN_MARKER_DISTANCE = (MARKER_SIZE / containerWidth) * 100 * 1.5; // Adjust based on marker size

    // Check for markers that are too close to each other
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
    let lastAdjustedPosition = -MIN_MARKER_DISTANCE; // Initialize to allow first marker
    for (let i = 0; i < markerPositions.length; i++) {
        const current = markerPositions[i];
        let adjustedPosition = Math.max(current.position, lastAdjustedPosition + MIN_MARKER_DISTANCE);
        // Ensure marker stays within bounds (0 to 100)
        adjustedPosition = Math.min(adjustedPosition, 100);
        adjustedPositions[current.timestamp] = adjustedPosition;
        lastAdjustedPosition = adjustedPosition;
    }


    // Helper function to position tooltip without cutoff
    const getTooltipPosition = (position: number): { left: string, transform: string, top: string } => {
        // Adjust tooltip positioning threshold
        const leftThreshold = 10;
        const rightThreshold = 90;

        // If marker is near the left edge
        if (position < leftThreshold) {
            return {
                left: `calc(${position}% + ${MARKER_SIZE / 2 + 4}px)`, // Position slightly right of marker center
                transform: 'translateX(0)',
                top: '30px' // Position below marker
            };
        }
        // If marker is near the right edge
        else if (position > rightThreshold) {
            return {
                left: `calc(${position}% - ${MARKER_SIZE / 2 + 4}px)`, // Position slightly left of marker center
                transform: 'translateX(-100%)',
                top: '30px' // Position below marker
            };
        }
        // Normal positioning (centered above marker)
        return {
            left: `calc(${position}%)`,
            transform: 'translateX(-50%)',
            top: '30px' // Position below marker
        };
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            {Object.entries(groupedMarkers).map(([timestamp, engagements]) => {
                // Use adjusted position
                const seconds = timestampToSeconds(timestamp);
                const position = adjustedPositions[timestamp];

                // Skip rendering if position is invalid
                if (position === undefined || position < 0 || position > 100) {
                    console.warn(`Invalid position calculated for timestamp ${timestamp}: ${position}`);
                    return null;
                }

                return engagements.map((engagement, index) => {
                    // Determine if this marker is active
                    // Adjust active state check to be slightly wider range if needed
                    const isActive = currentTime >= seconds && currentTime < seconds + 1;
                    const isSelected = engagement.id === selectedEngagementId;
                    const isHovered = engagement.id === hoveredMarkerId;

                    // Get tooltip position to avoid cutoff
                    const tooltipPosition = getTooltipPosition(position);

                    return (
                        <React.Fragment key={engagement.id}>
                            {/* Simple Azure Blue Circle Marker */}
                            <motion.div
                                className="absolute pointer-events-auto cursor-pointer rounded-full"
                                style={{
                                    left: `${position}%`,
                                    top: "50%",
                                    marginTop: `-${MARKER_SIZE / 2}px`, // Center vertically
                                    marginLeft: `-${MARKER_SIZE / 2}px`, // Center horizontally
                                    width: `${MARKER_SIZE}px`,
                                    height: `${MARKER_SIZE}px`,
                                    backgroundColor: 'rgba(59, 130, 246)', // Azure blue base color
                                    zIndex: isHovered || isSelected ? 20 : 10,
                                    border: `2px solid ${isHovered || isSelected ? 'rgba(37, 99, 235, 1)' : 'rgba(255, 255, 255, 0.8)'}`, // White border, stronger blue on hover/select
                                    boxShadow: isActive || isSelected ? `0 0 10px rgba(59, 130, 246, 0.7)` : `0 0 6px rgba(59, 130, 246, 0.4)`, // Use shadow for glow
                                    opacity: isActive || isSelected || isHovered ? 1 : 0.85,
                                }}
                                animate={{
                                    scale: isHovered || isSelected ? MARKER_HOVER_SCALE : 1,
                                    // y: isHovered || isSelected ? -2 : 0 // Optional slight raise
                                }}
                                transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
                                onMouseEnter={() => setHoveredMarkerId(engagement.id)}
                                onMouseLeave={() => setHoveredMarkerId(null)}
                                onClick={(e) => {
                                    // e.stopPropagation(); // Removed to allow seeking via parent
                                    onMarkerClick(engagement.id);
                                }}
                            >
                                {/* Can add an inner icon/dot here if desired */}
                            </motion.div>

                            {/* Updated Tooltip for Light Theme */}
                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        className="absolute bg-white/95 backdrop-blur-sm text-[10px] px-2.5 py-1.5 
                                        rounded-md border border-blue-200 shadow-lg z-30"
                                        style={{
                                            top: tooltipPosition.top,
                                            left: tooltipPosition.left,
                                            transform: tooltipPosition.transform,
                                            textAlign: 'center',
                                            pointerEvents: 'none' // Keep tooltip non-interactive
                                        }}
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="font-medium flex items-center justify-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                            <span className="text-gray-700">
                                                {engagement.engagement_type === 'quiz' ? 'Quiz' : 'Discussion'} @ {timestamp}
                                            </span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </React.Fragment>
                    );
                });
            })}
        </div>
    );
};

export default TimelineMarkers; 