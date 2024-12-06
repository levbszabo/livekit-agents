"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
    useConnectionState,
    useDataChannel,
    useLocalParticipant,
    useVoiceAssistant,
} from "@livekit/components-react";
import { ConnectionState, DataPacket_Kind } from "livekit-client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

export interface ViewerPlaygroundProps {
    onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
}

// Add interface for URL parameters
interface PlaygroundParams {
    brdgeId: string | null;
    numSlides: number;
    apiBaseUrl: string | null;
    viewMode: boolean;
    userId: string;
}

export default function ViewerPlayground({
    onConnect,
}: ViewerPlaygroundProps) {
    const { localParticipant } = useLocalParticipant();
    const voiceAssistant = useVoiceAssistant();
    const roomState = useConnectionState();
    const [isConnecting, setIsConnecting] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [params, setParams] = useState({
        brdgeId: null as string | null,
        numSlides: 0,
        apiBaseUrl: null as string | null,
        viewMode: false,
        userId: 'anonymous'
    });

    // Data channel setup
    const { send } = useDataChannel("slide_updates");
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentSlide = useRef<number | null>(null);

    // Add new state for messages
    const [messages, setMessages] = useState<Array<{
        id: number;
        message: string;
        role: string;
        timestamp: string;
    }>>([]);

    // Add message input state
    const [messageInput, setMessageInput] = useState('');

    // Handle URL parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const params: PlaygroundParams = {
            brdgeId: urlParams.get('brdgeId'),
            numSlides: parseInt(urlParams.get('numSlides') || '0'),
            apiBaseUrl: urlParams.get('apiBaseUrl'),
            viewMode: urlParams.get('viewMode') === 'true',
            userId: urlParams.get('userId') || 'anonymous'
        };
        setParams(params);
    }, []);

    // Auto-connect on load
    useEffect(() => {
        if (roomState === ConnectionState.Disconnected) {
            handleConnect();
        }
    }, [roomState]);

    const handleConnect = useCallback(async () => {
        try {
            setIsConnecting(true);
            await onConnect(true);
        } catch (error) {
            console.error('Connection error:', error);
        } finally {
            setIsConnecting(false);
        }
    }, [onConnect]);

    const sendSlideUpdate = useCallback(() => {
        if (!params.brdgeId || roomState !== ConnectionState.Connected) return;

        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        if (lastSentSlide.current !== currentSlide) {
            updateTimeoutRef.current = setTimeout(() => {
                try {
                    const slideUrl = `${params.apiBaseUrl}/brdges/${params.brdgeId}/slides/${currentSlide}`;
                    const message = {
                        type: "SLIDE_UPDATE",
                        brdgeId: params.brdgeId,
                        numSlides: params.numSlides,
                        apiBaseUrl: params.apiBaseUrl,
                        currentSlide: currentSlide,
                        slideUrl: slideUrl,
                        agentType: "view",
                        userId: params.userId
                    };

                    const encoder = new TextEncoder();
                    const data = encoder.encode(JSON.stringify(message));
                    send(data, DataPacket_Kind.RELIABLE);
                    lastSentSlide.current = currentSlide;
                } catch (e) {
                    console.error("Error sending slide update:", e);
                }
            }, 300);
        }
    }, [params, currentSlide, roomState, send]);

    useEffect(() => {
        if (roomState === ConnectionState.Connected) {
            sendSlideUpdate();
        }
    }, [roomState, currentSlide, sendSlideUpdate]);

    const handleNextSlide = () => {
        if (currentSlide < params.numSlides) {
            setCurrentSlide(prev => prev + 1);
        }
    };

    const handlePrevSlide = () => {
        if (currentSlide > 1) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    // Add function to send message
    const sendMessage = useCallback(async (message: string) => {
        if (!params.brdgeId || !params.apiBaseUrl) return;

        const payload = {
            user_id: params.userId,
            message,
            role: 'user',
            slide_number: currentSlide
        };

        console.log('Sending message with payload:', payload);

        try {
            const response = await fetch(`${params.apiBaseUrl}/brdges/${params.brdgeId}/viewer-conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error response:', errorData);
                throw new Error('Failed to send message');
            }

            // Optionally fetch updated messages
            fetchMessages();

        } catch (error) {
            console.error('Error sending message:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl, params.userId, currentSlide]);

    // Add function to fetch messages
    const fetchMessages = useCallback(async () => {
        if (!params.brdgeId || !params.apiBaseUrl) return;

        try {
            const url = new URL(`${params.apiBaseUrl}/brdges/${params.brdgeId}/viewer-conversations`);
            if (!params.userId.startsWith('user_')) {
                url.searchParams.append('anonymous_id', params.userId);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const data = await response.json();
            setMessages(data.conversations);

        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    }, [params.brdgeId, params.apiBaseUrl, params.userId]);

    // Add useEffect to fetch messages on mount and when slide changes
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages, currentSlide]);

    // Add message input handler
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Sending message:', messageInput);
        if (messageInput.trim()) {
            sendMessage(messageInput.trim());
            setMessageInput('');
        }
    };

    return (
        <div className="h-screen flex flex-col bg-[#121212]">
            <div className="flex-1 flex overflow-hidden">
                {/* Presentation Side */}
                <div className="flex-1 p-6">
                    <div className="h-full flex flex-col">
                        <div className="flex-1 bg-black rounded-2xl overflow-hidden flex flex-col">
                            {/* Slide Display */}
                            <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
                                {params.apiBaseUrl && params.brdgeId && (
                                    <img
                                        src={`${params.apiBaseUrl}/brdges/${params.brdgeId}/slides/${currentSlide}`}
                                        alt={`Slide ${currentSlide}`}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                )}
                            </div>

                            {/* Navigation Controls */}
                            <div className="p-4 bg-gray-900 border-t border-gray-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">
                                        Slide {currentSlide} of {params.numSlides}
                                    </span>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handlePrevSlide}
                                            disabled={currentSlide === 1}
                                            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={handleNextSlide}
                                            disabled={currentSlide === params.numSlides}
                                            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chat Panel */}
                <div className="w-[420px] border-l border-gray-800 flex flex-col bg-gray-900">
                    {/* Mic Toggle */}
                    <div className="p-4 border-b border-gray-800">
                        <button
                            onClick={() => {
                                if (roomState === ConnectionState.Connected) {
                                    localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors
                ${localParticipant.isMicrophoneEnabled
                                    ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${localParticipant.isMicrophoneEnabled ? 'bg-cyan-500 animate-pulse' : 'bg-gray-600'}`} />
                            <span className="text-sm font-medium">
                                {localParticipant.isMicrophoneEnabled ? 'Mic On' : 'Mic Off'}
                            </span>
                        </button>
                    </div>

                    {/* Chat/Transcription Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${message.role === 'user'
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-gray-800 text-gray-300'
                                        }`}
                                >
                                    <p className="text-sm">{message.message}</p>
                                    <span className="text-xs opacity-50">
                                        {new Date(message.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {voiceAssistant?.audioTrack && (
                            <TranscriptionTile
                                agentAudioTrack={voiceAssistant.audioTrack}
                                accentColor="cyan"
                            />
                        )}
                    </div>

                    {/* Add message input form */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-gray-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            <button
                                type="submit"
                                disabled={!messageInput.trim()}
                                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-md hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
} 