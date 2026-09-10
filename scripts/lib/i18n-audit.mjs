// Controles d'integrite sur i18n/translations.js.
//
// Ces trois regles existent parce que scripts/translate.mjs passe par Google
// Translate, qui traduit joyeusement tout ce qu'il recoit : les noms de
// variables entre accolades, les noms de marque et jusqu'aux codes de langue.
// Les degats sont invisibles a la relecture quand on ne parle pas la langue,
// et formatTemplate() remplace un placeholder inconnu par une chaine vide,
// donc le texte s'affiche ampute au lieu de planter.
//
// Utilise par scripts/translate.mjs (avant ecriture) et par scripts/verify.mjs.

/** Noms de marque : ils s'ecrivent pareil dans toutes les langues. */
export const BRAND_LABELS = {
  "platforms.twitch": "Twitch",
  "platforms.kick": "Kick",
  "popup.platformFilter.twitch": "twitch",
  "popup.platformFilter.kick": "kick",
};

/** Cles dont la valeur doit etre le code de langue du bloc, pas une traduction. */
export const LANG_CODE_KEYS = ["popup.htmlLang", "onboarding.htmlLang"];

/** Locale par defaut du site : ses URLs n'ont pas de segment de langue. */
export const SITE_DEFAULT_LOCALE = "fr";

/** Au-dela de ce rapport, un libelle court deborde de son bouton. */
export const LENGTH_RATIO_LIMIT = 2.2;

/** On ne compare la longueur que des libelles courts, pas des descriptions. */
export const SHORT_LABEL_MAX = 30;

/** En dessous, le rapport ne veut rien dire : « Add » fait 3 caracteres. */
export const SHORT_LABEL_MIN = 8;

/** Un debordement se joue en caracteres, pas seulement en pourcentage. */
export const MIN_ABSOLUTE_OVERFLOW = 10;

/** Segment de langue attendu dans une URL du site, pour un code donne. */
export function expectedUrlSegment(code) {
  return code === SITE_DEFAULT_LOCALE ? "" : `/${code.toLowerCase()}`;
}

/** Litteraux a soustraire au traducteur, en plus des {{placeholders}}. */
export const PROTECTED_LITERALS = [
  "StreamPulse",
  "Twitch",
  "Kick",
  "ZEvent",
  "Chrome",
];

export const PLACEHOLDER_RE = /{{\s*([^}\s]+)\s*}}/g;

export function placeholdersOf(text) {
  return String(text).match(PLACEHOLDER_RE)?.map((m) => m.replace(/[{}\s]/g, "")).sort() ?? [];
}

export function flattenPairs(node, prefix = "") {
  return Object.entries(node ?? {}).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? flattenPairs(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

const at = (obj, dotted) => dotted.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);

/**
 * @returns {{level: "error"|"warning", message: string}[]} vide si tout va bien.
 *   Les erreurs bloquent l'ecriture et le build ; les avertissements se
 *   contentent d'etre signales, la longueur d'un libelle relevant du jugement.
 */
export function auditTranslations(translations, referenceCode = "en") {
  const problems = [];
  const error = (m) => problems.push({ level: "error", message: m });
  const warning = (m) => problems.push({ level: "warning", message: m });
  const reference = new Map(flattenPairs(translations[referenceCode]));

  for (const code of Object.keys(translations)) {
    // 1. Les placeholders doivent survivre a la traduction.
    for (const [key, value] of flattenPairs(translations[code])) {
      if (typeof value !== "string") continue;
      const expected = reference.get(key);
      if (typeof expected !== "string") continue;
      const want = placeholdersOf(expected).join(",");
      const got = placeholdersOf(value).join(",");
      if (want !== got) {
        error(`${code} ${key}: placeholders attendus [${want}], trouves [${got}]`);
      }

      // 4. Un libelle court qui double de longueur deborde de son bouton.
      //    Avertissement seulement : certaines langues sont naturellement plus
      //    verbeuses, c'est a l'oeil de trancher.
      if (
        code !== referenceCode &&
        expected.length >= SHORT_LABEL_MIN &&
        expected.length <= SHORT_LABEL_MAX &&
        value.length > expected.length * LENGTH_RATIO_LIMIT &&
        value.length - expected.length >= MIN_ABSOLUTE_OVERFLOW
      ) {
        warning(
          `${code} ${key}: ${value.length} caracteres contre ${expected.length} en ${referenceCode}, ` +
            `risque de debordement (${JSON.stringify(value)})`
        );
      }

      // 5. Les URLs du site portent le segment de langue de leur bloc.
      for (const url of value.match(/streampulse\.fr\/[^\s"']*/g) ?? []) {
        const path = url.replace("streampulse.fr", "");
        const segment = expectedUrlSegment(code);
        if (!path.startsWith(segment + "/") && path !== segment) {
          error(`${code} ${key}: URL "${url}" ne porte pas le segment "${segment || "(aucun)"}"`);
        }
      }
    }

    // 2. Les marques restent en l'etat.
    for (const [key, expected] of Object.entries(BRAND_LABELS)) {
      const value = at(translations[code], key);
      if (value !== undefined && value !== expected) {
        error(`${code} ${key}: marque traduite en "${value}", attendu "${expected}"`);
      }
    }

    // 3. Les codes de langue ne sont pas du texte.
    for (const key of LANG_CODE_KEYS) {
      const value = at(translations[code], key);
      if (value !== undefined && value !== code) {
        error(`${code} ${key}: vaut "${value}", attendu "${code}"`);
      }
    }
  }

  return problems;
}

/**
 * Remplace {{placeholders}} et litteraux proteges par des jetons opaques.
 * Les crochets mathematiques traversent Google Translate sans dommage la ou
 * des accolades ou des balises se font reecrire.
 */
export function protectText(text) {
  const tokens = [];
  const stash = (match) => {
    const index = tokens.indexOf(match);
    const slot = index === -1 ? tokens.push(match) - 1 : index;
    return `⟦${slot}⟧`;
  };

  let masked = String(text).replace(PLACEHOLDER_RE, stash);
  for (const literal of PROTECTED_LITERALS) {
    // Insensible a la casse : les libelles de filtre s'ecrivent « twitch » en
    // minuscules, et un \bTwitch\b sensible a la casse les laissait passer au
    // traducteur, qui a rendu « चिकोटी ». stash() memorise le texte reellement
    // rencontre, donc la casse d'origine est restituee telle quelle.
    masked = masked.replace(new RegExp(`\\b${literal}\\b`, "gi"), stash);
  }
  return { masked, tokens };
}

export function restoreText(masked, tokens) {
  return String(masked).replace(/⟦\s*(\d+)\s*⟧/g, (whole, slot) => {
    const value = tokens[Number(slot)];
    return value === undefined ? whole : value;
  });
}

/** true si la restauration a bien rendu tous les jetons attendus. */
export function restorationIsIntact(original, restored) {
  if (placeholdersOf(original).join(",") !== placeholdersOf(restored).join(",")) return false;
  if (/[⟦⟧]/.test(restored)) return false;
  for (const literal of PROTECTED_LITERALS) {
    const count = (s) => (s.match(new RegExp(`\\b${literal}\\b`, "gi")) || []).length;
    if (count(original) !== count(restored)) return false;
  }
  return true;
}
