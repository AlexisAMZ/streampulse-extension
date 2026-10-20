// Accès à CHZZK : des permissions demandées à l'ajout d'une chaîne (pas à l'installation, pour ne rien
// imposer aux autres utilisateurs), la règle qui présente l'origine du site à l'API, et les scripts
// des pages de chaîne (bouton d'ajout, latence).

import { CHZZK_HOST_PERMISSION, CHZZK_RULE_ID, CHZZK_SITE_PERMISSION, chzzkOriginRule, chzzkPageScripts } from "../chzzk.js";

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
  const scripts = chzzkPageScripts();
  try {
    const registered = new Set((await chrome.scripting.getRegisteredContentScripts({ ids: scripts.map((script) => script.id) })).map((script) => script.id));
    if (await granted(CHZZK_SITE_PERMISSION)) {
      const missing = scripts.filter((script) => !registered.has(script.id));
      if (missing.length) await chrome.scripting.registerContentScripts(missing);
    } else if (registered.size) {
      await chrome.scripting.unregisterContentScripts({ ids: [...registered] });
    }
  } catch (error) {
    console.warn("[chzzk] scripts des pages :", error?.message || error);
  }
}

/** Aligne la règle d'en-tête et les scripts de page sur les permissions accordées. Sans danger à répéter. */
export async function syncChzzkAccess() {
  await Promise.all([syncHeaderRule(), syncPageScripts()]);
}
