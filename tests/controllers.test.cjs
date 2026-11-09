const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makePage } = require('./helpers.cjs');

function setup(t, options) {
  const page = makePage(options); t.after(() => page.window.close());
  return page;
}

test('favicon hiding is reversible, including relative URL, type and size attributes', t => {
  const { api, document } = setup(t);
  const icon = document.querySelector('link');
  const controller = new api.FaviconController(document);
  controller.apply();
  assert.equal(icon.href, api.transparentIcon);
  assert.equal(icon.type, 'image/png');
  assert.equal(icon.hasAttribute('sizes'), false);
  controller.restore();
  assert.equal(icon.getAttribute('href'), '/original.ico');
  assert.equal(icon.type, 'image/x-icon');
  assert.equal(icon.getAttribute('sizes'), '32x32');
});

test('favicon changes during masking restore the latest website icon', t => {
  const { api, document } = setup(t);
  const controller = new api.FaviconController(document);
  const icon = document.querySelector('link');
  controller.apply();
  icon.href = '/unread.svg'; icon.type = 'image/svg+xml'; icon.setAttribute('sizes', 'any');
  controller.apply();
  assert.equal(icon.href, api.transparentIcon);
  controller.restore();
  assert.equal(icon.getAttribute('href'), '/unread.svg');
  assert.equal(icon.type, 'image/svg+xml');
  assert.equal(icon.getAttribute('sizes'), 'any');
});

test('restoring before an observer pass does not overwrite newer page values', t => {
  const { api, document } = setup(t);
  const controller = new api.FaviconController(document);
  controller.apply();
  document.querySelector('link').href = '/latest.ico';
  controller.restore();
  assert.equal(document.querySelector('link').getAttribute('href'), '/latest.ico');
});

test('fallback icon is removed and newly inserted real icons are restored', t => {
  const { api, document } = setup(t, { html: '<html><head></head><body></body></html>' });
  const controller = new api.FaviconController(document);
  controller.apply();
  assert.equal(document.querySelectorAll('link').length, 1);
  const link = document.createElement('link'); link.rel = 'shortcut icon'; link.href = '/new.ico';
  document.head.append(link); controller.apply();
  assert.equal(link.href, api.transparentIcon);
  controller.restore();
  assert.equal(document.querySelectorAll('link').length, 1);
  assert.equal(link.getAttribute('href'), '/new.ico');
});

test('unrelated links and apple touch icons are untouched; removed icons are released', t => {
  const { api, document } = setup(t);
  const touch = document.createElement('link'); touch.rel = 'apple-touch-icon'; touch.href = '/touch.png'; document.head.append(touch);
  const controller = new api.FaviconController(document);
  controller.apply();
  assert.equal(touch.getAttribute('href'), '/touch.png');
  const icon = document.querySelector('link'); icon.remove(); controller.apply();
  assert.equal(icon.getAttribute('href'), '/original.ico');
  assert.equal(controller.originals.has(icon), false);
});

test('titles follow website changes and restore their latest value', t => {
  const { api, document } = setup(t);
  const controller = new api.TitleController(document);
  controller.apply(); assert.equal(document.title, 'Page');
  document.title = '(2) New message - Gmail';
  controller.apply(); assert.equal(document.title, 'Page');
  controller.restore(); assert.equal(document.title, '(2) New message - Gmail');
});

test('an injected title is removed, but site-written content is kept', t => {
  const { api, document } = setup(t, { html: '<html><head></head><body></body></html>' });
  const controller = new api.TitleController(document);
  controller.apply(); controller.restore();
  assert.equal(document.querySelector('title'), null);
  controller.apply(); document.title = 'New page title'; controller.apply(); controller.restore();
  assert.equal(document.title, 'New page title');
});
