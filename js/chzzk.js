// CHZZK (Naver, Corée) : lecture des réponses publiques de l'API du site, sans connexion.
// Module pur (aucun appel chrome.* ni réseau), testé à part. Les adresses ne sont pas
// documentées officiellement : si Naver les change, seul ce fichier et platform-checker bougent.

export const CHZZK_API = "https://api.chzzk.naver.com";
export const CHZZK_SITE = "https://chzzk.naver.com";

const CHANNEL_ID = /^[0-9a-f]{32}$/i;
const CHANNEL_IN_URL = /chzzk\.naver\.com\/(?:live\/|video\/)?([0-9a-f]{32})/i;
const MAX_NAME_LENGTH = 40;
const KST_OFFSET = "+09:00";

const trimmed = (value) => (typeof value === "string" ? value.trim() : "");
const isObject = (value) => value !== null && typeof value === "object";
const httpsOnly = (value) => (/^https:\/\//i.test(trimmed(value)) ? trimmed(value) : "");

export const isChzzkChannelId = (value) => CHANNEL_ID.test(trimmed(value));

/** Une saisie devient soit un identifiant de chaîne, soit un nom à chercher, soit rien. */
export function parseChzzkInput(value) {
  const raw = trimmed(value);
  if (!raw) return null;
  if (isChzzkChannelId(raw)) return { id: raw.toLowerCase() };
  const fromUrl = CHANNEL_IN_URL.exec(raw);
  if (fromUrl) return { id: fromUrl[1].toLowerCase() };
  const printable = [...raw].filter((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127).join("");
  const name = printable.replace(/^@+/, "").trim().slice(0, MAX_NAME_LENGTH).trim();
  return name ? { name } : null;
}

export function normalizeChzzkChannel(raw) {
  if (!isObject(raw) || !isChzzkChannelId(raw.channelId)) return null;
  return {
    id: raw.channelId.toLowerCase(),
    name: trimmed(raw.channelName),
    avatar: httpsOnly(raw.channelImageUrl),
    followers: Number.isFinite(raw.followerCount) ? raw.followerCount : 0,
    isLive: raw.openLive === true,
  };
}

/** Réponse de recherche : on n'accepte que le nom exact, jamais « le premier résultat ». */
export function pickChzzkChannel(response, name) {
  const wanted = trimmed(name).toLocaleLowerCase();
  const rows = response?.content?.data;
  if (!wanted || !Array.isArray(rows)) return null;
  for (const row of rows) {
    const channel = normalizeChzzkChannel(row?.channel);
    if (channel && channel.name.toLocaleLowerCase() === wanted) return channel;
  }
  return null;
}

export function chzzkThumbnail(url, size = 480) {
  const safe = httpsOnly(url);
  return safe ? safe.replace("{type}", String(size)) : "";
}

/** « 2026-10-20 03:20:24 » est en heure coréenne : on renvoie un instant ISO, ou null. */
function startedAtOf(value) {
  const time = Date.parse(`${trimmed(value).replace(" ", "T")}${KST_OFFSET}`);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Contenu de /service/v3/channels/{id}/live-detail → champs communs aux plateformes. */
export function parseChzzkLive(content) {
  const data = isObject(content) ? content : {};
  const isLive = data.status === "OPEN";
  const viewers = isLive && Number.isInteger(data.concurrentUserCount) && data.concurrentUserCount > 0 ? data.concurrentUserCount : 0;
  const channel = normalizeChzzkChannel(data.channel);
  const startedAt = startedAtOf(data.openDate);
  return {
    isLive,
    title: trimmed(data.liveTitle),
    game: trimmed(data.liveCategoryValue) || trimmed(data.liveCategory),
    viewers,
    startedAt: isLive ? startedAt : null,
    sessionId: data.liveId === undefined || data.liveId === null ? "" : String(data.liveId),
    thumbnailUrl: isLive ? chzzkThumbnail(data.liveImageUrl) : "",
    displayName: channel?.name || trimmed(data.channel?.channelName),
    avatarUrl: channel?.avatar || "",
    adult: data.adult === true,
  };
}

export const chzzkChannelUrl = (id) => (isChzzkChannelId(id) ? `${CHZZK_SITE}/${id.toLowerCase()}` : `${CHZZK_SITE}/`);
export const chzzkLiveUrl = (id) => (isChzzkChannelId(id) ? `${CHZZK_SITE}/live/${id.toLowerCase()}` : `${CHZZK_SITE}/`);

/**
 * `getJson(chemin)` renvoie le corps JSON de l'API (ou null) et laisse remonter les erreurs
 * réseau : les fonctions ci-dessous les rattrapent, l'appelant ne voit jamais d'exception.
 */
export async function resolveChzzkChannel(input, getJson) {
  const parsed = parseChzzkInput(input);
  if (!parsed) return null;
  try {
    if (parsed.id) {
      const body = await getJson(`/service/v1/channels/${parsed.id}`);
      return body?.code === 200 ? normalizeChzzkChannel(body.content) : null;
    }
    const body = await getJson(`/service/v1/search/channels?keyword=${encodeURIComponent(parsed.name)}&size=20`);
    return pickChzzkChannel(body, parsed.name);
  } catch {
    return null;
  }
}

/** { status } si la chaîne existe, { notFound: true } si elle n'existe pas, { error } si le réseau a échoué. */
export async function fetchChzzkLive(channelId, getJson) {
  if (!isChzzkChannelId(channelId)) return { notFound: true };
  try {
    const body = await getJson(`/service/v3/channels/${channelId.toLowerCase()}/live-detail`);
    if (body?.code === 404) return { notFound: true };
    if (body?.code !== 200) return { error: `chzzk_${body?.code ?? "inconnu"}` };
    return { status: parseChzzkLive(body.content) };
  } catch (error) {
    return { error: error?.message || "réseau" };
  }
}

// Une seule permission pour tout CHZZK : « *. » couvre le site (chzzk.naver.com) et son API
// (api.chzzk.naver.com). Demandée à l'ajout d'une chaîne, pas à l'installation.
export const CHZZK_HOST_PERMISSION = "https://*.chzzk.naver.com/*";
export const CHZZK_RULE_ID = 4401;
export const CHZZK_PERMISSIONS = [CHZZK_HOST_PERMISSION];
/** Autorisation d'API facultative elle aussi : une obligatoire pourrait désactiver l'extension à la mise à jour. */
export const CHZZK_API_PERMISSIONS = ["declarativeNetRequestWithHostAccess"];
/** La demande complète, en une seule fenêtre d'acceptation : l'hôte CHZZK et la règle d'en-tête. */
export const CHZZK_ACCESS = { origins: CHZZK_PERMISSIONS, permissions: CHZZK_API_PERMISSIONS };

/**
 * Indicateur de latence sur les pages CHZZK (js/chzzkPlayerEnhancer.js + pont de la page). Coupé un
 * moment le 20/10/2026 par précaution, puis remis : les coupures du flux persistaient extension
 * désactivée, elles ne venaient donc pas d'elle. Interrupteur gardé pour le couper d'un mot.
 */
export const CHZZK_LATENCY_ENABLED = true;
/** Tous les identifiants de scripts que l'extension a pu enregistrer, pour retirer les anciens. */
export const CHZZK_PAGE_SCRIPT_IDS = ["sp-chzzk-pages", "sp-chzzk-bridge"];

/**
 * Scripts posés sur chzzk.naver.com, enregistrés seulement quand l'utilisateur a accordé le site
 * (un script déclaré dans le manifeste imposerait un nouvel avertissement à tous les utilisateurs
 * existants). Le pont tourne dans le monde de la page : lui seul voit la latence du lecteur.
 */
export function chzzkPageScripts() {
  const matches = [`${CHZZK_SITE}/*`];
  const pageScripts = ["js/inject/i18n-inline.js", "js/inject/quickFollowCore.js", "js/inject/quickFollowChzzk.js"];
  const scripts = [{ id: "sp-chzzk-pages", matches, js: pageScripts, runAt: "document_idle", persistAcrossSessions: true }];
  if (CHZZK_LATENCY_ENABLED) {
    scripts[0].js = [...pageScripts, "js/chzzkPlayerEnhancer.js"];
    scripts.push({ id: "sp-chzzk-bridge", matches, js: ["js/inject/chzzk-latency-bridge.js"], runAt: "document_start", world: "MAIN", persistAcrossSessions: true });
  }
  return scripts;
}

/**
 * L'API de CHZZK répond 403 à toute origine qui n'est pas son site : on lui présente celle du
 * site, mais seulement pour les requêtes de cette extension vers cette adresse.
 */
export function chzzkOriginRule(extensionId) {
  if (typeof extensionId !== "string" || !/^[a-p]{32}$/.test(extensionId)) return null;
  return {
    id: CHZZK_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "origin", operation: "set", value: CHZZK_SITE },
        { header: "referer", operation: "set", value: `${CHZZK_SITE}/` },
      ],
    },
    condition: { urlFilter: "||api.chzzk.naver.com/", resourceTypes: ["xmlhttprequest"], initiatorDomains: [extensionId] },
  };
}
