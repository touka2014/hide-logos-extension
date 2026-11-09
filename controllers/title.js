(() => {
  'use strict';

  class TitleController {
    constructor(document) {
      this.document = document;
      this.originals = new Map();
      this.replacement = chrome.i18n.getMessage('maskedTitle');
    }

    restoreTitle(title, saved) {
      if (title.textContent !== this.replacement) return;
      if (saved.owned) title.remove();
      else title.textContent = saved.text;
    }

    apply() {
      const head = this.document.head;
      for (const [title, saved] of this.originals) {
        if (!head?.contains(title)) {
          this.restoreTitle(title, saved);
          this.originals.delete(title);
        }
      }
      if (!head) return;
      let titles = [...head.querySelectorAll('title')];
      if (!titles.length) {
        const title = this.document.createElement('title');
        title.textContent = this.replacement;
        head.appendChild(title);
        this.originals.set(title, { text: '', owned: true });
        titles = [title];
      }
      for (const title of titles) {
        if (!this.originals.has(title) || title.textContent !== this.replacement) {
          this.originals.set(title, { text: title.textContent, owned: false });
        }
        if (title.textContent !== this.replacement) title.textContent = this.replacement;
      }
    }

    restore() {
      for (const [title, saved] of this.originals) this.restoreTitle(title, saved);
      this.originals.clear();
    }
  }

  globalThis.HideLogos = { ...globalThis.HideLogos, TitleController };
})();
