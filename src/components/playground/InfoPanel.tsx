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

export function InfoPanel({ walkthroughCount, agentType, brdgeId, scripts }: InfoPanelProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [agentIntent, setAgentIntent] = useState<AgentIntent>({
        prompt: '',
        questions: []
    });
    const [newQuestion, setNewQuestion] = useState('');

    // Add tooltips content
    const tooltips = {
        agentIntent: "Describe how you want the AI to behave. For example:\n- 'Act as an expert who simplifies complex topics'\n- 'Be a friendly guide who encourages questions'\n- 'Maintain a professional, formal tone'",
        questions: "Add questions that the AI should try to get answers for during viewer interactions. These help gather specific information from users."
    };

    // Add question handlers
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

    const isStepActive = (stepNumber: number) => {
        if (walkthroughCount === 0) return stepNumber === 1;
        if (walkthroughCount > 0 && !scripts) return stepNumber === 2;
        return stepNumber === 3;
    };

    return (
        <div className="h-full overflow-y-auto bg-gray-900">
            <div className="p-6 space-y-8">
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
                    </div>
                )}

                {/* Agent Configuration */}
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
                                placeholder="Describe how you want the AI to behave when presenting..."
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