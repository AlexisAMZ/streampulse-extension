import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

// The settings bridge (js/inject/adblock-bridge.js) mirrors the `adblockEnabled`
// preference into the page-localStorage kill-switch the MAIN-world blocker reads.
// We load it without `chrome` present (so it short-circuits after exposing the
// pure helper) and unit-test that mapping.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = readFileSync(resolve(ROOT, "js/inject/adblock-bridge.js"), "utf8");

function loadBridge() {
  const sandbox = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    // no `chrome` global → the bridge returns early after exposing the helper
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "adblock-bridge.js" });
  return sandbox.__SP_ADBLOCK_BRIDGE__;
}

describe("adblock-bridge.disabledFlagFor", () => {
  it("exposes the pure helper", () => {
    const bridge = loadBridge();
    expect(bridge).toBeTruthy();
    expect(typeof bridge.disabledFlagFor).toBe("function");
  });

  it("maps an explicit disable to the kill-switch '1'", () => {
    const { disabledFlagFor } = loadBridge();
    expect(disabledFlagFor({ adblockEnabled: false })).toBe("1");
  });

  it("keeps the blocker on ('0') when enabled or unset", () => {
    const { disabledFlagFor } = loadBridge();
    expect(disabledFlagFor({ adblockEnabled: true })).toBe("0");
    expect(disabledFlagFor({})).toBe("0");
    expect(disabledFlagFor(null)).toBe("0");
    expect(disabledFlagFor(undefined)).toBe("0");
  });
});

describe("adblock-bridge.shouldCount (ad-break debounce)", () => {
  const COOLDOWN = 45000;

  it("counts the first ad signal (no prior break)", () => {
    const { shouldCount } = loadBridge();
    expect(shouldCount(1_000_000, 0, COOLDOWN)).toBe(true);
  });

  it("collapses rapid repeats within the cooldown into one break", () => {
    const { shouldCount } = loadBridge();
    const last = 1_000_000;
    expect(shouldCount(last + 1000, last, COOLDOWN)).toBe(false);
    expect(shouldCount(last + 44_999, last, COOLDOWN)).toBe(false);
  });

  it("counts a new break once the cooldown has elapsed", () => {
    const { shouldCount } = loadBridge();
    const last = 1_000_000;
    expect(shouldCount(last + COOLDOWN, last, COOLDOWN)).toBe(true);
    expect(shouldCount(last + 90_000, last, COOLDOWN)).toBe(true);
  });
});
