import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatMessage as ComponentsChatMessage } from "@livekit/components-react";
import { useEffect, useRef, useMemo } from "react";
import { Send } from 'lucide-react';
import styled, { keyframes } from 'styled-components';

// Define the keyframes animation properly
const lightScanAnimation = keyframes`
  0% { transform: translateX(0%); opacity: 0; }
  50% { opacity: 0.2; }
  100% { transform: translateX(500%); opacity: 0; }
`;

// Create a styled component for the light scan effect
const LightScanEffect = styled.div`
  position: absolute;
  top: 0;
  left: -20px;
  width: 20px;
  height: 100%;
  background: linear-gradient(to right, transparent, ${props => props.color || 'rgba(34,211,238,0.1)'}, transparent);
  transform: skewX(-35deg);
  animation: ${lightScanAnimation} 3s ease-in-out infinite;
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
          scrollbar-thumb-gray-700/30 hover:scrollbar-thumb-cyan-500/20
        "
      >
        <div className="flex flex-col min-h-full justify-end py-3 space-y-1.5">
          {/* Map over the processed (combined) messages */}
          {processedMessages.map((message, index, allProcessedMsg) => {
            // Name hiding logic remains similar but uses the processed list
            const hideName = index >= 1 && allProcessedMsg[index - 1].name === message.name;
            // Use a key stable across combines for the same message block
            const key = `${message.name}-${message.originalTimestamp}-${message.isSelf}`;
            return (
              <ChatMessage
                key={key} // Use the stable key
                hideName={hideName}
                name={message.name}
                message={message.message} // Pass the potentially combined message
                isSelf={message.isSelf}
                accentColor={accentColor}
                LightScanEffect={LightScanEffect}
              />
            );
          })}
        </div>
      </div>
      {onSend && (
        <div className="sticky bottom-0 left-0 right-0 px-3 py-2 bg-[#121212] border-t border-gray-800/40">
          <div className="relative group">
            <textarea
              placeholder="Type a message..."
              className="
                w-full pr-8 py-2 px-3
                bg-[#1A1A1A] 
                text-[11px] text-gray-200
                placeholder:text-gray-500
                rounded-md resize-none
                border border-gray-700/50
                focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/10
                transition-all duration-300
                min-h-[32px] max-h-[80px]
                scrollbar-thin scrollbar-track-transparent
                scrollbar-thumb-gray-700/40
                hover:scrollbar-thumb-cyan-500/20
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
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
            />
            <button
              className="
                absolute right-2 top-1/2 -translate-y-1/2
                p-1.5 rounded-md
                text-gray-500 hover:text-cyan-400/80
                transition-colors duration-200
                hover:bg-cyan-500/5
              "
              onClick={() => {
                const textarea = document.querySelector('textarea');
                if (textarea) {
                  const value = textarea.value.trim();
                  if (value) {
                    onSend(value);
                    textarea.value = '';
                    textarea.style.height = '32px';
                  }
                }
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
