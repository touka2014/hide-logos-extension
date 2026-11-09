const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makePage, makeStorage, settle } = require('./helpers.cjs');

function setup(t, options) {
  const page = makePage({ ...options, content: true }); t.after(() => page.window.close());
  return page;
}

test('settings propagate across existing tabs and disabling restores both icon and title', async t => {
  const storage = makeStorage();
  const pages = [setup(t, { storage }), setup(t, { storage })];
  await settle();
  const store = pages[0].api.createSettingsStore(storage);
  await store.setSite('youtube.com', { hideLogo: true, hideTabIcon: true, hideTitle: true });
  await settle();
  for (const page of pages) {
    assert.equal(page.document.documentElement.dataset.hideLogos, 'true');
    assert.equal(page.document.title, 'Page');
    assert.equal(page.document.querySelector('link').href, page.api.transparentIcon);
  }
  await store.resetSite('youtube.com'); await settle();
  for (const page of pages) {
    assert.equal(page.document.documentElement.dataset.hideLogos, 'false');
    assert.equal(page.document.title, 'Original title');
    assert.equal(page.document.querySelector('link').getAttribute('href'), '/original.ico');
  }
});

test('a late head and a replaced head are both masked without polling', async t => {
  const page = setup(t, { storage: makeStorage({ maskTab: true, maskTitle: true }), beforeLoad: window => window.document.head.remove() });
  await settle();
  const head = page.document.createElement('head');
  head.innerHTML = '<title>Late title</title><link rel="icon" href="/late.ico">';
  page.document.documentElement.prepend(head); await settle();
  assert.equal(page.document.title, 'Page');
  assert.equal(head.querySelector('link').href, page.api.transparentIcon);
  const replacement = page.document.createElement('head');
  replacement.innerHTML = '<title>Replacement title</title><link rel="icon" href="/replacement.ico">';
  head.replaceWith(replacement); await settle();
  assert.equal(page.document.title, 'Page');
  assert.equal(replacement.querySelector('link').href, page.api.transparentIcon);
  await page.storage.sync.set({ maskTab: false, maskTitle: false }); await settle();
  assert.equal(page.document.title, 'Replacement title');
  assert.equal(replacement.querySelector('link').getAttribute('href'), '/replacement.ico');
});

test('late initial storage reads cannot undo a newer setting', async t => {
  const storage = makeStorage();
  const pending = [];
  storage.sync.get = () => new Promise(resolve => pending.push(resolve));
  const page = setup(t, { storage });
  await settle();
  await storage.sync.set({ hideLogos: true });
  const requests = [...pending];
  requests.at(-1)({ hideLogos: true }); await settle();
  for (const resolve of requests.slice(0, -1)) resolve({ hideLogos: false });
  await settle();
  assert.equal(page.document.documentElement.dataset.hideLogos, 'true');
});

test('rapid on/off ends off and dynamic metadata stays masked until disabled', async t => {
  const page = setup(t); await settle();
  for (let i = 0; i < 12; i++) await page.storage.sync.set({ hideLogos: i % 2 === 0 });
  await settle();
  assert.equal(page.document.documentElement.dataset.hideLogos, 'false');
  await page.storage.sync.set({ maskTab: true, maskTitle: true }); await settle();
  page.document.title = 'After SPA navigation';
  page.document.querySelector('link').href = '/spa.ico';
  await settle();
  assert.equal(page.document.title, 'Page');
  assert.equal(page.document.querySelector('link').href, page.api.transparentIcon);
  await page.storage.sync.set({ maskTab: false, maskTitle: false }); await settle();
  assert.equal(page.document.title, 'After SPA navigation');
  assert.equal(page.document.querySelector('link').getAttribute('href'), '/spa.ico');
});

test('unsupported sites report logo rules as inactive until generic rules are enabled', async t => {
  const page = setup(t, { url: 'https://example.test/', storage: makeStorage({ hideLogos: true }) });
  let status = await page.status();
  assert.equal(status.applied.hideLogo, false);
  await page.storage.sync.set({ genericLogos: true });
  status = await page.status();
  assert.equal(status.applied.hideLogo, true);
});
