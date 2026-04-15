# Hide Logos Extension: Per-Site Privacy & Distraction Control

> A lightweight Chrome Extension that gives users full control over hiding website logos and tab favicons on a per-site basis.

![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)
![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-green)
![Status](https://img.shields.io/badge/Status-Stable-success)

## 📖 Overview

**Hide Logos** is a browser extension that lets you selectively hide website logos and browser tab favicons on any site you visit. Nothing is hidden by default — you decide which sites to clean up, either individually or via global defaults.

Whether you're working in a public space, sharing your screen, or simply want a cleaner browsing experience, this extension provides granular, per-site control through a clean popup interface.

## ✨ Key Features

*   **🎯 Per-Site Control**: Independently toggle logo hiding and tab icon hiding for each website you visit.
*   **🌐 Global Defaults**: Set baseline preferences that apply to all sites without custom overrides.
*   **🔕 Off by Default**: No sites are affected until you explicitly enable hiding — zero surprises.
*   **🚫 Generic Logo Detection**: Works on any website using common logo selector patterns, not just predefined sites.
*   **⚡ Real-Time Updates**: Changes apply instantly without requiring a page reload.
*   **🔒 Privacy-First Design**: Operates entirely locally. No external data transmission.
*   **💾 Persistent Settings**: User preferences are synced via the Chrome Storage API.

## 🛠 Supported Platforms

The extension includes **optimized CSS rules** for the following sites:

*   **YouTube** — Hides topbar logo
*   **Google Search** — Hides doodles and main logo
*   **X (formerly Twitter)** — Hides home X/bird logo
*   **Gmail** — Hides header logo

Additionally, a **generic ruleset** targets common logo patterns (`[class*="logo"]`, `header a > img`, etc.) so logo hiding works on **any website**.

## 🚀 Installation (Developer Mode)

Since this extension is not yet hosted on the Chrome Web Store, you can install it manually:

1.  **Clone or Download** this repository.
    ```bash
    git clone https://github.com/touka2014/hide-logos-extension.git
    ```
2.  Open your browser and navigate to the Extensions management page:
    *   Chrome: `chrome://extensions/`
    *   Edge: `edge://extensions/`
3.  Enable **Developer mode** (toggle in the top-right corner).
4.  Click **Load unpacked**.
5.  Select the cloned/downloaded directory.

## 📖 Usage

1.  Navigate to any website.
2.  Click the extension icon in the browser toolbar. The popup shows the current site's hostname.
3.  Toggle the **per-site** switches:
    *   **Hide Page Logo** — Hides logos on the current site.
    *   **Hide Tab Icon** — Replaces the current site's favicon with a transparent pixel.
4.  Optionally configure **Global Defaults** to set the baseline behavior for all sites.
5.  Use **Reset to Default** to remove per-site overrides and fall back to the global settings.

> **Note:** Per-site settings always take priority over global defaults.

## 📂 Project Structure

```text
.
├── manifest.json       # Manifest V3 configuration
├── content.js          # Core logic (CSS injection, favicon replacement, MutationObserver)
├── popup.html          # Extension popup UI (per-site + global controls)
├── popup.js            # Popup logic and per-site state management
├── popup.css           # Popup styles
├── styles/             # CSS rules for hiding logos
│   ├── youtube.css     # YouTube-specific rules
│   ├── google.css      # Google Search-specific rules
│   ├── gmail.css       # Gmail-specific rules
│   ├── x.css           # X/Twitter-specific rules
│   └── generic.css     # Generic rules for any website
├── icons/              # Extension icons
├── LICENSE             # MIT License
└── README.md           # Documentation
```

## 🔧 Technical Details

*   **Manifest V3**: Fully compliant with the latest Chrome Extension specification.
*   **Per-Site Storage**: Site-specific preferences are stored under `siteSettings[hostname]` in `chrome.storage.sync`.
*   **Performance**: Logos are hidden via CSS injection rather than JavaScript polling. `MutationObserver` is scoped to `<head>` for favicon replacement only.
*   **Error Handling**: Promise-based message passing with graceful connection error handling.

## 🤝 Contributing

Contributions are welcome! If you find a bug or want to add support for a new website:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: Add support for Facebook'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.