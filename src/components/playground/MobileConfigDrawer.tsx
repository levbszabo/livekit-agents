import React from 'react';

interface MobileConfigDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    configTab: 'agent' | 'voice' | 'workflow';
    setConfigTab: (tab: 'agent' | 'voice' | 'workflow') => void;
    children: React.ReactNode;
}

export const MobileConfigDrawer: React.FC<MobileConfigDrawerProps> = ({
    isOpen,
    onClose,
    configTab,
    setConfigTab,
    children
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm">
            <div className={`
        fixed bottom-0 left-0 right-0 
        bg-gray-900 border-t border-gray-800
        rounded-t-2xl shadow-xl
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        max-h-[90vh]
      `}>
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                    <div className="flex space-x-2 overflow-x-auto pb-2 -mb-2">
                        {['Agent', 'Voice', 'Workflow'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setConfigTab(tab.toLowerCase() as any)}
                                className={`
                                  px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                                  whitespace-nowrap
                                  ${configTab === tab.toLowerCase()
                                        ? 'bg-cyan-500/10 text-cyan-400'
                                        : 'text-gray-400 hover:text-gray-300'
                                    }
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-300 -mr-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="p-4 overflow-y-auto" style={{
                    maxHeight: 'calc(90vh - 56px)',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
}; 