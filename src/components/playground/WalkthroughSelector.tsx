import { useEffect, useState } from 'react';
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
    onWalkthroughSelect: (walkthroughId: number) => void;
    selectedWalkthrough: number | null;
}

export const WalkthroughSelector = ({
    brdgeId,
    apiBaseUrl,
    onWalkthroughSelect,
    selectedWalkthrough,
}: WalkthroughSelectorProps) => {
    const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWalkthroughs = async () => {
            if (!brdgeId) {
                console.log('Missing brdgeId');
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const response = await api.get(`/api/brdges/${brdgeId}/walkthrough-list`);
                const data = response.data;

                if (data.has_walkthroughs) {
                    console.log('Fetched walkthroughs:', data.walkthroughs);
                    setWalkthroughs(data.walkthroughs);
                } else {
                    console.log('No walkthroughs found');
                    setWalkthroughs([]);
                }
            } catch (error) {
                console.error('Error fetching walkthroughs:', error);
                setError(error instanceof Error ? error.message : 'Failed to fetch walkthroughs');
                setWalkthroughs([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWalkthroughs();
    }, [brdgeId]);

    if (isLoading) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-2 text-gray-400 bg-gray-800 rounded-md">
                <span className="text-sm">Loading walkthroughs...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-2 text-red-400 bg-gray-800 rounded-md">
                <span className="text-sm">Error loading walkthroughs</span>
            </div>
        );
    }

    if (walkthroughs.length === 0) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-2 text-gray-400 bg-gray-800 rounded-md">
                <span className="text-sm">No walkthroughs available</span>
            </div>
        );
    }

    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger className="group inline-flex items-center gap-1 rounded-md bg-gray-800 px-3 py-2 text-gray-300 hover:bg-gray-700 transition-colors">
                <span className="text-sm">
                    {isLoading ? "Loading..." :
                        selectedWalkthrough
                            ? `Walkthrough ${selectedWalkthrough}`
                            : "Select Walkthrough"}
                </span>
                <ChevronIcon />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-50 min-w-[200px] overflow-hidden rounded-md border border-gray-700 bg-gray-800 shadow-lg"
                    sideOffset={5}
                >
                    {walkthroughs.map((walkthrough) => (
                        <DropdownMenu.Item
                            key={walkthrough.id}
                            className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer
                                ${selectedWalkthrough === walkthrough.id
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-gray-300 hover:bg-gray-700'
                                }`}
                            onClick={() => onWalkthroughSelect(walkthrough.id)}
                        >
                            <span>{walkthrough.label}</span>
                            <span className="text-xs text-gray-500">
                                {new Date(walkthrough.timestamp).toLocaleDateString()}
                            </span>
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}; 