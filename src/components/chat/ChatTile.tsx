import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatMessage as ComponentsChatMessage } from "@livekit/components-react";
import { useEffect, useRef, useMemo } from "react";
import { Feather, Send } from 'lucide-react';
import styled, { keyframes } from 'styled-components';

// Define the keyframes animation for ink unfurling effect
const inkUnfurlAnimation = keyframes`
  0% { transform: translateX(0%); opacity: 0; }
  50% { opacity: 0.3; }
  100% { transform: translateX(300%); opacity: 0; }
`;

// Create a styled component for the ink effect
const InkEffect = styled.div`
  position: absolute;
  top: 0;
  left: -20px;
  width: 20px;
  height: 100%;
  background: linear-gradient(to right, transparent, ${props => props.color || 'rgba(156,124,56,0.15)'}, transparent);
  transform: skewX(-35deg);
  animation: ${inkUnfurlAnimation} 3s ease-in-out infinite;
`;

const inputHeight = 48;

export type ChatMessageType = {
  name: string;
  message: string;
  isSelf: boolean;
  timestamp: number;
  originalTimestamp?: number;
};

type ChatTileProps = {
  messages: ChatMessageType[];
  accentColor: string;
  onSend?: (message: string) => Promise<ComponentsChatMessage>;
  className?: string;
};

export const ChatTile = ({ messages, accentColor, onSend, className = '' }: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Process messages to combine consecutive ones from the same non-self sender
  const processedMessages = useMemo(() => {
    if (!messages || messages.length === 0) {
      return [];
    }

    const combined: ChatMessageType[] = [];
    messages.forEach((msg) => {
      const prevMsg = combined.length > 0 ? combined[combined.length - 1] : null;

      // Combine if:
      // - There is a previous message
      // - The current message is not from 'self'
      // - The sender name matches the previous message
      // - The 'isSelf' status matches the previous message (ensures we don't combine self and other)
      if (prevMsg && !msg.isSelf && prevMsg.name === msg.name && prevMsg.isSelf === msg.isSelf) {
        // Append message content with a newline
        prevMsg.message += `\n${msg.message}`;
        // Update timestamp to the latest message in the combined block
        prevMsg.timestamp = msg.timestamp;
      } else {
        // Otherwise, add this message as a new entry (create a copy to avoid mutation)
        combined.push({ ...msg, originalTimestamp: msg.timestamp });
      }
    });
    return combined;
  }, [messages]); // Re-run only when the original messages array changes


  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    // Depend on processedMessages length to scroll when combined list changes
  }, [containerRef, processedMessages.length]);

  return (
    <div className={`flex flex-col w-full h-full ${className}`}>
      <div
        ref={containerRef}
        className="
          flex-1 px-3 overflow-y-auto
          scrollbar-thin scrollbar-track-transparent
          scrollbar-thumb-[#9C7C38]/20 hover:scrollbar-thumb-[#9C7C38]/30
          bg-[#F5EFE0]/90 backdrop-blur-sm
          after:absolute after:inset-0 after:bg-[url('/textures/parchment.png')] 
          after:bg-cover after:opacity-20 after:mix-blend-overlay after:pointer-events-none
        "
      >
        <div className="flex flex-col min-h-full justify-end py-3 space-y-2.5 relative z-10">
          {/* Map over the processed (combined) messages */}
          {processedMessages.map((message, index, allProcessedMsg) => {
            // Name hiding logic remains similar but uses the processed list
            const hideName = index >= 1 && allProcessedMsg[index - 1].name === message.name;
            // Use a key stable across combines for the same message block
            const key = `${message.name}-${message.originalTimestamp}-${message.isSelf}`;
            return (
              <div
                key={key}
                className={`
                  ${message.isSelf ? 'ml-auto' : 'mr-auto'} 
                  max-w-[95%]
                  relative group
                  transition-all duration-300
                `}
              >
                {/* Sender name - refined scholar style */}
                {!hideName && (
                  <div className={`
                    text-[11px] font-serif 
                    ${message.isSelf ? 'text-right mr-2 text-[#9C7C38]/90' : 'ml-2 text-[#9C7C38]/90'}
                    mb-0.5
                  `}>
                    {message.name}
                  </div>
                )}

                {/* Message bubble with refined styling */}
                <div
                  className={`
                    relative
                    ${message.isSelf
                      ? 'bg-[#FAF7ED]/80 border border-[#9C7C38]/15 pl-3 pr-4 py-2 rounded-md'
                      : 'bg-[#F5EFE0]/80 border border-[#9C7C38]/25 px-4 py-2 rounded-md'}
                    shadow-sm
                    transition-all duration-300
                    hover:border-[#9C7C38]/40
                    group-hover:shadow-sm
                    ${message.isSelf
                      ? 'hover:shadow-[0_1px_6px_rgba(156,124,56,0.08)]'
                      : 'hover:shadow-[0_1px_6px_rgba(156,124,56,0.12)]'}
                  `}
                >
                  {/* More subtle corner fold for user messages */}
                  {message.isSelf && (
                    <div className="absolute -top-[1px] -right-[1px] w-2.5 h-2.5 
                      bg-[#9C7C38]/5 rounded-bl-sm transform rotate-45"></div>
                  )}

                  {/* Refined scroll styling for AI messages */}
                  {!message.isSelf && (
                    <div className="absolute left-0 top-0 bottom-0 w-1
                      border-l border-[#9C7C38]/15 rounded-l-md"></div>
                  )}

                  {/* Smaller font size for message text */}
                  <div className={`
                    whitespace-pre-wrap
                    ${message.isSelf
                      ? 'text-[#0A1933] text-[11px] font-satoshi'
                      : 'text-[#1E2A42] text-[12px] font-serif'}
                    leading-relaxed
                  `}>
                    {message.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {onSend && (
        <div className="sticky bottom-0 left-0 right-0 px-3 py-2 
          bg-[#F5EFE0]/90 backdrop-blur-sm border-t border-[#9C7C38]/20
          after:absolute after:inset-0 after:bg-[url('/textures/parchment.png')] 
          after:bg-cover after:opacity-50 after:mix-blend-overlay after:pointer-events-none
        ">
          <div className="relative group">
            <textarea
              placeholder="Write a message..."
              className="
                w-full pr-10 py-2 px-3
                bg-[#FAF7ED]/80 
                text-[11px] text-[#0A1933]
                placeholder:text-[#1E2A42]/40
                rounded-lg resize-none
                border border-[#9C7C38]/20
                focus:outline-none focus:border-[#9C7C38]/40 focus:ring-1 focus:ring-[#9C7C38]/10
                hover:border-[#9C7C38]/30
                transition-all duration-300
                min-h-[36px] max-h-[100px]
                scrollbar-thin scrollbar-track-transparent
                scrollbar-thumb-[#9C7C38]/20
                hover:scrollbar-thumb-[#9C7C38]/30
                font-satoshi
              "
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const value = (e.target as HTMLTextAreaElement).value.trim();
                  if (value) {
                    onSend(value);
                    (e.target as HTMLTextAreaElement).value = '';
                  }
                }
              }}
              onChange={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
            />
            <button
              className="
                absolute right-2 top-1/2 -translate-y-1/2
                p-1.5 rounded-md
                text-[#9C7C38]/70 hover:text-[#9C7C38]
                transition-colors duration-200
                hover:bg-[#9C7C38]/5
              "
              onClick={() => {
                const textarea = document.querySelector('textarea');
                if (textarea) {
                  const value = textarea.value.trim();
                  if (value) {
                    onSend(value);
                    textarea.value = '';
                    textarea.style.height = '36px';
                  }
                }
              }}
            >
              <Feather size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
