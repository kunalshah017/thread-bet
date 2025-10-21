import React, { useState, useEffect } from 'react';
import '../App.css';

interface CustomLinkCardProps {
    originalUrl: string;
    originalText: string;
}

const CustomLinkCard: React.FC<CustomLinkCardProps> = ({ originalUrl, originalText }) => {
    const [metadata, setMetadata] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Fetch link metadata or other data
        // You can call your backend API here
        fetchMetadata(originalUrl);
    }, [originalUrl]);

    const fetchMetadata = async (url: string) => {
        // Example: fetch preview data
        // Replace with your actual API call
        console.log(url);
        setMetadata({
            title: 'Custom Preview',
            description: 'This is your custom UI replacing the link',
            image: 'https://via.placeholder.com/400x200'
        });
    };

    return (
        <div className="custom-link-card">
            <div className="card-header">
                <span className="badge">Replaced Link</span>
                <a
                    href={originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="original-url"
                >
                    {new URL(originalUrl).hostname}
                </a>
            </div>

            {metadata && (
                <div className="card-content">
                    {/* <img
                        src={metadata.image}
                        alt={metadata.title}
                        className="preview-image"
                    /> */}
                    <h3>{metadata.title}</h3>
                    <p>{metadata.description}</p>

                    <div className="card-actions">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="action-btn"
                        >
                            {isExpanded ? 'Show Less' : 'Show More'}
                        </button>
                        <button
                            onClick={() => window.open(originalUrl, '_blank')}
                            className="action-btn primary"
                        >
                            Open Link
                        </button>
                    </div>

                    {isExpanded && (
                        <div className="expanded-content">
                            <p>Additional custom content here...</p>
                            <p>Original text: {originalText}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomLinkCard;
