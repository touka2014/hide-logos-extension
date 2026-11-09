# Hide Logos

A lightweight Manifest V3 extension that reduces conspicuous website branding while you browse. Hide page logos, tab icons and, optionally, tab titles independently for each website.

Nothing is hidden by default. All production code is plain JavaScript and CSS: **no build step, server or runtime dependencies**.

## Languages

The extension supports **English and Simplified Chinese** through Chrome's native `chrome.i18n` API. It follows the browser's interface language; unsupported languages fall back to English. This is independent of a website's language or preferred content languages. The interface keeps its existing controls without adding a language picker.

Popup labels, status/error messages, the extension description and the neutral hidden title are localized (`Page` in English, `页面` in Simplified Chinese). Translations live in `_locales/en/messages.json` and `_locales/zh_CN/messages.json`. No translation library, additional permissions, background task or network fetch is required. New UI text needs an entry in each catalog; tests check coverage and placeholders.

## Install or update

1. Clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository's root directory.
4. When updating an existing installation, click its **Reload** button and refresh existing website tabs.

Chrome/Chromium 109 or later is required. Development dependencies are only needed to run tests.

## Use

Open the popup on a website and choose **Hide logo & tab icon**, or change individual switches:

| Control | Effect |
| --- | --- |
| Page branding | Conceals the site's matching logos, including text inside those logo elements. Layout and link hit targets are retained. |
| Tab icon | Replaces declared tab favicons with a transparent image. Handles icons added or changed by the site. |
| Tab title | Replaces the title with `Page` / `页面`, following the interface language. Off by default; independent of logo and icon settings. |
| Generic logo rules | Optional header/navigation rules for recognizable logo tokens. Requires Page branding. |

Switching an option off restores the site's latest icon/title, including updates made while hidden. If an icon or title was created only by the extension, it is removed again.

The popup labels each setting as **Global default** or **This website**. **Use global defaults for this website** clears all of that site's overrides. Global defaults live under **More settings**. Changes propagate to other open tabs through storage events, even when the popup is closed.

The status confirms that the content script applied the settings, not that every possible brand mark on a website was detected. Browser-protected pages and tabs needing a refresh are reported as unavailable; global controls remain usable.

## Site coverage

| Adapter | Domain scope | Targeted elements |
| --- | --- | --- |
| YouTube | `youtube.com` and subdomains | Desktop masthead, mobile home logo and Music navigation logo |
| Google Search | `google.com`, `www.google.com`, `encrypted.google.com` | Main/search header logo and known Doodle containers |
| Gmail | `mail.google.com` and subdomains | Gmail header logo; does not inherit Search rules |
| X / Twitter | `x.com`, `twitter.com` and subdomains | Branded home link and known startup logo elements |

Other websites can use tab icon/title controls and opt into generic logo rules. Generic rules are off by default, including on supported sites. They use whole logo tokens in headers/navigation; they do not hide every navigation image/SVG or accidentally match `logout`.

Settings use exact hostnames after removing a leading `www.` and trailing dot. For example, `m.youtube.com` has its own preferences even though it shares the YouTube adapter. Google regional domains and other Google products are not implicitly treated as Search.

## How it works

```text
shared/sites.js        Domain normalization and adapter selection
shared/settings.js     Defaults, overrides, legacy compatibility and storage events
controllers/favicon.js Reversible favicon masking
controllers/title.js   Reversible title masking
content.js             Page lifecycle, settings application and status messages
styles/                Declarative CSS, gated by the page's current settings
popup.html/js/css       Settings UI and confirmed application status
```

CSS is injected by the browser at `document_start`; settings toggle attributes on the document root. There is no asynchronous CSS fetch. New matching DOM elements are automatically styled, including after SPA navigation. A small structure observer handles late/replaced document roots and heads. Metadata observation is scoped to `<head>` and disconnected when both icon and title masking are off; extension-authored changes do not feed back into the observer.

Settings still load asynchronously, so this reduces startup delay but **does not guarantee zero first-frame exposure**. Site changes, embedded frames, shadow roots, browser-managed tab UI and branding outside the listed selectors may need additional support. The extension does not alter the address bar, page content or browsing history.

## Existing settings and storage

Version 2 global keys (`hideLogos`, `maskTab`) and `siteSettings[hostname]` overrides remain readable. New features default to off. Version 3 stores each edited per-site field in its own `hideLogos.v3.site.<hostname>.<field>` key so unrelated writes from different tabs do not overwrite one another. A `null` field explicitly inherits its global default and supersedes any legacy value. Reset writes all four null fields together. Legacy data is retained; migration is lazy and non-destructive.

Preferences use `chrome.storage.sync`, so they may sync with your browser account. There are no analytics, external rule downloads or extension-owned network requests. No extra permissions were added: only `storage` and `activeTab` are requested, with content scripts on HTTP(S) pages. Styles no longer need to be web-accessible resources.

Sync storage has quotas (including 512 items and 8 KB per item), so this format is intended for a modest number of customized sites. Save failures are shown in the popup and roll back the displayed switch state. See the [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Development and tests

Use Node.js 22.22.2+, 24.15+ or 26+ (the versions supported by the test dependencies).

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

- Unit/integration tests cover legacy settings, concurrent writes, restoration, early/replaced heads, stale reads, fast toggles, metadata changes, error handling and popup state.
- Browser tests load the actual unpacked extension into an isolated Chromium profile. Local fixtures served at the supported origins test real CSS, strict CSP, storage events, multiple tabs, SPA changes, reloads and popup interaction.
- Popup screenshots are written to `artifacts/` in light and dark themes. Browser fixtures do not replace checking current live websites, especially authenticated Gmail and X views.
- Both language catalogs are also tested through Chrome's native API in temporary single-locale copies. This verifies translated UI, placeholders, manifest metadata and title restoration without changing the developer's browser/OS language. macOS does not select native extension catalogs via Playwright's emulated page locale.

To add a site, register its domain in `shared/sites.js`, add a stylesheet gated by `html[data-hide-logos-site="your-id"][data-hide-logos="true"]`, include it in `manifest.json`, and add a browser fixture that checks both hidden branding and unaffected navigation. Prefer stable, specific selectors and preserve page layout.

## License

[MIT](LICENSE)
