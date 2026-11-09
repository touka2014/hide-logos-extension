(() => {
  'use strict';

  const transparentIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  const selector = 'link[rel~="icon" i]';
  const masked = { href: transparentIcon, type: 'image/png', sizes: null };

  function writeAttribute(element, name, value) {
    if (element.getAttribute(name) === value) return;
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  class FaviconController {
    constructor(document) {
      this.document = document;
      this.originals = new Map();
    }

    restoreLink(link, saved) {
      // If the site changed a value since our last pass, preserve its newer value.
      const changed = Object.entries(masked).some(([name, value]) => link.getAttribute(name) !== value);
      if (saved.owned && !changed) {
        link.remove();
        return;
      }
      for (const [name, value] of Object.entries(masked)) {
        if (link.getAttribute(name) === value) writeAttribute(link, name, saved.attributes[name]);
      }
    }

    apply() {
      const head = this.document.head;
      for (const [link, saved] of this.originals) {
        if (!head?.contains(link) || !link.matches(selector)) {
          this.restoreLink(link, saved);
          this.originals.delete(link);
        }
      }
      if (!head) return;

      let links = [...head.querySelectorAll(selector)];
      if (!links.length) {
        const link = this.document.createElement('link');
        link.rel = 'icon';
        for (const [name, value] of Object.entries(masked)) writeAttribute(link, name, value);
        head.appendChild(link);
        this.originals.set(link, { owned: true, attributes: { href: null, type: null, sizes: null } });
        links = [link];
      }

      for (const link of links) {
        let saved = this.originals.get(link);
        if (!saved) {
          saved = { owned: false, attributes: Object.fromEntries(
            Object.keys(masked).map(name => [name, link.getAttribute(name)])
          ) };
          this.originals.set(link, saved);
        } else {
          for (const [name, value] of Object.entries(masked)) {
            if (link.getAttribute(name) !== value) {
              saved.attributes[name] = link.getAttribute(name);
              saved.owned = false;
            }
          }
        }
        for (const [name, value] of Object.entries(masked)) writeAttribute(link, name, value);
      }
    }

    restore() {
      for (const [link, saved] of this.originals) this.restoreLink(link, saved);
      this.originals.clear();
    }
  }

  globalThis.HideLogos = { ...globalThis.HideLogos, FaviconController, transparentIcon };
})();
