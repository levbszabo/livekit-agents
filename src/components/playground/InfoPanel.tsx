import { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '@/config';
import { api } from '@/api';
import { MicrophoneIcon, DocumentTextIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

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

type TabId = 'guide' | 'voice' | 'scripts';

interface TabContent {
    id: TabId;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    show: boolean;  // Control tab visibility based on state
}

interface StepItemProps {
    number: number;
    title: string;
    subtitle: string;
    description: string;
    isActive: boolean;
}

interface VoiceContentProps {
    brdgeId: string | number;
    voiceName: string;
    setVoiceName: (name: string) => void;
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    recordingTime: number;
    formatTime: (seconds: number) => string;
    currentRecording: Blob | null;
    handleCloneVoice: () => void;
    isCloning: boolean;
    savedVoices: VoiceConfig[];
    selectedVoice: string | null;
    setSelectedVoice: (id: string | null) => void;
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

            // Refresh voice list immediately after successful clone
            const voicesResponse = await api.get(`/api/brdges/${brdgeId}/voices`);
            if (voicesResponse.data?.voices) {
                setSavedVoices(voicesResponse.data.voices);

                // If we got a new voice ID, select it
                if (response.data?.voice?.cartesia_voice_id) {
                    setSelectedVoice(response.data.voice.cartesia_voice_id);
                }

                // Reset recording state
                setCurrentRecording(null);
                setVoiceName('');
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

    // Add useEffect to load voices on mount
    useEffect(() => {
        const loadVoices = async () => {
            if (!brdgeId) return;
            try {
                const response = await api.get(`/api/brdges/${brdgeId}/voices`);
                if (response.data?.voices) {
                    setSavedVoices(response.data.voices);
                    console.log('Loaded voices:', response.data.voices);
                }
            } catch (error) {
                console.error('Error loading voices:', error);
            }
        };

        loadVoices();
    }, [brdgeId]);

    const [activeTab, setActiveTab] = useState<TabId>('guide');

    // Define available tabs
    const tabs: TabContent[] = [
        {
            id: 'guide',
            title: 'Getting Started',
            icon: InformationCircleIcon,
            show: true,  // Always show
        },
        {
            id: 'voice',
            title: 'Voice Setup',
            icon: MicrophoneIcon,
            show: agentType === 'edit',  // Only show in edit mode
        },
        {
            id: 'scripts',
            title: 'Script Editor',
            icon: DocumentTextIcon,
            show: agentType === 'edit' && scripts !== null,  // Show when scripts are available
        },
    ];

    return (
        <div className="h-full flex flex-col bg-gray-900">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-800">
                {tabs.filter(tab => tab.show).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors
                            ${activeTab === tab.id
                                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-gray-800/30'
                                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/20'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.title}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                    {activeTab === 'guide' && (
                        <GuideContent
                            walkthroughCount={walkthroughCount}
                            isGenerating={isGenerating}
                        />
                    )}
                    {activeTab === 'voice' && (
                        <VoiceContent
                            brdgeId={brdgeId}
                            voiceName={voiceName}
                            setVoiceName={setVoiceName}
                            isRecording={isRecording}
                            startRecording={startRecording}
                            stopRecording={stopRecording}
                            recordingTime={recordingTime}
                            formatTime={formatTime}
                            currentRecording={currentRecording}
                            handleCloneVoice={handleCloneVoice}
                            isCloning={isCloning}
                            savedVoices={savedVoices}
                            selectedVoice={selectedVoice}
                            setSelectedVoice={setSelectedVoice}
                        />
                    )}
                    {activeTab === 'scripts' && (
                        <ScriptsContent
                            scripts={scripts}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Split content into separate components for better organization
function GuideContent({ walkthroughCount, isGenerating }: { walkthroughCount: number; isGenerating: boolean }) {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-200">How it works</h3>
            <div className="relative">
                {/* Progress Line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-800" />

                {/* Steps */}
                <div className="relative z-10 flex justify-between">
                    {[
                        {
                            number: 1,
                            title: "Walkthrough",
                            subtitle: "Present & Record",
                            description: "Present your slides naturally while the AI learns your style and content. Take your time to explain each slide as you normally would."
                        },
                        {
                            number: 2,
                            title: "Generate",
                            subtitle: "Create Brdge",
                            description: "Our AI processes your presentation to create an interactive version that maintains your unique style and expertise. Once generated, you can edit the scripts to perfect them."
                        },
                        {
                            number: 3,
                            title: "Share",
                            subtitle: "Publish",
                            description: "Share your Brdge with others, allowing them to interact with your content in your voice and style."
                        }
                    ].map((step) => (
                        <StepItem key={step.number} {...step} isActive={step.number === 1} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function StepItem({ number, title, subtitle, description, isActive }: StepItemProps) {
    return (
        <div className="flex flex-col items-center group relative">
            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center mb-2
                transition-all duration-300
                ${isActive
                    ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50 animate-pulse'
                    : 'bg-gray-800 text-gray-400'
                }
            `}>
                {number}
            </div>
            <div className="text-center space-y-1 max-w-[200px]">
                <p className={`text-sm font-medium transition-colors duration-300 
                    ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                    {title}
                </p>
                <p className="text-xs text-gray-500">{subtitle}</p>
                <p className="text-xs text-gray-400">{description}</p>
            </div>
        </div>
    );
}

function VoiceContent({
    brdgeId,
    voiceName,
    setVoiceName,
    isRecording,
    startRecording,
    stopRecording,
    recordingTime,
    formatTime,
    currentRecording,
    handleCloneVoice,
    isCloning,
    savedVoices,
    selectedVoice,
    setSelectedVoice
}: VoiceContentProps) {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-200">Voice Configuration</h3>

            {/* Voice Selection - Move this before the recording controls */}
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

            {/* Only show recording controls if no voice is selected */}
            {!selectedVoice && (
                <>
                    {/* Voice Tips */}
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                        <p className="text-sm text-gray-300">
                            Create a natural-sounding AI voice clone by following these tips:
                        </p>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li className="flex items-start gap-2">
                                <span className="text-cyan-400 mt-1">•</span>
                                Record 10-20 seconds of clear speech
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-cyan-400 mt-1">•</span>
                                Speak naturally at your normal pace
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-cyan-400 mt-1">•</span>
                                You can read from your slides or speak freely
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-cyan-400 mt-1">•</span>
                                Avoid background noise and echoes
                            </li>
                        </ul>
                    </div>

                    {/* Voice Controls */}
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
                </>
            )}
        </div>
    );
}

interface ScriptsContentProps {
    scripts: Record<string, string> | null | undefined;
}

function ScriptsContent({ scripts }: ScriptsContentProps) {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-200">Script Preview & Editing</h3>
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-300">
                    Fine-tune your Brdge's responses:
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">•</span>
                        Edit the generated scripts for each slide to perfect the content
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">•</span>
                        Click the Play button to preview how your Brdge will interact
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">•</span>
                        Test different questions to ensure the responses are as expected
                    </li>
                </ul>
            </div>
        </div>
    );
} 