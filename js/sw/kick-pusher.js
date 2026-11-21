// Connexion WebSocket Pusher pour Kick : alertes instantanées (0 s de délai)
// lors des passages en direct et arrêts de stream des chaînes suivies sur Kick.

import { DataStore } from "./stores.js";
import { pollStreamers } from "./polling.js";
import { PlatformChecker } from "./platform-checker.js";

const PUSHER_URL = "wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=8.4.0&flash=false";
const PING_INTERVAL_MS = 60_000;
const RECONNECT_DELAY_MS = 10_000;

let socket = null;
let pingTimer = null;
let reconnectTimer = null;
const subscribedChannelIds = new Set();
const channelToStreamerMap = new Map(); // channelId -> streamerSlug
let isConnecting = false;
let isExplicitlyStopped = false;

function clearTimers() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

export function stopKickPusher() {
  isExplicitlyStopped = true;
  clearTimers();
  if (socket) {
    try {
      socket.close();
    } catch (_) {
      // Ignoré à la fermeture
    }
    socket = null;
  }
  subscribedChannelIds.clear();
  channelToStreamerMap.clear();
  isConnecting = false;
}

export async function syncKickPusher() {
  isExplicitlyStopped = false;
  if (typeof WebSocket === "undefined") return;

  const streamers = (await DataStore.getStreamers()) || [];
  const kickStreamers = streamers.filter((s) => (s.platform || "").toLowerCase() === "kick");

  if (!kickStreamers.length) {
    stopKickPusher();
    return;
  }

  for (const s of kickStreamers) {
    const slug = (s.handle || s.id || "").toLowerCase();
    const id = s.kickChannelId || s.broadcasterUserId || s.channelId || s._kickChannelId;
    if (id) {
      channelToStreamerMap.set(String(id), slug);
    }
  }

  for (const s of kickStreamers) {
    const slug = (s.handle || s.id || "").toLowerCase();
    if (![...channelToStreamerMap.values()].includes(slug)) {
      PlatformChecker.getKickChannel(slug).then((channelData) => {
        const id = channelData?.broadcaster_user_id || channelData?.id || channelData?.chatroom?.channel_id;
        if (id) {
          channelToStreamerMap.set(String(id), slug);
          subscribeToChannel(String(id));
        }
      }).catch(() => {});
    }
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connect();
  } else {
    for (const channelId of channelToStreamerMap.keys()) {
      subscribeToChannel(channelId);
    }
  }
}

function subscribeToChannel(channelId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (subscribedChannelIds.has(channelId)) return;
  const msg = JSON.stringify({
    event: "pusher:subscribe",
    data: { auth: "", channel: `channel.${channelId}` },
  });
  try {
    socket.send(msg);
    subscribedChannelIds.add(channelId);
  } catch (_) {
    // Socket en cours de fermeture
  }
}

function connect() {
  if (isConnecting || (socket && socket.readyState === WebSocket.OPEN)) return;
  isConnecting = true;
  clearTimers();

  try {
    socket = new WebSocket(PUSHER_URL);
  } catch (_) {
    isConnecting = false;
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    isConnecting = false;
    pingTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "pusher:ping", data: {} }));
      }
    }, PING_INTERVAL_MS);
    if (pingTimer?.unref) pingTimer.unref();
  };

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.event === "pusher:connection_established") {
        for (const channelId of channelToStreamerMap.keys()) {
          subscribeToChannel(channelId);
        }
      } else if (parsed.event === "pusher:ping") {
        socket.send(JSON.stringify({ event: "pusher:pong", data: {} }));
      } else if (parsed.event === "App\\Events\\LivestreamStarted" || parsed.event === "App\\Events\\LivestreamEnded") {
        pollStreamers({ forceNotification: false }).catch(() => {});
      }
    } catch (_) {
      // Données WebSocket non parsables
    }
  };

  socket.onclose = () => {
    socket = null;
    isConnecting = false;
    subscribedChannelIds.clear();
    clearTimers();
    if (!isExplicitlyStopped) {
      scheduleReconnect();
    }
  };

  socket.onerror = () => {
    try {
      socket?.close();
    } catch (_) {
      // Ignoré
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer || isExplicitlyStopped) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!isExplicitlyStopped) {
      syncKickPusher().catch(() => {});
    }
  }, RECONNECT_DELAY_MS);
  if (reconnectTimer?.unref) reconnectTimer.unref();
}
