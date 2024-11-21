import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ConnectionState } from "livekit-client";
import { ReactNode } from "react";

type PlaygroundHeaderProps = {
  title?: ReactNode;
  height: number;
  connectionState: ConnectionState;
  walkthroughCount: number;
  onWalkthroughClick: () => void;
  onGenerateClick: () => void;
};

export const PlaygroundHeader = ({
  title,
  height,
  connectionState,
  walkthroughCount,
  onWalkthroughClick,
  onGenerateClick,
}: PlaygroundHeaderProps) => {
  const isConnecting = connectionState === ConnectionState.Connecting;
  const isConnected = connectionState === ConnectionState.Connected;

  return (
    <div
      className="flex gap-4 px-6 items-center justify-between shrink-0 bg-[#121212] border-b border-gray-800"
      style={{ height: height + "px" }}
    >
      <div className="text-xl font-medium tracking-tight text-white">
        {title}
      </div>

      <div className="flex items-center gap-3">
        <Button
          accentColor="cyan"
          disabled={isConnecting}
          onClick={onWalkthroughClick}
          className={`px-6 py-2.5 text-sm font-medium ${isConnected
              ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
              : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 animate-pulse'
            }`}
        >
          {isConnecting ? (
            <LoadingSVG />
          ) : isConnected ? (
            "Complete Walkthrough"
          ) : (
            "Start Walkthrough"
          )}
        </Button>

        <Button
          accentColor="emerald"
          disabled={walkthroughCount === 0}
          onClick={onGenerateClick}
          className={`px-6 py-2.5 text-sm font-medium ${walkthroughCount > 0
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
            }`}
        >
          Generate Brdge
        </Button>
      </div>
    </div>
  );
};
