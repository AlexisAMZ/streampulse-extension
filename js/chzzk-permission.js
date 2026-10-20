// Demande de la permission d'accès à CHZZK (site, API et règle d'en-tête), depuis une page de l'extension
// (un clic de l'utilisateur est nécessaire). Une seule fenêtre d'acceptation. Une fois accordée, on pose
// tout de suite la règle d'en-tête et les scripts des pages de chaîne, sans attendre le service worker.
// Renvoie true si l'accès est accordé.

import { CHZZK_ACCESS } from "./chzzk.js";
import { syncChzzkAccess } from "./sw/chzzk-access.js";

export async function requestChzzkAccess() {
  try {
    const granted = (await chrome.permissions.contains(CHZZK_ACCESS)) || (await chrome.permissions.request(CHZZK_ACCESS));
    if (granted) await syncChzzkAccess();
    return granted;
  } catch {
    return false;
  }
}
