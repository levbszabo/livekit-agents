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
}

export interface WalkthroughSelectorRef {
    refreshWalkthroughs: () => Promise<void>;
}

export const WalkthroughSelector = forwardRef<WalkthroughSelectorRef, WalkthroughSelectorProps>(({
    brdgeId,
    apiBaseUrl,
    selectedWalkthrough,
    onWalkthroughSelect,
    onWalkthroughsLoaded
}, ref) => {
    const [walkthroughs, setWalkthroughs] = useState<any[]>([]);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const loadWalkthroughs = useCallback(async () => {
        if (!brdgeId) return;

        try {
            const response = await api.get(`/brdges/${brdgeId}/walkthrough-list`);
            if (response.data.has_walkthroughs) {
                const sortedWalkthroughs = response.data.walkthroughs.sort(
                    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                setWalkthroughs(sortedWalkthroughs);
                onWalkthroughsLoaded?.(sortedWalkthroughs);

                if (sortedWalkthroughs.length > 0) {
                    onWalkthroughSelect(sortedWalkthroughs[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading walkthroughs:', error);
        }
    }, [brdgeId, onWalkthroughsLoaded, onWalkthroughSelect]);

    useImperativeHandle(ref, () => ({
        refreshWalkthroughs: async () => {
            await loadWalkthroughs();
            setRefreshCounter(prev => prev + 1);
        }
    }));

    useEffect(() => {
        loadWalkthroughs();
    }, [loadWalkthroughs, refreshCounter]);

    return (
        <select
            key={refreshCounter}
            value={selectedWalkthrough || ''}
            onChange={(e) => onWalkthroughSelect(Number(e.target.value))}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg
                px-3 py-2 text-sm text-gray-300
                focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
        >
            <option value="">Select a walkthrough</option>
            {walkthroughs.map((walkthrough, index) => (
                <option
                    key={`${walkthrough.id}-${refreshCounter}`}
                    value={walkthrough.id}
                >
                    {`Walkthrough #${walkthroughs.length - index}`}
                </option>
            ))}
        </select>
    );
});

WalkthroughSelector.displayName = 'WalkthroughSelector'; 