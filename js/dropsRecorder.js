// Relais du suivi des Drops, entre la page Twitch et le service worker.
// - transmet les événements temps réel repérés par inject/points-bridge.js ;
// - demande à inject/drops-bridge.js de relire l'inventaire (toutes les 5 min)
//   et les campagnes (toutes les 30 min), en évitant les lectures en double
//   quand plusieurs onglets Twitch sont ouverts ;
// - exécute les récupérations que le service worker lui confie.
// Rien n'est relayé si le suivi des Drops est désactivé dans les réglages.
(() => {
  "use strict";

  if (window.top !== window) return;

  const SOURCE = "streampulse:drops";
  const READY = "streampulse:drops:ready";
  const COMMAND = "streampulse:drops:cmd";
  const PREFERENCES_KEY = "betaGeneralPreferences";
  const PROGRESS_KEY = "streamPulseDropsProgress";
  const CAMPAIGNS_KEY = "streamPulseDropsCampaigns";
  const INVENTORY_EVERY_MS = 5 * 60_000;
  const CAMPAIGNS_EVERY_MS = 30 * 60_000;
  // Une campagne illisible (pas d'en-tête d'intégrité ni de cache) est retentée plus tôt.
  const CAMPAIGNS_RETRY_MS = 5 * 60_000;
  const TICK_MS = 60_000;
  // Laisse la page envoyer ses propres requêtes GraphQL, dont on lit les en-têtes.
  const FIRST_TICK_MS = 6_000;

  let enabled = true;
  let started = false;
  let sequence = 0;
  let campaignsTriedAt = 0;
  let inventoryAskedAt = 0;
  let timer = null;

  /**
   * Extension rechargée ou mise à jour : ce script, resté dans un onglet ouvert
   * avant, n'a plus accès à chrome.*. On arrête tout au lieu de lever une erreur
   * à chaque minute ; le nouveau script prendra le relais au rechargement de la page.
   */
  function contextAlive() {
    if (chrome.runtime?.id) return true;
    enabled = false;
    if (timer) clearInterval(timer);
    timer = null;
    return false;
  }

  const isEnabled = (prefs) => !prefs || prefs.dropsTracking !== false;

  function send(message) {
    if (!contextAlive()) return Promise.resolve(null);
    try {
      return chrome.runtime.sendMessage(message).catch(() => null);
    } catch {
      // Contexte d'extension invalidé par une mise à jour : on arrête de relayer.
      enabled = false;
      return Promise.resolve(null);
    }
  }

  function command(action, fields = {}) {
    if (action === "inventory") inventoryAskedAt = Date.now();
    if (action === "campaigns") campaignsTriedAt = Date.now();
    window.postMessage({ source: COMMAND, v: 1, id: `${Date.now()}-${++sequence}`, action, ...fields }, location.origin);
  }

  function claimAll(instanceIds, auto) {
    for (const instanceId of Array.isArray(instanceIds) ? instanceIds : []) command("claim", { instanceId, auto });
  }

  async function onResult(message) {
    if (message.action === "inventory") {
      const response = await send({ type: "recordDropsInventory", ok: message.ok === true, data: message.data, error: message.error });
      claimAll(response?.claim, true);
    } else if (message.action === "campaigns" && message.ok) {
      await send({ type: "recordDropsCampaigns", data: message.data?.campaigns, source: message.data?.source });
    } else if (message.action === "claim") {
      await send({
        type: "recordDropClaim",
        instanceId: message.instanceId,
        auto: message.auto !== false,
        ok: message.ok === true,
        status: message.data?.status || "",
        error: message.error || "",
      });
    }
  }

  async function onEvent(event) {
    const response = await send({ type: "recordDropsEvent", data: event });
    if (response?.refresh) command("inventory");
    claimAll(response?.claim, true);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !enabled) return;
    const message = event.data;
    if (!message || message.source !== SOURCE || message.v !== 1) return;
    if (message.kind === "event" && message.data && typeof message.data === "object") onEvent(message.data);
    else if (message.kind === "result" && typeof message.action === "string") onResult(message);
  });

  /** Relit ce qui est périmé, sauf si un autre onglet vient de le faire. */
  function tick() {
    if (!enabled || !contextAlive()) return;
    chrome.storage.local.get([PROGRESS_KEY, CAMPAIGNS_KEY], (stored) => {
      if (chrome.runtime.lastError || !enabled) return;
      const now = Date.now();
      const inventoryAt = Math.max(Number(stored?.[PROGRESS_KEY]?.updatedAt) || 0, inventoryAskedAt);
      if (now - inventoryAt >= INVENTORY_EVERY_MS) command("inventory");
      const campaignsAt = Number(stored?.[CAMPAIGNS_KEY]?.updatedAt) || 0;
      if (now - campaignsAt >= CAMPAIGNS_EVERY_MS && now - campaignsTriedAt >= CAMPAIGNS_RETRY_MS) command("campaigns");
    });
  }

  function start() {
    if (started) return;
    started = true;
    setTimeout(tick, FIRST_TICK_MS);
    timer = setInterval(tick, TICK_MS);
  }

  // Demandes du service worker : relire tout de suite (popup ouvert, Drop
  // réclamé par un clic) ou récupérer un Drop depuis le bouton du popup.
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type !== "dropsCommand") return;
    if (!enabled || !["inventory", "campaigns", "claim"].includes(request.action)) {
      sendResponse({ ok: false });
      return;
    }
    command(request.action, request.action === "claim" ? { instanceId: String(request.instanceId || ""), auto: false } : {});
    sendResponse({ ok: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[PREFERENCES_KEY]) return;
    enabled = isEnabled(changes[PREFERENCES_KEY].newValue);
    if (enabled) start();
  });

  // Le pont garde les événements en attente jusqu'à ce signal : on ne l'envoie
  // qu'une fois la préférence connue, pour ne rien relayer à tort.
  chrome.storage.local.get([PREFERENCES_KEY], (result) => {
    enabled = chrome.runtime.lastError ? true : isEnabled(result?.[PREFERENCES_KEY]);
    window.postMessage({ source: READY }, location.origin);
    if (enabled) start();
  });
})();
