interface StepInfo {
    number: number;
    title: string;
    description: string;
    status: 'pending' | 'active' | 'completed';
}

interface InfoPanelProps {
    walkthroughCount: number;
    agentType?: 'view' | 'edit';
}

export const InfoPanel = ({
    walkthroughCount,
    agentType = 'edit'
}: InfoPanelProps) => {
    // Different steps for edit and view modes
    const editSteps: StepInfo[] = [
        {
            number: 1,
            title: "Start Walkthrough",
            description: "Present your slides while our AI assistant asks clarifying questions to understand your content.",
            status: walkthroughCount === 0 ? 'active' : 'completed'
        },
        {
            number: 2,
            title: "Generate Brdge",
            description: "Create an AI version of your presentation that can interact with others on your behalf.",
            status: walkthroughCount === 0 ? 'pending' : 'active'
        },
        {
            number: 3,
            title: "Share with Others",
            description: "Share your Brdge publicly or with specific people to help them understand your content.",
            status: 'pending'
        }
    ];

    const viewSteps: StepInfo[] = [
        {
            number: 1,
            title: "Interactive Presentation",
            description: "Navigate through the slides using the Previous and Next buttons.",
            status: 'active'
        },
        {
            number: 2,
            title: "AI Assistant",
            description: "Click 'Play' to start an interactive session with the AI presenter.",
            status: 'active'
        },
        {
            number: 3,
            title: "Ask Questions",
            description: "During the presentation, use your microphone to ask questions and get real-time responses.",
            status: 'active'
        }
    ];

    const steps = agentType === 'edit' ? editSteps : viewSteps;

    return (
        <div className="flex-1 p-6 flex flex-col">
            {agentType === 'view' && (
                <div className="mb-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <h2 className="text-cyan-400 font-medium mb-2">Welcome to Brdge AI</h2>
                    <p className="text-gray-300 text-sm">
                        This is an AI-powered version of the presentation. You can interact with it just like you would with the original presenter.
                    </p>
                </div>
            )}

            <div className="space-y-6">
                {steps.map((step) => (
                    <div key={step.number} className="flex gap-4 items-start">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1
                            ${agentType === 'view'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : step.status === 'completed'
                                    ? 'bg-green-500/20 text-green-400'
                                    : step.status === 'active'
                                        ? 'bg-cyan-500/20 text-cyan-400 animate-pulse'
                                        : 'bg-gray-800 text-gray-500'
                            }
                        `}>
                            {step.number}
                        </div>
                        <div>
                            <h3 className={`font-medium mb-2 
                                ${agentType === 'view'
                                    ? 'text-cyan-400'
                                    : step.status === 'completed'
                                        ? 'text-green-400'
                                        : step.status === 'active'
                                            ? 'text-cyan-400'
                                            : 'text-gray-400'
                                }
                            `}>
                                {step.title}
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}; 