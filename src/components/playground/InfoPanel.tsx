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

            const response = await api.post(`/brdges/${brdgeId}/voice/clone`, formData);

            // Refresh voice list immediately after successful clone
            const voicesResponse = await api.get(`/brdges/${brdgeId}/voices`);
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
            await api.post(`/brdges/${brdgeId}/scripts/update`, {
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
                const response = await api.get(`/brdges/${brdgeId}/voices`);
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
                        className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium tracking-tight transition-colors
                            ${activeTab === tab.id
                                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-gray-800/30'
                                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/20'}`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.title}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                    {activeTab === 'guide' && (
                        <GuideContent
                            walkthroughCount={walkthroughCount}
                            isGenerating={isGenerating}
                            agentType={agentType}
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
function GuideContent({ walkthroughCount, isGenerating, agentType }: {
    walkthroughCount: number;
    isGenerating: boolean;
    agentType: 'edit' | 'view';
}) {
    if (agentType === 'view') {
        return (
            <div className="space-y-8">
                <h3 className="text-xl font-semibold text-gray-200">How it works</h3>
                {/* Keep existing view mode content */}
                <div className="relative px-4">
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-800" />
                    <div className="relative z-10 flex justify-between gap-8">
                        {[
                            {
                                number: 1,
                                title: "Listen & Learn",
                                subtitle: "Interactive Presentation",
                                description: "The AI presents each slide and engages in discussion"
                            },
                            {
                                number: 2,
                                title: "Ask Questions",
                                subtitle: "Real-time Interaction",
                                description: "Get contextual answers about the content"
                            },
                            {
                                number: 3,
                                title: "Explore Topics",
                                subtitle: "Deep Understanding",
                                description: "Request examples and clarifications"
                            }
                        ].map((step) => (
                            <StepItem key={step.number} {...step} isActive={step.number === 1} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Edit mode content
    return (
        <div className="space-y-6">
            <h3 className="text-[16px] font-semibold text-gray-200 tracking-tight">Recording Walkthrough</h3>

            <div className="relative px-4">
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-800" />
                <div className="relative z-10 flex justify-between gap-8">
                    {[
                        {
                            number: 1,
                            title: "Present",
                            subtitle: "Natural Explanation",
                            description: "Walk through your slides naturally, explaining key points"
                        },
                        {
                            number: 2,
                            title: "Interact",
                            subtitle: "AI Learning",
                            description: "The AI will ask clarifying questions to understand your content"
                        },
                        {
                            number: 3,
                            title: "Review",
                            subtitle: "Verify Content",
                            description: "Ensure the AI has captured your message accurately"
                        }
                    ].map((step) => (
                        <StepItem
                            key={step.number}
                            {...step}
                            isActive={
                                (walkthroughCount === 0 && step.number === 1) ||
                                (walkthroughCount > 0 && step.number === 2) ||
                                (isGenerating && step.number === 3)
                            }
                        />
                    ))}
                </div>
            </div>

            {/* Recording Tips */}
            <div className="space-y-3">
                <h4 className="text-[14px] font-medium text-gray-300 tracking-tight">Recording Tips</h4>
                <div className="bg-gray-800/50 rounded-lg p-3">
                    <ul className="space-y-2 text-[12px] text-gray-400 leading-snug">
                        <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            Speak naturally as if presenting to your audience
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            Take your time to explain complex concepts
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            Answer AI questions to provide more context
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            Use examples to illustrate your points
                        </li>
                    </ul>
                </div>
            </div>

            {/* Current Status */}
            <div className="space-y-2">
                <h4 className="text-[14px] font-medium text-gray-300 tracking-tight">Recording Status</h4>
                <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-400">Walkthrough Progress</span>
                        <span className="text-cyan-400">
                            {isGenerating ? 'Processing...' : `${walkthroughCount} recordings`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StepItem({ number, title, subtitle, description, isActive }: StepItemProps) {
    return (
        <div className="flex flex-col items-center group">
            <div className={`
                w-6 h-6 rounded-full flex items-center justify-center mb-2
                transition-all duration-300 text-[12px]
                ${isActive
                    ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50 animate-pulse'
                    : 'bg-gray-800 text-gray-400'
                }
            `}>
                {number}
            </div>
            <div className="text-center space-y-1 max-w-[160px]">
                <p className={`text-[13px] font-medium tracking-tight transition-colors duration-300 
                    ${isActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                    {title}
                </p>
                <p className="text-[11px] text-gray-500 leading-tight">{subtitle}</p>
                <p className="text-[11px] text-gray-400 leading-snug">{description}</p>
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
        <div className="space-y-4">
            <h3 className="text-[16px] font-semibold text-gray-200 tracking-tight">Voice Configuration</h3>

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
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <p className="text-[12px] text-gray-300 leading-snug">
                            Create a natural-sounding AI voice clone by following these tips:
                        </p>
                        <ul className="space-y-1.5 text-[12px] text-gray-400 leading-snug">
                            <li className="flex items-start gap-1.5">
                                <span className="text-cyan-400 mt-0.5">•</span>
                                Record 10-20 seconds of clear speech
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-cyan-400 mt-0.5">•</span>
                                Speak naturally at your normal pace
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-cyan-400 mt-0.5">•</span>
                                You can read from your slides or speak freely
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-cyan-400 mt-0.5">•</span>
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
                    Fine-tune your Brdge&apos;s responses:
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