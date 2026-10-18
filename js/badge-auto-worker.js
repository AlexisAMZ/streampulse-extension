// Mode auto des badges, côté service worker : un onglet épinglé et muet
// regarde un live du jeu en tête de file (js/badge-auto.js), passe au jeu
// suivant quand tous ses badges sont obtenus, et affiche une bannière sur la
// page. Une alarme dédiée passe toutes les 2 minutes tant que le mode tourne :
// live terminé, badge gagné ou onglet figé sont repris sans attendre l'alarme
// des Drops. Les Drops prêts sont récupérés par l'alarme habituelle.

import { BADGE_ADDED_KEY, BADGE_AUTO_KEY, BADGE_EVENTS_KEY, DROPS_BADGES_KEY, DROPS_PROGRESS_KEY, progressFrom } from "./drops-data.js";
import { BADGE_AUTO_ALARM } from "./sw/constants.js";
import { addedFrom, badgesFrom, catalogBadges, eventsFrom } from "./badges-data.js";
import { addJobs, bannerModel, currentGroup, freeBadgeJobs, normalizeAuto, pruneJobs, removeJob } from "./badge-auto.js";
import { PLUS_KEY, isPlusActive } from "./plus.js";
import { BADGE_FREE_KEY, dayKey, freeAvailable, isFreeRun } from "./badge-free.js";
import { recordPlusValue } from "./sw/plus-value.js";

const channelOf = (url) => (String(url || "").match(/^https:\/\/www\.twitch\.tv\/([a-z0-9_]{2,25})\/?(?:[?#]|$)/i) || [])[1] || "";

/**
 * Exécuté dans la page Twitch (monde isolé, le DOM est partagé) : sonde de
 * lecture — l'élément <video> reste stable là où l'API du lecteur de Twitch
 * change à chaque refonte.
 */
export function watchProbe() {
  const video = document.querySelector("video");
  return video ? { paused: Boolean(video.paused), t: Number(video.currentTime) || 0 } : null;
}

/**
 * Exécuté dans la page Twitch (monde isolé) : bannière du mode auto, posée en
 * haut de la page et remplacée à chaque mise à jour. Le bouton Arrêter passe
 * par le service worker.
 */
function showAutoBanner(view) {
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
    chrome.runtime.sendMessage({ type: "badgeAutoStop" }).catch((error) => console.warn("[StreamPulse] arrêt du mode auto :", error?.message || error));
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
 *   videoHeight?: () => Promise<number>,                     // hauteur cible du lecteur (360, ou 160 en économie)
 *   probeTab?: (tabId: number) => Promise<{paused: boolean, t: number}|null>,
 *   audibleElsewhere?: (tabId: number) => Promise<boolean>,  // un autre onglet Twitch sonore (l'utilisateur regarde ailleurs)
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

  /** Le mode auto des badges est une fonctionnalité Plus : la licence peut
   * expirer (résiliation, remboursement, grâce dépassée) en cours de route. */
  const plusActive = async () => isPlusActive((await chrome.storage.local.get(PLUS_KEY))[PLUS_KEY]);
  /** Sans Plus : un badge gratuit par jour (js/badge-free.js). */
  const freeRecord = async () => (await chrome.storage.local.get(BADGE_FREE_KEY))[BADGE_FREE_KEY];

  /** Hauteur cible du lecteur : 160p en économie de bande passante, 360p sinon. */
  const height = async () => {
    try {
      const value = deps.videoHeight ? Number(await deps.videoHeight()) : 360;
      return Number.isFinite(value) && value > 0 ? value : 360;
    } catch (_) {
      return 360;
    }
  };

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
    // Mute avant la première navigation : un onglet créé directement sur
    // l'URL peut émettre un son entre sa création et sa mise en sourdine.
    const tab = await chrome.tabs.create({ active: false, pinned: true });
    await chrome.tabs.update(tab.id, { muted: true });
    await chrome.tabs.update(tab.id, { url });
    return tab.id;
  }

  async function closeTab(tabId) {
    if (await tabExists(tabId)) await chrome.tabs.remove(tabId).catch(() => {}); // Onglet fermé entre-temps : attendu.
  }

  /** L'alarme dédiée ne tourne que pendant le mode auto : créée à l'activation,
   * effacée dès que l'état disparaît — quel que soit le chemin d'arrêt. */
  const syncAlarm = (active) => {
    if (!chrome.alarms) return;
    if (!active) {
      try {
        chrome.alarms.clear(BADGE_AUTO_ALARM, () => void chrome.runtime.lastError);
      } catch (_) {
        // Pas d'API alarms (vieux navigateur) : le mode tourne sans alarme dédiée.
      }
      return;
    }
    try {
      chrome.alarms.get(BADGE_AUTO_ALARM, (existing) => {
        if (chrome.runtime.lastError) return;
        if (!existing) chrome.alarms.create(BADGE_AUTO_ALARM, { periodInMinutes: 2, delayInMinutes: 1 });
      });
    } catch (_) {
      // Idem : sans API alarms, les passages suivent les alarmes des Drops.
    }
  };

  /** Texte de la bannière, dans la langue de l'utilisateur. */
  async function bannerView(state) {
    const stored = await chrome.storage.local.get(DROPS_PROGRESS_KEY);
    const model = bannerModel(state, progressFrom(stored).drops);
    if (!model) return null;
    const elsewhere = deps.audibleElsewhere ? await deps.audibleElsewhere(state.tabId) : false;
    const lines = [
      await deps.translate("background.badgeAuto.bannerBadges", { game: model.game, badges: model.badges.join(", ") }),
    ];
    if (model.minutes) lines.push(await deps.translate("background.badgeAuto.bannerMinutes", model.minutes));
    if (model.nextBadges) lines.push(await deps.translate("background.badgeAuto.bannerNext", { badges: model.nextBadges, games: model.nextGames }));
    // Twitch ne fait progresser qu'un live à la fois : le dire plutôt que laisser croire au farm.
    if (elsewhere) lines.push(await deps.translate("background.badgeAuto.bannerElsewhere"));
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
    await chrome.scripting.executeScript({ target: { tabId: state.tabId }, func: showAutoBanner, args: [view] }).catch((error) => console.warn("[StreamPulse] bandeau du mode auto :", error?.message || error));
  }

  /** Badges en cours avec le Drop qui les donne (pour « tous les badges »). */
  async function catalog() {
    const stored = await chrome.storage.local.get([DROPS_BADGES_KEY, BADGE_EVENTS_KEY, BADGE_ADDED_KEY]);
    return catalogBadges(badgesFrom(stored), { status: "live", now: Date.now(), events: eventsFrom(stored).events, added: addedFrom(stored).added });
  }

  /** Sonde de lecture de l'onglet ; null quand rien n'est mesurable (page de
   * répertoire, onglet en cours de chargement, script impossible). */
  const watchTab = async (tabId, login) => {
    if (!login || !deps.probeTab) return null;
    const result = await deps.probeTab(tabId).catch(() => null);
    return result && Number.isFinite(Number(result.t))
      ? { t: Number(result.t), at: Date.now(), paused: result.paused === true }
      : null;
  };

  /** Réinjection du script lecteur (reprise de lecture, qualité, volume). */
  const reinjectPlayer = async (tabId) => {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: deps.lowPowerPlayer, args: [await height()] });
    } catch (error) {
      console.warn("[StreamPulse] réinjection du lecteur :", error?.message || error);
    }
  };

  /**
   * Un passage : retire les badges obtenus ou expirés, complète la file en
   * mode « tous », puis garde l'onglet sur un live du jeu en tête de file.
   * La vigie de santé reprend un onglet déchargé par le navigateur, relance
   * une lecture en pause, et repart d'une page neuve si le temps de lecture
   * n'a pas bougé depuis le passage précédent.
   */
  const check = () => serial(async () => {
    let state = await read();
    if (!state) {
      syncAlarm(false);
      return;
    }
    // Plus inactif : on arrête tout au passage suivant, comme si l'utilisateur
    // avait arrêté lui-même (état retiré, onglet fermé), et on le dit ; sauf
    // le badge gratuit du jour, qui va jusqu'au bout.
    const plus = await plusActive();
    if (!plus && !isFreeRun(state, await freeRecord())) {
      await chrome.storage.local.remove(BADGE_AUTO_KEY);
      await closeTab(state.tabId);
      syncAlarm(false);
      await deps.notify("background.notifications.badgeAutoTitle", "background.badgeAuto.stoppedPlus");
      return;
    }
    const owned = badgesFrom(await chrome.storage.local.get(DROPS_BADGES_KEY)).owned;
    if (state.mode === "all") state = addJobs(state, freeBadgeJobs(await catalog()));
    const { state: next, obtained } = pruneJobs(state, { owned, now: Date.now() });
    state = next;

    for (const job of obtained) await deps.notify("background.notifications.badgeAutoTitle", "background.badgeAuto.obtained", { name: job.title });
    // Compteur de valeur : badges farmés par le mode auto, réservé à Plus.
    if (plus && obtained.length) recordPlusValue({ badges: obtained.length }).catch(() => {});
    // Badge gratuit obtenu : on montre ce que Plus récupérerait encore.
    if (!plus && obtained.length) {
      const remaining = freeBadgeJobs(await catalog()).filter((job) => !owned.includes(job.badgeId) && !obtained.some((done) => done.badgeId === job.badgeId)).length;
      if (remaining > 0) await deps.notify("background.badgeAuto.freeDoneTitle", "background.badgeAuto.freeDoneMessage", { count: remaining });
    }

    const group = currentGroup(state);
    if (!group) {
      await chrome.storage.local.remove(BADGE_AUTO_KEY);
      await closeTab(state.tabId);
      syncAlarm(false);
      if (state.mode === "all" || obtained.length) await deps.notify("background.badgeAuto.doneTitle", "background.badgeAuto.doneMessage");
      return;
    }

    // Onglet vivant ET réellement en train de lire. Un onglet déchargé par le
    // navigateur existe toujours côté API tabs : il faut repartir d'une page
    // neuve, pas le croire en train de regarder.
    const tab = (await tabExists(state.tabId)) ? await chrome.tabs.get(state.tabId).catch(() => null) : null;
    let move = !tab || tab.discarded === true || state.gameKey !== group.key;
    if (!move) {
      const login = channelOf(tab.url);
      const gameId = login ? await deps.streamGameOf(login) : "";
      // null : Helix ne répond pas, on garde l'onglet plutôt que de changer à l'aveugle.
      move = gameId !== null && (!gameId || (group.gameId && gameId !== group.gameId));
      if (!move) {
        const watched = await watchTab(state.tabId, login);
        if (!watched) {
          state = { ...state, video: null };
        } else if (watched.paused) {
          // En pause : le script injecté relance la lecture. Encore en pause au
          // passage suivant, on repart d'une page neuve plutôt que de stagner.
          if (state.video?.paused) move = true;
          else await reinjectPlayer(state.tabId);
          state = { ...state, video: watched };
        } else if (state.video && !state.video.paused && state.video.t === watched.t) {
          // Temps de lecture inchangé entre deux passages : onglet figé.
          move = true;
          state = { ...state, video: watched };
        } else {
          state = { ...state, video: watched };
        }
      }
    }
    if (move) state = { ...state, tabId: await openTab(group, tab ? state.tabId : 0), gameKey: group.key, video: null };
    await write(state);
    syncAlarm(true);
    await paintBanner(state);
  });

  /** Ajoute un badge à la file (ou lance « tous les badges possibles »). */
  const start = ({ job = null, all = false } = {}) => serial(async () => {
    // Même garde que l'interface (le volet badges n'apparaît qu'aux abonnés) :
    // un démarrage direct par message ne doit pas contourner la licence.
    const previous = await read();
    if (!(await plusActive())) {
      // Sans Plus : un seul badge, choisi à la main, une fois par jour.
      const badgeId = job?.badgeId || "";
      const busy = previous?.jobs.some((item) => item.badgeId !== badgeId);
      if (all || !badgeId || busy || !freeAvailable(await freeRecord(), badgeId)) return { started: false, plusRequired: true };
      await chrome.storage.local.set({ [BADGE_FREE_KEY]: { day: dayKey(), badgeId } });
    }
    let state = addJobs(previous, job ? [job] : [], all ? { mode: "all" } : {});
    if (all) state = addJobs(state, freeBadgeJobs(await catalog()));
    if (!state.jobs.length) return { started: false };
    if (!previous || !(await tabExists(state.tabId))) {
      const group = currentGroup(state);
      state = { ...state, tabId: await openTab(group, 0), gameKey: group.key, startedAt: Date.now(), video: null };
    }
    await write(state);
    deps.onStart();
    await paintBanner(state);
    return { started: true, count: state.jobs.length };
  }).then(async (result) => {
    await check();
    return result;
  });

  /** Ajoute des tâches à une file déjà lancée (nouveaux badges apparus). */
  const enqueueJobs = (jobs) => serial(async () => {
    const state = await read();
    if (!state || !(jobs || []).length) return null;
    await write(addJobs(state, jobs));
    return true;
  }).then(() => check());

  const isActive = async () => Boolean(await read());

  /**
   * Nouveaux badges apparus au catalogue (StreamPulse+) : sans file, « tous les
   * badges possibles » démarre et rattrape tout ; avec une file, ils s'y
   * ajoutent sans toucher au mode choisi.
   */
  const autoFarm = async (badgeIds = []) => {
    const wanted = new Set(badgeIds || []);
    if (!wanted.size) return { started: false };
    const owned = badgesFrom(await chrome.storage.local.get(DROPS_BADGES_KEY)).owned;
    const jobs = freeBadgeJobs(await catalog()).filter((job) => wanted.has(job.badgeId) && !owned.includes(job.badgeId));
    if (!jobs.length) return { started: false };
    if (await isActive()) {
      await enqueueJobs(jobs);
      return { started: true, count: jobs.length };
    }
    return start({ all: true });
  };

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
    if (changeInfo.status !== "complete") return Promise.resolve();
    return read()
      .then(async (state) => {
        if (state?.tabId !== tabId) return;
        await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: deps.lowPowerPlayer, args: [await height()] });
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

  return { check, start, stop, enqueueJobs, autoFarm, onTabUpdated, onTabRemoved, isActive };
}
