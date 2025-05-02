import React, { useState, useEffect, useRef } from 'react';

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
  // No internal state for animation - we'll use CSS instead
  // This will ensure the animation only happens for new content

  return (
    <div
      className={`
        group relative
        ${isSelf ? 'ml-auto' : 'mr-auto'}
        max-w-[90%]
        ${isSelf
          ? 'bg-blue-50'
          : 'bg-gray-100'
        }
        rounded-lg
        border border-gray-200
        transition-all duration-300
        ${isSelf
          ? 'hover:bg-blue-100'
          : 'hover:bg-gray-200'
        }
      `}
    >
      {/* Message content */}
      <div className="px-3 py-2 relative">
        {/* Sender name */}
        {!hideName && (
          <div className={`
            text-[10px] font-medium mb-1
            ${isSelf ? 'text-blue-700 text-right' : 'text-gray-600'}
          `}>
            {name}
          </div>
        )}

        {/* Message text - No typewriter animation */}
        <div
          className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[1em]"
        >
          {message}
        </div>
      </div>
    </div>
  );
};
