import { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '@/config';
import { api } from '@/api';

// Since there's a linter error about types, let's define it inline
type AgentType = 'edit' | 'view';

interface InfoPanelProps {
    walkthroughCount: number;
    agentType: AgentType;
    brdgeId: string | number;
    scripts?: Record<string, string> | null;
    isGenerating: boolean;
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

export function InfoPanel({ walkthroughCount, agentType, brdgeId, scripts, isGenerating }: InfoPanelProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [agentIntent, setAgentIntent] = useState<AgentIntent>({
        prompt: '',
        questions: []
    });
    const [newQuestion, setNewQuestion] = useState('');

    // Voice-related state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
    const [voiceName, setVoiceName] = useState('');
    const [isCloning, setIsCloning] = useState(false);
    const [savedVoices, setSavedVoices] = useState<VoiceConfig[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Add tooltips content
    const tooltips = {
        agentIntent: "Describe how you want the AI to behave. For example:\n- 'Act as an expert who simplifies complex topics'\n- 'Be a friendly guide who encourages questions'\n- 'Maintain a professional, formal tone'",
        questions: "Add questions that the AI should try to get answers for during viewer interactions. These help gather specific information from users."
    };

    // Use the isGenerating prop directly in isStepActive
    const isStepActive = (stepNumber: number) => {
        if (walkthroughCount === 0) return stepNumber === 1;
        if (walkthroughCount > 0 && !scripts) {
            if (isGenerating) return stepNumber === 2;
            return stepNumber === 2;
        }
        return stepNumber === 3;
    };

    // Voice recording handlers
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

    // Format time for recording display
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle voice cloning
    const handleCloneVoice = async () => {
        if (!currentRecording || !voiceName) return;
        setIsCloning(true);
        try {
            const formData = new FormData();
            formData.append('audio', currentRecording);
            formData.append('name', voiceName);

            const response = await api.post(`/api/brdges/${brdgeId}/voice/clone`, formData);
            if (response.data?.voice_id) {
                setSelectedVoice(response.data.voice_id);
                // Refresh voice list
                const voicesResponse = await api.get(`/api/brdges/${brdgeId}/voices`);
                setSavedVoices(voicesResponse.data.voices || []);
            }
        } catch (error) {
            console.error('Error cloning voice:', error);
        } finally {
            setIsCloning(false);
        }
    };

    // Question handlers
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

    const [editedScripts, setEditedScripts] = useState<Record<string, string>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize editedScripts when scripts prop changes
    useEffect(() => {
        if (scripts) {
            setEditedScripts(scripts);
        }
    }, [scripts]);

    const handleScriptChange = (slideNumber: string, content: string) => {
        setEditedScripts(prev => ({
            ...prev,
            [slideNumber]: content
        }));
        setHasChanges(true);
    };

    const handleSaveChanges = async () => {
        try {
            await api.post(`/api/brdges/${brdgeId}/scripts/update`, {
                scripts: editedScripts
            });
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving script changes:', error);
        }
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
                                    subtitle: "Create Brdge",
                                    tooltip: "Generate an AI version of your presentation."
                                },
                                {
                                    number: 3,
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
                        {isGenerating && (
                            <div className="mt-4 text-center">
                                <div className="animate-pulse text-cyan-400">
                                    Generating Brdge...
                                </div>
                                <div className="text-sm text-gray-500 mt-2">
                                    This may take a few minutes
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Hide Agent Configuration section for now */}
                {/* {agentType === 'edit' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-gray-200">Agent Configuration</h3>
                        ... agent configuration content ...
                    </div>
                )} */}

                {/* Voice Configuration */}
                {agentType === 'edit' && scripts && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-semibold text-gray-200">Voice Configuration</h3>

                        {/* Voice Selection */}
                        <div className="space-y-3">
                            <label className="text-sm text-gray-400">Select Voice</label>
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

                        {/* Voice Recording */}
                        {!selectedVoice && (
                            <div className="space-y-4">
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

                                <div className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`px-4 py-2 rounded-md flex items-center gap-2 ${isRecording
                                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                                }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'
                                                }`} />
                                            {isRecording ? 'Stop Recording' : 'Record Voice'}
                                        </button>
                                        {isRecording && (
                                            <span className="text-gray-400">
                                                {formatTime(recordingTime)}
                                            </span>
                                        )}
                                    </div>

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
                                                className="w-full px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-md hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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

            </div>
        </div>
    );
} 