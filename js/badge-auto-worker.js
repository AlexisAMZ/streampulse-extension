// Mode auto des badges, côté service worker : un onglet épinglé et muet
// regarde un live du jeu en tête de file (js/badge-auto.js), passe au jeu
// suivant quand tous ses badges sont obtenus, et affiche une bannière sur la
// page. Les Drops prêts sont récupérés par l'alarme habituelle des Drops.

import { BADGE_AUTO_KEY, DROPS_BADGES_KEY, DROPS_CAMPAIGNS_KEY, DROPS_PROGRESS_KEY, badgesFrom, campaignsFrom, catalogBadges, progressFrom } from "./drops-data.js";
import { addJobs, bannerModel, currentGroup, freeBadgeJobs, normalizeAuto, pruneJobs, removeJob } from "./badge-auto.js";

const channelOf = (url) => (String(url || "").match(/^https:\/\/www\.twitch\.tv\/([a-z0-9_]{2,25})\/?(?:[?#]|$)/i) || [])[1] || "";

/**
 * Exécuté dans la page Twitch (monde isolé) : bannière du mode auto, posée en
 * haut de la page et remplacée à chaque mise à jour. Le bouton Arrêter passe
 * par le service worker.
 */
export function showAutoBanner(view) {
  const ID = "sp-badge-auto-banner";
  document.getElementById(ID)?.remove();
  if (!view) return;
  const bar = document.createElement("div");
  bar.id = ID;
  bar.setAttribute("role", "status");
  bar.style.cssText = [
    "position:fixed", "top:58px", "left:50%", "transform:translateX(-50%)", "z-index:2147483000",
    "display:flex", "align-items:center", "gap:12px", "max-width:min(760px,calc(100vw - 24px))",
    "padding:10px 12px 10px 16px", "border-radius:14px", "background:#1B1F4A", "color:#fff",
    "box-shadow:0 10px 30px rgba(0,0,0,.45)", "font:600 13px/1.35 system-ui,-apple-system,'Segoe UI',sans-serif",
  ].join(";");
  const dot = document.createElement("span");
  dot.style.cssText = "flex:none;width:9px;height:9px;border-radius:50%;background:#C6D4A0";
  const body = document.createElement("div");
  body.style.cssText = "display:grid;gap:2px;min-width:0";
  const title = document.createElement("strong");
  title.textContent = view.title;
  title.style.cssText = "color:#C6D4A0;font-size:12px;letter-spacing:.02em;text-transform:uppercase";
  body.append(title);
  for (const line of view.lines) {
    const row = document.createElement("span");
    row.textContent = line;
    row.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    body.append(row);
  }
  const stop = document.createElement("button");
  stop.type = "button";
  stop.textContent = view.stop;
  stop.style.cssText = "flex:none;margin-left:auto;padding:7px 12px;border:0;border-radius:10px;background:#E6E3EC;color:#1A0B14;font:800 12px system-ui,sans-serif;cursor:pointer";
  stop.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "badgeAutoStop" }).catch(() => {});
    bar.remove();
  });
  bar.append(dot, body, stop);
  document.documentElement.append(bar);
}

/**
 * @param {{
 *   streamUrl: (game: {gameId: string, game: string}) => Promise<string>,
 *   streamGameOf: (login: string) => Promise<string|null>,   // jeu du live en cours, "" hors ligne, null si inconnu
 *   notify: (titleKey: string, messageKey: string, params?: object) => Promise<void>,
 *   translate: (key: string, params?: object) => Promise<string>,
 *   onStart: () => void,
 *   lowPowerPlayer: Function,
 * }} deps
 */
export function createBadgeAuto(deps) {
  let queue = Promise.resolve();
  /** Une seule lecture-écriture de l'état à la fois (popup, alarmes, onglets). */
  const serial = (task) => {
    const run = queue.then(task, task);
    queue = run.catch((error) => console.warn("[StreamPulse] mode auto badges :", error?.message || error));
    return run;
  };

  const read = async () => normalizeAuto((await chrome.storage.local.get(BADGE_AUTO_KEY))[BADGE_AUTO_KEY]);
  const write = (state) => chrome.storage.local.set({ [BADGE_AUTO_KEY]: state });

  async function tabExists(tabId) {
    if (!tabId) return false;
    try {
      return Boolean(await chrome.tabs.get(tabId));
    } catch (_) {
      return false;
    }
  }

  async function openTab(group, tabId) {
    const url = await deps.streamUrl({ gameId: group.gameId, game: group.game });
    if (await tabExists(tabId)) {
      await chrome.tabs.update(tabId, { url, pinned: true, muted: true });
      return tabId;
    }
    const tab = await chrome.tabs.create({ url, active: false, pinned: true });
    await chrome.tabs.update(tab.id, { muted: true });
    return tab.id;
  }

  async function closeTab(tabId) {
    if (await tabExists(tabId)) await chrome.tabs.remove(tabId).catch(() => {});
  }

  /** Texte de la bannière, dans la langue de l'utilisateur. */
  async function bannerView(state) {
    const stored = await chrome.storage.local.get(DROPS_PROGRESS_KEY);
    const model = bannerModel(state, progressFrom(stored).drops);
    if (!model) return null;
    const lines = [
      await deps.translate("background.badgeAuto.bannerBadges", { game: model.game, badges: model.badges.join(", ") }),
    ];
    if (model.minutes) lines.push(await deps.translate("background.badgeAuto.bannerMinutes", model.minutes));
    if (model.nextBadges) lines.push(await deps.translate("background.badgeAuto.bannerNext", { badges: model.nextBadges, games: model.nextGames }));
    lines.push(await deps.translate("background.badgeAuto.bannerHint"));
    return {
      title: await deps.translate(model.mode === "all" ? "background.badgeAuto.bannerAll" : "background.badgeAuto.bannerTitle"),
      lines,
      stop: await deps.translate("background.badgeAuto.bannerStop"),
    };
  }

  async function paintBanner(state) {
    if (!(await tabExists(state?.tabId))) return;
    const view = await bannerView(state);
    await chrome.scripting.executeScript({ target: { tabId: state.tabId }, func: showAutoBanner, args: [view] }).catch(() => {});
  }

  /** Badges du catalogue avec leur campagne en cours (pour « tous les badges »). */
  async function catalog() {
    const stored = await chrome.storage.local.get([DROPS_BADGES_KEY, DROPS_CAMPAIGNS_KEY]);
    return catalogBadges(badgesFrom(stored), "all", "", { now: Date.now(), campaigns: campaignsFrom(stored).campaigns });
  }

  /**
   * Un passage : retire les badges obtenus ou expirés, complète la file en
   * mode « tous », puis garde l'onglet sur un live du jeu en tête de file.
   */
  const check = () => serial(async () => {
    let state = await read();
    if (!state) return;
    const owned = badgesFrom(await chrome.storage.local.get(DROPS_BADGES_KEY)).owned;
    if (state.mode === "all") state = addJobs(state, freeBadgeJobs(await catalog()));
    const { state: next, obtained } = pruneJobs(state, { owned, now: Date.now() });
    state = next;

    for (const job of obtained) await deps.notify("background.notifications.badgeAutoTitle", "background.badgeAuto.obtained", { name: job.title });

    const group = currentGroup(state);
    if (!group) {
      await chrome.storage.local.remove(BADGE_AUTO_KEY);
      await closeTab(state.tabId);
      if (state.mode === "all" || obtained.length) await deps.notify("background.badgeAuto.doneTitle", "background.badgeAuto.doneMessage");
      return;
    }

    // Autre jeu en tête, onglet fermé, live terminé ou passé sur un autre jeu : nouveau live.
    const tabAlive = await tabExists(state.tabId);
    let move = !tabAlive || state.gameKey !== group.key;
    if (!move) {
      const tab = await chrome.tabs.get(state.tabId);
      const login = channelOf(tab.url);
      const gameId = login ? await deps.streamGameOf(login) : "";
      // null : Helix ne répond pas, on garde l'onglet plutôt que de changer à l'aveugle.
      move = gameId !== null && (!gameId || (group.gameId && gameId !== group.gameId));
    }
    if (move) state = { ...state, tabId: await openTab(group, tabAlive ? state.tabId : 0), gameKey: group.key };
    await write(state);
    await paintBanner(state);
  });

  /** Ajoute un badge à la file (ou lance « tous les badges possibles »). */
  const start = ({ job = null, all = false } = {}) => serial(async () => {
    const previous = await read();
    let state = addJobs(previous, job ? [job] : [], all ? { mode: "all" } : {});
    if (all) state = addJobs(state, freeBadgeJobs(await catalog()));
    if (!state.jobs.length) return { started: false };
    if (!previous || !(await tabExists(state.tabId))) {
      const group = currentGroup(state);
      state = { ...state, tabId: await openTab(group, 0), gameKey: group.key, startedAt: Date.now() };
    }
    await write(state);
    deps.onStart();
    await paintBanner(state);
    return { started: true, count: state.jobs.length };
  }).then(async (result) => {
    await check();
    return result;
  });

  /** Retire un badge de la file ; sans badge, arrête tout et ferme l'onglet. */
  const stop = (badgeId = "") => serial(async () => {
    const state = await read();
    if (!state) return;
    const next = badgeId ? removeJob(state, badgeId) : null;
    if (next?.jobs.length) {
      // Retirer un badge ne change pas le mode : « tous » le reprendrait au passage suivant.
      await write({ ...next, mode: "manual" });
      return;
    }
    await chrome.storage.local.remove(BADGE_AUTO_KEY);
    await closeTab(state.tabId);
  }).then(() => check());

  function onTabUpdated(tabId, changeInfo) {
    if (changeInfo.status !== "complete") return;
    read()
      .then(async (state) => {
        if (state?.tabId !== tabId) return;
        await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: deps.lowPowerPlayer });
        await paintBanner(state);
      })
      .catch((error) => console.warn("[StreamPulse] mode auto badges, onglet :", error?.message || error));
  }

  function onTabRemoved(tabId) {
    serial(async () => {
      const state = await read();
      // Onglet fermé par l'utilisateur : le mode auto s'arrête avec lui.
      if (state?.tabId === tabId) await chrome.storage.local.remove(BADGE_AUTO_KEY);
    });
  }

  return { check, start, stop, onTabUpdated, onTabRemoved, isActive: async () => Boolean(await read()) };
}
