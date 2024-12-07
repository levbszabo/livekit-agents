interface RecordingTipsProps {
    tips: string[];
}

export const RecordingTips: React.FC<RecordingTipsProps> = ({ tips }) => {
    return (
        <div className="tips-container space-y-4">
            <h3 className="font-bold text-xl tracking-tight mb-4 text-white">
                Recording Tips
            </h3>
            <ul className="space-y-3">
                {tips.map((tip, index) => (
                    <li
                        key={index}
                        className="font-medium text-base leading-relaxed flex items-start gap-2 text-gray-300"
                    >
                        <span className="text-cyan-500">•</span>
                        {tip}
                    </li>
                ))}
            </ul>
        </div>
    );
}; 