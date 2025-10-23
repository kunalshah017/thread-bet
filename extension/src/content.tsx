// IMPORTANT: Load polyfills first before any other imports
import './polyfills';

import ReactDOM from 'react-dom/client';
import './content.css';
import CustomLinkCard from '@/components/CustomLinkCard';

// Inject inpage script to access window.ethereum
function injectInpageScript() {
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/inpage.js');
        script.type = 'text/javascript';
        script.onload = () => {
            console.log('[Content] ✓ Inpage script injected');
            script.remove(); // Clean up after loading
        };
        (document.head || document.documentElement).appendChild(script);
    } catch (error) {
        console.error('[Content] Failed to inject inpage script:', error);
    }
}

// Inject the inpage script as early as possible
injectInpageScript();

// Track processed links to avoid duplicates
const processedLinks = new WeakSet<HTMLAnchorElement>();
let linksReplacedCount = 0;

// Function to extract slug from Polymarket URL
function extractPolymarketSlug(linkText: string): string | null {
    try {
        // Extract slug from text like "polymarket.com/event/will-wld-hit-1pt3-by-december-31?tid=..."
        // or full URL
        const match = linkText.match(/polymarket\.com\/event\/([^?#\s]+)/i);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    } catch {
        return null;
    }
}

// Function to check if a link matches your criteria
function isTargetLink(linkElement: HTMLAnchorElement): boolean {
    try {
        const linkText = (linkElement.textContent || '').toLowerCase();
        const href = linkElement.href.toLowerCase();

        // Match if link text or href contains polymarket.com
        return linkText.includes('polymarket.com') || href.includes('polymarket.com');
    } catch {
        return false;
    }
}

// Function to replace a link with custom React component
function replaceLinkWithCustomUI(linkElement: HTMLAnchorElement) {
    if (processedLinks.has(linkElement)) {
        return; // Already processed
    }

    const url = linkElement.href;
    const displayUrl = linkElement.textContent || url;

    // Extract slug from the link text
    const slug = extractPolymarketSlug(displayUrl);

    if (!slug) {
        console.log('[X.com Extension] ⚠️ Could not extract slug from:', displayUrl);
        return;
    }

    // Mark as processed
    processedLinks.add(linkElement);
    linksReplacedCount++;

    // Create container for React component
    const container = document.createElement('div');
    container.className = 'whispers-custom-link-container';

    // Replace the original link with container
    linkElement.parentElement?.replaceChild(container, linkElement);

    // Mount React component with slug
    const root = ReactDOM.createRoot(container);
    root.render(
        <CustomLinkCard
            originalUrl={url}
            originalText={displayUrl}
            slug={slug}
        />
    );

    console.log('[X.com Extension] ✓ Replaced Polymarket link:', displayUrl, '→', url, 'slug:', slug);
}

// Function to scan and replace links in a given element
function processLinks(element: HTMLElement) {
    // Find all links within the element
    const links = element.querySelectorAll('a[href]');

    console.log('[X.com Extension] Scanning element, found', links.length, 'links');

    let matchedCount = 0;
    links.forEach((link) => {
        const anchor = link as HTMLAnchorElement;

        if (isTargetLink(anchor) && !processedLinks.has(anchor)) {
            const linkText = anchor.textContent || '';
            console.log('[X.com Extension] ✓ Matched Polymarket link:', linkText, '→', anchor.href);
            matchedCount++;
            replaceLinkWithCustomUI(anchor);
        }
    });

    if (matchedCount === 0 && links.length > 0) {
        console.log('[X.com Extension] No Polymarket links found in', links.length, 'total links');
    } else if (matchedCount > 0) {
        console.log('[X.com Extension] Replaced', matchedCount, 'Polymarket link(s)');
    }
}

// Initial scan
function initialScan() {
    console.log('[X.com Extension] Initial scan started');

    const mainTimeline = document.querySelector('[data-testid="primaryColumn"]');

    if (mainTimeline) {
        console.log('[X.com Extension] Found main timeline');
        processLinks(mainTimeline as HTMLElement);
    } else {
        console.log('[X.com Extension] Timeline not found, scanning entire body');
        processLinks(document.body);
    }
}

// Delayed scans for late-loading content
function delayedScan() {
    console.log('[X.com Extension] Scheduling delayed scans...');

    setTimeout(() => {
        console.log('[X.com Extension] Running 2-second delayed scan');
        initialScan();
    }, 2000);

    setTimeout(() => {
        console.log('[X.com Extension] Running 5-second delayed scan');
        initialScan();
    }, 5000);
}

// Set up MutationObserver to detect new tweets during scrolling
function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Process newly added nodes
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;

                    // Check if this is a tweet or contains tweets
                    if (
                        element.matches('[data-testid="tweet"]') ||
                        element.querySelector('[data-testid="tweet"]') ||
                        element.matches('[data-testid="cellInnerDiv"]') ||
                        element.querySelector('[data-testid="cellInnerDiv"]')
                    ) {
                        console.log('[X.com Extension] New tweet detected, processing...');
                        processLinks(element);
                    }
                }
            });
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    console.log('[X.com Extension] MutationObserver active - watching for new content');
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initialScan();
        delayedScan();
        setupMutationObserver();
    });
} else {
    initialScan();
    delayedScan();
    setupMutationObserver();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
    (
        message: { action: string },
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: { status: string; linksReplaced: number }) => void
    ) => {
        console.log('[Content Script] Received message:', message);

        if (message.action === 'toggle') {
            sendResponse({
                status: 'active',
                linksReplaced: linksReplacedCount
            });
        }

        return true;
    }
);
