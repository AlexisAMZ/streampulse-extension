// Faux objet `chrome` minimal pour charger le service worker sous Node :
// stockage en mémoire, listeners enregistrés, appels tracés.

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => listeners.splice(listeners.indexOf(fn), 1),
  };
}

function createArea(initial = {}) {
  let data = structuredClone(initial);
  const pick = (keys) => {
    if (keys == null) return structuredClone(data);
    const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, structuredClone(data[key])]));
  };
  return {
    get: async (keys) => pick(keys),
    set: async (items) => {
      data = { ...data, ...structuredClone(items) };
    },
    remove: async (keys) => {
      const list = typeof keys === "string" ? [keys] : keys;
      data = Object.fromEntries(Object.entries(data).filter(([key]) => !list.includes(key)));
    },
    dump: () => structuredClone(data),
  };
}

export function createFakeChrome({ local = {}, id = "test-extension-id" } = {}) {
  const calls = [];
  const track = (name, value) => (...args) => {
    calls.push([name, ...args]);
    const last = args.at(-1);
    if (typeof last === "function") last(value);
    return Promise.resolve(value);
  };
  return {
    calls,
    runtime: {
      id,
      lastError: null,
      getURL: (p = "") => `chrome-extension://${id}/${p}`,
      getManifest: () => ({ version: "0.0.0" }),
      getPlatformInfo: track("runtime.getPlatformInfo", {}),
      sendMessage: track("runtime.sendMessage"),
      OnInstalledReason: { INSTALL: "install", UPDATE: "update" },
      onMessage: createEvent(),
      onInstalled: createEvent(),
      onStartup: createEvent(),
      onSuspend: createEvent(),
    },
    storage: { local: createArea(local), session: createArea(), onChanged: createEvent() },
    alarms: { get: track("alarms.get", undefined), create: track("alarms.create"), clear: track("alarms.clear"), onAlarm: createEvent() },
    tabs: {
      query: track("tabs.query", []),
      create: track("tabs.create", {}),
      update: track("tabs.update", {}),
      reload: track("tabs.reload"),
      sendMessage: track("tabs.sendMessage"),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
    },
    notifications: { create: track("notifications.create", true), clear: track("notifications.clear", true), onClicked: createEvent(), onClosed: createEvent() },
    action: { setBadgeText: track("action.setBadgeText"), setBadgeBackgroundColor: track("action.setBadgeBackgroundColor"), setTitle: track("action.setTitle") },
    cookies: { get: track("cookies.get", null) },
    i18n: { getUILanguage: () => "fr-FR" },
    offscreen: { createDocument: track("offscreen.createDocument") },
    scripting: { executeScript: track("scripting.executeScript", []) },
  };
}
