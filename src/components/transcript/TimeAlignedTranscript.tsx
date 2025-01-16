import React from 'react';

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
    return (
        <div className="space-y-4 p-4 max-h-[400px] overflow-y-auto">
            {segments.map((segment, index) => (
                <div
                    key={index}
                    className={`
                        p-3 rounded-lg
                        transition-all duration-300
                        ${currentTime >= segment.start && currentTime <= segment.end
                            ? 'bg-cyan-500/20 border border-cyan-500/30'
                            : 'bg-gray-800/30 border border-gray-700/50 hover:border-gray-600/50'
                        }
                    `}
                    onClick={() => onTimeClick(segment.start)}
                    role="button"
                    tabIndex={0}
                >
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] text-gray-500">
                            {formatTime(segment.start)}
                        </span>
                    </div>
                    <p className="text-sm text-gray-300 space-x-1">
                        {segment.words ? (
                            segment.words.map((word, wordIndex) => (
                                <span
                                    key={wordIndex}
                                    className={`
                                        inline-block transition-colors duration-150
                                        ${currentTime >= word.start && currentTime <= word.end
                                            ? 'text-cyan-400'
                                            : 'text-gray-300'
                                        }
                                    `}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTimeClick(word.start);
                                    }}
                                >
                                    {word.text}
                                </span>
                            ))
                        ) : (
                            <span className="text-gray-300">
                                {segment.text}
                            </span>
                        )}
                    </p>
                </div>
            ))}
        </div>
    );
};

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}; 