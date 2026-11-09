const { test } = require('node:test');
const assert = require('node:assert/strict');
const { read, makePage, settle } = require('./helpers.cjs');

test('both catalogs cover every static, dynamic and manifest message with matching placeholders', t => {
  const english = JSON.parse(read('_locales/en/messages.json'));
  const chinese = JSON.parse(read('_locales/zh_CN/messages.json'));
  assert.deepEqual(Object.keys(chinese).sort(), Object.keys(english).sort());
  const page = makePage({ html: read('popup.html') }); t.after(() => page.window.close());
  const keys = [...page.document.querySelectorAll('[data-i18n]')].map(element => element.dataset.i18n);
  for (const match of read('popup.js').matchAll(/\bt\('([^']+)'/g)) keys.push(match[1]);
  for (const match of read('manifest.json').matchAll(/__MSG_(\w+)__/g)) keys.push(match[1]);
  keys.push('sourceGlobal', 'sourceWebsite', 'appliedOne', 'appliedMany', 'maskedTitle');
  keys.push(...page.api.sites.map(site => `site_${site.id}`));
  for (const key of keys) {
    assert.ok(english[key]?.message, `Missing English message: ${key}`);
    assert.ok(chinese[key]?.message, `Missing Chinese message: ${key}`);
  }
  for (const [key, entry] of Object.entries(english)) {
    assert.deepEqual(Object.keys(chinese[key].placeholders || {}).sort(), Object.keys(entry.placeholders || {}).sort(), key);
  }
  assert.equal(JSON.parse(read('manifest.json')).default_locale, 'en');
});

test('Chinese hidden titles follow site updates and restore the original text', async t => {
  const page = makePage({ locale: 'zh-CN', content: true }); t.after(() => page.window.close());
  await page.storage.sync.set({ maskTitle: true }); await settle();
  assert.equal(page.document.title, '页面');
  page.document.title = '（3）新邮件 - Gmail'; await settle();
  assert.equal(page.document.title, '页面');
  await page.storage.sync.set({ maskTitle: false }); await settle();
  assert.equal(page.document.title, '（3）新邮件 - Gmail');
});
