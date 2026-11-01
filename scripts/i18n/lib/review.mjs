// Relecture linguistique des traductions par Claude.
//
// Deux modes :
//  - ANTHROPIC_API_KEY présent : appel direct de l'API Messages, par lots ;
//  - sinon : un « dossier de relecture » JSON est écrit dans
//    localization/.cache/review/, à faire relire dans une session Claude Code
//    qui rend un fichier de résultats au même format (i18n:apply-review).
// Dans les deux cas Claude ne fait que PROPOSER : l'application passe par
// applyReview(), qui revalide chaque suggestion et ne touche jamais une
// traduction approuvée.

import { readFileSync } from "node:fs";
import path from "node:path";
import { PATHS, loadConfig } from "./core.mjs";

/** Règles de traduction d'une langue, tirées de localization/rules.md. */
export function rulesFor(code) {
  const text = readFileSync(path.join(PATHS.localization, "rules.md"), "utf8");
  const general = text.split(/^## /m)[1] ?? "";
  const section = text.split(/^## /m).find((s) => s.startsWith(`${code} `) || s.startsWith(`${code}\n`)) ?? "";
  return `## ${general.trim()}\n\n${section ? `## ${section.trim()}` : ""}`.trim();
}

/** Termes du glossaire présents dans un lot, avec la forme attendue. */
function glossaryFor(code, items) {
  const text = items.map((i) => i.source).join("\n").toLowerCase();
  return loadConfig()
    .glossary.terms.filter((t) => (t.match ?? []).some((m) => text.includes(m.toLowerCase())))
    .map((t) => ({
      term: t.term,
      definition: t.definition,
      context: t.context,
      expected: t.translations?.[code]?.value ?? null,
      variants: t.translations?.[code]?.variants ?? [],
      forbidden: t.translations?.[code]?.forbidden ?? [],
    }));
}

/** Contenu de relecture d'un lot : ce que voit le relecteur. */
export function buildPack(code, label, items) {
  return {
    format: "streampulse-review/1",
    locale: code,
    language: label,
    instructions:
      "Relis chaque traduction face à l'anglais. Pour chacune, rends verdict « ok » ou « fix ». " +
      "Avec « fix », donne `suggestion` (la traduction complète corrigée) et `reason` (courte, en français). " +
      "Garde à l'identique les variables {{x}}, les balises HTML et les termes protégés. Respecte le glossaire et les règles. " +
      "Ne propose pas de changement de goût : seulement grammaire, sens, terminologie, naturel, longueur, cohérence. " +
      "Pour les clés de pluriel (.one/.few/.many/.other), accorde le nom au nombre selon la catégorie CLDR de la langue.",
    rules: rulesFor(code),
    glossary: glossaryFor(code, items),
    items: items.map((i) => ({
      key: i.key,
      status: i.status,
      by: i.by,
      source: i.source,
      translation: i.value,
      ...(i.category ? { pluralCategory: i.category } : {}),
    })),
  };
}

const SYSTEM =
  "You are a senior localization reviewer for StreamPulse, a browser extension for Twitch, Kick and YouTube viewers. " +
  "You answer with JSON only: an array of {\"key\", \"verdict\": \"ok\"|\"fix\", \"suggestion\"?, \"reason\"?, \"severity\"?: \"minor\"|\"major\"}.";

/** Envoie un lot à l'API Messages et rend le tableau de verdicts. */
export async function reviewWithClaude(pack, { fetchImpl = fetch } = {}) {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY absent de l'environnement");
  const { review } = loadConfig().config;
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.I18N_REVIEW_MODEL || review.model,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(pack) }],
    }),
    signal: AbortSignal.timeout(review.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`API Claude ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data.content?.map((c) => c.text ?? "").join("") ?? "";
  return parseVerdicts(text);
}

/** Extrait le tableau JSON d'une réponse, même entourée de texte. */
export function parseVerdicts(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("réponse de relecture sans tableau JSON");
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("réponse de relecture : un tableau est attendu");
  return parsed.filter((v) => v && typeof v.key === "string" && ["ok", "fix"].includes(v.verdict));
}
