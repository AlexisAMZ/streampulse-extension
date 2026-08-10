/**
 * Patch notes shown after an update.
 *
 * THE ONLY FILE TO EDIT WHEN YOU SHIP A RELEASE.
 *
 * Add a new entry at the TOP of RELEASES. The `version` MUST match the
 * `version` field in manifest.json — `npm run verify` fails the build if the
 * manifest version has no matching entry here, so notes can't silently drift
 * out of sync with what users actually install.
 *
 * LOCALISATION
 * Every user-facing sentence is a map keyed by language code, not a plain
 * string. The page picks the language the user selected in StreamPulse, so a
 * Spanish install reads Spanish notes. `npm run verify` fails when a release is
 * missing one of the published languages, which is what stops French-only notes
 * from shipping to everyone.
 *
 *   text: {
 *     fr: "...",
 *     en: "...",
 *     es: "...",
 *     "pt-BR": "...",
 *   }
 *
 * The published set is whatever `AVAILABLE_LANGUAGES` exposes in
 * i18n/translations.js (today: fr, en, es, pt-BR). Publishing a new language
 * there makes every release entry below incomplete until it's covered too.
 *
 * Entry shape:
 *   version  string   Must equal manifest.json version, e.g. "26.8.9"
 *   date     string   ISO date, "YYYY-MM-DD"
 *   title    i18n     Short release headline (optional). Rendered as the big
 *                     serif hero, so keep it to ~6 words in every language —
 *                     the last two are italic + violet, like the onboarding
 *                     welcome screen.
 *   subtitle i18n     One-line summary under the hero (optional). Falls back to
 *                     a count of the changes below.
 *   changes  array    { type, text } — type is "new" | "fix" | "improved",
 *                     text is an i18n map
 *   thanks   array    Contributor credits, newest release first:
 *                       handle  string  Display name / pseudo (required)
 *                       for     i18n    What they helped with (optional)
 *                       url     string  Profile link, https only (optional)
 */

/** Language used when a release has no text for the one the user picked. */
export const FALLBACK_LANGUAGE = "en";

export const RELEASES = [
  {
    version: "26.8.9",
    date: "2026-08-10",
    title: {
      fr: "Le bouton qui manquait",
      en: "The button that was missing",
      es: "El botón que faltaba",
      "pt-BR": "O botão que faltava",
    },
    subtitle: {
      fr: "Ajoutez un streamer sans ouvrir l'extension, et des confirmations de suppression enfin lisibles.",
      en: "Add a streamer without opening the extension, and removal confirmations that are finally readable.",
      es: "Añade un streamer sin abrir la extensión, y confirmaciones de eliminación por fin legibles.",
      "pt-BR":
        "Adicione um streamer sem abrir a extensão, e confirmações de remoção enfim legíveis.",
    },
    changes: [
      {
        type: "new",
        text: {
          fr: "Un bouton « Ajouter à StreamPulse » apparaît maintenant directement sur les pages de chaîne Twitch, à côté du bouton S'abonner. Violet quand le streamer n'est pas encore suivi, gris une fois ajouté.",
          en: "An “Add to StreamPulse” button now appears directly on Twitch channel pages, next to the Subscribe button. Purple when the streamer isn't followed yet, grey once added.",
          es: "Ahora aparece un botón «Añadir a StreamPulse» directamente en las páginas de canal de Twitch, junto al botón Suscribirse. Morado cuando el streamer aún no está seguido, gris una vez añadido.",
          "pt-BR":
            "Um botão “Adicionar ao StreamPulse” agora aparece direto nas páginas de canal da Twitch, ao lado do botão Inscrever-se. Roxo quando o streamer ainda não é seguido, cinza depois de adicionado.",
        },
      },
      {
        type: "fix",
        text: {
          fr: "Le bouton Twitch ne s'affichait pas du tout si vous aviez 7TV installé : le garde anti-conflit remontait tout le DOM et rejetait la barre Twitch légitime.",
          en: "The Twitch button didn't show up at all if you had 7TV installed: the conflict guard walked the whole DOM and rejected the legitimate Twitch bar.",
          es: "El botón de Twitch no aparecía en absoluto si tenías 7TV instalado: la protección anticonflictos recorría todo el DOM y rechazaba la barra legítima de Twitch.",
          "pt-BR":
            "O botão da Twitch não aparecia se você tivesse o 7TV instalado: a proteção contra conflitos percorria todo o DOM e rejeitava a barra legítima da Twitch.",
        },
      },
      {
        type: "fix",
        text: {
          fr: "Les notifications disparaissaient silencieusement quand l'avatar du streamer ne pouvait pas être téléchargé (bloqueur de contenu, CDN indisponible). Elles utilisent désormais le logo local en secours.",
          en: "Notifications disappeared silently when the streamer's avatar couldn't be downloaded (content blocker, CDN unavailable). They now fall back to the local logo.",
          es: "Las notificaciones desaparecían en silencio cuando no se podía descargar el avatar del streamer (bloqueador de contenido, CDN no disponible). Ahora recurren al logo local.",
          "pt-BR":
            "As notificações sumiam silenciosamente quando o avatar do streamer não podia ser baixado (bloqueador de conteúdo, CDN indisponível). Agora elas usam o logo local como reserva.",
        },
      },
      {
        type: "improved",
        text: {
          fr: "La confirmation de suppression d'un streamer n'était pas stylée et s'affichait avec les boutons bruts du navigateur. Nouveau design, avec le nom du streamer concerné.",
          en: "The confirmation for removing a streamer was unstyled and used the browser's raw buttons. New design, showing the name of the streamer concerned.",
          es: "La confirmación para eliminar un streamer no tenía estilo y usaba los botones sin formato del navegador. Nuevo diseño, con el nombre del streamer en cuestión.",
          "pt-BR":
            "A confirmação de remoção de um streamer não tinha estilo e usava os botões brutos do navegador. Novo design, com o nome do streamer em questão.",
        },
      },
      {
        type: "improved",
        text: {
          fr: "La confirmation ne se ferme plus toute seule au bout de 3 secondes, et la touche Entrée annule au lieu de supprimer.",
          en: "The confirmation no longer closes by itself after 3 seconds, and the Enter key cancels instead of deleting.",
          es: "La confirmación ya no se cierra sola a los 3 segundos, y la tecla Intro cancela en lugar de eliminar.",
          "pt-BR":
            "A confirmação não fecha mais sozinha após 3 segundos, e a tecla Enter cancela em vez de excluir.",
        },
      },
      {
        type: "new",
        text: {
          fr: "Cette page de notes de version, qui s'ouvre après chaque mise à jour pour vous dire ce qui a changé. Elle suit la langue choisie dans l'extension, notes comprises.",
          en: "This release notes page, which opens after every update to tell you what changed. It follows the language selected in the extension, notes included.",
          es: "Esta página de notas de versión, que se abre tras cada actualización para contarte qué ha cambiado. Sigue el idioma elegido en la extensión, notas incluidas.",
          "pt-BR":
            "Esta página de notas de versão, que abre depois de cada atualização para contar o que mudou. Ela segue o idioma escolhido na extensão, incluindo as notas.",
        },
      },
      {
        type: "fix",
        text: {
          fr: "Les mots en italique violet des grands titres étaient rognés : le dégradé n'était peint que dans la boîte du mot, alors qu'une italique déborde à droite et qu'un jambage descend sous la ligne. La queue du g disparaissait.",
          en: "The violet italic words in the large headings were clipped: the gradient was only painted inside the word's box, while an italic leans past it and a descender drops below the line. The tail of the g went missing.",
          es: "Las palabras en cursiva violeta de los títulos grandes quedaban recortadas: el degradado solo se pintaba dentro de la caja de la palabra, mientras que una cursiva se inclina más allá y un rasgo desciende bajo la línea. La cola de la g desaparecía.",
          "pt-BR":
            "As palavras em itálico violeta dos títulos grandes ficavam cortadas: o gradiente era pintado apenas dentro da caixa da palavra, enquanto um itálico se inclina além dela e uma haste desce abaixo da linha. A cauda do g sumia.",
        },
      },
      {
        type: "fix",
        text: {
          fr: "Plusieurs réglages restaient en français même après avoir choisi une autre langue : ouverture auto de l'inventaire, icônes d'onglet, journal d'événements et FAQ. Tout l'écran de réglages et la première configuration suivent désormais la langue choisie.",
          en: "Several settings stayed in French even after picking another language: auto-open inventory, tab icons, event log and FAQ. The whole settings screen and the first-time setup now follow the language you choose.",
          es: "Varios ajustes seguían en francés aunque eligieras otro idioma: apertura automática del inventario, iconos de pestaña, registro de eventos y FAQ. Toda la pantalla de ajustes y la configuración inicial siguen ahora el idioma elegido.",
          "pt-BR":
            "Vários ajustes continuavam em francês mesmo depois de escolher outro idioma: abertura automática do inventário, ícones de aba, registro de eventos e FAQ. Toda a tela de ajustes e a configuração inicial agora seguem o idioma escolhido.",
        },
      },
      {
        type: "fix",
        text: {
          fr: "La pastille LIVE sur l'icône de l'onglet était rognée par le détourage de l'avatar, au point d'être invisible à taille réelle. Elle devient un anneau rouge autour de l'avatar du streamer.",
          en: "The LIVE dot on the tab icon was clipped by the avatar mask, to the point of being invisible at actual size. It is now a red ring around the streamer's avatar.",
          es: "El punto LIVE en el icono de la pestaña quedaba recortado por el recorte del avatar, hasta ser invisible a tamaño real. Ahora es un anillo rojo alrededor del avatar del streamer.",
          "pt-BR":
            "O ponto LIVE no ícone da aba era cortado pelo recorte do avatar, a ponto de ficar invisível no tamanho real. Agora é um anel vermelho ao redor do avatar do streamer.",
        },
      },
      {
        type: "new",
        text: {
          fr: "L'anneau de l'onglet passe à l'orange et clignote quand la chaîne raide ailleurs, pour que vous voyiez le raid partir même si l'annulation automatique est active.",
          en: "The tab ring turns orange and blinks when the channel raids someone else, so you can see the raid happen even when auto-cancel is on.",
          es: "El anillo de la pestaña se vuelve naranja y parpadea cuando el canal hace raid a otro, para que veas el raid aunque la cancelación automática esté activa.",
          "pt-BR":
            "O anel da aba fica laranja e pisca quando o canal faz raid em outro, para você ver o raid acontecer mesmo com o cancelamento automático ativo.",
        },
      },
      {
        type: "fix",
        text: {
          fr: "L'annulation automatique des raids ne trouvait plus la bannière quand Twitch renommait ses éléments internes, et pouvait réagir jusqu'à deux secondes trop tard. La détection a été élargie et le clic part dès l'apparition de la bannière. Correctif encore à confirmer : il faut tomber sur une chaîne au moment précis où elle raide pour le vérifier, donc l'investigation continue.",
          en: "Auto-cancel raids stopped finding the banner whenever Twitch renamed its internal elements, and could react up to two seconds too late. Detection has been broadened and the click now fires as soon as the banner appears. Not confirmed yet: checking it means catching a channel at the exact moment it raids, so the investigation continues.",
          es: "La cancelación automática de raids dejaba de encontrar el banner cuando Twitch renombraba sus elementos internos, y podía reaccionar hasta dos segundos tarde. La detección se ha ampliado y el clic se produce en cuanto aparece el banner. Aún sin confirmar: comprobarlo exige pillar un canal justo cuando hace raid, así que la investigación sigue.",
          "pt-BR":
            "O cancelamento automático de raids deixava de encontrar o banner quando a Twitch renomeava seus elementos internos, e podia reagir até dois segundos tarde demais. A detecção foi ampliada e o clique acontece assim que o banner aparece. Ainda não confirmado: verificar exige pegar um canal no momento exato em que ele faz raid, então a investigação continua.",
        },
      },
    ],
    thanks: [
      {
        handle: "Shiro",
        for: {
          fr: "signalement des bugs de cette version",
          en: "reporting the bugs in this release",
          es: "reportar los bugs de esta versión",
          "pt-BR": "relatar os bugs desta versão",
        },
      },
    ],
  },
];

/**
 * Read a localised field for `lang`.
 *
 * Tolerates a plain string so a hand-edited entry never blanks the page —
 * `npm run verify` is what rejects that shape before it ships.
 */
export function pickLocalized(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";

  const picked = value[lang] ?? value[FALLBACK_LANGUAGE];
  if (typeof picked === "string") return picked;

  // Last resort: any language at all beats an empty line in the notes.
  const any = Object.values(value).find((entry) => typeof entry === "string");
  return any ?? "";
}

/** Most recent release, or null when RELEASES is empty. */
export function getLatestRelease() {
  return RELEASES.length ? RELEASES[0] : null;
}

/** Look up a release by exact version string. */
export function getRelease(version) {
  return RELEASES.find((entry) => entry.version === version) || null;
}
