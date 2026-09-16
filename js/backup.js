// Sauvegarde et restauration des donnees de l'utilisateur.
// Module pur : aucun acces a chrome.*, ni au DOM. Teste par tests/backup.test.mjs.
//
// Une sauvegarde ne contient que ce que l'utilisateur a construit : streamers,
// favoris epingles, groupes de chaines, reglages, statistiques, historique,
// temps de visionnage, alertes, apparence et profil. Les caches (statuts,
// miniatures, configuration distante), les jetons Kick, la licence StreamPulse+
// (liee a l'appareil) et les notifications programmees (liees a chrome.alarms,
// qui ne se restaurent pas) en sont exclus.

export const BACKUP_APP = "StreamPulse";
export const BACKUP_FORMAT = 1;

// Au-dela, ce n'est pas une sauvegarde StreamPulse : on refuse avant de lire.
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const STREAMERS = "betaGeneralStreamers";
const PREFERENCES = "betaGeneralPreferences";
const STATS = "betaGeneralStats";
const WATCH_MONTHLY = "betaWatchTimeData";
const WATCH_DAILY = "streamPulseWatchTimeDaily";
const PROFILE = "userProfile";
const PINNED = "betaPinnedIds";
const GROUPS = "betaChannelGroups";
const HISTORY = "streamPulseHistory";
const SMART_ALERTS = "streamPulseSmartAlerts";
const COSMETICS = "streamPulseCosmetics";
const ACCENT = "streamPulseAccent";
const PREDICTION_RULE = "streamPulsePredictionRule";

// La licence StreamPulse+, l'identifiant d'appareil et les alarmes restent
// dehors : ils sont lies a CETTE installation et n'ont pas de sens ailleurs.
export const BACKUP_KEYS = [
  STREAMERS, PREFERENCES, STATS, WATCH_MONTHLY, WATCH_DAILY, PROFILE,
  PINNED, GROUPS, HISTORY, SMART_ALERTS, COSMETICS, ACCENT, PREDICTION_RULE,
];

/** Caches derives des donnees restaurees : vides a la restauration, recalcules ensuite. */
export const RESET_ON_RESTORE = ["betaGeneralStatuses", "streamPulseLiveState", "streampulse:thumbCache"];

const MONTH_KEY = /^\d{4}-\d{2}$/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const pad = (n) => String(n).padStart(2, "0");

/**
 * Construit le fichier de sauvegarde a partir du contenu du storage.
 *
 * @param {Record<string, unknown>} storage resultat de chrome.storage.local.get(BACKUP_KEYS)
 * @param {{version: string, now?: Date}} options
 */
export function buildBackup(storage, { version, now = new Date() }) {
  const data = {};
  for (const key of BACKUP_KEYS) {
    if (storage && storage[key] !== undefined) data[key] = storage[key];
  }
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version: String(version || ""),
    exportedAt: now.toISOString(),
    data,
  };
}

/** Nom du fichier, date en heure locale : "streampulse-backup-AAAA-MM-JJ.json". */
export function backupFileName(now = new Date()) {
  return `streampulse-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function isStreamer(item) {
  return (
    isPlainObject(item) &&
    ((typeof item.id === "string" && item.id.length > 0) ||
      (typeof item.handle === "string" && item.handle.length > 0))
  );
}

function isWatchEntry(entry) {
  return (
    isPlainObject(entry) &&
    typeof entry.platform === "string" &&
    typeof entry.channel === "string" &&
    entry.channel.length > 0 &&
    typeof entry.watchSeconds === "number" &&
    Number.isFinite(entry.watchSeconds) &&
    entry.watchSeconds >= 0
  );
}

/** Garde les periodes a la cle bien formee et, dans chacune, les entrees valides. */
function cleanWatchTime(value, periodKey) {
  const cleaned = {};
  for (const [period, bucket] of Object.entries(value)) {
    if (!periodKey.test(period) || !isPlainObject(bucket)) continue;
    cleaned[period] = Object.fromEntries(
      Object.entries(bucket).filter(([, entry]) => isWatchEntry(entry))
    );
  }
  return cleaned;
}

/**
 * Nettoie une valeur connue. Renvoie `undefined` si son type est incompatible :
 * restaurer une liste de streamers qui n'est pas une liste casserait la popup.
 */
function cleanValue(key, value) {
  switch (key) {
    case STREAMERS:
      return Array.isArray(value) ? value.filter(isStreamer) : undefined;
    case WATCH_MONTHLY:
      return isPlainObject(value) ? cleanWatchTime(value, MONTH_KEY) : undefined;
    case WATCH_DAILY:
      return isPlainObject(value) ? cleanWatchTime(value, DAY_KEY) : undefined;
    case PREFERENCES:
    case STATS:
    case PROFILE:
    case GROUPS:
    case HISTORY:
    case COSMETICS:
    case PREDICTION_RULE:
      return isPlainObject(value) ? value : undefined;
    case PINNED:
      return Array.isArray(value) ? value.filter((id) => typeof id === "string" && id) : undefined;
    case SMART_ALERTS:
      return Array.isArray(value) || isPlainObject(value) ? value : undefined;
    case ACCENT:
      return typeof value === "string" ? value : undefined;
    default:
      return undefined;
  }
}

/**
 * Valide un fichier de sauvegarde deja parse en JSON.
 *
 * Accepte le format courant `{app, format, version, exportedAt, data}` et
 * l'ancien format a plat (les cles du storage directement a la racine).
 *
 * @returns {{ok: true, data: Record<string, unknown>,
 *            summary: {streamers: number, months: number, days: number,
 *                      exportedAt: string|null, version: string|null}}
 *          | {ok: false, error: string}}
 */
export function parseBackup(value) {
  if (!isPlainObject(value)) return { ok: false, error: "not-object" };

  const isWrapped = "app" in value || "format" in value || "data" in value;
  if (isWrapped) {
    if (value.app !== BACKUP_APP) return { ok: false, error: "wrong-app" };
    if (value.format !== BACKUP_FORMAT) return { ok: false, error: "unsupported-format" };
    if (!isPlainObject(value.data)) return { ok: false, error: "not-object" };
  }
  const source = isWrapped ? value.data : value;

  const data = {};
  for (const key of BACKUP_KEYS) {
    if (source[key] === undefined) continue;
    const cleaned = cleanValue(key, source[key]);
    if (cleaned === undefined) return { ok: false, error: `invalid-${key}` };
    data[key] = cleaned;
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "empty" };

  return {
    ok: true,
    data,
    summary: {
      streamers: Array.isArray(data[STREAMERS]) ? data[STREAMERS].length : 0,
      months: data[WATCH_MONTHLY] ? Object.keys(data[WATCH_MONTHLY]).length : 0,
      days: data[WATCH_DAILY] ? Object.keys(data[WATCH_DAILY]).length : 0,
      exportedAt: isWrapped && typeof value.exportedAt === "string" ? value.exportedAt : null,
      version: isWrapped && typeof value.version === "string" ? value.version : null,
    },
  };
}

// ── Fusion : une sauvegarde importee s'ajoute aux donnees deja presentes ──────
//
// Les deux extensions peuvent avoir tourne en meme temps et compte les memes
// visionnages : pour le temps et les compteurs, on garde la plus grande valeur
// plutot que la somme, qui les compterait deux fois.

function handleKey(item) {
  return typeof item.handle === "string" && item.handle
    ? `${String(item.platform || "twitch").toLowerCase()}:${item.handle.toLowerCase()}`
    : "";
}

/** Ajoute les streamers absents, sans doublon (meme id, ou meme plateforme et pseudo). */
function mergeStreamers(current, incoming) {
  const ids = new Set(current.map((item) => item.id).filter(Boolean));
  const handles = new Set(current.map(handleKey).filter(Boolean));
  const added = [];
  for (const item of incoming) {
    const key = handleKey(item);
    if ((item.id && ids.has(item.id)) || (key && handles.has(key))) continue;
    added.push(item);
    if (item.id) ids.add(item.id);
    if (key) handles.add(key);
  }
  return { list: [...current, ...added], added: added.length };
}

/** Par periode et par chaine, garde l'entree au plus grand temps de visionnage. */
function mergeWatchTime(current, incoming) {
  const merged = { ...current };
  for (const [period, bucket] of Object.entries(incoming)) {
    const next = { ...(isPlainObject(merged[period]) ? merged[period] : {}) };
    for (const [key, entry] of Object.entries(bucket)) {
      const existing = next[key];
      if (!existing || entry.watchSeconds > existing.watchSeconds) {
        next[key] = { ...existing, ...entry };
      }
    }
    merged[period] = next;
  }
  return merged;
}

/** Compteurs : la plus grande valeur. Autres champs : ceux deja presents gagnent. */
function mergeStats(current, incoming) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      merged[key] = Math.max(Number(merged[key]) || 0, value);
    } else if (!(key in merged)) {
      merged[key] = value;
    }
  }
  return merged;
}

function hasProfile(profile) {
  return isPlainObject(profile) && Boolean(profile.handle || profile.displayName);
}

/**
 * Fusionne les donnees validees d'une sauvegarde (parseBackup().data) avec le
 * contenu actuel du storage. Ne renvoie que les cles presentes dans la sauvegarde.
 *
 * @returns {{data: Record<string, unknown>, addedStreamers: number}}
 */
export function mergeBackup(current, incoming) {
  const now = isPlainObject(current) ? current : {};
  const data = {};
  let addedStreamers = 0;

  for (const [key, value] of Object.entries(incoming || {})) {
    switch (key) {
      case STREAMERS: {
        const result = mergeStreamers(Array.isArray(now[key]) ? now[key] : [], value);
        data[key] = result.list;
        addedStreamers = result.added;
        break;
      }
      case WATCH_MONTHLY:
      case WATCH_DAILY:
        data[key] = mergeWatchTime(isPlainObject(now[key]) ? now[key] : {}, value);
        break;
      case STATS:
        data[key] = mergeStats(isPlainObject(now[key]) ? now[key] : {}, value);
        break;
      case PREFERENCES:
        data[key] = { ...value, ...(isPlainObject(now[key]) ? now[key] : {}) };
        break;
      case PROFILE:
        data[key] = hasProfile(now[key]) ? now[key] : value;
        break;
      case PINNED: {
        // Union sans doublon : les favoris des deux installations sont gardes.
        const currentPins = Array.isArray(now[key]) ? now[key] : [];
        data[key] = [...new Set([...currentPins, ...value])];
        break;
      }
      case GROUPS:
      case HISTORY:
        // Les entrees deja presentes gagnent : on n'ecrase pas l'existant.
        data[key] = { ...value, ...(isPlainObject(now[key]) ? now[key] : {}) };
        break;
      case SMART_ALERTS:
      case COSMETICS:
      case PREDICTION_RULE:
      case ACCENT:
        // Reglages simples : ceux de l'installation courante restent prioritaires.
        data[key] = now[key] !== undefined ? now[key] : value;
        break;
      default:
        break;
    }
  }
  return { data, addedStreamers };
}
