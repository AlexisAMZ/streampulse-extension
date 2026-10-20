// Bandeau « active le bouton et la latence sur CHZZK » : pour les chaînes CHZZK déjà suivies avant
// que ces fonctions existent, l'accès à l'API est accordé mais pas celui du site, donc aucun script
// n'est posé sur chzzk.naver.com. La permission ne peut se demander que sur un clic dans une page
// de l'extension : d'où ce bandeau, qui disparaît dès que l'accès est accordé.

import { CHZZK_ACCESS } from "./chzzk.js";
import { requestChzzkAccess } from "./chzzk-permission.js";

const $ = (id) => document.getElementById(id);

async function pagesAccessMissing() {
  try {
    return !(await chrome.permissions.contains(CHZZK_ACCESS));
  } catch {
    return false;
  }
}

function bannerNeeded(getStreamers) {
  const followsChzzk = (getStreamers() || []).some((streamer) => streamer.platform === "chzzk");
  return followsChzzk ? pagesAccessMissing() : Promise.resolve(false);
}

/** Montre le bandeau si une chaîne CHZZK est suivie et que l'accès au site manque. */
export function initChzzkAsk(getStreamers) {
  const banner = $("chzzk-ask");
  const action = $("chzzk-ask-enable");
  if (!banner || !action) return;
  bannerNeeded(getStreamers).then((needed) => {
    banner.hidden = !needed;
  });
  action.addEventListener("click", () => {
    requestChzzkAccess().then((granted) => {
      if (granted) banner.hidden = true;
    });
  });
}
