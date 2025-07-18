import {
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Inter } from "next/font/google";
import Head from "next/head";
import dynamic from 'next/dynamic';
import { useCallback, useState, useEffect, useMemo } from "react";

import { PlaygroundConnect } from "@/components/PlaygroundConnect";
import Playground from "@/components/playground/Playground";
import MobilePlayground from "@/components/playground/PlaygroundMobile";
import { PlaygroundToast, ToastType } from "@/components/toast/PlaygroundToast";
import { ConfigProvider, useConfig } from "@/hooks/useConfig";
import { ConnectionMode, ConnectionProvider, useConnection } from "@/hooks/useConnection";
import { ToastProvider, useToast } from "@/components/toast/ToasterProvider";
import { setAuthToken } from "@/api";

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

// Define the component that includes providers and HomeInner
function ClientSideApp() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <ConnectionProvider>
          <HomeInner />
        </ConnectionProvider>
      </ConfigProvider>
    </ToastProvider>
  );
}

// Dynamically import the ClientSideApp with ssr: false
// Use a more explicit type hint for dynamic import
const DynamicClientSideApp = dynamic<{}>(() => Promise.resolve(ClientSideApp), {
  ssr: false,
});

export default function Home() {
  // Render the dynamically imported component
  return <DynamicClientSideApp />;
}

export function HomeInner() {
  const { shouldConnect, wsUrl, token: livekitToken, mode, connect, disconnect } =
    useConnection();

  const { config } = useConfig();
  const { toastMessage, setToastMessage } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  const [urlParams, setUrlParams] = useState<{ brdgeId: string | null; agentType?: 'edit' | 'view'; userId?: string; personalizationId?: string; isEmbed?: boolean }>({ brdgeId: null, agentType: 'edit' });
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showRotationPrompt, setShowRotationPrompt] = useState(false);

  // Get URL params (excluding token) and detect mobile devices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const brdgeIdParam = searchParams.get('brdgeId');
      const userIdParam = searchParams.get('userId');
      const agentTypeParam = searchParams.get('agentType') as 'edit' | 'view'; // Read agentType
      const personalizationIdParam = searchParams.get('id'); // Get personalization ID from 'id' parameter
      const isEmbed = searchParams.get('embed') === '1'; // Check if in embed mode

      console.log('🔄 Playground: URL params extracted:', {
        brdgeId: brdgeIdParam,
        userId: userIdParam,
        agentType: agentTypeParam,
        personalizationId: personalizationIdParam,
        isEmbed: isEmbed
      });

      setUrlParams({
        brdgeId: brdgeIdParam,
        userId: userIdParam || undefined,
        agentType: agentTypeParam || 'edit', // Default to edit if not specified
        personalizationId: personalizationIdParam || undefined,
        isEmbed: isEmbed || false
      });

      // Pass embed status to child components via context or props
      if (typeof window !== 'undefined' && isEmbed) {
        (window as any).__IS_EMBED__ = true;
      }

      // Function to check if device is mobile
      const checkMobile = () => {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        const isMobileResult = isMobileDevice || isSmallScreen || searchParams.get('mobile') === '1';

        // Check orientation
        const isPortrait = window.innerHeight > window.innerWidth;

        setIsMobile(isMobileResult);
        setOrientation(isPortrait ? 'portrait' : 'landscape');

        // Disable rotation prompt by setting to false regardless of orientation
        setShowRotationPrompt(false);
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

  // Effect to listen for AUTH_TOKEN from parent window
  useEffect(() => {
    console.log("Setting up postMessage listener for AUTH_TOKEN");

    const handleMessage = (event: MessageEvent) => {
      // Log all incoming messages for debugging
      console.log("🔍 Message received:", {
        origin: event.origin,
        type: event.data?.type,
        hasToken: !!event.data?.token,
        tokenLength: event.data?.token?.length || 0
      });

      // TEMPORARY: For testing, accept messages from any origin
      // WARNING: This is not secure for production!
      if (event.data && event.data.type === 'AUTH_TOKEN' && typeof event.data.token === 'string') {
        console.log('✅ AUTH_TOKEN received from:', event.origin);
        console.log('🔑 Token preview:', event.data.token.substring(0, 20) + '...');

        // Update React state
        setAuthTokenState(event.data.token);

        // Update API module
        setAuthToken(event.data.token);

        // Verify token was set
        console.log("✅ Token set in state and API module");

        // Send acknowledgment back to parent
        if (event.source && typeof event.source.postMessage === 'function') {
          try {
            (event.source as Window).postMessage(
              { type: 'AUTH_TOKEN_ACK', received: true },
              event.origin
            );
            console.log("📨 Sent AUTH_TOKEN_ACK back to parent");
          } catch (error) {
            console.error("Failed to send acknowledgment:", error);
          }
        }
      } else {
        console.log("❌ Invalid or missing AUTH_TOKEN in message:", event.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Log to confirm listener is active
    console.log("👂 PostMessage listener active");

    // Cleanup: remove the listener when the component unmounts
    return () => {
      console.log("🧹 Removing postMessage listener");
      window.removeEventListener('message', handleMessage);
      setAuthToken(null);
    };
  }, []); // Empty dependency array means this effect runs once on mount

  // Add logging when authToken state changes
  useEffect(() => {
    console.log("🔄 AuthToken state changed:", {
      hasToken: !!authToken,
      tokenLength: authToken?.length || 0,
      tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'null'
    });
  }, [authToken]);

  const handleConnect = useCallback(
    async (c: boolean, mode: ConnectionMode) => {
      if (c) {
        if (typeof urlParams.brdgeId === 'string') { // Use urlParams.brdgeId
          console.log('🚀 Playground: Connecting with params:', {
            mode: mode,
            brdgeId: urlParams.brdgeId,
            userId: urlParams.userId,
            personalizationId: urlParams.personalizationId
          });
          connect(mode, urlParams.brdgeId, urlParams.userId, urlParams.personalizationId);
        } else {
          console.log('🚀 Playground: Connecting without brdgeId (mode only)');
          connect(mode);
        }
      } else {
        console.log('🔌 Playground: Disconnecting');
        disconnect();
      }
    },
    [connect, disconnect, urlParams.brdgeId, urlParams.userId, urlParams.personalizationId] // Use urlParams values
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

  // Add global styles to prevent scrolling and bouncing effects
  useEffect(() => {
    // Only prevent scrolling for standalone playground, not embeds
    if (!urlParams.isEmbed) {
      // Prevent scrolling on the body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overscrollBehavior = 'none';

      // Prevent iOS overscroll/bounce effect
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.position = 'fixed';
      document.documentElement.style.width = '100%';
      document.documentElement.style.height = '100%';
      document.documentElement.style.overscrollBehavior = 'none';

      // Cleanup
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.position = '';
        document.documentElement.style.width = '';
        document.documentElement.style.height = '';
        document.documentElement.style.overscrollBehavior = '';
      };
    }
  }, [urlParams.isEmbed]);

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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
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
            token={livekitToken}
            connect={shouldConnect}
            onError={(e) => {
              setToastMessage({ message: e.message, type: "error" });
              console.error(e);
            }}
          >
            {isMobile ? (
              <MobilePlayground
                themeColors={themeColors}
                onConnect={(c) => {
                  const m = process.env.NEXT_PUBLIC_LIVEKIT_URL ? "env" : mode;
                  handleConnect(c, m);
                }}
                agentType={urlParams?.agentType}
                brdgeId={urlParams.brdgeId}
                authToken={authToken || undefined}
                userId={urlParams?.userId}
              />
            ) : (() => {
              console.log("🎮 Passing to Playground:", {
                authToken: authToken ? authToken.substring(0, 20) + '...' : 'null',
                hasToken: !!authToken,
                brdgeId: urlParams.brdgeId,
                userId: urlParams?.userId,
                agentType: urlParams?.agentType
              });
              return (
                <Playground
                  themeColors={themeColors}
                  onConnect={(c) => {
                    const m = process.env.NEXT_PUBLIC_LIVEKIT_URL ? "env" : mode;
                    handleConnect(c, m);
                  }}
                  agentType={urlParams?.agentType}
                  userId={urlParams?.userId}
                  brdgeId={urlParams.brdgeId}
                  authToken={authToken}
                />
              );
            })()}
            <RoomAudioRenderer />
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