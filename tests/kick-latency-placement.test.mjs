import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../js/kickPlayerEnhancer.js", import.meta.url), "utf8");

function createMockElement(tagName = "div", props = {}) {
  const children = [];
  const classList = new Set();
  const attributes = new Map();
  const { className: initialClassName, ...restProps } = props;
  if (initialClassName) {
    initialClassName.split(/\s+/).filter(Boolean).forEach((c) => classList.add(c));
  }
  const element = {
    tagName: tagName.toUpperCase(),
    nodeType: 1,
    children,
    style: {},
    isConnected: true,
    parentElement: null,
    nextElementSibling: null,
    textContent: "",
    addEventListener: () => {},
    removeEventListener: () => {},
    ...restProps,
    get className() {
      return Array.from(classList).join(" ");
    },
    set className(val) {
      classList.clear();
      if (val) val.split(/\s+/).filter(Boolean).forEach((c) => classList.add(c));
    },
    classList: {
      add: (...cls) => cls.forEach((c) => classList.add(c)),
      remove: (...cls) => cls.forEach((c) => classList.delete(c)),
      contains: (c) => classList.has(c),
      toggle: (c, val) => {
        const next = typeof val === "boolean" ? val : !classList.has(c);
        if (next) classList.add(c); else classList.delete(c);
        return next;
      },
    },
    getAttribute: (attr) => attributes.get(attr) || null,
    setAttribute: (attr, val) => attributes.set(attr, String(val)),
    hasAttribute: (attr) => attributes.has(attr),
    removeAttribute: (attr) => attributes.delete(attr),
    contains: (child) => {
      let curr = child;
      while (curr) {
        if (curr === element) return true;
        curr = curr.parentElement;
      }
      return false;
    },
    appendChild: (child) => {
      if (child.parentElement) {
        const idx = child.parentElement.children.indexOf(child);
        if (idx !== -1) child.parentElement.children.splice(idx, 1);
      }
      child.parentElement = element;
      children.push(child);
      return child;
    },
    append: (...items) => {
      for (const item of items) element.appendChild(item);
    },
    remove: () => {
      if (element.parentElement) {
        const idx = element.parentElement.children.indexOf(element);
        if (idx !== -1) element.parentElement.children.splice(idx, 1);
        element.parentElement = null;
      }
      element.isConnected = false;
    },
    insertBefore: (newChild, refChild) => {
      if (newChild.parentElement) {
        const idx = newChild.parentElement.children.indexOf(newChild);
        if (idx !== -1) newChild.parentElement.children.splice(idx, 1);
      }
      newChild.parentElement = element;
      const refIdx = children.indexOf(refChild);
      if (refIdx === -1) children.push(newChild);
      else children.splice(refIdx, 0, newChild);
      newChild.nextElementSibling = refChild;
      return newChild;
    },
    insertAdjacentElement: (position, el) => {
      if (position === "beforebegin" && element.parentElement) {
        element.parentElement.insertBefore(el, element);
      } else if (position === "afterend" && element.parentElement) {
        const idx = element.parentElement.children.indexOf(element);
        if (idx !== -1) {
          element.parentElement.children.splice(idx + 1, 0, el);
          el.parentElement = element.parentElement;
        }
      }
      return el;
    },
    getBoundingClientRect: () => ({ left: 800, width: 100, top: 10, height: 20 }),
    closest: (selector) => {
      if (selector.includes(".flex.items-center") && classList.has("flex") && classList.has("items-center")) return element;
      if (element.parentElement) return element.parentElement.closest(selector);
      return null;
    },
    querySelector: (selector) => {
      const all = element.querySelectorAll(selector);
      return all.length ? all[0] : null;
    },
    querySelectorAll: (selector) => {
      const results = [];
      function match(node) {
        if (!node || node.nodeType !== 1) return;
        let isMatch = false;
        if (selector === "video" && node.tagName === "VIDEO") isMatch = true;
        else if (selector.includes(".z-controls") && node.classList.contains("z-controls")) isMatch = true;
        else if (selector.includes(".text-surface-fg-subtle") && node.classList.contains("text-surface-fg-subtle")) isMatch = true;
        else if (selector.includes(".flex.items-center") && node.classList.contains("flex") && node.classList.contains("items-center")) isMatch = true;
        else if (selector.startsWith(".") && node.classList.contains(selector.slice(1))) isMatch = true;
        else if (selector.includes("data-testid") && node.getAttribute("data-testid") === "follow-button") isMatch = true;
        else if (selector.includes("a[href^=\"/category/\"]") && node.tagName === "A" && (node.getAttribute("href") || "").startsWith("/category/")) isMatch = true;
        if (isMatch) results.push(node);
        for (const child of node.children) match(child);
      }
      for (const child of element.children) match(child);
      return results;
    },
  };
  return element;
}

function runEnhancer(document, preferences = {}) {
  const chrome = {
    runtime: { id: "test-id" },
    storage: {
      local: {
        get: (keys, cb) => cb({ betaGeneralPreferences: preferences }),
      },
      onChanged: {
        addListener: () => {},
      },
    },
  };
  const win = {
    top: null,
    document,
    chrome,
    innerWidth: 1200,
    __SP_I18N__: {
      get: (lang, key, params) => key + (params?.value ? `:${params.value}` : ""),
      resolve: (l) => l || "en",
    },
    getComputedStyle: () => ({ position: "static" }),
  };
  win.top = win;
  win.window = win;

  const fn = new Function("window", "document", "chrome", "setInterval", "clearInterval", SOURCE);
  fn(win, document, chrome, () => 1, () => {});
}

test("latence Kick : placement 'viewers' s'ancre sous le lecteur et n'utilise JAMAIS is-on-player", () => {
  const head = createMockElement("head");
  const body = createMockElement("body");
  const main = createMockElement("main");
  const videoParent = createMockElement("div", { className: "video-wrapper" });
  const video = createMockElement("video");
  video.buffered = { length: 1, end: () => 10 };
  video.currentTime = 9;
  video.duration = Infinity;
  videoParent.appendChild(video);

  const viewerContainer = createMockElement("div");
  viewerContainer.classList.add("flex");
  viewerContainer.classList.add("items-center");
  const viewerSpan = createMockElement("span");
  viewerSpan.classList.add("text-surface-fg-subtle");
  viewerSpan.textContent = "392 spectateurs";
  viewerContainer.appendChild(viewerSpan);

  main.appendChild(videoParent);
  main.appendChild(viewerContainer);
  body.appendChild(main);

  const document = {
    head,
    body,
    headElements: [],
    getElementById: (id) => {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) {
          const res = find(child);
          if (res) return res;
        }
        return null;
      }
      return find(body) || find(head);
    },
    createElement: (tag) => createMockElement(tag),
    querySelector: (selector) => {
      if (selector === "video") return video;
      return body.querySelector(selector);
    },
    querySelectorAll: (sel) => body.querySelectorAll(sel),
  };
  head.appendChild = (el) => head.children.push(el);

  runEnhancer(document, { latencyPlacement: "viewers" });

  const btn = document.getElementById("streampulse-kick-latency");
  assert.ok(btn, "Le bouton de latence doit être créé");
  assert.equal(btn.classList.contains("is-on-player"), false, "Ne doit JAMAIS avoir is-on-player");
  assert.equal(btn.classList.contains("is-metadata"), true, "Doit avoir is-metadata sous le lecteur");
  assert.equal(videoParent.contains(btn), false, "Ne doit PAS être injecté dans le conteneur vidéo");
  assert.equal(btn.parentElement, main, "Doit être placé dans la section métadonnées (main)");

  const valEl = btn.querySelector(".streampulse-latency-value");
  const lblEl = btn.querySelector(".streampulse-latency-label");
  assert.ok(valEl, "Doit contenir le conteneur de la valeur (chiffre)");
  assert.ok(lblEl, "Doit contenir le conteneur du libellé");
  assert.match(valEl.textContent, /^1\.00/, "La valeur numérique doit être affichée");
  assert.match(lblEl.textContent, /latency|latence/i, "Le libellé doit être présent");
});

test("latence Kick : repli sur les contrôles du lecteur (.z-controls) si métadonnées absentes (ex: plein écran)", () => {
  const head = createMockElement("head");
  const body = createMockElement("body");
  const main = createMockElement("main");
  const videoParent = createMockElement("div", { className: "video-wrapper" });
  const video = createMockElement("video");
  video.buffered = { length: 1, end: () => 10 };
  video.currentTime = 9;
  video.duration = Infinity;
  videoParent.appendChild(video);

  const controlsBar = createMockElement("div");
  controlsBar.classList.add("z-controls");
  const leftGroup = createMockElement("div");
  leftGroup.classList.add("flex");
  leftGroup.classList.add("items-center");
  controlsBar.appendChild(leftGroup);
  videoParent.appendChild(controlsBar);

  main.appendChild(videoParent);
  body.appendChild(main);

  const document = {
    head,
    body,
    getElementById: (id) => {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) {
          const res = find(child);
          if (res) return res;
        }
        return null;
      }
      return find(body) || find(head);
    },
    createElement: (tag) => createMockElement(tag),
    querySelector: (selector) => {
      if (selector === "video") return video;
      return body.querySelector(selector);
    },
    querySelectorAll: (sel) => body.querySelectorAll(sel),
  };
  head.appendChild = (el) => head.children.push(el);

  runEnhancer(document, { latencyPlacement: "viewers" });

  const btn = document.getElementById("streampulse-kick-latency");
  assert.ok(btn, "Le bouton doit exister");
  assert.equal(btn.classList.contains("is-on-player"), false, "Ne doit pas être is-on-player");
  assert.equal(btn.classList.contains("is-in-controls"), true, "Doit avoir is-in-controls en repli");
  assert.equal(leftGroup.contains(btn), true, "Doit être dans le groupe de contrôles gauche");
});

test("latence Kick : placement 'chat' s'insère dans l'en-tête du tchat", () => {
  const head = createMockElement("head");
  const body = createMockElement("body");
  const video = createMockElement("video");
  video.buffered = { length: 1, end: () => 10 };
  video.currentTime = 9;
  video.duration = Infinity;

  const chatHeader = createMockElement("div");
  const chatTitle = createMockElement("span", { textContent: "Chat" });
  chatHeader.appendChild(chatTitle);
  body.appendChild(chatHeader);

  const document = {
    head,
    body,
    getElementById: (id) => {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) {
          const res = find(child);
          if (res) return res;
        }
        return null;
      }
      return find(body) || find(head);
    },
    createElement: (tag) => createMockElement(tag),
    querySelector: (selector) => {
      if (selector === "video") return video;
      return body.querySelector(selector);
    },
    querySelectorAll: (selector) => {
      if (selector === "body *") return [chatHeader, chatTitle];
      return body.querySelectorAll(selector);
    },
  };
  head.appendChild = (el) => head.children.push(el);

  runEnhancer(document, { latencyPlacement: "chat" });

  const btn = document.getElementById("streampulse-kick-latency");
  assert.ok(btn, "Le bouton de latence doit être créé dans le chat");
  assert.equal(btn.classList.contains("is-chat"), true, "Doit avoir la classe is-chat");
  assert.equal(btn.classList.contains("is-on-player"), false, "Ne doit pas être sur la vidéo");
  assert.equal(chatTitle.style.display, "none", "Le titre natif Chat doit être masqué");
});
