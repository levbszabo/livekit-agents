"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessageType } from "@/components/chat/ChatTile";
// If we need to extend the ChatMessageType for errors, we can define it here:
interface ExtendedChatMessageType extends ChatMessageType {
    isError?: boolean;
}
import {
    useConnectionState,
    useLocalParticipant,
    useVoiceAssistant,
    useChat,
    useDataChannel
} from "@livekit/components-react";
import { ConnectionState, DataPacket_Kind } from "livekit-client";
import { ReactNode } from "react";
import { API_BASE_URL } from '@/config';
import { api } from '@/api';
import { jwtDecode } from "jwt-decode";
import { MobileVideoPlayer } from './mobile/MobileVideoPlayer';
import { MobileProgressBar } from './mobile/MobileProgressBar';
import { MobileChatTile } from './mobile/MobileChatTile';
import { MessageSquare, ClipboardList, User, Radio, Share2 } from 'lucide-react';

// Our EngagementOpportunity interface definition
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

export interface EngagementOpportunity {
    id: string;
    rationale: string;
    timestamp: string;
    quiz_items: EngagementQuizItem[];
    section_id: string;
    engagement_type: 'quiz' | 'discussion';
    concepts_addressed: string[];
}

// Keep these interfaces as they are essential
export interface PlaygroundProps {
    logo?: ReactNode;
    themeColors: string[];
    onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
    agentType?: 'edit' | 'view';
    userId?: string;
    brdgeId?: string | null;
    authToken?: string | null;
}

// Define an interface for the data channel to avoid TypeScript errors
interface DataChannelWithEvents {
    on: (event: string, callback: (message: any) => void) => void;
    off: (event: string, callback: (message: any) => void) => void;
}

export default function PlaygroundMobile({
    logo,
    themeColors,
    onConnect,
    agentType,
    userId,
    brdgeId,
    authToken
}: PlaygroundProps) {
    // Copy essential state variables
    const [params, setParams] = useState({
        brdgeId: null as string | null,
        apiBaseUrl: null as string | null,
        coreApiUrl: API_BASE_URL,
        userId: null as string | null,
        agentType: 'edit' as 'edit' | 'view'
    });

    // Add roomName state 
    const [roomName, setRoomName] = useState<string | null>(null);

    // Copy video-related state
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isVideoReadyForListeners, setIsVideoReadyForListeners] = useState(false);

    // Chat state
    const [transcripts, setTranscripts] = useState<ExtendedChatMessageType[]>([]);

    // LiveKit integrations
    const { localParticipant } = useLocalParticipant();
    const voiceAssistant = useVoiceAssistant();
    const roomState = useConnectionState();
    const chat = useChat();
    const dataChannel = useDataChannel();

    // Add engagementOpportunities state
    const [engagementOpportunities, setEngagementOpportunities] = useState<EngagementOpportunity[]>([]);

    // Add MobileTab state for navigation
    const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'engagement' | 'teaching-persona' | 'voice-clone' | 'share'>('chat');

    // Track if we've already connected to avoid multiple connection attempts
    const hasConnected = useRef(false);

    // Add component mount state tracking
    const isMounted = useRef(false);

    // URL params handling
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token') || authToken;

            const newParams = {
                brdgeId: urlParams.get('brdgeId') || brdgeId || null,
                apiBaseUrl: urlParams.get('apiBaseUrl'),
                coreApiUrl: API_BASE_URL,
                userId: token ?
                    jwtDecode<{ sub: string }>(token).sub :
                    userId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                agentType: (urlParams.get('agentType') as 'edit' | 'view') || agentType || 'edit'
            };

            setParams(newParams);
        }
    }, [authToken, brdgeId, userId, agentType]);

    // Video URL fetching
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

    // Update the fetchEngagementOpportunities function to use agent-config endpoint
    const fetchEngagementOpportunities = useCallback(async () => {
        if (!params.brdgeId || !params.apiBaseUrl) return;

        try {
            console.log('Fetching agent config...');
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`);
            if (!response.ok) {
                console.warn('Failed to fetch agent config');
                return;
            }

            const data = await response.json();
            console.log('Received agent config:', data);

            if (data.engagement_opportunities) {
                console.log('Setting engagement opportunities from agent config:', data.engagement_opportunities);
                console.log('Number of opportunities:', data.engagement_opportunities.length);
                setEngagementOpportunities(data.engagement_opportunities);
            } else {
                console.log('No engagement opportunities found in agent config');
                setEngagementOpportunities([]);
            }
        } catch (error) {
            console.error('Error fetching agent config:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl]);

    // Call it when params change
    useEffect(() => {
        fetchEngagementOpportunities();
    }, [fetchEngagementOpportunities]);

    // Define the onDataReceived callback using useCallback
    const onDataReceived = useCallback((msg: any) => {
        try {
            if (!msg.payload) {
                console.warn("Received empty message payload");
                return;
            }

            const decodedText = new TextDecoder().decode(msg.payload);
            if (!decodedText) {
                console.warn("Empty decoded text from message payload");
                return;
            }

            let decoded;
            try {
                decoded = JSON.parse(decodedText);
            } catch (e) {
                console.error("Failed to parse message JSON:", e);
                return;
            }

            console.log("Received message:", msg.topic, decoded);

            if (msg.topic === "transcription") {
                const timestamp = decoded.timestamp > 0 ? decoded.timestamp : Date.now();

                setTranscripts(prev => [...prev, {
                    name: "You",
                    message: decoded.text,
                    timestamp: timestamp,
                    isSelf: true,
                } as ExtendedChatMessageType]);
            } else if (msg.topic === "chat") {
                setTranscripts(prev => [...prev, {
                    name: "Assistant",
                    message: decoded.message || decoded.text || "No message content", // Handle different message formats
                    timestamp: Date.now(),
                    isSelf: false,
                } as ExtendedChatMessageType]);
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    }, []);

    // Use the dataChannel hook directly with the callback
    useDataChannel(onDataReceived);

    // Chat message handling
    const handleChatMessage = async (message: string) => {
        if (!chat) {
            console.warn("Chat functionality not available");
            return;
        }

        if (!message.trim()) {
            console.warn("Attempted to send empty message");
            return;
        }

        const newMessage: ExtendedChatMessageType = {
            name: "You",
            message,
            isSelf: true,
            timestamp: Date.now(),
        };

        setTranscripts(prev => [...prev, newMessage]);

        try {
            await chat.send(message);
            console.log("Chat message sent:", message);
        } catch (error) {
            console.error("Error sending chat message:", error);

            // Now using ExtendedChatMessageType for error messages
            setTranscripts(prev => [...prev, {
                name: "System",
                message: "Failed to send message. Please try again.",
                isSelf: false,
                timestamp: Date.now(),
                isError: true,
            } as ExtendedChatMessageType]);
        }
    };

    // LiveKit connection - connect once when brdgeId becomes available
    useEffect(() => {
        // Only connect if we have a brdgeId and haven't connected yet
        if (params.brdgeId && !hasConnected.current) {
            console.log("Initial connection to LiveKit with brdgeId:", params.brdgeId);
            hasConnected.current = true;
            // Let parent component handle the connection
            onConnect(true);
        }
    }, [params.brdgeId, onConnect]); // Only re-run when brdgeId changes

    // Log connection state changes
    useEffect(() => {
        console.log('LiveKit connection state:', roomState);

        if (roomState === ConnectionState.Connected) {
            console.log('Successfully connected to LiveKit room');
        } else if (roomState === ConnectionState.Disconnected) {
            console.log('Disconnected from LiveKit room');
        } else if (roomState === ConnectionState.Connecting) {
            console.log('Connecting to LiveKit room...');
        } else if (roomState === ConnectionState.Reconnecting) {
            console.log('Reconnecting to LiveKit room...');
        }
    }, [roomState]);

    // Add time-seeking functionality for engagement markers
    const seekToTime = useCallback((timestamp: string) => {
        if (!videoRef.current) return;

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

        const seconds = timestampToSeconds(timestamp);
        if (seconds > 0 && seconds <= videoRef.current.duration) {
            videoRef.current.currentTime = seconds;
            setCurrentTime(seconds);
            console.log(`Seeking to timestamp: ${timestamp} (${seconds}s)`);
        }
    }, [videoRef]);

    // Setup proper cleanup on component unmount
    useEffect(() => {
        isMounted.current = true;

        // Cleanup function to disconnect when component unmounts
        return () => {
            isMounted.current = false;
            // Only disconnect if we previously connected
            if (hasConnected.current) {
                console.log("Disconnecting from LiveKit on unmount");
                onConnect(false);
            }
        };
    }, []); // Empty dependency array means this only runs on mount/unmount

    return (
        <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
            {/* Video Section with aspect ratio container */}
            <div className="w-full pb-[56.25%] relative bg-black flex-shrink-0">
                <div className="absolute inset-0">
                    <MobileVideoPlayer
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
                        onVideoReady={setIsVideoReadyForListeners}
                    />
                </div>
            </div>

            {/* Progress Bar Section - Replace with MobileProgressBar */}
            <div className="bg-black/40 relative">
                <MobileProgressBar
                    currentTime={currentTime}
                    duration={duration}
                    videoRef={videoRef}
                    setCurrentTime={setCurrentTime}
                    setIsPlaying={setIsPlaying}
                    isPlaying={isPlaying}
                    engagementOpportunities={engagementOpportunities}
                    onMarkerClick={seekToTime}
                />
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-hidden relative">
                {/* Show chat interface or other tabs based on active tab */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${activeMobileTab === 'chat' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
                    }`}>
                    <MobileChatTile
                        messages={transcripts}
                        accentColor="cyan"
                        onSend={handleChatMessage}
                        isMicEnabled={localParticipant?.isMicrophoneEnabled || false}
                        onToggleMic={() => {
                            if (roomState === ConnectionState.Connected && localParticipant) {
                                localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                            }
                        }}
                    />
                </div>

                {/* Other tab content will be added in future phases */}
                {params.agentType === 'edit' && (
                    <>
                        <div className={`absolute inset-0 transition-opacity duration-300 ${activeMobileTab === 'engagement' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex items-center justify-center">
                                <div className="text-[#1E2A42]/50">Engagement Tab Content</div>
                            </div>
                        </div>

                        <div className={`absolute inset-0 transition-opacity duration-300 ${activeMobileTab === 'teaching-persona' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex items-center justify-center">
                                <div className="text-[#1E2A42]/50">Persona Tab Content</div>
                            </div>
                        </div>

                        <div className={`absolute inset-0 transition-opacity duration-300 ${activeMobileTab === 'voice-clone' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex items-center justify-center">
                                <div className="text-[#1E2A42]/50">Voice Tab Content</div>
                            </div>
                        </div>

                        <div className={`absolute inset-0 transition-opacity duration-300 ${activeMobileTab === 'share' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex items-center justify-center">
                                <div className="text-[#1E2A42]/50">Share Tab Content</div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Tab Bar (only in edit mode) */}
            {params.agentType === 'edit' && (
                <div className="h-14 bg-[#F5EFE0] border-t border-[#9C7C38]/30 flex-shrink-0">
                    <div className="h-full flex items-center justify-around px-2">
                        <button
                            className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'chat' ? 'text-[#9C7C38]' : 'text-[#1E2A42]/60'}`}
                            onClick={() => setActiveMobileTab('chat')}
                        >
                            {activeMobileTab === 'chat' && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full 
                                    bg-[#9C7C38] shadow-[0_0_5px_rgba(156,124,56,0.5)]" />
                            )}
                            <MessageSquare size={18} className="mb-1" />
                            <div className="text-xs">Chat</div>
                        </button>
                        <button
                            className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'engagement' ? 'text-[#9C7C38]' : 'text-[#1E2A42]/60'}`}
                            onClick={() => setActiveMobileTab('engagement')}
                        >
                            {activeMobileTab === 'engagement' && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full 
                                    bg-[#9C7C38] shadow-[0_0_5px_rgba(156,124,56,0.5)]" />
                            )}
                            <ClipboardList size={18} className="mb-1" />
                            <div className="text-xs">Engage</div>
                        </button>
                        <button
                            className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'teaching-persona' ? 'text-[#9C7C38]' : 'text-[#1E2A42]/60'}`}
                            onClick={() => setActiveMobileTab('teaching-persona')}
                        >
                            {activeMobileTab === 'teaching-persona' && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full 
                                    bg-[#9C7C38] shadow-[0_0_5px_rgba(156,124,56,0.5)]" />
                            )}
                            <User size={18} className="mb-1" />
                            <div className="text-xs">Persona</div>
                        </button>
                        <button
                            className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'voice-clone' ? 'text-[#9C7C38]' : 'text-[#1E2A42]/60'}`}
                            onClick={() => setActiveMobileTab('voice-clone')}
                        >
                            {activeMobileTab === 'voice-clone' && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full 
                                    bg-[#9C7C38] shadow-[0_0_5px_rgba(156,124,56,0.5)]" />
                            )}
                            <Radio size={18} className="mb-1" />
                            <div className="text-xs">Voice</div>
                        </button>
                        <button
                            className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'share' ? 'text-[#9C7C38]' : 'text-[#1E2A42]/60'}`}
                            onClick={() => setActiveMobileTab('share')}
                        >
                            {activeMobileTab === 'share' && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full 
                                    bg-[#9C7C38] shadow-[0_0_5px_rgba(156,124,56,0.5)]" />
                            )}
                            <Share2 size={18} className="mb-1" />
                            <div className="text-xs">Share</div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}