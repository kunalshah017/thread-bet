import React, { useState, useEffect } from 'react';
import '../App.css';

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

const CustomLinkCard: React.FC<CustomLinkCardProps> = ({ originalUrl, originalText, slug }) => {
    const [eventData, setEventData] = useState<PolymarketEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        fetchPolymarketData(slug);
    }, [slug]);

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
                    {outcomes.map((outcome, idx) => (
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

            {/* Action Buttons */}
            <div className="card-actions">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="action-btn"
                >
                    {isExpanded ? 'Show Less' : 'Read More'}
                </button>
                <button
                    onClick={() => window.open(originalUrl, '_blank')}
                    className="action-btn primary"
                >
                    Trade on Polymarket →
                </button>
            </div>
        </div>
    );
};

export default CustomLinkCard;
