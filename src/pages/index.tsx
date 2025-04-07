import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Inter } from "next/font/google";
import Head from "next/head";
import { useCallback, useState, useEffect } from "react";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { PlaygroundConnect } from "@/components/PlaygroundConnect";
import Playground from "@/components/playground/Playground";
import MobilePlayground from "@/components/playground/mobile/MobilePlayground";
import { PlaygroundToast, ToastType } from "@/components/toast/PlaygroundToast";
import { ConfigProvider, useConfig } from "@/hooks/useConfig";
import { ConnectionMode, ConnectionProvider, useConnection } from "@/hooks/useConnection";
import { useMemo } from "react";
import { ToastProvider, useToast } from "@/components/toast/ToasterProvider";
import neoScholarTheme from '@/theme/neo-scholar';

const themeColors = [
  "cyan",
  "green",
  "amber",
  "blue",
  "violet",
  "rose",
  "pink",
  "teal",
];

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <ConnectionProvider>
          <ThemeProvider theme={neoScholarTheme}>
            <CssBaseline />
            <HomeInner />
          </ThemeProvider>
        </ConnectionProvider>
      </ConfigProvider>
    </ToastProvider>
  );
}

export function HomeInner() {
  const { shouldConnect, wsUrl, token, mode, connect, disconnect } =
    useConnection();

  const { config } = useConfig();
  const { toastMessage, setToastMessage } = useToast();
  const [brdgeId, setBrdgeId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [urlParams, setUrlParams] = useState<{ brdgeId: string | null; token?: string; agentType?: 'edit' | 'view'; userId?: string }>({ brdgeId: null, token: undefined, agentType: 'edit' });
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showRotationPrompt, setShowRotationPrompt] = useState(false);

  // Get URL params including brdgeId and detect mobile devices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const brdgeIdParam = searchParams.get('brdgeId');
      const tokenParam = searchParams.get('token');
      const userIdParam = searchParams.get('userId');

      setUrlParams({
        brdgeId: brdgeIdParam,
        token: tokenParam || undefined,
        userId: userIdParam || undefined
      });
      setBrdgeId(brdgeIdParam);

      // Function to check if device is mobile
      const checkMobile = () => {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        const isMobileResult = isMobileDevice || isSmallScreen || searchParams.get('mobile') === '1';

        // Check orientation
        const isPortrait = window.innerHeight > window.innerWidth;

        setIsMobile(isMobileResult);
        setOrientation(isPortrait ? 'portrait' : 'landscape');

        // Show rotation prompt only if mobile AND portrait
        setShowRotationPrompt(isMobileResult && isPortrait);
      };

      // Initial check
      checkMobile();

      // Add resize listener
      window.addEventListener('resize', checkMobile);
      window.addEventListener('orientationchange', checkMobile);

      // Cleanup
      return () => {
        window.removeEventListener('resize', checkMobile);
        window.removeEventListener('orientationchange', checkMobile);
      };
    }
  }, []);

  const handleConnect = useCallback(
    async (c: boolean, mode: ConnectionMode) => {
      if (c) {
        if (typeof brdgeId === 'string') {
          connect(mode, brdgeId, urlParams.userId);
        } else {
          connect(mode);
        }
      } else {
        disconnect();
      }
    },
    [connect, disconnect, brdgeId, urlParams.userId]
  );

  const showPG = useMemo(() => {
    if (process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      return true;
    }
    if (wsUrl) {
      return true;
    }
    return false;
  }, [wsUrl])

  // Determine which Playground component to render
  const PlaygroundComponent = isMobile ? Playground : Playground;

  // Add global styles to prevent scrolling and bouncing effects
  useEffect(() => {
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    // Prevent iOS overscroll/bounce effect
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';

    // Cleanup
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
    };
  }, []);

  return (
    <>
      <Head>
        <title>{config.title}</title>
        <meta name="description" content={config.description} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta
          property="og:image"
          content="https://livekit.io/images/og/agents-playground.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main
        className="relative flex flex-col justify-center items-center bg-black repeating-square-background"
        style={{
          height: '100dvh',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          touchAction: 'none'
        }}
      >
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className="left-0 right-0 top-0 absolute z-10"
              initial={{ opacity: 0, translateY: -50 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -50 }}
            >
              <PlaygroundToast />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Rotation Prompt Overlay */}
        <AnimatePresence>
          {showRotationPrompt && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white p-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="mb-5"
                animate={{
                  rotate: [0, -90],
                  transition: {
                    repeat: Infinity,
                    repeatType: "reverse",
                    duration: 1.5
                  }
                }}
              >
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="2" width="14" height="20" rx="2" stroke="white" strokeWidth="2" />
                  <circle cx="12" cy="18" r="1" fill="white" />
                </svg>
              </motion.div>

              <h2 className="text-xl font-bold mb-2">Please rotate your device</h2>
              <p className="text-center mb-6">
                Brdge works best in landscape mode on mobile devices.
              </p>

              <button
                onClick={() => setShowRotationPrompt(false)}
                className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20 transition-colors"
              >
                Continue anyway
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {showPG ? (
          <LiveKitRoom
            className="flex flex-col"
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden'
            }}
            serverUrl={wsUrl}
            token={token}
            connect={shouldConnect}
            onError={(e) => {
              setToastMessage({ message: e.message, type: "error" });
              console.error(e);
            }}
          >
            <PlaygroundComponent
              themeColors={themeColors}
              onConnect={(c) => {
                const m = process.env.NEXT_PUBLIC_LIVEKIT_URL ? "env" : mode;
                handleConnect(c, m);
              }}
              agentType={urlParams?.agentType as 'edit' | 'view'}
              userId={urlParams?.userId}
              brdgeId={urlParams.brdgeId}
              token={urlParams.token}
            />
            <RoomAudioRenderer />
            <StartAudio label="Click to enable audio playback" />
          </LiveKitRoom>
        ) : (
          <PlaygroundConnect
            accentColor={themeColors[0]}
            onConnectClicked={(mode) => {
              handleConnect(true, mode);
            }}
          />
        )}
      </main>
    </>
  );
}