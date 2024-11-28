import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ConnectionState } from "livekit-client";
import { ReactNode } from "react";
import { WalkthroughSelector } from "./WalkthroughSelector";

type PlaygroundHeaderProps = {
  title?: ReactNode;
  height: number;
  connectionState: ConnectionState;
  walkthroughCount: number;
  brdgeId: string | null;
  apiBaseUrl: string | null;
  selectedWalkthrough: number | null;
  onWalkthroughClick: (agentType: 'edit' | 'view') => void;
  onGenerateClick: () => void;
  onWalkthroughSelect: (walkthroughId: number) => void;
  showEditControls?: boolean;
};

export const PlaygroundHeader = ({
  title,
  height,
  connectionState,
  walkthroughCount,
  brdgeId,
  apiBaseUrl,
  selectedWalkthrough,
  onWalkthroughClick,
  onGenerateClick,
  onWalkthroughSelect,
  showEditControls,
}: PlaygroundHeaderProps) => {
  const isConnecting = connectionState === ConnectionState.Connecting;
  const isConnected = connectionState === ConnectionState.Connected;
  const canGenerate = selectedWalkthrough !== null;

  return (
    <div
      className="flex gap-4 px-6 items-center justify-between shrink-0 bg-[#121212] border-b border-gray-800"
      style={{ height: height + "px" }}
    >
      <div className="text-xl font-medium tracking-tight text-white">
        {title}
      </div>

      <div className="flex items-center gap-3">
        <WalkthroughSelector
          brdgeId={brdgeId}
          apiBaseUrl={apiBaseUrl}
          selectedWalkthrough={selectedWalkthrough}
          onWalkthroughSelect={onWalkthroughSelect}
        />

        <button
          onClick={() => onWalkthroughClick('edit')}
          disabled={isConnecting}
          className={`
            px-6 py-2 rounded-md transition-all duration-200
            ${isConnected
              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
              : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.25)] animate-pulse'
            }
          `}
        >
          {isConnecting ? (
            <LoadingSVG />
          ) : isConnected ? (
            "Complete Walkthrough"
          ) : (
            "Start Walkthrough"
          )}
        </button>

        <button
          onClick={onGenerateClick}
          disabled={!canGenerate}
          className={`
            px-6 py-2 rounded-md transition-all duration-200
            ${canGenerate
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.25)] animate-pulse'
              : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Generate Brdge
        </button>
      </div>
    </div>
  );
};
