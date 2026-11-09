const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');

// On macOS --lang does not change the browser's native application locale.
// An isolated, single-catalog copy exercises real Chrome i18n (including fallback)
// in either language without altering the user's browser/OS settings or mocking APIs.
for (const [locale, lang, title, button, applied] of [
  ['en', 'en', 'Page', 'Hide logo & tab icon', 'Applied to this page · 3 options'],
  ['zh_CN', 'zh-CN', '页面', '隐藏 Logo 和标签页图标', '已应用到此页面 · 3 项']
]) {
  test(`native ${locale} catalog: popup, placeholders, metadata and title restoration`, { timeout: 30000 }, async t => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hide-logos-locale-'));
    const directory = fs.realpathSync(temporary);
    let context;
    t.after(async () => {
      await context?.close();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    const files = new Set([
      'popup.html', 'popup.js', 'popup.css', `_locales/${locale}/messages.json`,
      ...Object.values(manifest.icons),
      ...manifest.content_scripts.flatMap(entry => [...entry.js, ...entry.css])
    ]);
    for (const file of files) {
      const destination = path.join(directory, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, file), destination);
    }
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ ...manifest, default_locale: locale }));
    const id = [...createHash('sha256').update(directory).digest().subarray(0, 16)]
      .map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`]
    });
    await context.route('https://www.google.com/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Google original</title><img alt="Google">'
    }));
    const control = await context.newPage();
    await control.goto(`chrome-extension://${id}/popup.html`);
    const selected = await control.evaluate(() => ({
      language: chrome.i18n.getMessage('languageCode'),
      description: chrome.runtime.getManifest().description
    }));
    assert.equal(selected.language, lang);
    const catalog = JSON.parse(fs.readFileSync(path.join(root, `_locales/${locale}/messages.json`)));
    assert.equal(selected.description, catalog.appDescription.message);
    const website = await context.newPage();
    await website.goto('https://www.google.com/');
    await website.bringToFront();
    const tab = await control.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
    const popup = await context.newPage();
    await popup.addInitScript(tab => { chrome.tabs.query = async () => [tab]; }, { id: tab.id, url: website.url() });
    await popup.setViewportSize({ width: 344, height: 820 });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.locator('html')).toHaveAttribute('lang', lang);
    await expect(popup.locator('#quickHide')).toHaveText(button);
    await popup.locator('#quickHide').click();
    await popup.locator('#siteTitle').check();
    await expect(website).toHaveTitle(title);
    await expect(popup.locator('#pageStatus')).toHaveText(applied);
    await expect(popup.locator('#siteTitle')).toBeEnabled();
    assert.equal(await popup.locator('[data-i18n]').evaluateAll(elements => elements.every(element => element.textContent.trim())), true);
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    await popup.locator('body').screenshot({ path: path.join(root, `artifacts/popup-${locale}-light.png`), animations: 'disabled' });
    await popup.locator('summary').click();
    for (const colorScheme of ['light', 'dark']) {
      await popup.emulateMedia({ colorScheme });
      await popup.locator('body').screenshot({ path: path.join(root, `artifacts/popup-${locale}-${colorScheme}-expanded.png`), animations: 'disabled' });
    }
    await popup.locator('#resetSite').click();
    await expect(website).toHaveTitle('Google original');
    await expect(popup.locator('#pageStatus')).toHaveText(catalog.nothingHidden.message);
  });
}
