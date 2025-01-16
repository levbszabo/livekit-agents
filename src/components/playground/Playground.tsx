"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ChatMessageType } from "@/components/chat/ChatTile";
import { ColorPicker } from "@/components/colorPicker/ColorPicker";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { NameValueRow } from "@/components/config/NameValueRow";
import { useConfig } from "@/hooks/useConfig";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
  BarVisualizer,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRoomInfo,
  useVoiceAssistant,
  useChat,
} from "@livekit/components-react";
import { ConnectionState, LocalParticipant, Track, DataPacket_Kind } from "livekit-client";
import { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import tailwindTheme from "../../lib/tailwindTheme.preval";
import { InfoPanel } from "./InfoPanel";
import { API_BASE_URL } from '@/config';
import { api } from '@/api';
import { SlideScriptPanel } from './SlideScriptPanel';
import { jwtDecode } from "jwt-decode";
import Image from 'next/image';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from 'react-resizable-panels';
import { useRouter } from 'next/router';
import { WalkthroughSelector, WalkthroughSelectorRef } from './WalkthroughSelector';
import { TimeAlignedTranscript } from '@/components/transcript/TimeAlignedTranscript';
import { Plus, FileText, X, Edit2, Save, ChevronDown, ChevronUp, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
}

const headerHeight = 56;

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
  active: boolean;
}

type MobileTab = 'chat' | 'script' | 'voice' | 'info';
type ConfigTab = 'ai-agent' | 'voice-clone';

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
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

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
      text-cyan-400/90
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
};

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

// First, let's define a proper interface for our agent config
interface AgentConfig {
  personality: string;
  knowledgeBase: Array<{
    id: string;
    type: string;
    name: string;
    content: string;
  }>;
}

// Add new interfaces for knowledge management
interface KnowledgeBubbleProps {
  entry: AgentConfig['knowledgeBase'][0];
  onEdit: (id: string, content: string, name?: string) => void;
  onRemove: (id: string) => void;
}

// Add this new component for knowledge bubbles
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

      {/* Playhead indicator */}
      <motion.div
        className="absolute top-0 left-1/2 w-px h-full bg-cyan-500/50"
        initial={false}
        animate={{
          boxShadow: currentTime > 0 ? '0 0 10px rgba(34,211,238,0.3)' : 'none',
          opacity: currentTime > 0 ? 1 : 0
        }}
        style={{ transform: 'translateX(-50%)' }}
      />
    </div>
  );
};

// Update the VideoPlayer component
const VideoPlayer = ({
  videoRef,
  videoUrl,
  currentTime,
  setCurrentTime,
  onTimeUpdate,
  setDuration,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl: string | null;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  onTimeUpdate: () => void;
  setDuration: (duration: number) => void;
}) => {
  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl || ''}
        className="absolute inset-0 w-full h-full object-cover"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setDuration(videoRef.current.duration);
          }
        }}
      />
    </div>
  );
};

export default function Playground({
  logo,
  themeColors,
  onConnect,
}: PlaygroundProps) {
  const isMobile = useIsMobile();
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [isCreatingVoice, setIsCreatingVoice] = useState(false);
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);

  // Existing state
  const [params, setParams] = useState({
    brdgeId: null as string | null,
    apiBaseUrl: null as string | null,
    coreApiUrl: API_BASE_URL,
    userId: null as string | null
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
      if (!params.brdgeId) return;
      try {
        const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`);
        if (!response.ok) throw new Error('Failed to fetch voices');

        const data = await response.json();
        if (data.voices) {
          setSavedVoices(data.voices);
          // Auto-select first voice if available and none selected
          if (data.voices.length > 0 && !selectedVoice) {
            setSelectedVoice(data.voices[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading voices:', error);
      }
    };

    loadVoices();
  }, [params.brdgeId, params.apiBaseUrl, selectedVoice]);

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
      const token = urlParams.get('token');
      const newParams = {
        brdgeId: urlParams.get('brdgeId'),
        apiBaseUrl: urlParams.get('apiBaseUrl'),
        coreApiUrl: API_BASE_URL,
        userId: token ?
          jwtDecode<JWTPayload>(token).sub :
          `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      setParams(newParams);
    }
  }, []);

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
  const [transcript, setTranscript] = useState<{
    content: { transcript: string; segments: any[] };
    status: string;
    metadata: any;
  } | null>(null);
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
    knowledgeBase: [
      { id: "presentation", type: "presentation", name: "", content: "" }
    ]
  });

  // Update the useEffect that fetches agent config
  useEffect(() => {
    const fetchAgentConfig = async () => {
      if (!params.brdgeId || !params.apiBaseUrl) return;

      try {
        console.log('Fetching agent config...');
        const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`);

        if (!response.ok) throw new Error('Failed to fetch agent config');

        const data = await response.json();
        console.log('Received agent config:', data);

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
      const response = await fetch(
        `${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`,
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

  // Add these state variables where other states are defined
  const [brdge, setBrdge] = useState<Brdge | null>(null);
  const [isLoadingBrdge, setIsLoadingBrdge] = useState(false);

  // Add this useEffect to fetch the brdge data
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

        const response = await fetch(url);
        console.log('Response status:', response.status);

        if (!response.ok) throw new Error('Failed to fetch brdge');

        const data = await response.json();
        console.log('Fetched brdge data:', data); // Let's see exactly what we get
        setBrdge(data);
      } catch (error) {
        console.error('Error fetching brdge:', error);
      } finally {
        setIsLoadingBrdge(false);
      }
    };

    fetchBrdge();
  }, [params.brdgeId, params.apiBaseUrl]);

  useEffect(() => {
    console.log('Current params:', params);
  }, [params]);

  // Handler for editing knowledge entries
  const handleKnowledgeEdit = useCallback((id: string, content: string, name?: string) => {
    setAgentConfig(prev => ({
      ...prev,
      knowledgeBase: prev.knowledgeBase.map(entry =>
        entry.id === id
          ? { ...entry, content, ...(name && { name }) }
          : entry
      )
    }));

    // Update the backend
    updateAgentConfig({
      ...agentConfig,
      knowledgeBase: agentConfig.knowledgeBase.map(entry =>
        entry.id === id
          ? { ...entry, content, ...(name && { name }) }
          : entry
      )
    });
  }, [agentConfig, updateAgentConfig]);

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
  const [activeTab, setActiveTab] = useState<ConfigTab>('ai-agent');

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

  // Add these helper functions before the return statement
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
    if (!currentRecording || !voiceName || !params.brdgeId) return;
    setIsCloning(true);
    try {
      const formData = new FormData();
      formData.append('audio', currentRecording);
      formData.append('name', voiceName);

      const response = await api.post(`/brdges/${params.brdgeId}/voice/clone`, formData);

      // Refresh voice list
      const voicesResponse = await api.get(`/brdges/${params.brdgeId}/voices`);
      if (voicesResponse.data?.voices) {
        setSavedVoices(voicesResponse.data.voices);
        if (response.data?.voice?.id) {
          setSelectedVoice(response.data.voice.id);
          setIsCreatingVoice(false);
        }
      }

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
    if (savedVoices.length === 1) {
      // If there's only one voice, make it active
      const voice = savedVoices[0];
      if (!voice.active) {
        api.post(`/brdges/${params.brdgeId}/voices/${voice.id}/activate`)
          .then(() => {
            setSavedVoices([{ ...voice, active: true }]);
          })
          .catch(error => console.error('Error activating single voice:', error));
      }
    } else if (savedVoices.length > 1 && !savedVoices.some(v => v.active)) {
      // If there are multiple voices and none are active, activate the most recent one
      const mostRecent = savedVoices.reduce((prev, current) => {
        return new Date(current.created_at) > new Date(prev.created_at) ? current : prev;
      }, savedVoices[0]);

      api.post(`/brdges/${params.brdgeId}/voices/${mostRecent.id}/activate`)
        .then(() => {
          setSavedVoices(prev => prev.map(v => ({
            ...v,
            active: v.id === mostRecent.id
          })));
        })
        .catch(error => console.error('Error activating most recent voice:', error));
    }
  }, [savedVoices, params.brdgeId]);

  // Update tabs array
  const tabs = [
    { id: 'ai-agent', label: 'AI Agent' },
    { id: 'voice-clone', label: 'Voice Clone' }
  ];

  return (
    <div className="h-screen flex flex-col bg-[#121212] relative overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className={`
          flex-1 transition-all duration-300
          ${!isMobile ? (isRightPanelCollapsed ? 'mr-0' : 'mr-[400px]') : 'mr-0'}
        `}>
          <PanelGroup direction="vertical">
            {/* Video Panel */}
            <Panel defaultSize={75} minSize={60}>
              <div className="h-full w-full flex flex-col bg-black">
                <div className="flex-1 relative">
                  {/* Video container that maintains full size regardless of panel state */}
                  <div className="absolute inset-0">
                    <VideoPlayer
                      videoRef={videoRef}
                      videoUrl={videoUrl}
                      currentTime={currentTime}
                      setCurrentTime={setCurrentTime}
                      onTimeUpdate={() => {
                        if (videoRef.current) {
                          setCurrentTime(videoRef.current.currentTime);
                        }
                      }}
                      setDuration={setDuration}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles.horizontal}>
              <div className="w-8 h-0.5 bg-gray-700 group-hover:bg-cyan-500 transition-colors duration-150" />
            </PanelResizeHandle>

            {/* Timeline and Chat Panel */}
            <Panel defaultSize={25} minSize={20} maxSize={40}>
              <div className="h-full flex flex-col bg-black/90">
                {/* Unified Control Bar */}
                <div className="border-b border-gray-800 bg-black/90 p-2">
                  <div className="flex items-center gap-4">
                    {/* Play/Pause */}
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

                    {/* Progress Bar */}
                    <div className="flex-1">
                      <div
                        ref={progressBarRef}
                        className="relative w-full h-1 bg-gray-800/50 rounded-full cursor-pointer group"
                        onClick={(e) => {
                          if (!progressBarRef.current || !videoRef.current) return;
                          const rect = progressBarRef.current.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = x / rect.width;
                          const newTime = percentage * duration;
                          videoRef.current.currentTime = newTime;
                          setCurrentTime(newTime);
                        }}
                      >
                        <div
                          className="absolute top-0 left-0 h-full bg-cyan-500 rounded-full"
                          style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                        <div className="
                          absolute top-1/2 -translate-y-1/2
                          w-2.5 h-2.5 bg-cyan-400 rounded-full
                          opacity-0 group-hover:opacity-100
                          transition-all duration-300
                          shadow-[0_0_10px_rgba(34,211,238,0.5)]
                        " style={{ left: `${(currentTime / duration) * 100}%` }} />
                      </div>
                    </div>

                    {/* Time Display */}
                    <div className="text-xs text-white/80 min-w-[80px] text-center">
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
                        className="text-white hover:text-cyan-400 transition-colors"
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
                        className="
                          w-0 group-hover:w-20
                          transition-all duration-300
                          accent-cyan-500
                        "
                      />
                    </div>

                    {/* Connect Button */}
                    <button
                      onClick={() => {
                        if (roomState === ConnectionState.Connected) {
                          onConnect(false);
                        } else {
                          onConnect(true);
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-colors text-xs
                        ${roomState === ConnectionState.Connected
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                        }`}
                    >
                      {roomState === ConnectionState.Connected ? 'Disconnect' : 'Connect'}
                    </button>

                    {/* Mic Toggle */}
                    <button
                      onClick={() => {
                        if (roomState === ConnectionState.Connected) {
                          localParticipant?.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                        }
                      }}
                      disabled={roomState !== ConnectionState.Connected}
                      className={`p-1.5 rounded-lg transition-colors
                        ${localParticipant?.isMicrophoneEnabled
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-gray-800 text-gray-400'
                        }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    </button>

                    {/* Fullscreen Toggle */}
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

                {/* Transcript Timeline */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Time Ruler */}
                  <div className="h-4 border-b border-gray-800 flex items-end px-2 bg-black/90">
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

                  {/* TimeAlignedTranscript */}
                  <div className="flex-1 overflow-y-auto bg-black/90">
                    <TimeAlignedTranscript
                      segments={transcript?.content?.segments || []}
                      currentTime={currentTime}
                      onTimeClick={(time) => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = time;
                          videoRef.current.play();
                          setIsPlaying(true);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Chat messages */}
                <div className="h-20 overflow-y-auto p-2 border-t border-gray-800 bg-black/90">
                  {voiceAssistant?.audioTrack && (
                    <TranscriptionTile
                      agentAudioTrack={voiceAssistant.audioTrack}
                      accentColor="cyan"
                    />
                  )}
                  {transcripts.map((message) => (
                    <div
                      key={message.timestamp}
                      className={`
                        ${message.isSelf ? 'ml-auto bg-cyan-950/30' : 'mr-auto bg-gray-800/30'} 
                        max-w-[70%] rounded-xl p-2
                        backdrop-blur-sm
                        border border-gray-700/50
                        transition-all duration-300
                        hover:border-cyan-500/30
                        mb-1.5
                      `}
                    >
                      <div className={`text-[10px] ${message.isSelf ? 'text-cyan-300' : 'text-gray-300'}`}>
                        {message.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Right Panel - Configuration */}
        {!isMobile && (
          <motion.div
            className={`
              fixed right-0 top-[48px] bottom-0 w-[400px] 
              bg-gray-900/50 backdrop-blur-md
              border-l border-gray-800
              z-30
              transition-transform duration-300 ease-in-out
            `}
            initial={false}
            animate={{
              transform: isRightPanelCollapsed ? 'translateX(400px)' : 'translateX(0)'
            }}
          >
            {/* Collapse Toggle Button */}
            <button
              onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
              className="absolute -left-8 top-1/2 transform -translate-y-1/2
                w-8 h-16 
                bg-gray-900/80 backdrop-blur-sm
                rounded-l-lg 
                flex items-center justify-center
                text-gray-400 
                transition-all duration-300
                border-t border-b border-l border-gray-800/50
                hover:border-cyan-500/30
                hover:text-cyan-400
                hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]
                group
              "
            >
              <motion.div
                animate={{ rotate: isRightPanelCollapsed ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </motion.div>
            </button>

            {/* Panel Content */}
            <div className="h-full p-4 overflow-y-auto space-y-6">
              {/* Agent Configuration Section */}
              <div className="h-full flex flex-col">
                {/* Tabs */}
                <div className="flex items-center px-2 border-b border-gray-800/50">
                  {tabs.map((tab) => (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as ConfigTab)}
                      className={`
                        ${styles.tab.base}
                        ${activeTab === tab.id ? styles.tab.active : styles.tab.inactive}
                      `}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="
                            absolute bottom-0 left-0 right-0 h-[2px]
                            bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500/50
                            shadow-[0_0_10px_rgba(34,211,238,0.3)]
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

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {activeTab === 'ai-agent' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className={styles.section.title}>AI Agent Configuration</h2>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => updateAgentConfig(agentConfig)}
                          className={`
                            group flex items-center gap-1.5
                            px-3 py-1.5 rounded-lg
                            bg-gradient-to-r from-cyan-500/10 to-transparent
                            text-cyan-400 border border-cyan-500/20
                            transition-all duration-300
                            hover:border-cyan-500/40
                            hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]
                          `}
                        >
                          <Save size={12} className="group-hover:rotate-12 transition-transform duration-300" />
                          <span className="text-[11px]">Save Changes</span>
                        </motion.button>
                      </div>

                      {/* Agent Personality Section */}
                      <section className={styles.section.wrapper}>
                        <h2 className={styles.section.title}>Agent Personality</h2>
                        <div className="
                          relative group
                          before:absolute before:inset-0
                          before:bg-gradient-to-r before:from-cyan-500/[0.02] before:to-transparent
                          before:opacity-0 before:transition-opacity before:duration-300
                          hover:before:opacity-100
                        ">
                          <textarea
                            value={agentConfig.personality}
                            onChange={(e) => setAgentConfig({
                              ...agentConfig,
                              personality: e.target.value
                            })}
                            placeholder="Describe the agent's personality and behavior..."
                            className={`${styles.input.base} ${styles.input.textarea}`}
                          />
                        </div>
                      </section>

                      {/* Knowledge Base Section */}
                      <section className={styles.section.wrapper}>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className={styles.section.title}>Knowledge Base</h2>
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
                              setAgentConfig(prev => ({
                                ...prev,
                                knowledgeBase: [...prev.knowledgeBase, newEntry]
                              }));
                            }}
                            className="
                              relative z-20
                              group flex items-center gap-1.5
                              px-3 py-1.5 rounded-lg text-[11px]
                              bg-gradient-to-r from-cyan-500/10 to-transparent
                              text-cyan-400/90 border border-cyan-500/20
                              transition-all duration-300
                              hover:border-cyan-500/40
                              hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]
                            "
                          >
                            <Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" />
                            <span>Add Knowledge</span>
                          </motion.button>
                        </div>

                        {/* Core Presentation */}
                        <motion.div
                          layout
                          className="
                            relative group
                            bg-[#1E1E1E]/50 backdrop-blur-sm
                            border border-gray-800/50 rounded-lg p-3
                            transition-all duration-300
                            hover:border-cyan-500/30
                            hover:shadow-[0_0_20px_rgba(34,211,238,0.07)]
                            before:absolute before:inset-0
                            before:bg-gradient-to-r before:from-cyan-500/[0.02] before:to-transparent
                            before:opacity-0 before:transition-opacity before:duration-300
                            hover:before:opacity-100
                          "
                        >
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText size={12} className="text-cyan-400 group-hover:animate-pulse" />
                              <span className="text-[12px] text-gray-300 group-hover:text-cyan-400/90 transition-colors duration-300">
                                {agentConfig.knowledgeBase[0]?.name || "No presentation file"}
                              </span>
                            </div>
                            <span className="
                              text-[10px] text-gray-600/70 
                              px-2 py-0.5 
                              bg-black/20 rounded-md
                              border border-gray-800/50
                              group-hover:border-cyan-500/20
                              transition-all duration-300
                            ">
                              PDF
                            </span>
                          </div>
                        </motion.div>

                        {/* Supplementary Knowledge */}
                        <div className="mt-4 space-y-3">
                          <h3 className="
                            font-satoshi text-[11px] text-gray-400/70
                            flex items-center gap-2
                            before:content-[''] before:w-1 before:h-1 before:rounded-full
                            before:bg-cyan-400/30
                          ">
                            Supplementary Knowledge
                          </h3>
                          <motion.div layout className="grid grid-cols-1 gap-2">
                            <AnimatePresence>
                              {agentConfig.knowledgeBase
                                .filter(entry => entry.type !== "presentation")
                                .map((entry) => (
                                  <KnowledgeBubble
                                    key={entry.id}
                                    entry={entry}
                                    onEdit={handleKnowledgeEdit}
                                    onRemove={handleKnowledgeRemove}
                                  />
                                ))}
                            </AnimatePresence>
                          </motion.div>
                        </div>
                      </section>
                    </>
                  )}

                  {activeTab === 'voice-clone' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className={styles.section.title}>Voice Clone Configuration</h2>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedVoice(null);
                            setIsCreatingVoice(true);
                          }}
                          className={`
                            group flex items-center gap-1.5
                            px-3 py-1.5 rounded-lg
                            bg-gradient-to-r from-cyan-500/10 to-transparent
                            text-cyan-400 border border-cyan-500/20
                              transition-all duration-300
                            hover:border-cyan-500/40
                            hover:shadow-[0_0_15px_rgba(34,211,238,0.1)]
                          `}
                        >
                          <Plus size={12} className="group-hover:rotate-90 transition-transform duration-300" />
                          <span className="text-[11px]">Create New Voice</span>
                        </motion.button>
                      </div>

                      {(!savedVoices.length || isCreatingVoice) ? (
                        // Voice Creation Section
                        <div className="space-y-4">
                          {/* Voice Setup Section */}
                          <section className={styles.section.wrapper}>
                            <h2 className={styles.section.title}>Voice Setup</h2>
                            <div className="
                              relative group space-y-4
                              before:absolute before:inset-0
                              before:bg-gradient-to-r before:from-cyan-500/[0.02] before:to-transparent
                              before:opacity-0 before:transition-opacity before:duration-300
                              hover:before:opacity-100
                            ">
                              {/* Recording Instructions */}
                              <div className="space-y-3">
                                <h3 className="font-satoshi text-[12px] text-gray-300/90">
                                  Create an AI voice clone with a short voice sample:
                                </h3>
                                <ul className="space-y-2">
                                  {[
                                    'Record 10-20 seconds of clear speech',
                                    'Speak naturally at your normal pace',
                                    'Avoid background noise and echoes'
                                  ].map((text, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-cyan-400/80 mt-1.5 text-[10px]">•</span>
                                      <span className="font-satoshi text-[13px] text-gray-400/80">{text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Sample Text Section */}
                              <div className="space-y-2">
                                <h3 className="font-satoshi text-[12px] text-gray-300/90">
                                  Sample Text to Read:
                                </h3>
                                <div className={`
                                  ${styles.knowledgeBase.content}
                                  min-h-0
                                  text-[11px]
                                  bg-black/20
                                  border border-gray-800/50
                                  group-hover:border-cyan-500/20
                            transition-all duration-300
                                `}>
                                  "In just a few quick steps my voice based AI assistant will be integrated into my content, how cool is that? This way you can speak to others without being there... how cool is that?"
                                </div>
                              </div>

                              {/* Voice Recording Controls */}
                              <div className="space-y-3 pt-2 relative z-[60]">
                                <input
                                  type="text"
                                  value={voiceName}
                                  onChange={(e) => setVoiceName(e.target.value)}
                                  placeholder="Enter voice name"
                                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg
                                px-3 py-2 text-xs text-gray-300
                                    transition-all duration-300
                                focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                                hover:border-cyan-500/50
                                    hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]
                                    relative z-[60]"
                                />

                                <button
                                  onClick={isRecording ? stopRecording : startRecording}
                                  className={`
                                    relative z-[60]
                                    w-full px-4 py-2 rounded-lg text-xs font-medium
                                    transition-all duration-300
                                    flex items-center justify-center gap-2
                                    ${isRecording
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                      : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                    }
                                    shadow-[0_0_15px_rgba(0,255,255,0.1)]
                                    hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]
                                    transform hover:-translate-y-0.5
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
                                <div className="space-y-2 relative z-[60]">
                                  <div className="bg-gray-800/30 rounded-lg p-2">
                                    <audio
                                      src={URL.createObjectURL(currentRecording)}
                                      controls
                                      className="w-full h-7"
                                    />
                                  </div>
                                  <button
                                    onClick={handleCloneVoice}
                                    disabled={!voiceName || isCloning}
                                    className={`
                                      relative z-[60]
                                      w-full px-4 py-2 rounded-lg text-xs font-medium
                                  transition-all duration-300
                                      transform hover:-translate-y-0.5
                                      bg-cyan-500/20 text-cyan-400 
                                  hover:bg-cyan-500/30 
                                      shadow-[0_0_15px_rgba(0,255,255,0.1)]
                                      hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]
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
                          </section>
                        </div>
                      ) : (
                        // Voice List Section
                        <div className="space-y-4">
                          <section className={styles.section.wrapper}>
                            <h2 className={styles.section.title}>Voice Selection</h2>
                            <div className="space-y-3 relative z-[100]">
                              {savedVoices.map((voice) => (
                                <motion.div
                                  key={voice.id}
                                  layout
                                  className={`
                                    relative group z-[100]
                                    bg-[#1E1E1E]/50 backdrop-blur-sm
                                    border border-gray-800/50 rounded-lg p-3
                                    transition-all duration-300
                                    hover:border-cyan-500/30
                                    hover:shadow-[0_0_20px_rgba(34,211,238,0.07)]
                                    cursor-pointer
                                    ${voice.active ? 'border-cyan-500/30 bg-cyan-500/5' : ''}
                                  `}
                                  onClick={async () => {
                                    try {
                                      if (!voice.active) {
                                        // Activate this voice
                                        const response = await api.post(`/brdges/${params.brdgeId}/voice/activate`, {
                                          voice_id: voice.id
                                        });
                                        if (response.data?.voice) {
                                          setSavedVoices(prev => prev.map(v => ({
                                            ...v,
                                            active: v.id === voice.id
                                          })));
                                        }
                                      } else {
                                        // Deactivate this voice
                                        const response = await api.post(`/brdges/${params.brdgeId}/voice/deactivate`, {
                                          voice_id: voice.id
                                        });
                                        if (response.data?.voice) {
                                          setSavedVoices(prev => prev.map(v => ({
                                            ...v,
                                            active: v.id === voice.id ? false : v.active
                                          })));
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error toggling voice:', error);
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between relative z-[100]">
                                    <div className="flex items-center gap-2">
                                      <div className={`
                                        w-2.5 h-2.5 rounded-full
                                        ${voice.active ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-gray-600'}
                                        transition-all duration-300
                                        group-hover:scale-110
                                      `} />
                                      <span className="text-[13px] text-gray-300 group-hover:text-cyan-400/90 transition-colors duration-300">
                                        {voice.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`
                                        text-[10px] px-2 py-0.5 rounded-md
                                        transition-all duration-300
                                        ${voice.active ? `
                                          text-cyan-400/70
                                          bg-cyan-500/10
                                          border border-cyan-500/20
                                          shadow-[0_0_10px_rgba(34,211,238,0.1)]
                                        ` : `
                                          text-gray-500
                                          bg-gray-800/50
                                          border border-gray-700/30
                                          opacity-0 group-hover:opacity-100
                                        `}
                                      `}>
                                        {voice.active ? 'Active' : 'Click to Toggle'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className={`
                                    mt-2 text-[11px] text-gray-500
                                    transition-all duration-300
                                    ${voice.active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                  `}>
                                    Created {new Date(voice.created_at).toLocaleDateString()}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </section>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
