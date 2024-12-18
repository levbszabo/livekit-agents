import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessageInput = {
  placeholder: string;
  accentColor: string;
  height: number;
  onSend?: (message: string) => void;
};

export const ChatMessageInput = ({
  placeholder,
  accentColor,
  height,
  onSend,
}: ChatMessageInput) => {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!onSend || message.trim() === "") {
      return;
    }

    onSend(message.trim());
    setMessage("");
    inputRef.current?.focus();
  }, [onSend, message]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  return (
    <div className="flex flex-col border-t border-gray-800 w-full" style={{ height }}>
      <div className="flex flex-row items-start relative w-full px-1 py-2 sm:px-2">
        <textarea
          ref={inputRef}
          className={`
            w-full 
            text-[13px]
            leading-[1.4]
            bg-transparent 
            text-gray-300 
            px-3 py-2.5
            rounded
            border
            border-gray-700/50
            focus:outline-none 
            focus:border-${accentColor}-500/50
            font-normal
            resize-none
            min-h-[40px]
            max-h-[120px]
            overflow-y-auto
            placeholder:text-gray-500
            transition-colors
            scrollbar-thin
            scrollbar-thumb-gray-600
            scrollbar-track-transparent
            sm:text-[14px]
            sm:leading-[1.5]
            md:px-4 md:py-3
          `}
          style={{
            paddingRight: '76px',
          }}
          placeholder={placeholder}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          autoComplete="off"
          rows={1}
        />
        <button
          disabled={message.trim().length === 0 || !onSend}
          onClick={handleSend}
          className={`
            absolute 
            right-3
            top-1/2
            -translate-y-1/2
            text-xs
            font-medium
            tracking-wide
            text-${accentColor}-400
            hover:text-${accentColor}-300
            disabled:text-gray-600
            disabled:pointer-events-none
            transition-colors
            sm:text-sm
            sm:right-4
            p-2
            touch-manipulation
            select-none
            active:opacity-70
            min-w-[50px]
            text-center
          `}
        >
          SEND
        </button>
      </div>
    </div>
  );
};
