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

// Define the ref type
export interface WalkthroughSelectorRef {
    refreshWalkthroughs: () => void;
}

export const WalkthroughSelector = forwardRef<WalkthroughSelectorRef, WalkthroughSelectorProps>(({
    brdgeId,
    apiBaseUrl,
    selectedWalkthrough,
    onWalkthroughSelect,
    onWalkthroughsLoaded
}, ref) => {
    const [walkthroughs, setWalkthroughs] = useState<any[]>([]);

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
                    const latestWalkthrough = sortedWalkthroughs[0];
                    onWalkthroughSelect(latestWalkthrough.id);
                }
            }
        } catch (error) {
            console.error('Error loading walkthroughs:', error);
        }
    }, [brdgeId, onWalkthroughsLoaded, onWalkthroughSelect]);

    // Expose the refresh function via ref
    useImperativeHandle(ref, () => ({
        refreshWalkthroughs: loadWalkthroughs
    }));

    useEffect(() => {
        loadWalkthroughs();
    }, [loadWalkthroughs]);

    return (
        <select
            value={selectedWalkthrough || ''}
            onChange={(e) => onWalkthroughSelect(Number(e.target.value))}
            className="bg-gray-800 text-gray-200 rounded-md px-3 py-2"
        >
            <option value="">Select Walkthrough</option>
            {walkthroughs.map((walkthrough, index) => (
                <option
                    key={walkthrough.id}
                    value={walkthrough.id}
                    selected={index === 0}
                >
                    {`Walkthrough ${walkthroughs.length - index}`}
                </option>
            ))}
        </select>
    );
});

WalkthroughSelector.displayName = 'WalkthroughSelector'; 