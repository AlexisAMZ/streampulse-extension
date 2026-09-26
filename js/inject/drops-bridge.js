// Pont des Drops, exécuté dans le monde de la page Twitch. Les requêtes vers
// l'API GraphQL de Twitch partent d'ici, avec la session de la page : le jeton
// de connexion et l'en-tête Client-Integrity ne quittent jamais la page, seuls
// les résultats sont transmis à dropsRecorder.js par window.postMessage.
//
// Commandes reçues : « inventory » (Drops en cours), « campaigns » (liste des
// campagnes), « claim » (récupérer un Drop prêt).
(() => {
  "use strict";

  if (window.top !== window || window.__streamPulseDropsBridge) return;
  window.__streamPulseDropsBridge = true;

  const SOURCE = "streampulse:drops";
  const COMMAND = "streampulse:drops:cmd";
  const GQL_URL = "https://gql.twitch.tv/gql";
  // Identifiant public de l'application web Twitch, celui que la page envoie elle-même.
  const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  const CAPTURED = ["client-id", "authorization", "client-integrity", "x-device-id", "client-version", "client-session-id"];
  const INSTANCE_ID = /^[\w#:.-]{1,300}$/;
  const CLAIM_OK = ["ELIGIBLE_FOR_ALL", "DROP_INSTANCE_ALREADY_CLAIMED"];

  const INVENTORY_QUERY = `query StreamPulseDropsInventory {
  currentUser {
    id
    inventory {
      dropCampaignsInProgress {
        id name status startAt endAt
        game { id displayName }
        allow { isEnabled channels { id name displayName } }
        timeBasedDrops {
          id name startAt endAt requiredMinutesWatched
          benefitEdges { benefit { id name imageAssetURL distributionType } }
          self { currentMinutesWatched dropInstanceID isClaimed }
        }
      }
      gameEventDrops { id name imageURL lastAwardedAt game { id displayName } }
    }
  }
}`;

  // Repli limité aux champs vérifiés sur twitch.tv le 2026-09-26, si Twitch
  // retire un champ de la requête complète.
  const INVENTORY_QUERY_LITE = `query StreamPulseDropsInventoryLite {
  currentUser {
    id
    inventory {
      dropCampaignsInProgress {
        id name
        game { id displayName }
        timeBasedDrops {
          id name endAt requiredMinutesWatched
          benefitEdges { benefit { id name distributionType } }
          self { currentMinutesWatched dropInstanceID isClaimed }
        }
      }
    }
  }
}`;

  const CAMPAIGNS_QUERY = `query StreamPulseDropCampaigns {
  currentUser {
    id
    dropCampaigns {
      id name status startAt endAt accountLinkURL
      self { isAccountConnected }
      game { id displayName boxArtURL }
      owner { id name }
    }
  }
}`;

  const CAMPAIGNS_QUERY_LITE = `query StreamPulseDropCampaignsLite {
  currentUser { id dropCampaigns { id name status startAt endAt game { id displayName } } }
}`;

  const seen = {};
  const nativeFetch = typeof window.fetch === "function" ? window.fetch : null;

  // ─── En-têtes de la page ─────────────────────────────────────────────────────

  function remember(name, value) {
    const key = String(name || "").toLowerCase();
    if (CAPTURED.includes(key) && typeof value === "string" && value) seen[key] = value;
  }

  function rememberAll(headers) {
    if (!headers) return;
    if (typeof headers.forEach === "function" && !Array.isArray(headers)) headers.forEach((value, name) => remember(name, value));
    else if (Array.isArray(headers)) headers.forEach((pair) => Array.isArray(pair) && remember(pair[0], pair[1]));
    else if (typeof headers === "object") Object.keys(headers).forEach((name) => remember(name, headers[name]));
  }

  function captureRequest(input, init) {
    try {
      const url = typeof input === "string" ? input : input?.url || String(input || "");
      if (!url.startsWith(GQL_URL)) return;
      if (input && typeof input === "object") rememberAll(input.headers);
      rememberAll(init?.headers);
    } catch {
      // Une requête de forme inattendue ne doit jamais gêner Twitch.
    }
  }

  if (nativeFetch) {
    // Lecture seule : la requête de Twitch part telle quelle.
    window.fetch = new Proxy(nativeFetch, {
      apply(target, thisArg, args) {
        captureRequest(args[0], args[1]);
        return Reflect.apply(target, thisArg, args);
      },
    });
  }

  function cookieToken() {
    const match = /(?:^|;\s*)auth-token=([^;]+)/.exec(document.cookie || "");
    return match ? decodeURIComponent(match[1]) : "";
  }

  function authorization() {
    if (seen.authorization) return seen.authorization;
    const token = cookieToken();
    return token ? `OAuth ${token}` : "";
  }

  // ─── GraphQL ─────────────────────────────────────────────────────────────────

  const failure = (code, detail) => Object.assign(new Error(code), { code, detail });

  async function gql(query) {
    const auth = authorization();
    if (!auth) throw failure("signed-out");
    if (!nativeFetch) throw failure("no-fetch");
    const headers = { "Client-Id": seen["client-id"] || WEB_CLIENT_ID, Authorization: auth, "Content-Type": "text/plain;charset=UTF-8" };
    if (seen["client-integrity"]) headers["Client-Integrity"] = seen["client-integrity"];
    if (seen["x-device-id"]) headers["X-Device-Id"] = seen["x-device-id"];
    if (seen["client-version"]) headers["Client-Version"] = seen["client-version"];
    if (seen["client-session-id"]) headers["Client-Session-Id"] = seen["client-session-id"];

    const response = await nativeFetch.call(window, GQL_URL, { method: "POST", headers, body: JSON.stringify({ query }), credentials: "omit" });
    if (response.status === 401) throw failure("signed-out");
    const json = await response.json().catch(() => null);
    const errors = Array.isArray(json?.errors) ? json.errors.map((error) => String(error?.message || "")) : [];
    if (errors.some((message) => /integrity/i.test(message))) throw failure("integrity");
    if (!json?.data) throw failure(errors.length ? "graphql" : `http-${response.status}`, errors.join(" | ").slice(0, 300));
    return { data: json.data, errors };
  }

  /** Requête complète, puis repli si Twitch a retiré un des champs demandés. */
  async function gqlWithFallback(full, lite) {
    try {
      const result = await gql(full);
      if (!result.errors.some((message) => /Cannot query field|Unknown (type|argument)/i.test(message))) return { ...result, tier: "full" };
    } catch (error) {
      if (error.code !== "graphql") throw error;
    }
    return { ...(await gql(lite)), tier: "lite" };
  }

  async function readInventory() {
    const { data, tier } = await gqlWithFallback(INVENTORY_QUERY, INVENTORY_QUERY_LITE);
    if (!data.currentUser) throw failure("signed-out");
    return { currentUser: data.currentUser, tier };
  }

  // ─── Campagnes ───────────────────────────────────────────────────────────────

  /** Champ Apollo, stocké tel quel ou sous « nom({"arg":…}) » quand il a des arguments. */
  function field(object, name) {
    if (!object || typeof object !== "object") return undefined;
    if (name in object) return object[name];
    const key = Object.keys(object).find((item) => item.startsWith(`${name}(`));
    return key ? object[key] : undefined;
  }

  /**
   * Campagnes déjà chargées par la page (par exemple sur /drops/campaigns),
   * lues dans le cache Apollo de Twitch : aucune requête supplémentaire.
   */
  function campaignsFromApollo() {
    const cache = window.__APOLLO_CLIENT__?.cache;
    const store = typeof cache?.extract === "function" ? cache.extract() : null;
    if (!store || typeof store !== "object") return [];
    const deref = (value, depth = 0) => (value && typeof value === "object" && typeof value.__ref === "string" && depth < 5 ? deref(store[value.__ref], depth + 1) : value);
    const campaigns = [];
    for (const value of Object.values(store)) {
      if (!value || value.__typename !== "DropCampaign" || !value.id) continue;
      const game = deref(field(value, "game")) || {};
      const owner = deref(field(value, "owner")) || {};
      const self = deref(field(value, "self")) || {};
      const drops = field(value, "timeBasedDrops");
      campaigns.push({
        id: value.id,
        name: value.name,
        status: value.status,
        startAt: value.startAt,
        endAt: value.endAt,
        accountLinkURL: value.accountLinkURL,
        self: { isAccountConnected: self.isAccountConnected },
        game: { id: game.id, displayName: game.displayName || game.name, boxArtURL: field(game, "boxArtURL") },
        owner: { id: owner.id, name: owner.name },
        timeBasedDrops: Array.isArray(drops)
          ? drops.map((drop) => deref(drop)).filter(Boolean).map((drop) => ({
            id: drop.id,
            benefitEdges: (field(drop, "benefitEdges") || []).map((edge) => {
              const benefit = deref(field(deref(edge) || {}, "benefit"));
              return { benefit: benefit ? { id: benefit.id, name: benefit.name, distributionType: benefit.distributionType } : null };
            }),
          }))
          : undefined,
      });
    }
    return campaigns;
  }

  async function readCampaigns() {
    // Sans en-tête d'intégrité, Twitch refuse la liste : inutile d'essayer.
    if (seen["client-integrity"]) {
      try {
        const { data } = await gqlWithFallback(CAMPAIGNS_QUERY, CAMPAIGNS_QUERY_LITE);
        const list = data.currentUser?.dropCampaigns;
        if (Array.isArray(list) && list.length) return { campaigns: list, source: "gql" };
      } catch (error) {
        if (error.code === "signed-out") throw error;
      }
    }
    const cached = campaignsFromApollo();
    if (cached.length) return { campaigns: cached, source: "apollo" };
    throw failure("unavailable");
  }

  // ─── Récupération ────────────────────────────────────────────────────────────

  async function claim(instanceId) {
    if (!INSTANCE_ID.test(String(instanceId || ""))) throw failure("invalid");
    // Littéral en ligne : pas besoin du nom du type d'entrée, qui peut changer.
    const { data } = await gql(`mutation StreamPulseClaimDrop { claimDropRewards(input: { dropInstanceID: ${JSON.stringify(instanceId)} }) { status } }`);
    const status = String(data.claimDropRewards?.status || "");
    return { status, claimed: CLAIM_OK.includes(status) };
  }

  // ─── Commandes ───────────────────────────────────────────────────────────────

  const ACTIONS = {
    inventory: () => readInventory(),
    campaigns: () => readCampaigns(),
    claim: (message) => claim(message.instanceId),
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== COMMAND || message.v !== 1) return;
    const run = ACTIONS[message.action];
    if (!run) return;
    const reply = (fields) => window.postMessage({ source: SOURCE, v: 1, kind: "result", id: message.id, action: message.action, instanceId: message.instanceId, auto: message.auto, ...fields }, location.origin);
    Promise.resolve()
      .then(() => run(message))
      .then((data) => reply({ ok: true, data }), (error) => reply({ ok: false, error: error?.code || "error", detail: error?.detail || "" }));
  });
})();
