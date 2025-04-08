"use client";
import { ChatMessageType } from "@/components/chat/ChatTile";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
  BarVisualizer,
  useConnectionState,
  useLocalParticipant,
  useVoiceAssistant,
  useChat,
  useDataChannel
} from "@livekit/components-react";
import { ConnectionState, LocalParticipant, Track, DataPacket_Kind, RpcInvocationData } from "livekit-client";
import { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { API_BASE_URL } from '@/config';
import { api } from '@/api';
import { jwtDecode } from "jwt-decode";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import { Plus, FileText, X, Edit2, Save, ChevronDown, ChevronUp, Play, Pause, Volume2, VolumeX, Maximize2, Mic, MicOff, Radio, ChevronRight, Info, Link, Lock, Globe, Copy, Check, ExternalLink, Trash2, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { keyframes } from 'styled-components';
import PlaygroundProgressBar from '../player/PlaygroundProgressBar';

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
  agentType?: 'edit' | 'view';
  userId?: string;
  brdgeId?: string | null;
  authToken?: string | null; // Changed from token to authToken
}

// Update the header height constant at the top of the file
const headerHeight = 0; // Changed from 16 to 0

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
  brdge_id?: string | number;
  language?: string;
  description?: string;
}

type MobileTab = 'chat' | 'script' | 'voice' | 'info';
type ConfigTab = 'teaching-persona' | 'voice-clone' | 'chat' | 'share' | 'engagement';

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
  presentation_filename: string;
  audio_filename: string;
  folder: string;
  user_id: number;
  shareable: boolean;
  public_id: string | null;
  voice_id?: string | null; // Add voice_id property to fix TypeScript error
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

// Update the useIsMobile hook to also detect orientation
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkLayout = () => {
      setIsMobile(window.innerWidth < 640);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    window.addEventListener('orientationchange', checkLayout);
    return () => {
      window.removeEventListener('resize', checkLayout);
      window.removeEventListener('orientationchange', checkLayout);
    };
  }, []);

  return { isMobile, isLandscape };
};

// Update the styles object to include better font styling
const styles = {
  section: {
    title: "font-serif text-[14px] font-medium text-[#0A1933] mb-2",
  },
  tab: {
    base: "relative font-medium transition-all duration-300",
    active: "text-[#9C7C38] font-sans whitespace-nowrap",
    inactive: "text-[#1E2A42] hover:text-[#0A1933] font-sans whitespace-nowrap",
  },
  input: {
    base: "w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-sm text-[#0A1933] transition-all duration-300 focus:border-[#9C7C38]/40 focus:ring-1 focus:ring-[#9C7C38]/20 font-satoshi",
    textarea: "min-h-[120px] resize-y",
  },
  header: {
    main: "font-sans text-[15px] font-medium text-[#0A1933]",
    sub: "font-sans text-[13px] font-medium text-[#0A1933]"
  },
  knowledgeBase: {
    bubble: "bg-[#FAF7ED]/90 backdrop-blur-sm p-3 rounded-lg border border-[#9C7C38]/20 hover:border-[#9C7C38]/40 transition-all duration-300",
    content: "w-full bg-[#F5EFE0]/90 border border-[#9C7C38]/20 rounded-lg px-3 py-2 text-[13px] text-[#0A1933]"
  },
  parchment: {
    panel: "bg-gradient-to-b from-[#F5EFE0]/90 to-[#F5EFE0]/80 backdrop-md relative",
    section: "bg-gradient-to-b from-[#FAF7ED]/90 to-[#F5EFE0]/80 border border-[#9C7C38]/20 hover:border-[#9C7C38]/30 transition-all duration-300 rounded-lg overflow-hidden",
    input: "bg-[#FAF7ED]/80 border border-[#9C7C38]/30 focus:border-[#9C7C38]/50 hover:border-[#9C7C38]/40 text-[#0A1933]"
  }
};

// Update resizeHandleStyles for parchment theme
const resizeHandleStyles = {
  vertical: `
    w-1.5 mx-1 my-2 rounded-full
    bg-[#E8E0CC] hover:bg-[#9C7C38]/30
    transition-colors duration-150
    cursor-col-resize
    flex items-center justify-center
    group
  `,
  horizontal: `
    h-1.5 my-1 mx-2 rounded-full
    bg-[#E8E0CC] hover:bg-[#9C7C38]/30
    transition-colors duration-150
    cursor-row-resize
    flex items-center justify-center
    group
  `
};

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
      {/* Rest of the MobileConfigDrawer implementation */}
    </div>
  );
};

// First, let's create a proper TypeScript interface for engagement opportunities
// Add this with the other interfaces near the top of the file
interface EngagementQuizItem {
  options?: string[];
  question: string;
  follow_up?: {
    if_correct?: string;
    if_incorrect?: string;
  };
  explanation?: string;
  question_type: 'multiple_choice' | 'short_answer' | 'discussion';
  correct_option?: string | null;
  expected_answer?: string | null;
  alternative_phrasings?: string[];
}

// Export the interface so we can import it in other components
export interface EngagementOpportunity {
  id: string;
  rationale: string;
  timestamp: string;
  quiz_items: EngagementQuizItem[];
  section_id: string;
  engagement_type: 'quiz' | 'discussion';
  concepts_addressed: string[];
}

// Update the AgentConfig interface to use our new type
interface AgentConfig {
  personality: string;
  agentPersonality?: {
    name: string;
    expertise: string[];
    knowledge_areas: Array<{
      topic: string;
      confidence_level: string;
      key_talking_points: string[];
    }>;
    persona_background: string;
    response_templates: {
      greeting?: string | null;
      not_sure?: string | null;
      follow_up_questions?: string[];
    };
    communication_style: string;
    voice_characteristics?: {
      pace?: string;
      tone?: string;
      common_phrases?: string[];
      emphasis_patterns?: string;
    };
  };
  teaching_persona?: any;
  knowledgeBase: Array<{
    id: string;
    type: string;
    name: string;
    content: string;
  }>;
  engagement_opportunities?: EngagementOpportunity[];
}

// Add new interfaces for knowledge management
interface KnowledgeBubbleProps {
  entry: AgentConfig['knowledgeBase'][0];
  onEdit: (id: string, content: string, name?: string) => void;
  onRemove: (id: string) => void;
}

// Add this new component for knowledge bubbles
const KnowledgeBubble: React.FC<KnowledgeBubbleProps> = ({ entry, onEdit, onRemove }) => {
  const [content, setContent] = useState(entry.content);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-update name based on content
  useEffect(() => {
    const newName = content.trim().slice(0, 20) + (content.length > 20 ? '...' : '');
    if (newName !== entry.name && content.trim() !== '') {
      onEdit(entry.id, content, newName);
    }
  }, [content, entry.id, entry.name, onEdit]);

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
          cursor-pointer
          group
        `}
      >
        <div className="relative">
          {/* Title section */}
          <div
            className="flex items-center justify-between gap-2 mb-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={12} className="text-gray-400 group-hover:text-[#9C7C38]" />
              </motion.div>
              <span className="font-satoshi text-[12px] text-gray-300 group-hover:text-[#9C7C38]/90 transition-colors duration-300">
                {entry.name || 'New Entry'}
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entry.id);
              }}
              className="p-1.5 rounded-md hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50"
            >
              <X size={11} className="text-gray-400 hover:text-red-400" />
            </motion.button>
          </div>

          {/* Content section */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onBlur={() => {
                    if (content.trim() !== entry.content) {
                      onEdit(entry.id, content);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    ${styles.knowledgeBase.content}
                    min-h-[100px]
                    resize-none
                    transition-all duration-300
                    focus:ring-1 focus:ring-[#9C7C38]/50 
                    focus:border-[#9C7C38]/30
                    hover:border-[#9C7C38]/20
                    placeholder:text-gray-600/50
                  `}
                  placeholder="Enter knowledge content..."
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Add this new component at the top with other imports
const TranscriptTimeline = ({ transcript, currentTime, onTimeClick }: {
  transcript: any;
  currentTime: number;
  onTimeClick: (time: number) => void;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Reset scroll position to start when transcript changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [transcript]);

  // Auto-scroll to active word with a threshold
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

        // Only scroll if the active segment is not fully visible
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
      {/* Timeline ruler */}
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

      {/* Transcript content */}
      <div
        ref={scrollContainerRef}
        className={`
          flex-1 overflow-x-auto whitespace-nowrap
          scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700/30
          hover:scrollbar-thumb-[#9C7C38]/20
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
            {transcript?.content?.segments?.map((segment: any, index: number) => (
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
                    ? 'bg-[#9C7C38]/20 text-[#9C7C38] shadow-[0_0_10px_rgba(156,124,56,0.2)]'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-[#9C7C38]/10'
                  }
                  cursor-pointer
                  hover:scale-105
                  hover:shadow-[0_0_15px_rgba(156,124,56,0.1)]
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

// Replace the formatTimeWithDecimals function with this simpler version
const formatTime = (time: number): string => {
  if (!isFinite(time) || isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Update the VideoPlayer component with better mobile support
const VideoPlayer = ({
  videoRef,
  videoUrl,
  currentTime,
  setCurrentTime,
  setDuration,
  onTimeUpdate,
  isPlaying,
  setIsPlaying,
  onVideoReady, // Add this prop
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl: string | null;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  onTimeUpdate: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onVideoReady: (isReady: boolean) => void; // Add type for the prop
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false); // Internal state
  const { isMobile } = useIsMobile();

  // Handle initial load and duration updates
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur) && isFinite(dur)) {
      setDuration(dur);
      // Don't set loading false here, wait for canplay
      if (isMobile) {
        videoRef.current.muted = true;
      }
    }
  };

  // Handle when video can actually play
  const handleCanPlay = () => {
    setIsVideoReady(true);
    setIsLoading(false); // Move loading state here
    onVideoReady(true); // <<< Call the callback here

    // Auto-play on mobile if muted
    if (isMobile && videoRef.current?.muted && !hasInteracted) {
      attemptPlay();
    }
  };

  // Enhanced error handling
  const handlePlaybackError = (error: any) => {
    console.error('Video playback error:', error);
    if (isVideoReady) {
      setPlaybackError('Unable to play video. Please try again.');
    }
    setIsPlaying(false);
    setIsLoading(false);
    setIsVideoReady(false); // Set internal state
    onVideoReady(false); // <<< Call the callback here
  };

  // Handle play attempt with mobile considerations
  const attemptPlay = async () => {
    if (!videoRef.current || !isVideoReady) return;

    try {
      setPlaybackError(null);

      // Don't set loading true here anymore
      // setIsLoading(true);

      // For mobile, ensure video is muted for first play
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

  // Handle click/tap with mobile considerations
  const handleVideoClick = async () => {
    if (!videoRef.current || !isVideoReady) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // If on mobile and first interaction, unmute
      if (isMobile && hasInteracted && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
      attemptPlay();
    }
  };

  // Reset states when video URL changes
  useEffect(() => {
    if (videoUrl) {
      setIsVideoReady(false);
      setIsLoading(true);
      setPlaybackError(null);
      setHasInteracted(false);
      onVideoReady(false); // <<< Call the callback here
      if (videoRef.current) {
        videoRef.current.load();
      }
    } else {
      // If URL becomes null, video is not ready
      setIsVideoReady(false);
      setIsLoading(true); // Or false, depending on desired UI
      setPlaybackError(null);
      onVideoReady(false); // <<< Call the callback here
    }
  }, [videoUrl, onVideoReady]); // Add onVideoReady to dependency array

  // Add this effect to handle video URL changes and loading (no change needed here)
  useEffect(() => {
    if (!videoUrl) {
      setIsLoading(true);
      setIsVideoReady(false);
      return;
    }

    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      videoRef.current.load(); // Force reload with new URL
    }
  }, [videoUrl]);

  // Add a cleanup effect for when the component unmounts
  useEffect(() => {
    return () => {
      // Signal video is not ready on unmount
      onVideoReady(false);
    };
  }, [onVideoReady]); // Add onVideoReady dependency

  return (
    <div className="relative w-full h-full bg-black" onClick={handleVideoClick}>
      {/* Only render video if we have a URL */}
      {videoUrl ? (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="h-full relative flex items-center justify-center">
            <video
              ref={videoRef}
              className="h-full w-auto max-w-none"
              style={{
                objectFit: 'contain'
              }}
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
            >
              <source
                src={videoUrl}
                type={videoUrl?.endsWith('.webm') ? 'video/webm' : 'video/mp4'}
              />
            </video>
          </div>
        </div>
      ) : (
        // Show loading state if no video URL yet
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-red-900/30 border-t-red-900 animate-spin rounded-full" />
        </div>
      )}

      {/* Play Button Overlay */}
      {isVideoReady && !isPlaying && !isLoading && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent z-20">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-4 rounded-full 
              bg-[#0A1933]/80 
              border border-[#0A1933]/40
              backdrop-blur-md
              shadow-[0_0_25px_rgba(10,25,51,0.3)]
              relative
              before:absolute before:inset-0 before:rounded-full
              before:bg-gradient-to-br before:from-[#0A1933]/40 before:to-[#0A1933]/20
              before:opacity-70 before:blur-sm
              after:absolute after:inset-0 after:rounded-full
              after:bg-gradient-to-tl after:from-[#0A1933]/30 after:to-transparent
              group
              transition-all duration-300"
          >
            <Play
              size={isMobile ? 24 : 32}
              className="text-white/90 relative z-10 
                group-hover:text-white transition-colors duration-300
                drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]"
            />
          </motion.div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 animate-spin rounded-full" />
        </div>
      )}

      {/* Error Overlay */}
      {playbackError && isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="text-red-400 text-sm text-center px-4">
            {playbackError}
            <button
              onClick={(e) => {
                e.stopPropagation();
                attemptPlay();
              }}
              className="mt-2 px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-md text-xs
                hover:bg-cyan-500/30 transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Add this new component for mobile video controls with better UX
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
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 z-30"
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

// Update animations
const glowAnimation = keyframes`
  0% {
    filter: drop-shadow(0 0 2px #9C7C38);
  }
  50% {
    filter: drop-shadow(0 0 4px #9C7C38);
  }
  100% {
    filter: drop-shadow(0 0 2px #9C7C38);
  }
`;

const BrdgeLogo = styled.img`
  width: 36px;
  height: 36px;
  margin-right: 4px;
  animation: ${glowAnimation} 2s ease-in-out infinite;
`;

// Add this keyframe animation to your existing keyframes
const loadingAnimation = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

// First, add a debounced save utility at the top of the file
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Add animation keyframe for tooltip auto-dismiss
const fadeOutAnimation = `
  @keyframes fadeOut {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }

  .animate-fadeOut {
    animation: fadeOut 5s forwards;
  }
`;

// Add style tag to head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = fadeOutAnimation;
  document.head.appendChild(style);
}

// Add animation keyframe for mic button glow
const animations = `
  @keyframes fadeOut {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes pulseGlow {
    0% { box-shadow: 0 0 5px rgba(34,211,238,0.3); }
    50% { box-shadow: 0 0 15px rgba(34,211,238,0.4); }
    100% { box-shadow: 0 0 5px rgba(34,211,238,0.3); }
  }

  .animate-fadeOut {
    animation: fadeOut 5s forwards;
  }

  .animate-glow {
    animation: pulseGlow 2s infinite;
    animation-duration: 5s;
    animation-iteration-count: 1;
  }
`;

// Add style tag to head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animations;
  document.head.appendChild(style);
}

// Add this interface to better type the voices from different bridges
interface EnhancedVoice extends SavedVoice {
  brdge_name?: string;
  is_from_current_bridge?: boolean;
}

// Update the VoiceSelector component to handle voices from different bridges
const VoiceSelector = ({
  voices,
  selectedVoice,
  selectedVoiceBrdgeId, // Add this parameter
  defaultVoiceId,
  currentBrdgeId,
  onSelectVoice,
  isLoading,
}: {
  voices: EnhancedVoice[];
  selectedVoice: string | null;
  selectedVoiceBrdgeId: string | null; // Add this type
  defaultVoiceId: string;
  currentBrdgeId: string | null;
  onSelectVoice: (voiceId: string, fromBrdgeId?: string | number) => void;
  isLoading: boolean;
}) => {
  // Group voices by bridge
  const voicesByBridge: Record<string, EnhancedVoice[]> = {};

  voices.forEach(voice => {
    const bridgeKey = voice.brdge_id ? `${voice.brdge_id}` : 'current';
    if (!voicesByBridge[bridgeKey]) {
      voicesByBridge[bridgeKey] = [];
    }
    voicesByBridge[bridgeKey].push(voice);
  });

  return (
    <div className="relative">
      <label className="block text-[#0A1933]/70 text-[12px] font-medium mb-2">Active Voice</label>
      <div className="relative">
        <select
          value={selectedVoice ? `${selectedVoice}|${selectedVoiceBrdgeId || ''}` : defaultVoiceId}
          onChange={(e) => {
            // Parse the complex value which includes bridge ID
            const parts = e.target.value.split('|');
            const voiceId = parts[0];
            const bridgeId = parts.length > 1 ? parts[1] : undefined;
            onSelectVoice(voiceId, bridgeId);
          }}
          disabled={isLoading}
          className={`
            w-full px-3 py-2.5 rounded-lg
            font-satoshi text-[14px] text-[#0A1933]
            bg-[#FAF7ED]/80 backdrop-blur-sm
            border border-[#9C7C38]/30
            appearance-none
            transition-all duration-300
            focus:ring-1 focus:ring-[#9C7C38]/40 
            focus:border-[#9C7C38]/50
            hover:border-[#9C7C38]/40
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? (
            <option value="">Loading voices...</option>
          ) : (
            <>
              <option value={defaultVoiceId}>✓ Default AI Voice</option>

              {/* Voices from the current bridge */}
              {voicesByBridge[currentBrdgeId || 'current']?.length > 0 && (
                <optgroup label="Current Project Voices">
                  {voicesByBridge[currentBrdgeId || 'current'].map((voice) => (
                    <option key={voice.id} value={`${voice.id}|${voice.brdge_id || ''}`}>
                      {selectedVoice === voice.id ? '✓ ' : ''}{voice.name} {voice.status === 'active' ? '(Active)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}

              {/* Voices from other bridges */}
              {Object.entries(voicesByBridge)
                .filter(([bridgeId]) => bridgeId !== (currentBrdgeId || 'current') && bridgeId !== 'current')
                .map(([bridgeId, bridgeVoices]) => (
                  <optgroup key={bridgeId} label={`From ${bridgeVoices[0]?.brdge_name || 'Other Project'}`}>
                    {bridgeVoices.map((voice) => (
                      <option key={voice.id} value={`${voice.id}|${voice.brdge_id || ''}`}>
                        {selectedVoice === voice.id ? '✓ ' : ''}{voice.name}
                      </option>
                    ))}
                  </optgroup>
                ))
              }
            </>
          )}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9C7C38]/50">
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
};

// Helper functions should be moved OUTSIDE of the Playground component
// so they're accessible to EngagementCard component
const formatVideoTime = (timestamp: string): string => {
  if (!timestamp || !timestamp.startsWith('00:')) return '0:00';
  return timestamp.substring(3);
};

const getEngagementTypeIcon = (type: string) => {
  switch (type) {
    case 'quiz':
      return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 9H15M9 12H15M9 15H12M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21Z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>;
    case 'discussion':
      return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 12H8.01M12 12H12.01M16 12H16.01M21 12C21 16.4183 16.9706 20 12 20C10.4607 20 9.01172 19.6565 7.74467 19.0511L3 20L4.39499 16.28C3.51156 15.0423 3 13.5743 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>;
    default:
      return null;
  }
};

const getQuestionTypeIcon = (type: string) => {
  switch (type) {
    case 'multiple_choice':
      return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>;
    case 'short_answer':
      return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V14M14 5H20M20 5V11M20 5L9 16"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>;
    case 'discussion':
      return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 10H16M8 14H12M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>;
    default:
      return null;
  }
};

// The EngagementCard component definition stays outside the Playground component
// and can now use the helper functions
interface EngagementCardProps {
  engagement: EngagementOpportunity;
  onEdit: (updatedEngagement: EngagementOpportunity) => void;
  onDelete: (id: string) => void;
}

const EngagementCard: React.FC<EngagementCardProps> = ({ engagement, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEngagement, setEditedEngagement] = useState<EngagementOpportunity>({ ...engagement });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleExpand = () => {
    if (isEditing) return; // Don't collapse while editing
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      setExpandedQuiz(null);
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true); // Always expand when editing
    setEditedEngagement({ ...engagement });
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(editedEngagement);
    setIsEditing(false);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedEngagement({ ...engagement });
    setIsEditing(false);
  };

  const handleDeleteQuiz = (quizIndex: number) => {
    const updatedQuizItems = [...editedEngagement.quiz_items];
    updatedQuizItems.splice(quizIndex, 1);
    setEditedEngagement({
      ...editedEngagement,
      quiz_items: updatedQuizItems
    });
    // If we're in edit mode, we'll wait for save to propagate these changes
    // If not in edit mode, we'll immediately save the changes
    if (!isEditing) {
      onEdit({
        ...editedEngagement,
        quiz_items: updatedQuizItems
      });
    }
  };

  const handleUpdateField = (field: keyof EngagementOpportunity, value: any) => {
    setEditedEngagement({
      ...editedEngagement,
      [field]: value
    });
  };

  const handleUpdateQuizField = (quizIndex: number, field: keyof EngagementQuizItem, value: any) => {
    const updatedQuizItems = [...editedEngagement.quiz_items];
    updatedQuizItems[quizIndex] = {
      ...updatedQuizItems[quizIndex],
      [field]: value
    };
    setEditedEngagement({
      ...editedEngagement,
      quiz_items: updatedQuizItems
    });
  };

  // Function to update options for multiple choice questions
  const handleUpdateOptions = (quizIndex: number, options: string[]) => {
    const updatedQuizItems = [...editedEngagement.quiz_items];
    updatedQuizItems[quizIndex] = {
      ...updatedQuizItems[quizIndex],
      options
    };
    setEditedEngagement({
      ...editedEngagement,
      quiz_items: updatedQuizItems
    });
  };

  // Function to add a new option to a multiple choice question
  const handleAddOption = (quizIndex: number) => {
    const quiz = editedEngagement.quiz_items[quizIndex];
    if (quiz.question_type !== 'multiple_choice') return;

    const updatedQuizItems = [...editedEngagement.quiz_items];
    const options = [...(quiz.options || []), 'New option'];
    updatedQuizItems[quizIndex] = {
      ...updatedQuizItems[quizIndex],
      options
    };
    setEditedEngagement({
      ...editedEngagement,
      quiz_items: updatedQuizItems
    });
  };

  // Function to update concepts addressed
  const handleUpdateConcepts = (concepts: string[]) => {
    setEditedEngagement({
      ...editedEngagement,
      concepts_addressed: concepts
    });
  };

  // Function to add a new quiz item
  const handleAddQuizItem = () => {
    const newQuizItem: EngagementQuizItem = {
      question: "New question",
      question_type: editedEngagement.engagement_type === 'quiz' ? 'multiple_choice' : 'discussion',
      options: editedEngagement.engagement_type === 'quiz' ? ['Option 1', 'Option 2'] : undefined,
      correct_option: editedEngagement.engagement_type === 'quiz' ? 'Option 1' : null,
      explanation: "Explanation for this question",
      follow_up: {
        if_correct: "Follow-up for correct answer",
        if_incorrect: "Follow-up for incorrect answer"
      }
    };

    setEditedEngagement({
      ...editedEngagement,
      quiz_items: [...editedEngagement.quiz_items, newQuizItem]
    });
  };

  return (
    <motion.div
      layout
      id={`engagement-card-${engagement.id}`}
      className={`
        relative rounded-lg overflow-hidden
        transition-all duration-300
        ${isExpanded
          ? 'bg-gradient-to-b from-[#9C7C38]/10 to-[#F5EFE0]/80 border border-[#9C7C38]/30 shadow-[0_0_15px_rgba(156,124,56,0.07)]'
          : 'bg-[#F5EFE0]/60 border border-[#9C7C38]/20 hover:border-[#9C7C38]/40'}
      `}
    >
      {/* Header section */}
      <div
        className="p-3 cursor-pointer"
        onClick={handleToggleExpand}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {getEngagementTypeIcon(engagement.engagement_type)}
            <span className={`text-[13px] font-medium ${isExpanded ? 'text-[#9C7C38]' : 'text-[#0A1933]'}`}>
              {engagement.engagement_type === 'quiz' ? 'Quiz' : 'Discussion'}
              {engagement.quiz_items?.length > 1 ? ` (${engagement.quiz_items.length} questions)` : ''}
            </span>
            {engagement.timestamp && (
              <div className="px-1.5 py-0.5 bg-[#F5EFE0]/80 rounded text-[10px] text-[#1E2A42] flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {formatVideoTime(engagement.timestamp)}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isEditing ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveEdit}
                  className="p-1.5 rounded-md text-[#9C7C38] hover:bg-[#9C7C38]/10 transition-all duration-200"
                >
                  <Save size={14} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancelEdit}
                  className="p-1.5 rounded-md text-[#1E2A42] hover:bg-[#F5EFE0] transition-all duration-200"
                >
                  <X size={14} />
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartEdit}
                  className="p-1.5 rounded-md text-[#1E2A42] hover:text-[#9C7C38] hover:bg-[#9C7C38]/10 transition-all duration-200"
                >
                  <Edit2 size={14} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="p-1.5 rounded-md text-[#1E2A42] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                >
                  <Trash2 size={14} />
                </motion.button>
              </>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditing) handleToggleExpand();
              }}
            >
              <ChevronRight size={14} className={`${isExpanded ? 'text-[#9C7C38]' : 'text-[#1E2A42]'}`} />
            </motion.div>
          </div>
        </div>

        {/* Concepts */}
        {isEditing ? (
          <div className="mt-2 bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
            <div className="text-[11px] text-[#0A1933]/70 mb-1">Engagement Type:</div>
            <select
              value={editedEngagement.engagement_type}
              onChange={(e) => handleUpdateField('engagement_type', e.target.value)}
              className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933]"
            >
              <option value="quiz">Quiz</option>
              <option value="discussion">Discussion</option>
            </select>

            <div className="text-[11px] text-[#0A1933]/70 mt-2 mb-1">Timestamp (format: 00:MM:SS):</div>
            <input
              type="text"
              value={editedEngagement.timestamp}
              onChange={(e) => handleUpdateField('timestamp', e.target.value)}
              className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933]"
              placeholder="00:00:00"
            />

            <div className="text-[11px] text-[#0A1933]/70 mt-2 mb-1">Concepts (comma separated):</div>
            <input
              type="text"
              value={editedEngagement.concepts_addressed.join(', ')}
              onChange={(e) => handleUpdateConcepts(e.target.value.split(',').map(c => c.trim()))}
              className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933]"
              placeholder="Concept 1, Concept 2"
            />
          </div>
        ) : (
          engagement.concepts_addressed && engagement.concepts_addressed.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {engagement.concepts_addressed.map((concept, idx) => (
                <div key={idx} className="px-1.5 py-0.5 bg-[#F5EFE0]/80 rounded-sm text-[9px] text-[#1E2A42]">
                  {concept}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Rationale */}
              {isEditing ? (
                <div className="bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
                  <div className="text-[11px] text-[#0A1933]/70 mb-1">Rationale:</div>
                  <textarea
                    value={editedEngagement.rationale}
                    onChange={(e) => handleUpdateField('rationale', e.target.value)}
                    className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933] min-h-[80px]"
                    placeholder="Enter rationale..."
                  />
                </div>
              ) : (
                engagement.rationale && (
                  <div className="bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
                    <div className="text-[11px] text-[#0A1933]/70 mb-1">Rationale:</div>
                    <div className="text-[12px] text-[#0A1933]">{engagement.rationale}</div>
                  </div>
                )
              )}

              {/* Quiz items */}
              {editedEngagement.quiz_items && (
                <div className="space-y-3">
                  {editedEngagement.quiz_items.map((quiz, quizIndex) => (
                    <div
                      key={quizIndex}
                      className={`
                        rounded border transition-all duration-300
                        ${expandedQuiz === `${quizIndex}`
                          ? 'bg-[#9C7C38]/10 border-[#9C7C38]/30 shadow-[0_0_10px_rgba(156,124,56,0.05)]'
                          : 'bg-[#F5EFE0]/80 border-[#9C7C38]/20 hover:border-[#9C7C38]/40'}
                      `}
                    >
                      {/* Quiz header */}
                      <div
                        className="p-2 cursor-pointer flex items-start justify-between"
                        onClick={() => !isEditing && setExpandedQuiz(expandedQuiz === `${quizIndex}` ? null : `${quizIndex}`)}
                      >
                        <div className="flex items-center gap-2">
                          {getQuestionTypeIcon(quiz.question_type)}
                          <div className={`text-[12px] ${expandedQuiz === `${quizIndex}` ? 'text-[#9C7C38]' : 'text-[#0A1933]'}`}>
                            {isEditing ? (
                              <select
                                value={quiz.question_type}
                                onChange={(e) => handleUpdateQuizField(quizIndex, 'question_type', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-2 py-1 text-[12px] text-[#0A1933]"
                              >
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="short_answer">Short Answer</option>
                                <option value="discussion">Discussion</option>
                              </select>
                            ) : (
                              quiz.question_type === 'multiple_choice'
                                ? 'Multiple Choice'
                                : quiz.question_type === 'short_answer'
                                  ? 'Short Answer'
                                  : 'Discussion'
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuiz(quizIndex);
                            }}
                            className="p-1 rounded-md text-[#1E2A42] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : (
                          <motion.div
                            animate={{ rotate: expandedQuiz === `${quizIndex}` ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight size={12} className="text-[#1E2A42]" />
                          </motion.div>
                        )}
                      </div>

                      {/* Expanded quiz content - always show in edit mode */}
                      <AnimatePresence>
                        {(expandedQuiz === `${quizIndex}` || isEditing) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-2 pb-2 space-y-2">
                              {/* Question */}
                              <div className="bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
                                <div className="text-[11px] text-[#0A1933]/70 mb-1">Question:</div>
                                {isEditing ? (
                                  <textarea
                                    value={quiz.question}
                                    onChange={(e) => handleUpdateQuizField(quizIndex, 'question', e.target.value)}
                                    className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933] min-h-[60px]"
                                    placeholder="Enter question..."
                                  />
                                ) : (
                                  <div className="text-[12px] text-[#0A1933]">{quiz.question}</div>
                                )}
                              </div>

                              {/* Options for multiple choice */}
                              {quiz.question_type === 'multiple_choice' && (
                                <div className="bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
                                  <div className="text-[11px] text-[#0A1933]/70 mb-1">Options:</div>
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      {(quiz.options || []).map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            checked={option === quiz.correct_option}
                                            onChange={() => handleUpdateQuizField(quizIndex, 'correct_option', option)}
                                            className="w-4 h-4 accent-[#9C7C38]"
                                          />
                                          <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => {
                                              const newOptions = [...(quiz.options || [])];
                                              newOptions[optionIndex] = e.target.value;
                                              handleUpdateOptions(quizIndex, newOptions);

                                              // Update correct_option if this was the correct one
                                              if (option === quiz.correct_option) {
                                                handleUpdateQuizField(quizIndex, 'correct_option', e.target.value);
                                              }
                                            }}
                                            className="flex-1 bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-2 py-1 text-[12px] text-[#0A1933]"
                                          />
                                          <button
                                            onClick={() => {
                                              const newOptions = [...(quiz.options || [])];
                                              newOptions.splice(optionIndex, 1);
                                              handleUpdateOptions(quizIndex, newOptions);

                                              // If we removed the correct option, update it
                                              if (option === quiz.correct_option) {
                                                handleUpdateQuizField(quizIndex, 'correct_option', newOptions[0] || null);
                                              }
                                            }}
                                            className="p-1 rounded-md text-[#1E2A42] hover:text-red-400"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        onClick={() => handleAddOption(quizIndex)}
                                        className="w-full px-2 py-1 bg-[#F5EFE0] text-[#1E2A42] hover:text-[#9C7C38] rounded-lg text-[11px]"
                                      >
                                        + Add Option
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {(quiz.options || []).map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex items-start gap-2">
                                          <div className={`flex items-center justify-center w-4 h-4 rounded-full mt-0.5 text-[10px] 
                                            ${option === quiz.correct_option
                                              ? 'bg-green-500/20 text-green-600 border border-green-500/50'
                                              : 'bg-[#F5EFE0] text-[#1E2A42] border border-[#9C7C38]/30'}`}>
                                            {option === quiz.correct_option ? '✓' : ''}
                                          </div>
                                          <div className={`text-[12px] ${option === quiz.correct_option ? 'text-green-700' : 'text-[#0A1933]'}`}>
                                            {option}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Expected answer for short answer */}
                              {quiz.question_type === 'short_answer' && (
                                <div className="bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
                                  <div className="text-[11px] text-[#0A1933]/70 mb-1">Expected Answer:</div>
                                  {isEditing ? (
                                    <textarea
                                      value={quiz.expected_answer || ''}
                                      onChange={(e) => handleUpdateQuizField(quizIndex, 'expected_answer', e.target.value)}
                                      className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933] min-h-[60px]"
                                      placeholder="Enter expected answer..."
                                    />
                                  ) : (
                                    <div className="text-[12px] text-green-700">{quiz.expected_answer}</div>
                                  )}
                                </div>
                              )}

                              {/* Follow-up */}
                              {quiz.follow_up && (
                                <div className="bg-black/20 p-2 rounded border border-gray-800/50">
                                  <div className="text-[11px] text-gray-400/70 mb-1">Follow-up:</div>
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <div>
                                        <div className="text-[11px] text-green-700/70 mb-0.5">If correct:</div>
                                        <textarea
                                          value={quiz.follow_up.if_correct || ''}
                                          onChange={(e) => {
                                            const updatedFollowUp = {
                                              ...quiz.follow_up,
                                              if_correct: e.target.value
                                            };
                                            handleUpdateQuizField(quizIndex, 'follow_up', updatedFollowUp);
                                          }}
                                          className="w-full bg-[#1E1E1E]/80 border border-gray-700/50 rounded-lg px-3 py-2 text-[13px] text-white min-h-[60px]"
                                          placeholder="Enter follow-up for correct answers..."
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[11px] text-red-700/70 mb-0.5">If incorrect:</div>
                                        <textarea
                                          value={quiz.follow_up.if_incorrect || ''}
                                          onChange={(e) => {
                                            const updatedFollowUp = {
                                              ...quiz.follow_up,
                                              if_incorrect: e.target.value
                                            };
                                            handleUpdateQuizField(quizIndex, 'follow_up', updatedFollowUp);
                                          }}
                                          className="w-full bg-[#1E1E1E]/80 border border-gray-700/50 rounded-lg px-3 py-2 text-[13px] text-white min-h-[60px]"
                                          placeholder="Enter follow-up for incorrect answers..."
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {quiz.follow_up.if_correct && (
                                        <div className="mb-1">
                                          <span className="text-[11px] text-green-700">If correct: </span>
                                          <span className="text-[12px] text-[#0A1933]">{quiz.follow_up.if_correct}</span>
                                        </div>
                                      )}
                                      {quiz.follow_up.if_incorrect && (
                                        <div>
                                          <span className="text-[11px] text-red-700">If incorrect: </span>
                                          <span className="text-[12px] text-[#0A1933]">{quiz.follow_up.if_incorrect}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Explanation */}
                              {(quiz.explanation || isEditing) && (
                                <div className="bg-[#F5EFE0]/80 p-2 rounded border border-[#9C7C38]/20">
                                  <div className="text-[11px] text-[#0A1933]/70 mb-1">Explanation:</div>
                                  {isEditing ? (
                                    <textarea
                                      value={quiz.explanation || ''}
                                      onChange={(e) => handleUpdateQuizField(quizIndex, 'explanation', e.target.value)}
                                      className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg px-3 py-2 text-[13px] text-[#0A1933] min-h-[60px]"
                                      placeholder="Enter explanation..."
                                    />
                                  ) : (
                                    <div className="text-[12px] text-[#0A1933]">{quiz.explanation}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                  {/* Add quiz item button in edit mode */}
                  {isEditing && (
                    <button
                      onClick={handleAddQuizItem}
                      className="w-full py-2 bg-[#9C7C38]/10 text-[#9C7C38] hover:bg-[#9C7C38]/20 rounded-lg text-[12px] transition-colors duration-200"
                    >
                      + Add Question
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#F5EFE0] border border-[#9C7C38]/30 rounded-lg p-4 max-w-md">
            <h3 className="text-[#0A1933] text-[14px] font-medium mb-2">Delete Engagement</h3>
            <p className="text-[#1E2A42] text-[13px] mb-4">
              Are you sure you want to delete this engagement opportunity? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-[#F5EFE0]/80 text-[#1E2A42] hover:bg-[#F5EFE0] rounded-lg text-[12px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(engagement.id);
                }}
                className="px-3 py-1.5 bg-red-500/20 text-red-600 hover:bg-red-500/30 rounded-lg text-[12px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default function Playground({
  logo,
  themeColors,
  onConnect,
  agentType,
  userId,
  brdgeId,
  authToken // Changed from token to authToken
}: PlaygroundProps) {
  const { isMobile, isLandscape } = useIsMobile();
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [selectedVoiceBrdgeId, setSelectedVoiceBrdgeId] = useState<string | null>(null);
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);
  const [savedVoices, setSavedVoices] = useState<EnhancedVoice[]>([]);
  const [userVoices, setUserVoices] = useState<EnhancedVoice[]>([]);
  const [isLoadingUserVoices, setIsLoadingUserVoices] = useState(false);

  // Move brdge state up here before it's used in the useEffect dependency array
  const [brdge, setBrdge] = useState<Brdge | null>(null);
  const [isLoadingBrdge, setIsLoadingBrdge] = useState(false);

  // Existing state
  const [params, setParams] = useState({
    brdgeId: null as string | null,
    apiBaseUrl: null as string | null,
    coreApiUrl: API_BASE_URL,
    userId: null as string | null,
    agentType: 'edit' as 'edit' | 'view'  // Add this line with default
  });

  // Video URL state and fetching
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fetchVideoUrl = useCallback(async () => {
    if (!params.brdgeId || !params.apiBaseUrl) return;

    try {
      const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/recordings/latest/signed-url`);
      if (!response.ok) throw new Error('Failed to fetch video URL');

      const { url } = await response.json();
      setVideoUrl(url);
    } catch (error) {
      console.error('Error fetching video URL:', error);
    }
  }, [params.brdgeId, params.apiBaseUrl]);

  useEffect(() => {
    fetchVideoUrl();
  }, [fetchVideoUrl]);

  // Load saved voices on mount
  useEffect(() => {
    const loadVoices = async () => {
      if (!params.brdgeId || !params.apiBaseUrl) return;
      try {
        console.log('Loading voices for brdge', params.brdgeId);

        // Use authToken prop if available
        const headers: HeadersInit = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`, {
          headers,
          credentials: 'omit'
        });

        if (!response.ok) throw new Error('Failed to fetch voices');

        const data = await response.json();
        console.log('Voices data from API:', data);

        if (data.voices) {
          // Mark these as belonging to current bridge
          const enhancedVoices = data.voices.map((voice: SavedVoice) => ({
            ...voice,
            brdge_id: params.brdgeId,
            is_from_current_bridge: true
          }));

          console.log('Enhanced voices:', enhancedVoices);

          // If we have a brdge with voice_id, update the statuses to match
          if (brdge?.voice_id) {
            console.log('Setting voice statuses based on brdge.voice_id:', brdge.voice_id);
            const updatedVoices = enhancedVoices.map((voice: SavedVoice) => ({
              ...voice,
              status: voice.id === brdge.voice_id ? 'active' : 'inactive'
            }));
            setSavedVoices(updatedVoices);
          } else {
            // No voice_id in brdge, just set the voices as-is
            setSavedVoices(enhancedVoices);
          }
        }
      } catch (error) {
        console.error('Error loading voices:', error);
      }
    };

    loadVoices();
  }, [params.brdgeId, params.apiBaseUrl, brdge?.voice_id, authToken]); // Add authToken to dependencies

  // LiveKit related hooks
  const { localParticipant } = useLocalParticipant();
  const voiceAssistant = useVoiceAssistant();
  const roomState = useConnectionState();
  const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
  const chat = useChat();

  // Get URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const userIdFromUrl = urlParams.get('userId');

      const newParams = {
        brdgeId: urlParams.get('brdgeId'),
        apiBaseUrl: urlParams.get('apiBaseUrl'),
        coreApiUrl: API_BASE_URL,
        userId: userIdFromUrl || userId || (authToken ?
          jwtDecode<JWTPayload>(authToken).sub :
          `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
        agentType: (urlParams.get('agentType') as 'edit' | 'view') || agentType || 'edit'
      };
      setParams(newParams);
    }
  }, [userId, agentType, authToken]); // Add authToken as dependency

  // Add useEffect to set up the Authorization header based on the authToken prop
  useEffect(() => {
    if (authToken) {
      // Set authorization header for API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      console.log('Authorization header set from authToken prop');
    } else {
      // Remove authorization header if no token
      delete api.defaults.headers.common['Authorization'];
    }
  }, [authToken]);

  // Update the makeAuthenticatedRequest helper function to use authToken prop
  const makeAuthenticatedRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const headers = {
        ...(options.headers || {}),
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      };

      return fetch(url, {
        ...options,
        headers
      });
    } catch (error) {
      console.error('Error making authenticated request:', error);
      throw error;
    }
  }, [authToken]); // Add authToken as a dependency

  // Update the fetchUserVoices function to use authToken prop instead of localStorage token
  // Replace the reference at line 1850
  const fetchUserVoices = useCallback(async () => {
    if (!params.apiBaseUrl) return;

    setIsLoadingUserVoices(true);
    try {
      if (!authToken) {
        // If no token, we can't fetch user voices (just use bridge-specific voices)
        setIsLoadingUserVoices(false);
        return;
      }

      const response = await makeAuthenticatedRequest(`${params.apiBaseUrl}/users/voices`);

      if (!response.ok) throw new Error('Failed to fetch user voices');

      const data = await response.json();
      if (data.voices) {
        // Mark current bridge voices
        const enhancedVoices = data.voices.map((voice: SavedVoice) => ({
          ...voice,
          is_from_current_bridge: voice.brdge_id == params.brdgeId
        }));

        setUserVoices(enhancedVoices);
      }
    } catch (error) {
      console.error('Error loading user voices:', error);
    } finally {
      setIsLoadingUserVoices(false);
    }
  }, [params.apiBaseUrl, params.brdgeId, makeAuthenticatedRequest, authToken]); // Add authToken as dependency

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

  // Add these state variables at the top with other states
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

  // Add this function to fetch the transcript
  const fetchTranscript = useCallback(async () => {
    if (!params.brdgeId || !params.apiBaseUrl) return;

    setIsLoadingTranscript(true);
    try {
      const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/script`);
      if (!response.ok) throw new Error('Failed to fetch transcript');

      const data = await response.json();
      setTranscript(data);
    } catch (error) {
      console.error('Error fetching transcript:', error);
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [params.brdgeId, params.apiBaseUrl]);

  // Add useEffect to fetch transcript when component mounts
  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  // Add state for video current time
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Add these state variables
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    personality: "",
    agentPersonality: {
      name: "AI Assistant",
      expertise: [],
      knowledge_areas: [],
      persona_background: "A helpful AI assistant",
      response_templates: {
        greeting: null,
        not_sure: null,
        follow_up_questions: []
      },
      communication_style: "friendly",
      voice_characteristics: {
        pace: "measured",
        tone: "neutral",
        common_phrases: [],
        emphasis_patterns: ""
      }
    },
    knowledgeBase: [
      { id: "presentation", type: "presentation", name: "", content: "" }
    ]
  });

  // Add this near other state declarations
  const [engagementOpportunities, setEngagementOpportunities] = useState<EngagementOpportunity[]>([]);
  const [selectedEngagement, setSelectedEngagement] = useState<string | null>(null);

  // Enhanced logging for debug
  useEffect(() => {
    if (agentConfig?.engagement_opportunities) {
      console.log('Setting engagement opportunities from agent config:', agentConfig.engagement_opportunities);
      console.log('Number of opportunities:', agentConfig.engagement_opportunities.length);
      if (agentConfig.engagement_opportunities.length > 0) {
        console.log('First opportunity sample:', agentConfig.engagement_opportunities[0]);
      }
      setEngagementOpportunities(agentConfig.engagement_opportunities);
    } else {
      console.log('No engagement opportunities found in agent config');
      setEngagementOpportunities([]);
    }
  }, [agentConfig]);

  // Update the useEffect that fetches agent config with debug logging
  useEffect(() => {
    const fetchAgentConfig = async () => {
      if (!params.brdgeId || !params.apiBaseUrl) return;

      try {
        console.log('Fetching agent config...');
        const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`);

        if (!response.ok) throw new Error('Failed to fetch agent config');

        const data = await response.json();
        console.log('Received agent config:', data);
        console.log('Engagement opportunities in response:', data.engagement_opportunities);

        // Ensure backwards compatibility - if script data exists, populate the agentPersonality field
        if (data.script && data.script.agent_personality) {
          data.agentPersonality = data.script.agent_personality;
        }

        setAgentConfig(data);
      } catch (error) {
        console.error('Error fetching agent config:', error);
      }
    };

    fetchAgentConfig();
  }, [params.brdgeId, params.apiBaseUrl]);

  // Add this function to handle config updates
  const updateAgentConfig = async (newConfig: typeof agentConfig) => {
    try {
      console.log('Sending updated config:', newConfig); // For debugging

      const response = await fetch(
        `${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personality: newConfig.personality,
            agentPersonality: newConfig.agentPersonality,
            teaching_persona: newConfig.teaching_persona, // ADD THIS LINE
            knowledgeBase: newConfig.knowledgeBase
            // REMOVE the script field entirely
          }),
        }
      );

      if (response.ok) {
        setAgentConfig(newConfig);
      }
    } catch (error) {
      console.error('Error updating agent config:', error);
    }
  };

  // Add this state for voice cloning
  const [isVoiceCloning, setIsVoiceCloning] = useState(false);
  const [voiceCloneProgress, setVoiceCloneProgress] = useState(0);

  // Add voice cloning function
  const cloneVoice = async (name: string) => {
    if (!params.brdgeId || !params.apiBaseUrl) return;

    try {
      setIsVoiceCloning(true);
      const response = await fetch(
        `${params.apiBaseUrl}/brdges/${params.brdgeId}/voices/clone`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        }
      );

      if (!response.ok) throw new Error('Failed to clone voice');

      // Refresh voice list
      const voicesResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`);
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

  // Add this useEffect to fetch the brdge data with authentication
  useEffect(() => {
    const fetchBrdge = async () => {
      if (!params.brdgeId || !params.apiBaseUrl) {
        console.log('Missing params:', { brdgeId: params.brdgeId, apiBaseUrl: params.apiBaseUrl });
        return;
      }

      setIsLoadingBrdge(true);
      try {
        const url = `${params.apiBaseUrl}/brdges/${params.brdgeId}`;
        console.log('Fetching brdge from:', url);

        // Use authToken from props if available
        const headers: HeadersInit = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
          headers,
          credentials: 'omit'
        });

        console.log('Response status:', response.status);

        if (!response.ok) throw new Error('Failed to fetch brdge');

        const data = await response.json();
        console.log('Fetched brdge data:', data);
        console.log('Brdge voice_id from API:', data.voice_id);

        // Update agentConfig with the brdge's personality if it exists
        setAgentConfig(prev => ({
          ...prev,
          personality: data.agent_personality || "friendly ai assistant"
        }));

        // Important: Set the brdge data AFTER setting voice states
        // to prevent timing issues with the dependency array
        if (data.voice_id) {
          console.log('Setting voice from brdge data:', data.voice_id);
          setSelectedVoice(data.voice_id);
          setSelectedVoiceBrdgeId(String(params.brdgeId));
        } else {
          // If no voice_id, use default
          console.log('No voice_id in brdge data, using default');
          setSelectedVoice("default");
          setSelectedVoiceBrdgeId(null);
        }

        // Finally, set the brdge data
        setBrdge(data);

      } catch (error) {
        console.error('Error fetching brdge:', error);
      } finally {
        setIsLoadingBrdge(false);
      }
    };

    fetchBrdge();
  }, [params.brdgeId, params.apiBaseUrl, authToken]); // Add authToken as dependency

  useEffect(() => {
    console.log('Current params:', params);
  }, [params]);

  // Add this near your other state declarations
  const debouncedUpdateConfig = useDebounce((newConfig: AgentConfig) => {
    // Make sure we're sending the teaching_persona field directly
    // and not nesting it inside script.content
    updateAgentConfig(newConfig);
  }, 500);

  // Update the handleKnowledgeEdit function to use debouncing
  const handleKnowledgeEdit = useCallback((id: string, content: string, name?: string) => {
    setAgentConfig(prev => {
      const newConfig = {
        ...prev,
        knowledgeBase: prev.knowledgeBase.map(entry =>
          entry.id === id
            ? { ...entry, content, ...(name && { name }) }
            : entry
        )
      };

      // Debounce the API call
      debouncedUpdateConfig(newConfig);

      return newConfig;
    });
  }, [debouncedUpdateConfig]);

  // Handler for removing knowledge entries
  const handleKnowledgeRemove = useCallback((id: string) => {
    setAgentConfig(prev => ({
      ...prev,
      knowledgeBase: prev.knowledgeBase.filter(entry => entry.id !== id)
    }));

    // Update the backend
    updateAgentConfig({
      ...agentConfig,
      knowledgeBase: agentConfig.knowledgeBase.filter(entry => entry.id !== id)
    });
  }, [agentConfig, updateAgentConfig]);

  // Add this inside the Playground component, with other state variables
  const [activeTab, setActiveTab] = useState<ConfigTab>(
    params.agentType === 'view' ? 'chat' : 'chat'
  );

  // Add an effect to update activeTab when params.agentType changes
  useEffect(() => {
    if (params.agentType === 'view') {
      setActiveTab('chat');
    }
  }, [params.agentType]);

  // Add these refs and states near the top of the component
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // Add these state variables in the main Playground component
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  // Add this state variable
  const [isVideoReadyForListeners, setIsVideoReadyForListeners] = useState(false);

  // Add these helper functions before the return statement
  const formatTime = (seconds: number) => {
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

  // Add this to improve error handling for the handleCloneVoice function
  const handleCloneVoice = async () => {
    if (!currentRecording || !voiceName || !params.brdgeId) return;
    setIsCloning(true);
    try {
      const formData = new FormData();
      formData.append('audio', currentRecording);
      formData.append('name', voiceName);

      // Use the authToken prop
      const headers: HeadersInit = {};

      // Add auth token if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Use fetch directly instead of the api object
      const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voice/clone`, {
        method: 'POST',
        body: formData,
        // Don't include credentials to avoid preflight issues
        credentials: 'omit',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to clone voice: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Voice clone response:', responseData);

      if (responseData.voice?.id) {
        // Set selected voice immediately
        setSelectedVoice(responseData.voice.id);
        setSelectedVoiceBrdgeId(String(params.brdgeId));

        // Update the brdge's voice_id using the update-voice endpoint instead of activate
        const updateResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/update-voice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? {
              'Authorization': `Bearer ${authToken}`
            } : {})
          },
          body: JSON.stringify({ voice_id: responseData.voice.id }),
          credentials: 'omit'
        });

        if (updateResponse.ok) {
          console.log('Successfully updated brdge voice_id to:', responseData.voice.id);

          // Refresh the brdge data
          const brdgeResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}`);
          if (brdgeResponse.ok) {
            const brdgeData = await brdgeResponse.json();
            console.log('Refreshed brdge data:', brdgeData);
            console.log('Brdge voice_id after update:', brdgeData.voice_id);
            setBrdge(brdgeData);
          }
        }

        // Now refresh voice lists
        const voicesResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`);
        if (voicesResponse.ok) {
          const voicesData = await voicesResponse.json();
          if (voicesData.voices) {
            setSavedVoices(voicesData.voices.map((voice: SavedVoice) => ({
              ...voice,
              status: voice.id === responseData.voice.id ? 'active' : 'inactive'
            })));
          }
        }

        // Close the voice creation UI
        setIsCreatingVoice(false);
      }

      // Also refresh the user's voices from all bridges
      fetchUserVoices();

      // Reset recording state
      setCurrentRecording(null);
      setVoiceName('');
    } catch (error) {
      console.error('Error cloning voice:', error);
    } finally {
      setIsCloning(false);
    }
  };

  // Add this useEffect to handle automatic voice activation
  useEffect(() => {
    if (!params.brdgeId || !params.apiBaseUrl) return;

    if (savedVoices.length === 1) {
      // If there's only one voice, make it active
      const voice = savedVoices[0];
      if (voice.status !== 'active') {
        fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voice/activate`, {
          method: 'POST',
          body: JSON.stringify({ voice_id: voice.id }),
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? {
              'Authorization': `Bearer ${authToken}`
            } : {})
          },
          credentials: 'omit'
        })
          .then(response => {
            if (response.ok) {
              setSavedVoices([{ ...voice, status: 'active' }]);
            }
          })
          .catch(error => console.error('Error activating single voice:', error));
      }
    } else if (savedVoices.length > 1 && !savedVoices.some((v: SavedVoice) => v.status === 'active')) {
      // If there are multiple voices and none are active, activate the most recent one
      const mostRecent = savedVoices.reduce((prev, current) => {
        return new Date(current.created_at) > new Date(prev.created_at) ? current : prev;
      }, savedVoices[0]);

      fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voice/activate`, {
        method: 'POST',
        body: JSON.stringify({ voice_id: mostRecent.id }),
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : {})
        },
        credentials: 'omit'
      })
        .then(response => {
          if (response.ok) {
            setSavedVoices(prev => prev.map(v => ({
              ...v,
              status: v.id === mostRecent.id ? 'active' : 'inactive'
            })));
          }
        })
        .catch(error => console.error('Error activating most recent voice:', error));
    }
  }, [savedVoices, params.brdgeId, params.apiBaseUrl, authToken]);

  // Update tabs array
  const tabs = params.agentType === 'view' ? [
    { id: 'chat', label: 'Chat' }
  ] : [
    { id: 'chat', label: 'Chat' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'teaching-persona', label: 'Persona' },
    { id: 'voice-clone', label: 'Voice' },
    { id: 'share', label: 'Share' }
  ];

  // Add this effect to handle video playback state
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

  // Add this effect to update duration when video is loaded
  useEffect(() => {
    if (videoRef.current && videoRef.current.duration) {
      setDuration(videoRef.current.duration);
    }
  }, [videoUrl]);

  // Replace the progress bar click handler with this enhanced version
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
  }, [setCurrentTime]); // Add setCurrentTime as a dependency

  // Add these state variables for progress bar dragging
  const [isDragging, setIsDragging] = useState(false);

  // Add these handlers for progress bar dragging
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

  // Add this state near other state declarations
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update the save button click handler
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Update the agent config with the teaching persona
      const newConfig = {
        ...agentConfig,
        teaching_persona: teachingPersona  // Direct update to top level
      };

      // Call your existing update function
      await updateAgentConfig(newConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save teaching persona config:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add this ref for the file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add this state for upload status
  const [isUploading, setIsUploading] = useState(false);

  // Update the handlePresentationUpload function
  const handlePresentationUpload = async (file: File) => {
    if (!params.brdgeId || !params.apiBaseUrl) return;

    setIsUploading(true);
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Upload the file
      const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/upload/presentation`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to upload file');

      const data = await response.json();

      // Update the brdge state with the new filename
      setBrdge(prev => prev ? {
        ...prev,
        presentation_filename: data.filename || file.name
      } : null);

      // Update agent config if needed
      setAgentConfig(prev => ({
        ...prev,
        knowledgeBase: [
          ...prev.knowledgeBase.filter(k => k.type !== 'presentation'),
          {
            id: `presentation_${Date.now()}`,
            type: 'presentation',
            name: file.name,
            content: ''
          }
        ]
      }));

    } catch (error) {
      console.error('Error uploading file:', error);
      // You might want to show an error message to the user here
    } finally {
      setIsUploading(false);
    }
  };

  // Add auto-connect effect after URL params are loaded
  useEffect(() => {
    const canAutoConnect = params.userId && params.brdgeId;
    if (canAutoConnect && roomState === ConnectionState.Disconnected) {
      onConnect(true);
    }
  }, [params, roomState, onConnect]);

  // Add effect to default mic to off when connected
  useEffect(() => {
    if (roomState === ConnectionState.Connected && localParticipant) {
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [roomState, localParticipant]);

  // Add effect to pause video when speaking or TTS is active
  useEffect(() => {
    if (!videoRef.current) return;

    const isMicOn = localParticipant?.isMicrophoneEnabled;
    const isTTSSpeaking = !!voiceAssistant?.audioTrack;

    if (isMicOn || isTTSSpeaking) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [localParticipant?.isMicrophoneEnabled, voiceAssistant?.audioTrack]);

  // First, update the mobile layout class to be simpler
  const mobileLayoutClass = isMobile ? 'flex flex-col' : '';

  // Add mobile-specific video controls that overlay the video
  const MobileVideoControls = () => {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (videoRef.current) {
                if (isPlaying) {
                  videoRef.current.pause();
                } else {
                  videoRef.current.play();
                }
                setIsPlaying(!isPlaying);
              }
            }}
            className="text-white/90 hover:text-cyan-400 transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className="flex-1 text-[11px] text-white/60 font-medium">
            {formatTime(currentTime)} / {formatTime(videoRef.current?.duration || 0)}
          </div>

          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            className="text-white/90 hover:text-cyan-400 transition-colors"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    );
  };

  // Add a FAB component for quick mobile actions
  const MobileFAB = () => {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (roomState === ConnectionState.Connected && localParticipant) {
              localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
            }
          }}
          className={`
            w-12 h-12 rounded-full
            flex items-center justify-center
            ${localParticipant?.isMicrophoneEnabled
              ? 'bg-red-500/90 text-white'
              : 'bg-cyan-500/90 text-white'}
            shadow-lg backdrop-blur-sm
            border border-white/10
          `}
        >
          {localParticipant?.isMicrophoneEnabled
            ? <MicOff size={18} />
            : <Mic size={18} />}
        </motion.button>
      </div>
    );
  };

  // Add this effect to send agent config when connected
  useEffect(() => {
    if (roomState === ConnectionState.Connected && agentConfig) {
      try {
        const configPayload = {
          agent_config: agentConfig,
          user_id: params.userId,
          brdge_id: params.brdgeId
        };

        console.log('Agent config updated:', configPayload);
        // Removed sendData call since we're removing data channel functionality
      } catch (error) {
        console.error('Error updating agent config:', error);
      }
    }
  }, [roomState, agentConfig, params.userId, params.brdgeId]);

  // Then update the main container and content area for mobile
  const [isInfoVisible, setIsInfoVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInfoVisible(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Combine all voices for display
  const allVoices = useMemo(() => {
    // First include voices from current bridge
    const bridgeVoices = savedVoices.map(voice => ({
      ...voice,
      brdge_id: params.brdgeId || undefined, // Use undefined instead of null
      is_from_current_bridge: true
    }));

    // Then include voices from other bridges that aren't already included
    const otherBridgeVoices = userVoices.filter(voice =>
      String(voice.brdge_id) !== String(params.brdgeId) &&
      !bridgeVoices.some(bv => bv.id === voice.id)
    );

    return [...bridgeVoices, ...otherBridgeVoices] as EnhancedVoice[];
  }, [savedVoices, userVoices, params.brdgeId]);

  // In the main component, add state for link copying
  const [isCopied, setIsCopied] = useState(false);
  const [shareableLink, setShareableLink] = useState('');

  // Add this function to toggle the shareable status of the brdge
  const toggleShareable = async () => {
    if (!params.brdgeId || !params.apiBaseUrl || !brdge) return;

    try {
      console.log("Toggling shareable status with token:", authToken ? "Token exists" : "No token");

      // Make a direct fetch request without credentials but with the auth token header
      const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/toggle_shareable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        // Don't include credentials - this is crucial for CORS
        credentials: 'omit'
      });

      if (!response.ok) {
        console.error('Failed to toggle shareable status:', response.status, response.statusText);
        throw new Error(`Failed to toggle shareable status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Toggle response:', data);

      // Update the brdge object with the new shareable status
      setBrdge(prev => prev ? { ...prev, shareable: data.shareable } : null);

      // Update the shareable link
      updateShareableLink(data.shareable);
    } catch (error) {
      console.error('Error toggling shareable status:', error);
    }
  };

  // Function to format and update the shareable link
  const updateShareableLink = useCallback((isShareable: boolean) => {
    if (!brdge || !isShareable) {
      setShareableLink('');
      return;
    }

    // Determine the correct base URL based on environment
    let baseUrl = window.location.origin;

    // In development, if we're on port 3001 (iframe), change to port 3000 (main app)
    if (baseUrl.includes('localhost:3001')) {
      baseUrl = baseUrl.replace('3001', '3000');
    }

    // In production, we keep the current origin (https://brdge-ai.com)
    // Construct the shareable URL with the correct path format
    const shareableUrl = `${baseUrl}/viewBridge/${brdge.id}-${brdge.public_id?.substring(0, 6)}`;
    setShareableLink(shareableUrl);
  }, [brdge]);

  // Update the shareable link when the brdge changes
  useEffect(() => {
    if (brdge) {
      updateShareableLink(brdge.shareable);
    }
  }, [brdge, updateShareableLink]);

  // Function to copy link to clipboard
  const copyLinkToClipboard = () => {
    if (!shareableLink) {
      console.error('Cannot copy - shareableLink is empty');
      return;
    }

    console.log('Copying link to clipboard:', shareableLink);

    // Try using the modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareableLink)
        .then(() => {
          console.log('Successfully copied using Clipboard API');
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(err => {
          console.error('Clipboard API failed:', err);
          // Fall back to execCommand method
          fallbackCopyToClipboard();
        });
    } else {
      // For browsers that don't support clipboard API
      fallbackCopyToClipboard();
    }
  };

  // Fallback copy method using document.execCommand
  const fallbackCopyToClipboard = () => {
    try {
      // Create a temporary textarea element
      const textArea = document.createElement('textarea');
      textArea.value = shareableLink;

      // Make it invisible but part of the document
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);

      // Select and copy
      textArea.select();
      const success = document.execCommand('copy');

      // Clean up
      document.body.removeChild(textArea);

      if (success) {
        console.log('Successfully copied using execCommand fallback');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        console.error('execCommand copy failed');
      }
    } catch (err) {
      console.error('Fallback copy method failed:', err);
    }
  };

  // Add state for teaching persona
  const [teachingPersona, setTeachingPersona] = useState<any>(null);
  const [speakingPaceValue, setSpeakingPaceValue] = useState(3); // 1-5 scale

  // Function to load teaching persona from script
  useEffect(() => {
    if (agentConfig?.teaching_persona) {
      setTeachingPersona(agentConfig.teaching_persona);

      // Set speaking pace value based on extracted data
      const pace = agentConfig.teaching_persona?.speech_characteristics?.accent?.cadence || '';
      if (pace.toLowerCase().includes('slow')) setSpeakingPaceValue(1);
      else if (pace.toLowerCase().includes('fast')) setSpeakingPaceValue(5);
      else setSpeakingPaceValue(3); // Default to moderate
    }
  }, [agentConfig]);

  // Helper function to update nested properties in teaching persona
  const updateTeachingPersona = (path: string, value: any) => {
    setTeachingPersona((prev: any) => {
      // Create the updated persona first
      const newPersona = { ...prev };
      const keys = path.split('.');
      let current: any = newPersona;

      // Navigate to the nested property
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      // Update the value
      current[keys[keys.length - 1]] = value;

      // IMPORTANT: Also update the agent config with the new persona
      // in the SAME function to ensure we use the updated value
      const newConfig = {
        ...agentConfig,
        teaching_persona: newPersona  // Use newPersona, not teachingPersona state
      };

      // Call the debounced update
      debouncedUpdateConfig(newConfig);

      // Return for state update
      return newPersona;
    });
  };

  // Add state for the phrases text
  const [phrasesText, setPhrasesText] = useState('');

  // Initialize from existing phrases when teachingPersona changes
  useEffect(() => {
    if (teachingPersona?.communication_patterns?.recurring_phrases) {
      setPhrasesText(teachingPersona.communication_patterns.recurring_phrases
        .map((p: any) => p.phrase)
        .join('\n')
      );
    }
  }, [teachingPersona]);

  // Helper function to update recurring phrases
  const updateRecurringPhrases = (phrasesText: string) => {
    // Split text by newlines and preserve empty lines
    // This is the key change - don't filter lines until after adding the last empty line
    const lines = phrasesText.split('\n');

    // If the last line is empty (user just pressed Enter), keep it
    // Otherwise, filter out empty lines from the actual phrases that get saved
    const phrases = lines
      .filter((line, index) =>
        line.trim() !== '' || index === lines.length - 1
      )
      .map(phrase => ({
        phrase: phrase,  // Don't trim here to preserve spaces
        frequency: "medium",
        usage_context: "General conversation"
      }));

    updateTeachingPersona('communication_patterns.recurring_phrases', phrases);
  };

  // Helper function to update speaking pace
  const updateSpeakingPace = (value: number) => {
    setSpeakingPaceValue(value);

    let paceText = "moderate";
    if (value === 1) paceText = "very slow";
    else if (value === 2) paceText = "slow";
    else if (value === 4) paceText = "fast";
    else if (value === 5) paceText = "very fast";

    updateTeachingPersona('speech_characteristics.accent.cadence',
      `${paceText} with ${teachingPersona?.speech_characteristics?.accent?.cadence?.includes('uptick') ? 'upticks' : 'even tone'}`);
  };

  // Add this near other state declarations

  // Add these helper functions to format time and get engagement type icons
  const formatVideoTime = (timestamp: string): string => {
    if (!timestamp || !timestamp.startsWith('00:')) return '0:00';

    // Remove the "00:" prefix and return the minutes:seconds format
    return timestamp.substring(3);
  };

  const getEngagementTypeIcon = (type: string) => {
    switch (type) {
      case 'quiz':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 9H15M9 12H15M9 15H12M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21Z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>;
      case 'discussion':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 12H8.01M12 12H12.01M16 12H16.01M21 12C21 16.4183 16.9706 20 12 20C10.4607 20 9.01172 19.6565 7.74467 19.0511L3 20L4.39499 16.28C3.51156 15.0423 3 13.5743 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>;
      default:
        return null;
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>;
      case 'short_answer':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V14M14 5H20M20 5V11M20 5L9 16"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>;
      case 'discussion':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 10H16M8 14H12M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>;
      default:
        return null;
    }
  };

  // Fix the type issue with params.agentType comparison - use strict equality and type check
  const isEditMode = agentType === 'edit' || params.agentType === 'edit';

  // Add this function to handle engagement updates
  const handleUpdateEngagement = (updatedEngagement: EngagementOpportunity) => {
    // Update local state
    const updatedOpportunities = engagementOpportunities.map(engagement =>
      engagement.id === updatedEngagement.id ? updatedEngagement : engagement
    );

    setEngagementOpportunities(updatedOpportunities);

    // Update backend
    updateEngagementOpportunities(updatedOpportunities);
  };

  // Add this function to handle engagement deletion
  const handleDeleteEngagement = (id: string) => {
    // Update local state
    const updatedOpportunities = engagementOpportunities.filter(engagement => engagement.id !== id);

    setEngagementOpportunities(updatedOpportunities);

    // Update backend
    updateEngagementOpportunities(updatedOpportunities);
  };

  // Add this function to add a new engagement opportunity
  const handleAddEngagement = () => {
    // Generate a unique ID
    const newId = `engagement-${Date.now()}`;

    // Create a new engagement opportunity
    const newEngagement: EngagementOpportunity = {
      id: newId,
      rationale: "Add your rationale here",
      timestamp: "00:00:00",
      quiz_items: [
        {
          question: "Add your question here",
          question_type: "multiple_choice",
          options: ["Option 1", "Option 2", "Option 3"],
          correct_option: "Option 1",
          explanation: "Add your explanation here",
          follow_up: {
            if_correct: "Add follow-up for correct answers",
            if_incorrect: "Add follow-up for incorrect answers"
          }
        }
      ],
      section_id: "section-1", // Default section
      engagement_type: "quiz",
      concepts_addressed: ["New Concept"]
    };

    // Update local state
    const updatedOpportunities = [...engagementOpportunities, newEngagement];
    setEngagementOpportunities(updatedOpportunities);

    // Update backend
    updateEngagementOpportunities(updatedOpportunities);
  };

  // Updated function to properly update engagement opportunities in the backend
  const updateEngagementOpportunities = (opportunities: EngagementOpportunity[]) => {
    if (!params.brdgeId || !params.apiBaseUrl) return;

    try {
      // Create updated config object that FULLY REPLACES the existing config
      const newConfig = {
        ...agentConfig,
        engagement_opportunities: opportunities
      };

      console.log('Sending updated opportunities to backend:', opportunities);
      console.log('Number of opportunities after update:', opportunities.length);

      // Ensure we're using correct headers and explicitly replacing the opportunities
      fetch(
        `${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache', // Add this to prevent caching issues
            ...(authToken ? {
              'Authorization': `Bearer ${authToken}`
            } : {})
          },
          body: JSON.stringify({
            personality: newConfig.personality,
            agentPersonality: newConfig.agentPersonality,
            teaching_persona: newConfig.teaching_persona,
            knowledgeBase: newConfig.knowledgeBase,
            // This needs to entirely replace the existing array
            engagement_opportunities: opportunities
          }),
        }
      )
        .then(async response => {
          if (response.ok) {
            console.log('Successfully updated engagement opportunities');
            // Important: Update the full agentConfig to ensure local state is consistent
            setAgentConfig(newConfig);

            // Force re-fetch to verify our changes took effect
            const verifyResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`);
            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              console.log('Verification - opportunities count after update:',
                verifyData.engagement_opportunities?.length || 0);
            }
          } else {
            const errorData = await response.text();
            console.error('Failed to update engagement opportunities:', errorData);
            // Restore the original state if update failed
            if (agentConfig?.engagement_opportunities) {
              setEngagementOpportunities(agentConfig.engagement_opportunities);
            }
          }
        })
        .catch(error => {
          console.error('Error updating engagement opportunities:', error);
          // Restore the original state if update failed
          if (agentConfig?.engagement_opportunities) {
            setEngagementOpportunities(agentConfig.engagement_opportunities);
          }
        });
    } catch (error) {
      console.error('Error preparing engagement update:', error);
    }
  };

  // Add useEffect to get the progress bar width for proper marker positioning
  useEffect(() => {
    // Update progressBarWidth state when component mounts and on window resize
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

  // Add state for progress bar width
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  // Add a CSS class for engagement highlighting
  useEffect(() => {
    // Add the CSS for the highlight-pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes highlightPulse {
        0% { box-shadow: 0 0 0 0 rgba(156, 124, 56, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(156, 124, 56, 0); }
        100% { box-shadow: 0 0 0 0 rgba(156, 124, 56, 0); }
      }
      .highlight-pulse {
        animation: highlightPulse 1s ease-out;
        border-color: rgba(156, 124, 56, 0.6) !important;
        background-color: rgba(156, 124, 56, 0.1) !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Update connect handler to use LiveKit connection
  const handleConnect = useCallback(async () => {
    if (roomState === ConnectionState.Connected) {
      onConnect(false);
    } else {
      // The parent component (index.tsx) handles the token and url
      // Just pass the connection request up
      onConnect(true);
    }
  }, [roomState, onConnect]);

  // Update the connect button to use the new handler
  const connectButton = (
    <button
      onClick={handleConnect}
      className={`p-1.5 rounded-lg transition-colors text-xs
        ${roomState === ConnectionState.Connected
          ? 'bg-red-500/20 text-red-400'
          : 'bg-[#9C7C38]/20 text-[#9C7C38]'
        }`}
    >
      {roomState === ConnectionState.Connected ? 'Disconnect' : 'Connect'}
    </button>
  );

  // Add this hook to get the data channel functionality
  const { send } = useDataChannel("video-timestamp");

  // Add a ref to track the interval ID for cleanup
  const timestampIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add a ref to track the last sent timestamp
  const lastSentTimestampRef = useRef<number | null>(null);

  // Store the latest send function in a ref
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]); // Update the ref whenever the send function instance changes

  // 1. Modify sendTimestamp to use the ref
  const sendTimestamp = useCallback(() => {
    // --- Add detailed logging at the start ---
    const currentVideo = videoRef.current;
    const sendFn = sendRef.current; // Get the current send function
    const currentState = roomState; // Capture current state
    console.log(`sendTimestamp called. Video: ${currentVideo ? 'Exists' : 'Missing'}, SendRef exists: ${!!sendFn}, State: ${currentState}`);
    // --- End detailed logging ---

    // Check 1: Video must exist and we must have a send function
    if (!currentVideo) {
      console.log("sendTimestamp aborted: Video ref is missing.");
      return;
    }

    // Check 2: Room must be connected
    if (currentState !== ConnectionState.Connected) {
      console.log(`sendTimestamp aborted: Room not connected (State: ${currentState}).`);
      return;
    }

    // Now we know video exists and room is connected
    const currentTime = currentVideo.currentTime;

    // Check 3: Threshold check
    const thresholdMet = lastSentTimestampRef.current === null ||
      Math.abs(currentTime - lastSentTimestampRef.current) >= 0.7;

    if (thresholdMet) {
      console.log(`Threshold met. Attempting to send timestamp: ${currentTime}`); // <-- Log before sending
      const message = JSON.stringify({
        type: "timestamp",
        time: currentTime
      });
      const payload = new TextEncoder().encode(message);

      try {
        // Send the timestamp using the function from the ref
        if (sendFn) {
          sendFn(payload, { topic: "video-timestamp", reliable: false });
          lastSentTimestampRef.current = currentTime; // Update only on successful send attempt
          console.log(`Timestamp ${currentTime} sent successfully via ref.`);
        } else {
          console.log("Cannot send timestamp: send function is not available.");
        }
      } catch (err) {
        console.error(`Failed to send timestamp ${currentTime} via ref:`, err);
      }
    }
  }, [roomState]); // Keep roomState here as it's checked directly

  // 2. Create stable event handler callbacks
  const handlePlay = useCallback(() => {
    console.log("Video play event triggered");
    // --- Temporarily remove the interval to isolate timeupdate ---
    // if (timestampIntervalRef.current) {
    //   clearInterval(timestampIntervalRef.current);
    // }
    sendTimestamp(); // Send initial timestamp
    // timestampIntervalRef.current = setInterval(() => sendTimestamp(), 3000);
    // --- End temporary removal ---
  }, [sendTimestamp]);

  const handleStop = useCallback(() => {
    if (timestampIntervalRef.current) {
      clearInterval(timestampIntervalRef.current);
      timestampIntervalRef.current = null;
    }
  }, []);

  const handleSeeked = useCallback(() => {
    console.log("Video seeked event triggered");
    sendTimestamp();
  }, [sendTimestamp]);

  // 3. Update the effect to re-attach event listeners
  useEffect(() => {
    const video = videoRef.current; // Get the current value

    // --- Update this explicit check ---
    if (!video || roomState !== ConnectionState.Connected || !isVideoReadyForListeners) {
      console.log(`Effect check failed: Video element ${video ? 'exists' : 'missing'}, Room state: ${roomState}, Video ready: ${isVideoReadyForListeners}. Listeners not attached/cleaned.`);
      // Optional cleanup if needed
      return; // Exit early if conditions aren't met
    }
    // --- End of explicit check ---

    console.log("Effect running: Attaching video event listeners. Room state:", roomState, "Video ready:", isVideoReadyForListeners);

    // Define handlers locally or ensure they are stable via useCallback
    const onPlay = () => handlePlay();
    const onPause = () => handleStop();
    const onEnded = () => handleStop();
    const onSeeked = () => handleSeeked();
    const onTimeUpdate = () => sendTimestamp(); // This uses sendRef.current internally

    // Remove previous listeners
    video.removeEventListener("play", onPlay);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("ended", onEnded);
    video.removeEventListener("seeked", onSeeked);
    video.removeEventListener("timeupdate", onTimeUpdate);

    // Add new listeners
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onTimeUpdate);

    console.log("Effect complete: Video event listeners attached.");

    // Cleanup function
    return () => {
      console.log("Effect cleanup: Removing video event listeners for video:", video);
      if (video) {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("timeupdate", onTimeUpdate);
      } else {
        console.log("Effect cleanup: Video ref was null during setup, nothing to remove.");
      }

      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
        timestampIntervalRef.current = null;
        console.log("Effect cleanup: Cleared timestamp interval.");
      }
    };
    // Dependencies: Re-run when roomState changes, video readiness changes, or stable callbacks change.
  }, [roomState, isVideoReadyForListeners, handlePlay, handleStop, handleSeeked, sendTimestamp]); // Added isVideoReadyForListeners

  // Add an effect to log room state changes
  useEffect(() => {
    console.log("Room connection state:", roomState);
  }, [roomState]);

  // Add this hook to access voice assistant state and audio track
  const { state: assistantState, audioTrack: assistantAudioTrack } = useVoiceAssistant();

  // Add this state to track when the button was last pressed
  const [interruptPressed, setInterruptPressed] = useState(false);

  // Add this state to track animation
  const [animateInterrupt, setAnimateInterrupt] = useState(false);

  // Modify the handleInterruptAgent function
  const handleInterruptAgent = useCallback(() => {
    if (roomState !== ConnectionState.Connected || !send) {
      console.warn("Cannot interrupt agent: room not connected or send function unavailable");
      return;
    }

    try {
      const interruptMessage = {
        type: "interrupt",
        timestamp: Date.now()
      };

      const payload = new TextEncoder().encode(JSON.stringify(interruptMessage));

      send(payload, {
        topic: "agent-control",
        reliable: true
      });

      // Enhanced visual feedback
      setInterruptPressed(true);
      setAnimateInterrupt(true);

      // Reset states after animations complete
      setTimeout(() => setInterruptPressed(false), 400);
      setTimeout(() => setAnimateInterrupt(false), 600);

      console.log("Sent interrupt command to agent");
    } catch (error) {
      console.error("Failed to send interrupt command:", error);
    }
  }, [roomState, send]);

  // Add this effect after the component mounts
  useEffect(() => {
    if (!localParticipant || roomState !== ConnectionState.Connected) {
      return;
    }

    console.log("Registering player-control RPC method");

    // Register an RPC method for controlling the video player
    localParticipant.registerRpcMethod(
      'controlVideoPlayer',
      async (data: RpcInvocationData) => {
        try {
          console.log(`Received player control from agent: ${data.payload}`);

          // Parse the control command
          const command = JSON.parse(data.payload);

          if (command.action === 'pause' && videoRef.current) {
            // Pause the video
            videoRef.current.pause();
            setIsPlaying(false);
            console.log("Video paused via RPC");

            // You could add a notification here
            // setShowEngagementNotice(true);

            return JSON.stringify({ success: true, action: 'pause' });
          }
          else if (command.action === 'play' && videoRef.current) {
            // Resume playing
            videoRef.current.play();
            setIsPlaying(true);
            console.log("Video resumed via RPC");

            return JSON.stringify({ success: true, action: 'play' });
          }

          return JSON.stringify({ success: false, error: 'Invalid command' });
        } catch (error) {
          console.error('Error handling player control RPC:', error);
          return JSON.stringify({ success: false, error: String(error) });
        }
      }
    );

    // Clean up the RPC method when component unmounts
    return () => {
      try {
        localParticipant.unregisterRpcMethod('controlVideoPlayer');
        console.log("Unregistered player-control RPC method");
      } catch (error) {
        console.error("Error unregistering RPC method:", error);
      }
    };
  }, [localParticipant, roomState, videoRef]);

  // Add roomState as a dependency to the useEffect
  useEffect(() => {
    // Only set up if video exists and we're connected
    if (!videoRef.current || roomState !== ConnectionState.Connected) return;

    const video = videoRef.current;
    // Remove any existing listeners first (in case of re-attachment)
    video.removeEventListener("play", handlePlay);
    video.removeEventListener("pause", handleStop);
    video.removeEventListener("ended", handleStop);
    video.removeEventListener("seeked", handleSeeked);

    // Re-attach listeners
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handleStop);
    video.addEventListener("ended", handleStop);
    video.addEventListener("seeked", handleSeeked);

    // Cleanup
    return () => {
      // ... existing cleanup code ...
    };
  }, [videoRef, send, roomState]); // Add roomState as dependency

  // Replace the parchmentClass variable definition:
  const sectionClass = `
    relative
    bg-[#FAF7ED]/80
    border border-[#9C7C38]/30
    hover:border-[#9C7C38]/50
    transition-all duration-300
    rounded-lg
    overflow-hidden
    group
    p-4 my-4
  `;

  // Set up API authorization when authToken changes
  useEffect(() => {
    if (authToken) {
      // Set authorization header for API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      console.log('Authorization header set from authToken prop');
    } else {
      // Remove authorization header if no token
      delete api.defaults.headers.common['Authorization'];
    }
  }, [authToken]);

  return (
    <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
      {/* Hide header on mobile as before */}
      {!isMobile && (
        <div className="h-[0px] flex items-center px-4 relative">
          {logo}
          {/* Multi-layered border effect */}
          <div className="absolute bottom-0 left-0 right-0">
            {/* Primary glowing line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] 
            bg-gradient-to-r from-transparent via-[#9C7C38]/80 to-transparent 
            shadow-[0_0_10px_rgba(156,124,56,0.4)]
            animate-pulse"
            />

            {/* Secondary accent lines */}
            <div className="absolute bottom-[1px] left-1/4 right-1/4 h-[1px] 
            bg-gradient-to-r from-transparent via-[#9C7C38]/40 to-transparent
            shadow-[0_0_8px_rgba(156,124,56,0.3)]"
            />

            {/* Edge accents */}
            <div className="absolute bottom-0 left-0 w-8 h-[2px]
            bg-gradient-to-r from-[#9C7C38]/80 to-transparent
            shadow-[0_0_10px_rgba(156,124,56,0.4)]"
            />
            <div className="absolute bottom-0 right-0 w-8 h-[2px]
            bg-gradient-to-l from-[#9C7C38]/80 to-transparent
            shadow-[0_0_10px_rgba(156,124,56,0.4)]"
            />
          </div>
        </div>
      )}

      {/* Main container */}
      <div className={`flex-1 relative ${mobileLayoutClass}`}>
        {/* Main Content */}
        <div
          className={`
            ${!isMobile ? 'absolute inset-0' : 'w-full h-full flex flex-col'}
            ${!isMobile && !isRightPanelCollapsed ? 'right-[360px]' : 'right-0'}
            transition-all duration-300
          `}
        >
          <PanelGroup direction="vertical">
            {/* Video Panel - Adjust size for mobile */}
            <Panel
              defaultSize={isMobile ? 40 : 85}
              minSize={isMobile ? 30 : 60}
            >
              <div className="h-full w-full bg-black">
                <VideoPlayer
                  videoRef={videoRef}
                  videoUrl={videoUrl}
                  currentTime={currentTime}
                  setCurrentTime={setCurrentTime}
                  setDuration={setDuration}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                      // Optionally log the time updates here
                      // console.log("Video time updated:", videoRef.current.currentTime);
                    }
                  }}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  onVideoReady={setIsVideoReadyForListeners} // Pass the state setter function
                />
              </div>
            </Panel>

            {/* Chat/Transcript Panel for Mobile */}
            {isMobile && (
              <Panel defaultSize={60} minSize={30}>
                <div className="h-full flex flex-col bg-black/90">
                  {/* Chat content */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Voice Assistant Transcription */}
                    {voiceAssistant?.audioTrack && (
                      <div className="p-2">
                        <TranscriptionTile
                          agentAudioTrack={voiceAssistant.audioTrack}
                          accentColor="cyan"
                        />
                      </div>
                    )}

                    {/* Chat Messages */}
                    <div className="flex-1 p-2 space-y-1">
                      {transcripts.map((message) => (
                        <div
                          key={message.timestamp}
                          className={`
                            ${message.isSelf ? 'ml-auto bg-cyan-950/30' : 'mr-auto bg-gray-800/30'} 
                            max-w-[95%]
                            rounded-lg p-1.5
                            backdrop-blur-sm
                            border border-gray-700/50
                            transition-all duration-300
                            hover:border-cyan-500/30
                            group
                          `}
                        >
                          <div className="text-[11px] leading-relaxed text-gray-300">
                            {message.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {/* Desktop Transcript Panel */}
            {!isMobile && (
              <>
                <PanelResizeHandle className={resizeHandleStyles.horizontal}>
                  <div className="relative w-full h-2 group">
                    <div className="absolute left-1/2 -translate-x-1/2 w-8 h-0.5 
                      bg-gradient-to-r from-transparent via-[#9C7C38]/40 to-transparent 
                      group-hover:via-[#9C7C38]/60
                      shadow-[0_0_8px_rgba(156,124,56,0.3)]
                      transition-all duration-300"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[1px] overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute inset-0 w-1/3
                        bg-gradient-to-r from-transparent via-[#9C7C38]/40 to-transparent
                        animate-[scan_3s_ease-in-out_infinite]"
                      />
                    </div>
                  </div>
                </PanelResizeHandle>

                <Panel defaultSize={15} minSize={15} maxSize={40}>
                  {/* Apply map texture to the main panel container */}

                  <div className="h-full flex flex-col bg-[url('/textures/dark-parchment.png')] opacity-90 bg-cover bg-center relative rounded-md"> {/* <-- Updated background image */}
                    <div className="absolute inset-0 bg-[#B8A678]/70 mix-blend z-0"></div>

                    {/* Add an overlay for slight darkening/contrast if needed */}
                    {/* <div className="absolute inset-0 bg-black/10"></div> */}

                    {/* Keep controls on a slightly opaque background for better legibility */}
                    <div className="border-b border-gray-800/30 bg-black/20 backdrop-blend-color-dodge p-2 relative z-10 shadow-inner shadow-[#9C7C38]/90"> {/* <-- Ensured this background is present */}
                      <div className="flex items-center gap-4">
                        {/* Play/Pause Button */}
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) {
                                videoRef.current.pause();
                              } else {
                                videoRef.current.play();
                              }
                              setIsPlaying(!isPlaying);
                            }
                          }}
                          className="text-white hover:text-cyan-400 transition-colors"
                        >
                          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>

                        {/* Progress Bar Container */}
                        <PlaygroundProgressBar
                          currentTime={currentTime}
                          duration={duration}
                          videoRef={videoRef}
                          setCurrentTime={setCurrentTime}
                          isPlaying={isPlaying}
                          setIsPlaying={setIsPlaying}
                          engagementOpportunities={engagementOpportunities || []}
                          setActiveTab={setActiveTab}
                        />

                        {/* Time Display */}
                        <div className="flex items-center gap-2 text-[11px] text-black/90 font-medium tracking-wider">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                        {/* Volume Control */}
                        <div className="flex items-center gap-2 group relative">
                          <button
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.muted = !isMuted;
                                setIsMuted(!isMuted);
                              }
                            }}
                            className="text-white hover:text-[#1E2A42] transition-colors"
                          >
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                              const newVolume = parseFloat(e.target.value);
                              setVolume(newVolume);
                              if (videoRef.current) {
                                videoRef.current.volume = newVolume;
                              }
                            }}
                            className="w-0 group-hover:w-20 transition-all duration-300 accent-[#1E2A42]"
                          />
                        </div>

                        {/* Fullscreen Button */}
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.requestFullscreen();
                            }
                          }}
                          className="text-white hover:text-cyan-400 transition-colors"
                        >
                          <Maximize2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* This space now shows the map texture */}
                    <div className="flex-1 relative">
                      {/* Decorative border */}
                      <div className="absolute inset-0 border-2 border-green-700/30 pointer-events-none shadow-[inset_0_0_8px_rgba(20,83,45,0.05)]"></div>
                      <div className="absolute inset-0 border-2 border-green-800/20 m-2 pointer-events-none rounded shadow-[inset_0_0_5px_rgba(20,83,45,0.1)]"></div>
                      <div className="absolute top-1 left-1 right-1 h-[2px] bg-gradient-to-r from-transparent via-green-800/35 to-transparent"></div>
                      <div className="absolute bottom-1 left-1 right-1 h-[2px] bg-gradient-to-r from-transparent via-green-800/35 to-transparent"></div>
                      <div className="absolute left-1 top-1 bottom-1 w-[2px] bg-gradient-to-b from-transparent via-green-800/35 to-transparent"></div>
                      <div className="absolute right-1 top-1 bottom-1 w-[2px] bg-gradient-to-b from-transparent via-green-800/35 to-transparent"></div>

                      {/* Corner accents */}
                      <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-800/40"></div>
                      <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-green-800/40"></div>
                      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-green-800/40"></div>
                      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-800/40"></div>
                    </div>
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>

        {/* Right Panel - Desktop only */}
        {!isMobile && (
          <motion.div
            className={`
              ${isMobile && isLandscape
                ? 'w-[10%] h-[100dvh] border-l border-[#9C7C38]/30 touch-none'
                : 'absolute right-0 top-0 bottom-0 w-[360px] border-l border-[#9C7C38]/30'}
              bg-[#C99868]/20 backdrop-blur-sm
              z-30
              transition-transform duration-300 ease-in-out
              before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px]
              before:bg-gradient-to-b before:from-transparent before:via-[#9C7C38]/30 before:to-transparent
              before:shadow-[0_0_10px_rgba(156,124,56,0.2)]
              after:absolute after:inset-0 after:bg-[url('/textures/crumbled-parchment.jpg')] after:bg-cover after:opacity-15 after:mix-blend after:pointer-events-none
              ${isMobile ? 'overflow-hidden' : ''}
            `}
            initial={false}
            animate={{
              transform: (!isMobile && isRightPanelCollapsed) ? 'translateX(360px)' : 'translateX(0)'
            }}
          >
            {/* Hide collapse button on mobile */}
            {!isMobile && (
              <button
                onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
                className="absolute -left-8 top-1/2 transform -translate-y-1/2
                w-8 h-16 bg-[#F5EFE0]/90 backdrop-blur-sm
                rounded-l-lg flex items-center justify-center
                text-[#9C7C38] transition-all duration-300
                border-y border-l border-[#9C7C38]/30
                outline outline-1 outline-offset-[-3px] outline-[#9C7C38]/20
                hover:border-[#9C7C38]/40 hover:text-[#9C7C38]
                hover:shadow-[0_0_10px_rgba(156,124,56,0.1)]
                group
              "
              >
                <motion.div
                  animate={{ rotate: isRightPanelCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative z-10"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </motion.div>
              </button>
            )}
            {/* Panel Content - Force chat tab on mobile */}
            <div className={`
              ${isMobile ? 'h-[100dvh] touch-none' : 'h-full'} 
              pl-4 pr-0 overflow-hidden
              ${isMobile ? 'pl-2' : ''}
              rounded-lg border border-[#9C7C38]/50
            `}>
              <div className="h-full flex flex-col">
                {/* Only show tabs on desktop */}
                {!isMobile && (
                  <div className="flex items-center px-1 border-b border-gray-700/40 relative rounded-t-md">
                    {/* Add glowing border effect */}
                    <div className="absolute bottom-0 left-0 right-0">
                      <div className="absolute bottom-0 left-0 right-0 h-[1px]
                      bg-gradient-to-r from-transparent via-[#9C7C38]/30 to-transparent
                      shadow-[0_0_8px_rgba(156,124,56,0.2)]"
                      />
                    </div>
                    {tabs.map((tab) => (
                      <motion.button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ConfigTab)}
                        className={`
                        ${styles.tab.base}
                        ${activeTab === tab.id ? styles.tab.active : styles.tab.inactive}
                        text-sm px-2 py-2
                      `}
                      >
                        {tab.label}
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeTab"
                            className="
                            absolute bottom-0 left-0 right-0 h-[2px]
                            bg-gradient-to-r from-[#9C7C38]/70 via-[#9C7C38]/60 to-[#9C7C38]/40
                            shadow-[0_0_10px_rgba(156,124,56,0.3)]
                          "
                            initial={false}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30
                            }}
                          />
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Tab Content - Always show chat on mobile */}
                <div className={`
                  flex-1 
                  ${isMobile ? 'overflow-hidden p-1' : 'overflow-y-auto p-3'} 
                  space-y-4
                  relative
                  h-[calc(100vh-120px)] // Add this to ensure sufficient height
                `}>
                  {/* Info Tooltip */}
                  <div className={`
                    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                    transition-all duration-500
                    ${(isMobile || activeTab === 'chat') && isInfoVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
                  `}>
                    <div className={`
                      relative px-3 py-2
                      bg-[#F5EFE0]/95 backdrop-blur-sm
                      border border-[#9C7C38]/30
                      rounded-lg shadow-lg
                      text-[11px] text-[#0A1933]
                      shadow-[0_0_15px_rgba(156,124,56,0.1)]
                    `}>
                      <button
                        onClick={() => setIsInfoVisible(false)}
                        className="absolute -top-1.5 -right-1.5 p-1 rounded-full 
                          bg-[#9C7C38]/30 hover:bg-[#9C7C38]/40
                          text-[#0A1933] hover:text-[#0A1933]
                          border-2 border-[#F5EFE0]
                          shadow-[0_0_5px_rgba(156,124,56,0.3)]
                          transition-all duration-200"
                      >
                        <X size={12} />
                      </button>
                      Click the mic button to speak or type a message into the chat.
                    </div>
                  </div>

                  {/* Chat component - Always mounted but conditionally hidden */}
                  <div className={`
                    absolute inset-0
                    ${(isMobile || activeTab === 'chat') ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                  `}>
                    <div className="h-full flex flex-col">
                      {/* Sticky header - Simplified for mobile */}
                      <div className="sticky top-0 z-10 bg-[#F5EFE0]/40 backdrop-blur-sm border-b border-[#9C7C38]/10 rounded-t-xl">
                        <div className={`flex items-center justify-between ${isMobile ? 'p-1' : 'p-2'}`}>
                          {/* Brand icon - Hide text on mobile */}
                          <div className="flex items-center gap-2">
                            <BrdgeLogo src="/stamp-logo.png" alt="Brdge AI Logo" />
                            {!isMobile && (
                              <>
                                {/* Add BarVisualizer here */}
                                <div className="h-5 w-20 ml-1">
                                  <BarVisualizer
                                    trackRef={assistantAudioTrack}
                                    barCount={10}
                                    options={{
                                      minHeight: 15,
                                      maxHeight: 85
                                    }}
                                    style={{
                                      borderRadius: '4px',
                                      overflow: 'hidden',
                                      gap: '2px',
                                      padding: '2px',
                                    }}
                                  />
                                </div>

                                {/* Add Interrupt Button */}
                                <button
                                  onClick={handleInterruptAgent}
                                  className={`
                                    ml-2 p-1.5 rounded-md 
                                    ${interruptPressed
                                      ? 'bg-[#9C7C38]/30 text-[#9C7C38] shadow-[0_0_8px_rgba(156,124,56,0.3)]'
                                      : 'bg-[#9C7C38]/15 hover:bg-[#9C7C38]/25 text-[#1E2A42]'}
                                    ${animateInterrupt ? 'scale-105' : 'scale-100'}
                                    transition-all duration-200
                                    flex items-center gap-1.5 text-xs
                                    border ${interruptPressed ? 'border-[#9C7C38]/20' : 'border-[#9C7C38]/0'}
                                  `}
                                  aria-label="Interrupt agent"
                                >
                                  <Square size={12} className={`fill-current ${animateInterrupt ? 'animate-pulse' : ''}`} />
                                  <span>Stop</span>
                                </button>
                              </>
                            )}
                          </div>

                          {/* Info tooltip and Mic controls */}


                          {/* Mic toggle button - Simplified for mobile */}
                          <button
                            onClick={() => {
                              if (roomState === ConnectionState.Connected && localParticipant) {
                                localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                              }
                            }}
                            disabled={roomState !== ConnectionState.Connected}
                            className={`
                                ${isMobile ? 'p-1' : 'p-1.5'}
                                rounded-lg transition-all duration-300
                                flex items-center gap-1.5
                                bg-[#9C7C38]/20 text-[#1E2A42]
                                hover:bg-[#9C7C38]/30 hover:shadow-[0_0_10px_rgba(156,124,56,0.15)]
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${isInfoVisible ? 'animate-glow' : ''}
                              `}
                          >
                            {localParticipant?.isMicrophoneEnabled ?
                              <Mic size={isMobile ? 10 : 14} /> :
                              <MicOff size={isMobile ? 10 : 14} />
                            }
                            {!isMobile && (
                              <span className="text-[11px] font-medium">
                                {localParticipant?.isMicrophoneEnabled ? 'Mic: On' : 'Mic: Off'}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <button
                                className="p-1.5 rounded-lg transition-all duration-300
                                text-[#1E2A42]/50 hover:text-[#1E2A42]
                                hover:bg-[#9C7C38]/10"
                              >
                                <Info size={isMobile ? 12 : 14} />
                              </button>
                              <div className="absolute right-0 top-full mt-2 w-64 opacity-0 group-hover:opacity-100
                                pointer-events-none group-hover:pointer-events-auto
                                transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                                <div className="bg-[#F5EFE0]/95 backdrop-blur-sm rounded-lg p-3 shadow-xl
                                  border border-[#9C7C38]/20 text-[11px] leading-relaxed text-[#0A1933]">
                                  <div className="font-medium mb-1 text-[#9C7C38]">Welcome to Brdge AI!</div>
                                  Watch the video while interacting with our AI voice assistant.
                                  Toggle your mic to speak or type messages to engage in real-time conversation.
                                  <div className="font-medium mb-1 text-[#9C7C38]/70">
                                    Pro tip: Ensure your environment is quiet and free of background noise.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Scrollable chat content */}
                      <div className={`
                        flex-1 
                        ${isMobile ? 'overflow-hidden' : 'overflow-y-auto'}
                        ${isMobile ? 'touch-none' : ''}
                      `}>
                        {/* Voice Assistant Transcription */}
                        {voiceAssistant?.audioTrack && (
                          <div className={`${isMobile ? 'p-1' : 'p-2'}`}>
                            <TranscriptionTile
                              agentAudioTrack={voiceAssistant.audioTrack}
                              accentColor="cyan"
                            />
                          </div>
                        )}

                        {/* Chat Messages */}
                        <div className={`flex-1 ${isMobile ? 'p-1' : 'p-2'} space-y-1`}>
                          {transcripts.map((message) => (
                            <div
                              key={message.timestamp}
                              className={`
                                ${message.isSelf ? 'ml-auto bg-cyan-950/30' : 'mr-auto bg-gray-800/30'} 
                                ${isMobile ? 'max-w-[95%]' : 'max-w-[85%]'}
                                rounded-lg p-1.5
                                backdrop-blur-sm
                                border border-gray-700/50
                                transition-all duration-300
                                hover:border-cyan-500/30
                                group
                              `}
                            >
                              <div className={`
                                ${isMobile ? 'text-[9px]' : 'text-[11px]'}
                                leading-relaxed
                                ${message.isSelf ? 'text-cyan-300' : 'text-gray-300'}
                                group-hover:text-cyan-400/90
                                transition-colors duration-300
                              `}>
                                {message.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Only render AI Agent and Voice Clone tabs in edit mode */}
                  {!isMobile && params.agentType !== 'view' && (
                    <>
                      {activeTab === 'teaching-persona' && (
                        <div className="space-y-6 px-2">
                          <div className="flex items-center justify-between mb-3">
                            <h2 className={styles.header.main}>Teaching Persona</h2>
                            {/* Update the Save Changes button in Persona tab */}
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleSaveConfig}
                              className={`
                                flex items-center gap-1.5
                                px-3 py-1.5 rounded-lg
                                ${saveSuccess
                                  ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                  : 'bg-[#9C7C38]/20 text-[#9C7C38] hover:bg-[#9C7C38]/30 border-[#9C7C38]/30 hover:border-[#9C7C38]/40'}
                                border
                                shadow-sm hover:shadow
                                transition-all duration-200
                                text-[11px] font-medium
                              `}
                            >
                              <Save size={12} />
                              <span>Save Changes</span>
                            </motion.button>
                          </div>

                          {/* Basic Information Section - Update styling for better spacing */}
                          <section className={sectionClass}>
                            {/* Border effect */}
                            <div className="absolute inset-0 border border-[#9C7C38]/30 rounded-lg transition-all duration-300 group-hover:border-[#9C7C38]/50"></div>

                            {/* Section header */}
                            <div className="flex items-center mb-2 relative z-10">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#9C7C38]/40 shadow-[0_0_5px_rgba(156,124,56,0.3)] mr-1.5"></div>
                              <h3 className={styles.header.sub}>Instructor Profile</h3>
                              <div className="h-[1px] flex-1 ml-3 bg-gradient-to-r from-[#9C7C38]/20 via-[#9C7C38]/10 to-transparent"></div>
                            </div>

                            {/* Section content with consistent spacing */}
                            <div className="space-y-3 relative z-10">
                              {/* Name Field */}
                              <div className="relative z-10 group/field transition-all duration-300">
                                <label className="block mb-1 text-[10px] font-medium text-[#0A1933]/70">Name</label>
                                <input
                                  type="text"
                                  value={teachingPersona?.instructor_profile?.name || ''}
                                  onChange={(e) => updateTeachingPersona('instructor_profile.name', e.target.value)}
                                  className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                                  px-3 py-2 text-[12px] text-[#0A1933]
                                  transition-all duration-300
                                  focus:ring-1 focus:ring-[#9C7C38]/40 
                                  focus:border-[#9C7C38]/50
                                  hover:border-[#9C7C38]/40"
                                  placeholder="Enter instructor name..."
                                />
                              </div>

                              {/* Display extracted expertise level for context */}
                              <div className="p-2.5 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
                                <div className="flex items-center">
                                  <Info size={12} className="text-[#1E2A42]/50 mr-2" />
                                  <span className="text-[10px] text-[#0A1933]/70">Extracted Expertise Level</span>
                                </div>
                                <p className="mt-1 text-[11px] text-[#0A1933]">
                                  {teachingPersona?.instructor_profile?.apparent_expertise_level || 'No expertise level detected'}
                                </p>
                              </div>
                            </div>
                          </section>

                          {/* Communication Style Section */}
                          <section className={sectionClass}>
                            {/* Border effect */}
                            <div className="absolute inset-0 border border-[#9C7C38]/30 rounded-lg transition-all duration-300 group-hover:border-[#9C7C38]/50"></div>

                            {/* Section header */}
                            <div className="flex items-center mb-2 relative z-10">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#9C7C38]/40 shadow-[0_0_5px_rgba(156,124,56,0.3)] mr-1.5"></div>
                              <h3 className={styles.header.sub}>Communication Style</h3>
                            </div>

                            {/* Section content with consistent spacing */}
                            <div className="space-y-3 relative z-10">
                              {/* Communication Style Field */}
                              <div className="relative z-10 group/field transition-all duration-300">
                                <label className="block mb-1 text-[10px] font-medium text-[#0A1933]/70">Overall Style</label>
                                <input
                                  type="text"
                                  value={teachingPersona?.communication_patterns?.vocabulary_level || ''}
                                  onChange={(e) => updateTeachingPersona('communication_patterns.vocabulary_level', e.target.value)}
                                  className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                                  px-3 py-2 text-[12px] text-[#0A1933]
                                  transition-all duration-300
                                  focus:ring-1 focus:ring-[#9C7C38]/40 
                                  focus:border-[#9C7C38]/50
                                  hover:border-[#9C7C38]/40"
                                  placeholder="Professional, casual, technical, etc."
                                />

                                {/* Style Quick Selectors */}
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {["professional", "friendly", "technical", "casual", "authoritative"].map(style => (
                                    <button
                                      key={style}
                                      type="button"
                                      onClick={() => updateTeachingPersona('communication_patterns.vocabulary_level', style)}
                                      className={`
                                        px-2 py-0.5 rounded-full text-[9px]
                                        transition-all duration-300
                                        border 
                                        ${teachingPersona?.communication_patterns?.vocabulary_level === style
                                          ? 'bg-[#9C7C38]/20 text-[#9C7C38] border-[#9C7C38]/30'
                                          : 'bg-[#F5EFE0]/70 text-[#1E2A42] border-[#9C7C38]/20 hover:text-[#0A1933] hover:border-[#9C7C38]/30'
                                        }
                                      `}
                                    >
                                      {style}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Recurring Phrases */}
                              <div className="relative z-10 group/field transition-all duration-300">
                                <label className="block mb-1 text-[10px] font-medium text-[#0A1933]/70">Characteristic Phrases</label>
                                <textarea
                                  value={phrasesText}
                                  onChange={(e) => {
                                    // Just update the text state directly
                                    setPhrasesText(e.target.value);
                                  }}
                                  onBlur={() => {
                                    // Only when focus leaves the textarea, update the actual phrases
                                    const phrases = phrasesText
                                      .split('\n')
                                      .filter(line => line.trim() !== '')
                                      .map(phrase => ({
                                        phrase: phrase.trim(),
                                        frequency: "medium",
                                        usage_context: "General conversation"
                                      }));

                                    updateTeachingPersona('communication_patterns.recurring_phrases', phrases);
                                  }}
                                  className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                                  px-3 py-2 text-[12px] text-[#0A1933] min-h-[70px]
                                  transition-all duration-300
                                  focus:ring-1 focus:ring-[#9C7C38]/40 
                                  focus:border-[#9C7C38]/50
                                  hover:border-[#9C7C38]/40 resize-y"
                                  placeholder="Enter phrases the instructor frequently uses (one per line)..."
                                />
                                <div className="mt-0.5 text-[9px] text-[#1E2A42]/60 px-1 italic">
                                  These phrases will be used by the AI to sound more like the actual instructor
                                </div>
                              </div>

                              {/* REMOVED: Speaking Pace with Slider - as requested */}
                            </div>
                          </section>

                          {/* Display-Only Teaching Insights Section */}
                          <section className={sectionClass}>
                            {/* Border effect */}
                            <div className="absolute inset-0 border border-[#9C7C38]/30 rounded-lg transition-all duration-300 group-hover:border-[#9C7C38]/50"></div>

                            {/* Section header */}
                            <div className="flex items-center mb-2 relative z-10">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#9C7C38]/40 shadow-[0_0_5px_rgba(156,124,56,0.3)] mr-1.5"></div>
                              <h3 className={styles.header.sub}>Teaching Insights</h3>
                              <span className="ml-2 text-[9px] px-2 py-0.5 bg-[#9C7C38]/10 rounded-full text-[#0A1933]/80 font-medium">Auto-Extracted</span>
                            </div>

                            {/* Section content with consistent spacing */}
                            <div className="grid grid-cols-1 gap-2 relative z-10">
                              {/* Speech Characteristics Card */}
                              <div className="p-2.5 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
                                <div className="flex justify-between items-center">
                                  <h3 className="text-[12px] font-medium text-[#9C7C38]">Speech Style</h3>
                                </div>
                                <p className="mt-1 text-[11px] text-[#0A1933]/90">
                                  {teachingPersona?.speech_characteristics?.accent?.type || 'No accent detected'}
                                </p>
                                <p className="mt-1 text-[11px] text-[#0A1933]/90">
                                  Cadence: {teachingPersona?.speech_characteristics?.accent?.cadence || 'Not detected'}
                                </p>
                              </div>

                              {/* Pedagogical Approach Card */}
                              <div className="p-2.5 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
                                <div className="flex justify-between items-center">
                                  <h3 className="text-[12px] font-medium text-[#9C7C38]">Teaching Approach</h3>
                                </div>
                                <div className="mt-1 space-y-1">
                                  {teachingPersona?.pedagogical_approach?.explanation_techniques?.map((technique: any, idx: number) => (
                                    <div key={idx} className="flex items-start">
                                      <span className="text-[#9C7C38]/80 mt-1 text-[9px] mr-1">•</span>
                                      <p className="text-[11px] text-[#0A1933]/90">
                                        {technique.technique}: {technique.example}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Emotional Patterns Card */}
                              <div className="p-2.5 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
                                <div className="flex justify-between items-center">
                                  <h3 className="text-[12px] font-medium text-[#9C7C38]">Emotional Patterns</h3>
                                </div>
                                <p className="mt-1 text-[11px] text-[#0A1933]/90">
                                  Humor Style: {teachingPersona?.emotional_teaching_patterns?.humor_style?.type || 'None detected'}
                                </p>
                                {teachingPersona?.emotional_teaching_patterns?.enthusiasm_triggers?.map((trigger: any, idx: number) => (
                                  <div key={idx} className="mt-1">
                                    <p className="text-[11px] text-[#9C7C38]/80">
                                      {trigger.topic}:
                                    </p>
                                    <p className="text-[11px] text-[#0A1933]/90">
                                      {trigger.vocal_cues}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </section>
                        </div>
                      )}
                      {activeTab === 'voice-clone' && (
                        <div className={`
                          h-full pt-0 overflow-y-auto
                          ${activeTab === 'voice-clone' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                          transition-opacity duration-300
                        `}>
                          <div className="mb-3 border-b border-[#9C7C38]/30 pb-3">
                            <div className="flex items-center justify-between mb-1">
                              <h2 className={styles.header.main}>Voice Configuration</h2>
                              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-transparent via-[#9C7C38]/30 to-transparent" />
                            </div>

                            {/* Default voice and voice selector section */}
                            <div className="mb-6">
                              <VoiceSelector
                                voices={allVoices}
                                selectedVoice={selectedVoice}
                                selectedVoiceBrdgeId={selectedVoiceBrdgeId} // Add this prop
                                defaultVoiceId="default"
                                currentBrdgeId={params.brdgeId}
                                onSelectVoice={async (voiceId, fromBrdgeId) => {
                                  // Update the brdge's voice_id first - this is the only necessary step
                                  if (params.brdgeId && params.apiBaseUrl) {
                                    try {
                                      // If default voice is selected, set voice_id to null
                                      const voice_id = voiceId === "default" ? null : voiceId;

                                      // Log what we're about to do
                                      console.log(`Updating voice_id for brdge ${params.brdgeId} to:`, voice_id);

                                      // Update the brdge's voice_id in the database
                                      const updateResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/update-voice`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          ...(localStorage.getItem('token') ? {
                                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                                          } : {})
                                        },
                                        body: JSON.stringify({ voice_id }),
                                        credentials: 'omit'
                                      });

                                      // Log the full response for debugging
                                      const responseData = await updateResponse.json();
                                      console.log('Update voice response:', responseData);

                                      if (!updateResponse.ok) {
                                        console.error('Failed to update brdge voice_id:', updateResponse.status, updateResponse.statusText);
                                      } else {
                                        console.log('Successfully updated brdge voice_id to:', voice_id);

                                        // No need to call voice/activate, just update UI state directly
                                        if (voiceId === "default") {
                                          // If default voice selected, update local state
                                          setSavedVoices(prev => prev.map(v => ({
                                            ...v,
                                            status: 'inactive'
                                          })));
                                          setSelectedVoice("default");
                                          setSelectedVoiceBrdgeId(null);
                                        } else {
                                          // If custom voice selected, update UI state to show it as selected
                                          setSelectedVoice(voiceId);
                                          setSelectedVoiceBrdgeId(fromBrdgeId as string);

                                          // Update the "status" field in the savedVoices array to show the correct one as active
                                          // This is just UI state, not affecting the backend
                                          setSavedVoices(prev => prev.map(v => ({
                                            ...v,
                                            status: v.id === voiceId ? 'active' : 'inactive'
                                          })));
                                        }

                                        // Refresh the brdge data after updating voice_id
                                        const brdgeResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}`);
                                        if (brdgeResponse.ok) {
                                          const brdgeData = await brdgeResponse.json();
                                          console.log('Refreshed brdge data:', brdgeData);
                                          console.log('Brdge voice_id after update:', brdgeData.voice_id);
                                          setBrdge(brdgeData);
                                        }

                                        // Refresh the voice list to update UI
                                        if (params.brdgeId) {
                                          const voicesResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`);
                                          if (voicesResponse.ok) {
                                            const voicesData = await voicesResponse.json();
                                            if (voicesData.voices) {
                                              setSavedVoices(voicesData.voices);
                                            }
                                          }
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error updating brdge voice_id:', error);
                                    }
                                  }
                                }}
                                isLoading={isLoadingUserVoices}
                              />
                            </div>

                            {/* Voice information card */}
                            <div className="bg-[#F5EFE0]/80 backdrop-blur-sm rounded-lg p-4 border border-[#9C7C38]/20 mb-6">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[#0A1933] text-[13px] font-medium">Current Voice</h3>
                                <div className={`px-2 py-0.5 rounded-md border text-[10px]
                                  ${selectedVoice === "default" || !selectedVoice
                                    ? "bg-[#9C7C38]/10 border-[#9C7C38]/20 text-[#9C7C38]"
                                    : selectedVoiceBrdgeId === params.brdgeId
                                      ? "bg-[#9C7C38]/10 border-[#9C7C38]/20 text-[#9C7C38]"
                                      : "bg-[#B89F63]/10 border-[#B89F63]/20 text-[#B89F63]"
                                  }`}
                                >
                                  {selectedVoice === "default" || !selectedVoice
                                    ? "Default"
                                    : selectedVoiceBrdgeId === params.brdgeId
                                      ? "Custom"
                                      : "From Other Project"
                                  }
                                </div>
                              </div>

                              {selectedVoice === "default" || !selectedVoice ? (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Volume2 size={14} className="text-[#9C7C38]" />
                                    <span className="text-[13px] text-[#0A1933]">Default AI Voice</span>
                                  </div>
                                  <p className="text-[#1E2A42] text-[12px] leading-relaxed">
                                    Using the standard AI voice for this brdge. This voice is designed to be clear and natural sounding.
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Radio size={14} className={selectedVoiceBrdgeId === params.brdgeId ? "text-[#9C7C38]" : "text-[#B89F63]"} />
                                    <span className="text-[13px] text-[#0A1933]">
                                      {allVoices.find(v => v.id === selectedVoice)?.name || 'Custom Voice'}
                                    </span>
                                  </div>
                                  {selectedVoiceBrdgeId !== params.brdgeId && (
                                    <div className="bg-[#B89F63]/5 border border-[#B89F63]/10 rounded-md px-2 py-1 mb-2 text-[11px] text-[#0A1933]/80">
                                      From: {allVoices.find(v => v.id === selectedVoice)?.brdge_name || 'Another Project'}
                                    </div>
                                  )}
                                  <p className="text-[#1E2A42] text-[12px] leading-relaxed">
                                    Using {selectedVoiceBrdgeId === params.brdgeId ? 'your' : 'a'} custom voice clone. This personalized voice will be used when the AI speaks.
                                  </p>
                                  <div className="text-[10px] text-[#1E2A42]/60 mt-2">
                                    Created: {allVoices.find(v => v.id === selectedVoice)?.created_at
                                      ? new Date(allVoices.find(v => v.id === selectedVoice)!.created_at).toLocaleDateString()
                                      : 'Unknown'}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Create New Voice / Custom Voices section */}
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-[13px] font-medium text-[#0A1933]">Custom Voices</h3>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setIsCreatingVoice(true)}
                                className={`
                                  group flex items-center gap-1.5
                                  px-3 py-1.5 rounded-lg
                                  bg-gradient-to-r from-[#9C7C38]/10 to-transparent
                                  text-[#9C7C38] border border-[#9C7C38]/20
                                  transition-all duration-300
                                  hover:border-[#9C7C38]/40
                                  hover:shadow-[0_0_15px_rgba(156,124,56,0.1)]
                                  ${isCreatingVoice ? 'opacity-50 pointer-events-none' : ''}
                                `}
                              >
                                <Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" />
                                <span className="text-[11px] font-satoshi">Create New Voice</span>
                              </motion.button>
                            </div>

                            {isCreatingVoice ? (
                              // Voice Creation Section - Using existing recording UI with better styling
                              <div className="space-y-4 bg-[#F5EFE0]/70 rounded-lg p-4 border border-[#9C7C38]/20">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-[13px] text-[#0A1933] font-medium">Create Voice Clone</h4>
                                  <button
                                    onClick={() => setIsCreatingVoice(false)}
                                    className="p-1 rounded hover:bg-[#F5EFE0] text-[#1E2A42] hover:text-[#0A1933]"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                <div className="space-y-3">
                                  <h5 className="text-[12px] text-[#9C7C38]">Record a short sample of your voice:</h5>
                                  <ul className="space-y-2">
                                    {[
                                      'Record 10-20 seconds of clear speech',
                                      'Speak naturally at your normal pace',
                                      'Avoid background noise and echoes'
                                    ].map((text, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-[#9C7C38] mt-1 text-[10px]">•</span>
                                        <span className="font-satoshi text-[12px] text-[#1E2A42]">{text}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="bg-[#F5EFE0]/90 rounded-lg p-3 border border-[#9C7C38]/20">
                                  <h5 className="text-[12px] text-[#0A1933]/90 mb-2">Sample text to read:</h5>
                                  <p className="text-[12px] text-[#1E2A42] leading-relaxed italic">
                                    &ldquo;In just a few quick steps my voice based AI assistant will be integrated into my content.
                                    This way you can speak to others without being there... how cool is that?&rdquo;
                                  </p>
                                </div>

                                <div className="space-y-3 pt-2">
                                  <input
                                    type="text"
                                    value={voiceName}
                                    onChange={(e) => setVoiceName(e.target.value)}
                                    placeholder="Enter voice name"
                                    className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                                    px-3 py-2.5 text-[13px] text-[#0A1933]
                                    transition-all duration-300
                                    focus:ring-1 focus:ring-[#9C7C38]/40 
                                    focus:border-[#9C7C38]/50
                                    hover:border-[#9C7C38]/40"
                                  />

                                  <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`
                                      w-full px-4 py-2.5 rounded-lg text-[13px] font-medium
                                      transition-all duration-300
                                      flex items-center justify-center gap-2
                                      ${isRecording
                                        ? 'bg-red-500/20 text-red-600 hover:bg-red-500/30'
                                        : 'bg-[#9C7C38]/20 text-[#9C7C38] hover:bg-[#9C7C38]/30'
                                      }
                                      shadow-[0_0_15px_rgba(156,124,56,0.1)]
                                      hover:shadow-[0_0_20px_rgba(156,124,56,0.15)]
                                    `}
                                  >
                                    <span className={`
                                      w-1.5 h-1.5 rounded-full 
                                      ${isRecording
                                        ? 'bg-red-500 animate-[pulse_1s_ease-in-out_infinite]'
                                        : 'bg-cyan-500'
                                      }
                                    `} />
                                    {isRecording ? (
                                      <>Recording... {formatTime(recordingTime)}</>
                                    ) : (
                                      'Start Recording'
                                    )}
                                  </button>
                                </div>

                                {/* Recording Preview */}
                                {currentRecording && (
                                  <div className="space-y-2">
                                    <div className="bg-[#F5EFE0]/80 rounded-lg p-2 border border-[#9C7C38]/20">
                                      <audio
                                        src={URL.createObjectURL(currentRecording)}
                                        controls
                                        className="w-full h-8"
                                      />
                                    </div>
                                    <button
                                      onClick={handleCloneVoice}
                                      disabled={!voiceName || isCloning}
                                      className={`
                                        w-full px-4 py-2.5 rounded-lg text-[13px] font-medium
                                        transition-all duration-300
                                        transform hover:-translate-y-0.5
                                        bg-[#9C7C38]/20 text-[#9C7C38] 
                                        hover:bg-[#9C7C38]/30 
                                        shadow-[0_0_15px_rgba(156,124,56,0.1)]
                                        hover:shadow-[0_0_20px_rgba(156,124,56,0.15)]
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        disabled:hover:transform-none
                                      `}
                                    >
                                      {isCloning ? (
                                        <div className="flex items-center justify-center gap-2">
                                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                          Creating Voice Clone...
                                        </div>
                                      ) : (
                                        'Create Voice Clone'
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Voice List Section - show as cards with better UI
                              <div className="space-y-2">
                                {savedVoices.length === 0 ? (
                                  <div className="text-center py-10 px-4 bg-[#F5EFE0]/60 rounded-lg border border-[#9C7C38]/30">
                                    <div className="mb-3 opacity-50">
                                      <Volume2 size={24} className="mx-auto text-[#1E2A42]/50" />
                                    </div>
                                    <div className="text-[#0A1933] text-[13px]">No custom voices yet</div>
                                    <div className="mt-1 text-[12px] text-[#1E2A42]/70">
                                      Create a custom voice to make your AI sound more like you
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 gap-3">
                                    {savedVoices.map((voice) => (
                                      <motion.div
                                        key={voice.id}
                                        layout
                                        className={`
                                          relative p-4 rounded-lg
                                          transition-all duration-300
                                          ${selectedVoice === voice.id
                                            ? 'bg-[#9C7C38]/10 border border-[#9C7C38]/30 shadow-[0_0_15px_rgba(156,124,56,0.07)]'
                                            : 'bg-[#F5EFE0]/70 border border-[#9C7C38]/20'}
                                          hover:border-[#9C7C38]/40
                                          group cursor-pointer
                                        `}
                                        onClick={() => {
                                          // Simply select this voice when clicked - no separate activate button needed
                                          if (selectedVoice !== voice.id) {
                                            // Same logic as in the VoiceSelector's onSelectVoice handler
                                            setSelectedVoice(voice.id);
                                            setSelectedVoiceBrdgeId(params.brdgeId);

                                            // Save the voice ID to the brdge via API call
                                            if (params.brdgeId && params.apiBaseUrl) {
                                              // Call the endpoint to update the brdge's voice_id
                                              fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/update-voice`, {
                                                method: 'POST',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  ...(localStorage.getItem('token') ? {
                                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                                  } : {})
                                                },
                                                body: JSON.stringify({ voice_id: voice.id }),
                                                credentials: 'omit'
                                              })
                                                .then(response => {
                                                  if (!response.ok) {
                                                    console.error('Failed to update brdge voice_id:', response.status, response.statusText);
                                                    throw new Error('Failed to update voice');
                                                  }

                                                  // After successfully updating voice in database, update local state
                                                  // No need to call activate, just update UI directly
                                                  setSavedVoices(prev => prev.map(v => ({
                                                    ...v,
                                                    status: v.id === voice.id ? 'active' : 'inactive'
                                                  })));
                                                  console.log('Successfully updated voice selection');

                                                  // Refresh voice list
                                                  return fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`);
                                                })
                                                .then(response => {
                                                  if (response && response.ok) {
                                                    return response.json();
                                                  }
                                                })
                                                .then(data => {
                                                  if (data && data.voices) {
                                                    setSavedVoices(data.voices);
                                                  }
                                                })
                                                .catch(error => console.error('Error updating brdge voice:', error));
                                            }
                                          }
                                        }}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`
                                            p-2.5 rounded-full 
                                            ${selectedVoice === voice.id
                                              ? 'bg-[#9C7C38]/20 text-[#9C7C38]'
                                              : 'bg-[#F5EFE0] text-[#1E2A42]/50'}
                                            transition-all duration-300
                                          `}>
                                            <Volume2 size={14} />
                                          </div>

                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <h4 className={`
                                                text-[14px] truncate
                                                ${selectedVoice === voice.id ? 'text-[#9C7C38]' : 'text-[#0A1933]'}
                                              `}>
                                                {voice.name}
                                              </h4>
                                              {selectedVoice === voice.id && (
                                                <span className="text-[10px] text-[#9C7C38] bg-[#9C7C38]/10 px-1.5 py-0.5 rounded">
                                                  Active
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-[11px] text-[#1E2A42]/60 mt-0.5">
                                              Created {new Date(voice.created_at).toLocaleDateString()}
                                            </p>
                                          </div>
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {activeTab === 'share' && (
                        <div className={`
                          h-full pt-0 overflow-y-auto
                          ${activeTab === 'share' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                          transition-opacity duration-300
                        `}>
                          <div className="flex items-center justify-between mb-1">
                            <h2 className={styles.header.main}>Sharing Configuration</h2>
                          </div>

                          <div className="mb-6 pb-12 border-b border-[#9C7C38]/30">
                            {/* Public/Private Toggle Section */}
                            <section className={sectionClass}>
                              {/* Background and border effects */}
                              <div className="absolute inset-0 border border-[#9C7C38]/30 rounded-lg transition-all duration-300 group-hover:border-[#9C7C38]/50 group-hover:shadow-[0_0_15px_rgba(156,124,56,0.05)]"></div>
                              <div className="absolute inset-0 bg-gradient-to-b from-[#9C7C38]/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-lg"></div>

                              {/* Section Header */}
                              <div className="flex items-center mb-2 relative z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#9C7C38]/70 shadow-[0_0_5px_rgba(156,124,56,0.5)] mr-1.5"></div>
                                <h2 className={styles.header.sub}>Public Access</h2>
                                <div className="h-[1px] flex-1 ml-2 mr-1 bg-gradient-to-r from-transparent via-[#9C7C38]/20 to-transparent"></div>
                              </div>

                              {/* Toggle control */}
                              <div className="flex items-center justify-between p-4 bg-[#F5EFE0]/80 backdrop-blur-sm rounded-lg border border-[#9C7C38]/30 hover:border-[#9C7C38]/50 transition-all duration-300 relative z-10">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    {brdge?.shareable ? (
                                      <>
                                        <Globe size={18} className="text-[#9C7C38] filter drop-shadow-[0_0_8px_rgba(156,124,56,0.4)]" />
                                        <h3 className="text-[14px] font-medium text-[#9C7C38]">Public</h3>
                                      </>
                                    ) : (
                                      <>
                                        <Lock size={18} className="text-[#1E2A42]" />
                                        <h3 className="text-[14px] font-medium text-[#1E2A42]">Private</h3>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-[12px] text-[#0A1933]/70 mt-1">
                                    {brdge?.shareable
                                      ? "Anyone with the link can view this bridge"
                                      : "Only you can view this bridge"}
                                  </p>
                                </div>

                                <div className="flex items-center">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={brdge?.shareable || false}
                                      onChange={toggleShareable}
                                      className="sr-only peer"
                                    />
                                    <div className={`
                                      w-11 h-6 rounded-full
                                      after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                      after:bg-white after:rounded-full after:h-5 after:w-5
                                      after:transition-all peer-checked:after:translate-x-full
                                      ${brdge?.shareable
                                        ? 'bg-[#9C7C38]/30 border-[#9C7C38]/50 after:shadow-[0_0_8px_rgba(156,124,56,0.4)]'
                                        : 'bg-[#F5EFE0] border-[#9C7C38]/20'}
                                    border transition-all duration-300
                                  `}></div>
                                  </label>
                                </div>
                              </div>
                            </section>

                            {/* Share Link Section */}
                            <section className={`${sectionClass} mt-6`}>
                              {/* Background and border effects */}
                              <div className="absolute inset-0 border border-[#9C7C38]/30 rounded-lg transition-all duration-300 group-hover:border-[#9C7C38]/50 group-hover:shadow-[0_0_15px_rgba(156,124,56,0.05)]"></div>
                              <div className="absolute inset-0 bg-gradient-to-b from-[#9C7C38]/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-lg"></div>

                              {/* Section Header */}
                              <div className="flex items-center mb-2 relative z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#9C7C38]/70 shadow-[0_0_5px_rgba(156,124,56,0.5)] mr-1.5"></div>
                                <h2 className={styles.header.sub}>Share Link</h2>
                                <div className="h-[1px] flex-1 ml-2 mr-1 bg-gradient-to-r from-transparent via-[#9C7C38]/20 to-transparent"></div>
                              </div>

                              {/* Link display and copy button */}
                              <div className={`
                                relative p-4 bg-[#F5EFE0]/80 backdrop-blur-sm rounded-lg
                                border transition-all duration-300 z-10
                                ${brdge?.shareable
                                  ? 'border-[#9C7C38]/30 hover:border-[#9C7C38]/50 hover:shadow-[0_0_15px_rgba(156,124,56,0.1)]'
                                  : 'border-[#9C7C38]/20 opacity-50'}
                              `}>
                                {brdge?.shareable ? (
                                  <div className="flex flex-col space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Link size={15} className="text-[#9C7C38]" />
                                        <span className="text-[13px] text-[#0A1933]">Shareable Link</span>
                                      </div>
                                      <a
                                        href={shareableLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[11px] text-[#9C7C38] hover:text-[#B89F63] transition-colors"
                                      >
                                        <span>Open</span>
                                        <ExternalLink size={11} />
                                      </a>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 px-3 py-2 bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg text-[13px] text-[#0A1933] truncate">
                                        {shareableLink}
                                      </div>
                                      <button
                                        onClick={copyLinkToClipboard}
                                        className={`
                                          p-2 rounded-lg transition-all duration-300
                                          ${isCopied
                                            ? 'bg-green-500/10 text-green-600'
                                            : 'bg-[#9C7C38]/10 text-[#9C7C38] hover:bg-[#9C7C38]/20'}
                                        `}
                                      >
                                        {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                      </button>
                                    </div>

                                    <div className="text-[11px] text-[#1E2A42]/70">
                                      {isCopied ? (
                                        <span className="text-green-600">✓ Link copied to clipboard!</span>
                                      ) : (
                                        "Share this link with anyone you want to give access to your bridge"
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-4">
                                    <Lock size={24} className="text-[#1E2A42]/50 mb-2" />
                                    <p className="text-[13px] text-[#0A1933]/70 text-center">
                                      Enable public access to get a shareable link
                                    </p>
                                  </div>
                                )}
                              </div>
                            </section>

                            {/* Privacy Information */}
                            <section className={`${sectionClass} mt-6`}>
                              <div className="flex items-start gap-2">
                                <Info size={14} className="text-[#1E2A42]/70 mt-0.5" />
                                <div>
                                  <h4 className="text-[12px] font-medium text-[#0A1933] mb-1">Privacy Information</h4>
                                  <p className="text-[11px] text-[#1E2A42]/80 leading-relaxed">
                                    When shared publicly, anyone with the link can view and interact with your bridge.
                                    You can disable public access at any time by toggling the switch above.
                                  </p>
                                </div>
                              </div>
                            </section>
                          </div>
                        </div>
                      )}
                      {/* Add this new section for the Engagement tab */}
                      {!isMobile && isEditMode && (
                        <>
                          {activeTab === 'engagement' && (
                            <div className="space-y-6 px-2">
                              <div className="flex items-center justify-between mb-4">
                                <h2 className={styles.header.main}>Engagement Opportunities</h2>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={handleAddEngagement}
                                  className="px-2 py-1 bg-[#9C7C38]/20 text-[#9C7C38] hover:bg-[#9C7C38]/30 
                                    rounded-lg text-[10px] flex items-center gap-1.5 font-medium
                                    border border-[#9C7C38]/30 hover:border-[#9C7C38]/40
                                    shadow-sm hover:shadow
                                    transition-all duration-200"
                                >
                                  <Plus size={10} />
                                  Add New
                                </motion.button>
                              </div>

                              {/* Filter controls with improved spacing */}
                              <div className="flex flex-wrap gap-2 mb-5 px-1">
                                <button
                                  className={`px-3 py-1 text-xs rounded-full transition-all duration-300 ${!selectedEngagement ? 'bg-[#9C7C38]/20 text-[#9C7C38]' : 'bg-[#F5EFE0]/70 text-[#1E2A42] hover:bg-[#F5EFE0]'}`}
                                  onClick={() => setSelectedEngagement(null)}
                                >
                                  All Types
                                </button>
                                <button
                                  className={`px-3 py-1 text-xs rounded-full flex items-center gap-1 transition-all duration-300 ${selectedEngagement === 'quiz' ? 'bg-[#9C7C38]/20 text-[#9C7C38]' : 'bg-[#F5EFE0]/70 text-[#1E2A42] hover:bg-[#F5EFE0]'}`}
                                  onClick={() => setSelectedEngagement(selectedEngagement === 'quiz' ? null : 'quiz')}
                                >
                                  {getEngagementTypeIcon('quiz')}
                                  Quizzes
                                </button>
                                <button
                                  className={`px-3 py-1 text-xs rounded-full flex items-center gap-1 transition-all duration-300 ${selectedEngagement === 'discussion' ? 'bg-[#9C7C38]/20 text-[#9C7C38]' : 'bg-[#F5EFE0]/70 text-[#1E2A42] hover:bg-[#F5EFE0]'}`}
                                  onClick={() => setSelectedEngagement(selectedEngagement === 'discussion' ? null : 'discussion')}
                                >
                                  {getEngagementTypeIcon('discussion')}
                                  Discussions
                                </button>
                              </div>

                              {/* Debug output for troubleshooting */}
                              {(!engagementOpportunities || engagementOpportunities.length === 0) && (
                                <div className="bg-[#F5EFE0]/40 mb-4 p-2 rounded-lg text-xs text-[#1E2A42]">
                                  Debug: Agent config has engagement_opportunities? {agentConfig.engagement_opportunities ? 'Yes' : 'No'}
                                </div>
                              )}

                              {/* Engagement list with improved container spacing */}
                              <div className="space-y-4 px-1">
                                {engagementOpportunities && engagementOpportunities.length > 0 ? (
                                  engagementOpportunities
                                    .filter(engagement => !selectedEngagement || engagement.engagement_type === selectedEngagement)
                                    .map((engagement, index) => (
                                      <EngagementCard
                                        key={engagement.id || index}
                                        engagement={engagement}
                                        onEdit={handleUpdateEngagement}
                                        onDelete={handleDeleteEngagement}
                                      />
                                    ))
                                ) : (
                                  <div className="text-center p-6 bg-[#F5EFE0]/60 rounded-lg border border-[#9C7C38]/30">
                                    <div className="text-[#0A1933] text-sm">No engagement opportunities found</div>
                                    <div className="text-[#1E2A42] text-xs mt-1">
                                      Create new engagement opportunities using the "Add New" button above
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {isMobile && <MobileFAB />}
    </div >
  );
}
