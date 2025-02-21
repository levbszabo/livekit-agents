"use client";

import { ChatMessageType } from "@/components/chat/ChatTile";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
    useConnectionState,
    useDataChannel,
    useLocalParticipant,
    useVoiceAssistant,
    useChat,
} from "@livekit/components-react";
import { ConnectionState, DataPacket_Kind } from "livekit-client";
import { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { API_BASE_URL } from '@/config';
import { api } from '@/api';
import { jwtDecode } from "jwt-decode";
import {
    Panel,
    PanelGroup,
    PanelResizeHandle
} from 'react-resizable-panels';
import {
    Plus,
    FileText,
    X,
    Edit2,
    Save,
    ChevronDown,
    ChevronUp,
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize2,
    Mic,
    MicOff,
    Radio,
    RotateCcw,
    ChevronRight,
    Settings,
    Globe,
    Lock,
    Check,
    Copy,
    Link,
    Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { keyframes, css } from 'styled-components';
import TextareaAutosize from 'react-textarea-autosize';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useSwipeable } from 'react-swipeable';
import axios from 'axios';

export interface PlaygroundProps {
    logo?: ReactNode;
    themeColors: string[];
    onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
    agentType?: 'edit' | 'view';
    params: {
        brdgeId: string | null;
        token?: string;  // Add this line
    };
}

// Add ConnectionParams interface
interface ConnectionParams {
    brdgeId: string | null;
    apiBaseUrl: string;
    coreApiUrl: string;
    userId?: string;
    agentType: 'edit' | 'view';
    token?: string;
}

const headerHeight = 16; // Changed from 28 to 16

interface BrdgeMetadata {
    id: string;
    name: string;
    numSlides: number;
}

interface SlideScripts {
    [key: string]: string;
}

interface ScriptData {
    slide_scripts: SlideScripts;
    generated_at: string;
    source_walkthrough_id: string;
}

type AgentType = 'edit' | 'view';

interface JWTPayload {
    sub: string;
    exp: number;
    iat: number;
}

interface SavedVoice {
    id: string;
    name: string;
    created_at: string;
    status: string;
}

type MobileTab = 'chat' | 'script' | 'voice' | 'info';
type ConfigTab = 'ai-agent' | 'voice-clone' | 'chat';

interface DataChannelMessage {
    payload: Uint8Array;
    topic?: string;
    kind?: DataPacket_Kind;
}

interface ScriptContent {
    script: string;
    agent: string;
}

interface RecordingData {
    url: string;
    format: string;
    duration: number;
}

interface Brdge {
    id: number;
    name: string;
    user_id: number;
    presentation_filename: string;
    audio_filename: string;
    folder: string;
    shareable: boolean;
    public_id: string;
    agent_personality?: string;
}

interface TranscriptWord {
    word: string;
    punctuated_word?: string;
    start: number;
    end: number;
    confidence?: number;
}

interface TranscriptContent {
    transcript: string;
    segments: Array<{
        text: string;
        start: number;
        end: number;
    }>;
    words: TranscriptWord[];
}

interface Transcript {
    content: TranscriptContent;
    status: string;
    metadata: any;
}

interface DataChannelPayload {
    transcript_position?: {
        read: string[];
        remaining: string[];
    };
    // Add other payload types as needed
}

interface RotateIndicatorProps {
    show: boolean;
}

// ----------------------------------------------------------------------------
// Mobile detection and orientation hook
// ----------------------------------------------------------------------------
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(true); // Always true since this is MobilePlayground
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 100);
        });

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    return { isMobile, isLandscape };
};

// ----------------------------------------------------------------------------
// Styles and resize handle styles
// ----------------------------------------------------------------------------
const styles = {
    heading: `font-satoshi text-[20px] font-medium tracking-[-0.02em] text-white/90`,
    subheading: `font-satoshi text-[16px] font-normal tracking-[-0.01em] text-white/80`,
    sectionTitle: `font-satoshi text-[13px] font-medium tracking-[-0.01em] text-white/90`,
    label: `font-satoshi text-[11px] font-normal tracking-wide text-gray-400/70`,
    input: {
        base: `
            font-satoshi w-full
            bg-[#1E1E1E]/50 backdrop-blur-sm
            border border-gray-800/50 rounded-lg
            px-3 py-2.5 text-[14px] leading-relaxed
            text-white
            transition-all duration-300
            focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30
            focus:shadow-[0_0_15px_rgba(34,211,238,0.1)]
            hover:border-cyan-500/20
            placeholder:text-gray-600/50
        `,
        textarea: `
            min-h-[120px] resize-none
            bg-transparent
            border border-gray-800/50 rounded-lg
            transition-all duration-300
            focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30
            focus:shadow-[0_0_15px_rgba(34,211,238,0.1)]
            hover:border-cyan-500/20
            scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700/30
            hover:scrollbar-thumb-cyan-500/20
            text-shadow-[0_0_10px_rgba(34,211,238,0.3)]
        `
    },
    button: {
        primary: `
            group
            flex items-center gap-2
            px-4 py-2 rounded-lg text-[13px]
            bg-gradient-to-r from-cyan-500/10 to-cyan-400/5
            text-cyan-400
            border border-cyan-500/20
            transition-all duration-300
            hover:border-cyan-400/40
            hover:shadow-[0_0_15px_rgba(34,211,238,0.15)]
            hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-cyan-400/10
        `,
        icon: `
            p-1.5 rounded-md
            transition-all duration-300
            hover:bg-cyan-500/10
            hover:shadow-[0_0_10px_rgba(34,211,238,0.15)]
            group-hover:text-cyan-400
        `
    },
    tab: {
        base: `
            relative px-4 py-2 
            font-satoshi text-[13px] font-medium tracking-[-0.01em]
            transition-all duration-300
        `,
        active: `
            text-cyan-400
            after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px]
            after:bg-gradient-to-r after:from-cyan-500/80 after:to-cyan-400/20
            after:shadow-[0_0_8px_rgba(34,211,238,0.3)]
        `,
        inactive: `text-gray-400/70 hover:text-gray-300`
    },
    voiceClone: {
        title: `font-satoshi text-[13px] font-medium tracking-[-0.01em] text-white/90 mb-4`,
        subtitle: `font-satoshi text-[12px] font-medium tracking-[-0.01em] text-gray-300/90 mb-3`,
        instruction: `font-satoshi text-[12px] leading-relaxed tracking-wide text-gray-400/80`,
        sampleText: `
            font-satoshi text-[12px] leading-relaxed tracking-wide
            bg-black/20 rounded-lg p-3
            border border-gray-800
            text-gray-300/80
        `
    },
    knowledgeBase: {
        bubble: `
            relative z-10
            bg-[#1E1E1E]/50 backdrop-blur-sm
            border border-gray-800/50 rounded-lg p-2.5
            transition-all duration-300
            hover:border-cyan-500/30
            hover:shadow-[0_0_15px_rgba(34,211,238,0.07)]
            before:absolute before:inset-0 before:z-[-1]
            before:bg-gradient-to-r before:from-cyan-500/[0.02] before:to-transparent
            before:opacity-0 before:transition-opacity before:duration-300
            hover:before:opacity-100
            cursor-pointer
        `,
        input: `
            flex-1 bg-transparent z-20
            font-satoshi text-[13px] text-gray-300
            border border-gray-700/50 rounded-md px-2 py-1
            focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30
            hover:border-cyan-500/20
            transition-all duration-300
        `,
        content: `
            w-full bg-black/20 z-20
            font-satoshi text-[13px] text-gray-300
            border border-gray-800/50 rounded-lg
            p-2 min-h-[45px]
            focus:ring-1 focus:ring-cyan-500/50
            focus:border-cyan-500/30
            hover:border-cyan-500/20
            resize-none
            transition-all duration-300
        `
    },
    card: {
        base: `
            bg-[#1E1E1E] 
            border border-gray-800
            rounded-lg p-2.5
            transition-all duration-300
            hover:border-cyan-500/30
            hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]
            backdrop-blur-sm
        `,
        active: `
            border-cyan-500/30
            shadow-[0_0_20px_rgba(34,211,238,0.1)]
            bg-gradient-to-b from-cyan-500/10 to-transparent
        `
    },
    section: {
        wrapper: `
            relative p-2
            before:absolute before:inset-0
            before:border before:border-gray-800/50 before:rounded-lg
            before:transition-all before:duration-300
            hover:before:border-cyan-500/20
            hover:before:shadow-[0_0_20px_rgba(34,211,238,0.05)]
            after:absolute after:inset-0
            after:bg-gradient-to-b after:from-cyan-500/[0.02] after:to-transparent
            after:opacity-0 after:transition-opacity after:duration-300
            hover:after:opacity-100
            rounded-lg
            mb-2
        `,
        title: `
            font-satoshi text-[14px] font-medium tracking-[-0.01em] 
            text-white/90 mb-2
            flex items-center gap-2
            before:content-[''] before:w-1 before:h-1 before:rounded-full
            before:bg-cyan-400/50 before:shadow-[0_0_5px_rgba(34,211,238,0.5)]
        `
    },
    divider: `
        h-px w-full
        bg-gradient-to-r from-transparent via-gray-800/50 to-transparent
        my-6
    `
} as const;

const resizeHandleStyles = {
    vertical: `
    w-1.5 mx-1 my-2 rounded-full
    bg-gray-800 hover:bg-gray-700
    transition-colors duration-150
    cursor-col-resize
    flex items-center justify-center
    group
  `,
    horizontal: `
    h-1.5 my-1 mx-2 rounded-full
    bg-gray-800 hover:bg-gray-700
    transition-colors duration-150
    cursor-row-resize
    flex items-center justify-center
    group
  `
};

// ----------------------------------------------------------------------------
// MobileConfigDrawer – placeholder (can be expanded as needed)
const MobileConfigDrawer = ({
    isOpen,
    onClose,
    configTab,
    setConfigTab,
    children
}: {
    isOpen: boolean;
    onClose: () => void;
    configTab: ConfigTab;
    setConfigTab: (tab: ConfigTab) => void;
    children: ReactNode;
}) => {
    return (
        <div
            className={`
        fixed inset-0 z-50 
        transition-all duration-300 ease-in-out
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
        >
            {/* You can implement the drawer UI here if needed */}
            {children}
            <button onClick={onClose} className="absolute top-2 right-2 text-white">Close</button>
        </div>
    );
};

// ----------------------------------------------------------------------------
// Agent configuration interfaces and KnowledgeBubble component
// ----------------------------------------------------------------------------
interface AgentConfig {
    personality: string;
    knowledgeBase: Array<{
        id: string;
        type: string;
        name: string;
        content: string;
    }>;
}

interface KnowledgeBubbleProps {
    entry: AgentConfig['knowledgeBase'][0];
    onEdit: (id: string, content: string, name?: string) => void;
    onRemove: (id: string) => void;
}

const KnowledgeBubble: React.FC<KnowledgeBubbleProps> = ({ entry, onEdit, onRemove }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [content, setContent] = useState(entry.content);
    const [name, setName] = useState(entry.name);

    const handleBubbleClick = () => {
        if (!isEditing) {
            setIsExpanded(!isExpanded);
        }
    };

    const handleSave = () => {
        onEdit(entry.id, content, name);
        setIsEditing(false);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="group relative"
        >
            <motion.div
                layout
                className={`
          ${styles.knowledgeBase.bubble}
          ${isEditing ? 'cursor-default' : 'cursor-pointer'}
        `}
            >
                <div className="relative">
                    {/* Title section */}
                    <div
                        className="flex items-center justify-between gap-2"
                        onClick={!isEditing ? handleBubbleClick : undefined}
                    >
                        {isEditing ? (
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                }}
                                className={`${styles.knowledgeBase.input} z-50`}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="font-satoshi text-[12px] text-gray-300 group-hover:text-cyan-400/90 transition-colors duration-300">
                                {name}
                            </span>
                        )}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isEditing) handleSave();
                                    else setIsEditing(true);
                                }}
                                className="p-1.5 rounded-md hover:bg-cyan-500/10 z-50"
                            >
                                {isEditing ? (
                                    <Save size={11} className="text-cyan-400" />
                                ) : (
                                    <Edit2 size={11} className="text-gray-400 group-hover:text-cyan-400" />
                                )}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(entry.id);
                                }}
                                className="p-1.5 rounded-md hover:bg-cyan-500/10 z-50"
                            >
                                <X size={11} className="text-gray-400 group-hover:text-red-400" />
                            </motion.button>
                            {!isEditing && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(!isExpanded);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-cyan-500/10 z-50"
                                >
                                    {isExpanded ? (
                                        <ChevronUp size={11} className="text-gray-400 group-hover:text-cyan-400" />
                                    ) : (
                                        <ChevronDown size={11} className="text-gray-400 group-hover:text-cyan-400" />
                                    )}
                                </motion.button>
                            )}
                        </div>
                    </div>

                    {/* Content section */}
                    <AnimatePresence>
                        {(isEditing || isExpanded) && (
                            <motion.div
                                layout
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-2"
                            >
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onBlur={() => {
                                        if (isEditing) handleSave();
                                    }}
                                    readOnly={!isEditing}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`
                    ${styles.knowledgeBase.content}
                    ${!isEditing && 'border-transparent bg-transparent cursor-default'}
                    z-50
                  `}
                                    placeholder={isEditing ? "Enter knowledge content..." : ""}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ----------------------------------------------------------------------------
// TranscriptTimeline – shows transcript segments and allows clicking to seek
// ----------------------------------------------------------------------------
const TranscriptTimeline = ({ transcript, currentTime, onTimeClick }: {
    transcript: any;
    currentTime: number;
    onTimeClick: (time: number) => void;
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0;
        }
    }, [transcript]);

    useEffect(() => {
        if (!transcript?.content?.segments || !scrollContainerRef.current || isDragging) return;

        const activeSegment = transcript.content.segments.find((segment: any) =>
            currentTime >= segment.start && currentTime <= segment.end
        );

        if (activeSegment) {
            const segmentElement = document.getElementById(`segment-${activeSegment.start}`);
            if (segmentElement) {
                const container = scrollContainerRef.current;
                const containerWidth = container.offsetWidth;
                const segmentLeft = segmentElement.offsetLeft;
                const segmentWidth = segmentElement.offsetWidth;

                const isVisible = (
                    segmentLeft >= container.scrollLeft &&
                    segmentLeft + segmentWidth <= container.scrollLeft + containerWidth
                );

                if (!isVisible) {
                    const scrollPosition = segmentLeft - containerWidth / 3;
                    container.scrollTo({
                        left: scrollPosition,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }, [currentTime, transcript, isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current!.offsetLeft);
        setScrollLeft(scrollContainerRef.current!.scrollLeft);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current!.offsetLeft;
        const walk = (x - startX) * 2;
        scrollContainerRef.current!.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div className="relative w-full h-full bg-black/40 flex flex-col">
            <div className="h-4 border-b border-gray-800 flex items-end px-2">
                <div className="flex-1 flex items-center">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex-1 flex items-center justify-between">
                            <div className="h-2 w-px bg-gray-800" />
                            <div className="h-1.5 w-px bg-gray-800" />
                            <div className="h-1.5 w-px bg-gray-800" />
                            <div className="h-1.5 w-px bg-gray-800" />
                        </div>
                    ))}
                </div>
            </div>
            <div
                ref={scrollContainerRef}
                className={`
          flex-1 overflow-x-auto whitespace-nowrap
          scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700/30
          hover:scrollbar-thumb-cyan-500/20
          cursor-grab ${isDragging ? 'cursor-grabbing' : ''}
          relative
        `}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div className="min-w-full px-4 py-3 flex items-start h-full">
                    <div className="flex flex-wrap gap-1">
                        {transcript?.content?.segments?.map((segment: any) => (
                            <motion.span
                                key={segment.start}
                                id={`segment-${segment.start}`}
                                onClick={() => onTimeClick(segment.start)}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`
                  inline-block px-2 py-1 rounded
                  transition-all duration-150 text-[13px] leading-relaxed
                  ${currentTime >= segment.start && currentTime <= segment.end
                                        ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                        : 'text-gray-400 hover:text-gray-300 hover:bg-cyan-500/10'
                                    }
                  cursor-pointer
                  hover:scale-105
                  hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]
                `}
                            >
                                {segment.text}
                            </motion.span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------------
// A simple formatTime function
// ----------------------------------------------------------------------------
const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ----------------------------------------------------------------------------
// VideoPlayer component with enhanced mobile support
// ----------------------------------------------------------------------------
const VideoPlayer = ({
    videoRef,
    videoUrl,
    currentTime,
    setCurrentTime,
    setDuration,
    onTimeUpdate,
    isPlaying,
    setIsPlaying,
}: {
    videoRef: React.RefObject<HTMLVideoElement>;
    videoUrl: string | null;
    currentTime: number;
    setCurrentTime: (time: number) => void;
    setDuration: (duration: number) => void;
    onTimeUpdate: () => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const { isMobile } = useIsMobile();

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        const dur = videoRef.current.duration;
        if (dur && !isNaN(dur) && isFinite(dur)) {
            setDuration(dur);
            if (isMobile) {
                videoRef.current.muted = true;
            }
        }
    };

    const handleCanPlay = () => {
        setIsVideoReady(true);
        setIsLoading(false);
        if (isMobile && videoRef.current?.muted && !hasInteracted) {
            attemptPlay();
        }
    };

    const handlePlaybackError = (error: any) => {
        console.error('Video playback error:', error);
        if (isVideoReady) {
            setPlaybackError('Unable to play video. Please try again.');
        }
        setIsPlaying(false);
        setIsLoading(false);
    };

    const attemptPlay = async () => {
        if (!videoRef.current || !isVideoReady) return;
        try {
            setPlaybackError(null);
            if (isMobile && !hasInteracted) {
                videoRef.current.muted = true;
            }
            await videoRef.current.play();
            setIsPlaying(true);
            setHasInteracted(true);
        } catch (error) {
            handlePlaybackError(error);
        }
    };

    const handleVideoClick = async (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!videoRef.current || !isVideoReady) return;

        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            if (isMobile && hasInteracted && videoRef.current.muted) {
                videoRef.current.muted = false;
            }
            attemptPlay();
        }
    };

    useEffect(() => {
        if (videoUrl) {
            setIsVideoReady(false);
            setIsLoading(true);
            setPlaybackError(null);
            setHasInteracted(false);
            if (videoRef.current) {
                videoRef.current.load();
            }
        }
    }, [videoUrl]);

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center"
            onClick={handleVideoClick}
            onTouchEnd={handleVideoClick}
        >
            {/* Video element */}
            {videoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <video
                        ref={videoRef}
                        className="max-h-full max-w-full w-auto h-auto object-contain"
                        crossOrigin="anonymous"
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={onTimeUpdate}
                        onError={(e) => handlePlaybackError(e)}
                        onPlaying={() => {
                            setIsLoading(false);
                            setPlaybackError(null);
                        }}
                        onCanPlay={handleCanPlay}
                        onWaiting={() => setIsLoading(true)}
                        onStalled={() => setIsLoading(true)}
                        playsInline
                        webkit-playsinline="true"
                        x-webkit-airplay="allow"
                        preload="metadata"
                        muted={isMobile && !hasInteracted}
                        controls={false}
                        autoPlay={false}
                        style={{ pointerEvents: 'none' }}
                    >
                        <source
                            src={videoUrl}
                            type={videoUrl?.endsWith('.webm') ? 'video/webm' : videoUrl?.endsWith('.mov') ? 'video/quicktime' : 'video/mp4'}
                        />
                    </video>
                </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                    <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 animate-spin rounded-full" />
                </div>
            )}

            {/* Play button overlay */}
            {isVideoReady && !isPlaying && !isLoading && !playbackError && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-transparent z-30"
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="p-4 rounded-full bg-black/30 border border-cyan-500/50 backdrop-blur-sm shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        <Play size={isMobile ? 24 : 32} className="text-cyan-400" />
                    </div>
                </div>
            )}

            {/* Loading and Error overlays */}
            {isLoading && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-black/60 z-50"
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 animate-spin rounded-full" />
                </div>
            )}

            {playbackError && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-black/60 z-50"
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="text-red-400 text-sm text-center px-4">
                        {playbackError}
                    </div>
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------------
// Mobile-specific video controls overlay (used only on mobile if desired)
// ----------------------------------------------------------------------------
const MobileVideoControls = ({
    isPlaying,
    currentTime,
    duration,
    isMuted,
    onPlayPause,
    onMuteToggle,
}: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isMuted: boolean;
    onPlayPause: () => void;
    onMuteToggle: () => void;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute left-0 right-0 bg-gradient-to-t from-black/90 to-transparent z-30"
            style={{
                bottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
                paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
                paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))'
            }}
        >
            <div className="flex items-center gap-4">
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onPlayPause}
                    className="text-white/90 hover:text-cyan-400 transition-colors"
                >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </motion.button>

                <div className="flex-1 text-[11px] text-white/70 font-medium">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onMuteToggle}
                    className="text-white/90 hover:text-cyan-400 transition-colors"
                >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </motion.button>
            </div>
        </motion.div>
    );
};

// ----------------------------------------------------------------------------
// Floating Action Button for mobile quick actions (e.g. mic toggle)
// ----------------------------------------------------------------------------
const MobileFAB = () => {
    const { localParticipant } = useLocalParticipant();
    const roomState = useConnectionState();
    const isMuted = !localParticipant?.isMicrophoneEnabled;

    const pulseAnimation = keyframes`
        0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(34, 211, 238, 0); }
        100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
    `;

    const PulsingButton = styled.button<{ $isMuted: boolean }>`
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(8px);
        transition: all 0.3s ease;
        touch-action: manipulation;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        
        ${({ $isMuted }) => $isMuted ? css`
            background: linear-gradient(45deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.2));
            border: 1px solid rgba(239, 68, 68, 0.3);
            
            &:hover {
                background: linear-gradient(45deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.3));
            }
        ` : css`
            background: linear-gradient(45deg, rgba(34, 211, 238, 0.1), rgba(34, 211, 238, 0.2));
            border: 1px solid rgba(34, 211, 238, 0.3);
            animation: ${pulseAnimation} 2s infinite;
            
            &:hover {
                background: linear-gradient(45deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.3));
            }
        `}
    `;

    return (
        <div
            className="fixed z-[9999]"
            style={{
                bottom: 'env(safe-area-inset-bottom)',
                right: 'env(safe-area-inset-right)',
                padding: '1rem',
                background: 'linear-gradient(to top, rgba(17, 17, 17, 1) 0%, rgba(17, 17, 17, 0.8) 50%, transparent 100%)',
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                pointerEvents: 'none' // This makes the gradient background non-interactive
            }}
        >
            <PulsingButton
                $isMuted={isMuted}
                onClick={(e) => {
                    e.stopPropagation();
                    if (roomState === ConnectionState.Connected && localParticipant) {
                        localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                    }
                }}
                style={{ pointerEvents: 'auto' }} // This makes the button interactive
            >
                {isMuted ? (
                    <MicOff size={20} className="text-red-400" />
                ) : (
                    <Mic size={20} className="text-cyan-400" />
                )}
            </PulsingButton>
        </div>
    );
};

// ----------------------------------------------------------------------------
// Glow animation for the logo and loading effects
// ----------------------------------------------------------------------------
const glowAnimation = keyframes`
  0% {
    filter: drop-shadow(0 0 2px #00f7ff);
  }
  50% {
    filter: drop-shadow(0 0 4px #00f7ff);
  }
  100% {
    filter: drop-shadow(0 0 2px #00f7ff);
  }
`;

const BrdgeLogo = styled.img`
  width: 24px;
  height: 24px;
  margin-right: 8px;
  animation: ${glowAnimation} 2s ease-in-out infinite;
`;

const loadingAnimation = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

// ----------------------------------------------------------------------------
// RotateIndicator component
// ----------------------------------------------------------------------------
const RotateIndicator = ({ show }: RotateIndicatorProps) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: show ? 1 : 0, y: show ? 0 : 10 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
        <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-black/90 backdrop-blur-sm border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                <RotateCcw
                    size={18}
                    className="text-cyan-400 animate-[spin_3s_ease-in-out_infinite]"
                />
                <span className="text-[14px] font-medium text-cyan-400">
                    Rotate for Better View
                </span>
            </div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-cyan-400/50"
            />
        </div>
    </motion.div>
);

// ----------------------------------------------------------------------------
// Settings Drawer Component
// ----------------------------------------------------------------------------
interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    agentConfig: AgentConfig;
    onUpdateAgentConfig: (config: AgentConfig) => void;
    savedVoices: SavedVoice[];
    onVoiceCreate: (name: string, recording: Blob) => Promise<void>;
    isCreatingVoice: boolean;
    setIsCreatingVoice: (creating: boolean) => void;
    params: { brdgeId: string | null };
    brdge?: Brdge | null;
    onUpdateBrdge: (updatedBrdge: Brdge) => void;
    isUploading: boolean;
    onPresentationClick: () => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
    isOpen,
    onClose,
    agentConfig,
    onUpdateAgentConfig,
    savedVoices,
    onVoiceCreate,
    isCreatingVoice,
    setIsCreatingVoice,
    params,
    brdge,
    onUpdateBrdge,
    isUploading,
    onPresentationClick
}) => {
    const [activeTab, setActiveTab] = useState<'agent' | 'voice' | 'share'>('agent');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // NEW: Local state for agent personality to avoid re-rendering on every keystroke
    const [localPersonality, setLocalPersonality] = useState(agentConfig.personality);
    useEffect(() => {
        setLocalPersonality(agentConfig.personality);
    }, [agentConfig.personality]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Use the locally stored text here
            await onUpdateAgentConfig({
                ...agentConfig,
                personality: localPersonality
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleShareToggle = async () => {
        if (!params.brdgeId) {
            console.error('No brdgeId in params');
            return;
        }

        try {
            const response = await api.post(
                `/brdges/${params.brdgeId}/toggle_shareable`,
                {}, // Empty body
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Check for the new response format
            if (response.status === 200 && response.data && 'shareable' in response.data && brdge) {
                // Create updated brdge object with the new shareable status
                const updatedBrdge: Brdge = {
                    ...brdge,
                    id: brdge.id,
                    shareable: response.data.shareable,
                    public_id: brdge.public_id
                };

                // Update the brdge state immediately
                onUpdateBrdge(updatedBrdge);
            }
        } catch (error) {
            console.error('Error toggling share status:', error);
        }
    };

    const handleCopyLink = () => {
        if (!brdge?.public_id || !params.brdgeId) return;
        const shareableUrl = `${window.location.origin}/viewBridge/${params.brdgeId}-${brdge.public_id.substring(0, 6)}`;
        navigator.clipboard.writeText(shareableUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: isOpen ? 0 : '100%' }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-md"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
                paddingRight: 'env(safe-area-inset-right)'
            }}
        >
            {/* Header with Save Button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-[16px] font-medium text-cyan-400">Settings</h2>
                <div className="flex items-center gap-2">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`
                            group flex items-center gap-1.5
                            px-3 py-1.5 rounded-lg
                            ${saveSuccess
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }
                            border
                            transition-all duration-300
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isSaving ? (
                            <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span className="text-[11px]">Saving...</span>
                            </>
                        ) : saveSuccess ? (
                            <>
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="text-green-400"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        className="w-3 h-3"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </motion.div>
                                <span className="text-[11px]">Saved!</span>
                            </>
                        ) : (
                            <>
                                <Save size={12} className="group-hover:rotate-12 transition-transform duration-300" />
                                <span className="text-[11px]">Save Changes</span>
                            </>
                        )}
                    </motion.button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-cyan-500/10 text-gray-400 hover:text-cyan-400"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('agent')}
                    className={`flex-1 px-4 py-3 text-[14px] font-medium relative ${activeTab === 'agent' ? 'text-cyan-400' : 'text-gray-400'}`}
                >
                    AI Agent
                    {activeTab === 'agent' && (
                        <motion.div layoutId="activeSettingsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('voice')}
                    className={`flex-1 px-4 py-3 text-[14px] font-medium relative ${activeTab === 'voice' ? 'text-cyan-400' : 'text-gray-400'}`}
                >
                    Voice Clone
                    {activeTab === 'voice' && (
                        <motion.div layoutId="activeSettingsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('share')}
                    className={`flex-1 px-4 py-3 text-[14px] font-medium relative ${activeTab === 'share' ? 'text-cyan-400' : 'text-gray-400'}`}
                >
                    Share
                    {activeTab === 'share' && (
                        <motion.div layoutId="activeSettingsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <AnimatePresence mode="wait">
                    {activeTab === 'agent' ? (
                        <motion.div
                            key="agent"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Agent Personality */}
                            <section>
                                <h3 className="text-[14px] font-medium text-gray-300 mb-2">Agent Personality</h3>
                                <p className="text-[12px] text-gray-400 mb-3">
                                    Describe how you want your AI agent to behave and interact.
                                </p>
                                <div className="relative">
                                    <textarea
                                        value={localPersonality}
                                        onChange={(e) => setLocalPersonality(e.target.value)}
                                        onBlur={() => {
                                            // (Optional) update parent on blur if desired.
                                        }}
                                        placeholder="Example: A friendly and knowledgeable AI assistant..."
                                        className="w-full bg-black/20 rounded-lg border border-gray-800 
                                                 p-4 text-[14px] leading-relaxed text-gray-300 
                                                 min-h-[120px] resize-none
                                                 focus:outline-none focus:ring-1 
                                                 focus:ring-cyan-500/50 focus:border-cyan-500/30
                                                 transition-all duration-300"
                                        rows={4}
                                        style={{
                                            caretColor: '#22d3ee'
                                        }}
                                    />
                                </div>
                            </section>

                            {/* Core Presentation */}
                            <section>
                                <h3 className="text-[14px] font-medium text-gray-300 mb-2">Core Presentation</h3>
                                <div className="relative">
                                    <div className="flex items-center justify-between bg-[#1E1E1E]/50 backdrop-blur-sm border border-gray-800/50 rounded-lg p-3 transition-all duration-300 hover:border-cyan-500/30">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-cyan-400" />
                                            <span className="text-[14px] text-gray-300">
                                                {brdge?.presentation_filename ||
                                                    agentConfig.knowledgeBase.find(k => k.type === 'presentation')?.name ||
                                                    "No presentation file"}
                                            </span>
                                        </div>
                                        {!brdge?.presentation_filename &&
                                            !agentConfig.knowledgeBase.find(k => k.type === 'presentation')?.name ? (
                                            <button onClick={onPresentationClick} className="group flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] bg-gradient-to-r from-cyan-500/10 to-transparent text-cyan-400/90 border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                                                {isUploading ? "Uploading..." : "Upload PDF"}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-400">PDF</span>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Knowledge Base */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-[14px] font-medium text-gray-300 mb-1">Knowledge Base</h3>
                                        <p className="text-[12px] text-gray-400">
                                            Add custom knowledge to enhance your AI agent&apos;s responses.
                                        </p>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            const newEntry = {
                                                id: `kb_${Date.now()}`,
                                                type: "custom",
                                                name: "New Knowledge Entry",
                                                content: ""
                                            };
                                            onUpdateAgentConfig({
                                                ...agentConfig,
                                                knowledgeBase: [...agentConfig.knowledgeBase, newEntry]
                                            });
                                        }}
                                        className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-[13px] flex items-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Add Knowledge
                                    </motion.button>
                                </div>

                                <div className="space-y-4">
                                    {agentConfig.knowledgeBase.map((entry) => (
                                        <KnowledgeCard
                                            key={entry.id}
                                            entry={entry}
                                            onEdit={(id, content, title) => {
                                                onUpdateAgentConfig({
                                                    ...agentConfig,
                                                    knowledgeBase: agentConfig.knowledgeBase.map(e =>
                                                        e.id === id ? { ...e, content, name: title } : e
                                                    )
                                                });
                                            }}
                                            onRemove={(id) => {
                                                onUpdateAgentConfig({
                                                    ...agentConfig,
                                                    knowledgeBase: agentConfig.knowledgeBase.filter(e => e.id !== id)
                                                });
                                            }}
                                        />
                                    ))}
                                </div>
                            </section>
                        </motion.div>
                    ) : activeTab === 'voice' ? (
                        <motion.div
                            key="voice"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Explanatory Text for Voice Clone */}
                            <section>
                                <p className="text-[12px] text-gray-300 mb-2">
                                    Create a personalized voice clone to enable a natural text-to-speech experience.
                                    Please record a short sample of your voice (10–20 seconds) for best results.
                                </p>
                            </section>
                            {/* Voice Clone Content */}
                            {isCreatingVoice ? (
                                <VoiceCreation
                                    onVoiceCreate={onVoiceCreate}
                                    onCancel={() => setIsCreatingVoice(false)}
                                />
                            ) : (
                                <VoiceList
                                    voices={savedVoices}
                                    onCreateNew={() => setIsCreatingVoice(true)}
                                    brdgeId={params.brdgeId}
                                />
                            )}
                        </motion.div>
                    ) : activeTab === 'share' ? (
                        <motion.div
                            key="share"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 px-4"
                        >
                            {/* Status Section */}
                            <section className="mb-4">
                                <div className="flex items-center justify-between p-4 bg-black/20 
                                              rounded-lg border border-gray-800/50 transition-all duration-300">
                                    <div className="flex items-center gap-3">
                                        {brdge?.shareable ? (
                                            <div className="w-8 h-8 rounded-full bg-cyan-500/10 
                                                          flex items-center justify-center">
                                                <Globe size={18} className="text-cyan-400" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-800/50 
                                                          flex items-center justify-center">
                                                <Lock size={18} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-[14px] font-medium text-gray-300 block">
                                                {brdge?.shareable ? 'Public Access' : 'Private Access'}
                                            </span>
                                            <span className="text-[12px] text-gray-400">
                                                {brdge?.shareable
                                                    ? 'Anyone with the link can view'
                                                    : 'Only you can view'}
                                            </span>
                                        </div>
                                    </div>
                                    <motion.button
                                        onClick={handleShareToggle}
                                        className={`
                                            relative w-11 h-6 rounded-full 
                                            transition-all duration-300 ease-in-out
                                            ${brdge?.shareable
                                                ? 'bg-cyan-500/20 border-cyan-500/30'
                                                : 'bg-gray-700/50 border-gray-800'
                                            }
                                            border
                                            flex items-center
                                            cursor-pointer
                                            hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]
                                        `}
                                    >
                                        <motion.div
                                            initial={false}
                                            animate={{
                                                x: brdge?.shareable ? 20 : 2,
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 500,
                                                damping: 30
                                            }}
                                            className={`
                                                w-4 h-4 rounded-full
                                                ${brdge?.shareable
                                                    ? 'bg-cyan-400'
                                                    : 'bg-gray-400'
                                                }
                                            `}
                                        />
                                    </motion.button>
                                </div>
                            </section>

                            {/* Share Link Section - Only show when public */}
                            {brdge?.shareable && (
                                <section className="mb-4">
                                    <div className="flex items-center gap-2 p-4 
                                                   bg-black/20 rounded-lg border border-gray-800/50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] text-gray-300 truncate font-mono">
                                                {`${window.location.origin}/viewBridge/${params.brdgeId}-${brdge.public_id.substring(0, 6)}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleCopyLink}
                                            className={`
                                                flex items-center gap-2 px-3 py-1.5 
                                                rounded-lg text-[13px] whitespace-nowrap
                                                transition-all duration-300
                                                ${linkCopied
                                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                    : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                                }
                                                border hover:border-cyan-500/40
                                                active:scale-95
                                            `}
                                        >
                                            {linkCopied ? (
                                                <>
                                                    <Check size={14} />
                                                    <span>Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={14} />
                                                    <span>Copy Link</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </section>
                            )}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// ----------------------------------------------------------------------------
// Voice Creation Component
// ----------------------------------------------------------------------------
const VoiceCreation: React.FC<{
    onVoiceCreate: (name: string, recording: Blob) => Promise<void>;
    onCancel: () => void;
}> = ({ onVoiceCreate, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [voiceName, setVoiceName] = useState('');
    const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    setCurrentRecording(new Blob([e.data], { type: 'audio/wav' }));
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                setRecordingTime(0);
            }
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isRecording]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-gray-300">Create New Voice</h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-cyan-400"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Sample text to read */}
            <div className="px-3 py-2 bg-black/20 border border-gray-800/50 rounded-lg text-[11px] text-gray-300">
                "In just a few quick steps, my voice-based AI assistant will be integrated into my content.
                This way you can speak to others without being there… how cool is that?"
            </div>

            <div className="space-y-4">
                <input
                    type="text"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder="Voice name"
                    className="w-full bg-black/20 rounded-lg border border-gray-800 p-3 text-[14px] text-gray-300"
                />

                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className="w-full py-3 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2 bg-cyan-500/20 text-cyan-400"
                >
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    {isRecording ? (
                        <>Recording... {formatTime(recordingTime)}</>
                    ) : (
                        'Start Recording'
                    )}
                </button>

                {currentRecording && (
                    <div className="space-y-2">
                        <audio
                            src={URL.createObjectURL(currentRecording)}
                            controls
                            className="w-full"
                        />
                        <button
                            onClick={() => onVoiceCreate(voiceName, currentRecording)}
                            disabled={!voiceName}
                            className="w-full py-3 rounded-lg text-[14px] font-medium bg-cyan-500/20 text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Voice Clone
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------------
// Voice List Component
// ----------------------------------------------------------------------------
const VoiceList: React.FC<{
    voices: SavedVoice[];
    onCreateNew: () => void;
    brdgeId: string | null;
}> = ({ voices, onCreateNew, brdgeId }) => {
    const activateVoice = async (voiceId: string) => {
        try {
            await api.post(`/brdges/${brdgeId}/voices/${voiceId}/activate`);
            // Voice list will be updated by parent component
        } catch (error) {
            console.error('Error activating voice:', error);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-gray-300">Saved Voices</h3>
                <button
                    onClick={onCreateNew}
                    className="px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-[13px]"
                >
                    Create New
                </button>
            </div>

            <div className="space-y-2">
                {voices.map((voice) => (
                    <motion.div
                        key={voice.id}
                        onClick={() => activateVoice(voice.id)}
                        className={`
                            p-3 rounded-lg border cursor-pointer
                            ${voice.status === 'active'
                                ? 'border-cyan-500/30 bg-cyan-500/5'
                                : 'border-gray-800 bg-black/20'
                            }
                            transition-all duration-300
                            hover:border-cyan-500/30
                        `}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`
                                    w-2 h-2 rounded-full
                                    ${voice.status === 'active' ? 'bg-cyan-400' : 'bg-gray-600'}
                                `} />
                                <span className="text-[14px] text-gray-300">{voice.name}</span>
                            </div>
                            <span className="text-[12px] text-cyan-400/70">
                                {voice.status === 'active' ? 'Active' : 'Click to Activate'}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------------
// Main MobilePlayground Component – all functionality included
// ----------------------------------------------------------------------------
export default function MobilePlayground({
    logo,
    themeColors,
    onConnect,
    agentType,
    params = { brdgeId: null, token: undefined }
}: PlaygroundProps) {
    // Add viewport meta handling
    useEffect(() => {
        // Set viewport meta for consistent mobile rendering
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content',
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
            );
        }

        // Add meta tag to prevent input zoom
        let metaFormat = document.createElement('meta');
        metaFormat.setAttribute('name', 'format-detection');
        metaFormat.setAttribute('content', 'telephone=no');
        document.head.appendChild(metaFormat);

        // Handle iOS Safari viewport height issues
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', () => {
            setTimeout(setVH, 100);
        });

        return () => {
            window.removeEventListener('resize', setVH);
            window.removeEventListener('orientationchange', setVH);
            // Reset viewport meta on cleanup
            if (viewport) {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
            }
            document.head.removeChild(metaFormat);
        };
    }, []);

    const { isMobile, isLandscape } = useIsMobile();
    const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [isCreatingVoice, setIsCreatingVoice] = useState(false);
    const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
    const [showRotateIndicator, setShowRotateIndicator] = useState(false);

    // Update connectionParams state with proper type
    const [connectionParams, setConnectionParams] = useState<ConnectionParams>({
        brdgeId: params.brdgeId,
        apiBaseUrl: API_BASE_URL || 'http://localhost:5000/api',
        coreApiUrl: API_BASE_URL,
        agentType: agentType || 'edit',
        token: params.token  // Add this line
    });

    // Video URL state
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    const fetchVideoUrl = useCallback(async () => {
        if (!connectionParams.brdgeId || !connectionParams.apiBaseUrl) return;
        try {
            const response = await fetch(`${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/recordings/latest/signed-url`);
            if (!response.ok) throw new Error('Failed to fetch video URL');
            const { url } = await response.json();
            setVideoUrl(url);
        } catch (error) {
            console.error('Error fetching video URL:', error);
        }
    }, [connectionParams.brdgeId, connectionParams.apiBaseUrl]);

    useEffect(() => {
        fetchVideoUrl();
    }, [fetchVideoUrl]);

    // Load saved voices on mount
    useEffect(() => {
        const loadVoices = async () => {
            if (!connectionParams.brdgeId) return;
            try {
                const response = await fetch(`${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/voices`);
                if (!response.ok) throw new Error('Failed to fetch voices');
                const data = await response.json();
                if (data.voices) {
                    setSavedVoices(data.voices);
                    if (data.voices.length > 0 && !selectedVoice) {
                        setSelectedVoice(data.voices[0].id);
                    }
                }
            } catch (error) {
                console.error('Error loading voices:', error);
            }
        };
        loadVoices();
    }, [connectionParams.brdgeId, connectionParams.apiBaseUrl, selectedVoice]);

    // LiveKit related hooks
    const { localParticipant } = useLocalParticipant();
    const voiceAssistant = useVoiceAssistant();
    const roomState = useConnectionState();
    const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
    const chat = useChat();

    // Move the room connection effect inside the component
    useEffect(() => {
        const connectToRoom = async () => {
            try {
                const token = params.token || localStorage.getItem('token');
                if (!token) {
                    console.error('No authentication token found');
                    return;
                }

                // Use the api instance from @/api with the token
                const response = await api.get(`/brdges/${params.brdgeId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.data) {
                    setBrdge(response.data);
                }
            } catch (error) {
                console.error('Error connecting to room:', error);
            }
        };

        if (params.brdgeId) {
            connectToRoom();
        }
    }, [params.brdgeId, params.token]); // Add params.token to dependencies

    // Update URL params effect
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const tokenParam = params.token || urlParams.get('token');
            const storedToken = localStorage.getItem('token');
            const token = tokenParam || storedToken || undefined;
            const apiBaseUrl = urlParams.get('apiBaseUrl') || API_BASE_URL;

            // Store token in localStorage if present
            if (tokenParam) {
                localStorage.setItem('token', tokenParam);
            }

            setConnectionParams(prev => ({
                ...prev,
                brdgeId: params.brdgeId || urlParams.get('brdgeId'),
                apiBaseUrl,
                coreApiUrl: apiBaseUrl,
                token,
                userId: token ?
                    jwtDecode<JWTPayload>(token).sub :
                    `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                agentType: (urlParams.get('agentType') as 'edit' | 'view') || 'edit'
            }));
        }
    }, [params.brdgeId, params.token]); // Add params.token to dependencies

    // Handle chat messages
    const handleChatMessage = useCallback(async (message: string) => {
        if (!chat) return;
        try {
            await chat.send(message);
            setTranscripts(prev => [...prev, {
                name: "You",
                message: message,
                timestamp: Date.now(),
                isSelf: true,
            }]);
        } catch (error) {
            console.error('Error sending chat message:', error);
        }
    }, [chat]);

    // Transcript state
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

    const fetchTranscript = useCallback(async () => {
        if (!connectionParams.brdgeId || !connectionParams.apiBaseUrl) return;
        setIsLoadingTranscript(true);
        try {
            const response = await fetch(`${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/script`);
            if (!response.ok) throw new Error('Failed to fetch transcript');
            const data = await response.json();
            setTranscript(data);
        } catch (error) {
            console.error('Error fetching transcript:', error);
        } finally {
            setIsLoadingTranscript(false);
        }
    }, [connectionParams.brdgeId, connectionParams.apiBaseUrl]);

    useEffect(() => {
        fetchTranscript();
    }, [fetchTranscript]);

    // Video current time state
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Agent configuration state
    const [agentConfig, setAgentConfig] = useState<AgentConfig>({
        personality: "",
        knowledgeBase: [
            { id: "presentation", type: "presentation", name: "", content: "" }
        ]
    });

    useEffect(() => {
        const fetchAgentConfig = async () => {
            if (!connectionParams.brdgeId || !connectionParams.apiBaseUrl) return;
            try {
                const response = await fetch(`${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/agent-config`);
                if (!response.ok) throw new Error('Failed to fetch agent config');
                const data = await response.json();
                setAgentConfig(data);
            } catch (error) {
                console.error('Error fetching agent config:', error);
            }
        };
        fetchAgentConfig();
    }, [connectionParams.brdgeId, connectionParams.apiBaseUrl]);

    const updateAgentConfig = async (newConfig: AgentConfig) => {
        try {
            const response = await fetch(
                `${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/agent-config`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig),
                }
            );
            if (response.ok) {
                setAgentConfig(newConfig);
            }
        } catch (error) {
            console.error('Error updating agent config:', error);
        }
    };

    // Voice cloning state
    const [isVoiceCloning, setIsVoiceCloning] = useState(false);
    const [voiceCloneProgress, setVoiceCloneProgress] = useState(0);

    const cloneVoice = async (name: string) => {
        if (!connectionParams.brdgeId || !connectionParams.apiBaseUrl) return;
        try {
            setIsVoiceCloning(true);
            const response = await fetch(
                `${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/voices/clone`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                }
            );
            if (!response.ok) throw new Error('Failed to clone voice');
            const voicesResponse = await fetch(`${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/voices`);
            if (voicesResponse.ok) {
                const data = await voicesResponse.json();
                setSavedVoices(data.voices);
            }
        } catch (error) {
            console.error('Error cloning voice:', error);
        } finally {
            setIsVoiceCloning(false);
            setVoiceCloneProgress(0);
        }
    };

    // Brdge and loading state
    const [brdge, setBrdge] = useState<Brdge | null>(null);
    const [isLoadingBrdge, setIsLoadingBrdge] = useState(false);

    useEffect(() => {
        const fetchBrdge = async () => {
            if (!params.brdgeId) {
                console.error('No brdgeId in params');
                return;
            }

            setIsLoadingBrdge(true);
            try {
                const response = await api.get(`/brdges/${params.brdgeId}`, {
                    withCredentials: true,
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.data) {
                    setBrdge(response.data);
                    // Update connectionParams with the correct brdgeId
                    setConnectionParams(prev => ({
                        ...prev,
                        brdgeId: params.brdgeId
                    }));

                    // Also update agent config if available
                    if (response.data.agent_personality) {
                        setAgentConfig(prev => ({
                            ...prev,
                            personality: response.data.agent_personality
                        }));
                    }
                }
            } catch (error) {
                console.error('Error fetching brdge:', error);
            } finally {
                setIsLoadingBrdge(false);
            }
        };

        fetchBrdge();
    }, [params.brdgeId]);

    useEffect(() => {
        console.log('Current connection params:', connectionParams);
    }, []);

    // Handlers for knowledge base editing and removal
    const handleKnowledgeEdit = useCallback((id: string, content: string, name?: string) => {
        setAgentConfig(prev => ({
            ...prev,
            knowledgeBase: prev.knowledgeBase.map(entry =>
                entry.id === id ? { ...entry, content, ...(name && { name }) } : entry
            )
        }));
        updateAgentConfig({
            ...agentConfig,
            knowledgeBase: agentConfig.knowledgeBase.map(entry =>
                entry.id === id ? { ...entry, content, ...(name && { name }) } : entry
            )
        });
    }, [agentConfig, updateAgentConfig]);

    const handleKnowledgeRemove = useCallback((id: string) => {
        setAgentConfig(prev => ({
            ...prev,
            knowledgeBase: prev.knowledgeBase.filter(entry => entry.id !== id)
        }));
        updateAgentConfig({
            ...agentConfig,
            knowledgeBase: agentConfig.knowledgeBase.filter(entry => entry.id !== id)
        });
    }, [agentConfig, updateAgentConfig]);

    // Tab state
    const [activeTab, setActiveTab] = useState<ConfigTab>(connectionParams.agentType === 'view' ? 'chat' : 'ai-agent');

    useEffect(() => {
        if (connectionParams.agentType === 'view') {
            setActiveTab('chat');
        }
    }, [connectionParams.agentType]);

    // Recording and voice cloning refs and states
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
    const [voiceName, setVoiceName] = useState('');
    const [isCloning, setIsCloning] = useState(false);

    // Video and volume states
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const formatTimeHelper = (seconds: number) => {
        if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    setCurrentRecording(new Blob([e.data], { type: 'audio/wav' }));
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                setRecordingTime(0);
            }
        }
    };

    const handleCloneVoice = async () => {
        if (!currentRecording || !voiceName || !connectionParams.brdgeId) return;
        setIsCloning(true);
        try {
            const formData = new FormData();
            formData.append('audio', currentRecording);
            formData.append('name', voiceName);
            const response = await api.post(`/brdges/${connectionParams.brdgeId}/voice/clone`, formData);
            const voicesResponse = await api.get(`/brdges/${connectionParams.brdgeId}/voices`);
            if (voicesResponse.data?.voices) {
                setSavedVoices(voicesResponse.data.voices);
                if (response.data?.voice?.id) {
                    setSelectedVoice(response.data.voice.id);
                    setIsCreatingVoice(false);
                }
            }
            setCurrentRecording(null);
            setVoiceName('');
        } catch (error) {
            console.error('Error cloning voice:', error);
        } finally {
            setIsCloning(false);
        }
    };

    // Automatic voice activation effect
    useEffect(() => {
        if (savedVoices.length === 1) {
            // If there's only one voice, make it active
            const voice = savedVoices[0];
            if (voice.status !== 'active') {
                api.post(`/brdges/${connectionParams.brdgeId}/voices/${voice.id}/activate`)
                    .then(() => {
                        setSavedVoices([{ ...voice, status: 'active' }]);
                    })
                    .catch(error => console.error('Error activating single voice:', error));
            }
        } else if (savedVoices.length > 1 && !savedVoices.some(v => v.status === 'active')) {
            // If there are multiple voices and none are active, activate the most recent one
            const mostRecent = savedVoices.reduce((prev, current) => {
                return new Date(current.created_at) > new Date(prev.created_at) ? current : prev;
            }, savedVoices[0]);

            api.post(`/brdges/${connectionParams.brdgeId}/voices/${mostRecent.id}/activate`)
                .then(() => {
                    setSavedVoices(prev => prev.map(v => ({
                        ...v,
                        status: v.id === mostRecent.id ? 'active' : 'inactive'
                    })));
                })
                .catch(error => console.error('Error activating most recent voice:', error));
        }
    }, [savedVoices, connectionParams.brdgeId]);

    const tabs = [
        { id: 'chat', label: 'Chat' }
    ];

    const { send: sendData } = useDataChannel("agent_data_channel");

    const handleConnect = useCallback(async () => {
        if (roomState === ConnectionState.Connected) {
            onConnect(false);
        } else {
            onConnect(true);
        }
    }, [roomState, onConnect]);

    const connectButton = (
        <button
            onClick={handleConnect}
            className={`p-1.5 rounded-lg transition-colors text-xs
        ${roomState === ConnectionState.Connected
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-cyan-500/20 text-cyan-400'
                }`}
        >
            {roomState === ConnectionState.Connected ? 'Disconnect' : 'Connect'}
        </button>
    );

    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(error => {
                    console.error('Error playing video:', error);
                    setIsPlaying(false);
                });
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        if (videoRef.current && videoRef.current.duration) {
            setDuration(videoRef.current.duration);
        }
    }, [videoUrl]);

    const handleProgressBarInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!progressBarRef.current || !videoRef.current || !videoRef.current.duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * videoRef.current.duration;
        if (isFinite(newTime) && !isNaN(newTime)) {
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, [setCurrentTime]);

    const [isDragging, setIsDragging] = useState(false);

    const handleProgressBarMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        handleProgressBarInteraction(e);
    };

    const handleProgressBarMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            handleProgressBarInteraction(e);
        }
    };

    const handleProgressBarMouseUp = () => {
        setIsDragging(false);
    };

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await updateAgentConfig(agentConfig);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handlePresentationUpload = async (file: File) => {
        if (!connectionParams.brdgeId) return;
        try {
            setIsUploading(true);
            if (file.size > 20 * 1024 * 1024) {
                console.error('File size exceeds 20MB limit');
                return;
            }
            const formData = new FormData();
            formData.append('presentation', file);
            const response = await api.post(`/brdges/${connectionParams.brdgeId}/presentation`, formData);
            setBrdge(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    presentation_filename: response.data.presentation_filename
                };
            });
            setAgentConfig(prev => ({
                ...prev,
                knowledgeBase: prev.knowledgeBase.map(entry =>
                    entry.type === 'presentation'
                        ? { ...entry, name: response.data.presentation_filename }
                        : entry
                )
            }));
            console.log('Presentation uploaded successfully:', response.data.presentation_filename);
        } catch (error: any) {
            console.error('Error uploading presentation:', error?.response?.data || error);
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        const canAutoConnect = connectionParams.userId && connectionParams.brdgeId;
        if (canAutoConnect && roomState === ConnectionState.Disconnected) {
            onConnect(true);
        }
    }, [connectionParams, roomState, onConnect]);

    useEffect(() => {
        if (roomState === ConnectionState.Connected && localParticipant) {
            localParticipant.setMicrophoneEnabled(false);
        }
    }, [roomState, localParticipant]);

    useEffect(() => {
        if (!videoRef.current) return;
        const isMicOn = localParticipant?.isMicrophoneEnabled;
        const isTTSSpeaking = !!voiceAssistant?.audioTrack;
        if (isMicOn || isTTSSpeaking) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [localParticipant?.isMicrophoneEnabled, voiceAssistant?.audioTrack]);

    // Add effect to handle indicator visibility
    useEffect(() => {
        if (!isLandscape) {
            setShowRotateIndicator(true);
            const timer = setTimeout(() => {
                setShowRotateIndicator(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isLandscape]);

    // Add these components for the settings drawer
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Update the video controls to include the microphone button
    const videoControls = (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="text-white/90 hover:text-cyan-400 transition-colors"
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    <div className="text-[11px] text-white/70 font-medium">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>

                    {/* Add back the microphone button */}
                    {localParticipant && (
                        <button
                            onClick={() => {
                                if (roomState === ConnectionState.Connected) {
                                    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                                }
                            }}
                            className="text-white/90 hover:text-cyan-400 transition-colors"
                        >
                            {!localParticipant.isMicrophoneEnabled ? (
                                <MicOff size={20} className="text-red-400" />
                            ) : (
                                <Mic size={20} className="text-cyan-400" />
                            )}
                        </button>
                    )}

                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-white/90 hover:text-cyan-400 transition-colors"
                    >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                </div>

                {/* Settings button */}
                {connectionParams.agentType === 'edit' && (
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 rounded-lg bg-black/40 text-gray-400 hover:text-cyan-400"
                    >
                        <Settings size={20} />
                    </button>
                )}
            </div>
        </div>
    );

    // Memoize the handlers to prevent unnecessary re-renders
    const handleVoiceCreate = useCallback(async (name: string, recording: Blob) => {
        if (!connectionParams.brdgeId) return;
        try {
            const formData = new FormData();
            formData.append('audio', recording);
            formData.append('name', name);
            const response = await api.post(`/brdges/${connectionParams.brdgeId}/voice/clone`, formData);
            if (response.data?.voice?.id) {
                setSavedVoices(prev => [...prev, response.data.voice]);
                setIsCreatingVoice(false);
            }
        } catch (error) {
            console.error('Error cloning voice:', error);
        }
    }, [connectionParams.brdgeId]);

    const handleUpdateAgentConfig = useCallback(async (newConfig: AgentConfig) => {
        try {
            const response = await fetch(
                `${connectionParams.apiBaseUrl}/brdges/${connectionParams.brdgeId}/agent-config`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig),
                }
            );
            if (response.ok) {
                setAgentConfig(newConfig);
            }
        } catch (error) {
            console.error('Error updating agent config:', error);
        }
    }, [connectionParams.apiBaseUrl, connectionParams.brdgeId]);

    // ----------------------------------------------------------------------------
    // Mobile layout rendering: if in portrait, video on top, chat below; if in landscape, show video enlarged with a toggleable side panel.
    // ----------------------------------------------------------------------------
    return (
        <div
            className="fixed inset-0 flex flex-col bg-[#121212]"
            style={{
                height: '100dvh',
                width: '100%',
                maxWidth: '100%',
                overflow: 'hidden',
                position: 'fixed',
                touchAction: 'none'
            }}
        >
            {isLandscape ? (
                // Landscape mode
                <div className="flex h-full">
                    {/* Video container with controls underneath */}
                    <div className={`
                        relative flex-1 bg-black flex flex-col
                        transition-[margin] duration-300 ease-in-out
                        ${!isRightPanelCollapsed ? 'mr-[300px]' : ''}
                    `}>
                        {/* Video */}
                        <div className="relative flex-1 bg-black">
                            <VideoPlayer
                                videoRef={videoRef}
                                videoUrl={videoUrl}
                                currentTime={currentTime}
                                setCurrentTime={setCurrentTime}
                                setDuration={setDuration}
                                onTimeUpdate={() => {
                                    if (videoRef.current) {
                                        setCurrentTime(videoRef.current.currentTime);
                                    }
                                }}
                                isPlaying={isPlaying}
                                setIsPlaying={setIsPlaying}
                            />
                        </div>

                        {/* Video Controls - Now underneath */}
                        <div className="bg-gray-900/95 border-t border-gray-800/50 touch-manipulation">
                            <div className="px-4 py-3">
                                {/* Progress Bar */}
                                <div className="relative group touch-manipulation">
                                    <div
                                        ref={progressBarRef}
                                        className="h-2 bg-gray-800/50 rounded-full cursor-pointer touch-manipulation"
                                        onTouchStart={(e) => {
                                            e.stopPropagation();
                                            handleProgressBarInteraction(e);
                                        }}
                                        onTouchMove={(e) => {
                                            e.stopPropagation();
                                            handleProgressBarInteraction(e);
                                        }}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleProgressBarMouseDown(e);
                                        }}
                                    >
                                        <div
                                            className="absolute top-0 left-0 h-full bg-cyan-500 rounded-full 
                                                transition-all duration-150"
                                            style={{
                                                width: `${(currentTime / duration) * 100}%`
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Controls Row */}
                                <div className="flex items-center gap-4 mt-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsPlaying(!isPlaying);
                                        }}
                                        className="p-2 text-white/90 hover:text-cyan-400 transition-colors touch-manipulation"
                                    >
                                        {isPlaying ? (
                                            <Pause size={24} />
                                        ) : (
                                            <Play size={24} />
                                        )}
                                    </button>

                                    <div className="flex-1 text-[13px] text-white/70 font-medium">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Mic button */}
                                        {localParticipant && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (roomState === ConnectionState.Connected) {
                                                        localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                                                    }
                                                }}
                                                className="p-2 transition-colors touch-manipulation"
                                            >
                                                {!localParticipant.isMicrophoneEnabled ? (
                                                    <MicOff size={20} className="text-red-400" />
                                                ) : (
                                                    <Mic size={20} className="text-cyan-400" />
                                                )}
                                            </button>
                                        )}

                                        {/* Volume button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (videoRef.current) {
                                                    videoRef.current.muted = !isMuted;
                                                    setIsMuted(!isMuted);
                                                }
                                            }}
                                            className="p-2 text-white/90 hover:text-cyan-400 transition-colors touch-manipulation"
                                        >
                                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat panel with collapsible arrow */}
                    <div className={`
                        fixed right-0 top-0 bottom-0 
                        w-[300px]
                        transition-transform duration-300 ease-in-out
                        ${isRightPanelCollapsed ? 'translate-x-full' : 'translate-x-0'}
                        bg-gray-900/95 backdrop-blur-sm
                        border-l border-gray-800/50
                        flex flex-col
                        z-30
                    `}>
                        {/* Collapsible arrow indicator */}
                        <div
                            onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
                            className={`
                                absolute -left-5 top-1/2 -translate-y-1/2
                                w-5 h-14 
                                bg-gray-900/95 backdrop-blur-sm
                                border-y border-l border-gray-800/50
                                rounded-l-md
                                flex items-center justify-center
                                cursor-pointer
                                hover:bg-gray-800
                                group
                                z-50
                            `}
                        >
                            <motion.div
                                initial={false}
                                animate={{
                                    rotate: isRightPanelCollapsed ? 0 : 180
                                }}
                                transition={{
                                    type: "spring",
                                    damping: 20,
                                    stiffness: 200
                                }}
                            >
                                <ChevronRight
                                    size={16}
                                    className="text-gray-400 group-hover:text-cyan-400 transition-colors duration-300"
                                />
                            </motion.div>
                        </div>

                        {/* Chat content */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                                <span className="text-[13px] font-medium text-cyan-400">Chat</span>
                            </div>

                            {/* Messages container */}
                            <div className="flex-1 flex flex-col min-h-0">
                                {voiceAssistant?.audioTrack && (
                                    <div className="p-3 border-b border-gray-800/50">
                                        <TranscriptionTile agentAudioTrack={voiceAssistant.audioTrack} accentColor="cyan" />
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto p-3">
                                    <AnimatePresence>
                                        {transcripts.map((msg) => (
                                            <motion.div
                                                key={msg.timestamp}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                className={`${msg.isSelf ? 'ml-auto bg-cyan-950/30' : 'mr-auto bg-gray-800/30'} rounded-lg p-2.5 max-w-[90%] mb-2`}
                                            >
                                                <span className="text-[11px] text-gray-400">{msg.name}: </span>
                                                <span className="text-[12px] text-gray-200">{msg.message}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // Portrait mode with sticky video and scrollable chat
                <div
                    className="flex flex-col h-full"
                    style={{
                        height: '100dvh',
                        overflow: 'hidden',
                        touchAction: 'none',
                        paddingTop: 'env(safe-area-inset-top)',
                        paddingBottom: 'env(safe-area-inset-bottom)',
                        paddingLeft: 'env(safe-area-inset-left)',
                        paddingRight: 'env(safe-area-inset-right)'
                    }}
                >
                    {/* Video Section - Fixed at top */}
                    <div className="flex-shrink-0 bg-black">
                        <div className="w-full">
                            {/* Video container */}
                            <div className="relative w-full" style={{ height: '55vh' }}>
                                <VideoPlayer
                                    videoRef={videoRef}
                                    videoUrl={videoUrl}
                                    currentTime={currentTime}
                                    setCurrentTime={setCurrentTime}
                                    setDuration={setDuration}
                                    onTimeUpdate={() => {
                                        if (videoRef.current) {
                                            setCurrentTime(videoRef.current.currentTime);
                                        }
                                    }}
                                    isPlaying={isPlaying}
                                    setIsPlaying={setIsPlaying}
                                />

                                {/* Add video controls overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsPlaying(!isPlaying)}
                                                className="text-white/90 hover:text-cyan-400 transition-colors"
                                            >
                                                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                            </button>

                                            <div className="text-[11px] text-white/70 font-medium">
                                                {formatTime(currentTime)} / {formatTime(duration)}
                                            </div>

                                            {/* Add back the microphone button */}
                                            {localParticipant && (
                                                <button
                                                    onClick={() => {
                                                        if (roomState === ConnectionState.Connected) {
                                                            localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                                                        }
                                                    }}
                                                    className="text-white/90 hover:text-cyan-400 transition-colors"
                                                >
                                                    {!localParticipant.isMicrophoneEnabled ? (
                                                        <MicOff size={20} className="text-red-400" />
                                                    ) : (
                                                        <Mic size={20} className="text-cyan-400" />
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setIsMuted(!isMuted)}
                                                className="text-white/90 hover:text-cyan-400 transition-colors"
                                            >
                                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                            </button>
                                        </div>

                                        {/* Settings button */}
                                        {connectionParams.agentType === 'edit' && (
                                            <button
                                                onClick={() => setIsSettingsOpen(true)}
                                                className="p-2 rounded-lg bg-black/40 text-gray-400 hover:text-cyan-400"
                                            >
                                                <Settings size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="bg-gray-900/95 border-t border-gray-800/50">
                                <div className="px-4 py-3">
                                    <div
                                        ref={progressBarRef}
                                        className="h-2.5 bg-gray-800/50 rounded-full cursor-pointer touch-manipulation"
                                        onTouchStart={(e) => { e.stopPropagation(); handleProgressBarInteraction(e); }}
                                        onTouchMove={(e) => { e.stopPropagation(); handleProgressBarInteraction(e); }}
                                    >
                                        <div
                                            className="h-full bg-cyan-500 rounded-full transition-all duration-150"
                                            style={{ width: `${(currentTime / duration) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Section */}
                    <div className="flex-1 overflow-hidden bg-gray-900/95">
                        <div className="h-full overflow-y-auto overscroll-y-contain">
                            {/* Voice Assistant Transcription */}
                            {voiceAssistant?.audioTrack && (
                                <div className="px-4 py-3 border-b border-gray-800/50">
                                    <TranscriptionTile
                                        agentAudioTrack={voiceAssistant.audioTrack}
                                        accentColor="cyan"
                                    />
                                </div>
                            )}

                            {/* Chat Messages */}
                            <div className="p-4 space-y-3">
                                <AnimatePresence>
                                    {transcripts.map((msg) => (
                                        <motion.div
                                            key={msg.timestamp}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            className={`
                                                ${msg.isSelf ? 'ml-auto bg-cyan-950/30' : 'mr-auto bg-gray-800/30'}
                                                rounded-lg p-3 max-w-[85%]
                                                backdrop-blur-sm
                                                border border-gray-700/50
                                                transition-all duration-300
                                                hover:border-cyan-500/30
                                                shadow-sm
                                            `}
                                        >
                                            <span className="text-[12px] text-gray-400">{msg.name}: </span>
                                            <span className="text-[13px] text-gray-200">{msg.message}</span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Settings Drawer */}
                    {connectionParams.agentType === 'edit' && (
                        <SettingsDrawer
                            isOpen={isSettingsOpen}
                            onClose={() => setIsSettingsOpen(false)}
                            agentConfig={agentConfig}
                            onUpdateAgentConfig={handleUpdateAgentConfig}
                            savedVoices={savedVoices}
                            onVoiceCreate={handleVoiceCreate}
                            isCreatingVoice={isCreatingVoice}
                            setIsCreatingVoice={setIsCreatingVoice}
                            params={connectionParams}
                            brdge={brdge}
                            onUpdateBrdge={setBrdge}
                            isUploading={isUploading}
                            onPresentationClick={() => fileInputRef.current?.click()}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------------
// Knowledge Entry Component
// ----------------------------------------------------------------------------
interface KnowledgeEntryProps {
    content: string;
    onUpdate: (content: string, title?: string) => void;
    placeholder?: string;
}

// Update the KnowledgeEntry component with proper typing
const KnowledgeEntry: React.FC<KnowledgeEntryProps> = ({
    content,
    onUpdate,
    placeholder = 'First line becomes the title...\nAdd your knowledge here...'
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder,
                showOnlyWhenEditable: true,
            })
        ],
        content,
        onUpdate: ({ editor }) => {
            const content = editor.getHTML();
            const div = document.createElement('div');
            div.innerHTML = content;
            const firstLine = div.textContent?.split('\n')[0] || 'New Entry';
            const title = firstLine.slice(0, 50);
            onUpdate(content, title);
        },
        editorProps: {
            attributes: {
                class: `prose prose-invert max-w-none focus:outline-none
                        prose-p:text-gray-300 prose-p:text-[14px] prose-p:leading-relaxed
                        prose-headings:text-cyan-400
                        min-h-[120px]
                        selection:bg-cyan-500/20 selection:text-cyan-400`
            }
        }
    });

    return (
        <div className="relative rounded-lg overflow-hidden">
            <EditorContent
                editor={editor}
                className="bg-black/20 
                           border border-gray-800/50 rounded-lg
                           focus-within:border-cyan-500/30
                           focus-within:ring-1 focus-within:ring-cyan-500/50
                           focus-within:shadow-[0_0_15px_rgba(34,211,238,0.1)]
                           transition-all duration-300"
            />
            <div className="absolute bottom-3 right-3 text-[11px] text-gray-500">
                Click to edit
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------------
// Knowledge Card Component
// ----------------------------------------------------------------------------
interface KnowledgeCardProps {
    entry: AgentConfig['knowledgeBase'][0];
    onEdit: (id: string, content: string, title: string) => void;
    onRemove: (id: string) => void;
}

const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
    entry,
    onEdit,
    onRemove
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // NEW: Local state for the card's content to avoid re-renders on every keystroke
    const [localContent, setLocalContent] = useState(entry.content);
    useEffect(() => {
        setLocalContent(entry.content);
    }, [entry.content]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="relative overflow-hidden rounded-lg">
            <div
                className="relative bg-[#1E1E1E]/50 backdrop-blur-sm border border-gray-800/50 rounded-lg transition-colors duration-300 hover:border-cyan-500/30 shadow-lg shadow-black/10"
                style={{ transform: `translateX(${showActions ? '-80px' : '0'})` }}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-800/50">
                    <button
                        onClick={handleClick}
                        className="w-full flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isExpanded ? 'bg-cyan-400' : 'bg-gray-600'} group-hover:bg-cyan-400`} />
                            <span className="text-[14px] font-medium text-gray-300 group-hover:text-cyan-400 transition-colors duration-300 truncate pr-2">
                                {entry.name || 'New Entry'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500">
                            <div
                                style={{
                                    transform: `rotate(${isExpanded ? '180deg' : '0'})`,
                                    transition: 'transform 0.2s ease'
                                }}
                            >
                                <ChevronDown size={16} className="group-hover:text-cyan-400 transition-colors duration-300" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Content */}
                {isExpanded && (
                    <div className="p-4 pt-3">
                        <textarea
                            value={localContent}
                            onChange={(e) => setLocalContent(e.target.value)}
                            onBlur={() => {
                                const rawTitle = localContent.split("\n")[0]?.trim() || "New Entry";
                                // Limit the title to 20 characters maximum
                                const computedTitle = rawTitle.length > 20 ? rawTitle.slice(0, 20) + "…" : rawTitle;
                                onEdit(entry.id, localContent, computedTitle);
                            }}
                            className="w-full bg-black/20 rounded-lg border border-gray-800 
                                     p-4 text-[14px] leading-relaxed text-gray-300 
                                     min-h-[120px] resize-none
                                     focus:outline-none focus:ring-1 
                                     focus:ring-cyan-500/50 focus:border-cyan-500/30
                                     transition-all duration-300"
                            placeholder="Add your knowledge here..."
                            rows={6}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
            </div>

            {/* Improved delete button with larger touch target and label */}
            <div className="absolute top-2 right-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(entry.id);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 active:bg-red-500/40 transition-colors duration-300"
                >
                    <X size={16} />
                    <span className="text-sm font-medium">Delete</span>
                </button>
            </div>
        </div>
    );
};
