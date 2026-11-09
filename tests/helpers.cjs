const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const scripts = ['shared/sites.js', 'shared/settings.js', 'controllers/favicon.js', 'controllers/title.js'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

// Unit-test stub only. Production uses Chrome's native message lookup and fallback.
function makeI18n(locale = 'en') {
  const english = JSON.parse(read('_locales/en/messages.json'));
  const messages = locale.replace('-', '_') === 'zh_CN'
    ? JSON.parse(read('_locales/zh_CN/messages.json')) : english;
  return {
    getMessage(key, substitutions = []) {
      const entry = messages[key] || english[key];
      if (!entry) return '';
      const values = Array.isArray(substitutions) ? substitutions : [substitutions];
      return entry.message.replace(/\$([a-z_]+)\$/gi, (_, name) => {
        const placeholder = entry.placeholders?.[name.toLowerCase()];
        return placeholder ? placeholder.content.replace(/\$(\d+)/g, (_, index) => values[index - 1] ?? '') : '';
      });
    }
  };
}

function makeStorage(initial = {}) {
  let data = structuredClone(initial);
  const listeners = new Set();
  const storage = {
    sync: {
      async get() { return structuredClone(data); },
      async set(values) {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
          data[key] = structuredClone(value);
        }
        for (const listener of listeners) listener(changes, 'sync');
      }
    },
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) }
  };
  return storage;
}

function makePage({ html = '<!doctype html><html><head><title>Original title</title><link rel="icon" href="/original.ico" type="image/x-icon" sizes="32x32"></head><body></body></html>', url = 'https://www.youtube.com/watch?v=1', storage = makeStorage(), content = false, beforeLoad, locale = 'en' } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window } = dom;
  const messages = [];
  window.chrome = { storage, i18n: makeI18n(locale), runtime: { onMessage: { addListener: fn => messages.push(fn) } } };
  for (const script of scripts) window.eval(read(script));
  beforeLoad?.(window);
  if (content) window.eval(read('content.js'));
  return { dom, window, document: window.document, api: window.HideLogos, storage,
    status: () => new Promise(resolve => messages[0]({ type: 'HIDE_LOGOS_GET_STATUS' }, {}, resolve)) };
}

module.exports = { root, read, settle, makeStorage, makePage };
