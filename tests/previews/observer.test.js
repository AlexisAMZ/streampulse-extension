// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { loadPreviewModule } from "../helpers/loadScript.js";

let attachDelegation;
beforeAll(() => {
  attachDelegation = loadPreviewModule("js/previews/observer.js", {
    document,
    window,
    setTimeout,
    clearTimeout,
    MutationObserver,
  }).observe.attachDelegation;
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setup() {
  document.body.innerHTML = '<div id="root"><a id="card" href="/ninja"><span id="inner">x</span></a></div>';
  const root = document.getElementById("root");
  const anchor = document.getElementById("card");
  const inner = document.getElementById("inner");
  const findAnchor = (t) => (t && t.closest ? t.closest("a") : null);
  const calls = { enter: [], leave: [] };
  const detach = attachDelegation(
    root,
    { findAnchor, onEnter: (a) => calls.enter.push(a), onLeave: (a) => calls.leave.push(a) },
    { showDelayMs: 10, hideDelayMs: 10 }
  );
  return { root, anchor, inner, calls, detach };
}

function fire(node, type, relatedTarget) {
  node.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget }));
}

describe("attachDelegation", () => {
  it("fires onEnter after the show delay when hovering an anchor", async () => {
    const { inner, anchor, calls, detach } = setup();
    fire(inner, "mouseover");
    expect(calls.enter.length).toBe(0); // not yet — hover intent
    await wait(25);
    expect(calls.enter).toEqual([anchor]);
    detach();
  });

  it("cancels onEnter if the pointer leaves before the show delay", async () => {
    const { inner, anchor, calls, detach } = setup();
    fire(inner, "mouseover");
    fire(anchor, "mouseout", document.body); // leave to outside before delay
    await wait(25);
    expect(calls.enter.length).toBe(0);
    detach();
  });

  it("fires onLeave after the hide delay when leaving the anchor", async () => {
    const { inner, anchor, calls, detach } = setup();
    fire(inner, "mouseover");
    await wait(25);
    fire(anchor, "mouseout", document.body);
    await wait(25);
    expect(calls.leave).toEqual([anchor]);
    detach();
  });

  it("does not leave when moving within the anchor", async () => {
    const { inner, anchor, calls, detach } = setup();
    fire(inner, "mouseover");
    await wait(25);
    fire(inner, "mouseout", anchor); // relatedTarget still inside anchor
    await wait(25);
    expect(calls.leave.length).toBe(0);
    detach();
  });
});
