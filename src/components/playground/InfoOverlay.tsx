import { ReactNode } from 'react';

interface StepInfo {
    number: number;
    title: string;
    description: string;
    status: 'pending' | 'active' | 'completed';
}

interface InfoOverlayProps {
    isVisible: boolean;
    walkthroughCount: number;
    hasScripts?: boolean;
    isGenerating?: boolean;
}

export const InfoOverlay = ({
    isVisible,
    walkthroughCount,
    hasScripts = false,
    isGenerating = false
}: InfoOverlayProps) => {
    const steps: StepInfo[] = [
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
            status: walkthroughCount === 0 ? 'pending' :
                hasScripts ? 'completed' :
                    isGenerating ? 'active' : 'active'
        }
    ];

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-lg p-8 max-w-xl w-full mx-4">
                <h2 className="text-xl font-medium text-white mb-6">How to Create Your Brdge</h2>
                <div className="space-y-6">
                    {steps.map((step) => (
                        <div key={step.number} className="flex gap-4">
                            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center shrink-0
                ${step.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    step.status === 'active' ? 'bg-cyan-500/20 text-cyan-400 animate-pulse' :
                                        'bg-gray-800 text-gray-500'}
              `}>
                                {step.number}
                            </div>
                            <div>
                                <h3 className={`font-medium mb-1 
                  ${step.status === 'completed' ? 'text-green-400' :
                                        step.status === 'active' ? 'text-cyan-400' :
                                            'text-gray-400'}
                `}>
                                    {step.title}
                                </h3>
                                <p className="text-gray-400 text-sm">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}; 