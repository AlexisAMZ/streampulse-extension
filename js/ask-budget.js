// Plafond global des demandes du popup (avis, badge de chat, parrainage, carte StreamPulse+).
// Chaque demande a déjà sa propre cadence ; sans plafond commun, une carte différente pouvait
// apparaître à chaque ouverture. Règle : une seule demande toutes les 48 h, tous types confondus.
// Une demande déjà affichée peut rester visible pendant sa fenêtre (réouverture du popup).

export const ASK_BUDGET_KEY = "streamPulseAskBudget";
export const ASK_GAP_MS = 48 * 60 * 60 * 1000;

/** Pur : cette demande peut-elle s'afficher, vu la dernière demande montrée ? */
export function canShowAsk(last, id, now) {
  const at = Number(last?.at) || 0;
  if (!at || now - at >= ASK_GAP_MS || now < at) return true;
  return last?.id === id;
}

let decided = null; // { id } : le gagnant de cette ouverture, ou { id: "" } si le budget est épuisé
let pending = null;

/**
 * Réserve la place pour `id` dans cette ouverture du popup. Une seule demande gagne : la première à
 * réserver. Renvoie false si une autre a déjà la place ou si le budget des 48 h est épuisé.
 * Le stockage illisible ne bloque rien (une demande de plus vaut mieux qu'un popup muet).
 */
export async function claimAskSlot(id, { storage = chrome.storage.local, now = () => Date.now(), warn = console.warn } = {}) {
  if (decided) return decided.id === id;
  pending ??= (async () => {
    let last = null;
    try {
      last = (await storage.get(ASK_BUDGET_KEY))?.[ASK_BUDGET_KEY] || null;
    } catch (error) {
      warn("[popup] budget des demandes : stockage illisible", error);
    }
    return last;
  })();
  const last = await pending;
  if (decided) return decided.id === id;
  const clock = now();
  if (!canShowAsk(last, id, clock)) {
    decided = { id: "" };
    return false;
  }
  decided = { id };
  try {
    if (last?.id !== id || !last?.at || clock - last.at >= ASK_GAP_MS) await storage.set({ [ASK_BUDGET_KEY]: { id, at: clock } });
  } catch (error) {
    warn("[popup] budget des demandes : écriture impossible", error);
  }
  return true;
}

/** Tests uniquement : repart d'une ouverture neuve. */
export function resetAskBudget() {
  decided = null;
  pending = null;
}
