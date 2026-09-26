/**
 * Faux `chrome.*` pour prévisualiser le vrai popup dans un navigateur normal.
 *
 * Outillage de développement uniquement (scripts/ n'est jamais packagé).
 * Toutes les chaînes, vignettes et statistiques sont fictives.
 *
 * Paramètres d'URL : state=live|offline|empty|many|loading, theme=light,
 * lang=fr|en|de…
 */
(function installMockChrome() {
  const params = new URLSearchParams(location.search);
  const scenario = params.get("state") || "live";
  const now = Date.now();

  function svgData(svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function avatar(letter, from, to) {
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="120" height="120" fill="url(#a)"/>
<text x="60" y="62" text-anchor="middle" dominant-baseline="central" font-family="Helvetica, Arial" font-size="54" font-weight="700" fill="#fff" fill-opacity=".92">${letter}</text></svg>`);
  }

  function thumbnail(hue, seed) {
    const a = `hsl(${hue} 60% 22%)`;
    const b = `hsl(${(hue + 40) % 360} 70% 45%)`;
    const c = `hsl(${(hue + 200) % 360} 50% 60%)`;
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#0b0c0e"/></linearGradient>
<filter id="f"><feGaussianBlur stdDeviation="28"/></filter></defs>
<rect width="640" height="360" fill="url(#g)"/>
<g filter="url(#f)"><circle cx="${180 + seed * 37 % 200}" cy="160" r="120" fill="${b}" fill-opacity=".7"/><circle cx="500" cy="${240 - seed * 13 % 90}" r="110" fill="${c}" fill-opacity=".45"/></g>
<rect x="40" y="250" width="${160 + seed * 29 % 180}" height="16" rx="3" fill="#fff" fill-opacity=".18"/>
<rect x="40" y="276" width="120" height="10" rx="3" fill="#fff" fill-opacity=".12"/></svg>`);
  }

  const NAMES = ["novastream", "pixelkat", "lunaplays", "rivertv", "echoduo", "kitsunebi", "marlowe", "sablefox",
    "orbitale", "tinycrown", "velvetzone", "mistralgg", "papercrane", "quartzlive", "neonpaon", "brisefer",
    "cobaltcat", "dunewalker", "emberlight", "frostbyte", "glasshouse", "harborlights", "ironmoth", "junipero",
    "kalimba", "lanterne", "mosaique", "nightowlfr", "opaline", "pistache", "quiveroak", "rouletabille",
    "saltmarsh", "tamtam", "ultramarin", "vagabonde", "wildthyme", "xylofun", "yuzuzest", "zephyrin"];
  const GAMES = ["Just Chatting", "Grand Theft Auto V", "League of Legends", "Minecraft", "Valorant", "Art", "Music", "Elden Ring"];
  // Titres en français pour le banc FR, en anglais ailleurs : une capture du store
  // en allemand ou en japonais ne doit pas montrer un titre de stream en français.
  const TITLES = (params.get("lang") || "fr") === "fr" ? [
    "Soirée détente, on répond à vos questions",
    "RP sur le serveur, on reprend l'enquête là où on s'était arrêtés",
    "Ranked jusqu'à Diamant ou jusqu'au bout de la nuit",
    "Construction de la base, épisode 12",
  ] : [
    "Chill night, answering your questions",
    "Server RP, picking the case up where we left off",
    "Ranked until Diamond or until sunrise",
    "Base building, episode 12",
  ];
  // store=1 : toutes les alertes actives, pour les captures du Chrome Web Store.
  const STORE_SHOT = params.get("store") === "1";

  function makeChannels(count, liveCount) {
    const streamers = [];
    const statuses = {};
    for (let i = 0; i < count; i++) {
      const handle = NAMES[i % NAMES.length] + (i >= NAMES.length ? String(i) : "");
      const platform = i % 3 === 2 ? "youtube" : i % 3 === 1 ? "kick" : "twitch";
      const id = `${platform}:${handle}`;
      const isTwitch = platform === "twitch";
      const isYoutube = platform === "youtube";
      const avatarColors = isTwitch
        ? ["#7c4dff", "#2a1a55"]
        : isYoutube
          ? ["#ff5a5a", "#4d0f0f"]
          : ["#2e9e3a", "#113d17"];
      streamers.push({
        id,
        platform,
        handle,
        displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
        avatarUrl: avatar(handle[0].toUpperCase(), avatarColors[0], avatarColors[1]),
        notificationsEnabled: true,
        gameNotificationsEnabled: STORE_SHOT || i % 2 === 0,
        titleNotificationsEnabled: STORE_SHOT,
      });
      const isLive = i < liveCount;
      statuses[id] = {
        updatedAt: now - 90 * 1000,
        viewers: isLive ? Math.round(24000 / (i + 1)) : undefined,
        active: {
          isLive,
          supportsLiveStatus: true,
          title: isLive ? TITLES[i % TITLES.length] : "",
          game: isLive ? GAMES[i % GAMES.length] : "",
          lastGame: isLive ? "" : GAMES[(i + 3) % GAMES.length],
          lastTitle: isLive ? "" : TITLES[(i + 1) % TITLES.length],
          viewers: isLive ? Math.round(24000 / (i + 1)) : undefined,
          startedAt: isLive ? new Date(now - (i === 2 ? 4 : 35 + i * 41) * 60000).toISOString() : null,
          thumbnailUrl: isLive ? thumbnail((i * 47) % 360, i + 3) : "",
        },
      };
    }
    return { streamers, statuses };
  }

  let channels = { streamers: [], statuses: {} };
  if (scenario === "live" || scenario === "loading") channels = makeChannels(9, 4);
  if (scenario === "offline") channels = makeChannels(6, 0);
  if (scenario === "many") channels = makeChannels(42, 7);

  const monthKey = new Date().toISOString().slice(0, 7);
  const watchTime = { [monthKey]: {} };
  channels.streamers.slice(0, 6).forEach((s, i) => {
    const monthSeconds = (6 - i) * 5400 + 900;
    const games = ["Grand Theft Auto V", "Just Chatting", "VALORANT", "League of Legends", "Minecraft", "Fortnite"];
    watchTime[monthKey][s.id] = { channel: s.handle, platform: s.platform, watchSeconds: monthSeconds, avatarUrl: s.avatarUrl, games: { [games[i % 6]]: monthSeconds * 0.7, [games[(i + 1) % 6]]: monthSeconds * 0.3 } };
  });

  // Jour par jour sur la semaine : la période « 7 derniers jours » du récap en dépend.
  const pad = (n) => String(n).padStart(2, "0");
  const watchDaily = {};
  for (let d = 0; d < 7; d++) {
    const date = new Date(now - d * 86400000);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    watchDaily[key] = {};
    channels.streamers.slice(0, 6).forEach((s, i) => {
      if ((d + i) % 3 === 2) return;
      const daySeconds = (6 - i) * 900 + d * 300;
      const dayGames = ["Grand Theft Auto V", "Just Chatting", "VALORANT", "League of Legends", "Minecraft", "Fortnite"];
      watchDaily[key][s.id] = { channel: s.handle, platform: s.platform, watchSeconds: daySeconds, avatarUrl: s.avatarUrl, games: { [dayGames[i % 6]]: daySeconds * 0.65, [dayGames[(i + 2) % 6]]: daySeconds * 0.35 } };
    });
  }

  // Historique : lives terminés récemment (onglet Historique).
  const history = {
    entries: channels.streamers.slice(3, 9).map((s, i) => {
      const endedAt = now - (40 + i * 190) * 60000;
      const durationSec = [11524, 20419, 7533, 15490, 6422, 9120][i % 6];
      return {
        id: `${s.id}@${endedAt - durationSec * 1000}`,
        streamerId: s.id,
        platform: s.platform,
        handle: s.handle,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        title: TITLES[i % TITLES.length],
        game: GAMES[(i + 2) % GAMES.length],
        startedAt: new Date(endedAt - durationSec * 1000).toISOString(),
        endedAt,
        durationSec,
        thumbnailUrl: thumbnail((i * 61 + 20) % 360, i + 7),
        vodUrl: `https://www.twitch.tv/${s.handle}/videos`,
        hasVod: s.platform === "twitch",
        watched: false,
        seen: i >= 4,
      };
    }),
  };

  // Points de chaîne gagnés : 7 jours de démo sur les chaînes Twitch (onglet Réglages > Points).
  const pointsDaily = {};
  const pointsJournal = [];
  const pointsChannels = {};
  const pointStreamers = channels.streamers.filter((s) => s.platform === "twitch").slice(0, 5);
  pointStreamers.forEach((s, i) => {
    pointsChannels[String(1001 + i)] = {
      login: s.handle,
      displayName: s.displayName || s.handle,
      avatar: s.avatarUrl || "",
      balance: 23410 - i * 3100,
      balanceAt: now,
      lastGainAt: now - (i + 1) * 180000,
      factor: i < 2 ? 0.2 : 0,
      factorAt: now,
      firsts: i === 0 ? { CHEER: now - 2 * 86400000 } : {},
    };
  });
  for (let d = 0; d < 7; d++) {
    const date = new Date(now - d * 86400000);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    pointsDaily[key] = {};
    pointStreamers.forEach((s, i) => {
      if ((d + i) % 4 === 3) return;
      const mult = i < 2 ? 1.2 : 1;
      const watch = 12 + ((d * 7 + i * 5) % 9);
      const claims = 3 + ((d + i) % 4);
      const reasons = {
        WATCH: { count: watch, points: Math.round(watch * 10 * mult), base: watch * 10 },
        CLAIM: { count: claims, points: Math.round(claims * 50 * mult), base: claims * 50 },
      };
      if (d === 2 && i === 0) reasons.WATCH_STREAK = { count: 1, points: 450, base: 450 };
      if (d === 1 && i === 1) reasons.RAID = { count: 1, points: 300, base: 250 };
      if (d === 4 && i === 2) reasons.FOLLOW = { count: 1, points: 300, base: 300 };
      pointsDaily[key][String(1001 + i)] = reasons;
    });
  }
  pointStreamers.slice(0, 2).forEach((s, i) => {
    for (let k = 0; k < 6; k++) {
      const at = now - (k * 4 + i + 1) * 60000;
      const reason = k % 3 === 0 ? "CLAIM" : "WATCH";
      pointsJournal.push({ key: `${1001 + i}|${at}|${reason}`, at, channelId: String(1001 + i), reason, rawReason: reason, points: reason === "CLAIM" ? 60 : 12, base: reason === "CLAIM" ? 50 : 10, factor: 0.2 });
    }
  });
  pointsJournal.sort((a, b) => b.at - a.at);

  const store = {
    betaGeneralStreamers: channels.streamers,
    betaGeneralStatuses: channels.statuses,
    betaGeneralPreferences: {
      language: params.get("lang") || "fr",
      theme: params.get("theme") || "dark",
      sortOrder: "live",
    },
    betaGeneralStats: { channelPointsClaimed: scenario === "empty" ? 0 : 12480 },
    betaWatchTimeData: scenario === "empty" ? {} : watchTime,
    streamPulseWatchTimeDaily: scenario === "empty" ? {} : watchDaily,
    streamPulseHistory: scenario === "empty" ? { entries: [] } : history,
    streamPulsePointsDaily: scenario === "empty" ? {} : pointsDaily,
    streamPulsePointsJournal: scenario === "empty" ? [] : pointsJournal,
    streamPulsePointsChannels: scenario === "empty" ? {} : pointsChannels,
    // ?plus=1 : licence active et deux règles d'alerte de démonstration.
    ...(params.get("plus") === "1"
      ? {
          streamPulsePlus: { licenseKey: "SP-DEMO-2026-PLUS-0001", plan: "lifetime", status: "active", verifiedAt: now },
          streamPulseCosmetics: { badgeFx: "shine", nameFx: "aurora" },
          streamPulsePredictionRule: { enabled: true, strategy: "majority", percent: 5, maxPoints: 2000, reserve: 1000, secondsBeforeEnd: 20 },
          streamPulsePredictionHistory: [
            { eventId: "p1", channel: "novastream", title: "Top 1 sur cette game ?", outcomeTitle: "Oui", points: 850, payout: 1540, status: "won", placedAt: now - 3600e3 },
            { eventId: "p2", channel: "pixelkat", title: "Boss battu en moins de 3 essais ?", outcomeTitle: "Non", points: 600, payout: 0, status: "lost", placedAt: now - 7200e3 },
            { eventId: "p3", channel: "novastream", title: "Plus de 15 kills ?", outcomeTitle: "Oui", points: 900, payout: 0, status: "pending", placedAt: now - 60e3 },
            { eventId: "p4", channel: "lunaplays", title: "Victoire en ranked ?", outcomeTitle: "Oui", points: 400, payout: 400, status: "refunded", placedAt: now - 86400e3 },
          ],
          streamPulseSmartAlerts: channels.streamers[0]
            ? {
                [channels.streamers[0].id]: [
                  { id: "r_gta", name: "Soirée GTA", enabled: true, games: ["Grand Theft Auto V"], keywords: [], minViewers: 0 },
                  { id: "r_event", name: "Événements", enabled: true, games: [], keywords: ["tournoi", "event"], minViewers: 5000 },
                ],
              }
            : {},
        }
      : {}),
    userProfile: { displayName: "AlexisAMZ" },
    patchNotesUnread: true,
    betaPinnedIds: channels.streamers[1] ? [channels.streamers[1].id] : [],
    betaChannelGroups: channels.streamers.length
      ? [{ id: "g_rp", name: "Soirée RP", memberIds: channels.streamers.slice(1, 3).map((s) => s.id) }]
      : [],
  };

  const logs = scenario === "empty" ? [] : [
    { type: "drop", text: "Drop récupéré : Caisse du convoi", channel: "novastream", value: 1, timestamp: now - 12 * 60000 },
    { type: "drop", text: "Drop récupéré : Skin exclusif", channel: "pixelkat", value: 1, timestamp: now - 30 * 60000 },
    { type: "points", text: "Bonus de points récupéré", channel: "pixelkat", value: 320, timestamp: now - 48 * 60000 },
    { type: "raid", text: "Raid annulé", channel: "lunaplays", timestamp: now - 130 * 60000 },
    { type: "moment", text: "Moment récupéré : Premier du mois", channel: "rivertv", timestamp: now - 260 * 60000 },
  ];

  const listeners = new Set();

  function pick(keys) {
    if (keys == null) return { ...store };
    const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys);
    return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
  }

  function withCallback(promise, callback) {
    if (typeof callback === "function") promise.then(callback);
    return promise;
  }

  const local = {
    get(keys, callback) {
      const delay = scenario === "loading" ? 600000 : 0;
      return withCallback(new Promise((resolve) => setTimeout(() => resolve(pick(keys)), delay)), callback);
    },
    set(items, callback) {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      listeners.forEach((fn) => fn(changes, "local"));
      return withCallback(Promise.resolve(), callback);
    },
    remove(keys, callback) {
      [].concat(keys).forEach((key) => delete store[key]);
      return withCallback(Promise.resolve(), callback);
    },
  };

  async function sendMessage(message) {
    switch (message?.type) {
      case "getEventLogs":
        return { logs };
      case "toggleNotifications":
      case "toggleGameNotifications":
      case "toggleTitleNotifications":
      case "refreshStatuses":
      case "testNotification":
      case "clearEventLogs":
      case "openPatchNotes":
      case "resetStat":
      case "updateUserProfile":
        return { success: true };
      case "removeStreamer":
        store.betaGeneralStreamers = store.betaGeneralStreamers.filter((s) => s.id !== message.id);
        return { success: true };
      case "addStreamer": {
        const handle = String(message.handle || "").toLowerCase();
        const id = `${message.platform}:${handle}`;
        store.betaGeneralStreamers = [...store.betaGeneralStreamers, { id, platform: message.platform, handle, displayName: message.displayName }];
        return { success: true };
      }
      case "markHistorySeen":
        store.streamPulseHistory = {
          entries: (store.streamPulseHistory?.entries || []).map((e) => (e.id === message.id ? { ...e, seen: true } : e)),
        };
        return { success: true };
      case "activatePlus": {
        // Démo : toute clé au bon format commençant par SP-DEMO est acceptée.
        const key = String(message.key || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!key.startsWith("SPDEMO") || key.length !== 18) return { ok: false, error: "invalid" };
        const record = { licenseKey: `SP-${key.slice(2).match(/.{4}/g).join("-")}`, plan: "lifetime", status: "active", verifiedAt: now };
        await local.set({ streamPulsePlus: record });
        return { ok: true, record };
      }
      case "deactivatePlus":
        await local.remove("streamPulsePlus");
        return { success: true };
      case "updatePreferences":
        store.betaGeneralPreferences = { ...store.betaGeneralPreferences, ...message.updates };
        return { success: true, preferences: store.betaGeneralPreferences };
      default:
        return {};
    }
  }

  window.chrome = {
    storage: { local, onChanged: { addListener: (fn) => listeners.add(fn) } },
    runtime: {
      sendMessage,
      getURL: (path) => `/${String(path).replace(/^\//, "")}`,
      getManifest: () => ({ version: "26.9.13" }),
    },
    tabs: {
      create: (options, callback) => {
        console.info("[mock] tabs.create", options?.url);
        callback?.();
      },
    },
  };
})();
