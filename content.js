/* content.js - V3.0 Controllable Version */

// --- Static Assets Definition ---
const transparentIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
const maskTitle = "New Tab"; 
let originalTitle = document.title || ""; // Attempt to record the original title for restoration

// CSS Rules
const styleRules = `
    #logo, ytd-topbar-logo-renderer, 
    .lnXdpd, img[alt="Google"], .logo, a[href^="/webhp"], 
    h1[role="heading"] a, a[aria-label="X"], a[aria-label="Twitter"], 
    .gb_Kd, a.gb_ve, img.gb_Mc 
    { opacity: 0 !important; pointer-events: none !important; }
`;

// State Variables
let isLogoHidden = false;
let isTabMasked = false;
let observer = null; // Observer instance for Tab monitoring
let logoStyleElement = null; // Style tag instance for storing CSS

// ==============================================
// Function Module A: Hide Website Logo (Pure CSS Operation)
// ==============================================
function toggleLogoHiding(shouldHide) {
    if (shouldHide) {
        if (!document.getElementById('hide-logos-style')) {
            logoStyleElement = document.createElement('style');
            logoStyleElement.id = 'hide-logos-style';
            logoStyleElement.textContent = styleRules;
            document.head.appendChild(logoStyleElement);
        }
    } else {
        const existingStyle = document.getElementById('hide-logos-style');
        if (existingStyle) {
            existingStyle.remove();
        }
    }
}

// ==============================================
// Function Module B: Mask Tab (JS Logic & Listeners)
// ==============================================

// Execute masking logic once
function applyTabMask() {
    // 1. Icon processing
    const links = document.head.querySelectorAll("link[rel*='icon']");
    let hasIcon = false;
    links.forEach(link => {
        hasIcon = true;
        if (link.href !== transparentIcon) {
            // Save original icon URL, usually used for "Restore Function" (complex restoration not implemented here)
            link.href = transparentIcon;
        }
    });
    if (!hasIcon) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = transparentIcon;
        document.head.appendChild(link);
    }

    // 2. Title processing
    if (document.title !== maskTitle) {
        // If current title is not "New Tab", it means it hasn't changed yet, or was changed back by the website
        // Update originalTitle only when it looks like a real title (not "New Tab")
        // This step is hard to perfect because X/Gmail titles change constantly
        document.title = maskTitle;
    }
}

function startTabObserver() {
    if (observer) return; // Already running

    // Execute immediately once
    applyTabMask();

    // Start listening
    observer = new MutationObserver((mutations) => {
        if(isTabMasked) {
            applyTabMask(); // Force overwrite only when enabled
        }
    });
    
    // Monitor Title and Head changes
    observer.observe(document.head, { childList: true, attributes: true, subtree: true, attributeFilter: ['href', 'rel'] });
    const titleEl = document.querySelector('title');
    if(titleEl) observer.observe(titleEl, { childList: true });
}

function stopTabObserver() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    // Attempt to restore title (Optional)
    // Note: Hard to restore Favicon because we modified the href. Full restoration usually recommends users refresh the page.
    // Here we just stop interfering. If you want to manually restore the title, uncomment below:
    // if (document.title === maskTitle && originalTitle) {
    //     document.title = originalTitle; 
    // }
}

function toggleTabMasking(shouldMask) {
    isTabMasked = shouldMask;
    if (shouldMask) {
        startTabObserver();
    } else {
        stopTabObserver();
    }
}

// ==============================================
// Main Control Logic
// ==============================================

function loadSettingsAndApply() {
    chrome.storage.sync.get(['hideLogos', 'maskTab'], (result) => {
        // Default value is true
        const hideLogos = result.hideLogos !== false;
        const maskTab = result.maskTab !== false;

        toggleLogoHiding(hideLogos);
        toggleTabMasking(maskTab);
    });
}

// 1. Run on page load
loadSettingsAndApply();

// 2. Listen for messages from Popup (Real-time toggle)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_SETTINGS') {
        loadSettingsAndApply();
    }
});
