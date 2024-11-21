interface StepInfo {
    number: number;
    title: string;
    description: string;
    status: 'pending' | 'active' | 'completed';
}

export const InfoPanel = ({
    walkthroughCount,
}: {
    walkthroughCount: number;
}) => {
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
            status: walkthroughCount === 0 ? 'pending' : 'active'
        },
        {
            number: 3,
            title: "Share with Others",
            description: "Share your Brdge publicly or with specific people to help them understand your content.",
            status: 'pending'
        }
    ];

    return (
        <div className="flex-1 p-6 flex flex-col">
            <div className="space-y-6">
                {steps.map((step) => (
                    <div key={step.number} className="flex gap-4 items-start">
                        <div className={`
              w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1
              ${step.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                step.status === 'active' ? 'bg-cyan-500/20 text-cyan-400 animate-pulse' :
                                    'bg-gray-800 text-gray-500'}
            `}>
                            {step.number}
                        </div>
                        <div>
                            <h3 className={`font-medium mb-2 
                ${step.status === 'completed' ? 'text-green-400' :
                                    step.status === 'active' ? 'text-cyan-400' :
                                        'text-gray-400'}
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