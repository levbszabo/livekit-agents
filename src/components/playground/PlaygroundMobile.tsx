"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChatMessageType } from "@/components/chat/ChatTile";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
// If we need to extend the ChatMessageType for errors, we can define it here:
// interface ExtendedChatMessageType extends ChatMessageType { // Keep this commented or remove if not used after changes
//     isError?: boolean;
// }
import {
    useConnectionState,
    useLocalParticipant,
    useVoiceAssistant,
    useChat,
    useDataChannel,
    useTrackTranscription,
    useRoomContext
} from "@livekit/components-react";
import { ConnectionState, DataPacket_Kind, Track, RpcInvocationData /*, ChatMessage*/ } from "livekit-client"; // Comment out direct ChatMessage from livekit-client
import { ReceivedChatMessage } from "@livekit/components-core"; // Import ReceivedChatMessage
import { ReactNode } from "react";
import { API_BASE_URL } from '@/config';
import { api } from '@/api';
import { jwtDecode } from "jwt-decode";
import { MobileVideoPlayer } from './mobile/MobileVideoPlayer';
import { MobileProgressBar } from './mobile/MobileProgressBar';
import { MessageSquare, ClipboardList, User, Radio, Share2, Square, Send, Mic, MicOff, Plus, Edit2, Trash2, ChevronRight, Save, Info, Lock, Globe, Copy, Check, ExternalLink, Volume2, VolumeX, X, Loader2, MessageCircle, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PersonalizationManager } from './PersonalizationManager';

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

// Add interfaces for the new Guided Conversation type (copied from Playground.tsx)
interface ConversationFlowUserResponse {
    type: string;
    agent_followup_strategy: string;
}

interface ConversationFlow {
    goal: string;
    agent_initiator: string;
    user_responses: ConversationFlowUserResponse[];
    fallback: string;
}

// Update the EngagementOpportunity interface to use a discriminated union (copied from Playground.tsx)
export type EngagementOpportunity = {
    id: string;
    rationale: string;
    timestamp: string;
    section_id: string;
    concepts_addressed: string[];
} & (
        | {
            engagement_type: 'quiz' | 'discussion';
            quiz_items: EngagementQuizItem[];
            conversation_flow?: never; // Ensure conversation_flow is not present
        }
        | {
            engagement_type: 'guided_conversation';
            conversation_flow: ConversationFlow;
            quiz_items?: never; // Ensure quiz_items is not present
        }
    );

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

interface SavedVoice {
    id: string;
    name: string;
    created_at: string;
    status: string;
    brdge_id?: string | number;
    language?: string;
    description?: string;
}

interface EnhancedVoice extends SavedVoice {
    brdge_name?: string;
    is_from_current_bridge?: boolean;
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
    voice_id?: string | null;
    agent_personality?: string;
}

// --- Copied Helper Functions from Playground.tsx ---
// (Simplified versions suitable for mobile context if needed)
const formatVideoTime = (timestamp: string): string => {
    if (!timestamp || !timestamp.startsWith('00:')) return '0:00';
    return timestamp.substring(3);
};

const getEngagementTypeIcon = (type: string) => {
    // Simplified icon logic for brevity, could use Lucide icons
    switch (type) {
        case 'quiz': return <ClipboardList size={16} className="text-blue-500" />;
        case 'discussion': return <MessageSquare size={16} className="text-green-500" />;
        case 'guided_conversation': return <MessageCircle size={16} className="text-purple-500" />; // Use MessageCircle for guided convo
        default: return null;
    }
};

const getQuestionTypeIcon = (type: string) => {
    switch (type) {
        case 'multiple_choice': return <Check size={16} className="text-purple-500" />;
        case 'short_answer': return <Edit2 size={16} className="text-orange-500" />;
        case 'discussion': return <MessageSquare size={16} className="text-green-500" />;
        default: return null;
    }
};

// Debounce utility
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
// --- End Copied Helper Functions ---

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
    const mobileContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isVideoReadyForListeners, setIsVideoReadyForListeners] = useState(false);
    const [hasAudioBeenActivated, setHasAudioBeenActivated] = useState(false);

    // Chat state - To be replaced by useChat().chatMessages
    // const [transcripts, setTranscripts] = useState<ExtendedChatMessageType[]>([]); 

    // LiveKit integrations
    const { localParticipant } = useLocalParticipant();
    const voiceAssistant = useVoiceAssistant();
    const roomState = useConnectionState();
    const { chatMessages, send: sendChatMessage, isSending } = useChat(); // Get chatMessages and send function
    const dataChannel = useDataChannel(); // Keep for other topics if needed
    const room = useRoomContext();
    const { send: sendVideoTimestamp } = useDataChannel("video-timestamp");
    const { send: sendQuizAnswer } = useDataChannel("quiz_answer"); // For sending quiz answers

    // Reference for auto-scrolling chat
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Add engagementOpportunities state
    const [engagementOpportunities, setEngagementOpportunities] = useState<EngagementOpportunity[]>([]);

    // Add MobileTab state for navigation
    const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'engagement' | 'teaching-persona' | 'models' | 'share'>('chat');

    // Track if we've already connected to avoid multiple connection attempts
    const hasConnected = useRef(false);

    // Add component mount state tracking
    const isMounted = useRef(false);

    // Add state for interrupt button animation
    const [interruptPressed, setInterruptPressed] = useState(false);
    const [animateInterrupt, setAnimateInterrupt] = useState(false);

    // Add state for message text input
    const [messageText, setMessageText] = useState('');

    // Add state for other tabs
    const [agentConfig, setAgentConfig] = useState<any>(null); // Simplified type for now
    const [teachingPersona, setTeachingPersona] = useState<any>(null);
    const [savedVoices, setSavedVoices] = useState<EnhancedVoice[]>([]);
    const [userVoices, setUserVoices] = useState<EnhancedVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [selectedVoiceBrdgeId, setSelectedVoiceBrdgeId] = useState<string | null>(null);
    const [isCreatingVoice, setIsCreatingVoice] = useState(false);
    const [brdge, setBrdge] = useState<Brdge | null>(null);
    const [shareableLink, setShareableLink] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // For persona save
    const [saveSuccess, setSaveSuccess] = useState(false); // For persona save
    const [phrasesText, setPhrasesText] = useState(''); // For persona phrases
    const [selectedEngagementType, setSelectedEngagementType] = useState<string | null>(null); // For filtering engagements

    // State for model configuration
    const [modelMode, setModelMode] = useState<'standard' | 'realtime'>('standard');
    const [standardModel, setStandardModel] = useState<'gpt-4.1' | 'gemini-2.0-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash'>('gpt-4.1');
    const [realtimeModel, setRealtimeModel] = useState<'gemini-2.0-flash-live-001'>('gemini-2.0-flash-live-001');

    // Feature gates
    const REALTIME_MODELS_ENABLED = false; // Set to false to disable realtime models

    // Add initialization state
    const [isInitializing, setIsInitializing] = useState(true);

    // Add state for agent-triggered popup
    const [agentTriggeredPopupData, setAgentTriggeredPopupData] = useState<{ url: string; message: string | null } | null>(null);
    const [showAgentTriggeredPopup, setShowAgentTriggeredPopup] = useState(false);

    // Interface for versatile popups (links or quizzes)
    interface ActivePopupData {
        quiz_id?: string;
        question?: string;
        options?: string[];
        message?: string | null;
        url?: string | null;
        type: 'link' | 'quiz';
    }

    // State for the active popup (link or quiz)
    const [activePopupData, setActivePopupData] = useState<ActivePopupData | null>(null);
    // State for UI feedback on quiz option click
    const [clickedOption, setClickedOption] = useState<string | null>(null);

    // Add these state variables after the existing state declarations (around line 150)
    const [lastActivityTime, setLastActivityTime] = useState(Date.now());
    const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    // Add this effect after the existing useEffect hooks (around line 400)
    // Idle timeout effect - disconnect after 5 minutes of inactivity  
    useEffect(() => {
        const resetIdleTimer = () => {
            setLastActivityTime(Date.now());

            // Clear existing timeout
            if (idleTimeoutRef.current) {
                clearTimeout(idleTimeoutRef.current);
            }

            // Only set timeout if we're connected
            if (roomState === ConnectionState.Connected) {
                idleTimeoutRef.current = setTimeout(() => {
                    console.log("Mobile: Disconnecting due to 5 minute idle timeout");
                    onConnect(false);
                }, IDLE_TIMEOUT_MS);
            }
        };

        // Reset timer on connection
        if (roomState === ConnectionState.Connected) {
            resetIdleTimer();
        }

        // Activity event listeners for mobile
        const activityEvents = ['touchstart', 'touchmove', 'touchend', 'click', 'scroll', 'keypress'];

        activityEvents.forEach(event => {
            document.addEventListener(event, resetIdleTimer, { passive: true });
        });

        // Cleanup function
        return () => {
            if (idleTimeoutRef.current) {
                clearTimeout(idleTimeoutRef.current);
            }

            activityEvents.forEach(event => {
                document.removeEventListener(event, resetIdleTimer);
            });
        };
    }, [roomState, onConnect, IDLE_TIMEOUT_MS]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (idleTimeoutRef.current) {
                clearTimeout(idleTimeoutRef.current);
            }
        };
    }, []);

    // Add handleInterruptAgent function
    const handleInterruptAgent = useCallback(() => {
        if (roomState !== ConnectionState.Connected || !dataChannel) {
            console.warn("Cannot interrupt agent: room not connected or dataChannel unavailable");
            return;
        }

        try {
            const interruptMessage = {
                type: "interrupt",
                timestamp: Date.now()
            };

            const payload = new TextEncoder().encode(JSON.stringify(interruptMessage));

            dataChannel.send(payload, {
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
    }, [roomState, dataChannel]);

    // Scroll to bottom function for chat
    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, scrollToBottom]); // Depend on chatMessages now

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
            const headers: HeadersInit = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/recordings/latest/signed-url`, { headers });
            if (!response.ok) throw new Error('Failed to fetch video URL');

            const { url } = await response.json();
            setVideoUrl(url);
            // Consider initialization complete when video URL is fetched (or combine with other fetches)
            // setIsInitializing(false); // We will set this after Brdge data is also fetched
        } catch (error) {
            console.error('Error fetching video URL:', error);
            setIsInitializing(false); // Stop loading even on error
        }
    }, [params.brdgeId, params.apiBaseUrl, authToken]);

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
                // console.warn("Received empty decoded text from message payload");
                // return;
            }

            // Removed manual handling of msg.topic === "chat"
            // The `decoded` variable and its parsing are removed as they were primarily for chat.
            // If other topics use it, their logic should handle parsing `decodedText`.

        } catch (error) {
            console.error("Error processing message:", error);
        }
    }, []);

    // Use the dataChannel hook directly with the callback
    // This will now only handle non-chat topics if any are defined in onDataReceived
    useDataChannel(onDataReceived);

    // Chat message handling
    const handleChatMessage = async (message: string) => {
        if (!sendChatMessage) { // Use sendChatMessage from useChat
            console.warn("Chat functionality not available");
            return;
        }

        if (!message.trim()) {
            console.warn("Attempted to send empty message");
            return;
        }

        // No longer manually adding to a local transcript array for user messages
        // const newMessage: ExtendedChatMessageType = {
        //     name: "You",
        //     message,
        //     isSelf: true,
        //     timestamp: Date.now(),
        // };
        // setTranscripts(prev => [...prev, newMessage]);

        try {
            await sendChatMessage(message); // Use sendChatMessage from useChat
            console.log("Chat message sent:", message);
        } catch (error) {
            console.error("Error sending chat message:", error);
            // Error handling for failed sends might need a different approach
            // as we are removing the local `transcripts` state for chat display.
            // For now, relying on console error.
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

    const lastSentTimestampRef = useRef<number | null>(null);

    useEffect(() => {
        if (!localParticipant || roomState !== ConnectionState.Connected) {
            return; // Don't register if not connected or no participant
        }

        console.log("Registering mobile RPC methods");

        const playerControlRpcHandler = async (data: RpcInvocationData) => {
            try {
                console.log(`Received mobile player control from agent: ${data.payload}`);
                const command = JSON.parse(data.payload);

                if (videoRef.current) {
                    if (command.action === 'pause') {
                        videoRef.current.pause();
                        setIsPlaying(false); // Update mobile state
                        console.log("Mobile video paused via RPC");
                        return JSON.stringify({ success: true, action: 'pause' });
                    } else if (command.action === 'play') {
                        await videoRef.current.play(); // Use await for play()
                        setIsPlaying(true); // Update mobile state
                        console.log("Mobile video resumed via RPC");
                        return JSON.stringify({ success: true, action: 'play' });
                    }
                }
                return JSON.stringify({ success: false, error: 'Invalid command or video ref missing' });
            } catch (error) {
                console.error('Error handling mobile player control RPC:', error);
                return JSON.stringify({ success: false, error: String(error) });
            }
        };

        // Register the RPC method for player control
        localParticipant.registerRpcMethod(
            'controlVideoPlayer',
            playerControlRpcHandler
        );

        // Updated RPC method for triggering link popup (now uses setActivePopupData)
        const linkPopupRpcHandler = async (data: RpcInvocationData) => {
            try {
                console.log(`Mobile: Received triggerLinkPopup from agent: ${data.payload}`);
                const command = JSON.parse(data.payload);

                if (command.action === 'show_link' && command.url) {
                    setActivePopupData({
                        type: 'link',
                        url: command.url,
                        message: command.message || null,
                    });
                    console.log("Mobile: Agent triggered link popup:", command);
                    return JSON.stringify({ success: true, action: 'show_link' });
                }

                return JSON.stringify({ success: false, error: 'Invalid link popup command' });
            } catch (error) {
                console.error('Mobile: Error handling triggerLinkPopup RPC:', error);
                return JSON.stringify({ success: false, error: String(error) });
            }
        };

        localParticipant.registerRpcMethod(
            'triggerLinkPopup',
            linkPopupRpcHandler
        );

        // Register new RPC method for displaying multiple choice quiz
        const quizPopupRpcHandler = async (data: RpcInvocationData) => {
            try {
                console.log(`Mobile: Received displayMultipleChoiceQuiz from agent: ${data.payload}`);
                const command = JSON.parse(data.payload);

                if (command.action === 'show_multiple_choice_quiz' && command.quiz_id && command.question && command.options) {
                    setActivePopupData({
                        type: 'quiz',
                        quiz_id: command.quiz_id,
                        question: command.question,
                        options: command.options,
                        message: command.message || null,
                    });
                    console.log("Mobile: Agent triggered quiz popup:", command);
                    return JSON.stringify({ success: true, action: 'displayMultipleChoiceQuiz' });
                }
                return JSON.stringify({ success: false, error: 'Invalid quiz display command' });
            } catch (error) {
                console.error('Mobile: Error handling displayMultipleChoiceQuiz RPC:', error);
                return JSON.stringify({ success: false, error: String(error) });
            }
        };

        localParticipant.registerRpcMethod(
            'displayMultipleChoiceQuiz',
            quizPopupRpcHandler
        );

        // Cleanup function
        return () => {
            try {
                // Check if participant still exists before unregistering
                if (localParticipant) {
                    localParticipant.unregisterRpcMethod('controlVideoPlayer');
                    localParticipant.unregisterRpcMethod('triggerLinkPopup');
                    localParticipant.unregisterRpcMethod('displayMultipleChoiceQuiz'); // Unregister new RPC method
                    console.log("Unregistered mobile RPC methods");
                }
            } catch (error) {
                console.error("Error unregistering mobile RPC methods:", error);
            }
        };
    }, [localParticipant, roomState, videoRef, setIsPlaying]); // Use mobile state variables

    const sendTimestamp = useCallback(() => {
        const currentVideo = videoRef.current;
        const sendFn = sendVideoTimestamp; // Use the specific send function
        const currentState = roomState;

        if (!currentVideo) {
            // console.log("sendTimestamp aborted: Video ref is missing."); // Optional logging
            return;
        }
        if (currentState !== ConnectionState.Connected) {
            // console.log(`sendTimestamp aborted: Room not connected (State: ${currentState}).`); // Optional logging
            return;
        }

        const currentTime = currentVideo.currentTime;
        const thresholdMet = lastSentTimestampRef.current === null ||
            Math.abs(currentTime - lastSentTimestampRef.current) >= 0.7; // 700ms threshold

        if (thresholdMet) {
            const message = JSON.stringify({
                type: "timestamp",
                time: currentTime
            });
            const payload = new TextEncoder().encode(message);

            try {
                if (sendFn) {
                    sendFn(payload, { topic: "video-timestamp", reliable: false });
                    lastSentTimestampRef.current = currentTime;
                    // console.log(`Timestamp ${currentTime} sent.`); // Optional logging
                } else {
                    // console.log("Cannot send timestamp: send function is not available."); // Optional logging
                }
            } catch (err) {
                console.error(`Failed to send timestamp ${currentTime}:`, err);
            }
        }
    }, [roomState, sendVideoTimestamp]); // Dependencies for useCallback

    const handlePlay = useCallback(() => {
        console.log("Mobile video play event triggered");
        sendTimestamp(); // Send initial timestamp on play
    }, [sendTimestamp]);

    const handleStop = useCallback(() => {
        // No timestamp action needed on stop/pause/end based on Playground.tsx logic
        console.log("Mobile video stop/pause/ended event triggered");
    }, []);

    const handleSeeked = useCallback(() => {
        console.log("Mobile video seeked event triggered");
        sendTimestamp(); // Send timestamp immediately after seek
    }, [sendTimestamp]);

    useEffect(() => {
        const video = videoRef.current;

        // Only attach listeners if video element exists, room is connected, AND video is ready
        if (!video || roomState !== ConnectionState.Connected || !isVideoReadyForListeners) {
            console.log(`Mobile listeners check failed: Video ${video ? 'exists' : 'missing'}, State: ${roomState}, Ready: ${isVideoReadyForListeners}. Not attaching.`);
            return;
        }

        console.log("Mobile listeners: Attaching video event listeners.");

        // Define local handlers referencing the stable useCallback versions
        const onPlay = () => handlePlay();
        const onPause = () => handleStop();
        const onEnded = () => handleStop();
        const onSeeked = () => handleSeeked();
        const onTimeUpdate = () => sendTimestamp(); // Directly call the stable sendTimestamp

        // Add listeners
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("ended", onEnded);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("timeupdate", onTimeUpdate); // Add timeupdate listener

        console.log("Mobile listeners: Event listeners attached.");

        // Cleanup function
        return () => {
            console.log("Mobile listeners cleanup: Removing video event listeners.");
            if (video) {
                video.removeEventListener("play", onPlay);
                video.removeEventListener("pause", onPause);
                video.removeEventListener("ended", onEnded);
                video.removeEventListener("seeked", onSeeked);
                video.removeEventListener("timeupdate", onTimeUpdate); // Remove timeupdate listener
            }
        };
    }, [roomState, isVideoReadyForListeners, handlePlay, handleStop, handleSeeked, sendTimestamp]); // Dependencies

    // Fetch Agent Config (includes teaching_persona and engagement_opportunities)
    const fetchAgentConfig = useCallback(async () => {
        if (!params.brdgeId || !params.apiBaseUrl) return;
        try {
            const headers: HeadersInit = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`, { headers });
            if (!response.ok) throw new Error('Failed to fetch agent config');
            const data = await response.json();
            setAgentConfig(data);
            setTeachingPersona(data.teaching_persona || {}); // Initialize teachingPersona
            setEngagementOpportunities(data.engagement_opportunities || []); // Initialize engagements
        } catch (error) {
            console.error('Error fetching agent config:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl, authToken]);

    useEffect(() => {
        fetchAgentConfig();
    }, [fetchAgentConfig]);

    // Fetch Model Configuration
    const fetchModelConfig = useCallback(async () => {
        if (!params.brdgeId || !params.apiBaseUrl) return;
        try {
            const headers: HeadersInit = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/model-config`, { headers });
            if (response.ok) {
                const data = await response.json();
                // Force standard mode if realtime is disabled
                const fetchedMode = data.mode || 'standard';
                const finalMode = REALTIME_MODELS_ENABLED ? fetchedMode : 'standard';
                setModelMode(finalMode);
                setStandardModel(data.standard_model || 'gpt-4.1');
                setRealtimeModel(data.realtime_model || 'gemini-2.0-flash-live-001');

                // If we forced to standard mode, update the backend
                if (!REALTIME_MODELS_ENABLED && fetchedMode === 'realtime') {
                    updateModelConfig({
                        mode: 'standard',
                        standard_model: data.standard_model || 'gpt-4.1',
                        realtime_model: data.realtime_model || 'gemini-2.0-flash-live-001',
                        voice_id: data.voice_id
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching model config:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl, authToken]);

    useEffect(() => {
        fetchModelConfig();
    }, [fetchModelConfig]);

    // Update model configuration
    const updateModelConfig = useCallback(async (config: any) => {
        if (!params.brdgeId || !params.apiBaseUrl) return;

        try {
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/model-config`, {
                method: 'PUT',
                headers,
                credentials: 'omit',
                body: JSON.stringify(config)
            });

            if (response.ok) {
                console.log('Model configuration updated successfully');
                fetchModelConfig(); // Refresh config
            } else {
                console.error('Failed to update model configuration');
            }
        } catch (error) {
            console.error('Error updating model config:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl, authToken, fetchModelConfig]);

    // Fetch Brdge Data (includes shareable status and voice_id)
    const fetchBrdge = useCallback(async () => {
        if (!params.brdgeId || !params.apiBaseUrl) {
            setIsInitializing(false); // Cannot initialize without these params
            return;
        }
        setIsInitializing(true); // Start loading when fetching brdge
        try {
            const headers: HeadersInit = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}`, { headers, credentials: 'omit' });
            if (!response.ok) throw new Error('Failed to fetch brdge');
            const data = await response.json();
            setBrdge(data);
            if (data.voice_id) {
                setSelectedVoice(data.voice_id);
                setSelectedVoiceBrdgeId(String(params.brdgeId));
            } else {
                setSelectedVoice("default");
                setSelectedVoiceBrdgeId(null);
            }
            // Now that brdge data is fetched, and assuming video URL is also fetched or fetching initiated, stop initializing
            setIsInitializing(false);
        } catch (error) {
            console.error('Error fetching brdge:', error);
            setIsInitializing(false); // Stop loading on error
        }
    }, [params.brdgeId, params.apiBaseUrl, authToken]);

    useEffect(() => {
        fetchBrdge();
    }, [fetchBrdge]);

    // Update Shareable Link when brdge data changes
    const updateShareableLink = useCallback((isShareable: boolean) => {
        if (!brdge || !isShareable) {
            setShareableLink('');
            return;
        }
        let baseUrl = window.location.origin;
        if (baseUrl.includes('localhost:3001')) {
            baseUrl = baseUrl.replace('3001', '3000');
        }
        const shareUrl = `${baseUrl}/viewBridge/${brdge.id}-${brdge.public_id?.substring(0, 6)}`;
        setShareableLink(shareUrl);
    }, [brdge]);

    useEffect(() => {
        if (brdge) {
            updateShareableLink(brdge.shareable);
        }
    }, [brdge, updateShareableLink]);

    // Fetch Saved Voices
    const fetchVoices = useCallback(async () => {
        if (!params.brdgeId || !params.apiBaseUrl) return;
        try {
            const headers: HeadersInit = {};
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/voices`, { headers, credentials: 'omit' });
            if (!response.ok) throw new Error('Failed to fetch voices');
            const data = await response.json();
            setSavedVoices(data.voices || []);
        } catch (error) {
            console.error('Error loading voices:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl, authToken]);

    useEffect(() => {
        fetchVoices();
    }, [fetchVoices]);

    // --- Config Update Logic ---
    const debouncedUpdateConfig = useDebounce((newConfig: any) => {
        updateAgentConfigBackend(newConfig);
    }, 1000); // Debounce time

    const updateAgentConfigBackend = async (newConfig: any) => {
        if (!params.brdgeId || !params.apiBaseUrl) return;
        console.log('Updating config on backend:', newConfig);
        setIsSaving(true); // Indicate saving starts
        try {
            const response = await fetch(
                `${params.apiBaseUrl}/brdges/${params.brdgeId}/agent-config`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
                    },
                    body: JSON.stringify(newConfig),
                }
            );
            if (response.ok) {
                console.log('Backend config updated successfully.');
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            } else {
                console.error(`Failed to update backend config: ${response.status} ${response.statusText}`);
                const errorBody = await response.text();
                console.error('Error response body:', errorBody);
                alert('Failed to save configuration.');
            }
        } catch (error) {
            console.error('Error updating backend config:', error);
            alert('An error occurred while saving.');
        } finally {
            setIsSaving(false); // Indicate saving finished
        }
    };

    // Helper function to update nested properties in teaching persona
    const updateTeachingPersonaField = (path: string, value: any) => {
        setTeachingPersona((prev: any) => {
            const newPersona = { ...(prev || {}) }; // Handle null initial state
            const keys = path.split('.');
            let current: any = newPersona;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;

            // Immediately update agentConfig state and trigger debounced backend update
            setAgentConfig((prevConfig: any) => {
                const newConfig = {
                    ...prevConfig,
                    teaching_persona: newPersona
                };
                debouncedUpdateConfig(newConfig); // Trigger debounced save
                return newConfig; // Update local state immediately
            });
            return newPersona; // Update teachingPersona state
        });
    };

    // Update recurring phrases helper
    const updateRecurringPhrases = (text: string) => {
        const phrases = text
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(phrase => ({
                phrase: phrase.trim(),
                frequency: "medium",
                usage_context: "General conversation"
            }));
        updateTeachingPersonaField('communication_patterns.recurring_phrases', phrases);
    };

    // Initialize phrasesText from teachingPersona
    useEffect(() => {
        if (teachingPersona?.communication_patterns?.recurring_phrases) {
            setPhrasesText(teachingPersona.communication_patterns.recurring_phrases
                .map((p: any) => p.phrase)
                .join('\n')
            );
        }
    }, [teachingPersona]);

    // --- Engagement Logic ---
    const updateEngagementOpportunitiesBackend = (opportunities: EngagementOpportunity[]) => {
        setAgentConfig((prevConfig: any) => {
            const newConfig = {
                ...prevConfig,
                engagement_opportunities: opportunities
            };
            updateAgentConfigBackend(newConfig); // Use the general backend update function
            return newConfig;
        });
    };

    const handleUpdateEngagement = (updatedEngagement: EngagementOpportunity) => {
        const updatedOpportunities = engagementOpportunities.map(engagement =>
            engagement.id === updatedEngagement.id ? updatedEngagement : engagement
        );
        setEngagementOpportunities(updatedOpportunities);
        updateEngagementOpportunitiesBackend(updatedOpportunities);
    };

    const handleDeleteEngagement = (id: string) => {
        const updatedOpportunities = engagementOpportunities.filter(engagement => engagement.id !== id);
        setEngagementOpportunities(updatedOpportunities);
        updateEngagementOpportunitiesBackend(updatedOpportunities);
    };

    const handleAddEngagement = () => {
        const newId = `engagement-${Date.now()}`;
        const newEngagement: EngagementOpportunity = {
            id: newId, rationale: "New rationale", timestamp: "00:00:00",
            quiz_items: [{ question: "New Question", question_type: "multiple_choice", options: ["A", "B"], correct_option: "A" }],
            section_id: "section-1", engagement_type: "quiz", concepts_addressed: ["New"]
        };
        const updatedOpportunities = [...engagementOpportunities, newEngagement];
        setEngagementOpportunities(updatedOpportunities);
        updateEngagementOpportunitiesBackend(updatedOpportunities);
    };

    // --- Voice Logic ---
    const handleSelectVoice = async (voiceId: string, fromBrdgeId?: string | number) => {
        if (!params.brdgeId || !params.apiBaseUrl) return;
        const voice_id = voiceId === "default" ? null : voiceId;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const updateResponse = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/update-voice`, {
                method: 'POST', headers, body: JSON.stringify({ voice_id }), credentials: 'omit'
            });
            if (!updateResponse.ok) throw new Error('Failed to update voice selection');

            // Update local state
            setSelectedVoice(voice_id);
            setSelectedVoiceBrdgeId(voiceId === "default" ? null : String(fromBrdgeId));
            fetchBrdge(); // Refresh brdge data
            fetchVoices(); // Refresh voice list
        } catch (error) {
            console.error('Error updating voice selection:', error);
        }
    };
    // TODO: Add voice recording/cloning logic if needed

    // --- Share Logic ---
    const toggleShareable = async () => {
        if (!params.brdgeId || !params.apiBaseUrl || !brdge) return;
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/toggle_shareable`, {
                method: 'POST', headers, credentials: 'omit'
            });
            if (!response.ok) throw new Error('Failed to toggle shareable status');
            const data = await response.json();
            setBrdge(prev => prev ? { ...prev, shareable: data.shareable } : null); // Updates brdge state
            // updateShareableLink will be called automatically by the useEffect watching brdge
        } catch (error) {
            console.error('Error toggling shareable status:', error);
        }
    };

    const copyLinkToClipboard = () => {
        if (!shareableLink) return;
        navigator.clipboard.writeText(shareableLink).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => console.error('Failed to copy link:', err));
    };

    // --- Engagement Card Component (Inline for now) ---
    const EngagementCard: React.FC<{ engagement: EngagementOpportunity; onEdit: Function; onDelete: Function }> = ({ engagement, onEdit, onDelete }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        // Helper to get display name
        const getTypeName = (type: EngagementOpportunity['engagement_type']) => {
            switch (type) {
                case 'quiz': return 'Quiz';
                case 'discussion': return 'Discussion';
                case 'guided_conversation': return 'Guided Conversation';
                default: return 'Engagement';
            }
        }

        return (
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-3">
                <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2">
                        {getEngagementTypeIcon(engagement.engagement_type)}
                        <span className="text-[14px] font-medium text-gray-800">
                            {/* Use helper to display correct type name */}
                            {getTypeName(engagement.engagement_type)} @ {formatVideoTime(engagement.timestamp)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Simplified Delete for Mobile */}
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this engagement?')) { onDelete(engagement.id); } }} className="p-1.5 rounded-md text-gray-500 hover:text-red-500"><Trash2 size={16} /></button>
                        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }} className="ml-1">
                            <ChevronRight size={16} className="text-gray-500" />
                        </motion.div>
                    </div>
                </div>
                {isExpanded && (
                    <div className="px-4 pb-3 space-y-3 border-t border-gray-200 pt-3">
                        {/* Rationale */}
                        <div>
                            <div className="text-[11px] text-gray-500 font-medium">Rationale:</div>
                            <div className="text-[12px] text-gray-700 mt-0.5">{engagement.rationale}</div>
                        </div>
                        {/* Concepts */}
                        <div>
                            <div className="text-[11px] text-gray-500 font-medium">Concepts:</div>
                            <div className="text-[12px] text-gray-700 mt-0.5">{engagement.concepts_addressed.join(', ')}</div>
                        </div>

                        {/* Conditional Display for Quiz/Discussion vs Guided Conversation */}
                        {engagement.engagement_type === 'guided_conversation' ? (
                            // Display Guided Conversation Details
                            <div className="mt-2 pt-2 border-t border-dashed border-gray-200 space-y-2">
                                <div>
                                    <div className="text-[11px] text-gray-500 font-medium">Goal:</div>
                                    <div className="text-[12px] text-gray-700 mt-0.5">{engagement.conversation_flow.goal}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-gray-500 font-medium">Agent Initiator:</div>
                                    <div className="text-[12px] text-gray-700 mt-0.5">{engagement.conversation_flow.agent_initiator}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-gray-500 font-medium">User Response Paths:</div>
                                    {engagement.conversation_flow.user_responses.map((resp, idx) => (
                                        <div key={idx} className="pl-2 mt-1 border-l-2 border-gray-200 ml-1">
                                            <div className="text-[11px] text-gray-600 font-medium">Path {idx + 1}: {resp.type}</div>
                                            <div className="text-[12px] text-gray-700 mt-0.5">{resp.agent_followup_strategy}</div>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="text-[11px] text-gray-500 font-medium">Fallback:</div>
                                    <div className="text-[12px] text-gray-700 mt-0.5">{engagement.conversation_flow.fallback}</div>
                                </div>
                            </div>
                        ) : (
                            // Display Quiz/Discussion Items
                            engagement.quiz_items.map((item, idx) => (
                                <div key={idx} className="mt-2 pt-2 border-t border-dashed border-gray-200">
                                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                                        {getQuestionTypeIcon(item.question_type)}
                                        Question {idx + 1} ({item.question_type})
                                    </div>
                                    <div className="text-[12px] text-gray-800 mt-1">{item.question}</div>
                                    {item.options && (
                                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                            {item.options.map((opt, i) => <li key={i} className={`text-[12px] ${opt === item.correct_option ? 'text-green-700 font-medium' : 'text-gray-700'}`}>{opt}</li>)}
                                        </ul>
                                    )}
                                    {item.explanation && (
                                        <div>
                                            <div className="text-[11px] text-gray-500 font-medium mt-1">Explanation:</div>
                                            <div className="text-[12px] text-gray-700 mt-0.5">{item.explanation}</div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        );
    };

    // --- Voice Selector Component (Inline for now) ---
    const VoiceSelector: React.FC<{ voices: EnhancedVoice[], selectedVoice: string | null, onSelect: Function }> = ({ voices, selectedVoice, onSelect }) => {
        return (
            <div className="relative">
                <label className="block text-gray-600 text-[12px] font-medium mb-1">Active Voice</label>
                <select
                    value={selectedVoice || 'default'}
                    onChange={(e) => onSelect(e.target.value)}
                    className={`
                        w-full px-3 py-2.5 rounded-lg
                        font-satoshi text-base text-gray-800
                        bg-white backdrop-blur-sm
                        border border-gray-300
                        appearance-none
                        transition-all duration-300
                        focus:ring-1 focus:ring-blue-300
                        focus:border-blue-400
                        hover:border-gray-400
                    `}
                >
                    <option value="default">✓ Default AI Voice</option>
                    {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                            {selectedVoice === voice.id ? '✓ ' : ''}{voice.name}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 mt-2.5">
                    <ChevronRight size={16} />
                </div>
            </div>
        );
    };

    // <<< Add effect for implicit audio activation >>>
    useEffect(() => {
        const activateAudioIfNeeded = () => {
            if (!hasAudioBeenActivated && room && roomState === ConnectionState.Connected) {
                console.log("Mobile: Attempting to activate audio due to user interaction...");
                room.startAudio().then(() => {
                    console.log("Mobile: Audio activated successfully via user interaction.");
                    setHasAudioBeenActivated(true);
                    // Remove listeners once activated
                    if (mobileContainerRef.current) {
                        mobileContainerRef.current.removeEventListener('pointerdown', activateAudioIfNeeded);
                        mobileContainerRef.current.removeEventListener('keydown', activateAudioIfNeeded);
                    }
                }).catch(error => {
                    // Log error but don't prevent future attempts if it fails initially
                    console.error("Mobile: Error activating audio implicitly:", error);
                });
            }
        };

        const container = mobileContainerRef.current;
        // Only add listeners if audio isn't activated and the room is connected
        if (container && !hasAudioBeenActivated && roomState === ConnectionState.Connected) {
            console.log("Mobile: Attaching audio activation listeners.");
            container.addEventListener('pointerdown', activateAudioIfNeeded, { once: false, capture: true });
            container.addEventListener('keydown', activateAudioIfNeeded, { once: false, capture: true });

            // Cleanup function to remove listeners
            return () => {
                console.log("Mobile: Cleaning up audio activation listeners.");
                container.removeEventListener('pointerdown', activateAudioIfNeeded, { capture: true });
                container.removeEventListener('keydown', activateAudioIfNeeded, { capture: true });
            };
        } else if (hasAudioBeenActivated && container) {
            // Ensure listeners are removed if audio gets activated by other means perhaps
            console.log("Mobile: Audio already activated, ensuring listeners are removed.");
            container.removeEventListener('pointerdown', activateAudioIfNeeded, { capture: true });
            container.removeEventListener('keydown', activateAudioIfNeeded, { capture: true });
        }
        // Re-run when activation state or connection state changes
    }, [hasAudioBeenActivated, room, roomState]);

    // TODO: Replace 'h-14' with the actual height of your header if different
    const HEADER_HEIGHT_CLASS = 'pt-14'; // Example: Tailwind class for padding-top: 3.5rem (56px)

    return (
        <div
            ref={mobileContainerRef}
            className={`h-screen flex flex-col bg-white relative overflow-hidden ${HEADER_HEIGHT_CLASS}`}>
            {/* Initial Loading Overlay */}
            {isInitializing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                    <p className="text-gray-700 text-sm font-medium">Loading Bridge...</p>
                </div>
            )}

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
            <div className="bg-gray-50 border-t border-b border-gray-200 relative">
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
                <div className={`absolute inset-0 transition-opacity duration-300 ${activeMobileTab === 'chat'
                    ? activePopupData
                        ? 'opacity-100 z-41' // Higher z-index when popup is active
                        : 'opacity-100 z-30'
                    : 'opacity-0 z-0 pointer-events-none'
                    }`}>
                    {/* Messages container with transcription or regular messages */}
                    <div className="h-full flex flex-col">
                        <div className={`flex-1 overflow-y-auto ${voiceAssistant?.audioTrack ? 'pb-4' : 'pb-[72px]'}`}>
                            {/* Voice Assistant Transcription */}
                            {voiceAssistant?.audioTrack ? (
                                <div className="p-3">
                                    {/* Using TranscriptionTile for advanced transcription visualization, 
                                        but hiding its input by setting className to override layout */}
                                    <div className="transcription-container" style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
                                        <TranscriptionTile
                                            agentAudioTrack={voiceAssistant.audioTrack}
                                            accentColor={themeColors[0] || "blue"}
                                        />
                                        {/* Hide the ChatTile's input by overlaying a div */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '60px',
                                            background: 'white',
                                            zIndex: 10
                                        }}></div>
                                    </div>
                                </div>
                            ) : (
                                /* Regular Chat Messages */
                                <div className="px-4 py-3 space-y-3">
                                    <AnimatePresence>
                                        {chatMessages.map((message: ReceivedChatMessage) => { // Use ReceivedChatMessage type
                                            // Accessing .from with a type assertion as a workaround for potential linter/type issue
                                            const msgFrom = message.from; // Direct access, as ReceivedChatMessage defines it
                                            const isSelf = msgFrom?.isLocal || false;
                                            const name = isSelf ? "You" : msgFrom?.identity || "Agent";
                                            // isError is not part of LiveKit ChatMessage, handled differently if needed.

                                            return (
                                                <motion.div
                                                    key={message.id || message.timestamp} // Use message.id from ChatMessage if available
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    className={`
                                                        ${isSelf ? 'ml-auto bg-blue-50 border border-blue-200' : 'mr-auto bg-gray-50 border border-gray-200'} 
                                                        rounded-lg p-3
                                                        max-w-[85%] w-auto
                                                        shadow-sm
                                                        transition-all duration-300
                                                        ${isSelf ? 'hover:border-blue-300' : 'hover:border-gray-300'} // Simplified error styling for now
                                                        flex flex-col gap-1
                                                    `}
                                                >
                                                    <span className="text-[11px] text-gray-500 font-medium">
                                                        {name}
                                                    </span>
                                                    <span className={`
                                                        text-[13px] leading-relaxed break-words 
                                                        ${isSelf
                                                            ? 'text-gray-800 font-satoshi'
                                                            : 'text-gray-800 font-serif'} // Simplified error styling for now
                                                    `}>
                                                        {message.message}
                                                    </span>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                            <div ref={messagesEndRef} style={{ height: 0 }} /> {/* Invisible element for scrolling */}

                            {/* Agent Triggered Popup (Link or Quiz) */}
                            {activePopupData && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="sticky bottom-2 left-0 right-0 mx-3 p-3 bg-white border rounded-lg shadow-xl z-30"
                                    style={{
                                        borderColor: activePopupData.type === 'quiz' ? 'purple' : 'green', // Example: purple for quiz, green for link
                                        marginBottom: params.agentType === 'edit' ? 'calc(3.5rem + 0.5rem)' : '0.5rem'
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium"
                                            style={{ color: activePopupData.type === 'quiz' ? 'purple' : 'green' }}
                                        >
                                            {activePopupData.type === 'quiz' ? 'Quiz Question:' : 'Agent Suggestion:'}
                                        </span>
                                        <button
                                            onClick={() => setActivePopupData(null)}
                                            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-all duration-200"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {/* Popup Message (if any) - but not for quiz type */}
                                    {activePopupData.type !== 'quiz' && activePopupData.message && (
                                        <p className="text-sm text-gray-700 mb-2">{activePopupData.message}</p>
                                    )}

                                    {/* Link Specific Content */}
                                    {activePopupData.type === 'link' && activePopupData.url && (
                                        <>
                                            <a
                                                href={activePopupData.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1"
                                            >
                                                <Link size={14} />
                                                Open Link
                                            </a>
                                            <p className="text-xs text-gray-500 mt-1 truncate hover:text-clip hover:overflow-visible transition-all duration-300">
                                                {activePopupData.url}
                                            </p>
                                        </>
                                    )}

                                    {/* Quiz Specific Content */}
                                    {activePopupData.type === 'quiz' && activePopupData.quiz_id && activePopupData.question && activePopupData.options && (
                                        <div className="mt-2 space-y-2">
                                            <p className="text-sm text-gray-800 font-semibold mb-2">{activePopupData.question}</p>
                                            {activePopupData.options.map((option, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        setClickedOption(option);
                                                        setTimeout(() => {
                                                            if (sendQuizAnswer && activePopupData.quiz_id) {
                                                                const answerPayload = {
                                                                    quiz_id: activePopupData.quiz_id,
                                                                    selected_option: option,
                                                                };
                                                                const encodedPayload = new TextEncoder().encode(JSON.stringify(answerPayload));
                                                                sendQuizAnswer(encodedPayload, { reliable: true }); // topic is implicitly handled by useDataChannel("quiz_answer")
                                                                console.log('Mobile: Sent quiz answer:', answerPayload);
                                                            }
                                                            setActivePopupData(null);
                                                            setClickedOption(null);
                                                        }, 300); // Delay for feedback
                                                    }}
                                                    className={`
                                                        w-full text-left px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium
                                                        ${clickedOption === option
                                                            ? 'bg-green-500 text-white ring-2 ring-green-300' // Feedback for clicked option
                                                            : 'bg-blue-500 text-white hover:bg-blue-600' // Default option style
                                                        }
                                                    `}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>

                        {/* Single Fixed Chat Input - Always visible regardless of mode */}
                        <div className={`fixed bottom-0 left-0 right-0 ${activePopupData ? 'z-35' : 'z-40'} px-3 py-3 
                            bg-white/95 backdrop-blur-sm border-t border-gray-200`}
                            style={{
                                paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
                                marginBottom: params.agentType === 'edit' ? '3.5rem' : '0'
                            }}
                        >
                            <div className="relative z-10 flex items-end gap-2">
                                {/* Stop Button */}
                                <button
                                    onClick={handleInterruptAgent}
                                    className={`
                                        p-3 rounded-md
                            ${interruptPressed
                                            ? 'bg-blue-100 text-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                            ${animateInterrupt ? 'scale-105' : 'scale-100'}
                            transition-all duration-200
                            flex-shrink-0
                            min-w-[44px] min-h-[44px]
                        border ${interruptPressed ? 'border-blue-200' : 'border-gray-200'}
                                    `}
                                    aria-label="Interrupt agent"
                                >
                                    <Square size={16} className={`fill-current ${animateInterrupt ? 'animate-pulse' : ''}`} />
                                </button>

                                {/* Textarea input with starting height */}
                                <textarea
                                    value={messageText}
                                    onChange={(e) => {
                                        setMessageText(e.target.value);
                                        // Auto-resize textarea
                                        e.target.style.height = '44px'; // Always reset to base height first
                                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleChatMessage(messageText);
                                            setMessageText('');
                                            // Reset textarea height
                                            if (e.target instanceof HTMLTextAreaElement) {
                                                e.target.style.height = '44px';
                                            }
                                        }
                                    }}
                                    placeholder="Write a message..."
                                    className="
                                        flex-1 py-3 px-4
                                        min-h-[44px] max-h-[120px] h-[44px]
                                        bg-white 
                                        text-base text-gray-800
                                        placeholder:text-gray-400
                                        rounded-lg resize-none
                                        border border-gray-300
                                        focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200
                                        hover:border-gray-400
                                        transition-all duration-300
                                        scrollbar-thin scrollbar-track-transparent
                                        scrollbar-thumb-gray-300
                                        hover:scrollbar-thumb-gray-400
                                        font-satoshi
                                    "
                                    style={{ height: '44px' }}
                                />

                                {/* Mic toggle button */}
                                <button
                                    onClick={() => {
                                        if (roomState === ConnectionState.Connected && localParticipant) {
                                            localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                                        }
                                    }}
                                    disabled={roomState !== ConnectionState.Connected}
                                    className={`
                                        p-3 rounded-md
                                        ${localParticipant?.isMicrophoneEnabled
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'bg-gray-100 text-gray-500 hover:text-gray-700'}
                                        transition-all duration-200
                                        hover:bg-gray-200
                                        flex-shrink-0
                                        min-w-[44px] min-h-[44px]
                                    `}
                                >
                                    {localParticipant?.isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                                </button>

                                {/* Send button (quill style) */}
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        handleChatMessage(messageText);
                                        setMessageText('');
                                        // Reset textarea height
                                        if (document.activeElement instanceof HTMLTextAreaElement) {
                                            document.activeElement.style.height = '44px';
                                        }
                                    }}
                                    disabled={!messageText.trim()}
                                    className={`
                                        p-3 rounded-md
                                        ${messageText.trim()
                                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                                            : 'bg-gray-200 text-gray-400'}
                                        transition-all duration-200
                                        flex-shrink-0
                                        min-w-[44px] min-h-[44px]
                                    `}
                                >
                                    <Send size={20} />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div >

                {/* Other tab content will be added in future phases */}
                {
                    params.agentType === 'edit' && (
                        <>
                            {/* Engagement Tab Content */}
                            <div className={`absolute inset-0 transition-opacity duration-300 overflow-y-auto p-4 ${activeMobileTab === 'engagement' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-800">Engagement</h2>
                                    <button onClick={handleAddEngagement} className="p-2 rounded-lg bg-blue-500 text-white flex items-center gap-1.5 text-sm hover:bg-blue-600">
                                        <Plus size={16} /> Add New
                                    </button>
                                </div>
                                {/* Filter buttons */}
                                <div className="flex items-center gap-2 mb-4 pb-2 overflow-x-auto scrollbar-none">
                                    <button onClick={() => setSelectedEngagementType(null)} className={`px-3 py-1.5 rounded-full min-w-[80px] text-[13px] border ${!selectedEngagementType ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>All</button>
                                    <button onClick={() => setSelectedEngagementType('quiz')} className={`px-3 py-1.5 rounded-full min-w-[80px] text-[13px] flex items-center gap-1.5 border ${selectedEngagementType === 'quiz' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{getEngagementTypeIcon('quiz')}Quizzes</button>
                                    <button onClick={() => setSelectedEngagementType('discussion')} className={`px-3 py-1.5 rounded-full min-w-[80px] text-[13px] flex items-center gap-1.5 border ${selectedEngagementType === 'discussion' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{getEngagementTypeIcon('discussion')}Discussions</button>
                                    <button onClick={() => setSelectedEngagementType('guided_conversation')} className={`px-3 py-1.5 rounded-full min-w-[120px] text-[13px] flex items-center gap-1.5 border ${selectedEngagementType === 'guided_conversation' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{getEngagementTypeIcon('guided_conversation')}Guided Convo</button>
                                </div>
                                {/* Engagement List */}
                                {engagementOpportunities && engagementOpportunities.length > 0 ? (
                                    engagementOpportunities
                                        .filter(e => !selectedEngagementType || e.engagement_type === selectedEngagementType)
                                        .map((engagement) => (
                                            <EngagementCard
                                                key={engagement.id}
                                                engagement={engagement}
                                                onEdit={handleUpdateEngagement}
                                                onDelete={handleDeleteEngagement}
                                            />
                                        ))
                                ) : (
                                    <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                                        No engagement opportunities yet.
                                    </div>
                                )}
                                <div className="h-20"></div> {/* Add padding at the bottom */}
                            </div>

                            {/* Persona Tab Content */}
                            <div className={`absolute inset-0 transition-opacity duration-300 overflow-y-auto p-4 ${activeMobileTab === 'teaching-persona' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-800">Teaching Persona</h2>
                                    <button onClick={() => updateAgentConfigBackend(agentConfig)} disabled={isSaving} className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm ${saveSuccess ? 'bg-green-500/10 text-green-600 border-green-500/30' : 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500'} border transition-all`}>
                                        <Save size={14} /> {isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save')}
                                    </button>
                                </div>
                                {teachingPersona ? (
                                    <div className="space-y-4">
                                        {/* Instructor Profile */}
                                        <div className="border border-gray-200 rounded-lg p-4 bg-white">
                                            <h3 className="text-sm font-medium text-gray-800 mb-2">Instructor Profile</h3>
                                            <label className="block mb-1 text-[13px] font-medium text-gray-600">Name</label>
                                            <input type="text" value={teachingPersona?.instructor_profile?.name || ''} onChange={(e) => updateTeachingPersonaField('instructor_profile.name', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-800 mb-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-200" placeholder="Instructor Name" />
                                            <div className="text-[11px] text-gray-500">Expertise: {teachingPersona?.instructor_profile?.apparent_expertise_level || 'N/A'}</div>
                                        </div>
                                        {/* Communication Style */}
                                        <div className="border border-gray-200 rounded-lg p-4 bg-white">
                                            <h3 className="text-sm font-medium text-gray-800 mb-2">Communication Style</h3>
                                            <label className="block mb-1 text-[13px] font-medium text-gray-600">Overall Style</label>
                                            <input type="text" value={teachingPersona?.communication_patterns?.vocabulary_level || ''} onChange={(e) => updateTeachingPersonaField('communication_patterns.vocabulary_level', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-800 mb-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-200" placeholder="e.g., friendly, technical" />
                                            <label className="block mb-1 text-[13px] font-medium text-gray-600">Characteristic Phrases (one per line)</label>
                                            <textarea value={phrasesText} onChange={(e) => setPhrasesText(e.target.value)} onBlur={() => updateRecurringPhrases(phrasesText)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-800 min-h-[100px] focus:border-blue-400 focus:ring-1 focus:ring-blue-200" placeholder="Frequent phrases..." />
                                        </div>
                                        {/* Teaching Insights (Display Only) */}
                                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 opacity-70">
                                            <h3 className="text-sm font-medium text-gray-800 mb-2">Teaching Insights (Auto-Extracted)</h3>
                                            <p className="text-[12px] text-gray-700">Speech Style: {teachingPersona?.speech_characteristics?.accent?.type || 'N/A'} ({teachingPersona?.speech_characteristics?.accent?.cadence || 'N/A'})</p>
                                            {/* Add more display fields if needed */}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                                        Loading Persona...
                                    </div>
                                )}
                                <div className="h-20"></div> {/* Add padding at the bottom */}
                            </div>

                            {/* Models Tab Content */}
                            <div className={`absolute inset-0 transition-opacity duration-300 overflow-y-auto p-4 ${activeMobileTab === 'models' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-800">AI Model Configuration</h2>
                                </div>

                                {/* Mode Selection Toggle */}
                                <div className="mb-6">
                                    <label className="block text-gray-600 text-sm font-medium mb-3">AI Mode</label>
                                    <div className="bg-gray-100 p-1 rounded-lg">
                                        <div className="grid grid-cols-2 gap-1">
                                            <button
                                                onClick={() => {
                                                    setModelMode('standard');
                                                    updateModelConfig({
                                                        mode: 'standard',
                                                        standard_model: standardModel,
                                                        realtime_model: realtimeModel,
                                                        voice_id: selectedVoice === 'default' ? null : selectedVoice
                                                    });
                                                }}
                                                className={`
                                                    px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                                                    ${modelMode === 'standard'
                                                        ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                                                        : 'text-gray-600 hover:text-gray-700'}
                                                `}
                                            >
                                                Standard
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (REALTIME_MODELS_ENABLED) {
                                                        setModelMode('realtime');
                                                        updateModelConfig({
                                                            mode: 'realtime',
                                                            standard_model: standardModel,
                                                            realtime_model: realtimeModel,
                                                            voice_id: selectedVoice === 'default' ? null : selectedVoice
                                                        });
                                                    }
                                                }}
                                                disabled={!REALTIME_MODELS_ENABLED}
                                                className={`
                                                    px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 relative
                                                    ${!REALTIME_MODELS_ENABLED
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                                        : modelMode === 'realtime'
                                                            ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                                                            : 'text-gray-600 hover:text-gray-700'}
                                                `}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {!REALTIME_MODELS_ENABLED && (
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    <span>Realtime</span>
                                                    {!REALTIME_MODELS_ENABLED && (
                                                        <span className="text-[10px] opacity-75">(Soon)</span>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2">
                                        {modelMode === 'standard'
                                            ? 'Traditional STT → LLM → TTS pipeline with voice cloning'
                                            : !REALTIME_MODELS_ENABLED
                                                ? 'Live conversation mode with reduced latency (coming soon)'
                                                : 'Live conversation mode with reduced latency'
                                        }
                                    </div>
                                </div>

                                {/* Standard Mode */}
                                {modelMode === 'standard' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-2">Language Model</label>
                                            <select
                                                value={standardModel}
                                                onChange={(e) => {
                                                    const newModel = e.target.value as 'gpt-4.1' | 'gemini-2.0-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash';
                                                    setStandardModel(newModel);
                                                    updateModelConfig({
                                                        mode: modelMode,
                                                        standard_model: newModel,
                                                        realtime_model: realtimeModel,
                                                        voice_id: selectedVoice === 'default' ? null : selectedVoice
                                                    });
                                                }}
                                                className="w-full px-3 py-3 rounded-lg text-sm text-gray-800 bg-white border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                                            >
                                                <option value="gpt-4.1">GPT-4.1 (Recommended)</option>
                                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            </select>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {standardModel === 'gpt-4.1'
                                                    ? 'OpenAI\'s latest model with excellent reasoning'
                                                    : 'Google\'s fast model with multimodal capabilities'
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-2">Voice Selection</label>
                                            <select
                                                value={selectedVoice || 'default'}
                                                onChange={(e) => handleSelectVoice(e.target.value)}
                                                className="w-full px-3 py-3 rounded-lg text-sm text-gray-800 bg-white border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                                            >
                                                <option value="default">Default AI Voice</option>
                                                {savedVoices.map((voice) => (
                                                    <option key={voice.id} value={voice.id}>
                                                        {voice.name} {voice.status === 'active' ? '(Active)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Realtime Mode */}
                                {modelMode === 'realtime' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-2">Realtime Model</label>
                                            <select
                                                value={realtimeModel}
                                                onChange={(e) => {
                                                    const newModel = e.target.value as 'gemini-2.0-flash-live-001';
                                                    setRealtimeModel(newModel);
                                                    updateModelConfig({
                                                        mode: modelMode,
                                                        standard_model: standardModel,
                                                        realtime_model: newModel,
                                                        voice_id: selectedVoice === 'default' ? null : selectedVoice
                                                    });
                                                }}
                                                className="w-full px-3 py-3 rounded-lg text-sm text-gray-800 bg-white border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                                            >
                                                <option value="gemini-2.0-flash-live-001">Gemini 2.0 Flash Live</option>
                                            </select>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Google&apos;s live conversation model with ultra-low latency
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-2">Voice (Limited Options)</label>
                                            <select
                                                value={selectedVoice || 'default'}
                                                className="w-full px-3 py-3 rounded-lg text-sm text-gray-800 bg-white border border-gray-300"
                                                disabled
                                            >
                                                <option value="default">Default Realtime Voice</option>
                                            </select>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Custom voice cloning not available in realtime mode
                                            </div>
                                        </div>

                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                            <h3 className="text-blue-800 text-sm font-medium mb-2">Realtime Features</h3>
                                            <ul className="space-y-1 text-xs text-blue-700">
                                                <li>• Ultra-low latency conversation</li>
                                                <li>• Live video and audio streaming</li>
                                                <li>• Real-time context awareness</li>
                                                <li>• Limited voice customization</li>
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                <div className="h-20"></div> {/* Add padding at the bottom */}
                            </div>

                            {/* Share Tab Content */}
                            <div className={`absolute inset-0 transition-opacity duration-300 overflow-y-auto p-4 ${activeMobileTab === 'share' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <h2 className="text-lg font-semibold text-gray-800 mb-4">Share</h2>
                                <div className="space-y-6">
                                    {/* Public Access Toggle */}
                                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {brdge?.shareable ? <Globe size={18} className="text-blue-500" /> : <Lock size={18} className="text-gray-600" />}
                                                <h3 className="text-[14px] font-medium text-gray-800">{brdge?.shareable ? 'Public' : 'Private'}</h3>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={brdge?.shareable || false} onChange={toggleShareable} className="sr-only peer" />
                                                <div className={`w-11 h-6 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full ${brdge?.shareable ? 'bg-blue-500 border-blue-500' : 'bg-gray-200 border-gray-300'} border`}></div>
                                            </label>
                                        </div>
                                        <p className="text-[12px] text-gray-600 mt-1">{brdge?.shareable ? "Anyone with the link can view" : "Only you can view"}</p>
                                    </div>
                                    {/* Share Link */}
                                    <div className={`border rounded-lg p-4 bg-white ${brdge?.shareable ? 'border-gray-200' : 'border-gray-200 opacity-50'}`}>
                                        <h3 className="text-sm font-medium text-gray-800 mb-2">Share Link</h3>
                                        {brdge?.shareable ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-[13px] text-gray-800 truncate">{shareableLink}</div>
                                                    <button onClick={copyLinkToClipboard} className={`p-2 rounded-lg transition-all ${isCopied ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-200'}`}>
                                                        {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                                    </button>
                                                </div>
                                                <a href={shareableLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"><ExternalLink size={12} /> Open Link</a>
                                                {isCopied && <p className="text-[11px] text-green-600">Link copied!</p>}
                                            </div>
                                        ) : (
                                            <p className="text-[13px] text-gray-500 text-center py-2">Enable public access to get link</p>
                                        )}
                                    </div>

                                    {/* Personalization Section - Only show when bridge is shareable */}
                                    {brdge?.shareable && params.brdgeId && params.agentType === 'edit' && (
                                        <div className="mt-4">
                                            <PersonalizationManager
                                                brdgeId={params.brdgeId}
                                                apiBaseUrl={params.apiBaseUrl || ''}
                                                authToken={authToken}
                                                shareableLink={shareableLink}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="h-20"></div> {/* Add padding at the bottom */}
                            </div>
                        </>
                    )
                }
            </div >

            {/* Bottom Tab Bar (only in edit mode) */}
            {
                params.agentType === 'edit' && (
                    <div className="h-14 bg-white border-t border-gray-200 flex-shrink-0">
                        <div className="h-full flex items-center justify-around px-2">
                            <button
                                className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'chat' ? 'text-blue-600' : 'text-gray-500'}`}
                                onClick={() => setActiveMobileTab('chat')}
                            >
                                {activeMobileTab === 'chat' && (
                                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full 
                                    bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                                )}
                                <MessageSquare size={18} className="mb-1" />
                                <div className="text-xs">Chat</div>
                            </button>
                            <button
                                className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'engagement' ? 'text-blue-600' : 'text-gray-500'}`}
                                onClick={() => setActiveMobileTab('engagement')}
                            >
                                {activeMobileTab === 'engagement' && (
                                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full 
                                    bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                                )}
                                <ClipboardList size={18} className="mb-1" />
                                <div className="text-xs">Engage</div>
                            </button>
                            <button
                                className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'teaching-persona' ? 'text-blue-600' : 'text-gray-500'}`}
                                onClick={() => setActiveMobileTab('teaching-persona')}
                            >
                                {activeMobileTab === 'teaching-persona' && (
                                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full 
                                    bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                                )}
                                <User size={18} className="mb-1" />
                                <div className="text-xs">Persona</div>
                            </button>
                            <button
                                className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'models' ? 'text-blue-600' : 'text-gray-500'}`}
                                onClick={() => setActiveMobileTab('models')}
                            >
                                {activeMobileTab === 'models' && (
                                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full 
                                    bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                                )}
                                <Radio size={18} className="mb-1" />
                                <div className="text-xs">Models</div>
                            </button>
                            <button
                                className={`relative flex flex-col items-center justify-center px-3 py-1 
                                ${activeMobileTab === 'share' ? 'text-blue-600' : 'text-gray-500'}`}
                                onClick={() => setActiveMobileTab('share')}
                            >
                                {activeMobileTab === 'share' && (
                                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full 
                                    bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                                )}
                                <Share2 size={18} className="mb-1" />
                                <div className="text-xs">Share</div>
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}