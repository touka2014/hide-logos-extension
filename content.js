/* content.js - V4.0 Modular & Optimized Version */
'use strict';

// --- Constants ---
const TRANSPARENT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
const MASK_TITLE = 'New Tab';
const STYLE_ELEMENT_ID = 'hide-logos-style';

// External CSS files to load (single source of truth lives in styles/)
const CSS_FILES = [
  'styles/youtube.css',
  'styles/google.css',
  'styles/x.css',
  'styles/gmail.css'
];

// --- State ---
let isTabMasked = false;
let tabObserver = null;
let cssCache = null; // Cached concatenated CSS content

// ==============================================
// CSS Loading — fetches and caches external style files
// ==============================================

async function loadCSSFromFiles() {
  if (cssCache !== null) return cssCache;

  try {
    const responses = await Promise.all(
      CSS_FILES.map(file =>
        fetch(chrome.runtime.getURL(file)).then(res => res.text())
      )
    );
    cssCache = responses.join('\n');
  } catch {
    // Fallback: if fetching fails, use empty string
    cssCache = '';
  }
  return cssCache;
}

// ==============================================
// Module A: Hide Website Logos (CSS injection)
// ==============================================

async function toggleLogoHiding(shouldHide) {
  if (shouldHide) {
    if (!document.getElementById(STYLE_ELEMENT_ID)) {
      const css = await loadCSSFromFiles();
      const style = document.createElement('style');
      style.id = STYLE_ELEMENT_ID;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  } else {
    const existing = document.getElementById(STYLE_ELEMENT_ID);
    if (existing) {
      existing.remove();
    }
  }
}

// ==============================================
// Module B: Mask Tab (favicon & title)
// ==============================================

function applyTabMask() {
  // 1. Favicon — replace all existing icons or create one
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

  // 2. Title
  if (document.title !== MASK_TITLE) {
    document.title = MASK_TITLE;
  }
}

function startTabObserver() {
  if (tabObserver) return;

  applyTabMask();

  tabObserver = new MutationObserver(() => {
    if (isTabMasked) {
      applyTabMask();
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

  const titleEl = document.querySelector('title');
  if (titleEl) {
    tabObserver.observe(titleEl, { childList: true });
  }
}

function stopTabObserver() {
  if (tabObserver) {
    tabObserver.disconnect();
    tabObserver = null;
  }
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
    const hideLogos = result.hideLogos !== false;
    const maskTab = result.maskTab !== false;

    toggleLogoHiding(hideLogos);
    toggleTabMasking(maskTab);
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
