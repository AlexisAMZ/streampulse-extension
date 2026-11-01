// Client DeepL minimal pour l'outillage : traduction par lots, glossaires,
// consommation. La clé vient UNIQUEMENT de process.env.DEEPL_API_KEY ; elle
// n'est jamais écrite, journalisée ni renvoyée dans un message d'erreur.
// Ce module ne tourne qu'en local (Node), jamais dans l'extension.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PATHS, loadConfig } from "./core.mjs";

export class DeeplError extends Error {
  constructor(message, { status, fatal = false } = {}) {
    super(message);
    this.status = status;
    this.fatal = fatal;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function deeplKey() {
  return (process.env.DEEPL_API_KEY || "").trim();
}

/** Les clés gratuites finissent par « :fx » et passent par api-free. */
export function endpointFor(key) {
  const { deepl } = loadConfig().config;
  return key.endsWith(":fx") ? deepl.freeEndpoint : deepl.proEndpoint;
}

/**
 * Appel HTTP avec délai maximal et nouvelles tentatives (429, 5xx, réseau).
 * 456 (quota épuisé) et 403 (clé refusée) arrêtent tout : inutile d'insister.
 */
async function call(pathname, { method = "GET", body, fetchImpl = fetch } = {}) {
  const key = deeplKey();
  if (!key) throw new DeeplError("DEEPL_API_KEY absent de l'environnement", { fatal: true });
  const { deepl } = loadConfig().config;
  let attempt = 0;
  for (;;) {
    let response;
    try {
      response = await fetchImpl(`${endpointFor(key)}${pathname}`, {
        method,
        headers: { Authorization: `DeepL-Auth-Key ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(deepl.timeoutMs),
      });
    } catch (error) {
      if (attempt++ >= deepl.maxRetries) throw new DeeplError(`DeepL injoignable : ${error.message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.status === 204 ? null : response.json();
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    if (response.status === 456) throw new DeeplError("quota DeepL épuisé pour ce mois", { status: 456, fatal: true });
    if (response.status === 403) throw new DeeplError("clé DeepL refusée (403)", { status: 403, fatal: true });
    if ((response.status === 429 || response.status >= 500) && attempt++ < deepl.maxRetries) {
      const retryAfter = Number(response.headers.get("retry-after")) || 0;
      await sleep(Math.max(retryAfter * 1000, 1000 * 2 ** attempt));
      continue;
    }
    throw new DeeplError(`DeepL ${response.status} ${detail}`, { status: response.status });
  }
}

/** Caractères consommés et quota du compte (appel gratuit). */
export function usage(options) {
  return call("/v2/usage", options);
}

/**
 * Traduit des textes XML (déjà masqués). Découpe en lots selon le nombre de
 * textes et la taille de la requête.
 */
export async function translateXml(texts, { target, formality, glossaryId, context, fetchImpl, onBatch } = {}) {
  const { deepl } = loadConfig().config;
  const batches = [];
  let current = [];
  let bytes = 0;
  for (const text of texts) {
    const size = Buffer.byteLength(text);
    if (current.length && (current.length >= deepl.batchSize || bytes + size > deepl.maxBatchBytes)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(text);
    bytes += size;
  }
  if (current.length) batches.push(current);

  const out = [];
  for (const [index, batch] of batches.entries()) {
    const body = {
      text: batch,
      source_lang: "EN",
      target_lang: target,
      tag_handling: "xml",
      ignore_tags: ["x"],
      preserve_formatting: true,
      split_sentences: "nonewlines",
      context: context ?? deepl.context,
      ...(formality ? { formality } : {}),
      ...(glossaryId ? { glossary_id: glossaryId } : {}),
    };
    const result = await call("/v2/translate", { method: "POST", body, fetchImpl });
    const translated = result.translations.map((t) => t.text);
    out.push(...translated);
    await onBatch?.({ index, total: batches.length, sources: batch, translated });
  }
  return out;
}

// ── Glossaires DeepL ────────────────────────────────────────────────────────

const glossaryCacheFile = () => path.join(PATHS.cache, "deepl-glossaries.json");

function readGlossaryCache() {
  try {
    return JSON.parse(readFileSync(glossaryCacheFile(), "utf8"));
  } catch {
    return {};
  }
}

/** Paires anglais → cible tirées de localization/glossary.json. */
export function glossaryEntries(code) {
  const pairs = new Map();
  for (const term of loadConfig().glossary.terms) {
    const rule = term.translations?.[code];
    if (!rule?.value || term.status === "proposed") continue;
    const source = term.match?.[0] ?? term.term;
    if (source && !/[\t\n]/.test(source + rule.value)) pairs.set(source, rule.value);
  }
  return [...pairs];
}

/**
 * Identifiant d'un glossaire DeepL à jour pour cette langue. Recréé seulement
 * quand les entrées changent ; une langue que DeepL refuse en glossaire
 * continue sans (avertissement).
 */
export async function ensureGlossary(code, target, { fetchImpl, log = console.warn } = {}) {
  const entries = glossaryEntries(code);
  if (!entries.length) return null;
  const tsv = entries.map(([s, t]) => `${s}\t${t}`).join("\n");
  const digest = createHash("sha1").update(`${target}\n${tsv}`).digest("hex").slice(0, 12);
  const cache = readGlossaryCache();
  if (cache[code]?.digest === digest) return cache[code].id;
  if (cache[code]?.id) {
    await call(`/v2/glossaries/${cache[code].id}`, { method: "DELETE", fetchImpl }).catch(() => {});
  }
  try {
    const created = await call("/v2/glossaries", {
      method: "POST",
      fetchImpl,
      body: {
        name: `streampulse-${code}-${digest}`,
        source_lang: "en",
        target_lang: target.split("-")[0].toLowerCase(),
        entries: tsv,
        entries_format: "tsv",
      },
    });
    mkdirSync(PATHS.cache, { recursive: true });
    await writeFile(glossaryCacheFile(), JSON.stringify({ ...cache, [code]: { id: created.glossary_id, digest } }, null, 2));
    return created.glossary_id;
  } catch (error) {
    if (error.fatal) throw error;
    log(`  glossaire DeepL indisponible pour ${code} (${error.message}) : traduction sans glossaire`);
    return null;
  }
}

// ── Cache des réponses ──────────────────────────────────────────────────────

/** Cache disque des traductions DeepL : un second passage ne refacture rien. */
export function openCache(code) {
  const file = path.join(PATHS.cache, "deepl", `${code}.json`);
  let data = {};
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      data = {};
    }
  }
  const keyOf = (xml, settings) => createHash("sha1").update(`${settings}\n${xml}`).digest("hex");
  return {
    get: (xml, settings) => data[keyOf(xml, settings)],
    set: (xml, settings, value) => {
      data = { ...data, [keyOf(xml, settings)]: value };
    },
    async save() {
      mkdirSync(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(data));
    },
  };
}
