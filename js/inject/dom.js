/**
 * Helpers DOM partagés par les scripts injectés (chargé juste après
 * i18n-inline.js, avant les scripts qui en dépendent — cf. manifest.json).
 * Avant : la même fonction el() était recopiée à l'identique dans chaque script.
 */
window.__SP_DOM__ = {
  el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  },
};

/**
 * Routes Twitch dont le premier segment est une fonctionnalité, pas un login
 * de chaîne — union des 4 listes qui vivaient séparément (topbar, quickFollow,
 * twitchPlayerEnhancer, predictionsAssist) et divergeaient. Un login légitime
 * ne doit jamais être filtré : regex la plus permissive des quatre ({1,25}).
 */
window.__SP_DOM__.NON_CHANNEL_ROUTES = new Set([
  "directory", "settings", "drops", "downloads", "subscriptions", "wallet",
  "inventory", "friends", "u", "videos", "search", "prime", "turbo", "store",
  "jobs", "p", "moderator", "popout", "team", "communities", "payments",
  "following", "dashboard", "activate", "collections", "products", "broadcast",
  "creatorcamp", "bits", "login", "signup", "logout", "messages",
  "notifications", "privacy", "security", "squad",
]);

/** Login de chaîne valide : 1 à 25 caractères [a-z0-9_], hors routes système. */
window.__SP_DOM__.isChannelLogin = function (login) {
  var candidate = String(login || "").toLowerCase();
  if (!candidate || this.NON_CHANNEL_ROUTES.has(candidate)) return false;
  return /^[a-z0-9_]{1,25}$/.test(candidate);
};
