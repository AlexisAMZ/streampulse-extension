// Accès réseau de la restauration audio VOD (bêta) : règles de redirection sur les segments hébergés par
// CloudFront. Facultatif : il n'est demandé qu'au moment où l'utilisateur active le réglage (un clic est
// nécessaire), pour que la mise à jour n'affiche aucune nouvelle autorisation et ne désactive personne.

export const VOD_UNMUTE_ACCESS = {
  permissions: ["declarativeNetRequestWithHostAccess"],
  origins: ["https://*.cloudfront.net/*"],
};

/** Renvoie true si l'accès est déjà accordé ou vient de l'être. */
export async function requestVodUnmuteAccess() {
  try {
    return (await chrome.permissions.contains(VOD_UNMUTE_ACCESS)) || (await chrome.permissions.request(VOD_UNMUTE_ACCESS));
  } catch {
    return false;
  }
}
