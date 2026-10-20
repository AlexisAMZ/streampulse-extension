// Demande de la permission d'accès à CHZZK (API et site), depuis une page de l'extension (un clic de
// l'utilisateur est nécessaire). Une seule fenêtre d'acceptation. Renvoie true si l'accès est accordé.

import { CHZZK_PERMISSIONS } from "./chzzk.js";

export async function requestChzzkAccess() {
  const permission = { origins: CHZZK_PERMISSIONS };
  try {
    if (await chrome.permissions.contains(permission)) return true;
    return await chrome.permissions.request(permission);
  } catch {
    return false;
  }
}
