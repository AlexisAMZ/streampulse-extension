// Pont du suivi des points, exécuté dans le monde de la page Twitch. Twitch
// reçoit chaque gain de points de chaîne par sa connexion temps réel (Hermes,
// ou l'ancien PubSub) : ce script écoute les WebSocket de la page, repère les
// messages « points-earned » et les transmet à pointsRecorder.js par
// window.postMessage. Il ne modifie rien de ce que Twitch reçoit.
(() => {
  "use strict";

  if (window.top !== window || window.__streamPulsePointsBridge) return;
  window.__streamPulsePointsBridge = true;

  const SOURCE = "streampulse:points";
  const READY = "streampulse:points:ready";
  const MARKER = "points-earned";
  const QUEUE_LIMIT = 50;
  // Hermes emballe le message PubSub dans une chaîne JSON, elle-même dans un
  // objet : il faut descendre de quatre niveaux, on en autorise six.
  const MAX_DEPTH = 6;

  let ready = false;
  const queue = [];

  /** Cherche { type: "points-earned", data } dans un message, quel que soit son emballage. */
  function findPointsEarned(value, depth) {
    if (depth > MAX_DEPTH || value === null || value === undefined) return null;
    if (typeof value === "string") {
      if (!value.includes(MARKER)) return null;
      try {
        return findPointsEarned(JSON.parse(value), depth + 1);
      } catch {
        return null;
      }
    }
    if (typeof value !== "object") return null;
    if (value.type === MARKER && value.data && typeof value.data === "object") return value.data;
    for (const key of Object.keys(value)) {
      const found = findPointsEarned(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function post(data) {
    window.postMessage({ source: SOURCE, v: 1, data }, location.origin);
  }

  function emit(data) {
    if (ready) post(data);
    else if (queue.length < QUEUE_LIMIT) queue.push(data);
  }

  function onSocketMessage(event) {
    try {
      const raw = event.data;
      // Filtre bon marché : la plupart des messages ne parlent pas de points.
      if (typeof raw !== "string" || !raw.includes(MARKER)) return;
      const data = findPointsEarned(raw, 0);
      if (data) emit(data);
    } catch {
      // Ne jamais gêner la connexion de Twitch.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== READY) return;
    ready = true;
    queue.splice(0).forEach(post);
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
