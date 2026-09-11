// js/instagram-permission.js
// Porte le geste utilisateur requis par chrome.permissions.request().
// Cette API n'est disponible ni dans le service worker MV3 ni dans un content
// script : la demande doit donc partir d'une page d'extension, sur un vrai clic.

(function () {
  "use strict";

  const ORIGINS = ["https://*.instagram.com/*"];

  // Traductions minimales embarquees : la page n'est affichee que sur action
  // explicite, inutile d'alourdir les 15 fichiers _locales pour deux ecrans.
  const EN = {
    "t-title": "Allow access to Instagram",
    "t-intro":
      "StreamPulse React needs your permission to read Instagram Reel comments straight from your browser.",
    "t-what": "What this enables",
    "t-b1": "Show a Reel's comments inside your live panel.",
    "t-b2": "No API key, no subscription: your existing session is used.",
    "t-b3": "Comments stay in your browser, nothing is stored.",
    "t-revoke": "You can revoke this access at any time from the extension settings.",
    grant: "Allow Instagram",
    cancel: "Cancel",
    granted: "Access granted. You can close this window.",
    denied: "Access denied. Comments will stay unavailable.",
    failed: "The request could not be completed.",
  };

  const FR = {
    granted: "Accès accordé. Vous pouvez fermer cette fenêtre.",
    denied: "Accès refusé. Les commentaires resteront indisponibles.",
    failed: "La demande n'a pas pu aboutir.",
  };

  const lang = (chrome.i18n?.getUILanguage?.() || "fr").toLowerCase();
  const isFrench = lang.startsWith("fr");
  const t = (key) => (isFrench ? FR[key] : EN[key]) || EN[key] || "";

  if (!isFrench) {
    document.documentElement.lang = "en";
    for (const [id, text] of Object.entries(EN)) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    document.getElementById("grant").textContent = EN.grant;
    document.getElementById("cancel").textContent = EN.cancel;
  }

  const grantBtn = document.getElementById("grant");
  const cancelBtn = document.getElementById("cancel");
  const status = document.getElementById("status");

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind || "";
  }

  grantBtn.addEventListener("click", () => {
    grantBtn.disabled = true;
    setStatus("");

    // Appel synchrone dans le handler : toute operation asynchrone avant ce
    // point invaliderait le geste utilisateur et ferait echouer la demande.
    chrome.permissions.request({ origins: ORIGINS }, (granted) => {
      if (chrome.runtime.lastError) {
        grantBtn.disabled = false;
        setStatus(chrome.runtime.lastError.message || t("failed"), "error");
        return;
      }

      if (granted) {
        setStatus(t("granted"), "ok");
        setTimeout(() => window.close(), 900);
        return;
      }

      // La page appelante suit l'issue via l'etat de cette fenetre : on la
      // referme pour lui donner une reponse definitive plutot que de la
      // laisser attendre indefiniment.
      setStatus(t("denied"), "error");
      setTimeout(() => window.close(), 2200);
    });
  });

  cancelBtn.addEventListener("click", () => {
    window.close();
  });
})();
