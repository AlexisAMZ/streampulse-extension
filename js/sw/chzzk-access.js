// Accès à l'API de CHZZK : une permission demandée à l'ajout d'une chaîne (pas à l'installation,
// pour ne rien imposer aux autres utilisateurs) et la règle qui présente l'origine du site.

import { CHZZK_HOST_PERMISSION, CHZZK_RULE_ID, chzzkOriginRule } from "../chzzk.js";

export async function hasChzzkAccess() {
  try {
    return await chrome.permissions.contains({ origins: [CHZZK_HOST_PERMISSION] });
  } catch {
    return false;
  }
}

/** Pose la règle si la permission est accordée, la retire sinon. Sans danger à répéter. */
export async function syncChzzkAccess() {
  const rule = chzzkOriginRule(chrome.runtime?.id);
  const granted = rule !== null && (await hasChzzkAccess());
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [CHZZK_RULE_ID], addRules: granted ? [rule] : [] });
  } catch (error) {
    console.warn("[chzzk] règle d'en-tête :", error?.message || error);
  }
}
