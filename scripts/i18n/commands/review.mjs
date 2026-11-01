// review : fait relire par Claude ; apply-review : applique les verdicts.
//
// Par défaut, seules les traductions « pending » (et les formes de pluriel
// recopiées) passent en relecture. --all relit aussi les « reviewed ».
// Un verdict ne modifie jamais une traduction « approved » : il est seulement
// signalé.

import { mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PATHS, fingerprint, keyMatcher, loadConfig, targetLocales } from "../lib/core.mjs";
import { loadLocale, saveLocale } from "../lib/catalog.mjs";
import { validateManifestValue, validateValue } from "../lib/validate.mjs";
import { logHistory, record, recordsFromStates } from "../lib/state.mjs";
import { buildPack, reviewWithClaude } from "../lib/review.mjs";

function reviewItems(locale, options) {
  const matchKey = keyMatcher([...(options.keys ?? []), ...(options.prefix ?? []).map((p) => `${p}*`)]);
  const wanted = options.status ?? (options.all ? ["pending", "reviewed"] : ["pending"]);
  return [...locale.states.values()]
    .filter((s) => s.value !== undefined && (wanted.includes(s.status) || (s.by === "copy" && s.category)))
    .filter((s) => (options.keys || options.prefix ? matchKey(s.key) : true))
    .map((s) => ({ ...s, category: locale.expected.get(s.key)?.category ?? null }))
    .slice(0, Number(options.limit) || Infinity);
}

export async function review(options) {
  const { review: settings } = loadConfig().config;
  const useApi = Boolean(process.env.ANTHROPIC_API_KEY) && !options.offline;
  for (const code of await targetLocales(options.locale)) {
    const locale = await loadLocale(code);
    const items = reviewItems(locale, options);
    if (!items.length) {
      console.log(`${code} : rien à relire`);
      continue;
    }
    if (!useApi) {
      const dir = path.join(PATHS.cache, "review");
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${code}-${new Date().toISOString().slice(0, 10)}.json`);
      await writeFile(file, JSON.stringify(buildPack(code, locale.label, items), null, 2));
      console.log(
        `${code} : ${items.length} traduction(s) à relire → ${path.relative(process.cwd(), file)}\n` +
          `  Sans ANTHROPIC_API_KEY : demander à Claude Code « relis ${path.relative(process.cwd(), file)} et écris les verdicts » ` +
          `(tableau JSON [{key, verdict, suggestion?, reason?}]), puis npm run i18n:apply-review -- --locale=${code} --file=<verdicts.json>`,
      );
      continue;
    }
    const verdicts = [];
    for (let i = 0; i < items.length; i += settings.batchSize) {
      const batch = items.slice(i, i + settings.batchSize);
      verdicts.push(...(await reviewWithClaude(buildPack(code, locale.label, batch))));
      console.log(`${code} : lot ${Math.floor(i / settings.batchSize) + 1}/${Math.ceil(items.length / settings.batchSize)} relu`);
    }
    const dir = path.join(PATHS.cache, "review");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${code}-verdicts-${Date.now()}.json`);
    await writeFile(file, JSON.stringify(verdicts, null, 2));
    await applyVerdicts(code, verdicts, { reviewer: "claude-api" });
  }
  return 0;
}

/** Applique des verdicts : ok → reviewed ; fix → valeur corrigée revalidée. */
export async function applyVerdicts(code, verdicts, { reviewer = "claude", dryRun = false } = {}) {
  const locale = await loadLocale(code);
  const values = new Map(locale.values);
  const records = { ...recordsFromStates(locale.states) };
  const events = [];
  const report = { ok: 0, fixed: 0, protectedApproved: [], rejected: [], unknown: [] };

  for (const v of verdicts) {
    const state = locale.states.get(v.key);
    if (!state || state.value === undefined) {
      report.unknown.push(v.key);
      continue;
    }
    if (v.verdict === "ok") {
      if (state.status !== "approved") {
        records[v.key] = { ...record("reviewed", state.source, state.value, state.by ?? "manual") };
        if (state.status !== "reviewed") events.push({ locale: code, key: v.key, event: "reviewed", from: state.status, by: reviewer });
      }
      report.ok++;
      continue;
    }
    const suggestion = String(v.suggestion ?? "");
    if (state.status === "approved") {
      report.protectedApproved.push({ key: v.key, suggestion, reason: v.reason });
      continue;
    }
    const problems = [
      ...validateValue({ code, key: v.key, source: state.source, value: suggestion, strict: true, plural: Boolean(locale.expected.get(v.key)?.category) }),
      ...(v.key.startsWith("@manifest.") ? validateManifestValue(v.key.slice(10), suggestion) : []),
    ].filter((p) => p.level === "error");
    if (problems.length) {
      report.rejected.push({ key: v.key, suggestion, problems: problems.map((p) => p.message) });
      continue;
    }
    if (suggestion !== state.value) {
      values.set(v.key, suggestion);
      events.push({ locale: code, key: v.key, event: "review-fix", from: state.status, by: reviewer, old: state.value, new: suggestion, reason: v.reason ?? "" });
    }
    records[v.key] = { status: "reviewed", src: fingerprint(state.source), val: fingerprint(suggestion), by: "claude" };
    report.fixed++;
  }

  if (!dryRun) {
    await saveLocale(locale, values, records);
    await logHistory(events);
  }
  console.log(`${code} : ${report.ok} validée(s) telles quelles, ${report.fixed} corrigée(s)`);
  for (const p of report.protectedApproved) console.log(`  ! approuvée, non modifiée : ${p.key} → suggestion « ${p.suggestion} » (${p.reason ?? ""})`);
  for (const r of report.rejected) console.log(`  ✗ suggestion rejetée ${r.key} : ${r.problems.join(" ; ")}`);
  for (const k of report.unknown) console.log(`  ? clé inconnue ou non traduite : ${k}`);
  return report;
}

export async function applyReview(options) {
  if (!options.file) throw new Error("préciser --file=verdicts.json");
  const code = options.locale?.[0];
  const raw = JSON.parse(readFileSync(options.file, "utf8"));
  const verdicts = Array.isArray(raw) ? raw : raw.verdicts;
  const locale = code ?? raw.locale;
  if (!locale) throw new Error("préciser --locale=… (ou un champ « locale » dans le fichier)");
  await targetLocales([locale]);
  const report = await applyVerdicts(locale, verdicts, { reviewer: options.reviewer ?? "claude", dryRun: Boolean(options["dry-run"]) });
  return report.rejected.length ? 1 : 0;
}
