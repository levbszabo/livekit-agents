interface WalkthroughStepProps {
    stepNumber: number;
    title: string;
    description: string;
}

export const WalkthroughStep: React.FC<WalkthroughStepProps> = ({
    stepNumber,
    title,
    description
}) => {
    return (
        <div className="walkthrough-step flex flex-col gap-3">
            <div className="step-number font-black text-2xl text-cyan-500">
                {stepNumber}
            </div>
            <div className="step-title font-bold tracking-tight text-xl text-white">
                {title}
            </div>
            <div className="step-description font-medium leading-relaxed text-gray-300">
                {description}
            </div>
        </div>
    );
}; 