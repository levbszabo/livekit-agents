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
                    <div className="w-full h-full relative flex items-center justify-center">
                        <video
                            ref={videoRef}
                            className="w-full h-full max-h-full"
                            style={{
                                objectFit: 'contain',
                                objectPosition: 'center'
                            }}
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