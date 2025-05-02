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
          scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400
          bg-white
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
              <ChatMessage
                key={key}
                name={message.name}
                message={message.message}
                isSelf={message.isSelf}
                hideName={hideName}
                accentColor="blue"
              />
            );
          })}
        </div>
      </div>
      {onSend && (
        <div className="sticky bottom-0 left-0 right-0 px-3 py-2 
          bg-gray-50
          border-t border-gray-200
        ">
          <div className="relative group">
            <textarea
              placeholder="Write a message..."
              className="
                w-full pr-10 py-2 px-3
                bg-white
                text-[11px] text-gray-900
                placeholder:text-gray-500
                rounded-lg resize-none
                border border-gray-200
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20
                hover:border-gray-300
                transition-all duration-300
                min-h-[36px] max-h-[100px]
                scrollbar-thin scrollbar-track-transparent
                scrollbar-thumb-gray-300
                hover:scrollbar-thumb-gray-400
                font-sans
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
                text-blue-600 hover:text-blue-700
                transition-colors duration-200
                hover:bg-blue-100
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
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
