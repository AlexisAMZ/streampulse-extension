import { describe, it, expect } from "vitest";
import { loadPreviewModule } from "../helpers/loadScript.js";

const { computePosition } = loadPreviewModule("js/previews/card.js");

const CARD = { width: 360, height: 202 };
const VIEWPORT = { width: 1280, height: 800 };

describe("computePosition", () => {
  it("places the card to the right of the anchor, vertically centered, when there is room", () => {
    const anchor = { top: 100, left: 100, right: 300, bottom: 200, width: 200, height: 100 };
    const pos = computePosition(anchor, CARD, VIEWPORT);
    expect(pos.placement).toBe("right");
    expect(pos.left).toBe(308); // anchor.right + gap(8)
    expect(pos.top).toBe(49); // 100 + 50 - 101 (centered on the anchor)
  });

  it("flips to the left of the anchor when the right side would overflow", () => {
    const anchor = { top: 100, left: 1000, right: 1200, bottom: 200, width: 200, height: 100 };
    const pos = computePosition(anchor, CARD, VIEWPORT);
    expect(pos.placement).toBe("left");
    expect(pos.left).toBe(632); // 1000 - 8 - 360
  });

  it("clamps horizontally when neither side fully fits", () => {
    const anchor = { top: 100, left: 10, right: 1270, bottom: 200, width: 1260, height: 100 };
    const pos = computePosition(anchor, CARD, VIEWPORT);
    expect(pos.placement).toBe("clamped");
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + CARD.width + 8).toBeLessThanOrEqual(VIEWPORT.width + 1);
  });

  it("clamps vertically to the top edge", () => {
    const anchor = { top: 0, left: 100, right: 300, bottom: 40, width: 200, height: 40 };
    const pos = computePosition(anchor, CARD, VIEWPORT);
    expect(pos.top).toBe(8); // gap
  });

  it("clamps vertically to the bottom edge", () => {
    const anchor = { top: 780, left: 100, right: 300, bottom: 820, width: 200, height: 40 };
    const pos = computePosition(anchor, CARD, VIEWPORT);
    expect(pos.top).toBe(590); // 800 - 202 - 8
  });

  it("respects a custom gap on the right placement", () => {
    const anchor = { top: 100, left: 100, right: 300, bottom: 200, width: 200, height: 100 };
    const pos = computePosition(anchor, CARD, VIEWPORT, 16);
    expect(pos.left).toBe(316); // anchor.right + gap(16)
  });
});
