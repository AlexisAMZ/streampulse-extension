/**
 * Génère les trois propositions de la 5e capture (« Tu gardes la main »)
 * dans un dossier de comparaison, sans toucher aux captures du store.
 *
 *   node scripts/store-assets/control-variants.mjs [fr en ...]
 *
 * Sortie : images/propositions-5e/<langue>-v1.png, -v2.png, -v3.png
 * Prérequis : le banc (Portly : StreamPulseMain/harness).
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT, WORK_DIR, CANVAS, POPUP_VIEWPORT, LANG_DIRS } from "./config.mjs";
import { resolveTagline, makeTranslator, applyTypography } from "./copy.mjs";
import { captureWhenReady, capture, resizeExact, flattenToRgb } from "./shot.mjs";
import { findBannedTerms } from "./policy.mjs";
import { buildControlV1, buildControlV2, buildControlV3 } from "./control-frames.mjs";

const HARNESS_URL = process.env.STORE_HARNESS_URL || "http://127.0.0.1:5179";
const OUT = path.join(ROOT, "images", "propositions-5e");
const LOGO = path.join(ROOT, "images", "photos", "logosp.png");

/**
 * Textes. Chaque affirmation de vie privée reprend la déclaration de la fiche
 * (CHROMEWEBSTORE.md) : aucun compte, aucune pub, aucun traceur, et des
 * streamers, réglages et temps de visionnage qui restent sur l'appareil. On ne
 * dit jamais « aucune donnée envoyée » : le badge communautaire (désactivé par
 * défaut) et la licence StreamPulse+ contactent le serveur.
 */
const COPY = {
  fr: {
    title: "Tu gardes la main.",
    subtitle: "Tes badges suivis pour toi, chaque réglage à ta portée, tes données sur ton appareil.",
    chips: ["Tout se règle", "Aucun compte, aucune pub, aucun traceur", "Streamers et réglages sur ton appareil"],
    columns: [
      { title: "Tes badges, suivis pour toi", body: "Ceux en cours, ceux à venir et ceux obtenus, au même endroit." },
      { title: "Chaque réglage à ta portée", body: "Live, catégorie, titre, son et heures calmes : c'est toi qui choisis." },
      {
        title: "Ta vie privée d'abord",
        body: "Streamers, réglages et temps de visionnage restent sur ton appareil.",
        points: ["Aucun compte", "Aucun traceur", "Données sur ton appareil"],
      },
    ],
    banner: "Aucun compte · Streamers et réglages sur ton appareil",
  },
  en: {
    title: "You stay in control.",
    subtitle: "Your badges tracked for you, every setting within reach, your data on your device.",
    chips: ["Every setting is yours", "No account, no ads, no trackers", "Streamers and settings on your device"],
    columns: [
      { title: "Your badges, tracked for you", body: "In progress, upcoming and earned, all in one place." },
      { title: "Every setting within reach", body: "Live, category, title, sound and quiet hours: you decide." },
      {
        title: "Privacy comes first",
        body: "Streamers, settings and watch time stay on your device.",
        points: ["No account", "No trackers", "Data on your device"],
      },
    ],
    banner: "No account · Streamers and settings on your device",
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le serveur http.server du banc coupe parfois une connexion : on retente. */
async function capturePopupView(lang, view, panel) {
  const outPath = path.join(WORK_DIR, `ctl-${lang}-${view}.png`);
  const readyExpr = `(() => { const p = document.querySelector('#menu-${panel}'); return !!p && !p.hidden && p.offsetParent !== null && p.innerText.length > 150; })()`;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await captureWhenReady({
        url: `${HARNESS_URL}/scripts/dev/page-harness.html?page=popup&store=1&lang=${lang}&view=${view}`,
        outPath,
        width: POPUP_VIEWPORT.width,
        height: POPUP_VIEWPORT.height,
        readyExpr,
      });
      return outPath;
    } catch (error) {
      if (attempt === 8) throw error;
      await sleep(500);
    }
  }
}

async function renderFrame(name, html, outPath) {
  const htmlPath = path.join(WORK_DIR, `${name}.html`);
  const rawPath = path.join(WORK_DIR, `${name}.png`);
  fs.writeFileSync(htmlPath, html, "utf8");
  await capture({ htmlPath, outPath: rawPath, width: CANVAS.width, height: CANVAS.height });
  await resizeExact(rawPath, CANVAS.width, CANVAS.height);
  fs.copyFileSync(rawPath, outPath);
  await flattenToRgb(outPath);
}

async function main() {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "en"];
  const i18n = await import(path.join(ROOT, "i18n", "translations.js"));
  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  try {
    for (const lang of langs) {
      const copy = COPY[lang];
      if (!copy || !LANG_DIRS[lang]) throw new Error(`Langue sans texte : ${lang}`);
      const t = makeTranslator(i18n.translations, lang);
      const tagline = resolveTagline(applyTypography(t("onboarding.welcomeTagline"), lang), lang);

      const hits = findBannedTerms(
        [
          { label: "titre", text: copy.title },
          { label: "sous-titre", text: copy.subtitle },
          ...copy.chips.map((text, i) => ({ label: `pastille ${i + 1}`, text })),
          ...copy.columns.flatMap((c, i) => [{ label: `col ${i + 1} titre`, text: c.title }, { label: `col ${i + 1} corps`, text: c.body }]),
          { label: "bandeau", text: copy.banner },
        ],
        lang,
      );
      if (hits.length) throw new Error(`Termes interdits : ${hits.map((h) => `${h.term} (${h.label})`).join(", ")}`);

      const badgesShot = await capturePopupView(lang, "badges", "badges");
      const settingsShot = await capturePopupView(lang, "settings", "notifications");
      const base = { logoPath: LOGO, tagline, title: copy.title, subtitle: copy.subtitle, badgesShot, settingsShot };

      await renderFrame(`ctl-${lang}-1`, buildControlV1({ ...base, chips: copy.chips }), path.join(OUT, `${lang}-v1.png`));
      await renderFrame(`ctl-${lang}-2`, buildControlV2({ ...base, columns: copy.columns }), path.join(OUT, `${lang}-v2.png`));
      await renderFrame(`ctl-${lang}-3`, buildControlV3({ ...base, banner: copy.banner }), path.join(OUT, `${lang}-v3.png`));
      console.log(`✓ ${lang} → ${path.relative(ROOT, OUT)}`);
    }
  } finally {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
