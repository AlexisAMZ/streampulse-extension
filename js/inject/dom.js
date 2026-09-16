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
