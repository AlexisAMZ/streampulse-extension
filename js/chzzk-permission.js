// Demande de la permission d'accès à CHZZK (site, API et règle d'en-tête), depuis une page de l'extension
// (un clic de l'utilisateur est nécessaire). Une seule fenêtre d'acceptation. Une fois accordée, on pose
// tout de suite la règle d'en-tête et les scripts des pages de chaîne, sans attendre le service worker.
// Renvoie true si l'accès est accordé.

import { CHZZK_ACCESS } from "./chzzk.js";
import { syncChzzkAccess } from "./sw/chzzk-access.js";

const SYNC_PAGE = "html/chzzk-sync.html";
const SYNC_TIMEOUT_MS = 4000;

/**
 * Une API obtenue par permission facultative n'existe pas toujours dans une page déjà ouverte : sans la
 * règle d'en-tête, l'ajout d'une chaîne échouait jusqu'au rechargement de l'extension. On la pose donc
 * depuis une page neuve, invisible, créée après l'accord. Ne bloque jamais plus de SYNC_TIMEOUT_MS.
 */
function syncFromFreshPage() {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    const finish = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
      resolve();
    };
    const onMessage = (event) => {
      if (event.source === frame.contentWindow && event.data?.type === "chzzk-sync-done") finish();
    };
    const timer = setTimeout(finish, SYNC_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    frame.src = chrome.runtime.getURL(SYNC_PAGE);
    document.body.appendChild(frame);
  });
}

export async function requestChzzkAccess() {
  try {
    const granted = (await chrome.permissions.contains(CHZZK_ACCESS)) || (await chrome.permissions.request(CHZZK_ACCESS));
    if (granted) {
      await syncChzzkAccess();
      await syncFromFreshPage();
    }
    return granted;
  } catch {
    return false;
  }
}
