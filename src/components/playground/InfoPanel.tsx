import { useState, useRef, useEffect } from 'react';
import { api } from '@/api';

// Since there's a linter error about types, let's define it inline
type AgentType = 'edit' | 'view';

interface InfoPanelProps {
    walkthroughCount: number;
    agentType: AgentType;
    brdgeId: string | number;
}

interface VoiceConfig {
    id: string;
    user_id: string;
    is_public: boolean;
    name: string;
    description?: string;
    created_at: string;
    language: string;
}

export function InfoPanel({ walkthroughCount, agentType, brdgeId }: InfoPanelProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
    const [voiceName, setVoiceName] = useState('');
    const [isCloning, setIsCloning] = useState(false);
    const [savedVoices, setSavedVoices] = useState<VoiceConfig[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        const fetchSavedVoices = async () => {
            try {
                const response = await api.get(`/api/brdges/${brdgeId}/voices`);
                if (response.data && response.data.voices) {
                    setSavedVoices(response.data.voices);
                }
            } catch (error) {
                console.error('Error fetching saved voices:', error);
            }
        };

        if (agentType === 'edit') {
            fetchSavedVoices();
        }
    }, [brdgeId, agentType]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
                setCurrentRecording(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start timer
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

            // Clear timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setRecordingTime(0);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCloneVoice = async () => {
        if (!currentRecording || !voiceName) return;

        setIsCloning(true);
        try {
            const formData = new FormData();
            formData.append('audio', currentRecording);
            formData.append('name', voiceName);
            formData.append('mode', 'stability');

            const response = await api.post(
                `/api/brdges/${brdgeId}/voice/clone`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (response.data) {
                // Refresh the voices list after successful cloning
                const voicesResponse = await api.get(`/api/brdges/${brdgeId}/voices`);
                if (voicesResponse.data && voicesResponse.data.voices) {
                    setSavedVoices(voicesResponse.data.voices);
                }

                setCurrentRecording(null);
                setVoiceName('');
            }
        } catch (error) {
            console.error('Error cloning voice:', error);
        } finally {
            setIsCloning(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Mode Information */}
            <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-200">
                    {agentType === 'edit' ? 'Edit Mode' : 'View Mode'}
                </h2>
                <p className="text-gray-400">
                    {agentType === 'edit'
                        ? `Walkthrough count: ${walkthroughCount}`
                        : 'Viewing presentation'}
                </p>
            </div>

            {/* View Mode Information */}
            {agentType === 'view' && (
                <div className="space-y-4 border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold text-gray-200">How it works</h3>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                1
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Listen to presentation</p>
                                <p className="text-sm text-gray-500">The AI will present the slides using the creator's voice and style.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                2
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Ask questions</p>
                                <p className="text-sm text-gray-500">Feel free to ask questions or request clarifications at any time.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                3
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Navigate freely</p>
                                <p className="text-sm text-gray-500">Move through slides at your own pace using the navigation controls.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Steps Information */}
            {agentType === 'edit' && (
                <div className="space-y-4 border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold text-gray-200">How it works</h3>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                1
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Record your voice</p>
                                <p className="text-sm text-gray-500">Create a voice clone by recording a few samples of your voice.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                2
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Start walkthrough</p>
                                <p className="text-sm text-gray-500">Present your slides naturally while the AI learns from your explanations.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                3
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Generate script</p>
                                <p className="text-sm text-gray-500">Review and edit the AI-generated presentation script.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                4
                            </div>
                            <div className="space-y-1">
                                <p className="text-gray-200">Share</p>
                                <p className="text-sm text-gray-500">Share your Brdge for others to view with your voice clone.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Voice Configuration Section - Simplified */}
            {agentType === 'edit' && (
                <div className="space-y-4 border-t border-gray-800 pt-6">
                    <h3 className="text-lg font-semibold text-gray-200">Voice Configuration</h3>

                    {/* Saved Voices Dropdown */}
                    {savedVoices.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Select Existing Voice</label>
                            <select
                                value={selectedVoice || ''}
                                onChange={(e) => setSelectedVoice(e.target.value)}
                                className="w-full bg-gray-800 text-gray-200 rounded-md px-3 py-2"
                            >
                                <option value="">Create new voice</option>
                                {savedVoices.map(voice => (
                                    <option key={voice.id} value={voice.id}>
                                        {voice.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* New Voice Recording Section */}
                    {!selectedVoice && (
                        <div className="space-y-4">
                            {/* Voice Name Input */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Voice Name</label>
                                <input
                                    type="text"
                                    value={voiceName}
                                    onChange={(e) => setVoiceName(e.target.value)}
                                    placeholder="Enter voice name"
                                    className="w-full bg-gray-800 text-gray-200 rounded-md px-3 py-2"
                                />
                            </div>

                            {/* Recording Controls */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${isRecording
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                        }`}
                                >
                                    {isRecording ? (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            Stop Recording
                                        </>
                                    ) : (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                            Record Voice
                                        </>
                                    )}
                                </button>
                                {isRecording && (
                                    <span className="text-gray-400">
                                        {formatTime(recordingTime)}
                                    </span>
                                )}
                            </div>

                            {/* Current Recording Preview */}
                            {currentRecording && (
                                <div className="space-y-2">
                                    <audio src={URL.createObjectURL(currentRecording)} controls className="w-full" />
                                    <button
                                        onClick={handleCloneVoice}
                                        disabled={!voiceName || isCloning}
                                        className="w-full px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-md hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCloning ? 'Cloning Voice...' : 'Clone Voice'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
} 