type ChatMessageProps = {
  message: string;
  accentColor: string;
  name: string;
  isSelf: boolean;
  hideName?: boolean;
};

export const ChatMessage = ({
  name,
  message,
  accentColor,
  isSelf,
  hideName,
}: ChatMessageProps) => {
  return (
    <div
      className={`
        flex flex-col 
        ${hideName ? "" : "mt-3"}
        animate-[fadeIn_0.3s_ease-out]
        transition-all duration-300
      `}
    >
      {!hideName && (
        <div
          className={`
            text-${isSelf ? "gray-700" : accentColor + "-800"} 
            uppercase text-[11px] font-bold tracking-wider mb-1
            transition-colors duration-300
          `}
        >
          {name}
        </div>
      )}
      <div
        className={`
          pr-4 
          text-${isSelf ? "gray-300" : accentColor + "-500"}
          text-[14px] leading-[1.4] font-medium tracking-tight
          transition-colors duration-300
        `}
      >
        {message}
      </div>
    </div>
  );
};
