// Journal d'échec contextualisé : remplace les `.catch(() => {})` muets.

/** Gestionnaire de rejet qui journalise l'échec avec son contexte, sans le relancer. */
export function warnWith(context) {
  return (error) => console.warn(`[SP] ${context} :`, error?.message || error);
}
