import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

// The top-bar content script (js/inject/topbar.js) exposes its pure helpers on
// __SP_TOPBAR_API__ before any DOM/chrome access, then bails out of the browser
// injection when document/chrome are absent — so we can unit-test the helpers.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = readFileSync(resolve(ROOT, "js/inject/topbar.js"), "utf8");

function loadTopbar() {
  const sandbox = { console };
  sandbox.self = sandbox;
  sandbox.window = sandbox; // window present, but no document/chrome → injection skipped
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "topbar.js" });
  return sandbox.__SP_TOPBAR_API__;
}

describe("topbar.fmtDur", () => {
  it("formats durations as Xh / XhMM / Xmin", () => {
    const { fmtDur } = loadTopbar();
    expect(fmtDur(0)).toBe("0min");
    expect(fmtDur(90)).toBe("1min");
    expect(fmtDur(3600)).toBe("1h");
    expect(fmtDur(3660)).toBe("1h01");
    expect(fmtDur(9000)).toBe("2h30");
  });
});

describe("topbar.currentMonthWatch", () => {
  it("sums watchSeconds for the current month only", () => {
    const { currentMonthWatch } = loadTopbar();
    const now = new Date(2026, 5, 1); // June 2026 → "2026-06"
    const data = {
      "2026-06": { a: { watchSeconds: 100 }, b: { watchSeconds: 250 } },
      "2026-05": { c: { watchSeconds: 9999 } },
    };
    expect(currentMonthWatch(data, now)).toBe(350);
  });

  it("returns 0 for empty or missing data", () => {
    const { currentMonthWatch } = loadTopbar();
    const now = new Date(2026, 5, 1);
    expect(currentMonthWatch({}, now)).toBe(0);
    expect(currentMonthWatch(null, now)).toBe(0);
  });
});

describe("topbar.langKey", () => {
  it("keeps supported languages and falls back to en", () => {
    const { langKey } = loadTopbar();
    expect(langKey("fr")).toBe("fr");
    expect(langKey("es")).toBe("es");
    expect(langKey("pt")).toBe("pt");
    expect(langKey("de")).toBe("en");
    expect(langKey(undefined)).toBe("en");
  });
});

describe("topbar.fmtNum", () => {
  it("formats numbers and tolerates junk", () => {
    const { fmtNum } = loadTopbar();
    expect(fmtNum(0)).toBe("0");
    expect(typeof fmtNum(1247)).toBe("string");
    expect(fmtNum(null)).toBe("0");
  });
});
