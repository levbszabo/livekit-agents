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
    });

    // Data channel setup
    const { send } = useDataChannel("slide_updates");
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentSlide = useRef<number | null>(null);

    // Handle URL parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const params: PlaygroundParams = {
            brdgeId: urlParams.get('brdgeId'),
            numSlides: parseInt(urlParams.get('numSlides') || '0'),
            apiBaseUrl: urlParams.get('apiBaseUrl'),
            viewMode: urlParams.get('viewMode') === 'true'
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
                        agentType: "view"
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
                    <div className="flex-1 overflow-y-auto p-4">
                        {voiceAssistant?.audioTrack && (
                            <TranscriptionTile
                                agentAudioTrack={voiceAssistant.audioTrack}
                                accentColor="cyan"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 