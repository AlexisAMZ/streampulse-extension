// Écoute, dans la page Twitch elle-même (monde « MAIN »), le lien qu'elle copie quand on clique « Copier le lien »
// sur un clip. Twitch n'affiche ce lien nulle part dans la fenêtre du clip : il n'existe que dans l'appel
// navigator.clipboard.writeText. Seul un lien de clip Twitch est relayé au script de l'extension (événement
// « streampulse:clip-link ») ; tout autre texte copié reste ignoré et ne quitte jamais cette fonction.
(() => {
  "use strict";
  if (window.__streampulseClipboardTap) return;
  window.__streampulseClipboardTap = true;

  const CLIP_LINK = /^https:\/\/(?:www\.twitch\.tv\/[A-Za-z0-9_]+\/clip\/|clips\.twitch\.tv\/)[A-Za-z0-9_-]+(?:[/?#]\S*)?$/;

  const relay = (value) => {
    const text = String(value || "").trim();
    if (CLIP_LINK.test(text)) window.dispatchEvent(new CustomEvent("streampulse:clip-link", { detail: text }));
  };

  const proto = typeof Clipboard === "function" ? Clipboard.prototype : null;
  if (proto && typeof proto.writeText === "function") {
    const original = proto.writeText;
    proto.writeText = function writeText(text) {
      try {
        relay(text);
      } catch (_) {
        // Le relais ne doit jamais empêcher la copie de Twitch.
      }
      return original.call(this, text);
    };
  }
  // Copie par sélection (ancienne méthode) : même relais.
  document.addEventListener("copy", () => relay(String(window.getSelection?.() || "")), true);
})();
