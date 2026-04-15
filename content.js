/* content.js - V5.0 Per-Site Control Version */
'use strict';

// --- Constants ---
const TRANSPARENT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
const STYLE_ELEMENT_ID = 'hide-logos-style';
const GENERIC_STYLE_ID = 'hide-logos-generic-style';

// Predefined CSS files for known sites
const SITE_CSS_MAP = {
  'youtube.com': 'styles/youtube.css',
  'google.com': 'styles/google.css',
  'mail.google.com': 'styles/gmail.css',
  'x.com': 'styles/x.css',
  'twitter.com': 'styles/x.css'
};

const GENERIC_CSS_FILE = 'styles/generic.css';

// --- State ---
let isTabIconHidden = false;
let tabObserver = null;
let cssCache = {};

// ==============================================
// Helpers
// ==============================================

function getHostname() {
  return location.hostname.replace(/^www\./, '');
}

function getMatchingSiteCSSFiles(hostname) {
  const files = [];
  for (const [site, file] of Object.entries(SITE_CSS_MAP)) {
    if (hostname === site || hostname.endsWith('.' + site)) {
      files.push(file);
    }
  }
  return files;
}

// ==============================================
// CSS Loading
// ==============================================

async function loadCSS(file) {
  if (cssCache[file] !== undefined) return cssCache[file];
  try {
    const res = await fetch(chrome.runtime.getURL(file));
    cssCache[file] = await res.text();
  } catch (e) {
    console.warn('[Hide Logos] Failed to load', file, e);
    cssCache[file] = '';
  }
  return cssCache[file];
}

// ==============================================
// Module A: Hide Website Logos (CSS injection)
// ==============================================

async function toggleLogoHiding(shouldHide) {
  if (shouldHide) {
    const hostname = getHostname();
    const siteFiles = getMatchingSiteCSSFiles(hostname);

    // Inject predefined CSS for known sites
    if (siteFiles.length > 0 && !document.getElementById(STYLE_ELEMENT_ID)) {
      const parts = await Promise.all(siteFiles.map(f => loadCSS(f)));
      const style = document.createElement('style');
      style.id = STYLE_ELEMENT_ID;
      style.textContent = parts.join('\n');
      (document.head || document.documentElement).appendChild(style);
    }

    // Always inject generic CSS for broader coverage
    if (!document.getElementById(GENERIC_STYLE_ID)) {
      const genericCSS = await loadCSS(GENERIC_CSS_FILE);
      const style = document.createElement('style');
      style.id = GENERIC_STYLE_ID;
      style.textContent = genericCSS;
      (document.head || document.documentElement).appendChild(style);
    }
  } else {
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) existing.remove();
    const generic = document.getElementById(GENERIC_STYLE_ID);
    if (generic) generic.remove();
  }
}

// ==============================================
// Module B: Hide Tab Favicon
// ==============================================

function applyFaviconHide() {
  const iconLinks = document.head
    ? document.head.querySelectorAll("link[rel*='icon']")
    : [];
  let hasIcon = false;

  iconLinks.forEach(link => {
    hasIcon = true;
    if (link.href !== TRANSPARENT_ICON) {
      link.href = TRANSPARENT_ICON;
    }
  });

  if (!hasIcon && document.head) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = TRANSPARENT_ICON;
    document.head.appendChild(link);
  }
}

function startTabObserver() {
  if (tabObserver) return;

  applyFaviconHide();

  tabObserver = new MutationObserver(() => {
    if (isTabIconHidden) {
      applyFaviconHide();
    }
  });

  if (document.head) {
    tabObserver.observe(document.head, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ['href', 'rel']
    });
  }
}

function stopTabObserver() {
  if (tabObserver) {
    tabObserver.disconnect();
    tabObserver = null;
  }
}

function toggleTabIconHiding(shouldHide) {
  isTabIconHidden = shouldHide;
  if (shouldHide) {
    startTabObserver();
  } else {
    stopTabObserver();
  }
}

// ==============================================
// Main Control Logic
// ==============================================

function loadSettingsAndApply() {
  const hostname = getHostname();
  chrome.storage.sync.get(['hideLogos', 'maskTab', 'siteSettings'], (result) => {
    const globalHideLogo = result.hideLogos === true;
    const globalHideTab = result.maskTab === true;
    const siteSettings = result.siteSettings || {};
    const site = siteSettings[hostname];

    // Per-site overrides global; if per-site not set, use global default
    const hideLogo = site && site.hideLogo !== undefined ? site.hideLogo : globalHideLogo;
    const hideTabIcon = site && site.hideTabIcon !== undefined ? site.hideTabIcon : globalHideTab;

    toggleLogoHiding(hideLogo);
    toggleTabIconHiding(hideTabIcon);
  });
}

// Initialize on page load
loadSettingsAndApply();

// Listen for real-time setting updates from the popup
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'UPDATE_SETTINGS') {
    loadSettingsAndApply();
  }
});
