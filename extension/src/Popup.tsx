import { useState, useEffect } from 'react'
import './App.css'
import {
    isAuthenticated,
    openConnectPage,
    getStoredUser,
    getWalletBalance,
    clearAuth,
    type WalletBalance
} from './lib/vincentAuth'

function Popup() {
    const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
    const [status, setStatus] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [pkpAddress, setPkpAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<WalletBalance | null>(null);
    const [loading, setLoading] = useState(true);

    // Check authentication status
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            const isAuth = await isAuthenticated();
            setAuthenticated(isAuth);

            if (isAuth) {
                const user = await getStoredUser();
                if (user) {
                    setPkpAddress(user.pkpAddress);
                    // Fetch balance
                    try {
                        const bal = await getWalletBalance();
                        setBalance(bal);
                    } catch (error) {
                        console.error('Failed to fetch balance:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Get current tab info
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                setCurrentTab(tabs[0]);
            }
        });

        // Listen for auth completion
        const handleMessage = (message: { action: string }) => {
            if (message.action === 'vincentAuthComplete') {
                checkAuth();
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    const handleToggleInjection = async () => {
        if (!currentTab?.id) return;

        // Send message to content script
        try {
            const response = await chrome.tabs.sendMessage(currentTab.id, {
                action: 'toggle'
            });
            setStatus(`Response: ${response.status}`);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            setStatus('Error: Content script not loaded on this page');
        }
    };

    const handleConnect = async () => {
        try {
            await openConnectPage();
        } catch (error) {
            console.error('Failed to open connect page:', error);
            setStatus('Error: Failed to connect');
        }
    };

    const handleDisconnect = async () => {
        try {
            await clearAuth();
            setAuthenticated(false);
            setPkpAddress(null);
            setBalance(null);
            setStatus('Disconnected successfully');
        } catch (error) {
            console.error('Failed to disconnect:', error);
            setStatus('Error: Failed to disconnect');
        }
    };

    const handleRefreshBalance = async () => {
        try {
            const bal = await getWalletBalance();
            setBalance(bal);
            setStatus('Balance refreshed');
        } catch (error) {
            console.error('Failed to refresh balance:', error);
            setStatus('Error: Failed to refresh balance');
        }
    };

    if (loading) {
        return (
            <div className="popup-container">
                <h2>Whispers Extension</h2>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="popup-container">
            <h2>Whispers Extension</h2>

            {/* Vincent Authentication Section */}
            <div className="vincent-section">
                <h3>Vincent Wallet</h3>

                {!authenticated ? (
                    <div className="auth-section">
                        <p>Connect your Vincent wallet to start trading</p>
                        <button
                            onClick={handleConnect}
                            className="action-btn primary"
                        >
                            Connect with Vincent
                        </button>
                    </div>
                ) : (
                    <div className="wallet-section">
                        <div className="wallet-info">
                            <p><strong>Address:</strong></p>
                            <p className="wallet-address">
                                {pkpAddress
                                    ? `${pkpAddress.substring(0, 6)}...${pkpAddress.substring(38)}`
                                    : 'Unknown'}
                            </p>
                        </div>

                        {balance && (
                            <div className="balance-info">
                                <p><strong>Balances:</strong></p>
                                <div className="balance-row">
                                    <span>USDC:</span>
                                    <span>{parseFloat(balance.usdc).toFixed(2)}</span>
                                </div>
                                <div className="balance-row">
                                    <span>POL:</span>
                                    <span>{parseFloat(balance.pol).toFixed(4)}</span>
                                </div>
                                <button
                                    onClick={handleRefreshBalance}
                                    className="action-btn secondary small"
                                >
                                    Refresh
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleDisconnect}
                            className="action-btn danger"
                        >
                            Disconnect
                        </button>
                    </div>
                )}
            </div>

            {/* Original functionality */}
            <div className="popup-info">
                <p><strong>Current Page:</strong></p>
                <p className="url">{currentTab?.url || 'Loading...'}</p>
            </div>

            <button
                onClick={handleToggleInjection}
                className="action-btn primary"
            >
                Toggle Link Replacement
            </button>

            {status && (
                <div className="status-message">
                    {status}
                </div>
            )}

            <div className="popup-footer">
                <p>Extension is active on x.com</p>
            </div>
        </div>
    )
}

export default Popup
