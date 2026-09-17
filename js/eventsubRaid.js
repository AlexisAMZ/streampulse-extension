// Detecteur de raids entrants via Twitch EventSub (transport WebSocket).
//
// POURQUOI : le watcher IRC (js/raidWatcher.js) n'entend le raid qu'AU MOMENT
// ou il arrive — l'USERNOTICE `raid` n'est emis dans le chat de la cible qu'a
// la fin du compte a rebours. EventSub `channel.raid`, lui, part a l'INSTANT
// ou le raid est lance : ~90 secondes d'avance, le temps de rejoindre le
// stream partant pour toucher les points.
//
// Pre-requis : un jeton d'application Twitch. Il est fabrique par streampulse.fr
// (client_credentials, le secret ne quitte jamais le serveur) et hydrate dans
// CONFIG.accessToken par fetchRemoteConfig() — le meme que pour l'API Helix.
//
// Cout : un WebSocket (keepalive serveur toutes les ~10 s, ce qui maintient
// aussi le service worker MV3 eveille), 1 abonnement `channel.raid` par
// chaine suivie, supprimes par Twitch a la deconnexion de la session.
//
// L'IRC reste le repli si l'endpoint de config ne fournit pas de jeton.

const WS_URL = "wss://eventsub.wss.twitch.tv/ws";
const USERS_URL = "https://api.twitch.tv/helix/users";
const SUBS_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";
const IDS_CACHE_KEY = "streampulse:eventsubIds";
const MAX_WATCHED_CHANNELS = 90;
const WELCOME_TIMEOUT_MS = 12_000;
const SUBSCRIBE_INTERVAL_MS = 400;
const RECONNECT_MIN_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
// Un meme raid peut generer plusieurs evenements : une notification max par
// chaine ciblee et par fenetre de 10 minutes (le dedup s'applique a la cible).
const DEDUP_WINDOW_MS = 10 * 60_000;

let notifyRaid = null;
let getHeaders = null; // () => { "Client-ID", Authorization } — fourni par background
let socket = null;
let sessionId = null;
let reconnectTimer = null;
let reconnectDelayMs = RECONNECT_MIN_MS;
let wantedLogins = new Set();
let loginToId = new Map();
let subscribedIds = new Set();
let subscribeQueue = [];
let drainingQueue = false;
let lastNotifiedAt = new Map();

export function eventSubActive() {
  return Boolean(socket && sessionId);
}

export function stopEventSubRaid() {
  wantedLogins = new Set();
  sessionId = null;
  subscribedIds = new Set();
  subscribeQueue = [];
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    try {
      socket.close();
    } catch (_) {
      // Socket deja fermee.
    }
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  lastNotifiedAt = new Map();
}

/**
 * Demarre (ou resynchronise) le watcher EventSub.
 * @param {(raid: {channel: string, raider: string, viewers: number}) => void} notify
 * @param {() => Record<string, string>} headers  têtes Helix (Client-ID + Bearer)
 * @returns {Promise<boolean>} true si le transport est actif (welcome recu).
 */
export async function syncEventSubRaid(notify, headers) {
  notifyRaid = notify || notifyRaid;
  getHeaders = headers || getHeaders;
  if (!getHeaders) return false;

  wantedLogins = await readWantedLogins();
  if (wantedLogins.size === 0) {
    stopEventSubRaid();
    return false;
  }

  const resolved = await resolveUserIds();
  if (resolved === 0) return false;

  if (socket && sessionId) {
    // Deja connecte : souscrire seulement les nouvelles chaines.
    queueSubscriptions();
    return true;
  }

  const welcomed = await connect();
  return welcomed;
}

async function readWantedLogins() {
  const { betaGeneralStreamers } = await chrome.storage.local.get(
    "betaGeneralStreamers"
  );
  const streamers = Array.isArray(betaGeneralStreamers)
    ? betaGeneralStreamers
    : [];
  return new Set(
    streamers
      .filter((s) => (s.platform || "twitch") === "twitch" && (s.handle || s.twitch))
      .map((s) => String(s.handle || s.twitch).toLowerCase())
      .slice(0, MAX_WATCHED_CHANNELS)
  );
}

/** Resout les user IDs Helix des logins suivis (cache storage d'abord). */
async function resolveUserIds() {
  const { [IDS_CACHE_KEY]: cached } = await chrome.storage.local.get(IDS_CACHE_KEY);
  loginToId = new Map(Object.entries(cached || {}));

  const missing = [...wantedLogins].filter((login) => !loginToId.has(login));
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    const query = batch.map((login) => `login=${encodeURIComponent(login)}`).join("&");
    try {
      const resp = await fetch(`${USERS_URL}?${query}`, { headers: getHeaders() });
      if (!resp.ok) throw new Error(`users ${resp.status}`);
      const json = await resp.json();
      for (const user of json.data || []) {
        if (user.login) loginToId.set(user.login.toLowerCase(), user.id);
      }
    } catch (error) {
      console.warn("EventSub: resolution des user IDs impossible:", error.message);
      return 0;
    }
  }

  if (missing.length > 0) {
    await chrome.storage.local.set({
      [IDS_CACHE_KEY]: Object.fromEntries(loginToId),
    });
  }

  // Ne pas sombrer si un login a disparu de Helix : on garde ceux qui passent.
  let count = 0;
  for (const login of wantedLogins) {
    if (loginToId.has(login)) count += 1;
  }
  return count;
}

/** Ouvre le WebSocket et attend le session_welcome (ou echec). */
function connect() {
  return new Promise((resolve) => {
    if (!("WebSocket" in self)) return resolve(false);
    sessionId = null;
    subscribedIds = new Set();
    subscribeQueue = [];

    try {
      socket = new WebSocket(WS_URL);
    } catch (_) {
      socket = null;
      return resolve(false);
    }

    const timeout = setTimeout(() => {
      if (!sessionId) {
        // Welcome jamais recu : arreter TOUT (socket + reconnexion). Rester
        // en demi-connexion ferait tourner EventSub ET l'IRC en parallele.
        stopEventSubRaid();
        resolve(false);
      }
    }, WELCOME_TIMEOUT_MS);

    socket.onopen = () => {
      reconnectDelayMs = RECONNECT_MIN_MS;
    };

    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data || ""));
      } catch (_) {
        return;
      }
      handleMessage(message);

      if (!sessionId && message?.metadata?.message_type === "session_welcome") {
        sessionId = message.payload?.session?.id || null;
        if (sessionId) {
          queueSubscriptions();
          clearTimeout(timeout);
          resolve(true);
        }
      }
    };

    socket.onclose = () => {
      clearTimeout(timeout);
      const wasActive = Boolean(sessionId);
      sessionId = null;
      subscribedIds = new Set();
      socket = null;
      if (!("WebSocket" in self) || !chrome?.runtime?.id) return resolve(false);
      if (wantedLogins.size > 0) {
        scheduleReconnect();
        if (!wasActive) resolve(false);
      } else if (!wasActive) {
        resolve(false);
      }
    };

    socket.onerror = () => {
      // onclose suit toujours onerror.
    };
  });
}

function handleMessage(message) {
  const type = message?.metadata?.message_type;
  if (type === "notification") {
    handleNotification(message.payload || {});
    return;
  }
  if (type === "session_reconnect") {
    // Reconnexion orchestree par Twitch : une URL dediee est fournie, mais
    // se reconnecter a l'URL standard et resouscrire reste correct.
    try {
      socket?.close();
    } catch (_) {
      // Deja fermee.
    }
  }
}

function handleNotification(payload) {
  if (payload.subscription?.type !== "channel.raid") return;
  const event = payload.event || {};
  const channel = String(event.to_broadcaster_user_login || "").toLowerCase();
  if (!wantedLogins.has(channel)) return;

  const now = Date.now();
  if (now - (lastNotifiedAt.get(channel) || 0) < DEDUP_WINDOW_MS) return;
  lastNotifiedAt.set(channel, now);

  notifyRaid?.({
    channel,
    raider: event.from_broadcaster_user_name || event.from_broadcaster_user_login || "",
    viewers: Number(event.viewer_count) || 0,
  });
}

function queueSubscriptions() {
  subscribedIds = new Set(
    [...subscribedIds].filter((id) => wantedLogins.has(loginOf(id)))
  );
  for (const login of wantedLogins) {
    const id = loginToId.get(login);
    if (id && !subscribedIds.has(id) && !subscribeQueue.some((e) => e.id === id)) {
      subscribeQueue.push({ id, login });
    }
  }
  drainQueue();
}

function loginOf(userId) {
  for (const [login, id] of loginToId) {
    if (id === userId) return login;
  }
  return "";
}

async function drainQueue() {
  if (drainingQueue || !socket || !sessionId) return;
  drainingQueue = true;
  try {
    while (subscribeQueue.length > 0 && socket && sessionId) {
      const entry = subscribeQueue.shift();
      const ok = await createSubscription(entry.id);
      if (ok) {
        subscribedIds.add(entry.id);
      } else {
        // Echec non-429 : on retentera au prochain sync (alarme 1 min).
      }
      await new Promise((r) => setTimeout(r, SUBSCRIBE_INTERVAL_MS));
    }
  } finally {
    drainingQueue = false;
  }
}

async function createSubscription(userId) {
  try {
    const resp = await fetch(SUBS_URL, {
      method: "POST",
      headers: {
        ...getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "channel.raid",
        version: "1",
        condition: { to_broadcaster_user_id: userId },
        transport: { method: "websocket", session_id: sessionId },
      }),
    });
    if (resp.status === 409) {
      // Deja souscrit (etats 409 = doublon) : considere comme fait.
      return true;
    }
    if (resp.status === 429) {
      // Limite de creation : requeue en fin de pile, le rythme repart.
      const retryAfter = Number(resp.headers.get("Retry-After")) || 10;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      subscribeQueue.push({ id: userId });
      return false;
    }
    if (!resp.ok) {
      console.warn("EventSub: abonnement refuse:", resp.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("EventSub: abonnement impossible:", error.message);
    return false;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (wantedLogins.size > 0 && chrome?.runtime?.id) {
      connect();
    }
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
}
