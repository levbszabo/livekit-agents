import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatMessage as ComponentsChatMessage } from "@livekit/components-react";
import { useEffect, useRef } from "react";
import { Send } from 'lucide-react';

const inputHeight = 48;

export type ChatMessageType = {
  name: string;
  message: string;
  isSelf: boolean;
  timestamp: number;
};

type ChatTileProps = {
  messages: ChatMessageType[];
  accentColor: string;
  onSend?: (message: string) => Promise<ComponentsChatMessage>;
  className?: string;
};

export const ChatTile = ({ messages, accentColor, onSend, className = '' }: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef, messages]);

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
        <div className="flex flex-col min-h-full justify-end py-3 space-y-2">
          {messages.map((message, index, allMsg) => {
            const hideName = index >= 1 && allMsg[index - 1].name === message.name;
            return (
              <ChatMessage
                key={index}
                hideName={hideName}
                name={message.name}
                message={message.message}
                isSelf={message.isSelf}
                accentColor={accentColor}
              />
            );
          })}
        </div>
      </div>
      {onSend && (
        <div className="
          sticky bottom-0 left-0 right-0
          px-3 py-2 bg-[#121212]/95 backdrop-blur-sm
          border-t border-gray-800/50
        ">
          <div className="relative group">
            <textarea
              placeholder="Type a message..."
              className="
                w-full pr-10 py-2 px-3
                bg-gray-800/50 text-[11px] text-gray-300
                placeholder:text-gray-600
                rounded-lg resize-none
                border border-gray-700/50
                focus:outline-none focus:border-cyan-500/50
                transition-all duration-300
                min-h-[36px] max-h-[84px]
                scrollbar-thin scrollbar-track-transparent
                scrollbar-thumb-gray-700/30
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
                e.target.style.height = Math.min(e.target.scrollHeight, 84) + 'px';
              }}
            />
            <button
              className="
                absolute right-2 top-1/2 -translate-y-1/2
                p-1.5 rounded-md
                text-gray-400 hover:text-cyan-400
                transition-colors duration-300
                opacity-50 group-focus-within:opacity-100
                hover:bg-cyan-500/10
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
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
