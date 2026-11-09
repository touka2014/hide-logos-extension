(() => {
  'use strict';

  const { normalizeHostname, matchSite, createSettingsStore, FaviconController, TitleController } = globalThis.HideLogos;
  const hostname = normalizeHostname(location.hostname);
  const site = matchSite(hostname);
  const store = createSettingsStore(chrome.storage);
  const favicon = new FaviconController(document);
  const title = new TitleController(document);
  const attributes = ['data-hide-logos-site', 'data-hide-logos', 'data-hide-logos-generic'];
  let settings = null;
  let error = null;
  let revision = 0;
  let latestRead = Promise.resolve();
  let observedRoot = null;

  const headObserver = new MutationObserver(applyHead);
  const structureObserver = new MutationObserver(apply);

  function applyHead() {
    // Our own changes must not trigger the observer or compete with site updates.
    headObserver.disconnect();
    if (settings?.hideTabIcon) favicon.apply();
    else favicon.restore();
    if (settings?.hideTitle) title.apply();
    else title.restore();
    if (document.head && (settings?.hideTabIcon || settings?.hideTitle)) {
      headObserver.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['href', 'rel', 'type', 'sizes']
      });
    }
  }

  function apply() {
    const root = document.documentElement;
    if (root !== observedRoot) {
      observedRoot = root;
      structureObserver.disconnect();
      structureObserver.observe(document, { childList: true });
      if (root) structureObserver.observe(root, { childList: true, attributes: true, attributeFilter: attributes });
    }
    if (root) {
      const values = [site?.id || 'unknown', String(settings?.hideLogo === true), String(settings?.genericRules === true)];
      attributes.forEach((name, index) => {
        if (root.getAttribute(name) !== values[index]) root.setAttribute(name, values[index]);
      });
    }
    applyHead();
  }

  function getStatus() {
    return {
      hostname,
      site: site?.id || null,
      ready: settings !== null && document.documentElement !== null,
      error,
      settings,
      applied: {
        hideLogo: !!(settings?.hideLogo && (site || settings.genericRules)),
        hideTabIcon: !!(settings?.hideTabIcon && document.head),
        hideTitle: !!(settings?.hideTitle && document.head)
      }
    };
  }

  async function refresh() {
    const current = ++revision;
    latestRead = store.read(hostname).then(result => {
      if (current !== revision) return;
      settings = result.effective;
      error = null;
      apply();
    }).catch(cause => {
      if (current === revision) error = cause.message || 'Unable to read settings';
      console.warn('[Hide Logos]', cause);
    });
    await latestRead;
    if (current !== revision) await latestRead;
    return getStatus();
  }

  structureObserver.observe(document, { childList: true });
  store.subscribe(refresh);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'HIDE_LOGOS_GET_STATUS') return;
    refresh().then(sendResponse);
    return true;
  });
  window.addEventListener('pageshow', refresh);
  apply();
  refresh();
})();
