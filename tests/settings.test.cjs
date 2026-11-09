const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makePage, makeStorage } = require('./helpers.cjs');
const plain = value => JSON.parse(JSON.stringify(value));

test('defaults are opt-in, legacy settings are inherited per field, and invalid values are ignored', t => {
  const page = makePage(); t.after(() => page.window.close());
  const { resolveSettings } = page.api;
  assert.deepEqual(plain(resolveSettings({}, 'youtube.com').effective), { hideLogo: false, hideTabIcon: false, hideTitle: false, genericRules: false });
  const settings = resolveSettings({ hideLogos: true, maskTab: 'true', siteSettings: { 'youtube.com': { hideLogo: false, hideTabIcon: true } } }, 'WWW.YouTube.Com.');
  assert.equal(settings.effective.hideLogo, false);
  assert.equal(settings.effective.hideTabIcon, true);
  assert.equal(settings.effective.genericRules, false);
  assert.equal(resolveSettings({ siteSettings: { 'x.com': { hideLogo: 'false' } } }, 'x.com').effective.hideLogo, false);
});

test('Gmail wins over Google, and lookalike domains never match', t => {
  const page = makePage(); t.after(() => page.window.close());
  const { matchSite } = page.api;
  assert.equal(matchSite('mail.google.com').id, 'gmail');
  assert.equal(matchSite('www.google.com').id, 'google');
  assert.equal(matchSite('m.youtube.com').id, 'youtube');
  assert.equal(matchSite('drive.google.com'), null);
  assert.equal(matchSite('youtube.com.evil.test'), null);
  assert.equal(matchSite('notyoutube.com'), null);
});

test('parallel writes preserve unrelated fields and sites; resetting masks legacy overrides', async t => {
  const storage = makeStorage({ hideLogos: false, siteSettings: { 'youtube.com': { hideLogo: true, hideTabIcon: true } } });
  const page = makePage({ storage }); t.after(() => page.window.close());
  const store = page.api.createSettingsStore(storage);
  await Promise.all([
    store.setSite('youtube.com', { hideLogo: false }),
    store.setSite('youtube.com', { hideTitle: true }),
    store.setSite('x.com', { hideTabIcon: true })
  ]);
  assert.equal((await store.read('youtube.com')).effective.hideTitle, true);
  assert.equal((await store.read('youtube.com')).effective.hideLogo, false);
  assert.equal((await store.read('x.com')).effective.hideTabIcon, true);
  await store.resetSite('youtube.com');
  const result = await store.read('youtube.com');
  assert.ok(Object.values(result.overrides).every(value => value === null));
  assert.ok(Object.values(result.effective).every(value => value === false));
  await store.setDefault('hideLogo', true);
  assert.equal((await store.read('youtube.com')).effective.hideLogo, true);
  assert.equal((await storage.sync.get()).siteSettings['youtube.com'].hideLogo, true);
});

test('storage errors reach the caller and subscriptions can be removed', async t => {
  const storage = makeStorage();
  const page = makePage({ storage }); t.after(() => page.window.close());
  const store = page.api.createSettingsStore(storage);
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  await store.setDefault('hideLogo', true);
  assert.equal(calls, 1);
  unsubscribe();
  await store.setDefault('hideLogo', false);
  assert.equal(calls, 1);
  storage.sync.set = async () => { throw new Error('quota exceeded'); };
  await assert.rejects(store.setSite('x.com', { hideLogo: true }), /quota/);
});
