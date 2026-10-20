// Accès à CHZZK : des permissions demandées à l'ajout d'une chaîne (pas à l'installation, pour ne rien
// imposer aux autres utilisateurs), la règle qui présente l'origine du site à l'API, et les scripts
// des pages de chaîne (bouton d'ajout, latence).

import { CHZZK_HOST_PERMISSION, CHZZK_PAGE_SCRIPT_IDS, CHZZK_RULE_ID, chzzkOriginRule, chzzkPageScripts } from "../chzzk.js";

async function granted(origin) {
  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

export const hasChzzkAccess = () => granted(CHZZK_HOST_PERMISSION);

async function syncHeaderRule() {
  const rule = chzzkOriginRule(chrome.runtime?.id);
  const allowed = rule !== null && (await hasChzzkAccess());
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [CHZZK_RULE_ID], addRules: allowed ? [rule] : [] });
  } catch (error) {
    console.warn("[chzzk] règle d'en-tête :", error?.message || error);
  }
}

async function syncPageScripts() {
  const desired = chzzkPageScripts();
  const wanted = new Set(desired.map((script) => script.id));
  try {
    const registered = new Set((await chrome.scripting.getRegisteredContentScripts({ ids: CHZZK_PAGE_SCRIPT_IDS })).map((script) => script.id));
    const allowed = await hasChzzkAccess();
    const stale = [...registered].filter((id) => !allowed || !wanted.has(id));
    if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });
    if (!allowed) return;
    const toUpdate = desired.filter((script) => registered.has(script.id));
    const toAdd = desired.filter((script) => !registered.has(script.id));
    if (toUpdate.length) await chrome.scripting.updateContentScripts(toUpdate);
    if (toAdd.length) await chrome.scripting.registerContentScripts(toAdd);
  } catch (error) {
    console.warn("[chzzk] scripts des pages :", error?.message || error);
  }
}

/** Aligne la règle d'en-tête et les scripts de page sur les permissions accordées. Sans danger à répéter. */
export async function syncChzzkAccess() {
  await Promise.all([syncHeaderRule(), syncPageScripts()]);
}
