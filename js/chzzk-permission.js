// Demande de la permission d'accès à CHZZK (site et API), depuis une page de l'extension (un clic de
// l'utilisateur est nécessaire). Une fois accordée, on pose tout de suite la règle d'en-tête et les
// scripts des pages de chaîne, sans attendre le service worker. Renvoie true si l'accès est accordé.

import { CHZZK_PERMISSIONS } from "./chzzk.js";
import { syncChzzkAccess } from "./sw/chzzk-access.js";

export async function requestChzzkAccess() {
  const permission = { origins: CHZZK_PERMISSIONS };
  try {
    const granted = (await chrome.permissions.contains(permission)) || (await chrome.permissions.request(permission));
    if (granted) await syncChzzkAccess();
    return granted;
  } catch {
    return false;
  }
}
