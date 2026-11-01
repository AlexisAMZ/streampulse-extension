// Protection des fragments qui ne doivent jamais être traduits.
//
// Un texte est découpé en segments : texte libre, jetons protégés
// ({{count}}, URL, marques de protected-terms.json…) et balises HTML. Pour
// DeepL (tag_handling=xml), les jetons deviennent <x i="n"/> et les paires de
// balises <t i="n">…</t> : le texte À L'INTÉRIEUR d'un <strong> se traduit,
// la balise elle-même revient octet pour octet. Seuls les fragments listés
// sont masqués, jamais la phrase entière.

import { loadConfig } from "./core.mjs";

const VOID_TAGS = new Set(["br", "hr", "img", "input", "wbr", "meta", "link", "source"]);
const TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let compiled = null;

/** Motifs et termes compilés depuis localization/protected-terms.json. */
export function protection() {
  if (compiled) return compiled;
  const cfg = loadConfig().protected;
  const patterns = cfg.patterns.map((p) => ({ name: p.name, re: new RegExp(p.regex, "gu") }));
  // Les plus longs d'abord : « StreamPulse Clips » avant « StreamPulse ».
  const terms = [...cfg.terms]
    .sort((a, b) => b.term.length - a.term.length)
    .map((t) => ({
      term: t.term,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t.term)}(?![\\p{L}\\p{N}])`, t.caseSensitive ? "gu" : "giu"),
    }));
  compiled = { patterns, terms };
  return compiled;
}

/** Remet à zéro la compilation (tests qui changent la configuration). */
export function resetProtection() {
  compiled = null;
}

/**
 * Découpe un texte en segments. Les chevauchements se résolvent par la
 * position la plus à gauche, puis la correspondance la plus longue : une URL
 * à l'intérieur d'une balise <a href="…"> reste dans la balise.
 */
export function segment(text) {
  const source = String(text);
  const { patterns, terms } = protection();
  const found = [];
  const collect = (re, kind, name) => {
    re.lastIndex = 0;
    for (const m of source.matchAll(re)) {
      if (m[0]) found.push({ start: m.index, end: m.index + m[0].length, kind, name, value: m[0] });
    }
  };
  collect(TAG_RE, "tag", "html");
  for (const p of patterns) collect(p.re, "token", p.name);
  for (const t of terms) collect(t.re, "token", `term:${t.term}`);
  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments = [];
  let cursor = 0;
  for (const f of found) {
    if (f.start < cursor) continue;
    if (f.start > cursor) segments.push({ kind: "text", value: source.slice(cursor, f.start) });
    segments.push(f);
    cursor = f.end;
  }
  if (cursor < source.length) segments.push({ kind: "text", value: source.slice(cursor) });
  return pairTags(segments);
}

const tagName = (tag) => tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/)[1].toLowerCase();

/** Associe les balises ouvrantes et fermantes ; une orpheline devient un jeton. */
function pairTags(segments) {
  const out = segments.map((s) => ({ ...s }));
  const stack = [];
  out.forEach((s, index) => {
    if (s.kind !== "tag") return;
    const name = tagName(s.value);
    if (s.value.startsWith("</")) {
      const openIndex = stack.findLastIndex((o) => o.name === name);
      if (openIndex === -1) {
        s.role = "void";
        return;
      }
      // Les ouvrantes restées ouvertes à l'intérieur ne se ferment jamais.
      stack.splice(openIndex).slice(1).forEach((o) => (out[o.index].role = "void"));
      s.role = "close";
      return;
    }
    if (VOID_TAGS.has(name) || s.value.endsWith("/>")) {
      s.role = "void";
      return;
    }
    s.role = "open";
    stack.push({ name, index });
  });
  stack.forEach((o) => (out[o.index].role = "void"));
  return out;
}

const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xmlUnescape = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * Prépare un texte pour DeepL. Retourne le XML à envoyer et les « slots »
 * nécessaires à la restauration.
 */
export function mask(text) {
  const slots = [];
  let xml = "";
  for (const s of segment(text)) {
    if (s.kind === "text") {
      xml += xmlEscape(s.value);
    } else if (s.kind === "token" || s.role === "void") {
      xml += `<x i="${slots.push(s.value) - 1}"/>`;
    } else if (s.role === "open") {
      xml += `<t i="${slots.push(s.value) - 1}">`;
    } else {
      xml += "</t>";
      slots.push(s.value);
      // La fermante est retrouvée par la pile à la restauration.
    }
  }
  return { xml, slots };
}

/**
 * Restaure les fragments protégés. Les balises fermantes d'origine sont
 * reprises dans l'ordre où leurs ouvrantes ont été fermées.
 */
export function unmask(xml, slots, original) {
  const closers = closingTagsByOpen(original);
  const stack = [];
  const restored = String(xml).replace(
    /<x\s+i="(\d+)"\s*\/>|<x\s+i="(\d+)"\s*>\s*<\/x>|<t\s+i="(\d+)"\s*>|<\/t\s*>/g,
    (whole, xa, xb, open) => {
      const voidIndex = xa ?? xb;
      if (voidIndex !== undefined) return slots[Number(voidIndex)] ?? whole;
      if (open !== undefined) {
        stack.push(Number(open));
        return slots[Number(open)] ?? whole;
      }
      const opened = stack.pop();
      return opened === undefined ? "" : closers.get(opened) ?? "";
    },
  );
  return xmlUnescape(restored);
}

/** Pour chaque balise ouvrante (index de slot), le texte de sa fermante. */
function closingTagsByOpen(original) {
  const map = new Map();
  const stack = [];
  let slot = 0;
  for (const s of segment(original)) {
    if (s.kind === "text") continue;
    if (s.kind === "token" || s.role === "void") {
      slot++;
    } else if (s.role === "open") {
      stack.push(slot++);
    } else {
      map.set(stack.pop(), s.value);
      slot++;
    }
  }
  return map;
}

/**
 * Applique `transform` au seul texte libre (pseudo-localisation, tests) :
 * jetons et balises traversent intacts.
 */
export function mapText(text, transform) {
  return segment(text)
    .map((s) => (s.kind === "text" ? transform(s.value) : s.value))
    .join("");
}

/** Inventaire des fragments protégés d'un texte, pour comparer source et cible. */
export function fragments(text) {
  const result = { variables: [], tags: [], links: [], handles: [], newlines: 0, terms: new Map() };
  for (const s of segment(text)) {
    if (s.kind === "tag") {
      result.tags.push(s.value.replace(/\s+/g, " "));
    } else if (s.kind === "token") {
      if (["mustache", "template-literal", "icu-brace", "printf"].includes(s.name)) result.variables.push(s.value.replace(/\s+/g, ""));
      else if (["url", "domain"].includes(s.name)) result.links.push(s.value);
      else if (["email", "handle"].includes(s.name)) result.handles.push(s.value);
      else if (s.name === "newline") result.newlines++;
      else if (s.name.startsWith("term:")) {
        const term = s.name.slice(5);
        result.terms.set(term, (result.terms.get(term) || 0) + 1);
      }
    }
  }
  result.variables.sort();
  result.tags.sort();
  result.links.sort();
  result.handles.sort();
  return result;
}
