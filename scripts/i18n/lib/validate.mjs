// Règles de validation d'une traduction, clé par clé et fichier par fichier.
//
// Niveaux : error (bloque le build et l'écriture d'une traduction
// automatique), warning (à regarder, ne bloque pas), info (statistique).
// Chaque problème porte un `rule` stable, repris par le rapport et les tests.

import { LANG_CODE_KEYS, keyMatcher, loadConfig } from "./core.mjs";
import { fragments, protection } from "./protect.mjs";

/** Au-delà de ce rapport, un libellé court déborde de son bouton. */
export const LENGTH_RATIO_LIMIT = 2.2;
const SHORT_LABEL_MIN = 8;
const SHORT_LABEL_MAX = 30;
const MIN_ABSOLUTE_OVERFLOW = 10;

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let glossaryIndex = null;
function glossary() {
  if (glossaryIndex) return glossaryIndex;
  glossaryIndex = loadConfig().glossary.terms
    .filter((t) => t.match?.length && t.checkCompliance !== false)
    .map((t) => ({
      ...t,
      re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${t.match.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`, "iu"),
    }));
  return glossaryIndex;
}

const termSpec = (term) => loadConfig().protected.terms.find((t) => t.term === term) ?? {};

/** Le texte sans ses fragments protégés (termes, variables, balises). */
export function stripProtected(text) {
  let rest = String(text);
  const { patterns, terms } = protection();
  for (const t of terms) rest = rest.replace(new RegExp(t.re.source, t.re.flags), " ");
  for (const p of patterns) rest = rest.replace(new RegExp(p.re.source, "gu"), " ");
  return rest.replace(/<[^>]+>/g, " ");
}

/** Vrai si la chaîne n'est faite que de fragments protégés et de ponctuation. */
export function isLanguageNeutral(text) {
  return !/\p{L}{2,}/u.test(stripProtected(text));
}

/**
 * Valide une valeur cible face à sa source.
 * @returns {{level:string, rule:string, message:string}[]}
 */
export function validateValue({ code, key, source, value, strict = false, plural = false }) {
  const issues = [];
  const push = (level, rule, message) => issues.push({ level, rule, message });
  if (typeof value !== "string") {
    push("error", "type", `valeur de type ${typeof value}, une chaîne est attendue`);
    return issues;
  }
  if (typeof source !== "string") return issues;

  if (LANG_CODE_KEYS.includes(key)) {
    if (value !== code) push("error", "lang-code", `vaut « ${value} », le code de langue « ${code} » est attendu`);
    return issues;
  }
  const { identical } = loadConfig().protected;
  const exempt = keyMatcher(identical.exceptions?.[code] ?? []);
  if (keyMatcher(identical.required)(key) && value !== source && !(identical.exceptions?.[code] && exempt(key))) {
    push("error", "identical-required", `doit rester « ${source} » (nom affiché tel quel), trouvé « ${value} »`);
  }
  if (source.trim() !== "" && value.trim() === "") {
    push("error", "empty", "traduction vide alors que l'anglais ne l'est pas");
    return issues;
  }
  if (/<[xt]\s+i="\d+"|⟦\d+⟧/.test(value)) push("error", "mask-residue", "jeton de masquage non restauré");
  if ((value.match(/\{\{/g) || []).length !== (value.match(/\}\}/g) || []).length) {
    push("error", "broken-braces", "accolades {{ }} déséquilibrées");
  }

  const src = fragments(source);
  const dst = fragments(value);
  // Une forme de pluriel peut écrire le nombre en toutes lettres (« بث مباشر
  // واحد », « 1 sub ») : {{count}} y est facultatif, pas les autres variables.
  if (plural) {
    src.variables = src.variables.filter((v) => v !== "{{count}}");
    dst.variables = dst.variables.filter((v) => v !== "{{count}}");
  }
  if (!sameList(src.variables, dst.variables)) {
    push("error", "variables", `variables attendues [${src.variables.join(", ")}], trouvées [${dst.variables.join(", ")}]`);
  }
  if (!sameList(src.tags, dst.tags)) {
    push("error", "html", `balises attendues [${src.tags.join(" ")}], trouvées [${dst.tags.join(" ")}]`);
  }
  // Hors sortie automatique, un exemple localisé (« toi@exemple.fr ») ou une
  // marque déclinée (« Twitcha ») est un choix de traducteur : avertissement.
  const soft = strict ? "error" : "warning";
  if (!sameList(src.handles, dst.handles)) {
    push(soft, "handles", `pseudos/e-mails attendus [${src.handles.join(", ")}], trouvés [${dst.handles.join(", ")}]`);
  }
  // Les pages du site ont un segment de langue (/de/support) : il ne compte pas.
  const page = (url) => url.replace(/(streampulse\.tech)\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?/i, "$1/");
  if (!sameList(src.links.map(page), dst.links.map(page))) {
    push("warning", "links", `liens différents de l'anglais [${src.links.join(", ")}] → [${dst.links.join(", ")}]`);
  }
  for (const [term] of src.terms) {
    const spec = termSpec(term);
    if (spec.exemptKeys?.includes(key)) continue;
    const forms = [term, ...(spec.aliases?.[code] ?? [])].map((f) => f.toLowerCase());
    const lower = value.toLowerCase();
    if (!forms.some((f) => lower.includes(f))) {
      push(soft, "protected-term", `le terme protégé « ${term} » a disparu ou a été traduit`);
    }
  }
  if (src.newlines !== dst.newlines) {
    push("warning", "newlines", `${src.newlines} retour(s) à la ligne en anglais, ${dst.newlines} ici`);
  }
  if (/^\s|\s$/.test(source) !== /^\s|\s$/.test(value)) {
    push("warning", "whitespace", "espaces de début ou de fin différents de l'anglais");
  }

  // Le glossaire ne regarde que le texte libre : « Clips » dans
  // « StreamPulse Clips » est un nom de produit, pas le terme « clip ».
  const freeSource = stripProtected(source);
  for (const entry of glossary()) {
    const rule = entry.translations?.[code];
    if (!rule || !entry.re.test(freeSource)) continue;
    const lower = stripProtected(value).toLocaleLowerCase(code);
    const accepted = [rule.value, ...(rule.variants ?? [])].map((v) => v.toLocaleLowerCase(code));
    if (!accepted.some((v) => lower.includes(v))) {
      push("warning", "glossary", `« ${entry.term} » devrait se dire « ${rule.value} » (glossaire)`);
    }
    for (const bad of rule.forbidden ?? []) {
      if (lower.includes(bad.toLocaleLowerCase(code))) {
        push("warning", "glossary-forbidden", `« ${bad} » est interdit pour « ${entry.term} » (glossaire)`);
      }
    }
  }

  if (
    source.length >= SHORT_LABEL_MIN &&
    source.length <= SHORT_LABEL_MAX &&
    value.length > source.length * LENGTH_RATIO_LIMIT &&
    value.length - source.length >= MIN_ABSOLUTE_OVERFLOW
  ) {
    push("warning", "length", `${value.length} caractères contre ${source.length} en anglais : risque de débordement`);
  }

  if (value === source && !isLanguageNeutral(source) && !keyMatcher([...identical.required, ...identical.allowed])(key)) {
    push("info", "identical", "identique à l'anglais (volontaire ? sinon à traduire)");
  }
  return issues;
}

/**
 * Valide une langue entière.
 * @param {object} p
 * @param {string} p.code
 * @param {Map} p.expected  clé → { source } (expectedEntries)
 * @param {Map} p.values    clé → valeur présente dans la langue
 * @param {boolean} p.ready langue publiée : une clé manquante est une erreur
 * @param {string[]} [p.duplicates] clés répétées dans le fichier
 */
export function validateLocale({ code, expected, values, ready, duplicates = [] }) {
  const issues = [];
  for (const key of duplicates) issues.push({ level: "error", rule: "duplicate", key, message: "clé définie deux fois dans le fichier" });
  for (const key of values.keys()) {
    if (!expected.has(key)) issues.push({ level: "error", rule: "orphan", key, message: "clé absente de l'anglais (morte ou mal nommée)" });
  }
  for (const [key, entry] of expected) {
    if (!values.has(key)) {
      issues.push({
        level: ready ? "error" : "info",
        rule: "missing",
        key,
        message: ready ? "manquante dans une langue publiée (l'anglais s'affiche)" : "pas encore traduite",
      });
      continue;
    }
    for (const issue of validateValue({ code, key, source: entry.source, value: values.get(key), plural: Boolean(entry.category) })) {
      issues.push({ ...issue, key });
    }
  }
  return issues;
}

/** Limites de longueur des chaînes du manifeste (Chrome Web Store). */
export function validateManifestValue(key, value) {
  const limit = loadConfig().config.manifest.limits[key];
  if (limit && typeof value === "string" && [...value].length > limit) {
    return [{ level: "error", rule: "manifest-length", message: `${[...value].length} caractères, la limite du store est ${limit}` }];
  }
  return [];
}
