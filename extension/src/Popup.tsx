import { useState, useEffect } from 'react'
import './App.css'

function Popup() {
    const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
    const [status, setStatus] = useState('');

    useEffect(() => {
        // Get current tab info
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                setCurrentTab(tabs[0]);
            }
        });
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

    return (
        <div className="popup-container">
            <h2>Whispers Extension</h2>

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
