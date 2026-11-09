(() => {
  'use strict';
  const { normalizeHostname, matchSite, createSettingsStore } = globalThis.HideLogos;
  const store = createSettingsStore(chrome.storage);
  const $ = id => document.getElementById(id);
  const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);
  document.documentElement.lang = t('languageCode');
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  $('titleNote').textContent = t('titleNote', t('maskedTitle'));
  const siteInputs = [...document.querySelectorAll('[data-site-field]')];
  const globalInputs = [...document.querySelectorAll('[data-global-field]')];
  let tab = null;
  let hostname = '';
  let snapshot = null;
  let pageAvailable = false;
  let busy = false;
  let viewRevision = 0;

  function setStatus(text, state = '') {
    $('pageStatus').textContent = text;
    $('pageStatus').dataset.state = state;
  }

  function setError(message = '') {
    $('errorMessage').textContent = message;
    $('errorMessage').hidden = !message;
  }

  function render() {
    if (!snapshot) return;
    for (const input of siteInputs) {
      const field = input.dataset.siteField;
      if (!busy) input.checked = snapshot.effective[field];
      document.querySelector(`[data-source="${field}"]`).textContent =
        t(snapshot.overrides[field] === null ? 'sourceGlobal' : 'sourceWebsite');
    }
    for (const input of globalInputs) {
      if (!busy) input.checked = snapshot.defaults[input.dataset.globalField];
    }
    $('siteControls').disabled = busy || !pageAvailable;
    $('genericControls').disabled = busy || !pageAvailable;
    $('globalControls').disabled = busy;
    $('quickHide').disabled = busy || !pageAvailable;
    $('resetSite').disabled = busy || !pageAvailable || Object.values(snapshot.overrides).every(value => value === null);
  }

  async function reload() {
    const current = ++viewRevision;
    const next = await store.read(hostname);
    let status = null;
    if (hostname) {
      try {
        status = await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_LOGOS_GET_STATUS' });
      } catch { /* Existing tabs after extension installation may need a refresh. */ }
    }
    if (current !== viewRevision) return;
    snapshot = next;
    pageAvailable = !!(status?.ready && !status.error && status.hostname === hostname);
    if (!hostname) {
      setStatus(t('openWebsite'));
    } else if (!pageAvailable) {
      setStatus(t('pageUnavailable'), 'unavailable');
    } else if (next.effective.hideLogo && !matchSite(hostname) && !next.effective.genericRules) {
      setStatus(t('noLogoRules'), 'unavailable');
    } else {
      const count = Object.values(status.applied).filter(Boolean).length;
      setStatus(count ? t(count === 1 ? 'appliedOne' : 'appliedMany', String(count)) : t('nothingHidden'), count ? 'applied' : '');
    }
    render();
  }

  async function save(operation) {
    if (busy) return;
    busy = true;
    setError();
    render();
    try {
      await operation();
      await reload();
    } catch (error) {
      setError(t('saveError'));
      console.warn('[Hide Logos]', error);
      try { await reload(); } catch { /* Keep the last confirmed state. */ }
    } finally {
      busy = false;
      render();
    }
  }

  for (const input of siteInputs) {
    input.addEventListener('change', () => {
      const value = input.checked;
      save(() => store.setSite(hostname, { [input.dataset.siteField]: value }));
    });
  }
  for (const input of globalInputs) {
    input.addEventListener('change', () => {
      const value = input.checked;
      save(() => store.setDefault(input.dataset.globalField, value));
    });
  }
  $('resetSite').addEventListener('click', () => save(() => store.resetSite(hostname)));
  $('quickHide').addEventListener('click', () => save(() => store.setSite(hostname, { hideLogo: true, hideTabIcon: true })));

  store.subscribe(() => reload().catch(() => setError(t('reloadError'))));

  async function initialize() {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      const url = new URL(tab?.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') hostname = normalizeHostname(url.hostname);
    } catch { /* Browser pages and tabs without a URL have global controls only. */ }
    const site = matchSite(hostname);
    $('currentSite').textContent = hostname || t('noWebsite');
    $('supportNote').textContent = hostname
      ? (site ? t('siteSupported', t(`site_${site.id}`)) : t('siteUnsupported'))
      : t('globalAvailable');
    if (hostname && !site) $('advanced').open = true;
    await reload();
  }

  initialize().catch(error => {
    setError(t('loadError'));
    setStatus(t('settingsUnavailable'), 'unavailable');
    console.warn('[Hide Logos]', error);
  });
})();
