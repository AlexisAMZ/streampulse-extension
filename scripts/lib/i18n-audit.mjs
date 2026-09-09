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
 * @returns {string[]} la liste des problemes, vide si tout va bien.
 */
export function auditTranslations(translations, referenceCode = "en") {
  const problems = [];
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
        problems.push(`${code} ${key}: placeholders attendus [${want}], trouves [${got}]`);
      }
    }

    // 2. Les marques restent en l'etat.
    for (const [key, expected] of Object.entries(BRAND_LABELS)) {
      const value = at(translations[code], key);
      if (value !== undefined && value !== expected) {
        problems.push(`${code} ${key}: marque traduite en "${value}", attendu "${expected}"`);
      }
    }

    // 3. Les codes de langue ne sont pas du texte.
    for (const key of LANG_CODE_KEYS) {
      const value = at(translations[code], key);
      if (value !== undefined && value !== code) {
        problems.push(`${code} ${key}: vaut "${value}", attendu "${code}"`);
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
    masked = masked.replace(new RegExp(`\\b${literal}\\b`, "g"), stash);
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
    const count = (s) => (s.match(new RegExp(`\\b${literal}\\b`, "g")) || []).length;
    if (count(original) !== count(restored)) return false;
  }
  return true;
}
