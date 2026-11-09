const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const { chromium, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');
// Chromium derives an unpacked extension ID from its absolute path (no manifest key needed).
const extensionId = [...createHash('sha256').update(root).digest().subarray(0, 16)]
  .map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
const originalIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>');
const fixtures = {
  'www.youtube.com': '<ytd-topbar-logo-renderer data-logo><a href="/">YouTube</a></ytd-topbar-logo-renderer>',
  'www.google.com': '<img data-logo alt="Google"><svg id="svgGoogle" aria-label="Google" role="img"></svg>',
  'mail.google.com': '<img data-logo alt="Gmail"><img id="otherGoogleImage" alt="Google">',
  'x.com': '<h1 role="heading"><a data-logo href="/home" aria-label="X"><svg><path d="M0 0"/></svg></a></h1>',
  'unknown.test': '<img data-logo class="logo" alt="Example logo">'
};
const fixtureHTML = hostname => `<!doctype html><html><head><title>Original ${hostname}</title><link rel="icon" href="${originalIcon}" type="image/svg+xml" sizes="any"></head><body><header>${fixtures[hostname]}<nav><a id="logout" class="logout" href="/logout">Log out</a><a href="/profile"><img id="avatar" alt="Avatar"></a><a href="/settings"><svg id="navButton"></svg></a></nav></header><main>Normal page content</main></body></html>`;

test('unpacked extension in Chromium', { timeout: 120000 }, async t => {
  mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  t.after(() => context.close());
  await context.route(/^https:\/\/(www\.youtube\.com|www\.google\.com|mail\.google\.com|x\.com|unknown\.test)\//, route => {
    const hostname = new URL(route.request().url()).hostname;
    return route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'none'; script-src 'none'" }, body: fixtureHTML(hostname) });
  });
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/popup.html`);
  assert.equal(await control.evaluate(() => chrome.runtime.id), extensionId);
  const messages = await control.evaluate(() => ({
    title: chrome.i18n.getMessage('maskedTitle'),
    none: chrome.i18n.getMessage('nothingHidden'),
    two: chrome.i18n.getMessage('appliedMany', '2'),
    three: chrome.i18n.getMessage('appliedMany', '3')
  }));
  const write = values => control.evaluate(values => chrome.storage.sync.set(values), values);
  const clear = () => control.evaluate(() => chrome.storage.sync.clear());
  const open = async hostname => {
    const page = await context.newPage();
    await page.goto(`https://${hostname}/`);
    return page;
  };

  await t.test('four dedicated adapters work with CSP and do not hide navigation', async () => {
    await write({ hideLogos: true, maskTab: true, maskTitle: true });
    for (const hostname of ['www.youtube.com', 'www.google.com', 'mail.google.com', 'x.com']) {
      const page = await open(hostname);
      await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
      await expect(page.locator('#avatar')).toHaveCSS('opacity', '1');
      await expect(page.locator('#navButton')).toHaveCSS('opacity', '1');
      await expect(page.locator('#logout')).toHaveCSS('opacity', '1');
      await expect(page).toHaveTitle(messages.title);
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/png');
      if (hostname === 'mail.google.com') await expect(page.locator('#otherGoogleImage')).toHaveCSS('opacity', '1');
      if (hostname === 'www.google.com') await expect(page.locator('#svgGoogle')).toHaveCSS('opacity', '0');
      const iconDecoded = await page.evaluate(async () => {
        const image = new Image(); image.src = document.querySelector('link[rel="icon"]').href;
        await image.decode(); return [image.naturalWidth, image.naturalHeight];
      });
      assert.deepEqual(iconDecoded, [1, 1]);
      await page.close();
    }
  });

  await t.test('existing tabs update together, SPA metadata stays hidden, and turning off restores the latest values', async () => {
    await clear();
    const first = await open('www.youtube.com');
    const second = await open('www.youtube.com');
    await expect(first.locator('[data-logo]')).toHaveCSS('opacity', '1');
    await write({ hideLogos: true, maskTab: true, maskTitle: true });
    for (const page of [first, second]) await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
    await first.evaluate(() => {
      history.pushState({}, '', '/watch?v=next');
      document.title = 'Next video - YouTube';
      document.querySelector('link[rel="icon"]').setAttribute('href', '/next.ico');
      document.querySelector('link[rel="icon"]').setAttribute('type', 'image/x-icon');
      document.querySelector('header').insertAdjacentHTML('beforeend', '<ytd-topbar-logo-renderer id="newLogo">YouTube</ytd-topbar-logo-renderer>');
    });
    await expect(first).toHaveTitle(messages.title);
    await expect(first.locator('#newLogo')).toHaveCSS('opacity', '0');
    await expect(first.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/png');
    await write({ hideLogos: false, maskTab: false, maskTitle: false });
    for (const page of [first, second]) await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '1');
    await expect(first).toHaveTitle('Next video - YouTube');
    await expect(first.locator('link[rel="icon"]')).toHaveAttribute('href', '/next.ico');
    await expect(first.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/x-icon');
    await expect(second).toHaveTitle('Original www.youtube.com');
    await first.close(); await second.close();
  });

  await t.test('generic rules require opt-in and preserve avatars, logout and navigation icons', async () => {
    await clear(); await write({ hideLogos: true });
    const page = await open('unknown.test');
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '1');
    await write({ genericLogos: true });
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
    for (const id of ['avatar', 'logout', 'navButton']) await expect(page.locator(`#${id}`)).toHaveCSS('opacity', '1');
    await page.close();
  });

  await t.test('legacy preferences survive reloads and per-site reset resumes global defaults', async () => {
    await clear();
    await write({ hideLogos: false, siteSettings: { 'youtube.com': { hideLogo: true, hideTabIcon: true } } });
    const page = await open('www.youtube.com');
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
    await page.reload();
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
    await control.evaluate(() => HideLogos.createSettingsStore(chrome.storage).resetSite('youtube.com'));
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '1');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/svg+xml');
    await write({ hideLogos: true });
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
    await page.close();
  });

  await t.test('popup confirms real content-script status, saves settings, resets and renders in both themes', async () => {
    await clear();
    const page = await open('www.youtube.com');
    await page.bringToFront();
    const tab = await control.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
    const popup = await context.newPage();
    // Opening a popup as a full page does not grant activeTab. Supply only its target;
    // all storage, messaging and content-script behavior still uses real Chrome APIs.
    await popup.addInitScript(tab => { chrome.tabs.query = async () => [tab]; }, { id: tab.id, url: page.url() });
    await popup.setViewportSize({ width: 344, height: 820 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.locator('#pageStatus')).toHaveText(messages.none);
    await popup.locator('#quickHide').click();
    await expect(popup.locator('#pageStatus')).toHaveText(messages.two);
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '0');
    await popup.locator('#siteTitle').check();
    await expect(page).toHaveTitle(messages.title);
    await expect(popup.locator('#pageStatus')).toHaveText(messages.three);
    await expect(popup.locator('#siteTitle')).toBeChecked();
    await expect(popup.locator('#siteTitle')).toBeEnabled();
    await popup.locator('body').screenshot({ path: path.join(root, 'artifacts/popup-light.png'), animations: 'disabled' });
    await popup.emulateMedia({ colorScheme: 'dark' });
    await popup.locator('body').screenshot({ path: path.join(root, 'artifacts/popup-dark.png'), animations: 'disabled' });
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await popup.locator('#resetSite').click();
    await expect(page.locator('[data-logo]')).toHaveCSS('opacity', '1');
    await expect(page).toHaveTitle('Original www.youtube.com');
    await expect(popup.locator('#pageStatus')).toHaveText(messages.none);
    await popup.close(); await page.close();
  });
});
