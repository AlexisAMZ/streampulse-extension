// Notes de version (js/changelog-data.js) : chaque phrase y est un objet
// { fr: "…", en: "…", … }. Ce module repère ces objets dans l'arbre syntaxique
// (espree, déjà installé avec ESLint) et y insère une langue manquante sans
// réécrire le reste du fichier ni ses commentaires.

import { readFile, writeFile } from "node:fs/promises";
import * as espree from "espree";
import { PATHS } from "./core.mjs";

const propName = (p) => (p.key.type === "Identifier" ? p.key.name : p.key.value);

/** Objets de traduction du changelog, avec leur position dans le source. */
export async function readChangelogMaps() {
  const text = await readFile(PATHS.changelog, "utf8");
  const ast = espree.parse(text, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
  const maps = [];
  const visit = (node, trail) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ObjectExpression") {
      const props = node.properties.filter((p) => p.type === "Property" && !p.computed);
      const en = props.find((p) => propName(p) === "en" && p.value.type === "Literal" && typeof p.value.value === "string");
      if (en) {
        const values = Object.fromEntries(props.map((p) => [propName(p), p.value.value]));
        maps.push({ id: trail.join("."), values, node, props, line: node.loc.start.line });
        return;
      }
    }
    for (const [field, child] of Object.entries(node)) {
      if (field === "range" || field === "loc") continue;
      if (Array.isArray(child)) child.forEach((c, i) => visit(c, [...trail, `${field}[${i}]`]));
      else if (child && typeof child === "object") visit(child, [...trail, field]);
    }
  };
  visit(ast, []);
  // Identifiant lisible : version + chemin dans l'entrée.
  for (const map of maps) {
    const start = text.lastIndexOf('version: "', map.node.range[0]);
    map.version = start === -1 ? "?" : text.slice(start + 10, text.indexOf('"', start + 10));
  }
  return { text, maps };
}

/** Objets auxquels manque `code`. */
export async function missingChangelog(code) {
  const { maps } = await readChangelogMaps();
  return maps.filter((m) => !(code in m.values));
}

/**
 * Insère des traductions : additions = [{ map, value }]. Les insertions se
 * font de la fin vers le début du fichier pour garder les positions valides.
 */
export async function insertChangelog(code, additions) {
  let text = await readFile(PATHS.changelog, "utf8");
  const sorted = [...additions].sort((a, b) => b.map.node.range[1] - a.map.node.range[1]);
  for (const { map, value } of sorted) {
    const last = map.props.at(-1);
    const lineStart = text.lastIndexOf("\n", last.range[0]) + 1;
    const indent = text.slice(lineStart, last.range[0]);
    const multiline = /^\s*$/.test(indent);
    const after = text.slice(last.range[1]);
    const hasComma = /^\s*,/.test(after);
    const insertAt = hasComma ? last.range[1] + after.indexOf(",") + 1 : last.range[1];
    // Même style de clé que le bloc : `ja:` sans guillemets, `"pt-BR":` avec.
    const bare = last.key.type === "Identifier" && /^[a-z]+$/i.test(code);
    const prop = `${bare ? code : JSON.stringify(code)}: ${JSON.stringify(value)}`;
    const insertion = multiline ? `${hasComma ? "" : ","}\n${indent}${prop}${hasComma ? "," : ""}` : `${hasComma ? "" : ","} ${prop}`;
    text = text.slice(0, insertAt) + insertion + text.slice(insertAt);
  }
  await writeFile(PATHS.changelog, text, "utf8");
}
