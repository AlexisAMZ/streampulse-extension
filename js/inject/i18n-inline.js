/**
 * FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
 * Source : i18n/translations.js (clés "inject.*")
 * Régénérer : node scripts/build-inline-i18n.mjs
 *
 * Expose window.__SP_I18N__ pour les content scripts, qui sont injectés comme
 * scripts classiques et ne peuvent pas importer de module ES.
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  // Déclaré dans plusieurs entrées content_scripts (l'ordre entre entrées n'est
  // pas garanti par Chrome, chacune doit donc pouvoir le charger). On sort tôt
  // si une autre entrée l'a déjà installé.
  if (window.__SP_I18N__) return;

  var STRINGS = {
  "fr": {
    "topbar": {
      "previews": "Previews au survol",
      "tip": "Offrir un Bubble Tea",
      "settings": "Tous les réglages"
    },
    "quickFollow": {
      "add": "Ajouter à StreamPulse",
      "tracked": "Suivi",
      "remove": "Retirer de StreamPulse",
      "added": "{{name}} ajouté à StreamPulse",
      "removed": "{{name}} retiré de StreamPulse",
      "error": "Action impossible. Réessayez."
    },
    "player": {
      "skipToLive": "Rattraper le direct",
      "holdToFastForward": "Maintenir pour avance x2",
      "latencyEmpty": "Latence : --",
      "latencyValue": "Latence : {{value}}s",
      "offline": "HORS LIGNE"
    },
    "chatFilter": {
      "replacement": "Message supprimé par StreamPulse"
    }
  },
  "en": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "es": {
    "topbar": {
      "previews": "Vistas previas",
      "tip": "Invitar a un Bubble Tea",
      "settings": "Ajustes"
    },
    "quickFollow": {
      "add": "Añadir a StreamPulse",
      "tracked": "Siguiendo",
      "remove": "Quitar de StreamPulse",
      "added": "{{name}} añadido a StreamPulse",
      "removed": "{{name}} eliminado de StreamPulse",
      "error": "Acción fallida. Inténtalo de nuevo."
    },
    "player": {
      "skipToLive": "Volver al directo",
      "holdToFastForward": "Mantén pulsado para avanzar x2",
      "latencyEmpty": "Latencia: --",
      "latencyValue": "Latencia: {{value}}s",
      "offline": "DESCONECTADO"
    },
    "chatFilter": {
      "replacement": "Mensaje eliminado por StreamPulse"
    }
  },
  "pt-BR": {
    "topbar": {
      "previews": "Prévias ao passar",
      "tip": "Pagar um Bubble Tea",
      "settings": "Configurações"
    },
    "quickFollow": {
      "add": "Adicionar ao StreamPulse",
      "tracked": "Seguindo",
      "remove": "Remover do StreamPulse",
      "added": "{{name}} adicionado ao StreamPulse",
      "removed": "{{name}} removido do StreamPulse",
      "error": "Falha na ação. Tente novamente."
    },
    "player": {
      "skipToLive": "Voltar ao ao vivo",
      "holdToFastForward": "Segure para avançar x2",
      "latencyEmpty": "Latência: --",
      "latencyValue": "Latência: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Mensagem removida pelo StreamPulse"
    }
  },
  "de": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "it": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "pl": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "tr": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "ÇEVRİMDIŞI"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "ru": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "НЕ В СЕТИ"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "ja": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "オフライン"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "ko": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "오프라인"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "id": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "nl": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "hi": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "ऑफ़लाइन"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "sv": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "cs": {
    "topbar": {
      "previews": "Hover previews",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  }
};
  var DEFAULT_LANG = "en";

  /**
   * Résout une préférence stockée ("pt_BR", "EN", "de-DE") vers une langue
   * disponible. Exact d'abord, puis sous-étiquette de base.
   */
  function resolve(value) {
    if (typeof value !== "string" || !value.trim()) return DEFAULT_LANG;
    var raw = value.trim().replace(/_/g, "-").toLowerCase();
    var codes = Object.keys(STRINGS);
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].toLowerCase() === raw) return codes[i];
    }
    var base = raw.split("-")[0];
    for (var j = 0; j < codes.length; j++) {
      if (codes[j].toLowerCase() === base) return codes[j];
      if (codes[j].toLowerCase().split("-")[0] === base) return codes[j];
    }
    return DEFAULT_LANG;
  }

  /** Lit une clé "a.b.c", avec repli sur l'anglais puis sur la clé brute. */
  function get(lang, key, params) {
    var value = dig(STRINGS[lang], key);
    if (value == null) value = dig(STRINGS[DEFAULT_LANG], key);
    if (typeof value !== "string") return key;
    if (params) {
      value = value.replace(/{{\s*([^}\s]+)\s*}}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match;
      });
    }
    return value;
  }

  function dig(root, key) {
    if (!root) return null;
    var parts = String(key).split(".");
    var node = root;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== "object") return null;
      node = node[parts[i]];
    }
    return node;
  }

  window.__SP_I18N__ = {
    resolve: resolve,
    get: get,
    languages: Object.keys(STRINGS),
    defaultLanguage: DEFAULT_LANG,
  };
})();
