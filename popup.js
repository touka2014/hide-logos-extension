/**
 * popup.js - V5.0 Per-Site Control
 */

let currentHostname = null;

document.addEventListener('DOMContentLoaded', () => {
  const siteLogoSwitch = document.getElementById('siteLogoSwitch');
  const siteTabSwitch = document.getElementById('siteTabSwitch');
  const globalLogoSwitch = document.getElementById('toggleSwitchLogo');
  const globalTabSwitch = document.getElementById('toggleSwitchTab');
  const resetBtn = document.getElementById('resetSiteBtn');
  const siteNameEl = document.getElementById('currentSite');

  // Get current tab hostname
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].url || !tabs[0].url.startsWith('http')) {
      siteNameEl.textContent = 'N/A (non-web page)';
      siteLogoSwitch.disabled = true;
      siteTabSwitch.disabled = true;
      resetBtn.classList.add('hidden');
      loadGlobalSettings();
      return;
    }

    try {
      currentHostname = new URL(tabs[0].url).hostname.replace(/^www\./, '');
    } catch {
      currentHostname = null;
    }

    if (currentHostname) {
      siteNameEl.textContent = currentHostname;
    } else {
      siteNameEl.textContent = 'N/A';
      siteLogoSwitch.disabled = true;
      siteTabSwitch.disabled = true;
    }

    loadAllSettings();
  });

  function loadGlobalSettings() {
    chrome.storage.sync.get(['hideLogos', 'maskTab'], (result) => {
      globalLogoSwitch.checked = result.hideLogos === true;
      globalTabSwitch.checked = result.maskTab === true;
    });
  }

  function loadAllSettings() {
    chrome.storage.sync.get(['hideLogos', 'maskTab', 'siteSettings'], (result) => {
      const globalHideLogo = result.hideLogos === true;
      const globalHideTab = result.maskTab === true;
      globalLogoSwitch.checked = globalHideLogo;
      globalTabSwitch.checked = globalHideTab;

      const siteSettings = result.siteSettings || {};
      const site = currentHostname ? siteSettings[currentHostname] : null;

      if (site && site.hideLogo !== undefined) {
        siteLogoSwitch.checked = site.hideLogo;
      } else {
        siteLogoSwitch.checked = globalHideLogo;
      }

      if (site && site.hideTabIcon !== undefined) {
        siteTabSwitch.checked = site.hideTabIcon;
      } else {
        siteTabSwitch.checked = globalHideTab;
      }

      updateResetBtnVisibility(site);
    });
  }

  function updateResetBtnVisibility(site) {
    if (site && (site.hideLogo !== undefined || site.hideTabIcon !== undefined)) {
      resetBtn.classList.remove('hidden');
    } else {
      resetBtn.classList.add('hidden');
    }
  }

  // Per-site: Hide Logo
  siteLogoSwitch.addEventListener('change', () => {
    if (!currentHostname) return;
    saveSiteSetting('hideLogo', siteLogoSwitch.checked);
  });

  // Per-site: Hide Tab Icon
  siteTabSwitch.addEventListener('change', () => {
    if (!currentHostname) return;
    saveSiteSetting('hideTabIcon', siteTabSwitch.checked);
  });

  // Global: Hide Logos
  globalLogoSwitch.addEventListener('change', () => {
    chrome.storage.sync.set({ hideLogos: globalLogoSwitch.checked });
    // Update site toggle to reflect new default if no per-site override
    chrome.storage.sync.get(['siteSettings'], (result) => {
      const site = (result.siteSettings || {})[currentHostname];
      if (!site || site.hideLogo === undefined) {
        siteLogoSwitch.checked = globalLogoSwitch.checked;
      }
    });
    notifyContentScript({ type: 'UPDATE_SETTINGS' });
  });

  // Global: Hide Tab Icons
  globalTabSwitch.addEventListener('change', () => {
    chrome.storage.sync.set({ maskTab: globalTabSwitch.checked });
    chrome.storage.sync.get(['siteSettings'], (result) => {
      const site = (result.siteSettings || {})[currentHostname];
      if (!site || site.hideTabIcon === undefined) {
        siteTabSwitch.checked = globalTabSwitch.checked;
      }
    });
    notifyContentScript({ type: 'UPDATE_SETTINGS' });
  });

  // Reset per-site settings
  resetBtn.addEventListener('click', () => {
    if (!currentHostname) return;
    chrome.storage.sync.get(['siteSettings', 'hideLogos', 'maskTab'], (result) => {
      const siteSettings = result.siteSettings || {};
      delete siteSettings[currentHostname];
      chrome.storage.sync.set({ siteSettings });

      // Revert toggles to global defaults
      siteLogoSwitch.checked = result.hideLogos === true;
      siteTabSwitch.checked = result.maskTab === true;
      resetBtn.classList.add('hidden');
      notifyContentScript({ type: 'UPDATE_SETTINGS' });
    });
  });

  function saveSiteSetting(key, value) {
    chrome.storage.sync.get(['siteSettings'], (result) => {
      const siteSettings = result.siteSettings || {};
      if (!siteSettings[currentHostname]) {
        siteSettings[currentHostname] = {};
      }
      siteSettings[currentHostname][key] = value;
      chrome.storage.sync.set({ siteSettings });
      updateResetBtnVisibility(siteSettings[currentHostname]);
      notifyContentScript({ type: 'UPDATE_SETTINGS' });
    });
  }
});

function notifyContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs.length === 0) return;
    const currentTab = tabs[0];
    if (!currentTab.url || !currentTab.url.startsWith('http')) return;

    try {
      await chrome.tabs.sendMessage(currentTab.id, message);
    } catch {
      // Content script not ready — silent fail
    }
  });
}