// Page invisible, ouverte juste après l'accord CHZZK : une page neuve voit toutes les API accordées, ce
// que ne garantit pas la popup (ouverte avant) ni le service worker (déjà démarré). Elle pose la règle
// d'en-tête et les scripts des pages de chaîne, puis prévient la page qui l'a ouverte.

import { syncChzzkAccess } from "./sw/chzzk-access.js";

syncChzzkAccess()
  .catch((error) => console.warn("[chzzk] synchro après accord :", error?.message || error))
  .finally(() => window.parent?.postMessage({ type: "chzzk-sync-done" }, "*"));
