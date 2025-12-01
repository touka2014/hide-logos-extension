# Hide Logos Extension: Privacy Guard & Distraction Blocker

> A lightweight Chrome Extension designed to enhance focus and protect user privacy by obscuring website branding and obfuscating browser tab details.

![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-green)
![Status](https://img.shields.io/badge/Status-Stable-success)

## 📖 Overview

**Hide Logos** is a comprehensive browser extension built to minimize visual distractions and preventing "shoulder surfing." Whether you are working in a public cafe or sharing your screen, this tool allows you to mask the visual identity of specific websites (like YouTube, X/Twitter, Gmail) and disguise the browser tab to look like a generic "New Tab."

It features a clean popup interface with granular controls, allowing users to toggle features independently.

## ✨ Key Features

*   **🚫 Visual Noise Reduction**: Automatically hides prominent logos and branding elements on supported platforms (YouTube, Google, X, Gmail) using non-blocking CSS injection.
*   **🕵️ Tab Obfuscation**: Masks the browser tab's favicon (using a transparent 1x1 pixel) and renames the title to "New Tab" to prevent onlookers from identifying active sites.
*   **⚡ Reactive State Management**: Changes apply in real-time without requiring a page reload (via Runtime Messaging).
*   **🔒 Privacy-First Design**: Operates entirely locally. No external data transmission.
*   **💾 Settings Persistence**: User preferences are saved via the Chrome Storage API.

## 🛠 Supported Platforms

The extension currently targets the following Single Page Applications (SPAs) and sites:

*   **YouTube** (Hides Topbar Logo)
*   **Google Search** (Hides Doodles and Main Logo)
*   **X (formerly Twitter)** (Hides Home Bird/X Logo)
*   **Gmail** (Hides Logo and prevents dynamic title updates)

## 🚀 Installation (Developer Mode)

Since this extension is not yet hosted on the Chrome Web Store, you can install it manually:

1.  **Clone or Download** this repository.
    ```bash
    git clone https://github.com/touka2014/hide-logos-extension.git
    ```
2.  Open your browser and navigate to the Extensions management page:
    *   Chrome: `chrome://extensions/`
    *   Edge: `edge://extensions/`
3.  Enable **Developer mode** (toggle switch usually located in the top right corner).
4.  Click **Load unpacked**.
5.  Select the directory where you cloned/downloaded this repository.

## 📖 Usage

1.  Click the extension icon in the browser toolbar.
2.  Use the toggle switches to configure your preference:
    *   **Hide Site Logos**: Toggles the visibility of website branding.
    *   **Mask Tab Info**: Toggles the obfuscation of the Tab Title and Favicon.
3.  The changes will apply immediately to the active tab.

> **Note:** For complex SPAs (e.g., Gmail) that aggressively update the DOM, the extension utilizes `MutationObserver` to ensure the mask remains active.

## 📂 Project Structure

```text
.
├── manifest.json       # Manifest V3 configuration
├── content.js          # Core logic (DOM manipulation, MutationObservers)
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic and State management
├── icons/              # Application icons
└── README.md           # Documentation
```

## 🔧 Technical Details

*   **Manifest V3**: Compliant with the latest Chrome Extension specification.
*   **Performance Optimization**: 
    *   Logos are hidden via `CSSStyleSheet` injection rather than JavaScript polling to minimize Main Thread blocking.
    *   `MutationObserver` is scoped strictly to `<head>` for Tab masking to prevent performance degradation on high-frequency DOM update sites like X/Twitter.
*   **Error Handling**: Implements Promise-based message passing with `chrome.runtime.lastError` checks to handle asynchronous communication gracefully.

## 🤝 Contributing

Contributions are welcome! If you find a bug or want to add support for a new website:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: Add support for Facebook'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.