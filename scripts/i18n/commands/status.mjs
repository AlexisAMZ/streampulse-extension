// check, sync, report, approve : tout ce qui lit ou pose un statut.

import { writeFile } from "node:fs/promises";
import { fingerprint, keyMatcher, loadConfig, targetLocales } from "../lib/core.mjs";
import { loadLocale } from "../lib/catalog.mjs";
import { validateLocale, validateManifestValue } from "../lib/validate.mjs";
import { countStatuses, logHistory, readUsage, recordsFromStates, writeStatus } from "../lib/state.mjs";
import { missingChangelog } from "../lib/changelog.mjs";

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1).replace(".0", "")} %` : "—");

/** Statut lisible d'une langue, du plus bloquant au plus abouti. */
export function localeVerdict(locale, counts, errors) {
  const total = locale.expected.size;
  if (errors) return "Erreurs";
  if (counts.missing) return locale.ready ? "Incomplet (publié)" : "Incomplet";
  if (counts.outdated || counts.pending) return "À vérifier";
  if (counts.approved === total) return "Validé";
  return locale.ready ? "Publié, relu" : "Relu, non publié";
}

/** Toutes les mesures d'une langue, partagées par check et report. */
export async function measure(code) {
  const locale = await loadLocale(code);
  const counts = countStatuses(locale.states);
  const issues = validateLocale(locale);
  for (const [key, value] of locale.values) {
    if (key.startsWith("@manifest.")) {
      for (const i of validateManifestValue(key.slice(10), value)) issues.push({ ...i, key });
    }
  }
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const changelogMissing = (await missingChangelog(code)).length;
  const byOrigin = {};
  for (const s of locale.states.values()) {
    if (s.status !== "missing") byOrigin[s.by ?? "?"] = (byOrigin[s.by ?? "?"] || 0) + 1;
  }
  return { locale, counts, issues, errors, warnings, changelogMissing, byOrigin, verdict: localeVerdict(locale, counts, errors.length) };
}

export async function check(options) {
  const codes = await targetLocales(options.locale);
  let blocking = 0;
  console.log("Langue   clés   manq.  obsol.  attente  relues  approuv.  erreurs  avert.  verdict");
  for (const code of codes) {
    const m = await measure(code);
    const c = m.counts;
    blocking += m.errors.length;
    console.log(
      `${code.padEnd(7)} ${String(m.locale.expected.size).padStart(5)} ${String(c.missing).padStart(6)} ${String(c.outdated).padStart(7)} ` +
        `${String(c.pending).padStart(8)} ${String(c.reviewed).padStart(7)} ${String(c.approved).padStart(9)} ` +
        `${String(m.errors.length).padStart(8)} ${String(m.warnings.length).padStart(7)}  ${m.verdict}${m.locale.ready ? "" : " · non publiée"}`,
    );
    if (options.verbose || options.locale) {
      const show = [...m.locale.states.values()].filter((s) => ["missing", "outdated", "pending"].includes(s.status));
      for (const s of show.slice(0, Number(options.limit) || 25)) {
        console.log(`    ${s.status.padEnd(8)} ${s.key}${s.reason ? `  (${s.reason})` : ""}`);
      }
      if (show.length > (Number(options.limit) || 25)) console.log(`    … et ${show.length - (Number(options.limit) || 25)} autres (--limit=N)`);
      for (const e of m.errors.slice(0, 20)) console.log(`    ✗ ${e.key} : ${e.message}`);
    }
  }
  return blocking ? 1 : 0;
}

export async function sync(options) {
  const codes = await targetLocales(options.locale);
  for (const code of codes) {
    const locale = await loadLocale(code);
    const before = locale.records;
    const records = recordsFromStates(locale.states);
    const events = [];
    for (const [key, s] of locale.states) {
      if (s.status === "outdated" && before[key]?.status !== "outdated") {
        events.push({ locale: code, key, event: "outdated", from: before[key]?.status, reason: "source anglaise modifiée" });
      }
      if (s.by === "manual" && s.reason) {
        events.push({ locale: code, key, event: "manual-edit", from: before[key]?.status ?? null, to: "pending" });
      }
    }
    await writeStatus(code, records, [...locale.expected.keys()]);
    await logHistory(events);
    console.log(`${code} : statuts enregistrés (${events.length} changement(s))`);
  }
}

export async function approve(options) {
  if (!options.locale?.length) throw new Error("préciser --locale=…");
  if (!options.keys && !options.prefix && !options.from) {
    throw new Error("préciser les clés : --keys=a.b,c.d ou --prefix=popup.drops ou --from=reviewed");
  }
  const matchKey = keyMatcher([...(options.keys ?? []), ...(options.prefix ?? []).map((p) => `${p}*`)]);
  const fromStatuses = options.from ?? ["pending", "reviewed", "outdated"];
  for (const code of await targetLocales(options.locale)) {
    const locale = await loadLocale(code);
    const records = { ...recordsFromStates(locale.states) };
    const events = [];
    for (const [key, s] of locale.states) {
      if (s.status === "missing" || s.status === "approved") continue;
      if (!fromStatuses.includes(s.status)) continue;
      if ((options.keys || options.prefix) && !matchKey(key)) continue;
      records[key] = { status: "approved", src: fingerprint(s.source), val: fingerprint(s.value), by: s.by ?? "manual" };
      events.push({ locale: code, key, event: "approved", from: s.status, by: options.by ?? "human" });
    }
    await writeStatus(code, records, [...locale.expected.keys()]);
    await logHistory(events);
    console.log(`${code} : ${events.length} traduction(s) approuvée(s)`);
  }
}

export async function report(options) {
  const { config } = loadConfig();
  const codes = await targetLocales(options.locale);
  const rows = [];
  for (const code of codes) rows.push(await measure(code));
  const usage = readUsage();
  const chars = usage.reduce((n, u) => n + (u.chars || 0), 0);
  const cost = (chars / 1e6) * config.deepl.costPerMillionChars;

  if (options.json) {
    const json = rows.map((m) => ({
      locale: m.locale.code,
      ready: m.locale.ready,
      total: m.locale.expected.size,
      ...m.counts,
      errors: m.errors.length,
      warnings: m.warnings.length,
      changelogMissing: m.changelogMissing,
      origins: m.byOrigin,
      verdict: m.verdict,
    }));
    const text = JSON.stringify({ generatedAt: new Date().toISOString(), deeplChars: chars, locales: json }, null, 2);
    if (options.out) await writeFile(options.out, `${text}\n`);
    else console.log(text);
    return 0;
  }

  const lines = [];
  lines.push(`# Couverture linguistique de StreamPulse`, "", `Généré le ${new Date().toISOString().slice(0, 10)} par \`npm run i18n:report\`, à partir des fichiers du dépôt.`, "");
  lines.push("| Langue | Publiée | Traduites | Couverture | Approuvées | Relues | En attente | Obsolètes | Manquantes | Erreurs | Avert. | Statut |");
  lines.push("|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|");
  lines.push(`| English (en) | oui | source | 100 % | — | — | — | — | — | — | — | Source |`);
  for (const m of rows) {
    const total = m.locale.expected.size;
    const done = total - m.counts.missing;
    lines.push(
      `| ${m.locale.label} (${m.locale.code}) | ${m.locale.ready ? "oui" : "non"} | ${done}/${total} | ${pct(done, total)} | ${m.counts.approved} | ${m.counts.reviewed} | ` +
        `${m.counts.pending} | ${m.counts.outdated} | ${m.counts.missing} | ${m.errors.length} | ${m.warnings.length} | ${m.verdict} |`,
    );
  }
  lines.push("", "Approuvées = validées par un humain. Relues = contrôlées (relecture Claude, ou traduction historique déjà en production). En attente = produites (DeepL, mémoire de traduction, édition à la main) et pas encore relues.", "");
  lines.push("## Provenance des traductions", "", "| Langue | " + ["legacy", "manual", "deepl", "tm", "claude", "copy"].join(" | ") + " |", "|---|--:|--:|--:|--:|--:|--:|");
  for (const m of rows) lines.push(`| ${m.locale.code} | ${["legacy", "manual", "deepl", "tm", "claude", "copy"].map((o) => m.byOrigin[o] || 0).join(" | ")} |`);
  lines.push("", "legacy = traduction en place avant l'outillage (1er novembre 2026) · manual = éditée à la main depuis · deepl = DeepL · tm = mémoire de traduction (même phrase anglaise déjà traduite) · claude = correction proposée en relecture · copy = forme de pluriel recopiée, à accorder.", "");
  lines.push("## Notes de version (changelog)", "", rows.map((m) => `- ${m.locale.code} : ${m.changelogMissing ? `${m.changelogMissing} phrase(s) manquante(s)` : "complet"}`).join("\n"), "");
  lines.push("## Problèmes de validation", "");
  for (const m of rows) {
    const byRule = {};
    for (const i of [...m.errors, ...m.warnings]) byRule[`${i.level} ${i.rule}`] = (byRule[`${i.level} ${i.rule}`] || 0) + 1;
    const summary = Object.entries(byRule).map(([r, n]) => `${r} × ${n}`).join(", ");
    lines.push(`- **${m.locale.code}** : ${summary || "aucun"}`);
  }
  lines.push("", "Détail : `npm run i18n:validate -- --locale=<code> --verbose`. Les avertissements `glossary` signalent un terme qui s'écarte de `glossary.json`.", "");
  lines.push("## DeepL", "", `- Caractères envoyés depuis le début du suivi : ${chars.toLocaleString("fr-FR")}`, `- Coût estimé : ${cost.toFixed(2)} ${config.deepl.currency} (tarif ${config.deepl.costPerMillionChars} ${config.deepl.currency} par million de caractères, configurable dans config.json)`, "");
  const text = lines.join("\n");
  if (options.out) {
    await writeFile(options.out, `${text}\n`);
    console.log(`Rapport écrit dans ${options.out}`);
  } else {
    console.log(text);
  }
  return 0;
}
