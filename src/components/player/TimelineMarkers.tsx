import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EngagementOpportunity } from '../playground/Playground';

// Increase marker size for better visibility
const MARKER_SIZE = 16;
const MARKER_HOVER_SCALE = 1.5;

// Unified color scheme for all markers
const MARKER_COLOR_ACTIVE = 'bg-white border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]';
const MARKER_COLOR_INACTIVE = 'bg-gray-800 border-2 border-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.4)]';

interface TimelineMarkersProps {
    engagementOpportunities: EngagementOpportunity[];
    duration: number;
    currentTime: number;
    onMarkerClick: (engagementId: string) => void;
    containerWidth: number;
    selectedEngagementId?: string;
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
    const MIN_MARKER_DISTANCE = 3; // percentage - increased for better spacing

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
    for (let i = 0; i < markerPositions.length; i++) {
        const current = markerPositions[i];
        adjustedPositions[current.timestamp] = current.position;

        // Check the next marker
        if (i < markerPositions.length - 1) {
            const next = markerPositions[i + 1];
            const distance = next.position - current.position;

            // If too close, adjust the next marker
            if (distance < MIN_MARKER_DISTANCE) {
                next.position = current.position + MIN_MARKER_DISTANCE;
            }
        }
    }

    // Helper function to position tooltip without cutoff
    const getTooltipPosition = (position: number): { left: string, transform: string, top: string } => {
        // If marker is near the left edge
        if (position < 15) {
            return {
                left: `calc(${position}% + 8px)`,
                transform: 'translateX(0)',
                top: '24px' // Position below marker
            };
        }
        // If marker is near the right edge
        else if (position > 85) {
            return {
                left: `calc(${position}% - 8px)`,
                transform: 'translateX(-100%)',
                top: '24px' // Position below marker
            };
        }
        // Normal positioning (centered)
        return {
            left: `calc(${position}%)`,
            transform: 'translateX(-50%)',
            top: '24px' // Position below marker
        };
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            {Object.entries(groupedMarkers).map(([timestamp, engagements]) => {
                // Convert timestamp to position
                const seconds = timestampToSeconds(timestamp);
                const position = adjustedPositions[timestamp] || (seconds / duration) * 100;

                // Calculate stagger for multiple markers at same timestamp
                const markerCount = engagements.length;

                return engagements.map((engagement, index) => {
                    // Vertically stagger markers at the same timestamp
                    const verticalOffset = markerCount > 1 ? (index - (markerCount - 1) / 2) * (MARKER_SIZE + 6) : 0;

                    // Determine if this marker is active
                    const isActive = currentTime >= seconds && currentTime <= seconds + 1;
                    const isSelected = engagement.id === selectedEngagementId;
                    const isHovered = engagement.id === hoveredMarkerId;

                    // Get tooltip position to avoid cutoff
                    const tooltipPosition = getTooltipPosition(position);

                    return (
                        <React.Fragment key={engagement.id}>
                            {/* The actual marker - now always a circle */}
                            <motion.div
                                className="absolute top-1/2 pointer-events-auto"
                                style={{
                                    left: `calc(${position}% - ${MARKER_SIZE / 2}px)`,
                                    transform: `translateY(${verticalOffset - MARKER_SIZE / 2}px)`,
                                    zIndex: isHovered || isSelected ? 20 : 10
                                }}
                                animate={{
                                    scale: isHovered || isSelected ? MARKER_HOVER_SCALE : 1,
                                    y: isHovered || isSelected ? -10 : 0 // Move up slightly more when hovered
                                }}
                                transition={{ duration: 0.2, type: "spring", stiffness: 200 }}
                                onMouseEnter={() => setHoveredMarkerId(engagement.id)}
                                onMouseLeave={() => setHoveredMarkerId(null)}
                            >
                                {/* Unified circle design for all marker types */}
                                <div
                                    className={`rounded-full cursor-pointer transition-all duration-200 flex items-center justify-center
                                    ${isActive || isSelected ? MARKER_COLOR_ACTIVE : MARKER_COLOR_INACTIVE}`}
                                    style={{
                                        width: `${MARKER_SIZE}px`,
                                        height: `${MARKER_SIZE}px`,
                                    }}
                                >
                                    {(isHovered || isSelected) ? (
                                        <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
                                    ) : (isActive ? (
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                    ) : null)}
                                </div>
                            </motion.div>

                            {/* Simplified Tooltip */}
                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        className="absolute bg-gray-900/95 backdrop-blur-sm text-[10px] px-2.5 py-1.5 
                                        rounded-md border border-gray-700 shadow-lg z-30"
                                        style={{
                                            top: tooltipPosition.top,
                                            left: tooltipPosition.left,
                                            transform: tooltipPosition.transform,
                                            textAlign: 'center',
                                            pointerEvents: 'none'
                                        }}
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {/* Add pointer triangle at the top of tooltip */}
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 
                                            border-l-[4px] border-r-[4px] border-b-[4px] 
                                            border-l-transparent border-r-transparent border-b-gray-900/95 z-10"></div>

                                        <div className="font-medium flex items-center justify-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0"></span>
                                            <span className="text-white">
                                                {engagement.engagement_type === 'quiz' ? 'Quiz' : 'Discussion'} {timestamp}
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