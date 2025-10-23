import React, { useState, useEffect } from 'react';
import '../App.css';
import {
    hasVincentConnection,
    getStoredVincentAuth,
    type StoredVincentAuth,
} from '../lib/vincentClient';

// Extend Window interface for ethereum provider
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            selectedAddress?: string;
            isMetaMask?: boolean;
        };
    }
}
import {
    checkUSDCBalance,
    checkUSDCAllowance,
    buildApprovalTransaction,
    buildPolymarketOrder,
    submitOrder,
    calculateExpectedShares,
    calculatePotentialProfit,
} from '../lib/polymarketTrading';

interface CustomLinkCardProps {
    originalUrl: string;
    originalText: string;
    slug: string;
}

interface PolymarketEvent {
    id: string;
    title: string;
    description: string;
    image: string;
    icon: string;
    volume: number;
    liquidity: number;
    endDate: string;
    markets: Array<{
        question: string;
        outcomes: string;
        outcomePrices: string;
    }>;
    tags: Array<{
        label: string;
    }>;
}

const CustomLinkCard: React.FC<CustomLinkCardProps> = ({ originalUrl, slug }) => {
    const [eventData, setEventData] = useState<PolymarketEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // Vincent/Trading states
    const [isConnected, setIsConnected] = useState(false);
    const [vincentAuth, setVincentAuth] = useState<StoredVincentAuth | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<string>('0');
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
    const [tradeAmount, setTradeAmount] = useState<string>('10');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');

    useEffect(() => {
        fetchPolymarketData(slug);
        checkVincentConnection();
    }, [slug]);

    // Check if user has Vincent connection
    const checkVincentConnection = async () => {
        const connected = await hasVincentConnection();
        setIsConnected(connected);

        if (connected) {
            const auth = await getStoredVincentAuth();
            setVincentAuth(auth);

            // Fetch USDC balance if connected
            if (auth && auth.pkpEthAddress) {
                const balance = await checkUSDCBalance(auth.pkpEthAddress);
                setUsdcBalance(balance);
            }
        }
    };

    // Handle Connect Vincent Wallet button
    const handleConnectVincent = async () => {
        try {
            console.log('[CustomLinkCard] Connecting to MetaMask via inpage script...');

            // Set up listener for response from inpage script
            const responsePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout. Please try again.'));
                }, 30000); // 30 second timeout

                const handleResponse = (event: Event) => {
                    clearTimeout(timeout);
                    const customEvent = event as CustomEvent;
                    window.removeEventListener('WHISPERS_WALLET_RESPONSE', handleResponse);

                    if (customEvent.detail.success) {
                        resolve(customEvent.detail);
                    } else {
                        reject(new Error(customEvent.detail.error));
                    }
                };

                window.addEventListener('WHISPERS_WALLET_RESPONSE', handleResponse);
            });

            // Trigger wallet connection in inpage script
            window.dispatchEvent(new CustomEvent('WHISPERS_CONNECT_WALLET'));

            // Wait for response
            const result: any = await responsePromise;

            console.log('[CustomLinkCard] ✓ Wallet connected:', result.address);

            // Send to background to store auth
            chrome.runtime.sendMessage(
                {
                    action: 'storeVincentAuth',
                    auth: {
                        pkpEthAddress: result.address,
                        pkpPublicKey: `0x04${result.signature.slice(2, 130)}`,
                        pkpTokenId: `metamask_${result.timestamp}`,
                        authMethodType: 'ethereum',
                        signature: result.signature,
                    }
                },
                (response) => {
                    if (response.success) {
                        console.log('[CustomLinkCard] ✓ Vincent wallet connected!');
                        checkVincentConnection();
                    } else {
                        console.error('[CustomLinkCard] Failed to store auth:', response.error);
                        alert(`Failed to connect: ${response.error}`);
                    }
                }
            );

        } catch (error) {
            console.error('[CustomLinkCard] Connection error:', error);
            if (error instanceof Error) {
                alert(error.message);
            } else {
                alert('Failed to connect wallet. Please try again.');
            }
        }
    };

    // Handle Trade button click
    const handleTradeClick = (outcome: string) => {
        setSelectedOutcome(outcome);
        setShowTradeModal(true);
    };

    // Handle trade submission
    const handleSubmitTrade = async () => {
        if (!selectedOutcome || !vincentAuth) return;

        const amount = parseFloat(tradeAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Check balance
        const balance = parseFloat(usdcBalance);
        if (balance < amount) {
            alert(`Insufficient USDC balance. You have $${balance.toFixed(2)} USDC.`);
            return;
        }

        // Get the outcome data
        const outcomes = eventData?.markets[0] ? parseOutcomes(
            eventData.markets[0].outcomes,
            eventData.markets[0].outcomePrices
        ) : [];

        const outcome = outcomes.find((o: { name: string; price: number }) => o.name === selectedOutcome);
        if (!outcome) {
            alert('Invalid outcome selected');
            return;
        }

        // Calculate expected shares and profit
        const shares = calculateExpectedShares(amount, outcome.price);
        const profit = calculatePotentialProfit(shares, outcome.price);

        const confirmed = confirm(
            `Place trade:\n` +
            `${selectedOutcome} @ ${outcome.price.toFixed(1)}%\n` +
            `Cost: $${amount} USDC\n` +
            `Expected shares: ${shares.toFixed(2)}\n` +
            `Potential profit: $${profit.toFixed(2)}\n\n` +
            `Proceed?`
        );

        if (!confirmed) return;

        setIsProcessing(true);

        try {
            const userAddress = vincentAuth.pkpEthAddress;

            // Step 1: Check USDC allowance
            setProcessingStep('Checking USDC allowance...');
            console.log('[Trade] Checking USDC allowance for:', userAddress);

            const allowance = await checkUSDCAllowance(userAddress);
            const allowanceNum = parseFloat(allowance);

            console.log('[Trade] Current allowance:', allowanceNum, 'Need:', amount);

            // Step 2: Approve USDC if needed
            if (allowanceNum < amount) {
                setProcessingStep('Approving USDC...');
                console.log('[Trade] Requesting USDC approval...');

                // Build approval transaction
                const approvalTx = buildApprovalTransaction((amount * 2).toString()); // Approve 2x for future trades

                // Send approval transaction via inpage script
                const approvalPromise = new Promise<string>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Approval timeout'));
                    }, 120000); // 2 minute timeout

                    const handleTxResponse = (event: Event) => {
                        clearTimeout(timeout);
                        window.removeEventListener('WHISPERS_TRANSACTION_RESPONSE', handleTxResponse);
                        const customEvent = event as CustomEvent;

                        if (customEvent.detail.success) {
                            resolve(customEvent.detail.txHash);
                        } else {
                            reject(new Error(customEvent.detail.error || 'Approval failed'));
                        }
                    };

                    window.addEventListener('WHISPERS_TRANSACTION_RESPONSE', handleTxResponse);
                });

                // Dispatch approval request
                window.dispatchEvent(
                    new CustomEvent('WHISPERS_SEND_TRANSACTION', {
                        detail: {
                            transaction: {
                                from: userAddress,
                                to: approvalTx.to,
                                data: approvalTx.data,
                                value: approvalTx.value,
                            },
                        },
                    })
                );

                const approvalTxHash = await approvalPromise;
                console.log('[Trade] ✓ USDC approved, tx:', approvalTxHash);

                // Wait a bit for tx to confirm
                setProcessingStep('Waiting for approval confirmation...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.log('[Trade] ✓ USDC already approved');
            }

            // Step 3: Build the order
            setProcessingStep('Building order...');
            console.log('[Trade] Building Polymarket order...');

            // Get token ID from event data (first market, first outcome for now)
            // In production, you'd extract the correct token ID based on the selected outcome
            // For this MVP, we'll use a placeholder token ID
            // TODO: Extract actual token ID from Polymarket API based on market/outcome

            const orderData = await buildPolymarketOrder({
                tokenId: "21742633143463906290569050155826241533067272736897614950488156847949938836455", // Example token ID - replace with actual
                side: "BUY",
                price: outcome.price / 100, // Convert percentage to 0-1
                size: amount,
                userAddress: userAddress,
            });

            console.log('[Trade] Order built:', orderData);

            // Step 4: Sign the order with EIP-712
            setProcessingStep('Requesting signature...');
            console.log('[Trade] Requesting EIP-712 signature...');

            const signaturePromise = new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Signature timeout'));
                }, 120000); // 2 minute timeout

                const handleSignResponse = (event: Event) => {
                    clearTimeout(timeout);
                    window.removeEventListener('WHISPERS_TYPED_DATA_RESPONSE', handleSignResponse);
                    const customEvent = event as CustomEvent;

                    if (customEvent.detail.success) {
                        resolve(customEvent.detail.signature);
                    } else {
                        reject(new Error(customEvent.detail.error || 'Signature failed'));
                    }
                };

                window.addEventListener('WHISPERS_TYPED_DATA_RESPONSE', handleSignResponse);
            });

            // Dispatch signing request
            window.dispatchEvent(
                new CustomEvent('WHISPERS_SIGN_TYPED_DATA', {
                    detail: {
                        domain: orderData.domain,
                        types: orderData.types,
                        message: orderData.order,
                    },
                })
            );

            const signature = await signaturePromise;
            console.log('[Trade] ✓ Order signed');

            // Step 5: Submit order to Polymarket CLOB
            setProcessingStep('Submitting order to Polymarket...');
            console.log('[Trade] Submitting to CLOB API...');

            const result = await submitOrder({
                order: orderData.order,
                signature: signature,
                orderType: 'GTC',
                ownerAddress: userAddress,
            });

            if (result.success) {
                console.log('[Trade] ✓ Order placed! ID:', result.orderID);
                alert(
                    `✅ Trade placed successfully!\n\n` +
                    `Order ID: ${result.orderID}\n` +
                    `View on Polymarket.com`
                );

                setShowTradeModal(false);
                setIsProcessing(false);
                setProcessingStep('');

                // Refresh balance
                const newBalance = await checkUSDCBalance(userAddress);
                setUsdcBalance(newBalance);
            } else {
                throw new Error(result.error || 'Order submission failed');
            }

        } catch (error) {
            console.error('[Trade] Error:', error);
            alert(`❌ Trade failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const fetchPolymarketData = async (eventSlug: string) => {
        try {
            setLoading(true);
            setError(null);

            console.log('[CustomLinkCard] Requesting Polymarket data for:', eventSlug);

            // Send message to background script to fetch data
            chrome.runtime.sendMessage(
                {
                    action: 'fetchPolymarketData',
                    slug: eventSlug
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[CustomLinkCard] Runtime error:', chrome.runtime.lastError);
                        setError('Extension communication error');
                        setLoading(false);
                        return;
                    }

                    if (response.success) {
                        console.log('[CustomLinkCard] Data received:', response.data);
                        setEventData(response.data);
                    } else {
                        console.error('[CustomLinkCard] Fetch failed:', response.error);
                        setError(response.error);
                    }

                    setLoading(false);
                }
            );
        } catch (err) {
            console.error('[CustomLinkCard] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load event data');
            setLoading(false);
        }
    };

    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(2)}K`;
        return `$${volume.toFixed(2)}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const parseOutcomes = (outcomesStr: string, pricesStr: string) => {
        try {
            const outcomes = JSON.parse(outcomesStr);
            const prices = JSON.parse(pricesStr);
            return outcomes.map((outcome: string, idx: number) => ({
                name: outcome,
                price: parseFloat(prices[idx]) * 100
            }));
        } catch {
            return [];
        }
    };

    if (loading) {
        return (
            <div className="custom-link-card polymarket-card">
                <div className="card-header">
                    <span className="badge polymarket-badge">
                        <img
                            src="https://polymarket.com/favicon.ico"
                            alt="Polymarket"
                            className="badge-icon"
                        />
                        Polymarket
                    </span>
                </div>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading prediction market...</p>
                </div>
            </div>
        );
    }

    if (error || !eventData) {
        return (
            <div className="custom-link-card polymarket-card error-state">
                <div className="card-header">
                    <span className="badge polymarket-badge">
                        <img
                            src="https://polymarket.com/favicon.ico"
                            alt="Polymarket"
                            className="badge-icon"
                        />
                        Polymarket
                    </span>
                </div>
                <div className="error-content">
                    <p>⚠️ Could not load event data</p>
                    <p className="error-detail">{error}</p>
                    <a
                        href={originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fallback-link"
                    >
                        View on Polymarket →
                    </a>
                </div>
            </div>
        );
    }

    const market = eventData.markets[0];
    const outcomes = market ? parseOutcomes(market.outcomes, market.outcomePrices) : [];

    return (
        <div className="custom-link-card polymarket-card">
            {/* Header */}
            <div className="card-header">
                <span className="badge polymarket-badge">
                    <img
                        src="https://polymarket.com/favicon.ico"
                        alt="Polymarket"
                        className="badge-icon"
                    />
                    Polymarket
                </span>
                <div className="market-stats">
                    <span className="stat-item">
                        📊 Vol: {formatVolume(eventData.volume)}
                    </span>
                </div>
            </div>

            {/* Event Image */}
            {eventData.image && (
                <div className="event-image-container">
                    <img
                        src={eventData.image}
                        alt={eventData.title}
                        className="event-image"
                    />
                </div>
            )}

            {/* Title */}
            <h3 className="event-title">{eventData.title}</h3>

            {/* Outcomes/Odds */}
            {outcomes.length > 0 && (
                <div className="outcomes-container">
                    {outcomes.map((outcome: { name: string; price: number }, idx: number) => (
                        <div key={idx} className="outcome-item">
                            <span className="outcome-name">{outcome.name}</span>
                            <span className="outcome-price">{outcome.price.toFixed(1)}%</span>
                            <div className="outcome-bar">
                                <div
                                    className="outcome-bar-fill"
                                    style={{ width: `${outcome.price}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tags */}
            {eventData.tags && eventData.tags.length > 0 && (
                <div className="tags-container">
                    {eventData.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="tag">{tag.label}</span>
                    ))}
                </div>
            )}

            {/* Metadata */}
            <div className="metadata-row">
                <span className="metadata-item">
                    💰 Liquidity: {formatVolume(eventData.liquidity)}
                </span>
                <span className="metadata-item">
                    📅 Ends: {formatDate(eventData.endDate)}
                </span>
            </div>

            {/* Expanded Description */}
            {isExpanded && (
                <div className="expanded-content">
                    <p className="event-description">{eventData.description}</p>
                </div>
            )}

            {/* Vincent Wallet Status */}
            {isConnected && vincentAuth && (
                <div className="vincent-status">
                    <div className="wallet-info">
                        <span className="wallet-label">🔐 Vincent Wallet:</span>
                        <span className="wallet-address">
                            {vincentAuth.pkpEthAddress.slice(0, 6)}...{vincentAuth.pkpEthAddress.slice(-4)}
                        </span>
                        <span className="wallet-balance">
                            💰 {parseFloat(usdcBalance).toFixed(2)} USDC
                        </span>
                    </div>
                </div>
            )}

            {/* Trade Modal */}
            {showTradeModal && selectedOutcome && (
                <div className="trade-modal">
                    <div className="modal-content">
                        {isProcessing ? (
                            <>
                                <h4>Processing Trade...</h4>
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>{processingStep}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <h4>Place Trade</h4>
                                <div className="trade-details">
                                    <p><strong>Market:</strong> {selectedOutcome}</p>
                                    <p><strong>Price:</strong> {outcomes.find((o: { name: string; price: number }) => o.name === selectedOutcome)?.price.toFixed(1)}%</p>
                                </div>
                                <div className="trade-input">
                                    <label>Amount (USDC):</label>
                                    <input
                                        type="number"
                                        value={tradeAmount}
                                        onChange={(e) => setTradeAmount(e.target.value)}
                                        min="1"
                                        step="1"
                                        placeholder="Enter USDC amount"
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button
                                        onClick={() => setShowTradeModal(false)}
                                        className="action-btn"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitTrade}
                                        className="action-btn primary"
                                    >
                                        Confirm Trade
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="card-actions">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="action-btn"
                >
                    {isExpanded ? 'Show Less' : 'Read More'}
                </button>

                {!isConnected ? (
                    <button
                        onClick={handleConnectVincent}
                        className="action-btn primary vincent-btn"
                    >
                        🔐 Connect Vincent Wallet
                    </button>
                ) : (
                    <div className="trade-buttons">
                        {outcomes.map((outcome: { name: string; price: number }, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => handleTradeClick(outcome.name)}
                                className="action-btn trade-btn"
                            >
                                Trade {outcome.name} @ {outcome.price.toFixed(1)}%
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => window.open(originalUrl, '_blank')}
                    className="action-btn"
                >
                    View on Polymarket →
                </button>
            </div>
        </div>
    );
};

export default CustomLinkCard;
