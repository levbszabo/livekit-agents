import { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '@/config';
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
    name: string;
    createdAt: string;
}

interface AgentIntent {
    prompt: string;
    questions: string[];
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

    const [agentIntent, setAgentIntent] = useState<AgentIntent>({
        prompt: '',
        questions: []
    });
    const [newQuestion, setNewQuestion] = useState('');

    // Add new state for tracking progress
    const [currentStep, setCurrentStep] = useState(1);

    // Helper function to determine if a step is active
    const isStepActive = (stepNumber: number) => {
        if (walkthroughCount === 0) return stepNumber === 1;
        if (!scripts && walkthroughCount > 0) return stepNumber === 2;
        if (!selectedVoice && scripts) return stepNumber === 3;
        return stepNumber === 4;
    };

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

            console.log('Cloning voice for brdge:', brdgeId);
            const response = await api.post(
                `/api/brdges/${brdgeId}/voice/clone`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            console.log('Clone response:', response.data);

            if (response.data) {
                // Refresh voices list after successful clone
                const voicesResponse = await api.get(`/api/brdges/${brdgeId}/voices`);
                if (voicesResponse.data?.voices) {
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

    const addQuestion = () => {
        if (newQuestion.trim()) {
            setAgentIntent(prev => ({
                ...prev,
                questions: [...prev.questions, newQuestion.trim()]
            }));
            setNewQuestion('');
        }
    };

    const removeQuestion = (index: number) => {
        setAgentIntent(prev => ({
            ...prev,
            questions: prev.questions.filter((_, i) => i !== index)
        }));
    };

    useEffect(() => {
        const fetchVoices = async () => {
            try {
                console.log('Fetching voices for brdge:', brdgeId);
                const response = await api.get(`/api/brdges/${brdgeId}/voices`);
                console.log('Voice response:', response.data);

                if (response.data?.voices) {
                    setSavedVoices(response.data.voices);
                    // If there are voices, select the first one by default
                    if (response.data.voices.length > 0) {
                        setSelectedVoice(response.data.voices[0].id);
                    }
                }
            } catch (error) {
                console.error('Error fetching voices:', error);
            }
        };

        if (brdgeId) {
            fetchVoices();
        }
    }, [brdgeId]);

    // Add tooltips content
    const tooltips = {
        agentIntent: "Describe how you want the AI to behave. For example:\n- 'Act as an expert who simplifies complex topics'\n- 'Be a friendly guide who encourages questions'\n- 'Maintain a professional, formal tone'",
        questions: "Add questions that the AI should try to get answers for during viewer interactions. These help gather specific information from users."
    };

    return (
        <div className="h-full overflow-y-auto bg-gray-900">
            <div className="p-6 space-y-8">
                {/* Steps Guide */}
                {agentType === 'edit' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-gray-200">How it works</h3>
                        <div className="flex justify-between relative">
                            {/* Progress Line */}
                            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-800" />

                            {/* Active Progress Line */}
                            <div
                                className="absolute top-4 left-0 h-0.5 bg-cyan-500/50 transition-all duration-500"
                                style={{ width: `${(currentStep - 1) * 33.33}%` }}
                            />

                            {/* Steps */}
                            {[
                                {
                                    number: 1,
                                    title: "Walkthrough",
                                    subtitle: "Present & Record",
                                    tooltip: "Present your slides naturally while the AI learns your style and content."
                                },
                                {
                                    number: 2,
                                    title: "Generate",
                                    subtitle: "Review Script",
                                    tooltip: "Review and customize the AI-generated presentation script."
                                },
                                {
                                    number: 3,
                                    title: "Configure",
                                    subtitle: "Voice & Agent",
                                    tooltip: "Set up your voice clone and configure the AI behavior."
                                },
                                {
                                    number: 4,
                                    title: "Share",
                                    subtitle: "Publish",
                                    tooltip: "Share your Brdge with others."
                                }
                            ].map((step) => (
                                <div key={step.number} className="relative z-10 flex flex-col items-center group">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center mb-2
                                        transition-all duration-300
                                        ${isStepActive(step.number)
                                            ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50 animate-pulse'
                                            : 'bg-gray-800 text-gray-400'
                                        }
                                    `}>
                                        {step.number}
                                    </div>
                                    <p className={`text-sm font-medium transition-colors duration-300 
                                        ${isStepActive(step.number) ? 'text-cyan-400' : 'text-gray-400'}`}>
                                        {step.title}
                                    </p>
                                    <p className="text-xs text-gray-500">{step.subtitle}</p>

                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 w-48 p-2 bg-gray-800 rounded-md text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {step.tooltip}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Voice Configuration Section - Moved up */}
                {agentType === 'edit' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-gray-200">Voice Configuration</h3>

                        {/* Voice Selection */}
                        <div className="space-y-3">
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

                        {/* New Voice Creation */}
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
                                <div className="space-y-3">
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

                                    {/* Recording Preview */}
                                    {currentRecording && (
                                        <div className="space-y-3">
                                            <audio
                                                src={URL.createObjectURL(currentRecording)}
                                                controls
                                                className="w-full"
                                            />
                                            <button
                                                onClick={handleCloneVoice}
                                                disabled={!voiceName || isCloning}
                                                className="w-full px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-md hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {isCloning ? 'Creating Voice Clone...' : 'Create Voice Clone'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Agent Configuration - Moved down */}
                {agentType === 'edit' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-gray-200">Agent Configuration</h3>

                        {/* Intent/Prompt */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-400">Agent Intent</label>
                                <div className="relative group">
                                    <button className="text-cyan-400 hover:text-cyan-300">
                                        <span className="text-xs">(?)</span>
                                    </button>
                                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-800 rounded-md text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line">
                                        {tooltips.agentIntent}
                                    </div>
                                </div>
                            </div>
                            <textarea
                                value={agentIntent.prompt}
                                onChange={(e) => setAgentIntent(prev => ({ ...prev, prompt: e.target.value }))}
                                placeholder="Describe how you want the AI to behave when presenting (e.g., 'Act as an enthusiastic teacher who makes complex topics simple')"
                                className="w-full h-24 bg-gray-800 text-gray-200 rounded-md px-3 py-2 resize-none"
                            />
                        </div>

                        {/* Questions List */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-400">Information to Extract</label>
                                <div className="relative group">
                                    <button className="text-cyan-400 hover:text-cyan-300">
                                        <span className="text-xs">(?)</span>
                                    </button>
                                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-800 rounded-md text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {tooltips.questions}
                                    </div>
                                </div>
                            </div>

                            {/* Add Question Input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newQuestion}
                                    onChange={(e) => setNewQuestion(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && addQuestion()}
                                    placeholder="Add a question to ask viewers..."
                                    className="flex-1 bg-gray-800 text-gray-200 rounded-md px-3 py-2"
                                />
                                <button
                                    onClick={addQuestion}
                                    className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-md hover:bg-cyan-500/30"
                                >
                                    Add
                                </button>
                            </div>

                            {/* Questions List */}
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {agentIntent.questions.map((question, index) => (
                                    <div key={index} className="flex items-center justify-between bg-gray-800 rounded-md px-3 py-2">
                                        <span className="text-gray-300">{question}</span>
                                        <button
                                            onClick={() => removeQuestion(index)}
                                            className="text-gray-500 hover:text-red-400"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 