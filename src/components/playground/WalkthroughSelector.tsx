import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronIcon } from './icons';
import { api } from '@/api';

interface Walkthrough {
    id: number;
    label: string;
    timestamp: string;
    slide_count: number;
}

interface WalkthroughSelectorProps {
    brdgeId: string | null;
    apiBaseUrl: string | null;
    selectedWalkthrough: number | null;
    onWalkthroughSelect: (walkthroughId: number) => void;
    onWalkthroughsLoaded?: (walkthroughs: any[]) => void;
    forceRefresh?: number;
}

export interface WalkthroughSelectorRef {
    refreshWalkthroughs: () => Promise<void>;
}

export const WalkthroughSelector = forwardRef<WalkthroughSelectorRef, WalkthroughSelectorProps>(({
    brdgeId,
    apiBaseUrl,
    selectedWalkthrough,
    onWalkthroughSelect,
    onWalkthroughsLoaded,
    forceRefresh = 0
}, ref) => {
    const [walkthroughs, setWalkthroughs] = useState<any[]>([]);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
    const [consecutiveErrors, setConsecutiveErrors] = useState(0);

    const loadWalkthroughs = useCallback(async (force = false) => {
        // Don't refresh if we've refreshed recently (within 500ms) unless forced
        if (!force && Date.now() - lastRefreshTime < 500) {
            console.log("Skipping refresh - too soon");
            return;
        }

        if (!brdgeId || (isLoading && !force)) return;

        try {
            console.log("Loading walkthroughs...");
            setIsLoading(true);
            const response = await api.get(`/brdges/${params.brdgeId}/walkthrough-list`);

            if (response.data.has_walkthroughs) {
                const sortedWalkthroughs = response.data.walkthroughs.sort(
                    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                console.log("New walkthroughs loaded:", sortedWalkthroughs.length);
                setWalkthroughs(sortedWalkthroughs);
                onWalkthroughsLoaded?.(sortedWalkthroughs);

                // Only auto-select if no walkthrough is currently selected
                if (!selectedWalkthrough && sortedWalkthroughs.length > 0) {
                    console.log("Auto-selecting latest walkthrough");
                    onWalkthroughSelect(sortedWalkthroughs[0].id);
                }

                setConsecutiveErrors(0);
            }
        } catch (error) {
            console.error('Error loading walkthroughs:', error);
            setConsecutiveErrors(prev => prev + 1);
        } finally {
            setIsLoading(false);
            setLastRefreshTime(Date.now());
        }
    }, [brdgeId, onWalkthroughsLoaded, onWalkthroughSelect, selectedWalkthrough, isLoading, lastRefreshTime]);

    // Expose refresh method to parent
    useImperativeHandle(ref, () => ({
        refreshWalkthroughs: async () => {
            console.log("Manual refresh triggered");
            setRefreshCounter(prev => prev + 1);
            await loadWalkthroughs(true); // Force refresh
        }
    }));

    // Load walkthroughs on mount and when dependencies change
    useEffect(() => {
        console.log("Dependency-triggered refresh");
        loadWalkthroughs();
    }, [loadWalkthroughs, refreshCounter, forceRefresh]);

    // Add polling for updates with dynamic interval
    useEffect(() => {
        // Adjust polling interval based on error count
        const pollInterval = Math.min(1000 + (consecutiveErrors * 1000), 5000);

        const pollTimer = setInterval(() => {
            if (!isLoading) {
                console.log("Poll-triggered refresh");
                loadWalkthroughs();
            }
        }, pollInterval);

        return () => clearInterval(pollTimer);
    }, [loadWalkthroughs, isLoading, consecutiveErrors]);

    return (
        <select
            key={`${refreshCounter}-${forceRefresh}-${walkthroughs.length}`}
            value={selectedWalkthrough || ''}
            onChange={(e) => onWalkthroughSelect(Number(e.target.value))}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg
                px-3 py-2 text-sm text-gray-300
                focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500
                disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
        >
            <option value="">Select a walkthrough</option>
            {walkthroughs.map((walkthrough, index) => (
                <option
                    key={`${walkthrough.id}-${refreshCounter}-${forceRefresh}`}
                    value={walkthrough.id}
                >
                    {`Walkthrough #${walkthroughs.length - index}`}
                </option>
            ))}
        </select>
    );
});

WalkthroughSelector.displayName = 'WalkthroughSelector'; 