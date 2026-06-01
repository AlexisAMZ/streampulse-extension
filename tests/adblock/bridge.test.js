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
