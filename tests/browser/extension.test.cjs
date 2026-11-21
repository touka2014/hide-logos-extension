const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { mkdirSync, readFileSync } = require('node:fs');
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

  await t.test('YouTube, Search, Gmail and X rules work with CSP and preserve navigation', async () => {
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

  await t.test('Reddit rules hide and restore branding across layouts and preserve unrelated controls', async () => {
    await clear();
    const png = readFileSync(path.join(root, 'icons/icon16.png'), 'base64');
    const layouts = {
      'https://www.reddit.com/': '<header><a id="reddit-logo" data-brand href="/"><svg></svg>reddit</a><button data-keep>Menu</button></header>',
      'https://sh.reddit.com/': '<header><a aria-label="Go to Reddit Home" data-brand href="/">reddit</a><button data-keep>Search</button></header>',
      'https://old.reddit.com/': '<div id="header-bottom-left"><a id="header-img" class="default-header" data-brand href="/">reddit.com</a><span class="redditname" data-keep>Community</span></div>',
      'https://old.reddit.com/login/': '<shreddit-app><header><div><span><svg viewBox="0 0 216 216" data-brand><defs><radialGradient id="snoo-radial-gradient-1"/></defs></svg></span><span><svg style="color:var(--shreddit-color-wordmark)" data-brand></svg></span></div><button data-keep>Log in</button></header></shreddit-app>',
      'https://www.reddit.com/verify': '<main><div class="logo"><svg viewBox="0 0 216 216" data-brand></svg></div><form data-keep>Continue</form></main>',
      'https://www.reddit.com/verify-header': '<div class="header"><a href="https://www.reddit.com"><img data-brand></a></div><div class="main"><form data-keep>Continue</form></div>',
      'https://old.reddit.com/blocked': `<body class="theme-beta"><div><div class="overflow-hidden"><img data-brand src="data:image/png;base64,${png}"></div><a data-keep href="https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=21879292693140">File a ticket</a></div>`
    };
    const page = await context.newPage();
    await page.route(/^https:\/\/(www|sh|old)\.reddit\.com\//, route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html>' + layouts[route.request().url()] + '<article data-keep><img class="logo" alt="Community logo"></article>'
    }));
    for (const url of Object.keys(layouts)) {
      await page.goto(url);
      const logos = await page.locator('[data-brand]').all();
      assert.ok(logos.length > 0, url);
      for (const logo of logos) await expect(logo).toHaveCSS('opacity', '1');
      await write({ hideLogos: true });
      for (const logo of logos) await expect(logo).toHaveCSS('opacity', '0');
      for (const other of await page.locator('[data-keep], article img').all()) {
        assert.ok(await other.evaluate(element => {
          for (let node = element; node; node = node.parentElement) {
            if (getComputedStyle(node).opacity === '0') return false;
          }
          return true;
        }), url);
      }
      const homeLink = page.locator('a[data-brand]');
      if (await homeLink.count()) await homeLink.click({ trial: true });
      await write({ hideLogos: false });
      for (const logo of logos) await expect(logo).toHaveCSS('opacity', '1');
    }
    await page.close();
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

  await t.test('popup picks, cancels, persists and undoes individual logos on one host under strict CSP', async () => {
    await clear();
    const page = await open('unknown.test');
    const other = await open('www.google.com');
    await page.bringToFront();
    const tab = await control.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
    async function openPopup() {
      const popup = await context.newPage();
      await popup.addInitScript(tab => { chrome.tabs.query = async () => [tab]; }, { id: tab.id, url: page.url() });
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(popup.locator('#pickLogo')).toBeEnabled();
      return popup;
    }
    const overlay = page.locator('[data-hide-logos-picker]');
    async function startPick() {
      const popup = await openPopup();
      await popup.locator('#pickLogo').click();
      await expect(overlay).toBeVisible();
    }
    async function select(locator) {
      const box = await locator.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(overlay).toHaveCount(0);
    }
    const logo = page.locator('[data-logo]');
    const second = page.locator('#logout');
    await startPick();
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
    await expect(logo).toHaveCSS('opacity', '1');
    await startPick();
    await select(logo);
    await expect(logo).toHaveCSS('opacity', '0');
    await startPick();
    await select(second);
    await expect(second).toHaveCSS('opacity', '0');
    assert.equal(page.url(), 'https://unknown.test/');
    await expect(other.locator('#logout')).toHaveCSS('opacity', '1');

    await page.reload();
    await expect(logo).toHaveCSS('opacity', '0');
    await expect(second).toHaveCSS('opacity', '0');
    await page.evaluate(() => { const el = document.querySelector('#logout'); el.replaceWith(el.cloneNode(true)); });
    await expect(second).toHaveCSS('opacity', '0');
    const revisit = await open('unknown.test');
    await expect(revisit.locator('#logout')).toHaveCSS('opacity', '0');
    const popup = await openPopup();
    await expect(popup.locator('#siteLogo')).not.toBeChecked();
    await popup.locator('#siteLogo').check();
    await popup.locator('#siteLogo').uncheck();
    await expect(logo).toHaveCSS('opacity', '0');
    await popup.locator('#undoPick').click();
    await expect(second).toHaveCSS('opacity', '1');
    await expect(revisit.locator('#logout')).toHaveCSS('opacity', '1');
    await expect(logo).toHaveCSS('opacity', '0');
    await popup.locator('#undoPick').click();
    await expect(logo).toHaveCSS('opacity', '1');
    await expect(popup.locator('#undoPick')).toBeHidden();
    await page.reload();
    await expect(logo).toHaveCSS('opacity', '1');

    // Pick a path inside an anonymous SVG. Anchor the whole SVG to its home
    // link, leave the adjacent icon alone, and retry a failed save in place.
    await page.locator('header').evaluate(header => header.insertAdjacentHTML('afterbegin',
      '<a href="/"><svg width="40" height="24"><rect width="40" height="24"/></svg></a>' +
      '<a href="/search"><svg width="20" height="20"></svg></a>'));
    await clear();
    const filler = Object.fromEntries(Array.from({ length: 512 }, (_, i) => ['filler' + i, 1]));
    await write(filler);
    await startPick();
    const rect = page.locator('a[href="/"] rect');
    const point = await rect.boundingBox();
    await page.mouse.click(point.x + 3, point.y + 3);
    const failed = await control.evaluate(() => chrome.i18n.getMessage('pickSaveError'));
    await expect(overlay.locator('[role="status"]')).toHaveText(failed);
    await expect(page.locator('a[href="/"] svg')).toHaveCSS('opacity', '1');
    await clear();
    await select(rect);
    await expect(page.locator('a[href="/"] svg')).toHaveCSS('opacity', '0');
    await expect(page.locator('a[href="/search"] svg')).toHaveCSS('opacity', '1');
    await popup.close(); await revisit.close(); await other.close(); await page.close();
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
