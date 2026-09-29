/**
 * Confirmation destructive unique du popup : inline en 2 clics, jamais confirm().
 * Le premier clic arme le bouton (libellé de confirmation) ; le second, dans la
 * fenêtre d'armement, confirme. Hors fenêtre, on réarme. La logique est séparée
 * du DOM pour être testée (tests/inline-confirm.test.mjs).
 */

export const ARM_MS = 4000;

/**
 * État suivant après un clic. `state` : { armed, armedAt } (ou équivalent nul).
 * Retourne { armed, armedAt, action } avec action "arm" | "confirm" | "rearm".
 */
export function nextConfirmState(state, now, armMs = ARM_MS) {
  if (!state?.armed) {
    return { armed: true, armedAt: now, action: "arm" };
  }
  if (now - state.armedAt <= armMs) {
    return { armed: false, armedAt: 0, action: "confirm" };
  }
  return { armed: true, armedAt: now, action: "rearm" };
}

/**
 * Branche la confirmation inline sur un bouton texte. `labels` : { arm, confirm }.
 * Retourne une fonction de nettoyage (retire l'écouteur et le minuteur).
 */
export function bindInlineConfirm(button, labels, onConfirm, { armMs = ARM_MS } = {}) {
  let state = { armed: false, armedAt: 0 };
  let timer = 0;

  const disarm = () => {
    clearTimeout(timer);
    timer = 0;
    state = { armed: false, armedAt: 0 };
    button.classList.remove("is-armed");
    button.textContent = labels.arm;
  };

  const handler = () => {
    if (button.disabled) return;
    state = nextConfirmState(state, Date.now(), armMs);
    clearTimeout(timer);
    if (state.action === "confirm") {
      button.classList.remove("is-armed");
      button.textContent = labels.arm;
      onConfirm();
      return;
    }
    button.classList.add("is-armed");
    button.textContent = labels.confirm;
    timer = setTimeout(disarm, armMs);
  };

  button.addEventListener("click", handler);
  return () => {
    button.removeEventListener("click", handler);
    clearTimeout(timer);
  };
}
