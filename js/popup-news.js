// Pastilles « Nouveau » des fonctions récentes : un point sur les onglets Drops
// et Badges de la barre du haut, une étiquette dans le menu des Réglages
// (Drops, Badges, Pseudo et badge). Chacune disparaît dès que sa rubrique est
// ouverte, et ce choix est gardé dans chrome.storage.

export const NEWS_KEY = "streamPulseSeenNew";
const NEW_FEATURES = ["drops", "badges", "identity"];

// Tant que le storage n'est pas lu, rien ne s'affiche : pas de clignotement.
let seen = new Set(NEW_FEATURES);

function paint() {
  document.querySelectorAll("[data-new]").forEach((element) => {
    element.hidden = seen.has(element.dataset.new);
  });
}

/** Rubrique ouverte : sa pastille et son étiquette s'éteignent pour de bon. */
export function markSeen(id) {
  if (!NEW_FEATURES.includes(id) || seen.has(id)) return;
  seen = new Set([...seen, id]);
  paint();
  chrome.storage.local.set({ [NEWS_KEY]: [...seen] }).catch((error) => console.warn("[popup] nouveautés :", error?.message || error));
}

export async function initNews() {
  const stored = await chrome.storage.local.get(NEWS_KEY);
  const list = Array.isArray(stored[NEWS_KEY]) ? stored[NEWS_KEY] : [];
  seen = new Set(list.filter((id) => NEW_FEATURES.includes(id)));
  paint();
}
