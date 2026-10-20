// Demande de la permission d'accès à l'API de CHZZK, depuis une page de l'extension (un clic de
// l'utilisateur est nécessaire). Renvoie true si l'accès est accordé.

import { CHZZK_HOST_PERMISSION } from "./chzzk.js";

export async function requestChzzkAccess() {
  const permission = { origins: [CHZZK_HOST_PERMISSION] };
  try {
    if (await chrome.permissions.contains(permission)) return true;
    return await chrome.permissions.request(permission);
  } catch {
    return false;
  }
}
