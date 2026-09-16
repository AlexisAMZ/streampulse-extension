// Detecteur de raids entrants en arriere-plan (bêta).
//
// Un raid entrant se traduit dans le chat Twitch par un USERNOTICE avec
// msg-id=raid. Ce chat est lisible sans authentification via une connexion
// IRC anonyme ("justinfan") : on rejoint toutes les chaînes Twitch ajoutées
// dans StreamPulse et on écoute ces messages, même quand aucun onglet Twitch
// n'est ouvert.
//
// Coût : un seul WebSocket et un PING toutes les 45 s. Pas de requête HTTP
// en boucle, pas de polling GQL.

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
// Limite prudente pour une connexion IRC anonyme (Twitch tolère ~100 JOIN
// par connexion). En pratique les listes StreamPulse restent bien en dessous.
const MAX_WATCHED_CHANNELS = 90;
// Un PING sortant toutes les 45 s : le PONG reçu compte comme une activité
// WebSocket qui maintient le service worker MV3 éveillé (Chrome 116+).
const PING_INTERVAL_MS = 45_000;
const RECONNECT_MIN_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
// Un même raid peut générer plusieurs USERNOTICE (re-raid, raid recadré) :
// on notifie au plus une fois par chaîne et par fenêtre de 10 minutes.
const DEDUP_WINDOW_MS = 10 * 60_000;

const RAID_ALARM = "raidWatcherHeartbeat";

let notifyRaid = null;
let socket = null;
let pingTimer = null;
let reconnectTimer = null;
let reconnectDelayMs = RECONNECT_MIN_MS;
let wantedChannels = new Set();
let joinedChannels = new Set();
let lastNotifiedAt = new Map();

/**
 * Point d'entrée appelé par background.js au démarrage du service worker,
 * à chaque réveil (alarme) et après chaque changement de préférences.
 *
 * @param {(raid: {channel: string, raider: string, viewers: number}) => void} notify
 */
export async function syncRaidWatcher(notify) {
  notifyRaid = notify || notifyRaid;
  scheduleHeartbeat();
  await refreshTargets();
}

export function stopRaidWatcher() {
  wantedChannels = new Set();
  closeSocket();
}

async function refreshTargets() {
  const { betaGeneralStreamers } = await chrome.storage.local.get(
    "betaGeneralStreamers"
  );

  const streamers = Array.isArray(betaGeneralStreamers)
    ? betaGeneralStreamers
    : [];

  wantedChannels = new Set(
    streamers
      .filter((s) => (s.platform || "twitch") === "twitch" && (s.handle || s.twitch))
      .map((s) => String(s.handle || s.twitch).toLowerCase())
      .slice(0, MAX_WATCHED_CHANNELS)
  );

  if (wantedChannels.size === 0) {
    closeSocket();
    return;
  }

  if (!socket || socket.readyState > 1) {
    connect();
  } else if (socket.readyState === 1) {
    syncJoins();
  }
}

function connect() {
  clearTimers();
  joinedChannels = new Set();

  try {
    socket = new WebSocket(IRC_URL);
  } catch (_) {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectDelayMs = RECONNECT_MIN_MS;
    socket.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`);
    syncJoins();
    pingTimer = setInterval(() => {
      if (socket?.readyState === 1) {
        socket.send("PING streampulse");
      }
    }, PING_INTERVAL_MS);
  };

  socket.onmessage = (event) => {
    handleIrcMessage(String(event.data || ""));
  };

  socket.onclose = () => {
    clearTimers();
    joinedChannels = new Set();
    if (wantedChannels.size > 0) {
      scheduleReconnect();
    }
  };

  socket.onerror = () => {
    // onclose suit toujours onerror : la reconnexion y est gérée.
  };
}

function closeSocket() {
  clearTimers();
  reconnectDelayMs = RECONNECT_MIN_MS;
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch (_) {
      // Socket déjà fermée.
    }
    socket = null;
  }
  joinedChannels = new Set();
}

function clearTimers() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (wantedChannels.size > 0) {
      connect();
    }
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
}

function syncJoins() {
  if (!socket || socket.readyState !== 1) return;
  for (const channel of wantedChannels) {
    if (!joinedChannels.has(channel)) {
      joinedChannels.add(channel);
      socket.send(`JOIN #${channel}`);
    }
  }
  // On ne PART jamais les chaînes retirées des favoris en cours de session :
  // recevoir un raid sur une chaîne encore jointe est inoffensif, et un
  // PART/JOIN intempestif compliquerait la resynchronisation.
}

function handleIrcMessage(data) {
  // Un seul événement WebSocket peut contenir plusieurs lignes IRC.
  for (const line of data.split("\r\n")) {
    if (!line) continue;
    if (line.startsWith("PING")) {
      socket?.send(`PONG ${line.slice(5)}`);
      continue;
    }
    if (!line.includes("USERNOTICE")) continue;

    const [rawTags, ...rest] = line.split(" ");
    const tags = parseIrcTags(rawTags);
    if (tags["msg-id"] !== "raid") continue;

    const channelPart = rest.find((part) => part.startsWith("#"));
    if (!channelPart) continue;
    const channel = channelPart.slice(1).toLowerCase();
    if (!wantedChannels.has(channel)) continue;

    const now = Date.now();
    if (now - (lastNotifiedAt.get(channel) || 0) < DEDUP_WINDOW_MS) continue;
    lastNotifiedAt.set(channel, now);

    const viewers = Number(tags["msg-param-viewers"]);
    notifyRaid?.({
      channel,
      raider: tags["msg-param-displayName"] || tags.login || "",
      viewers: Number.isFinite(viewers) ? viewers : 0,
    });
  }
}

function parseIrcTags(raw) {
  const tags = {};
  if (!raw || !raw.startsWith("@")) return tags;
  for (const pair of raw.slice(1).split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq);
    const value = pair
      .slice(eq + 1)
      .replace(/\\s/g, " ")
      .replace(/\\\\/g, "\\")
      .replace(/\\:/g, ";")
      .replace(/\\r|\\n/g, "");
    tags[key] = value;
  }
  return tags;
}

// Filet de sécurité : si le service worker a été tué malgré le PONG régulier,
// cette alarme le réveille et refreshTargets() rétablit la connexion.
function scheduleHeartbeat() {
  chrome.alarms.get(RAID_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(RAID_ALARM, { periodInMinutes: 1, delayInMinutes: 1 });
  });
}

export const RAID_WATCHER_ALARM = RAID_ALARM;
