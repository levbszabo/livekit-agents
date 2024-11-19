"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ChatMessageType, ChatTile } from "@/components/chat/ChatTile";
import { ColorPicker } from "@/components/colorPicker/ColorPicker";
import { AudioInputTile } from "@/components/config/AudioInputTile";
import { ConfigurationPanelItem } from "@/components/config/ConfigurationPanelItem";
import { NameValueRow } from "@/components/config/NameValueRow";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "@/components/playground/PlaygroundTile";
import { useConfig } from "@/hooks/useConfig";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
  BarVisualizer,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRoomInfo,
  useVoiceAssistant,
} from "@livekit/components-react";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";
import { QRCodeSVG } from "qrcode.react";
import { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import tailwindTheme from "../../lib/tailwindTheme.preval";

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
}

const headerHeight = 56;

export default function Playground({
  logo,
  themeColors,
  onConnect,
}: PlaygroundProps) {
  // State to store URL parameters
  const [params, setParams] = useState({
    brdgeId: null as string | null,
    numSlides: 0,
    apiBaseUrl: null as string | null,
    currentSlide: 1
  });

  // Initialize parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const newParams = {
        brdgeId: urlParams.get('brdgeId'),
        numSlides: parseInt(urlParams.get('numSlides') || '0'),
        apiBaseUrl: urlParams.get('apiBaseUrl'),
        currentSlide: 1
      };

      console.log('Setting initial params:', newParams);
      setParams(newParams);
    }
  }, []);

  const { config, setUserSettings } = useConfig();
  const { name } = useRoomInfo();
  const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
  const { localParticipant } = useLocalParticipant();
  const voiceAssistant = useVoiceAssistant();
  const roomState = useConnectionState();

  // Handle slide navigation
  const handlePrevSlide = () => {
    if (params.currentSlide > 1) {
      setParams(prev => ({ ...prev, currentSlide: prev.currentSlide - 1 }));
    }
  };

  const handleNextSlide = () => {
    if (params.currentSlide < params.numSlides) {
      setParams(prev => ({ ...prev, currentSlide: prev.currentSlide + 1 }));
    }
  };

  // Validate required parameters
  const hasRequiredParams = useMemo(() => {
    const valid = Boolean(params.brdgeId && params.numSlides > 0 && params.apiBaseUrl);
    if (!valid) {
      console.error('Missing required parameters:', params);
    }
    return valid;
  }, [params]);

  // Simplified slide content
  const slideTileContent = useMemo(() => {
    if (!hasRequiredParams) {
      return (
        <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
          <div className="flex flex-col items-center gap-4">
            <div>Missing required parameters to display slides</div>
            <div className="text-sm text-gray-500">
              brdgeId: {params.brdgeId || 'missing'}<br />
              numSlides: {params.numSlides || 'missing'}<br />
              apiBaseUrl: {params.apiBaseUrl || 'missing'}
            </div>
          </div>
        </div>
      );
    }

    if (roomState === ConnectionState.Disconnected) {
      return (
        <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
          Connect to start the session
        </div>
      );
    }

    const slideUrl = `${params.apiBaseUrl}/brdges/${params.brdgeId}/slides/${params.currentSlide}`;
    console.log('Loading slide:', slideUrl);

    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
          <img
            key={slideUrl}
            src={slideUrl}
            alt={`Slide ${params.currentSlide}`}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              console.error('Error loading slide image:', slideUrl);
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50%" y="50%" text-anchor="middle" fill="gray">Error loading slide</text></svg>';
            }}
          />
        </div>
        <div className="flex justify-center items-center gap-4 p-4 bg-gray-800">
          <button
            onClick={handlePrevSlide}
            disabled={params.currentSlide === 1}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-white">
            Slide {params.currentSlide} of {params.numSlides}
          </span>
          <button
            onClick={handleNextSlide}
            disabled={params.currentSlide === params.numSlides}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  }, [params, roomState, hasRequiredParams]);

  const onDataReceived = useCallback(
    (msg: any) => {
      if (msg.topic === "transcription") {
        const decoded = JSON.parse(
          new TextDecoder("utf-8").decode(msg.payload)
        );
        let timestamp = new Date().getTime();
        if ("timestamp" in decoded && decoded.timestamp > 0) {
          timestamp = decoded.timestamp;
        }
        setTranscripts([
          ...transcripts,
          {
            name: "You",
            message: decoded.text,
            timestamp: timestamp,
            isSelf: true,
          },
        ]);
      }
    },
    [transcripts]
  );

  useDataChannel(onDataReceived);

  useEffect(() => {
    document.body.style.setProperty(
      "--lk-theme-color",
      // @ts-ignore
      tailwindTheme.colors[config.settings.theme_color]["500"]
    );
    document.body.style.setProperty(
      "--lk-drop-shadow",
      `var(--lk-theme-color) 0px 0px 18px`
    );
  }, [config.settings.theme_color]);

  const audioTileContent = useMemo(() => {
    const disconnectedContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center w-full">
        No audio track. Connect to get started.
      </div>
    );

    const waitingContent = (
      <div className="flex flex-col items-center gap-2 text-gray-700 text-center w-full">
        <LoadingSVG />
        Waiting for audio track
      </div>
    );

    const visualizerContent = (
      <div
        className={`flex items-center justify-center w-full h-48 [--lk-va-bar-width:30px] [--lk-va-bar-gap:20px] [--lk-fg:var(--lk-theme-color)]`}
      >
        <BarVisualizer
          state={voiceAssistant.state}
          trackRef={voiceAssistant.audioTrack}
          barCount={5}
          options={{ minHeight: 20 }}
        />
      </div>
    );

    if (roomState === ConnectionState.Disconnected) {
      return disconnectedContent;
    }

    if (!voiceAssistant.audioTrack) {
      return waitingContent;
    }

    return visualizerContent;
  }, [
    voiceAssistant.audioTrack,
    config.settings.theme_color,
    roomState,
    voiceAssistant.state,
  ]);

  const chatTileContent = useMemo(() => {
    if (voiceAssistant.audioTrack) {
      return (
        <TranscriptionTile
          agentAudioTrack={voiceAssistant.audioTrack}
          accentColor={config.settings.theme_color}
        />
      );
    }
    return <></>;
  }, [config.settings.theme_color, voiceAssistant.audioTrack]);

  const settingsTileContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4 h-full w-full items-start overflow-y-auto">
        {config.description && (
          <ConfigurationPanelItem title="Description">
            {config.description}
          </ConfigurationPanelItem>
        )}

        <ConfigurationPanelItem title="Settings">
          {localParticipant && (
            <div className="flex flex-col gap-2">
              <NameValueRow
                name="Room"
                value={name}
                valueColor={`${config.settings.theme_color}-500`}
              />
              <NameValueRow
                name="Participant"
                value={localParticipant.identity}
              />
            </div>
          )}
        </ConfigurationPanelItem>
        <ConfigurationPanelItem title="Status">
          <div className="flex flex-col gap-2">
            <NameValueRow
              name="Room connected"
              value={
                roomState === ConnectionState.Connecting ? (
                  <LoadingSVG diameter={16} strokeWidth={2} />
                ) : (
                  roomState.toUpperCase()
                )
              }
              valueColor={
                roomState === ConnectionState.Connected
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
            <NameValueRow
              name="Agent connected"
              value={
                voiceAssistant.agent ? (
                  "TRUE"
                ) : roomState === ConnectionState.Connected ? (
                  <LoadingSVG diameter={12} strokeWidth={2} />
                ) : (
                  "FALSE"
                )
              }
              valueColor={
                voiceAssistant.agent
                  ? `${config.settings.theme_color}-500`
                  : "gray-500"
              }
            />
          </div>
        </ConfigurationPanelItem>
        <div className="w-full">
          <ConfigurationPanelItem title="Color">
            <ColorPicker
              colors={themeColors}
              selectedColor={config.settings.theme_color}
              onSelect={(color) => {
                const userSettings = { ...config.settings };
                userSettings.theme_color = color;
                setUserSettings(userSettings);
              }}
            />
          </ConfigurationPanelItem>
        </div>
      </div>
    );
  }, [
    config.description,
    config.settings,
    localParticipant,
    name,
    roomState,
    themeColors,
    setUserSettings,
    voiceAssistant.agent,
  ]);

  let mobileTabs: PlaygroundTab[] = [];

  // Slides tab
  mobileTabs.push({
    title: "Slides",
    content: (
      <PlaygroundTile
        className="w-full h-full grow"
        childrenClassName="justify-center"
      >
        {slideTileContent}
      </PlaygroundTile>
    ),
  });

  if (config.settings.outputs.audio) {
    mobileTabs.push({
      title: "Audio",
      content: (
        <PlaygroundTile
          className="w-full h-full grow"
          childrenClassName="justify-center"
        >
          {audioTileContent}
        </PlaygroundTile>
      ),
    });
  }

  if (config.settings.chat) {
    mobileTabs.push({
      title: "Chat",
      content: chatTileContent,
    });
  }

  mobileTabs.push({
    title: "Settings",
    content: (
      <PlaygroundTile
        padding={false}
        backgroundColor="gray-950"
        className="h-full w-full basis-1/4 items-start overflow-y-auto flex"
        childrenClassName="h-full grow items-start"
      >
        {settingsTileContent}
      </PlaygroundTile>
    ),
  });

  // Add this at the top with other state declarations
  const sentInitialUpdate = useRef(false);

  // Add the data channel hook with a specific topic
  const { send } = useDataChannel("slide_updates", (message) => {
    console.log("Received message on slide_updates channel:", message);
  });

  // Add a ref to track the last sent slide number
  const lastSentSlide = useRef<number | null>(null);

  // Function to send SLIDE_UPDATE messages using the data channel
  const sendSlideUpdate = useCallback(() => {
    // Don't send if same slide or not connected
    if (!hasRequiredParams ||
      roomState !== ConnectionState.Connected ||
      lastSentSlide.current === params.currentSlide) {
      console.log("Skipping slide update:", {
        hasRequiredParams,
        connectionState: roomState,
        currentSlide: params.currentSlide,
        lastSentSlide: lastSentSlide.current
      });
      return;
    }

    const message = {
      type: "SLIDE_UPDATE",
      brdgeId: params.brdgeId,
      numSlides: params.numSlides,
      apiBaseUrl: params.apiBaseUrl,
      currentSlide: params.currentSlide,
    };

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      send(data, { topic: "slide_updates" });
      lastSentSlide.current = params.currentSlide;
      console.log("Successfully sent SLIDE_UPDATE message:", {
        message,
        dataLength: data.length,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error sending slide update:", e);
    }
  }, [hasRequiredParams, params, roomState, send]);

  // Send initial slide data only once when all required data is available
  useEffect(() => {
    const shouldSendUpdate =
      params.brdgeId &&
      roomState === ConnectionState.Connected &&
      !sentInitialUpdate.current;

    if (shouldSendUpdate) {
      console.log("Connection ready, sending initial slide update");
      sendSlideUpdate();
      sentInitialUpdate.current = true;
    }
  }, [params.brdgeId, roomState, sendSlideUpdate]);

  // Add effect to send updates ONLY on actual slide changes
  useEffect(() => {
    if (sentInitialUpdate.current &&
      params.currentSlide !== lastSentSlide.current) {
      console.log("Slide changed, sending update");
      sendSlideUpdate();
    }
  }, [params.currentSlide, sendSlideUpdate]);

  // Reset tracking when disconnecting
  useEffect(() => {
    if (roomState !== ConnectionState.Connected) {
      sentInitialUpdate.current = false;
      lastSentSlide.current = null;
    }
  }, [roomState]);

  return (
    <>
      <PlaygroundHeader
        title={config.title || "Brdge AI"}
        logo={logo}
        githubLink={config.github_link}
        height={headerHeight}
        accentColor={config.settings.theme_color}
        connectionState={roomState}
        onConnectClicked={() =>
          onConnect(roomState === ConnectionState.Disconnected)
        }
      />
      <div
        className={`flex gap-4 py-4 grow w-full selection:bg-${config.settings.theme_color}-900`}
        style={{ height: `calc(100% - ${headerHeight}px)` }}
      >
        {/* Main content area */}
        <div className="flex-col grow basis-3/4 gap-4 h-full flex">
          <PlaygroundTile
            title="Slides"
            className="w-full h-full grow"
            childrenClassName="justify-center p-0"
          >
            {slideTileContent}
          </PlaygroundTile>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col basis-1/4 gap-4 h-full">
          {config.settings.chat && (
            <PlaygroundTile
              title="Chat"
              className="h-1/2"
            >
              {chatTileContent}
            </PlaygroundTile>
          )}
          <PlaygroundTile
            padding={false}
            backgroundColor="gray-950"
            className="h-1/2 items-start overflow-y-auto"
            childrenClassName="h-full grow items-start"
          >
            {settingsTileContent}
          </PlaygroundTile>
        </div>
      </div>
    </>
  );
}
