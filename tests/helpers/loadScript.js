import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Load a StreamPulse content-script-style module inside an isolated VM context.
 *
 * The preview modules are plain (non-ESM) scripts that attach their API to
 * `self.__SP_PREVIEWS__` — exactly how they run as MV3 content scripts. This
 * helper executes one such file and returns the populated registry so the pure
 * logic can be unit-tested against the real shipped file.
 *
 * @param {string} relPath  Path relative to repo root, e.g. "js/previews/sources.js".
 * @param {Record<string, unknown>} [extraGlobals]  Extra globals (e.g. a jsdom `document`).
 * @returns {Record<string, any>} the `__SP_PREVIEWS__` registry populated by the module.
 */
export function loadPreviewModule(relPath, extraGlobals = {}) {
  const code = readFileSync(resolve(ROOT, relPath), "utf8");
  const sandbox = {
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    ...extraGlobals,
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: relPath });
  return sandbox.__SP_PREVIEWS__ || {};
}
