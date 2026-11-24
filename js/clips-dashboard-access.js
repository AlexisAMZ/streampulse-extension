// Accès au gestionnaire de clips du tableau de bord Twitch (dashboard.twitch.tv) : permission facultative,
// demandée quand l'utilisateur active le réglage (pas à l'installation, pour ne rien imposer aux autres), puis
// script de page enregistré tant que l'accès est accordé. Même schéma que l'accès à CHZZK (js/sw/chzzk-access.js).

export const CLIPS_DASHBOARD_ORIGIN = "https://dashboard.twitch.tv";
export const CLIPS_DASHBOARD_ACCESS = { origins: [`${CLIPS_DASHBOARD_ORIGIN}/*`] };
export const CLIPS_DASHBOARD_SCRIPT_ID = "sp-clips-dashboard";

/** Script de page à enregistrer, seulement sur le gestionnaire de clips. */
export function clipsDashboardScripts() {
  return [{
    id: CLIPS_DASHBOARD_SCRIPT_ID,
    matches: [`${CLIPS_DASHBOARD_ORIGIN}/u/*/content/clips/*`],
    js: ["js/inject/i18n-inline.js", "js/inject/clips-handoff.js", "js/clipsDashboard.js"],
    runAt: "document_idle",
    persistAcrossSessions: true,
  }];
}

export async function hasClipsDashboardAccess() {
  try {
    return await chrome.permissions.contains(CLIPS_DASHBOARD_ACCESS);
  } catch {
    return false;
  }
}

/** Demande l'accès (un clic de l'utilisateur est nécessaire). Renvoie true s'il est accordé. */
export async function requestClipsDashboardAccess() {
  try {
    return (await hasClipsDashboardAccess()) || (await chrome.permissions.request(CLIPS_DASHBOARD_ACCESS));
  } catch {
    return false;
  }
}

/** Retire l'accès. Renvoie true s'il est retiré (Firefox refuse de retirer une permission déclarée au manifest). */
export async function removeClipsDashboardAccess() {
  try {
    return await chrome.permissions.remove(CLIPS_DASHBOARD_ACCESS);
  } catch {
    return false;
  }
}

/** Aligne l'enregistrement du script de page sur l'accès accordé. Sans danger à répéter. */
export async function syncClipsDashboardAccess() {
  const desired = clipsDashboardScripts();
  try {
    if (!chrome.scripting?.getRegisteredContentScripts) return;
    const registered = new Set((await chrome.scripting.getRegisteredContentScripts({ ids: [CLIPS_DASHBOARD_SCRIPT_ID] })).map((script) => script.id));
    if (!(await hasClipsDashboardAccess())) {
      if (registered.size) await chrome.scripting.unregisterContentScripts({ ids: [...registered] });
      return;
    }
    if (registered.size) await chrome.scripting.updateContentScripts(desired);
    else await chrome.scripting.registerContentScripts(desired);
  } catch (error) {
    console.warn("[clips-dashboard] script de page :", error?.message || error);
  }
}
