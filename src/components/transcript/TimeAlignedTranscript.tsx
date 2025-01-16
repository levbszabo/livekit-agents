import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Word {
    text: string;
    start: number;
    end: number;
}

interface Segment {
    text: string;
    start: number;
    end: number;
    words?: Word[];
}

interface TimeAlignedTranscriptProps {
    segments: Segment[];
    currentTime: number;
    onTimeClick: (time: number) => void;
}

export const TimeAlignedTranscript: React.FC<TimeAlignedTranscriptProps> = ({
    segments,
    currentTime,
    onTimeClick,
}) => {
    const activeWordRef = useRef<HTMLSpanElement>(null);

    // Auto-scroll to active word with improved behavior
    useEffect(() => {
        if (!activeWordRef.current) return;

        activeWordRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }, [currentTime]);

    // Find the currently active word across all segments
    const findActiveWord = () => {
        for (const segment of segments) {
            if (segment.words) {
                for (const word of segment.words) {
                    if (currentTime >= word.start && currentTime <= word.end) {
                        return word;
                    }
                }
            }
        }
        return null;
    };

    const activeWord = findActiveWord();

    return (
        <div className="p-4 select-none">
            <div className="flex flex-wrap gap-1.5">
                {segments.map((segment, index) => {
                    // Handle both word-level and segment-level highlighting
                    if (segment.words && segment.words.length > 0) {
                        return (
                            <div
                                key={index}
                                className="inline-flex flex-wrap gap-1"
                            >
                                {segment.words.map((word, wordIndex) => {
                                    const isActiveWord = activeWord === word;

                                    return (
                                        <motion.span
                                            key={`${index}-${wordIndex}`}
                                            ref={isActiveWord ? activeWordRef : null}
                                            initial={{ opacity: 0.8 }}
                                            animate={{
                                                opacity: isActiveWord ? 1 : 0.8,
                                                scale: isActiveWord ? 1.1 : 1,
                                                color: isActiveWord ? 'rgb(34,211,238)' : 'rgb(209,213,219)'
                                            }}
                                            transition={{
                                                duration: 0.15,
                                                ease: "easeOut"
                                            }}
                                            className={`
                                                inline-block cursor-pointer text-[13px] leading-relaxed
                                                px-1.5 py-0.5 rounded
                                                transition-all duration-150
                                                hover:text-cyan-400 hover:scale-105
                                                ${isActiveWord ? 'bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'hover:bg-cyan-500/10'}
                                            `}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTimeClick(word.start);
                                            }}
                                        >
                                            {word.text}
                                        </motion.span>
                                    );
                                })}
                            </div>
                        );
                    } else {
                        // Fallback for segments without word-level data
                        const isActiveSegment = currentTime >= segment.start && currentTime <= segment.end;

                        return (
                            <motion.span
                                key={index}
                                initial={{ opacity: 0.8 }}
                                animate={{
                                    opacity: isActiveSegment ? 1 : 0.8,
                                    scale: isActiveSegment ? 1.1 : 1,
                                    color: isActiveSegment ? 'rgb(34,211,238)' : 'rgb(209,213,219)'
                                }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className={`
                                    inline-block cursor-pointer text-[13px] leading-relaxed
                                    px-1.5 py-0.5 rounded
                                    transition-all duration-150
                                    hover:text-cyan-400 hover:scale-105
                                    ${isActiveSegment ? 'bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'hover:bg-cyan-500/10'}
                                `}
                                onClick={() => onTimeClick(segment.start)}
                            >
                                {segment.text}
                            </motion.span>
                        );
                    }
                })}
            </div>
        </div>
    );
};

const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}; 