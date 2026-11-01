// translate : remplit ce qui manque ou est obsolète, et rien d'autre.
//
// Ordre de résolution d'une clé à traduire :
//   1. valeur imposée (code de langue, nom de plateforme, texte sans mot) ;
//   2. mémoire de traduction : la même phrase anglaise déjà relue dans cette
//      langue (gratuit) ;
//   3. cache DeepL local (gratuit, reprise d'un passage interrompu) ;
//   4. DeepL, par lots, avec le glossaire DeepL de la langue.
// Chaque résultat est revalidé (variables, balises, termes protégés) avant
// d'être écrit en statut « pending ». Ne sont JAMAIS écrasées : les
// traductions approuvées (sauf --overwrite-approved) et les textes humains
// devenus obsolètes (sauf --include-human).

import { LANG_CODE_KEYS, keyMatcher, loadConfig, localeSettings, targetLocales } from "../lib/core.mjs";
import { loadLocale, saveLocale } from "../lib/catalog.mjs";
import { mask, unmask } from "../lib/protect.mjs";
import { isLanguageNeutral, validateManifestValue, validateValue } from "../lib/validate.mjs";
import { HUMAN_ORIGINS, logHistory, logUsage, record, recordsFromStates } from "../lib/state.mjs";
import { DeeplError, deeplKey, ensureGlossary, openCache, translateXml } from "../lib/deepl.mjs";
import { insertChangelog, missingChangelog } from "../lib/changelog.mjs";

/** Caractères facturés par DeepL : le texte, pas les balises de masquage. */
const billable = (xml) => xml.replace(/<[^>]+>/g, "").length;

/** Clés à retraduire et clés volontairement laissées de côté. */
export function selectCandidates(locale, options) {
  const matchKey = keyMatcher([...(options.keys ?? []), ...(options.prefix ?? []).map((p) => `${p}*`)]);
  const scope = options.scope ?? ["ui", "manifest", "changelog"];
  const todo = [];
  const kept = [];
  for (const [key, s] of locale.states) {
    const isManifest = key.startsWith("@manifest.");
    if (isManifest ? !scope.includes("manifest") : !scope.includes("ui")) continue;
    if (!matchKey(key)) continue;
    if (s.status === "missing") {
      todo.push(s);
    } else if (s.status === "outdated") {
      if (s.was === "approved" && !options["overwrite-approved"]) kept.push({ ...s, why: "approuvée : --overwrite-approved pour la retraduire" });
      else if (HUMAN_ORIGINS.has(s.by) && !options["include-human"]) kept.push({ ...s, why: "texte humain : --include-human pour le retraduire" });
      else todo.push(s);
    }
  }
  return { todo, kept };
}

/** Valeur qui ne passe pas par un traducteur. */
function fixedValue(code, state) {
  if (LANG_CODE_KEYS.includes(state.key)) return code;
  const { identical } = loadConfig().protected;
  if (keyMatcher(identical.required)(state.key)) return state.source;
  if (isLanguageNeutral(state.source)) return state.source;
  return null;
}

/** Mémoire de traduction : phrase anglaise → traduction relue dans la langue. */
function translationMemory(locale) {
  const memory = new Map();
  for (const s of locale.states.values()) {
    if (!["reviewed", "approved"].includes(s.status) || typeof s.value !== "string") continue;
    if (!memory.has(s.source)) memory.set(s.source, s.value);
  }
  return memory;
}

async function translateLocale(code, options, totals) {
  const settings = localeSettings(code);
  if (!settings?.deepl) throw new Error(`${code} : pas de code DeepL dans localization/config.json`);
  const locale = await loadLocale(code);
  const { todo, kept } = selectCandidates(locale, options);
  const dry = Boolean(options["dry-run"]);
  const values = new Map(locale.values);
  const records = { ...recordsFromStates(locale.states) };
  const events = [];
  const rejected = [];
  const memory = options["no-tm"] ? new Map() : translationMemory(locale);
  const deeplItems = [];
  let fixed = 0;
  let fromMemory = 0;

  const apply = (state, value, by, status = "pending") => {
    if (state.value !== undefined && state.value !== value) {
      events.push({ locale: code, key: state.key, event: "retranslated", from: state.status, by, old: state.value, new: value });
    }
    values.set(state.key, value);
    records[state.key] = record(status, state.source, value, by);
  };

  for (const state of todo) {
    const forced = fixedValue(code, state);
    if (forced !== null) {
      apply(state, forced, "copy", "reviewed");
      fixed++;
      continue;
    }
    const remembered = memory.get(state.source);
    if (remembered !== undefined && state.status === "missing") {
      apply(state, remembered, "tm");
      fromMemory++;
      continue;
    }
    deeplItems.push({ state, ...mask(state.source) });
  }

  // Les notes de version manquantes passent dans le même lot DeepL.
  const changelogItems = (options.scope ?? ["ui", "manifest", "changelog"]).includes("changelog")
    ? (await missingChangelog(code)).map((map) => ({ map, ...mask(map.values.en) }))
    : [];

  const cache = openCache(code);
  const cacheSettings = `${settings.deepl}|${settings.formality ?? ""}`;
  const uncached = [...deeplItems, ...changelogItems].filter((i) => cache.get(i.xml, cacheSettings) === undefined);
  const uniqueXml = [...new Set(uncached.map((i) => i.xml))];
  const chars = uniqueXml.reduce((n, xml) => n + billable(xml), 0);

  console.log(
    `\n${code} (${locale.label}) : ${todo.length} clé(s) à traiter, ${changelogItems.length} phrase(s) de changelog` +
      `\n  valeurs imposées ${fixed} · mémoire de traduction ${fromMemory} · DeepL ${deeplItems.length + changelogItems.length}` +
      ` (dont ${uniqueXml.length} hors cache, ~${chars} caractères facturés)`,
  );
  for (const k of kept.slice(0, 15)) console.log(`  conservée : ${k.key} (${k.why})`);
  if (kept.length > 15) console.log(`  … ${kept.length - 15} autre(s) conservée(s)`);
  totals.chars += chars;
  if (dry) return;

  const budget = Number(options["max-chars"]) || Infinity;
  if (totals.sent + chars > budget) {
    throw new Error(`budget --max-chars=${budget} dépassé (${totals.sent + chars} caractères) : rien n'a été envoyé pour ${code}`);
  }

  let stoppedBy = null;
  if (uniqueXml.length) {
    if (!deeplKey()) throw new Error("DEEPL_API_KEY absent : exporter la clé (voir localization/README.md) ou lancer --dry-run");
    const glossaryId = options["no-glossary"] ? null : await ensureGlossary(code, settings.deepl);
    try {
      await translateXml(uniqueXml, {
        target: settings.deepl,
        formality: settings.formality,
        glossaryId,
        onBatch: async ({ index, total, sources, translated }) => {
          sources.forEach((xml, i) => cache.set(xml, cacheSettings, translated[i]));
          await cache.save();
          const sent = sources.reduce((n, xml) => n + billable(xml), 0);
          totals.sent += sent;
          await logUsage({ locale: code, chars: sent, texts: sources.length });
          console.log(`  lot ${index + 1}/${total} traduit`);
        },
      });
    } catch (error) {
      if (!(error instanceof DeeplError)) throw error;
      stoppedBy = error.message;
      console.log(`  ✗ DeepL interrompu : ${error.message}. Ce qui a été traduit est gardé ; relancer reprendra ici.`);
    }
  }

  for (const item of deeplItems) {
    const raw = cache.get(item.xml, cacheSettings);
    if (raw === undefined) continue;
    const value = unmask(raw, item.slots, item.state.source);
    const problems = [
      ...validateValue({ code, key: item.state.key, source: item.state.source, value, strict: true, plural: Boolean(item.state.category) }),
      ...(item.state.key.startsWith("@manifest.") ? validateManifestValue(item.state.key.slice(10), value) : []),
    ].filter((p) => p.level === "error");
    if (problems.length) {
      rejected.push({ key: item.state.key, value, problems });
      continue;
    }
    apply(item.state, value, "deepl");
  }

  // Une forme few/many traduit l'anglais « other » : la marquer pour relecture.
  for (const [key, rec] of Object.entries(records)) {
    const state = locale.states.get(key);
    if (rec.by === "deepl" && state?.category && !["one", "other"].includes(state.category)) {
      records[key] = { ...rec, by: "copy" };
    }
  }

  const additions = [];
  for (const item of changelogItems) {
    const raw = cache.get(item.xml, cacheSettings);
    if (raw === undefined) continue;
    const value = unmask(raw, item.slots, item.map.values.en);
    const problems = validateValue({ code, key: `changelog:${item.map.version}`, source: item.map.values.en, value, strict: true }).filter((p) => p.level === "error");
    if (problems.length) rejected.push({ key: `changelog ${item.map.version} (ligne ${item.map.line})`, value, problems });
    else additions.push({ map: item.map, value });
  }

  await saveLocale(locale, values, records);
  if (additions.length) await insertChangelog(code, additions);
  await logHistory(events);

  const written = [...values].filter(([k, v]) => locale.values.get(k) !== v).length;
  console.log(`  ✓ ${written} traduction(s) écrite(s) en « pending », ${additions.length} phrase(s) de changelog ajoutée(s)`);
  for (const r of rejected) console.log(`  ✗ rejetée ${r.key} : ${r.problems.map((p) => p.message).join(" ; ")}`);
  if (stoppedBy) throw new Error(`${code} : ${stoppedBy}`);
}

export async function translate(options) {
  const totals = { chars: 0, sent: 0 };
  const { config } = loadConfig();
  for (const code of await targetLocales(options.locale)) {
    await translateLocale(code, options, totals);
  }
  const cost = (totals.chars / 1e6) * config.deepl.costPerMillionChars;
  console.log(
    options["dry-run"]
      ? `\nSimulation : ~${totals.chars} caractères à envoyer à DeepL (~${cost.toFixed(2)} ${config.deepl.currency} au tarif payant). Rien n'a été envoyé ni écrit.`
      : `\n${totals.sent} caractères envoyés à DeepL. Étape suivante : npm run i18n:review -- --locale=…`,
  );
  return 0;
}
