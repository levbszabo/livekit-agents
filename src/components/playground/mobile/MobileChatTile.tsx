import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Send, Mic, MicOff, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChatMessageType } from '@/components/chat/ChatTile';

// Extended message type to support error messages
interface ExtendedChatMessageType extends ChatMessageType {
    isError?: boolean;
}

interface MobileChatTileProps {
    messages: ExtendedChatMessageType[];
    accentColor: string;
    onSend?: (message: string) => Promise<any>;
    className?: string;
    isMicEnabled?: boolean;
    onToggleMic?: () => void;
}

export const MobileChatTile: React.FC<MobileChatTileProps> = ({
    messages,
    accentColor,
    onSend,
    className = '',
    isMicEnabled = false,
    onToggleMic
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [messageText, setMessageText] = useState('');

    // Process messages to combine consecutive ones from the same sender
    const processedMessages = useMemo(() => {
        if (!messages || messages.length === 0) {
            return [];
        }

        const combined: ExtendedChatMessageType[] = [];
        messages.forEach((msg) => {
            // Don't combine error messages
            if (msg.isError) {
                combined.push({ ...msg, originalTimestamp: msg.timestamp });
                return;
            }

            const prevMsg = combined.length > 0 ? combined[combined.length - 1] : null;

            if (prevMsg && !msg.isSelf && !prevMsg.isError && prevMsg.name === msg.name && prevMsg.isSelf === msg.isSelf) {
                // Combine messages from the same non-self sender
                prevMsg.message += `\n${msg.message}`;
                prevMsg.timestamp = msg.timestamp;
            } else {
                // Add as new message
                combined.push({ ...msg, originalTimestamp: msg.timestamp });
            }
        });
        return combined;
    }, [messages]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [processedMessages.length]);

    // Handle growing textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageText(e.target.value);

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                120
            )}px`;
        }
    };

    // Handle send message
    const handleSendMessage = async () => {
        if (!messageText.trim() || !onSend) return;

        try {
            await onSend(messageText.trim());
            setMessageText('');

            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = '44px';
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Handle key press (Enter to send)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className={`flex flex-col w-full h-full ${className}`}>
            {/* Message container */}
            <div
                ref={containerRef}
                className="
          flex-1 px-4 py-3 overflow-y-auto
          scrollbar-thin scrollbar-track-gray-100
          scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400
          bg-white backdrop-blur-sm
        "
            >
                <div className="flex flex-col min-h-full justify-end py-2 space-y-3 relative z-10">
                    {/* Chat messages */}
                    {processedMessages.map((message, index, allProcessedMsg) => {
                        // Hide name if consecutive messages from same sender
                        const hideName = index >= 1 && allProcessedMsg[index - 1].name === message.name;
                        const key = `${message.name}-${message.originalTimestamp}-${message.isSelf}`;

                        return (
                            <div
                                key={key}
                                className={`
                  ${message.isSelf ? 'ml-auto' : 'mr-auto'} 
                  max-w-[90%] // Wider bubbles for mobile
                  relative group
                  transition-all duration-300
                `}
                            >
                                {/* Sender name */}
                                {!hideName && (
                                    <div className={`
                    text-[12px] font-medium
                    ${message.isSelf ? 'text-right mr-2 text-gray-500' : 'ml-2 text-gray-500'}
                    mb-0.5
                  `}>
                                        {message.name}
                                    </div>
                                )}

                                {/* Message bubble */}
                                <div
                                    className={`
                    relative
                    ${message.isError
                                            ? 'bg-red-50 border border-red-200 px-4 py-2.5 rounded-md flex items-center'
                                            : message.isSelf
                                                ? 'bg-blue-50 border border-blue-200 pl-3 pr-4 py-2.5 rounded-md'
                                                : 'bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-md'
                                        }
                    shadow-sm
                    transition-all duration-300
                    ${message.isError ? 'hover:border-red-300' : (message.isSelf ? 'hover:border-blue-300' : 'hover:border-gray-300')}
                  `}
                                >
                                    {/* Error icon for error messages */}
                                    {message.isError && (
                                        <AlertCircle className="text-red-500 mr-2 flex-shrink-0" size={16} />
                                    )}

                                    {/* Message text with increased size for mobile */}
                                    <div className={`
                    whitespace-pre-wrap
                    ${message.isError
                                            ? 'text-red-700 text-[14px] font-satoshi'
                                            : message.isSelf
                                                ? 'text-gray-800 text-[14px] font-satoshi'
                                                : 'text-gray-800 text-[15px] font-serif'
                                        }
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

            {/* Input area */}
            {onSend && (
                <div className="sticky bottom-0 left-0 right-0 px-3 py-3 
          bg-white/95 backdrop-blur-sm border-t border-gray-200
        ">
                    <div className="relative z-10 flex items-end gap-2">
                        {/* Textarea input with starting height of 44px (touch friendly) */}
                        <textarea
                            ref={textareaRef}
                            value={messageText}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Write a message..."
                            className="
                flex-1 py-3 px-4
                min-h-[44px] max-h-[120px]
                bg-white
                text-[14px] text-gray-800
                placeholder:text-gray-400
                rounded-lg resize-none
                border border-gray-300
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200
                hover:border-gray-400
                transition-all duration-300
                scrollbar-thin scrollbar-track-gray-100
                scrollbar-thumb-gray-300
                hover:scrollbar-thumb-gray-400
                font-satoshi
              "
                        />

                        {/* Mic toggle button (if enabled) */}
                        {onToggleMic && (
                            <button
                                onClick={onToggleMic}
                                className={`
                  p-3 rounded-md
                  ${isMicEnabled
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-500 hover:text-gray-700'}
                  transition-all duration-200
                  hover:bg-gray-200
                  min-w-[44px] min-h-[44px] // Touch-friendly size
                `}
                            >
                                {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                        )}

                        {/* Send button */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSendMessage}
                            disabled={!messageText.trim()}
                            className={`
                p-3 rounded-md
                ${messageText.trim()
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-gray-200 text-gray-400'}
                transition-all duration-200
                min-w-[44px] min-h-[44px] // Touch-friendly size
              `}
                        >
                            <Send size={20} />
                        </motion.button>
                    </div>
                </div>
            )}
        </div>
    );
}; 