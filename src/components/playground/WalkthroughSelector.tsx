import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState, useCallback } from 'react';
import { api } from '@/api';

export interface WalkthroughSelectorProps {
    brdgeId: string | null;
    apiBaseUrl: string | null;
    selectedWalkthrough: number | null;
    onWalkthroughSelect: (walkthroughId: number) => void;
    onWalkthroughsLoaded?: (walkthroughs: any[]) => void;
    forceRefresh?: number;
    agentType?: 'edit' | 'view';
}

export interface WalkthroughSelectorRef {
    refreshWalkthroughs: () => Promise<void>;
    checkForNewWalkthrough: () => Promise<void>;
}

export const WalkthroughSelector = forwardRef<WalkthroughSelectorRef, WalkthroughSelectorProps>(
    ({ brdgeId, apiBaseUrl, selectedWalkthrough, onWalkthroughSelect, onWalkthroughsLoaded, forceRefresh, agentType = 'edit' }, ref) => {
        const [walkthroughs, setWalkthroughs] = useState<any[]>([]);
        const isMountedRef = useRef(true);
        const initialLoadDoneRef = useRef(false);

        useEffect(() => {
            isMountedRef.current = true;
            return () => {
                isMountedRef.current = false;
            };
        }, []);

        const loadWalkthroughs = useCallback(async () => {
            if (!brdgeId || !isMountedRef.current) return;

            try {
                const response = await api.get(`/brdges/${brdgeId}/walkthrough-list`);

                if (!isMountedRef.current) return;

                if (response.data.has_walkthroughs) {
                    const sortedWalkthroughs = response.data.walkthroughs.sort(
                        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    setWalkthroughs(sortedWalkthroughs);
                    onWalkthroughsLoaded?.(sortedWalkthroughs);

                    if (!initialLoadDoneRef.current && sortedWalkthroughs.length > 0) {
                        onWalkthroughSelect(sortedWalkthroughs[0].id);
                        initialLoadDoneRef.current = true;
                    }
                }
            } catch (error) {
                console.error('Error loading walkthroughs:', error);
            }
        }, [brdgeId, onWalkthroughsLoaded, onWalkthroughSelect]);

        // Function to check for new walkthrough after recording stops
        const checkForNewWalkthrough = useCallback(async () => {
            if (!brdgeId) return;

            const maxAttempts = 5;
            const delayBetweenAttempts = 2000;
            const currentCount = walkthroughs.length;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const response = await api.get(`/brdges/${brdgeId}/walkthrough-list`);

                    if (response.data.has_walkthroughs) {
                        const sortedWalkthroughs = response.data.walkthroughs.sort(
                            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        );

                        if (sortedWalkthroughs.length > currentCount) {
                            setWalkthroughs(sortedWalkthroughs);
                            onWalkthroughsLoaded?.(sortedWalkthroughs);
                            onWalkthroughSelect(sortedWalkthroughs[0].id);
                            break;
                        }
                    }

                    if (attempt < maxAttempts - 1) {
                        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
                    }
                } catch (error) {
                    console.error('Error checking for new walkthrough:', error);
                }
            }
        }, [brdgeId, walkthroughs.length, onWalkthroughsLoaded, onWalkthroughSelect]);

        useImperativeHandle(ref, () => ({
            refreshWalkthroughs: loadWalkthroughs,
            checkForNewWalkthrough
        }));

        // Only load walkthroughs on initial mount
        useEffect(() => {
            loadWalkthroughs();
        }, [loadWalkthroughs]);

        const startWalkthrough = useCallback(async () => {
            // ... any walkthrough start logic ...
            // Make sure it uses 'edit' mode
        }, []);

        return (
            <select
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg
                    px-3 py-2 text-sm text-gray-300
                    focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500
                    transition-colors duration-150
                    hover:border-cyan-500/50"
                value={selectedWalkthrough || ''}
                onChange={(e) => onWalkthroughSelect(Number(e.target.value))}
            >
                <option value="">Select a walkthrough</option>
                {walkthroughs.map((w, index) => (
                    <option
                        key={w.id}
                        value={w.id}
                    >
                        Walkthrough #{walkthroughs.length - index}
                    </option>
                ))}
            </select>
        );
    }
);

WalkthroughSelector.displayName = 'WalkthroughSelector'; 