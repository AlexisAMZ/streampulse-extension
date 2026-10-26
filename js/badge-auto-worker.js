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
 * par le service worker ; l'état replié tient dans le sessionStorage de l'onglet.
 * Polices SP Unbounded / SP Onest : déclarées par css/topbar.css, injecté sur Twitch.
 */
function showAutoBanner(view) {
  const ID = "sp-badge-auto-banner";
  const FOLD_KEY = "spBadgeAutoFolded";
  const previous = document.getElementById(ID);
  previous?.remove();
  if (!view) return;
  if (!document.getElementById(`${ID}-style`)) {
    const style = document.createElement("style");
    style.id = `${ID}-style`;
    style.textContent = `
#${ID}{--ab-bg:#0b0c22;--ab-surface:#15173d;--ab-line:rgba(255,255,255,.1);--ab-text:#f4f2f7;--ab-text-2:rgba(244,242,247,.74);--ab-text-3:rgba(244,242,247,.6);--ab-lcd:#c6d4a0;--ab-lcd-ink:#1c2615;--ab-violet:#c4a3ff;--ab-warn:#ffd23f;
position:fixed;top:58px;left:50%;z-index:2147483000;transform:translateX(-50%);box-sizing:border-box;width:min(520px,calc(100vw - 24px));display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:0 12px;align-items:start;padding:14px;border:1px solid var(--ab-line);border-radius:16px;background:var(--ab-bg);color:var(--ab-text);box-shadow:0 18px 36px -18px rgba(0,0,0,.8),0 2px 6px rgba(0,0,0,.35);font:400 13px/1.4 "SP Onest",system-ui,-apple-system,"Segoe UI",sans-serif;text-align:start}
#${ID}.sp-ab-enter{animation:sp-ab-in .38s cubic-bezier(.16,1,.3,1)}
@keyframes sp-ab-in{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
#${ID} *{box-sizing:border-box}
#${ID} .sp-ab-logo{width:36px;height:36px;border-radius:10px;display:block}
#${ID} .sp-ab-main{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0}
#${ID} .sp-ab-head{display:flex;align-items:baseline;gap:8px;min-height:20px;padding-top:7px}
#${ID} .sp-ab-pulse{flex:none;align-self:center;width:8px;height:8px;border-radius:50%;background:var(--ab-lcd);box-shadow:0 0 0 0 rgba(198,212,160,.5);animation:sp-ab-pulse 2s ease-out infinite}
@keyframes sp-ab-pulse{70%{box-shadow:0 0 0 6px rgba(198,212,160,0)}100%{box-shadow:0 0 0 0 rgba(198,212,160,0)}}
#${ID} .sp-ab-title{min-width:0;margin:0;color:var(--ab-text);font:700 13px/1.35 "SP Unbounded",system-ui,sans-serif;letter-spacing:-.01em;text-wrap:balance}
#${ID} .sp-ab-pct{flex:none;margin-inline-start:auto;color:var(--ab-lcd);font:700 12px/1 "SP Unbounded",system-ui,sans-serif;font-variant-numeric:tabular-nums}
#${ID} .sp-ab-game{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
#${ID} .sp-ab-game-name{margin-inline-end:2px;color:var(--ab-violet);font-weight:700;font-size:14px}
#${ID} .sp-ab-chip{max-width:100%;overflow:hidden;padding:3px 9px;border:1px solid rgba(198,212,160,.32);border-radius:999px;background:rgba(198,212,160,.1);color:var(--ab-lcd);font-size:12px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
#${ID} .sp-ab-progress{display:grid;gap:6px;padding:10px 12px;border-radius:12px;background:var(--ab-surface)}
#${ID} .sp-ab-caption{display:flex;justify-content:space-between;gap:12px;color:var(--ab-text-2);font-size:12px;font-variant-numeric:tabular-nums}
#${ID} .sp-ab-caption b{color:var(--ab-text);font-weight:600}
#${ID} .sp-ab-track{height:6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}
#${ID} .sp-ab-fill{height:100%;border-radius:inherit;background:var(--ab-lcd);transition:width .6s cubic-bezier(.16,1,.3,1)}
#${ID} .sp-ab-warn{display:flex;gap:8px;align-items:flex-start;margin:0;padding:8px 10px;border-radius:10px;background:rgba(255,210,63,.1);color:var(--ab-warn);font-size:12px;font-weight:600}
#${ID} .sp-ab-warn svg{flex:none;margin-top:1px}
#${ID} .sp-ab-meta{display:grid;gap:2px;margin:0;color:var(--ab-text-3);font-size:12px}
#${ID} .sp-ab-meta span:first-child{color:var(--ab-text-2)}
#${ID} .sp-ab-actions{display:flex;gap:6px;align-items:center}
#${ID} button{display:inline-flex;align-items:center;justify-content:center;height:30px;margin:0;border:0;border-radius:9px;cursor:pointer;font:700 12px/1 "SP Onest",system-ui,sans-serif;transition:background-color .15s ease-out,color .15s ease-out}
#${ID} button:focus-visible{outline:2px solid var(--ab-lcd);outline-offset:2px}
#${ID} .sp-ab-fold{width:30px;padding:0;background:transparent;color:var(--ab-text-2)}
#${ID} .sp-ab-fold:hover{background:rgba(255,255,255,.08);color:var(--ab-text)}
#${ID} .sp-ab-fold svg{transition:transform .2s ease-out}
#${ID} .sp-ab-stop{padding:0 12px;background:rgba(255,255,255,.08);color:var(--ab-text)}
#${ID} .sp-ab-stop:hover{background:#ff8a80;color:#1a0b14}
#${ID}[data-folded]{align-items:center;padding-block:10px}
#${ID}[data-folded] .sp-ab-head{padding-top:0}
#${ID}[data-folded] .sp-ab-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ID}[data-folded] .sp-ab-logo{width:28px;height:28px;border-radius:8px}
#${ID}[data-folded] .sp-ab-body{display:none}
#${ID}[data-folded] .sp-ab-fold svg{transform:rotate(180deg)}
@media (prefers-reduced-motion:reduce){#${ID},#${ID} *{animation:none!important;transition:none!important}}`;
    document.documentElement.append(style);
  }

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const svg = (paths) => {
    const ns = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(ns, "svg");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.6");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    for (const d of paths) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      icon.append(path);
    }
    return icon;
  };
  let folded = false;
  try {
    folded = sessionStorage.getItem(FOLD_KEY) === "1";
  } catch (_) {
    // Stockage de session bloqué : bannière dépliée.
  }

  const bar = el("section");
  bar.id = ID;
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-label", view.title);
  if (!previous) bar.classList.add("sp-ab-enter");
  if (folded) bar.setAttribute("data-folded", "");

  const logo = el("img", "sp-ab-logo");
  logo.alt = "";
  logo.src = chrome.runtime.getURL("images/photos/logosp-128.png");

  const main = el("div", "sp-ab-main");
  const head = el("div", "sp-ab-head");
  head.append(el("span", "sp-ab-pulse"), el("p", "sp-ab-title", view.title));
  const progress = view.progress;
  const pct = progress ? Math.min(100, Math.round((progress.done / progress.required) * 100)) : null;
  if (pct != null) head.append(el("span", "sp-ab-pct", `${pct}%`));

  const body = el("div", "sp-ab-main sp-ab-body");
  const game = el("div", "sp-ab-game");
  game.setAttribute("aria-label", view.gameLabel);
  game.append(el("span", "sp-ab-game-name", view.game));
  for (const badge of view.badges) game.append(el("span", "sp-ab-chip", badge));
  body.append(game);

  if (progress) {
    const box = el("div", "sp-ab-progress");
    const caption = el("div", "sp-ab-caption");
    caption.append(el("b", "", progress.label), el("span", "", progress.remaining));
    const track = el("div", "sp-ab-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(progress.required));
    track.setAttribute("aria-valuenow", String(progress.done));
    track.setAttribute("aria-valuetext", progress.label);
    const fill = el("div", "sp-ab-fill");
    fill.style.width = `${pct}%`;
    track.append(fill);
    box.append(caption, track);
    body.append(box);
  }
  if (view.elsewhere) {
    const warn = el("p", "sp-ab-warn");
    warn.append(svg(["M8 2.5 14 13H2L8 2.5Z", "M8 6.5v3", "M8 11.4v.1"]), el("span", "", view.elsewhere));
    body.append(warn);
  }
  const meta = el("p", "sp-ab-meta");
  if (view.next) meta.append(el("span", "", view.next));
  meta.append(el("span", "", view.hint));
  body.append(meta);
  main.append(head, body);

  const actions = el("div", "sp-ab-actions");
  const fold = el("button", "sp-ab-fold");
  fold.type = "button";
  const syncFold = () => {
    const isFolded = bar.hasAttribute("data-folded");
    fold.setAttribute("aria-expanded", String(!isFolded));
    fold.setAttribute("aria-label", isFolded ? view.expand : view.collapse);
    fold.title = isFolded ? view.expand : view.collapse;
  };
  fold.append(svg(["M4 10l4-4 4 4"]));
  fold.addEventListener("click", () => {
    bar.toggleAttribute("data-folded");
    syncFold();
    try {
      sessionStorage.setItem(FOLD_KEY, bar.hasAttribute("data-folded") ? "1" : "0");
    } catch (_) {
      // Stockage bloqué : le repli vaut jusqu'à la prochaine mise à jour.
    }
  });
  syncFold();
  const stop = el("button", "sp-ab-stop", view.stop);
  stop.type = "button";
  stop.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "badgeAutoStop" }).catch((error) => console.warn("[StreamPulse] arrêt du mode auto :", error?.message || error));
    bar.remove();
  });
  actions.append(fold, stop);

  bar.append(logo, main, actions);
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

  /** Contenu de la bannière, dans la langue de l'utilisateur. */
  async function bannerView(state) {
    const stored = await chrome.storage.local.get(DROPS_PROGRESS_KEY);
    const model = bannerModel(state, progressFrom(stored).drops);
    if (!model) return null;
    const t = deps.translate;
    // Twitch ne fait progresser qu'un live à la fois : le dire plutôt que laisser croire au farm.
    const elsewhere = deps.audibleElsewhere ? await deps.audibleElsewhere(state.tabId) : false;
    return {
      title: await t(model.mode === "all" ? "background.badgeAuto.bannerAll" : "background.badgeAuto.bannerTitle"),
      game: model.game,
      badges: model.badges,
      gameLabel: await t("background.badgeAuto.bannerBadges", { game: model.game, badges: model.badges.join(", ") }),
      progress: model.minutes
        ? {
          ...model.minutes,
          label: await t("background.badgeAuto.bannerMinutes", model.minutes),
          remaining: await t("background.badgeAuto.bannerRemaining", { minutes: model.minutes.required - model.minutes.done }),
        }
        : null,
      next: model.nextBadges ? await t("background.badgeAuto.bannerNext", { badges: model.nextBadges, games: model.nextGames }) : "",
      elsewhere: elsewhere ? await t("background.badgeAuto.bannerElsewhere") : "",
      hint: await t("background.badgeAuto.bannerHint"),
      stop: await t("background.badgeAuto.bannerStop"),
      collapse: await t("background.badgeAuto.bannerCollapse"),
      expand: await t("background.badgeAuto.bannerExpand"),
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
