/* Shared by the popup and isolated content-script world. No build step required. */
(() => {
  'use strict';

  const sites = [
    { id: 'gmail', domains: ['mail.google.com'] },
    { id: 'youtube', domains: ['youtube.com'] },
    { id: 'google', domains: ['google.com', 'encrypted.google.com'], exact: true },
    { id: 'x', domains: ['x.com', 'twitter.com'] }
  ];

  function normalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  }

  function matchSite(hostname) {
    const host = normalizeHostname(hostname);
    // Specific domains win: Gmail must not inherit Google Search's selectors.
    return sites.find(site => site.domains.some(domain =>
      host === domain || (!site.exact && host.endsWith(`.${domain}`))
    )) || null;
  }

  globalThis.HideLogos = { ...globalThis.HideLogos, sites, normalizeHostname, matchSite };
})();
