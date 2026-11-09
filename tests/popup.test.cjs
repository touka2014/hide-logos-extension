const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makePage, read, settle } = require('./helpers.cjs');

async function popup(t, { available = true, url = 'https://www.youtube.com/', locale = 'en' } = {}) {
  const page = makePage({ html: read('popup.html'), locale });
  t.after(() => page.window.close());
  page.window.chrome.tabs = {
    query: async () => [{ id: 1, url }],
    sendMessage: async () => available ? { ready: true, hostname: 'youtube.com', applied: { hideLogo: false, hideTabIcon: false, hideTitle: false } } : undefined
  };
  page.window.eval(read('popup.js'));
  await settle();
  return page;
}

test('popup keeps the requested switch state while saving and rolls back on storage failure', async t => {
  const page = await popup(t);
  let rejectSave;
  page.storage.sync.set = () => new Promise((_, reject) => { rejectSave = reject; });
  page.window.console.warn = () => {};
  const input = page.document.getElementById('siteTitle');
  input.click();
  assert.equal(input.checked, true);
  assert.equal(page.document.getElementById('siteControls').disabled, true);
  rejectSave(new Error('sync quota exceeded'));
  await settle();
  assert.equal(input.checked, false);
  assert.equal(page.document.getElementById('siteControls').disabled, false);
  assert.equal(page.document.getElementById('errorMessage').hidden, false);
});

test('unavailable content scripts cannot be mistaken for successful application', async t => {
  const page = await popup(t, { available: false });
  assert.equal(page.document.getElementById('siteControls').disabled, true);
  assert.equal(page.document.getElementById('globalControls').disabled, false);
  assert.match(page.document.getElementById('pageStatus').textContent, /Not applied/);
});

test('browser pages allow global settings but disable website controls', async t => {
  const page = await popup(t, { url: 'chrome://extensions' });
  assert.equal(page.document.getElementById('siteControls').disabled, true);
  assert.equal(page.document.getElementById('globalControls').disabled, false);
  assert.equal(page.document.getElementById('currentSite').textContent, 'No website selected');
});

test('Chinese popup translates static labels, dynamic status and save errors', async t => {
  const page = await popup(t, { locale: 'zh-CN' });
  assert.equal(page.document.documentElement.lang, 'zh-CN');
  assert.equal(page.document.getElementById('quickHide').textContent, '隐藏 Logo 和标签页图标');
  assert.equal(page.document.getElementById('pageStatus').textContent, '此页面尚未隐藏任何标识');
  assert.equal(page.document.getElementById('supportNote').textContent, 'YouTube · 已适配专用 Logo 规则');
  assert.match(page.document.getElementById('titleNote').textContent, /“页面”/);
  page.storage.sync.set = async () => { throw new Error('quota exceeded'); };
  page.window.console.warn = () => {};
  page.document.getElementById('siteIcon').click();
  await settle();
  assert.equal(page.document.getElementById('errorMessage').textContent, '设置保存失败，请重试。');
});
