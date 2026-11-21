(() => {
  'use strict';

  const t = key => chrome.i18n.getMessage(key);

  // Anchor a path to the nearest identifiable node, using sibling position only
  // when otherwise identical siblings need disambiguation.
  function selectorFor(target) {
    let tail = '';
    for (let node = target; node; node = node.parentElement) {
      const tag = CSS.escape(node.localName);
      const anchors = [];
      for (const name of ['data-testid', 'aria-label', 'alt']) {
        const value = node.getAttribute(name);
        if (value && value.length <= 120) anchors.push(tag + '[' + name + '="' + CSS.escape(value) + '"]');
      }
      if (node.id) anchors.push('#' + CSS.escape(node.id));
      if (tag === 'a' && node.getAttribute('href') === '/') anchors.push('a[href="/"]');
      const source = node.getAttribute('src');
      if (tag === 'img' && source && source.length <= 180 && !/[:?#]/.test(source)) {
        anchors.push('img[src="' + CSS.escape(source) + '"]');
      }
      const brandClass = [...node.classList].find(name => /logo|brand|wordmark/i.test(name));
      if (brandClass) anchors.push(tag + '.' + CSS.escape(brandClass));
      if (tail && node.matches('body, header, nav')) anchors.push(tag);
      if (tail && node.matches('[role="banner"]')) anchors.push('[role="banner"]');
      for (const anchor of anchors) {
        const selector = anchor + tail;
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1 && matches[0] === target) return selector;
      }
      if (node === document.body || !node.parentElement) break;
      let part = anchors[0] || tag;
      const siblings = [...node.parentElement.children].filter(other => other.localName === node.localName);
      if (!anchors.length && siblings.length === 1) {
        part += ':only-of-type';
      } else if (siblings.some(other => other !== node && other.matches(part))) {
        part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      }
      tail = ' > ' + part + tail;
      if (tail.length > 1200) break;
    }
    return null;
  }

  class LogoPicker {
    constructor(save) {
      this.save = save;
      this.sheet = null;
      this.selectors = [];
      this.cancel = null;
    }

    apply(selectors) {
      if (selectors.length === this.selectors.length && selectors.every((s, i) => s === this.selectors[i])) return;
      const sheets = document.adoptedStyleSheets.filter(sheet => sheet !== this.sheet);
      this.sheet = null;
      if (selectors.length) {
        const sheet = new CSSStyleSheet();
        for (const selector of selectors) {
          // Assign only the selector. The declaration is fixed extension code.
          const index = sheet.insertRule(':not(*) { opacity: 0 !important }');
          sheet.cssRules[index].selectorText = selector;
        }
        sheets.push(sheet);
        this.sheet = sheet;
      }
      document.adoptedStyleSheets = sheets;
      this.selectors = selectors;
    }

    start() {
      this.cancel?.();
      const overlay = document.createElement('div');
      overlay.setAttribute('data-hide-logos-picker', '');
      overlay.tabIndex = -1;
      const frame = document.createElement('div');
      frame.className = 'pick-frame';
      frame.hidden = true;
      const bar = document.createElement('div');
      bar.className = 'pick-bar';
      const hint = document.createElement('span');
      hint.setAttribute('role', 'status');
      hint.textContent = t('pickHint');
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = t('pickCancel');
      bar.append(hint, cancelButton);
      overlay.append(frame, bar);
      const previousFocus = document.activeElement;
      document.documentElement.append(overlay);
      overlay.focus({ preventScroll: true });

      const listeners = new AbortController();
      let saving = false;
      const cancel = () => {
        listeners.abort();
        overlay.remove();
        this.cancel = null;
        if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
      };
      this.cancel = cancel;
      window.addEventListener('pagehide', cancel, { signal: listeners.signal });
      window.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!saving) cancel();
        }
      }, { capture: true, signal: listeners.signal });
      cancelButton.addEventListener('click', event => {
        event.stopPropagation();
        cancel();
      });

      function targetAt(event) {
        const hit = document.elementsFromPoint(event.clientX, event.clientY)
          .find(element => !overlay.contains(element));
        if (!hit || hit.shadowRoot || hit.matches('html, body, main, header, footer, nav, aside, form, iframe, input, textarea, select')) return null;
        return hit.closest('svg') || hit;
      }

      overlay.addEventListener('pointermove', event => {
        const target = bar.contains(event.target) ? null : targetAt(event);
        frame.hidden = !target;
        if (!target) return;
        const box = target.getBoundingClientRect();
        Object.assign(frame.style, {
          top: box.top + 'px', left: box.left + 'px', width: box.width + 'px', height: box.height + 'px'
        });
      });
      overlay.addEventListener('click', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.isTrusted || saving || bar.contains(event.target)) return;
        const target = targetAt(event);
        const selector = target && selectorFor(target);
        if (!selector) {
          hint.textContent = t('pickDifferent');
          return;
        }
        saving = true;
        cancelButton.disabled = true;
        try {
          await this.save(selector);
          if (this.cancel === cancel) cancel();
        } catch {
          hint.textContent = t('pickSaveError');
        } finally {
          saving = false;
          cancelButton.disabled = false;
        }
      });
    }
  }

  globalThis.HideLogos = { ...globalThis.HideLogos, LogoPicker };
})();
