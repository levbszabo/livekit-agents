import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Word {
    word: string;
    start: number;
    end: number;
    confidence: number;
}

interface Segment {
    text: string;
    start: number;
    end: number;
    speaker?: string;
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

    // Auto-scroll to active word
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
                {segments.map((segment, segmentIndex) => (
                    <div key={segmentIndex} className="inline-flex flex-wrap gap-1">
                        {segment.words ? (
                            // Render word-by-word if words data is available
                            segment.words.map((word, wordIndex) => {
                                const isActiveWord = activeWord?.start === word.start && activeWord?.end === word.end;

                                return (
                                    <motion.span
                                        key={`${segmentIndex}-${wordIndex}`}
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
                                        onClick={() => onTimeClick(word.start)}
                                    >
                                        {word.word}
                                    </motion.span>
                                );
                            })
                        ) : (
                            // Fallback to segment-level if no word data
                            <motion.span
                                initial={{ opacity: 0.8 }}
                                animate={{
                                    opacity: currentTime >= segment.start && currentTime <= segment.end ? 1 : 0.8,
                                    scale: currentTime >= segment.start && currentTime <= segment.end ? 1.1 : 1,
                                    color: currentTime >= segment.start && currentTime <= segment.end ? 'rgb(34,211,238)' : 'rgb(209,213,219)'
                                }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className={`
                                    inline-block cursor-pointer text-[13px] leading-relaxed
                                    px-1.5 py-0.5 rounded
                                    transition-all duration-150
                                    hover:text-cyan-400 hover:scale-105
                                    ${currentTime >= segment.start && currentTime <= segment.end ?
                                        'bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.3)]' :
                                        'hover:bg-cyan-500/10'
                                    }
                                `}
                                onClick={() => onTimeClick(segment.start)}
                            >
                                {segment.text}
                            </motion.span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const formatTime = (time: number): string => {
    if (!time && time !== 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}; 