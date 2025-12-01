/**
 * popup.js
 * Handles user interactions and state management.
 * 
 * update: Switched message passing to Promise-based syntax to 
 * properly handle "Uncaught (in promise)" errors in Manifest V3.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const logoSwitch = document.getElementById('toggleSwitchLogo');
    const tabSwitch = document.getElementById('toggleSwitchTab');

    // 1. Initialization: Load saved settings from Chrome Storage.
    // Checks if the value is strictly not false (defaulting to true for first-time use).
    chrome.storage.sync.get(['hideLogos', 'maskTab'], (result) => {
        logoSwitch.checked = result.hideLogos !== false;
        tabSwitch.checked = result.maskTab !== false;
    });

    // 2. Event Listener: Hide Logos Toggle
    logoSwitch.addEventListener('change', () => {
        const isChecked = logoSwitch.checked;
        chrome.storage.sync.set({ hideLogos: isChecked });
        notifyContentScript({ type: 'UPDATE_SETTINGS' });
    });

    // 3. Event Listener: Mask Tab Toggle
    tabSwitch.addEventListener('change', () => {
        const isChecked = tabSwitch.checked;
        chrome.storage.sync.set({ maskTab: isChecked });
        notifyContentScript({ type: 'UPDATE_SETTINGS' });
    });
});

/**
 * Sends a message to the active tab's content script.
 * Uses Promise chaining to catch connection errors gracefully.
 * 
 * @param {Object} message - The data payload to send.
 */
function notifyContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        // Validation: Ensure a tab exists
        if (tabs.length === 0) return;

        const currentTab = tabs[0];

        // Validation: Skip chrome://, edge://, or empty pages where content scripts don't run.
        if (!currentTab.url || !currentTab.url.startsWith('http')) {
            return; 
        }

        try {
            // Attempt to send message via Promise.
            // If the content script is not ready (e.g., page reloading, or extension just updated),
            // this will throw an error.
            await chrome.tabs.sendMessage(currentTab.id, message);
        } catch (error) {
            // SILENT FAIL:
            // The error "Could not establish connection. Receiving end does not exist" happens
            // when the content script hasn't loaded yet on the target tab.
            // We catch it here to prevent the "Uncaught (in promise)" error in the console.
            // No action needed.
        }
    });
}