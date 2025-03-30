import React from 'react';

type ChatMessageProps = {
  name: string;
  message: string;
  isSelf: boolean;
  hideName?: boolean;
  accentColor: string;
  LightScanEffect?: any;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  name,
  message,
  isSelf,
  hideName = false,
  accentColor,
  LightScanEffect
}) => {
  return (
    <div
      className={`
        group relative 
        ${isSelf ? 'ml-auto' : 'mr-auto'} 
        max-w-[80%]
        ${isSelf
          ? 'bg-[#162730]/90'
          : 'bg-[#2A1F14]/90'
        }
        rounded-md
        backdrop-blur-sm
        ${isSelf
          ? 'border-l border-cyan-600/30'
          : 'border-l border-amber-700/30'
        }
        transition-all duration-300
        hover:border-opacity-50
      `}
    >
      {/* Message content */}
      <div className="p-2 relative">
        {/* Sender name */}
        {!hideName && (
          <div className={`
            text-[10px] font-medium mb-0.5
            ${isSelf ? 'text-cyan-400/80' : 'text-amber-400/80'}
          `}>
            {name}
          </div>
        )}

        {/* Message text */}
        <div className="text-[11px] text-gray-300 leading-relaxed font-light">
          {message}
        </div>

        {/* Subtle scan effect on hover */}
        {LightScanEffect && (
          <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <LightScanEffect color={isSelf ? 'rgba(34,211,238,0.07)' : 'rgba(245,158,11,0.07)'} />
          </div>
        )}
      </div>

      {/* Subtle accent line on top */}
      <div className={`
        absolute top-0 left-0 right-0 h-[1px]
        ${isSelf
          ? 'bg-gradient-to-r from-cyan-500/10 via-cyan-400/5 to-transparent'
          : 'bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent'
        }
      `}></div>
    </div>
  );
};
