import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const chromeBinary = env.CHROME_BIN || (platform() === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  : "chromium");

// Real HTML, DOM, ES modules and i18n; no extension, account, HTTP server or
// business request. A missing browser fails explicitly rather than skipping.
export async function extensionPage(page, scenario, { stored = {}, search = "", width = 780, height = 600, screenshot } = {}) {
  const source = await readFile(new URL(`../../html/${page}.html`, import.meta.url), "utf8");
  const directory = await mkdtemp(join(tmpdir(), "sp-page-test-"));
  const file = join(directory, `${page}.html`);
  const base = new URL("../../html/", import.meta.url).href;
  const bootstrap = `
    document.documentElement.dataset.testProgress = "bootstrap";
    const stored = ${JSON.stringify(stored)};
    const calls = [];
    const changes = new Set();
    const failures = [];
    const api = {
      stored, calls, changes,
      respond: async (message) => {
        if (message.type === "getStreamers") return {
          streamers: stored.betaGeneralStreamers || [],
          preferences: stored.betaGeneralPreferences || {},
          userProfile: stored.userProfile || null,
        };
        if (message.type === "lookupTwitchUser") return { user: null };
        if (message.type === "updatePreferences") {
          stored.betaGeneralPreferences = { ...stored.betaGeneralPreferences, ...message.updates };
          return { success: true, preferences: stored.betaGeneralPreferences };
        }
        return { success: true };
      },
      write: async () => {},
      change: (items) => {
        Object.assign(stored, items);
        const event = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { newValue }]));
        for (const listener of changes) listener(event, "local");
      },
      tick: () => new Promise((resolve) => setTimeout(resolve, 0)),
      waitFor: async (condition) => {
        for (let i = 0; i < 100; i += 1) {
          if (condition()) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw new Error("Page condition did not become true");
      },
      module: async (name) => {
        document.documentElement.dataset.testProgress = "import " + name;
        const result = await import(new URL("../js/" + name, document.baseURI).href);
        document.documentElement.dataset.testProgress = "loaded " + name;
        return result;
      },
      $: (id) => document.getElementById(id),
    };
    window.addEventListener("error", (event) => failures.push(event.message));
    window.addEventListener("unhandledrejection", (event) => failures.push(String(event.reason)));
    globalThis.fetch = async () => { throw new Error("Unexpected business request"); };
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => calls.push({ type: "clipboard", text }) } });
    globalThis.chrome = {
      runtime: {
        getURL: (path) => new URL("../" + path, document.baseURI).href,
        sendMessage: async (message) => { calls.push(structuredClone(message)); return api.respond(message); },
      },
      i18n: { getUILanguage: () => "en" },
      storage: {
        local: {
          get: async (keys) => {
            calls.push({ type: "storage.get", keys });
            const list = typeof keys === "string" ? [keys] : keys;
            return structuredClone(Object.fromEntries(list.filter((key) => key in stored).map((key) => [key, stored[key]])));
          },
          set: async (items) => { calls.push({ type: "storage.set", items: structuredClone(items) }); await api.write(items); api.change(items); },
        },
        onChanged: { addListener: (listener) => changes.add(listener), removeListener: (listener) => changes.delete(listener) },
      },
      tabs: {
        getCurrent: (callback) => callback({ id: 1 }),
        remove: async (id) => { calls.push({ type: "tabs.remove", id }); },
      },
    };
    window.__pageTest = { api, failures };
  `;
  // Static imports finish before the virtual clock runs. Dynamically loading
  // uncached files while that clock races ahead can end --dump-dom too early.
  const modules = page === "onboarding"
    ? ["js/onboarding.js"]
    : ["js/popup-layout.js", "js/popup-sounds.js", "js/popup-identity.js", "js/popup-points.js", "js/points-data.js", "js/linked-accounts.js", "js/popup-linked-accounts.js", "js/watch-later.js", "js/popup-watch-later.js"];
  const driver = `
    ${["js/i18n.js", "i18n/lang/en.js", "i18n/lang/fr.js", ...modules].map((path) => `import ${JSON.stringify(new URL(`../${path}`, base).href)};`).join("\n")}
    const { api, failures } = window.__pageTest;
    try {
      const result = await (${scenario.toString()})(api);
      await api.tick();
      document.documentElement.dataset.testResult = encodeURIComponent(JSON.stringify({ result, failures }));
    } catch (error) {
      document.documentElement.dataset.testResult = encodeURIComponent(JSON.stringify({ error: error.stack || String(error), failures }));
    }
  `;
  try {
    await writeFile(file, source
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace("<head>", `<head><base href="${base}">`)
      .replace("</body>", `<script>${bootstrap}</script><script type="module">${driver}</script></body>`));
    // Sous forte charge (suite complète en parallèle), Chrome peut vider le
    // DOM avant la fin du budget virtuel : une seule relance, et uniquement
    // quand aucun résultat n'a été écrit — un échec d'assertion n'est jamais rejoué.
    const launch = () => run(chromeBinary, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-extensions", "--disable-background-networking", "--disable-component-update",
      "--disable-sync", "--use-mock-keychain", "--host-resolver-rules=MAP * ~NOTFOUND",
      "--allow-file-access-from-files", "--force-prefers-reduced-motion", `--user-data-dir=${join(directory, "profile")}`,
      `--window-size=${width},${height}`, "--virtual-time-budget=10000", "--dump-dom",
      ...(screenshot ? [`--screenshot=${screenshot}`] : []),
      `${new URL(`file://${file}`).href}${search}`,
    ], { timeout: 30000, maxBuffer: 4 * 1024 * 1024, killSignal: "SIGKILL" });
    let { stdout, stderr } = await launch();
    if (!/data-test-result="/.test(stdout)) ({ stdout, stderr } = await launch());
    const encoded = /data-test-result="([^"]+)"/.exec(stdout)?.[1];
    if (!encoded) throw new Error(`No test result from ${chromeBinary} (${fileURLToPath(new URL(base))}): ${/data-test-progress="([^"]+)"/.exec(stdout)?.[1]}\n${stderr}`);
    const response = JSON.parse(decodeURIComponent(encoded));
    if (response.error || response.failures.length) throw new Error(response.error || response.failures.join("\n"));
    return response.result;
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
