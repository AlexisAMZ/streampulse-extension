// Pont temps réel, exécuté dans le monde de la page Twitch. Twitch reçoit
// chaque gain de points de chaîne et chaque avancée de Drop par sa connexion
// temps réel (Hermes, ou l'ancien PubSub) : ce script écoute les WebSocket de
// la page, repère les messages « points-earned », « drop-progress » et
// « drop-claim », et les transmet par window.postMessage à pointsRecorder.js
// et dropsRecorder.js. Il ne modifie rien de ce que Twitch reçoit.
(() => {
  "use strict";

  if (window.top !== window || window.__streamPulsePointsBridge) return;
  window.__streamPulsePointsBridge = true;

  const QUEUE_LIMIT = 50;
  // Hermes emballe le message PubSub dans une chaîne JSON, elle-même dans un
  // objet : il faut descendre de quatre niveaux, on en autorise six.
  const MAX_DEPTH = 6;

  /** Un canal par relais : chacun a son signal « prêt » et sa file d'attente. */
  const points = { ready: "streampulse:points:ready", isReady: false, queue: [], post: (data) => ({ source: "streampulse:points", v: 1, data }) };
  const drops = { ready: "streampulse:drops:ready", isReady: false, queue: [], post: (event) => ({ source: "streampulse:drops", v: 1, kind: "event", data: event }) };
  const MARKERS = [
    { type: "points-earned", channel: points, payload: (message) => message.data },
    { type: "drop-progress", channel: drops, payload: (message) => ({ type: message.type, data: message.data }) },
    { type: "drop-claim", channel: drops, payload: (message) => ({ type: message.type, data: message.data }) },
  ];

  /** Cherche { type, data } dans un message, quel que soit son emballage. */
  function findMessage(value, type, depth) {
    if (depth > MAX_DEPTH || value === null || value === undefined) return null;
    if (typeof value === "string") {
      if (!value.includes(type)) return null;
      try {
        return findMessage(JSON.parse(value), type, depth + 1);
      } catch {
        return null;
      }
    }
    if (typeof value !== "object") return null;
    if (value.type === type && value.data && typeof value.data === "object") return value;
    for (const key of Object.keys(value)) {
      const found = findMessage(value[key], type, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function emit(channel, payload) {
    if (channel.isReady) window.postMessage(channel.post(payload), location.origin);
    else if (channel.queue.length < QUEUE_LIMIT) channel.queue.push(payload);
  }

  function onSocketMessage(event) {
    try {
      const raw = event.data;
      if (typeof raw !== "string") return;
      for (const marker of MARKERS) {
        // Filtre bon marché : la plupart des messages ne parlent ni de points ni de Drops.
        if (!raw.includes(marker.type)) continue;
        const message = findMessage(raw, marker.type, 0);
        if (message) emit(marker.channel, marker.payload(message));
      }
    } catch {
      // Ne jamais gêner la connexion de Twitch.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    const channel = [points, drops].find((item) => item.ready === event.data.source);
    if (!channel) return;
    channel.isReady = true;
    channel.queue.splice(0).forEach((payload) => window.postMessage(channel.post(payload), location.origin));
  });

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== "function") return;
  // Un Proxy garde instanceof, le prototype et les constantes (OPEN, CLOSED…).
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget);
      try {
        socket.addEventListener("message", onSocketMessage);
      } catch {
        // Socket inattendue : on la laisse telle quelle.
      }
      return socket;
    },
  });
})();
