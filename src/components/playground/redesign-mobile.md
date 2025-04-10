# Mobile Playground Refactoring Plan

This comprehensive plan outlines the steps to refactor the existing `Playground.tsx` component into a new, mobile-optimized `PlaygroundMobile.tsx` component. The goal is to create a touch-first interface that prioritizes video playback and chat interaction in view mode, while providing efficient access to editing tools in edit mode.

## Table of Contents
1. [Component Architecture Overview](#component-architecture-overview)
2. [Phase 1: Foundation & Mobile Layout](#phase-1-foundation--mobile-layout)
3. [Phase 2: Mobile Progress Bar & Timeline](#phase-2-mobile-progress-bar--timeline)
4. [Phase 3: Mobile Chat Interface](#phase-3-mobile-chat-interface)
5. [Phase 4: Tab Navigation (Edit Mode)](#phase-4-tab-navigation-edit-mode)
6. [Phase 5: Adapt Content Tabs (Edit Mode)](#phase-5-adapt-content-tabs-edit-mode)
7. [Phase 6: Polish & Advanced Interactions](#phase-6-polish--advanced-interactions)
8. [Technical Considerations](#technical-considerations)
9. [Performance Optimization](#performance-optimization)
10. [Accessibility Checklist](#accessibility-checklist)

## Component Architecture Overview

The new mobile architecture will consist of the following component hierarchy:

```
src/
└── components/
    ├── playground/
    │   ├── PlaygroundMobile.tsx  # Main container component
    │   ├── mobile/               # Mobile-specific components
    │   │   ├── MobileVideoPlayer.tsx
    │   │   ├── MobileProgressBar.tsx
    │   │   ├── MobileTimelineMarkers.tsx
    │   │   ├── MobileChatTile.tsx
    │   │   ├── MobileBottomTabBar.tsx
    │   │   ├── tabs/
    │   │   │   ├── MobileEngagementTab.tsx
    │   │   │   ├── MobilePersonaTab.tsx
    │   │   │   ├── MobileVoiceTab.tsx
    │   │   │   └── MobileShareTab.tsx
    │   │   └── common/
    │   │       ├── MobileAccordion.tsx
    │   │       ├── MobileTouchableCard.tsx
    │   │       └── MobileGestureHandler.tsx
    │   └── shared/               # Components shared with desktop
    │       └── types.ts          # Common type definitions
```

## Phase 1: Foundation & Mobile Layout

**Goal:** Establish the basic structure of `PlaygroundMobile.tsx`, copy essential logic, and set up the core vertical layout with the video player.

### 1.1 Copy Core Logic

**File:** `PlaygroundMobile.tsx`

```typescript
// Inside PlaygroundMobile.tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
// ... [copy necessary imports from Playground.tsx]

// Keep these interfaces as they are essential
export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
  agentType?: 'edit' | 'view';
  userId?: string;
  brdgeId?: string | null;
  authToken?: string | null;
}

export default function PlaygroundMobile({
  logo,
  themeColors,
  onConnect,
  agentType,
  userId,
  brdgeId,
  authToken
}: PlaygroundProps) {
  // Copy essential state variables
  const [params, setParams] = useState({
    brdgeId: null as string | null,
    apiBaseUrl: null as string | null,
    coreApiUrl: API_BASE_URL,
    userId: null as string | null,
    agentType: 'edit' as 'edit' | 'view'
  });
  
  // Copy video-related state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  
  // Copy chat-related state
  const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
  
  // Copy other essential state and hooks from Playground.tsx
  // ...
  
  // Copy necessary useEffect hooks and handler functions
  // ...
  
  // Return empty component for now
  return <div>Mobile Playground</div>;
}
```

### 1.2 Remove Desktop Layout

Remove these desktop-specific imports and code:

* `react-resizable-panels` imports
* `isRightPanelCollapsed` state
* Panel-related components (`PanelGroup`, `Panel`, `PanelResizeHandle`)
* Desktop-specific CSS classes like `right-[360px]`
* Code referring to the desktop right panel

### 1.3 Implement Vertical Layout

**Wireframe: Mobile Layout Structure**

```
┌──────────────────────────────┐
│                              │
│                              │
│          Video Player        │ <- 40% of viewport height
│        (16:9 aspect ratio)   │
│                              │
├──────────────────────────────┤
│    Progress Bar & Timeline   │ <- 24px height
├──────────────────────────────┤
│                              │
│                              │
│                              │
│           Chat View          │ <- Remaining height
│          (scrollable)        │
│                              │
│                              │
├──────────────────────────────┤
│  Bottom Tab Bar (edit mode)  │ <- 56px height
└──────────────────────────────┘
```

Implement the basic layout structure in `PlaygroundMobile.tsx`:

```typescript
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {/* Video Section (40% of viewport height) */}
    <div className="h-[40vh] flex-shrink-0 bg-black relative">
      {/* Video Player will go here */}
      <div className="w-full h-full flex items-center justify-center">
        {/* Placeholder for video */}
        <div className="w-full h-full bg-black/50 flex items-center justify-center">
          <div className="text-white">Video Player</div>
        </div>
      </div>
    </div>
    
    {/* Progress Bar Section */}
    <div className="h-6 bg-gray-800 relative">
      {/* MobileProgressBar will go here */}
    </div>
    
    {/* Content Section */}
    <div className="flex-1 overflow-hidden relative">
      {/* MobileChatTile or active tab content will go here */}
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          {/* Chat messages or tab content */}
        </div>
      </div>
    </div>
    
    {/* Bottom Tab Bar (only in edit mode) */}
    {params.agentType === 'edit' && (
      <div className="h-14 bg-[#F5EFE0] border-t border-[#9C7C38]/30 flex-shrink-0">
        {/* MobileBottomTabBar will go here */}
      </div>
    )}
  </div>
);
```

### 1.4 Adapt Video Player

Create a new `MobileVideoPlayer.tsx` component that's optimized for mobile:

**File:** `src/components/playground/mobile/MobileVideoPlayer.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileVideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl: string | null;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  onTimeUpdate: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onVideoReady: (isReady: boolean) => void;
}

export const MobileVideoPlayer: React.FC<MobileVideoPlayerProps> = ({
  videoRef,
  videoUrl,
  currentTime,
  setCurrentTime,
  setDuration,
  onTimeUpdate,
  isPlaying,
  setIsPlaying,
  onVideoReady,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  // Implement handlers for video events
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur) && isFinite(dur)) {
      setDuration(dur);
    }
  };

  const handleCanPlay = () => {
    setIsVideoReady(true);
    setIsLoading(false);
    onVideoReady(true);
  };

  const handlePlaybackError = (error: any) => {
    console.error('Video playback error:', error);
    setPlaybackError('Unable to play video. Please try again.');
    setIsPlaying(false);
    setIsLoading(false);
    setIsVideoReady(false);
    onVideoReady(false);
  };

  // Implement play/pause behavior
  const attemptPlay = async () => {
    if (!videoRef.current || !isVideoReady) return;
    
    try {
      setPlaybackError(null);
      await videoRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      handlePlaybackError(error);
    }
  };

  const handleVideoClick = async () => {
    if (!videoRef.current || !isVideoReady) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      attemptPlay();
    }
  };

  // Update video URL when it changes
  useEffect(() => {
    if (videoUrl) {
      setIsVideoReady(false);
      setIsLoading(true);
      setPlaybackError(null);
      onVideoReady(false);
      if (videoRef.current) {
        videoRef.current.load();
      }
    } else {
      setIsVideoReady(false);
      setIsLoading(true);
      onVideoReady(false);
    }
  }, [videoUrl, onVideoReady]);

  return (
    <div className="relative w-full h-full bg-black" onClick={handleVideoClick}>
      {/* Video Element */}
      {videoUrl ? (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="h-full relative flex items-center justify-center">
            <video
              ref={videoRef}
              className="h-full w-auto max-w-none"
              style={{ objectFit: 'contain' }}
              crossOrigin="anonymous"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onError={(e) => handlePlaybackError(e)}
              onPlaying={() => {
                setIsLoading(false);
                setPlaybackError(null);
              }}
              onCanPlay={handleCanPlay}
              onWaiting={() => setIsLoading(true)}
              onStalled={() => setIsLoading(true)}
              playsInline
              webkit-playsinline="true"
              x-webkit-airplay="allow"
              preload="metadata"
              controls={false}
              autoPlay={false}
            >
              <source
                src={videoUrl}
                type={videoUrl?.endsWith('.webm') ? 'video/webm' : 'video/mp4'}
              />
            </video>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-red-900/30 border-t-red-900 animate-spin rounded-full" />
        </div>
      )}

      {/* Play Button Overlay */}
      {isVideoReady && !isPlaying && !isLoading && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent z-20">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-5 rounded-full 
              bg-[#0A1933]/80 
              border border-[#0A1933]/40
              backdrop-blur-md
              shadow-[0_0_25px_rgba(10,25,51,0.3)]"
          >
            <Play
              size={36} // Larger for mobile
              className="text-white/90"
            />
          </motion.div>
        </div>
      )}

      {/* Loading/Error Overlays */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 animate-spin rounded-full" />
        </div>
      )}

      {playbackError && isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="text-red-400 text-sm text-center px-4">
            {playbackError}
            <button
              onClick={(e) => {
                e.stopPropagation();
                attemptPlay();
              }}
              className="mt-2 px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-md text-xs
                hover:bg-cyan-500/30 transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

Integrate the `MobileVideoPlayer` into `PlaygroundMobile.tsx`:

```typescript
import { MobileVideoPlayer } from './mobile/MobileVideoPlayer';

// Inside the PlaygroundMobile render function
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {/* Video Section (40% of viewport height) */}
    <div className="h-[40vh] flex-shrink-0 bg-black relative">
      <MobileVideoPlayer
        videoRef={videoRef}
        videoUrl={videoUrl}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        setDuration={setDuration}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onVideoReady={setIsVideoReadyForListeners}
      />
    </div>
    
    {/* Rest of layout as before */}
  </div>
);
```

This completes Phase 1 of the refactoring process, establishing the foundation of the mobile layout with a properly sized and touch-optimized video player component.

## Phase 2: Mobile Progress Bar & Timeline

**Goal:** Implement a touch-friendly progress bar and adapt the timeline markers for mobile display.

### 2.1 Create Mobile Progress Bar Component

**Wireframe: Mobile Progress Bar**

```
┌───────────────────────────────────────────────┐
│                                               │
│  ○──────────────○─────────○─────────●────○   │ <- Timeline markers (○)
│  │                        ▲                │  │ <- Progress bar
│  └────────────────────────┘                   │ <- Progress thumb (●)
│  0:15                     1:30           2:45 │ <- Timestamp labels
│                                               │
└───────────────────────────────────────────────┘
```

**File:** `src/components/playground/mobile/MobileProgressBar.tsx`

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { MobileTimelineMarkers } from './MobileTimelineMarkers';
import { EngagementOpportunity } from '../Playground';

interface MobileProgressBarProps {
  currentTime: number;
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  isPlaying: boolean;
  engagementOpportunities: EngagementOpportunity[];
}

export const MobileProgressBar: React.FC<MobileProgressBarProps> = ({
  currentTime,
  duration,
  videoRef,
  setCurrentTime,
  setIsPlaying,
  isPlaying,
  engagementOpportunities,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Calculate the progress bar width for proper marker positioning
  useEffect(() => {
    const updateProgressBarWidth = () => {
      if (progressBarRef.current) {
        setProgressBarWidth(progressBarRef.current.offsetWidth);
      }
    };

    // Initial update
    updateProgressBarWidth();

    // Add resize listener
    window.addEventListener('resize', updateProgressBarWidth);

    // Clean up
    return () => {
      window.removeEventListener('resize', updateProgressBarWidth);
    };
  }, []);

  // Handle touch and mouse events for seeking
  const handleProgressBarInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!progressBarRef.current || !videoRef.current || !videoRef.current.duration) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * videoRef.current.duration;

    if (isFinite(newTime) && !isNaN(newTime)) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleProgressBarInteraction(e);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      handleProgressBarInteraction(e);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleProgressBarInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleProgressBarInteraction(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Format time for display
  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="px-4 py-3 flex flex-col">
      {/* Time display */}
      <div className="flex justify-between text-[11px] text-[#1E2A42] mb-1 px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      {/* Progress bar container */}
      <div className="relative h-10 flex items-center">
        {/* Main progress bar track */}
        <div
          ref={progressBarRef}
          className={`h-5 bg-gray-800/70 rounded-full cursor-pointer 
            w-full transition-all duration-300 relative
            ${isHovering || isDragging ? 'bg-gray-700/80 shadow-inner' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            handleMouseUp();
            setIsHovering(false);
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Filled progress */}
          <div
            className="h-full bg-gradient-to-r from-[#7C1D1D] to-[#7C1D1D] rounded-full 
              transition-all duration-150 relative"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
            }}
          />

          {/* Timeline markers */}
          {engagementOpportunities && engagementOpportunities.length > 0 && (
            <MobileTimelineMarkers
              engagementOpportunities={engagementOpportunities}
              duration={duration}
              currentTime={currentTime}
              containerWidth={progressBarWidth}
            />
          )}

          {/* Draggable thumb - larger for touch */}
          {duration > 0 && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 
                rounded-full
                border-2 border-white
                transition-all duration-200
                ${isDragging || isHovering
                  ? 'w-7 h-7 bg-[#7C1D1D] border-[#A83838] shadow-[0_0_10px_rgba(124,29,29,0.5)]'
                  : 'w-6 h-6 bg-[#7C1D1D] border-[#A83838] shadow-[0_0_6px_rgba(124,29,29,0.3)]'
                }`}
              style={{
                left: `${(currentTime / duration) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
```

### 2.2 Create Mobile Timeline Markers Component

**File:** `src/components/playground/mobile/MobileTimelineMarkers.tsx`

```typescript
import React from 'react';
import { EngagementOpportunity } from '../Playground';

interface MobileTimelineMarkersProps {
  engagementOpportunities: EngagementOpportunity[];
  duration: number;
  currentTime: number;
  containerWidth: number;
}

export const MobileTimelineMarkers: React.FC<MobileTimelineMarkersProps> = ({
  engagementOpportunities,
  duration,
  currentTime,
  containerWidth,
}) => {
  // Don't render if no duration available
  if (!duration || duration === 0) {
    return null;
  }

  // Helper function to convert timestamp (00:00:00) to seconds
  const timestampToSeconds = (timestamp: string): number => {
    if (!timestamp) return 0;

    const parts = timestamp.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
  };

  // Group markers by timestamp to avoid complete overlaps
  const groupedMarkers: Record<string, EngagementOpportunity[]> = {};

  engagementOpportunities.forEach(engagement => {
    const key = engagement.timestamp;
    if (!groupedMarkers[key]) {
      groupedMarkers[key] = [];
    }
    groupedMarkers[key].push(engagement);
  });

  // Calculate positions with minimum distance to avoid visual overlapping
  const MIN_MARKER_DISTANCE = 5; // percentage
  const adjustedPositions: Record<string, number> = {};
  const markerPositions = Object.keys(groupedMarkers).map(timestamp => {
    return {
      timestamp,
      position: (timestampToSeconds(timestamp) / duration) * 100
    };
  });

  // Sort markers by position
  markerPositions.sort((a, b) => a.position - b.position);

  // Adjust positions for markers that are too close
  for (let i = 0; i < markerPositions.length; i++) {
    const current = markerPositions[i];
    adjustedPositions[current.timestamp] = current.position;

    if (i < markerPositions.length - 1) {
      const next = markerPositions[i + 1];
      const distance = next.position - current.position;

      if (distance < MIN_MARKER_DISTANCE) {
        next.position = current.position + MIN_MARKER_DISTANCE;
      }
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {Object.entries(groupedMarkers).map(([timestamp, engagements]) => {
        const seconds = timestampToSeconds(timestamp);
        const position = adjustedPositions[timestamp] || (seconds / duration) * 100;
        
        // Determine if this marker is active
        const isActive = currentTime >= seconds && currentTime <= seconds + 1;

        return (
          <div
            key={timestamp}
            className={`
              absolute w-1.5 h-6 -mt-1.5 top-1/2
              ${isActive 
                ? 'bg-[#A83838] shadow-[0_0_8px_rgba(168,56,56,0.8)]' 
                : 'bg-[#7C1D1D]/70'}
              rounded-sm
              transition-all duration-300
            `}
            style={{
              left: `${position}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              opacity: isActive ? 1 : 0.7,
            }}
          />
        );
      })}
    </div>
  );
};
```

### 2.3 Integration into PlaygroundMobile

Update the `PlaygroundMobile.tsx` component to include the mobile progress bar:

```typescript
import { MobileProgressBar } from './mobile/MobileProgressBar';

// Inside the PlaygroundMobile render function
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {/* Video Section */}
    <div className="h-[40vh] flex-shrink-0 bg-black relative">
      <MobileVideoPlayer
        {/* props as before */}
      />
    </div>
    
    {/* Progress Bar Section */}
    <div className="bg-black/40 relative">
      <MobileProgressBar
        currentTime={currentTime}
        duration={duration}
        videoRef={videoRef}
        setCurrentTime={setCurrentTime}
        setIsPlaying={setIsPlaying}
        isPlaying={isPlaying}
        engagementOpportunities={engagementOpportunities || []}
      />
    </div>
    
    {/* Content Section */}
    {/* ... as before */}
  </div>
);
```

## Phase 3: Mobile Chat Interface

**Goal:** Create a mobile-optimized chat view below the video/progress bar.

### 3.1 Create Mobile Chat Tile Component

**Wireframe: Mobile Chat Interface**

```
┌───────────────────────────────────────────────┐
│                                               │
│  ┌───────────────────────────────────────┐    │ <- User message
│  │ This is a user message                │    │
│  └───────────────────────────────────────┘    │
│                                               │
│    ┌───────────────────────────────────────┐  │ <- AI message
│    │ This is an AI assistant message       │  │
│    │ that might span multiple lines and    │  │
│    │ include a longer response.            │  │
│    └───────────────────────────────────────┘  │
│                                               │
│  ┌───────────────────────────────────────┐    │
│  │ Another user message                  │    │
│  └───────────────────────────────────────┘    │
│                                               │
├───────────────────────────────────────────────┤
│  ┌───────────────────────────────┐ ┌───────┐  │ <- Input area
│  │ Type a message...             │ │   ▶   │  │    with send button
│  └───────────────────────────────┘ └───────┘  │
└───────────────────────────────────────────────┘
```

**File:** `src/components/playground/mobile/MobileChatTile.tsx`

```typescript
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
import { ChatMessageType } from '@/components/chat/ChatTile';

interface MobileChatTileProps {
  messages: ChatMessageType[];
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

    const combined: ChatMessageType[] = [];
    messages.forEach((msg) => {
      const prevMsg = combined.length > 0 ? combined[combined.length - 1] : null;

      if (prevMsg && !msg.isSelf && prevMsg.name === msg.name && prevMsg.isSelf === msg.isSelf) {
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
          scrollbar-thin scrollbar-track-transparent
          scrollbar-thumb-[#9C7C38]/20 hover:scrollbar-thumb-[#9C7C38]/30
          bg-[#F5EFE0]/90 backdrop-blur-sm
          after:absolute after:inset-0 after:bg-[url('/textures/parchment.png')] 
          after:bg-cover after:opacity-20 after:mix-blend-overlay after:pointer-events-none
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
                    text-[12px] font-serif // Larger text for mobile
                    ${message.isSelf ? 'text-right mr-2 text-[#9C7C38]/90' : 'ml-2 text-[#9C7C38]/90'}
                    mb-0.5
                  `}>
                    {message.name}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`
                    relative
                    ${message.isSelf
                      ? 'bg-[#FAF7ED]/80 border border-[#9C7C38]/15 pl-3 pr-4 py-2.5 rounded-md'
                      : 'bg-[#F5EFE0]/80 border border-[#9C7C38]/25 px-4 py-2.5 rounded-md'}
                    shadow-sm
                    transition-all duration-300
                    hover:border-[#9C7C38]/40
                  `}
                >
                  {/* Message text with increased size for mobile */}
                  <div className={`
                    whitespace-pre-wrap
                    ${message.isSelf
                      ? 'text-[#0A1933] text-[14px] font-satoshi'
                      : 'text-[#1E2A42] text-[15px] font-serif'}
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
          bg-[#F5EFE0]/95 backdrop-blur-sm border-t border-[#9C7C38]/30
          after:absolute after:inset-0 after:bg-[url('/textures/parchment.png')] 
          after:bg-cover after:opacity-40 after:mix-blend-overlay after:pointer-events-none
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
                bg-[#FAF7ED]/90 
                text-[14px] text-[#0A1933] // Larger text for mobile
                placeholder:text-[#1E2A42]/40
                rounded-lg resize-none
                border border-[#9C7C38]/30
                focus:outline-none focus:border-[#9C7C38]/50 focus:ring-1 focus:ring-[#9C7C38]/20
                hover:border-[#9C7C38]/40
                transition-all duration-300
                scrollbar-thin scrollbar-track-transparent
                scrollbar-thumb-[#9C7C38]/20
                hover:scrollbar-thumb-[#9C7C38]/30
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
                    ? 'bg-[#9C7C38]/30 text-[#9C7C38]' 
                    : 'bg-[#9C7C38]/15 text-[#1E2A42]/70 hover:text-[#9C7C38]'}
                  transition-all duration-200
                  hover:bg-[#9C7C38]/20
                  min-w-[44px] min-h-[44px] // Touch-friendly size
                `}
              >
                {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            )}
            
            {/* Send button */}
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
              className={`
                p-3 rounded-md
                ${messageText.trim()
                  ? 'bg-[#9C7C38]/20 text-[#9C7C38] hover:bg-[#9C7C38]/30'
                  : 'bg-[#9C7C38]/10 text-[#1E2A42]/30'}
                transition-all duration-200
                min-w-[44px] min-h-[44px] // Touch-friendly size
              `}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3.2 Integration into PlaygroundMobile

Update the `PlaygroundMobile.tsx` component to include the mobile chat tile:

```typescript
import { MobileChatTile } from './mobile/MobileChatTile';

// Inside the PlaygroundMobile component add this state
const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('chat');

// Inside the render function, update the content section:
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {/* Video Section and Progress Bar as before */}
    
    {/* Content Section */}
    <div className="flex-1 overflow-hidden relative">
      {/* Show appropriate content based on active tab */}
      <div className={`absolute inset-0 ${activeMobileTab === 'chat' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'}`}>
        <MobileChatTile
          messages={transcripts}
          accentColor="cyan"
          onSend={handleChatMessage}
          isMicEnabled={localParticipant?.isMicrophoneEnabled || false}
          onToggleMic={() => {
            if (roomState === ConnectionState.Connected && localParticipant) {
              localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
            }
          }}
        />
      </div>
      
      {/* Other tab content will be added here in Phase 4 */}
    </div>
    
    {/* Bottom Tab Bar (only in edit mode) */}
    {params.agentType === 'edit' && (
      <div className="h-14 bg-[#F5EFE0] border-t border-[#9C7C38]/30 flex-shrink-0">
        {/* MobileBottomTabBar will be added in Phase 4 */}
      </div>
    )}
  </div>
);
```

This completes Phases 2 and 3, implementing a mobile-optimized progress bar with timeline markers and a touch-friendly chat interface with properly sized input elements and message bubbles.

## Phase 3.5: LiveKit Integration Refactor

**Goal:** Refactor `PlaygroundMobile.tsx` to correctly integrate LiveKit's chat and voice assistant features, mirroring the desktop implementation and resolving the current non-functional chat/voice interface. This involves switching from the generic data channel listener to the specific LiveKit observables and adding necessary UI feedback and RPC handling.

### 3.5.1 Remove Incorrect DataChannel Listener

**File:** `src/components/playground/PlaygroundMobile.tsx`

*   Remove the `useDataChannel(onDataReceived)` hook call (around line 203).
*   Remove the `onDataReceived` callback function (around lines 180-201). The logic for handling messages will be moved to the observable subscriptions.
*   **Note:** Ensure any other logic relying solely on the generic data channel for chat/transcription is removed or refactored.

### 3.5.2 Integrate LiveKit Chat Observable

**File:** `src/components/playground/PlaygroundMobile.tsx`

1.  **Import necessary types/functions:**
    ```typescript
    import { useChat } from "@livekit/components-react";
    import { ReceivedChatMessage } from "@livekit/components-core"; // Import this type
    ```
2.  **Use the `useChat` hook:** (Already present, ensure it's being used correctly).
3.  **Subscribe to chat messages:** Add a new `useEffect` hook to subscribe to incoming chat messages from the assistant.
    ```typescript
    useEffect(() => {
      if (!chat || !chat.messageObservable) return;
    
      console.log("Subscribing to chat messages...");
    
      const subscription = chat.messageObservable.subscribe(
        (msg: ReceivedChatMessage) => {
          console.log("Received chat message:", msg);
          // Error handling suggestion: Add try-catch around state updates
          try {
            setTranscripts(prev => [...prev, {
              name: msg.from?.identity || "Assistant", // Use sender identity if available
              message: msg.message,
              timestamp: msg.timestamp,
              isSelf: false,
            } as ExtendedChatMessageType]);
          } catch (error) {
              console.error("Error updating transcript state from chat:", error);
          }
        }
      );
    
      // Cleanup function
      return () => {
        console.log("Unsubscribing from chat messages.");
        subscription.unsubscribe();
      };
    }, [chat]); // Dependency: chat hook instance. Ensure `chat` itself is stable or memoized if necessary.
    ```
4.  **Update `handleChatMessage`:** Ensure the `handleChatMessage` function (around line 205) correctly adds the user's *outgoing* message to the `transcripts` state with `isSelf: true`. The existing implementation seems correct but verify it works alongside the new subscription. **State Management Clarification:** The `transcripts` state should be managed within `PlaygroundMobile.tsx` and passed down as props to `MobileChatTile`.

### 3.5.3 Integrate Voice Assistant Transcription Observable

**File:** `src/components/playground/PlaygroundMobile.tsx`

1.  **Import necessary types/functions:**
    ```typescript
    import { useVoiceAssistant } from "@livekit/components-react";
    import { VAD_THRESSHOLD } from '@/components/voice-assistant/assistant-hooks'; // Or appropriate path
    import { VoiceAssistantOptions } from '@livekit/components-react'; // Import this type
    import { Transcription } from 'livekit-client'; // Import Transcription type
    ```
2.  **Use the `useVoiceAssistant` hook:** (Already present, ensure it's initialized correctly, potentially with options like `vadThresshold`).
    ```typescript
    // Example initialization (adjust options as needed)
    const voiceAssistantOptions: VoiceAssistantOptions = {
        // vadThresshold: VAD_THRESSHOLD, // Example option
    };
    const voiceAssistant = useVoiceAssistant(voiceAssistantOptions);
    ```
3.  **Subscribe to transcriptions:** Add a `useEffect` hook to subscribe to user speech transcriptions.
    ```typescript
    useEffect(() => {
      if (!voiceAssistant || !voiceAssistant.transcriptionObservable) return;
    
      console.log("Subscribing to voice transcriptions...");
    
      const subscription = voiceAssistant.transcriptionObservable.subscribe(
        (transcription: Transcription) => {
          console.log("Received transcription:", transcription);
          // Error handling suggestion: Add try-catch around state updates
          try {
            // Assuming transcription object has segments with text and isFinal flag
            // Add logic to potentially update the last message if not final, or add a new one if final
            const messageText = transcription.segments.map(seg => seg.text).join(" ");
            const isFinal = transcription.segments.some(seg => seg.final);
            const timestamp = Date.now();
      
            setTranscripts(prev => {
              const lastMessage = prev[prev.length - 1];
              // Update last message if it's a non-final transcription from self
              if (lastMessage && lastMessage.isSelf && !lastMessage.isFinalTranscription) {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, message: messageText, timestamp, isFinalTranscription: isFinal } as ExtendedChatMessageType
                ];
              } else {
                // Add new message for new transcription
                return [
                  ...prev,
                  {
                    name: "You",
                    message: messageText,
                    timestamp: timestamp,
                    isSelf: true,
                    isFinalTranscription: isFinal // Add a flag to mark finality
                  } as ExtendedChatMessageType
                ];
              }
            });
          } catch (error) {
              console.error("Error updating transcript state from transcription:", error);
          }
        }
      );
    
      // Cleanup function
      return () => {
        console.log("Unsubscribing from voice transcriptions.");
        subscription.unsubscribe();
      };
    }, [voiceAssistant]); // Dependency: voiceAssistant hook instance. Ensure stability/memoization if necessary.
    ```
4.  **Update `ExtendedChatMessageType`:** Add the optional `isFinalTranscription` flag. Ensure this type is defined correctly within `PlaygroundMobile.tsx` or imported.
    ```typescript
    interface ExtendedChatMessageType extends ChatMessageType {
        isError?: boolean;
        isFinalTranscription?: boolean; // Add this
    }
    ```

### 3.5.4 Integrate Voice Assistant UI Feedback

**File:** `src/components/playground/PlaygroundMobile.tsx` (or pass down as props)

1.  **Import Components:**
    ```typescript
    import { TranscriptionTile } from "@/transcriptions/TranscriptionTile"; // Adjust path if needed
    import { BarVisualizer } from "@livekit/components-react";
    ```
2.  **Add State for Assistant Transcription Display:** Add state to control when the assistant's transcription tile is visible (e.g., only when the assistant is actually speaking).
    ```typescript
    const [showAssistantTranscription, setShowAssistantTranscription] = useState(false);
    ```
3.  **Use Effect for Assistant Speaking State:** Monitor the `voiceAssistant.audioTrack` to show/hide the transcription tile. Consider adding a small delay before hiding to prevent flickering.
    ```typescript
    useEffect(() => {
        // Show transcription tile when the assistant starts speaking
        if (voiceAssistant.audioTrack) {
            setShowAssistantTranscription(true);
        }
        // Optionally hide it after a short delay when assistant stops
        // This requires more complex state management or observing track ended events
    }, [voiceAssistant.audioTrack]);
    ```
4.  **Render `TranscriptionTile`:** Place the `TranscriptionTile` component within the UI. **Suggested Placement:** Inside the scrollable chat area, perhaps above the input but below the messages, conditionally rendered based on `showAssistantTranscription` and `voiceAssistant.audioTrack`.
    ```typescript
    // Example placement within the main content div of PlaygroundMobile.tsx
    // (Adjust styling and exact location as needed)
    {showAssistantTranscription && voiceAssistant.audioTrack && (
        <div className="p-2 border-t border-[#9C7C38]/20 sticky bottom-[YOUR_INPUT_AREA_HEIGHT] bg-[#F5EFE0]/80">
            <TranscriptionTile
                agentAudioTrack={voiceAssistant.audioTrack}
                accentColor={themeColors[0] || "cyan"} // Use theme color
            />
        </div>
    )}
    ```
5.  **Render `BarVisualizer`:** Place the `BarVisualizer` near the mic toggle button or another suitable location. **Suggested Placement:** Within the `MobileChatTile` input area, next to the mic button.
    ```typescript
    // Example placement within MobileChatTile.tsx (receiving voiceAssistant.audioTrack as prop)
    <div className="h-6 w-16"> {/* Adjust size as needed */}
        <BarVisualizer
            trackRef={voiceAssistant.audioTrack} // Pass this down as a prop
            barCount={10}
            options={{ minHeight: 5, maxHeight: 20 }} // Adjust styling for mobile
            style={{ borderRadius: '2px', gap: '1px' }}
        />
    </div>
    ```

### 3.5.5 Integrate RPC Handler for Video Control

**File:** `src/components/playground/PlaygroundMobile.tsx`

1.  **Import `RpcInvocationData`:**
    ```typescript
    import { RpcInvocationData } from "livekit-client";
    ```
2.  **Register RPC Method:** Add a `useEffect` hook dependent on `localParticipant` and `roomState`.
    ```typescript
    useEffect(() => {
      if (!localParticipant || roomState !== ConnectionState.Connected) {
        return; // Don't register if not connected or no participant
      }
    
      console.log("Registering mobile player-control RPC method");
    
      const rpcHandler = async (data: RpcInvocationData) => {
        try {
          console.log(`Received mobile player control from agent: ${data.payload}`);
          // Error handling suggestion: Add try-catch around JSON parsing
          let command;
          try {
              command = JSON.parse(data.payload);
          } catch (e) {
              console.error("Failed to parse RPC payload:", e);
              return JSON.stringify({ success: false, error: 'Invalid JSON payload' });
          }
    
          if (videoRef.current) {
            if (command.action === 'pause') {
              videoRef.current.pause();
              setIsPlaying(false); // Ensure UI state is updated
              console.log("Mobile video paused via RPC");
              return JSON.stringify({ success: true, action: 'pause' });
            } else if (command.action === 'play') {
              // Attempt to play, respecting autoplay policies
              try {
                  await videoRef.current.play();
                  setIsPlaying(true); // Ensure UI state is updated
                  console.log("Mobile video resumed via RPC");
                  return JSON.stringify({ success: true, action: 'play' });
              } catch (playError) {
                  console.error("RPC play command failed:", playError);
                  setIsPlaying(false); // Update UI if play failed
                  return JSON.stringify({ success: false, error: 'Play action failed', details: String(playError) });
              }
            }
          }
          return JSON.stringify({ success: false, error: 'Invalid command or video ref missing' });
        } catch (error) {
          console.error('Error handling mobile player control RPC:', error);
          return JSON.stringify({ success: false, error: String(error) });
        }
      };
    
      // Register the RPC method
      localParticipant.registerRpcMethod(
        'controlVideoPlayer', // Use the same name as desktop
        rpcHandler
      );
    
      // Cleanup function
      return () => {
        try {
          // Check if participant still exists before unregistering
          if (localParticipant) {
              localParticipant.unregisterRpcMethod('controlVideoPlayer');
              console.log("Unregistered mobile player-control RPC method");
          }
        } catch (error) {
          console.error("Error unregistering mobile RPC method:", error);
        }
      };
      // Dependencies: Ensure stability/memoization of setIsPlaying if needed.
    }, [localParticipant, roomState, videoRef, setIsPlaying]); // Verify dependencies are correct and stable
    ```

### 3.5.6 Testing and Refinement

*   Thoroughly test sending and receiving chat messages.
*   Test microphone input and verify transcriptions appear correctly (updating vs. new messages).
*   Verify the voice assistant's responses are heard and potentially transcribed by `TranscriptionTile`.
*   Check if `BarVisualizer` activates when the assistant speaks.
*   Trigger an engagement opportunity (if possible) to test if the agent can pause/resume the video via RPC.
*   Monitor console logs for successful subscriptions, message receipts, and any errors (including JSON parsing or state update errors).
*   Test on actual mobile devices to confirm UI layout and responsiveness of feedback elements.

## Phase 4: Tab Navigation (Edit Mode)

**Goal:** Implement a mobile-friendly navigation system for accessing different configuration sections in 'edit' mode.

### 4.1 Create Mobile Bottom Tab Bar Component

**Wireframe: Mobile Bottom Tab Bar**

```
┌───────────────────────────────────────────────┐
│                                               │
│               Content Area                    │
│                                               │
├───────────────────────────────────────────────┤
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐ │
│  │  •  │   │     │   │     │   │     │   │     │ │
│  │ Chat│   │Engage│   │Persona│  │Voice │   │Share│ │
└──┴─────┴───┴─────┴───┴─────┴───┴─────┴───┴─────┴─┘
    Active     Inactive    Tab      Tab      Tab
```

**File:** `src/components/playground/mobile/MobileBottomTabBar.tsx`

```typescript
import React from 'react';
import { MessageSquare, ClipboardList, User, Radio, Share2 } from 'lucide-react';

// Type definition for mobile tabs (reuse ConfigTab from Playground.tsx if possible, or define here)
// Assuming we use the type from PlaygroundMobile
import type { MobileTab } from '../PlaygroundMobile';

interface MobileBottomTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export const MobileBottomTabBar: React.FC<MobileBottomTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  // Define tab configuration
  const tabs: Array<{
    id: MobileTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare size={22} />,
    },
    {
      id: 'engagement',
      label: 'Engage',
      icon: <ClipboardList size={22} />,
    },
    {
      id: 'teaching-persona',
      label: 'Persona',
      icon: <User size={22} />,
    },
    {
      id: 'voice-clone',
      label: 'Voice',
      icon: <Radio size={22} />,
    },
    {
      id: 'share',
      label: 'Share',
      icon: <Share2 size={22} />,
    },
  ];

  return (
    <div className="h-full px-1 flex items-center justify-around bg-[#F5EFE0] border-t border-[#9C7C38]/30">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            relative flex flex-col items-center justify-center
            py-1.5 px-2 rounded-lg
            transition-all duration-300
            min-w-[56px] min-h-[48px] // Touch-friendly size
            ${activeTab === tab.id 
              ? 'text-[#9C7C38]' 
              : 'text-[#1E2A42]/60 hover:text-[#1E2A42]/80'}
          `}
        >
          {tab.icon}
          <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
          
          {/* Active indicator dot */}
          {activeTab === tab.id && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full 
              bg-[#9C7C38] shadow-[0_0_5px_rgba(156,124,56,0.5)]" 
            />
          )}
        </button>
      ))}
    </div>
  );
};
```

### 4.2 Integration into PlaygroundMobile

Update the `PlaygroundMobile.tsx` component to implement tab navigation:

```typescript
import { MobileBottomTabBar, MobileTab } from './mobile/MobileBottomTabBar';

// Inside the PlaygroundMobile component:
const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('chat');

// Ensure tab changes to 'chat' when switching to 'view' mode
useEffect(() => {
  if (params.agentType === 'view') {
    setActiveMobileTab('chat');
  }
}, [params.agentType]);

// Inside the render function, update the bottom tab bar:
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {/* Video Section, Progress Bar, and Content Section as before */}
    
    {/* Bottom Tab Bar (only in edit mode) */}
    {params.agentType === 'edit' && (
      <div className="h-14 bg-[#F5EFE0] border-t border-[#9C7C38]/30 flex-shrink-0">
        <MobileBottomTabBar
          activeTab={activeMobileTab}
          onTabChange={setActiveMobileTab}
        />
      </div>
    )}
  </div>
);
```

### 4.3 Tab Content Switching Logic

Update the content section to conditionally render different tab content based on the active tab:

```typescript
// Inside the render function's content section:
<div className="flex-1 overflow-hidden relative">
  {/* Chat Tab */}
  <div className={`absolute inset-0 transition-opacity duration-300 ${
    activeMobileTab === 'chat' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
  }`}>
    <MobileChatTile
      messages={transcripts}
      accentColor="cyan"
      onSend={handleChatMessage}
      isMicEnabled={localParticipant?.isMicrophoneEnabled || false}
      onToggleMic={() => {
        if (roomState === ConnectionState.Connected && localParticipant) {
          localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
        }
      }}
    />
  </div>
  
  {/* Engagement Tab - Only in edit mode */}
  {params.agentType === 'edit' && (
    <div className={`absolute inset-0 transition-opacity duration-300 ${
      activeMobileTab === 'engagement' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
    }`}>
      {/* MobileEngagementTab will be added in Phase 5 */}
      <div className="h-full flex items-center justify-center">
        <div className="text-[#1E2A42]/50">Engagement Tab Content</div>
      </div>
    </div>
  )}
  
  {/* Persona Tab - Only in edit mode */}
  {params.agentType === 'edit' && (
    <div className={`absolute inset-0 transition-opacity duration-300 ${
      activeMobileTab === 'teaching-persona' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
    }`}>
      {/* MobilePersonaTab will be added in Phase 5 */}
      <div className="h-full flex items-center justify-center">
        <div className="text-[#1E2A42]/50">Persona Tab Content</div>
      </div>
    </div>
  )}
  
  {/* Voice Tab - Only in edit mode */}
  {params.agentType === 'edit' && (
    <div className={`absolute inset-0 transition-opacity duration-300 ${
      activeMobileTab === 'voice-clone' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
    }`}>
      {/* MobileVoiceTab will be added in Phase 5 */}
      <div className="h-full flex items-center justify-center">
        <div className="text-[#1E2A42]/50">Voice Tab Content</div>
      </div>
    </div>
  )}
  
  {/* Share Tab - Only in edit mode */}
  {params.agentType === 'edit' && (
    <div className={`absolute inset-0 transition-opacity duration-300 ${
      activeMobileTab === 'share' ? 'opacity-100 z-30' : 'opacity-0 z-0 pointer-events-none'
    }`}>
      {/* MobileShareTab will be added in Phase 5 */}
      <div className="h-full flex items-center justify-center">
        <div className="text-[#1E2A42]/50">Share Tab Content</div>
      </div>
    </div>
  )}
</div>
```

## Phase 5: Adapt Content Tabs (Edit Mode)

**Goal:** Refactor the content of each configuration tab for optimal mobile usability.

### 5.1 Create Common Mobile UI Components

Before implementing each tab, let's create some common UI components that will be reused.

**File:** `src/components/playground/mobile/common/MobileAccordion.tsx`

```typescript
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileAccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MobileAccordion: React.FC<MobileAccordionProps> = ({
  title,
  defaultOpen = false,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-[#9C7C38]/30 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-[#FAF7ED]/80"
      >
        <span className="text-[14px] font-medium text-[#0A1933]">{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight size={16} className="text-[#9C7C38]" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-3 bg-[#F5EFE0]/60">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

### 5.2 Mobile Engagement Tab

**Wireframe: Mobile Engagement Tab**

```
┌───────────────────────────────────────────────┐
│                                               │
│  Engagement Opportunities        + Add New    │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Quiz (00:15:30)                      >  │  │ <- Collapsed card
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Discussion (00:22:15)                v  │  │ <- Expanded card
│  │                                         │  │
│  │  Rationale:                             │  │
│  │  This engagement point helps reinforce  │  │
│  │  the content by encouraging discussion. │  │
│  │                                         │  │
│  │  ┌─────────────────────────────────┐    │  │
│  │  │ Question details...          v  │    │  │ <- Nested accordion
│  │  └─────────────────────────────────┘    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

**File:** `src/components/playground/mobile/tabs/MobileEngagementTab.tsx`

```typescript
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, ChevronRight } from 'lucide-react'; // Add ChevronRight
import { motion } from 'framer-motion';
import { MobileAccordion } from '../common/MobileAccordion';
import { EngagementOpportunity, EngagementQuizItem } from '../../Playground';

// Helper functions (need to be defined or imported)
const formatVideoTime = (timestamp: string): string => { /* ... implementation ... */ return ''; };
const getEngagementTypeIcon = (type: string) => { /* ... implementation ... */ return null; };
const getQuestionTypeIcon = (type: string) => { /* ... implementation ... */ return null; };

interface MobileEngagementTabProps {
  engagementOpportunities: EngagementOpportunity[];
  onUpdateEngagement: (updatedEngagement: EngagementOpportunity) => void;
  onDeleteEngagement: (id: string) => void;
  onAddEngagement: () => void;
}

export const MobileEngagementTab: React.FC<MobileEngagementTabProps> = ({
  engagementOpportunities,
  onUpdateEngagement,
  onDeleteEngagement,
  onAddEngagement,
}) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [expandedQuizIds, setExpandedQuizIds] = useState<Record<string, string | null>>({});
  
  // Filter engagements by type
  const filteredEngagements = selectedType
    ? engagementOpportunities.filter(e => e.engagement_type === selectedType)
    : engagementOpportunities;

  return (
    <div className="h-full flex flex-col">
      {/* Header with filters */}
      <div className="px-4 py-3 bg-[#F5EFE0] border-b border-[#9C7C38]/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-medium text-[#0A1933]">Engagement Opportunities</h2>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onAddEngagement}
            className="p-2 rounded-lg bg-[#9C7C38]/20 text-[#9C7C38] flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span className="text-[13px]">Add New</span>
          </motion.button>
        </div>
        
        {/* Filter buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedType(null)}
            className={`
              px-3 py-1.5 rounded-full min-w-[80px] text-[13px]
              ${!selectedType ? 'bg-[#9C7C38]/20 text-[#9C7C38]' : 'bg-[#F5EFE0]/70 text-[#1E2A42]'}
            `}
          >
            All Types
          </button>
          <button
            onClick={() => setSelectedType(selectedType === 'quiz' ? null : 'quiz')}
            className={`
              px-3 py-1.5 rounded-full min-w-[80px] text-[13px] flex items-center gap-1.5
              ${selectedType === 'quiz' ? 'bg-[#9C7C38]/20 text-[#9C7C38]' : 'bg-[#F5EFE0]/70 text-[#1E2A42]'}
            `}
          >
            {getEngagementTypeIcon('quiz')}
            <span>Quizzes</span>
          </button>
          <button
            onClick={() => setSelectedType(selectedType === 'discussion' ? null : 'discussion')}
            className={`
              px-3 py-1.5 rounded-full min-w-[80px] text-[13px] flex items-center gap-1.5
              ${selectedType === 'discussion' ? 'bg-[#9C7C38]/20 text-[#9C7C38]' : 'bg-[#F5EFE0]/70 text-[#1E2A42]'}
            `}
          >
            {getEngagementTypeIcon('discussion')}
            <span>Discussions</span>
          </button>
        </div>
      </div>
      
      {/* Scrollable list of engagement cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEngagements.length > 0 ? (
          filteredEngagements.map((engagement) => (
            <div
              key={engagement.id}
              className="border border-[#9C7C38]/30 rounded-lg overflow-hidden bg-[#F5EFE0]/80"
            >
              {/* Card header - always visible */}
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedCardId(expandedCardId === engagement.id ? null : engagement.id)}
              >
                <div className="flex items-center gap-2">
                  {getEngagementTypeIcon(engagement.engagement_type)}
                  <span className="text-[14px] font-medium text-[#0A1933]">
                    {engagement.engagement_type === 'quiz' ? 'Quiz' : 'Discussion'}
                  </span>
                  <div className="px-2 py-0.5 bg-[#FAF7ED] rounded text-[12px] text-[#1E2A42] flex items-center gap-1">
                    {formatVideoTime(engagement.timestamp)}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Show edit UI (simplified for example)
                      alert(`Edit engagement ${engagement.id}`);
                    }}
                    className="p-1.5 rounded-md text-[#1E2A42]"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this engagement?')) {
                        onDeleteEngagement(engagement.id);
                      }
                    }}
                    className="p-1.5 rounded-md text-[#1E2A42]"
                  >
                    <Trash2 size={16} />
                  </button>
                  <motion.div
                    animate={{ rotate: expandedCardId === engagement.id ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-1"
                  >
                    <ChevronRight size={16} className="text-[#1E2A42]" />
                  </motion.div>
                </div>
              </div>
              
              {/* Expanded content */}
              {expandedCardId === engagement.id && (
                <div className="px-4 pb-3 space-y-3">
                  {/* Rationale */}
                  <div className="bg-[#FAF7ED]/90 p-3 rounded border border-[#9C7C38]/20">
                    <div className="text-[12px] text-[#0A1933]/70 mb-1">Rationale:</div>
                    <div className="text-[13px] text-[#0A1933]">{engagement.rationale}</div>
                  </div>
                  
                  {/* Quiz items */}
                  <div className="space-y-2">
                    {engagement.quiz_items.map((quiz, index) => (
                      <MobileAccordion
                        key={index}
                        title={`Question ${index + 1}: ${quiz.question_type}`}
                        defaultOpen={false}
                      >
                        <div className="space-y-3">
                          {/* Question */}
                          <div className="bg-[#FAF7ED]/90 p-3 rounded border border-[#9C7C38]/20">
                            <div className="text-[12px] text-[#0A1933]/70 mb-1">Question:</div>
                            <div className="text-[14px] text-[#0A1933]">{quiz.question}</div>
                          </div>
                          
                          {/* Options (for multiple choice) */}
                          {quiz.question_type === 'multiple_choice' && quiz.options && (
                            <div className="bg-[#FAF7ED]/90 p-3 rounded border border-[#9C7C38]/20">
                              <div className="text-[12px] text-[#0A1933]/70 mb-1">Options:</div>
                              <div className="space-y-2">
                                {quiz.options.map((option, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <div className={`flex items-center justify-center w-5 h-5 rounded-full mt-0.5 text-[10px] 
                                      ${option === quiz.correct_option
                                        ? 'bg-green-500/20 text-green-600 border border-green-500/50'
                                        : 'bg-[#F5EFE0] text-[#1E2A42] border border-[#9C7C38]/30'}`}>
                                      {option === quiz.correct_option ? '✓' : ''}
                                    </div>
                                    <div className={`text-[14px] ${option === quiz.correct_option ? 'text-green-700' : 'text-[#0A1933]'}`}>
                                      {option}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </MobileAccordion>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center p-6 bg-[#F5EFE0]/60 rounded-lg border border-[#9C7C38]/30">
            <div className="text-[#0A1933] text-[15px]">No engagement opportunities found</div>
            <div className="text-[#1E2A42] text-[13px] mt-1">
              Create new engagement opportunities using the "Add New" button
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 5.3 Mobile Persona Tab

**Wireframe: Mobile Persona Tab**

```
┌───────────────────────────────────────────────┐
│                                               │
│  Teaching Persona                Save Changes │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Instructor Profile                    v │  │ <- Expanded accordion
│  │                                         │  │
│  │  Name:                                  │  │
│  │  ┌─────────────────────────────────┐    │  │
│  │  │ John Doe                        │    │  │
│  │  └─────────────────────────────────┘    │  │
│  │                                         │  │
│  │  Expertise Level: Advanced              │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Communication Style                   > │  │ <- Collapsed accordion
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ Teaching Insights                     > │  │ <- Collapsed accordion
│  └─────────────────────────────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

**File:** `src/components/playground/mobile/tabs/MobilePersonaTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Save, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { MobileAccordion } from '../common/MobileAccordion';

interface MobilePersonaTabProps {
  teachingPersona: any;
  updateTeachingPersona: (path: string, value: any) => void;
  handleSaveConfig: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export const MobilePersonaTab: React.FC<MobilePersonaTabProps> = ({
  teachingPersona,
  updateTeachingPersona,
  handleSaveConfig,
  isSaving,
  saveSuccess,
}) => {
  // State for phrases text
  const [phrasesText, setPhrasesText] = useState('');
  const [speakingPaceValue, setSpeakingPaceValue] = useState(3);

  // Initialize from existing phrases when teachingPersona changes
  useEffect(() => {
    if (teachingPersona?.communication_patterns?.recurring_phrases) {
      setPhrasesText(teachingPersona.communication_patterns.recurring_phrases
        .map((p: any) => p.phrase)
        .join('\n')
      );
    }
    
    // Set speaking pace value based on extracted data
    const pace = teachingPersona?.speech_characteristics?.accent?.cadence || '';
    if (pace.toLowerCase().includes('slow')) setSpeakingPaceValue(1);
    else if (pace.toLowerCase().includes('fast')) setSpeakingPaceValue(5);
    else setSpeakingPaceValue(3); // Default to moderate
  }, [teachingPersona]);

  // Helper function to update recurring phrases
  const updateRecurringPhrases = (phrasesText: string) => {
    const phrases = phrasesText
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(phrase => ({
        phrase: phrase.trim(),
        frequency: "medium",
        usage_context: "General conversation"
      }));

    updateTeachingPersona('communication_patterns.recurring_phrases', phrases);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with save button */}
      <div className="px-4 py-3 bg-[#F5EFE0] border-b border-[#9C7C38]/20 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-[#0A1933]">Teaching Persona</h2>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSaveConfig}
            disabled={isSaving}
            className={`
              px-3 py-1.5 rounded-lg
              flex items-center gap-1.5
              ${saveSuccess
                ? 'bg-green-500/10 text-green-600 border-green-500/30'
                : 'bg-[#9C7C38]/20 text-[#9C7C38] border-[#9C7C38]/30'}
              border
              transition-all duration-200
              text-[13px] font-medium
              disabled:opacity-50
            `}
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save Changes')}</span>
          </motion.button>
        </div>
      </div>
      
      {/* Scrollable content with accordions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Instructor Profile Section */}
        <MobileAccordion title="Instructor Profile" defaultOpen={true}>
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block mb-1 text-[13px] font-medium text-[#0A1933]/70">Name</label>
              <input
                type="text"
                value={teachingPersona?.instructor_profile?.name || ''}
                onChange={(e) => updateTeachingPersona('instructor_profile.name', e.target.value)}
                className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                  px-4 py-3 text-[14px] text-[#0A1933]
                  transition-all duration-300
                  focus:ring-1 focus:ring-[#9C7C38]/40 
                  focus:border-[#9C7C38]/50
                  hover:border-[#9C7C38]/40"
                placeholder="Enter instructor name..."
              />
            </div>
            
            {/* Expertise Level Info */}
            <div className="p-3 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
              <div className="flex items-center">
                <Info size={14} className="text-[#1E2A42]/50 mr-2" />
                <span className="text-[12px] text-[#0A1933]/70">Extracted Expertise Level</span>
              </div>
              <p className="mt-1 text-[13px] text-[#0A1933]/90">
                {teachingPersona?.instructor_profile?.apparent_expertise_level || 'No expertise level detected'}
              </p>
            </div>
          </div>
        </MobileAccordion>
        
        {/* Communication Style Section */}
        <MobileAccordion title="Communication Style" defaultOpen={false}>
          <div className="space-y-4">
            {/* Communication Style Field */}
            <div>
              <label className="block mb-1 text-[13px] font-medium text-[#0A1933]/70">Overall Style</label>
              <input
                type="text"
                value={teachingPersona?.communication_patterns?.vocabulary_level || ''}
                onChange={(e) => updateTeachingPersona('communication_patterns.vocabulary_level', e.target.value)}
                className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                  px-4 py-3 text-[14px] text-[#0A1933]
                  transition-all duration-300
                  focus:ring-1 focus:ring-[#9C7C38]/40 
                  focus:border-[#9C7C38]/50
                  hover:border-[#9C7C38]/40"
                placeholder="Professional, casual, technical, etc."
              />
              
              {/* Style Quick Selectors */}
              <div className="flex flex-wrap gap-2 mt-2">
                {["professional", "friendly", "technical", "casual", "authoritative"].map(style => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => updateTeachingPersona('communication_patterns.vocabulary_level', style)}
                    className={`
                      px-3 py-1.5 rounded-full text-[12px]
                      transition-all duration-300
                      border 
                      ${teachingPersona?.communication_patterns?.vocabulary_level === style
                        ? 'bg-[#9C7C38]/20 text-[#9C7C38] border-[#9C7C38]/30'
                        : 'bg-[#F5EFE0]/70 text-[#1E2A42] border-[#9C7C38]/20 hover:text-[#0A1933] hover:border-[#9C7C38]/30'
                      }
                    `}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Recurring Phrases */}
            <div>
              <label className="block mb-1 text-[13px] font-medium text-[#0A1933]/70">Characteristic Phrases</label>
              <textarea
                value={phrasesText}
                onChange={(e) => {
                  setPhrasesText(e.target.value);
                }}
                onBlur={() => {
                  updateRecurringPhrases(phrasesText);
                }}
                className="w-full bg-[#FAF7ED]/80 border border-[#9C7C38]/30 rounded-lg
                  px-4 py-3 text-[14px] text-[#0A1933] min-h-[100px]
                  transition-all duration-300
                  focus:ring-1 focus:ring-[#9C7C38]/40 
                  focus:border-[#9C7C38]/50
                  hover:border-[#9C7C38]/40 resize-y"
                placeholder="Enter phrases the instructor frequently uses (one per line)..."
              />
              <div className="mt-1 text-[11px] text-[#1E2A42]/60 px-1 italic">
                These phrases will be used by the AI to sound more like the actual instructor
              </div>
            </div>
          </div>
        </MobileAccordion>
        
        {/* Teaching Insights Section */}
        <MobileAccordion title="Teaching Insights" defaultOpen={false}>
          <div className="space-y-3">
            {/* Speech Characteristics Card */}
            <div className="p-3 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
              <div className="flex justify-between items-center">
                <h3 className="text-[14px] font-medium text-[#9C7C38]">Speech Style</h3>
              </div>
              <p className="mt-1 text-[13px] text-[#0A1933]/90">
                {teachingPersona?.speech_characteristics?.accent?.type || 'No accent detected'}
              </p>
              <p className="mt-1 text-[13px] text-[#0A1933]/90">
                Cadence: {teachingPersona?.speech_characteristics?.accent?.cadence || 'Not detected'}
              </p>
            </div>
            
            {/* Pedagogical Approach Card */}
            <div className="p-3 bg-[#F5EFE0]/80 rounded-lg border border-[#9C7C38]/20">
              <div className="flex justify-between items-center">
                <h3 className="text-[14px] font-medium text-[#9C7C38]">Teaching Approach</h3>
              </div>
              <div className="mt-1 space-y-1">
                {teachingPersona?.pedagogical_approach?.explanation_techniques?.map((technique: any, idx: number) => (
                  <div key={idx} className="flex items-start">
                    <span className="text-[#9C7C38]/80 mt-1 text-[11px] mr-1">•</span>
                    <p className="text-[13px] text-[#0A1933]/90">
                      {technique.technique}: {technique.example}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </MobileAccordion>
      </div>
    </div>
  );
};
```

This completes Phases 4 and 5, implementing a mobile-friendly tab navigation system and adapting the core content tabs for optimal mobile usability. The MobilePersonaTab and MobileEngagementTab components demonstrate how to rebuild the desktop interface into a touch-optimized mobile experience with larger touch targets, accordion-based organization, and clear visual hierarchies.

I've shown only two of the tabs in detail to keep the document length manageable, but the Voice and Share tabs would follow similar patterns with touch-optimized controls and mobile-friendly layouts.

## Phase 6: Polish & Advanced Interactions

**Goal:** Refine the user experience with advanced touch gestures, feedback, and thorough testing.

### 6.1 Advanced Video Gesture Controls

**File:** `src/components/playground/mobile/MobileGestureHandler.tsx`

```typescript
import React, { useRef, useEffect } from 'react';

interface GestureHandlerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  seekOffset?: number; // Seconds to seek forward/backward
  children: React.ReactNode;
}

export const MobileGestureHandler: React.FC<GestureHandlerProps> = ({
  videoRef,
  seekOffset = 10,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const MIN_SWIPE_DISTANCE = 50; // Minimum distance to trigger a swipe

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Handle double tap
    const handleTap = (e: TouchEvent) => {
      const now = new Date().getTime();
      const timeSince = now - lastTapTimeRef.current;
      
      if (timeSince < 300 && timeSince > 0) {
        // Double tap detected
        e.preventDefault();
        
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
        
        // Provide haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
      
      lastTapTimeRef.current = now;
    };

    // Handle swipe gestures
    const handleTouchStart = (e: TouchEvent) => {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartXRef.current === null || touchStartYRef.current === null) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const deltaX = touchEndX - touchStartXRef.current;
      const deltaY = touchEndY - touchStartYRef.current;
      
      // Check if the movement was more horizontal than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
        if (videoRef.current) {
          if (deltaX > 0) {
            // Swipe right - seek forward
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration,
              videoRef.current.currentTime + seekOffset
            );
          } else {
            // Swipe left - seek backward
            videoRef.current.currentTime = Math.max(
              0,
              videoRef.current.currentTime - seekOffset
            );
          }
          
          // Provide haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }
      
      touchStartXRef.current = null;
      touchStartYRef.current = null;
    };

    // Attach event listeners
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('click', handleTap);

    // Clean up
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('click', handleTap);
    };
  }, [videoRef, seekOffset]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {children}
    </div>
  );
};
```

### 6.2 Integrate Gesture Handler with Video Player

Modify the `MobileVideoPlayer` component to include gesture controls:

```typescript
// In MobileVideoPlayer.tsx
import { MobileGestureHandler } from './MobileGestureHandler';

// Inside the MobileVideoPlayer render function:
return (
  <div className="relative w-full h-full bg-black">
    <MobileGestureHandler videoRef={videoRef} seekOffset={10}>
      {/* Rest of the video player content */}
      {videoUrl ? (
        <div className="w-full h-full flex items-center justify-center bg-black">
          {/* ... existing video element ... */}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-red-900/30 border-t-red-900 animate-spin rounded-full" />
        </div>
      )}
      
      {/* ... existing play button overlay and other overlays ... */}
    </MobileGestureHandler>
  </div>
);
```

### 6.3 Add Haptic Feedback to Key Interactions

Create a utility function to provide haptic feedback for touch interactions:

**File:** `src/components/playground/mobile/utils/haptics.ts`

```typescript
/**
 * Provides haptic feedback if available on the device.
 * @param pattern - A vibration pattern in milliseconds or a single duration
 */
export const triggerHapticFeedback = (pattern: number | number[] = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
    return true;
  }
  return false;
};

/**
 * Predefined haptic patterns for different types of interactions
 */
export const hapticPatterns = {
  success: 50,
  error: [100, 30, 100],
  warning: [30, 20, 30],
  selection: 40,
  heavyClick: 70,
  lightClick: 20,
  tabChange: 30,
  scrubbing: 15,
};
```

Apply haptic feedback to key interactions in various components:

```typescript
// In MobileBottomTabBar.tsx
import { triggerHapticFeedback, hapticPatterns } from '../utils/haptics';

// Inside tab click handler:
const handleTabClick = (tabId: MobileTab) => {
  triggerHapticFeedback(hapticPatterns.tabChange);
  onTabChange(tabId);
};
```

### 6.4 Add Visual Feedback for Touch Interactions

Enhance visual feedback for touch interactions by adding active states to buttons and interactive elements:

```typescript
// Example for a button with enhanced feedback
<motion.button
  whileTap={{ scale: 0.95, backgroundColor: 'rgba(156,124,56,0.3)' }}
  transition={{ duration: 0.1 }}
  onClick={() => {
    triggerHapticFeedback(hapticPatterns.selection);
    handleAction();
  }}
  className="p-3 rounded-lg bg-[#9C7C38]/20 text-[#9C7C38]
    active:bg-[#9C7C38]/30 active:shadow-inner
    transition-all duration-100"
>
  Submit
</motion.button>
```

### 6.5 Responsive Layout for Different Mobile Devices

Add responsive adjustments for different device sizes:

```typescript
// In PlaygroundMobile.tsx
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {/* Video section with responsive height */}
    <div className="h-[40vh] md:h-[35vh] lg:h-[30vh] flex-shrink-0 bg-black relative">
      {/* ... */}
    </div>
    
    {/* Progress bar with responsive sizing */}
    <div className="bg-black/40 relative py-2 sm:py-3">
      {/* ... */}
    </div>
    
    {/* Bottom tab bar with responsive heights */}
    {params.agentType === 'edit' && (
      <div className="h-12 sm:h-14 md:h-16 bg-[#F5EFE0] border-t border-[#9C7C38]/30 flex-shrink-0">
        {/* ... */}
      </div>
    )}
  </div>
);
```

### 6.6 Optimize Loading States and Transitions

Add loading states and smooth transitions to improve perceived performance:

```typescript
// In PlaygroundMobile.tsx
const [isInitialLoading, setIsInitialLoading] = useState(true);
const [isTabTransitioning, setIsTabTransitioning] = useState(false);

// Reset loading state once data is loaded
useEffect(() => {
  if (videoUrl && agentConfig) {
    // Delay hiding the loader slightly to ensure smooth transition
    setTimeout(() => {
      setIsInitialLoading(false);
    }, 300);
  }
}, [videoUrl, agentConfig]);

// Add transition state when changing tabs
const handleTabChange = (tab: MobileTab) => {
  setIsTabTransitioning(true);
  setActiveMobileTab(tab);
  
  // Reset transition state after animation completes
  setTimeout(() => {
    setIsTabTransitioning(false);
  }, 300);
};

// Add loading state to the render function
return (
  <div className="h-screen flex flex-col bg-[#F5EFE0] relative overflow-hidden">
    {isInitialLoading ? (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F5EFE0]">
        <div className="w-16 h-16 border-4 border-[#9C7C38]/20 border-t-[#9C7C38] rounded-full animate-spin"></div>
        <div className="mt-4 text-[#9C7C38]">Loading...</div>
      </div>
    ) : (
      <>
        {/* Regular layout content */}
      </>
    )}
  </div>
);
```

## Technical Considerations

### Browser Compatibility

The mobile interface should support these browsers/platforms:

1. **iOS Safari** (current and -1 version)
   - Special attention to iOS-specific issues with fixed positioning, viewport height, and touch events
   - Test on both iPhone and iPad devices

2. **Android Chrome/WebView** (current and -1 version)
   - Test on different Android screen sizes and resolutions
   - Validate performance on mid-range Android devices

3. **Android Firefox** (current version)
   - Ensure gesture compatibility

### Device Orientation

While the primary design is for portrait mode, landscape considerations should include:

1. **Portrait (Primary)**
   - All interactive elements fully accessible
   - Proper keyboard handling when input fields are focused
   - Maintain proper spacing of touch targets (minimum 44×44 px)

2. **Landscape (Secondary)**
   - Video player expands to take advantage of wider viewport
   - Consider collapsing the bottom tab bar or making it less prominent
   - May hide certain UI elements to focus on video playback

### Authentication & API Integration

1. **Auth Token Handling**
   - Maintain the same authentication mechanism as the desktop version
   - Ensure proper token refresh and error handling

2. **API Retry Strategy**
   - Implement smart retries for API requests that may fail due to intermittent mobile network issues
   - Add offline indication when network is unavailable

### Media Handling

1. **Video Playback**
   - Optimize initial loading strategy (consider lower quality initial frames)
   - Implement proper handling of mobile device wake/sleep and app backgrounding
   - Add support for native fullscreen mode

2. **Audio Recording**
   - Request microphone permissions properly on mobile
   - Handle recording interruptions (calls, notifications)
   - Provide clear feedback during recording process

## Performance Optimization

### Network Considerations

1. **Reduced Bundle Size**
   - Implement code-splitting for mobile-specific components
   - Lazy-load tab content that isn't immediately needed

2. **Optimized Network Requests**
   - Implement request batching where appropriate
   - Add request caching for frequently accessed resources
   - Prioritize loading critical resources first

### Rendering Performance

1. **Prevent Unnecessary Re-Renders**
   - Use `React.memo` for pure components
   - Optimize dependency arrays in `useEffect` and other hooks
   - Move computationally intensive operations to Web Workers if needed

2. **Optimize Animations**
   - Use GPU-accelerated properties (`transform`, `opacity`) for animations
   - Avoid animating layout properties like `width` or `height`
   - Implement animation throttling on lower-end devices

3. **DOM Size Management**
   - Implement virtualization for long lists (especially in chat)
   - Limit the number of rendered DOM nodes
   - Reduce CSS complexity where possible

### Memory Management

1. **Resource Cleanup**
   - Properly dispose of video and audio resources when not needed
   - Clean up event listeners in `useEffect` cleanup functions
   - Release references to large objects when components unmount

2. **Lazy Loading**
   - Implement IntersectionObserver for lazy loading images and components
   - Defer non-critical JavaScript execution

## Accessibility Checklist

### Touch Targets

- [ ] All interactive elements have touch targets of at least 44×44 pixels
- [ ] Sufficient spacing between clickable elements (min 8px)
- [ ] Active states clearly indicate when elements are being touched

### Visual Design

- [ ] Maintain text contrast ratio of at least 4.5:1 for normal text and 3:1 for large text
- [ ] Do not rely solely on color to convey information
- [ ] Support system font size adjustments
- [ ] Provide clear focus states for all interactive elements

### Screen Readers

- [ ] All controls have appropriate ARIA roles and labels
- [ ] Custom components have proper keyboard navigation support
- [ ] Video player controls are accessible via screen readers
- [ ] Dynamic content changes are announced appropriately

### Motion & Animation

- [ ] Respect user's reduced motion settings
- [ ] Avoid automatically playing animations that cannot be paused
- [ ] Ensure sufficient time for reading notifications or toasts

## Complete Mobile Layout Wireframes

**View Mode: Full Layout**
```
┌──────────────────────────────────────────────┐
│                                              │
│                                              │
│              Video Player (40%)              │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│●───────────○──────○──────○────────○─────────│ <- Progress bar with
│0:15                1:30               2:45   │    timeline markers
├──────────────────────────────────────────────┤
│                                              │
│ You                                          │
│ ┌────────────────────────────────────┐       │
│ │This is a user message              │       │
│ └────────────────────────────────────┘       │
│                                              │
│       ┌────────────────────────────────┐     │
│       │This is an AI assistant         │     │ <- Chat messages
│       │message with a response         │     │
│       └────────────────────────────────┘     │
│                                              │
│                                              │
│ ┌────────────────────────────────────┐       │
│ │How does this work?                 │       │
│ └────────────────────────────────────┘       │
│                                              │
├──────────────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌───┐ ┌───┐    │
│ │ Type a message...         │ │🎤│ │ ▶ │    │ <- Input area
│ └───────────────────────────┘ └───┘ └───┘    │
└──────────────────────────────────────────────┘
```

**Edit Mode: Bottom Tab Navigation**
```
┌──────────────────────────────────────────────┐
│                                              │
│              Video Player (35%)              │
│                                              │
├──────────────────────────────────────────────┤
│●───────────○──────○──────○────────○─────────│ <- Progress bar
├──────────────────────────────────────────────┤
│                                              │
│               Active Tab Content             │
│                                              │
│               (scrollable area)              │
│                                              │
│                                              │
│                                              │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│ ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐       │
│ │ •  │  │    │  │    │  │    │  │    │       │ <- Bottom tab bar
│ │Chat│  │Eng.│  │Pers│  │Voice│  │Share│      │    (• indicates
└──┴────┴──┴────┴──┴────┴──┴────┴──┴────┴──────┘     active tab)
```

**Engagement Tab with Nested Accordion**
```
┌──────────────────────────────────────────────┐
│              Video Player (35%)              │
├──────────────────────────────────────────────┤
│●───────────○──────○──────○────────○─────────│
├──────────────────────────────────────────────┤
│                                              │
│ Engagement Opportunities        + Add New    │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │ Quiz (00:15:30)                     >  │   │ <- Collapsed card
│ └────────────────────────────────────────┘   │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │ Discussion (00:22:15)                v │   │
│ │                                        │   │
│ │ Rationale: This helps reinforce the    │   │ <- Expanded card
│ │ content by encouraging discussion.     │   │
│ │                                        │   │
│ │ ┌──────────────────────────────────┐   │   │
│ │ │ Question details...           v  │   │   │ <- Nested accordion
│ │ └──────────────────────────────────┘   │   │
│ └────────────────────────────────────────┘   │
│                                              │
├──────────────────────────────────────────────┤
│ ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐       │
│ │    │  │ •  │  │    │  │    │  │    │       │ <- Bottom tab bar
│ │Chat│  │Eng.│  │Pers│  │Voice│  │Share│      │    (Engagement tab
└──┴────┴──┴────┴──┴────┴──┴────┴──┴────┴──────┘     active)
```

This comprehensive document outlines a detailed, phased approach to refactoring the desktop Playground component into a mobile-optimized experience. By following this plan, we'll create a touch-first interface that maintains all the functionality of the desktop version while providing an intuitive, efficient mobile experience.
