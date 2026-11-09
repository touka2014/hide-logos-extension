(() => {
  'use strict';

  const { normalizeHostname } = globalThis.HideLogos;
  const fields = ['hideLogo', 'hideTabIcon', 'hideTitle', 'genericRules'];
  const globalKeys = {
    hideLogo: 'hideLogos',
    hideTabIcon: 'maskTab',
    hideTitle: 'maskTitle',
    genericRules: 'genericLogos'
  };
  const prefix = 'hideLogos.v3.site.';

  function siteKey(hostname, field) {
    return `${prefix}${encodeURIComponent(normalizeHostname(hostname))}.${field}`;
  }

  function resolveSettings(raw, hostname) {
    const host = normalizeHostname(hostname);
    const legacy = raw.siteSettings && Object.hasOwn(raw.siteSettings, host)
      ? raw.siteSettings[host] : null;
    const defaults = {};
    const overrides = {};
    const effective = {};
    for (const field of fields) {
      defaults[field] = raw[globalKeys[field]] === true;
      const key = siteKey(host, field);
      // A null v3 value explicitly means "inherit" and masks any old override.
      const value = Object.hasOwn(raw, key) ? raw[key] : legacy?.[field];
      overrides[field] = typeof value === 'boolean' ? value : null;
      effective[field] = overrides[field] ?? defaults[field];
    }
    return { defaults, overrides, effective };
  }

  function createSettingsStore(storage) {
    function validateField(field) {
      if (!fields.includes(field)) throw new Error('Unknown setting');
    }

    return {
      async read(hostname) {
        return resolveSettings(await storage.sync.get(null), hostname);
      },
      async setSite(hostname, changes) {
        if (!hostname) throw new Error('A website is required');
        const values = {};
        for (const [field, value] of Object.entries(changes)) {
          validateField(field);
          if (value !== null && typeof value !== 'boolean') throw new Error('Invalid setting');
          values[siteKey(hostname, field)] = value;
        }
        // Separate keys prevent concurrent tabs from overwriting unrelated options/sites.
        await storage.sync.set(values);
      },
      async setDefault(field, value) {
        validateField(field);
        if (typeof value !== 'boolean') throw new Error('Invalid setting');
        await storage.sync.set({ [globalKeys[field]]: value });
      },
      async resetSite(hostname) {
        await this.setSite(hostname, Object.fromEntries(fields.map(field => [field, null])));
      },
      subscribe(listener) {
        const onChange = (changes, area) => {
          if (area === 'sync' && Object.keys(changes).some(key =>
            key === 'siteSettings' || key.startsWith(prefix) || Object.values(globalKeys).includes(key)
          )) listener();
        };
        storage.onChanged.addListener(onChange);
        return () => storage.onChanged.removeListener(onChange);
      }
    };
  }

  globalThis.HideLogos = { ...globalThis.HideLogos, fields, siteKey, resolveSettings, createSettingsStore };
})();
