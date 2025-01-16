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
type ConfigTab = 'content' | 'voice' | 'workflow';

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

const componentStyles = {
  button: `
    relative overflow-hidden
    px-6 py-3 rounded-xl font-medium
    transition-all duration-300 ease-out
    hover:scale-[1.02] active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
    bg-gradient-to-r from-cyan-500 to-cyan-600
    hover:from-cyan-400 hover:to-cyan-500
    text-white shadow-lg shadow-cyan-500/20
    hover:shadow-xl hover:shadow-cyan-500/30
    disabled:hover:scale-100 disabled:hover:shadow-lg
    transform hover:-translate-y-0.5
  `,
  tabButton: `
    flex-1 px-4 py-3 text-sm font-medium
    transition-all duration-300 ease-out
    hover:bg-gray-800/50
    border border-transparent
    hover:border-cyan-500/30
    hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]
  `,
  activeTab: `
    bg-gradient-to-r from-cyan-500/20 to-cyan-400/20
    border-b-2 border-cyan-500
    text-cyan-400
    shadow-[0_0_10px_rgba(0,255,255,0.2)]
  `,
  chatBubble: `
    max-w-[70%] rounded-2xl p-3
    backdrop-blur-sm shadow-lg
    animate-[fadeIn_0.3s_ease-out]
    bg-gray-900/50
    border border-gray-800/50
    hover:border-cyan-500/20
    transition-all duration-300
  `,
  input: `
    w-full bg-gray-900/50 backdrop-blur-sm
    border border-gray-700 rounded-xl
    px-4 py-3 text-gray-300
    transition-all duration-300
    focus:ring-2 focus:ring-cyan-500 focus:border-transparent
    hover:border-cyan-500/50
    hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]
  `,
  scrollArea: `
    scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent
    hover:scrollbar-thumb-gray-600
    scroll-smooth
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
            <Panel defaultSize={70}>
              <div className="h-full w-full overflow-hidden bg-black">
                <video
                  src={videoUrl || ''}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay={false}
                  playsInline
                />
              </div>
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles.horizontal}>
              <div className="w-8 h-0.5 bg-gray-700 group-hover:bg-cyan-500 transition-colors duration-150" />
            </PanelResizeHandle>

            {/* Chat Panel */}
            <Panel defaultSize={30}>
              <div className="h-full flex flex-col bg-gray-900/50 backdrop-blur-md">
                {/* Chat controls */}
                <div className="border-b border-gray-800 p-2">
                  <div className="flex items-center gap-3">
                    {/* LiveKit connection button */}
                    <button
                      onClick={() => {
                        if (roomState === ConnectionState.Connected) {
                          onConnect(false);
                        } else {
                          onConnect(true);
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors
                            ${roomState === ConnectionState.Connected
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                        }`}
                    >
                      {roomState === ConnectionState.Connected ? 'Disconnect' : 'Connect'}
                    </button>

                    {/* Mic toggle */}
                    <button
                      onClick={() => {
                        if (roomState === ConnectionState.Connected) {
                          localParticipant?.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                        }
                      }}
                      disabled={roomState !== ConnectionState.Connected}
                      className={`p-2 rounded-lg transition-colors
                        ${localParticipant?.isMicrophoneEnabled
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-gray-800 text-gray-400'
                        }`}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Chat messages and transcription */}
                <div className="flex-1 overflow-y-auto p-4">
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
                        max-w-[70%] rounded-2xl p-4 
                        backdrop-blur-sm
                        border border-gray-700/50
                        transition-all duration-300
                        hover:border-cyan-500/30
                        mb-4
                      `}
                    >
                      <div className={`text-sm ${message.isSelf ? 'text-cyan-300' : 'text-gray-300'}`}>
                        {message.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Right Panel - Voice Configuration */}
        {!isMobile && (
          <div className={`
            fixed right-0 top-[48px] bottom-0 w-[400px] 
            transition-all duration-300 ease-in-out
            transform ${isRightPanelCollapsed ? 'translate-x-[400px]' : 'translate-x-0'}
            bg-gray-900/50 backdrop-blur-md
            border-l border-gray-800
            z-30
          `}>
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
              <div className={`
                transform transition-transform duration-300
                ${isRightPanelCollapsed ? 'rotate-180' : ''}
              `}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Panel Content */}
            <div className="h-full p-4 overflow-y-auto space-y-4">
              {/* Transcript Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Transcript</h3>
                  <div className="text-xs text-gray-500">
                    {transcript?.status === 'completed' ? 'Completed' :
                      transcript?.status === 'pending' ? 'Processing...' :
                        transcript?.status === 'failed' ? 'Failed' : 'Loading...'}
                  </div>
                </div>

                {isLoadingTranscript ? (
                  <div className="flex items-center justify-center h-20 text-gray-400">
                    <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
                  </div>
                ) : transcript?.content?.transcript ? (
                  <div className="relative">
                    <textarea
                      value={transcript.content.transcript}
                      readOnly
                      className="w-full h-[400px] bg-gray-800/50 border border-gray-700 rounded-lg
                        px-3 py-2 text-sm text-gray-300
                        focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                        hover:border-cyan-500/50
                        transition-all duration-300
                        resize-none
                      "
                    />
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No transcript available
                  </div>
                )}
              </div>

              {/* Voice Configuration Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Voice Setup</h3>
                  <button
                    onClick={() => setIsCreatingVoice(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Create New Voice
                  </button>
                </div>

                {/* Voice Selection */}
                {savedVoices.length > 0 && (
                  <select
                    value={selectedVoice || ''}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg
                            px-3 py-2 text-xs text-gray-300
                            transition-all duration-300
                            focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                      hover:border-cyan-500/50"
                  >
                    <option value="">Select a voice...</option>
                    {savedVoices.map(voice => (
                      <option key={voice.id} value={voice.id}>{voice.name}</option>
                    ))}
                  </select>
                )}

                {/* Voice Creation Form */}
                {isCreatingVoice && (
                  <div className="space-y-3">
                    {/* ... existing voice creation form ... */}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
