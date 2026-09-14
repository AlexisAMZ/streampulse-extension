#!/usr/bin/env node
/**
 * Génère les captures d'écran localisées du Chrome Web Store.
 *
 *   node scripts/make-store-assets.mjs            # les 15 langues
 *   node scripts/make-store-assets.mjs fr en      # seulement celles listées
 *   KEEP_BUILD=1 node scripts/make-store-assets.mjs fr   # garde les intermédiaires
 *
 * Sortie : images/cws_screenshots/<LANGUE>/01-dashboard.png, 02-automation.png,
 * 03-features.png : trois PNG 1280x800 par langue.
 *
 * Le rendu part du vrai popup et des vraies traductions : rien n'est maquetté à
 * la main, donc une évolution de l'UI se répercute au prochain run.
 */

import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  WORK_DIR,
  OUT_DIR,
  LANG_DIRS,
  LOCALES,
  CANVAS,
  POPUP_VIEWPORT,
} from "./store-assets/config.mjs";
import {
  loadListingCopy,
  makeTranslator,
  applyTypography,
  resolveTagline,
} from "./store-assets/copy.mjs";
import { buildPopupPage } from "./store-assets/popup-page.mjs";
import { buildProductFrame, buildFeaturesFrame } from "./store-assets/frames.mjs";
import { buildPromoTile, PROMO_TILE, buildPromoMarquee, PROMO_MARQUEE } from "./store-assets/promo.mjs";
import { findBannedTerms, stripPromotionalSentences } from "./store-assets/policy.mjs";
import {
  assertChromeAvailable,
  capture,
  resizeExact,
  pixelSize,
  flattenToRgb,
  colorMode,
} from "./store-assets/shot.mjs";

const LOGO = path.join(ROOT, "images", "photos", "logosp.png");

/**
 * Serveur local qui sert la racine du dépôt (Portly : StreamPulseMain/harness).
 * La page récap et la scène Twitch utilisent des modules ES et un faux chrome.* :
 * elles ne s'ouvrent pas en file://.
 */
const HARNESS_URL = process.env.STORE_HARNESS_URL || "http://127.0.0.1:5179";

async function assertHarnessUp() {
  try {
    const response = await fetch(`${HARNESS_URL}/scripts/dev/page-harness.html`);
    if (response.ok) return;
  } catch {
    // traité ci-dessous
  }
  throw new Error(
    `Harness injoignable sur ${HARNESS_URL} : lancer « portly start StreamPulseMain/harness » ` +
      "ou définir STORE_HARNESS_URL.",
  );
}

/** Capture une page du harness (taille CSS, rendue en 2x). */
async function captureHarness(name, pagePath, size = CANVAS) {
  const outPath = path.join(WORK_DIR, `${name}.png`);
  await capture({
    url: `${HARNESS_URL}${pagePath}`,
    outPath,
    width: size.width,
    height: size.height,
    budgetMs: 5000,
  });
  return outPath;
}

/** Langue de la tuile promotionnelle : celle déclarée comme principale au store. */
const PROMO_LANG = "fr";

/**
 * Refuse de générer si un texte MARKETING imprimé sur un asset porte un terme
 * interdit par le règlement du Chrome Web Store (gratuit, nouveau, n° 1…).
 * Ces textes-là sont sous notre contrôle : mieux vaut échouer ici qu'essuyer un
 * refus de validation.
 */
function assertPolicyClean(entries, lang) {
  const hits = findBannedTerms(entries, lang);
  if (!hits.length) return;
  const details = hits
    .map((hit) => `    « ${hit.term} » dans ${hit.label} : ${hit.text.slice(0, 90)}`)
    .join("\n");
  throw new Error(
    `Termes promotionnels interdits sur les assets ${lang} :\n${details}\n` +
      "  Voir scripts/store-assets/policy.mjs",
  );
}

/**
 * Signale, sans bloquer, les termes sensibles dans les chaînes d'INTERFACE.
 *
 * Le règlement vise les badges et accroches promotionnels, pas le vocabulaire
 * fonctionnel d'un produit : l'allemand « Player neu laden » (recharger) ou le
 * turc « Yenile » (actualiser) ne sont pas des arguments de vente. On avertit
 * pour garder un œil dessus, mais échouer ici bloquerait la génération sur du
 * texte que l'on n'écrit pas et qui ne pose pas de problème.
 */
function warnPolicySoft(entries, lang) {
  for (const hit of findBannedTerms(entries, lang)) {
    console.warn(
      `  ⚠︎ ${lang} · terme « ${hit.term} » dans l'interface (${hit.label}) : ` +
        `${hit.text.slice(0, 70)}`,
    );
  }
}

/** Les deux vues du popup que l'on capture, avec leur point d'ancrage. */
const POPUP_VARIANTS = [
  { name: "dashboard", panel: null },
  { name: "automation", panel: "automation" },
];

/**
 * Clés i18n effectivement rendues dans le popup. Elles apparaissent en clair
 * dans les captures, donc elles tombent sous le même règlement que les textes
 * du cadre : le contrôle serait incomplet sans elles.
 */
function popupI18nKeys() {
  const html = fs.readFileSync(path.join(ROOT, "html", "popup.html"), "utf8");
  const matches = html.matchAll(/data-i18n(?:-attr-\w+)?="([^"]+)"/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

function writeWork(name, contents) {
  const filePath = path.join(WORK_DIR, name);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

/**
 * Rend un visuel : capture en 2x, réduction aux dimensions exactes, puis
 * vérification. `flatten` retire le canal alpha (exigé pour la tuile promo).
 */
async function renderFrame({ name, html, outPath, size = CANVAS, flatten = false }) {
  const htmlPath = writeWork(`${name}.html`, html);
  const rawPath = path.join(WORK_DIR, `${name}.png`);
  await capture({
    htmlPath,
    outPath: rawPath,
    width: size.width,
    height: size.height,
  });
  await resizeExact(rawPath, size.width, size.height);
  fs.copyFileSync(rawPath, outPath);
  if (flatten) await flattenToRgb(outPath);

  const actual = await pixelSize(outPath);
  if (actual.width !== size.width || actual.height !== size.height) {
    throw new Error(
      `${outPath} fait ${actual.width}x${actual.height}, attendu ${size.width}x${size.height}`,
    );
  }
  if (flatten) {
    const mode = await colorMode(outPath);
    if (mode !== "RGB") {
      throw new Error(`${outPath} est en mode ${mode}, attendu RGB (24 bits sans alpha)`);
    }
  }
}

async function buildLanguage({ lang, translations, listing, uiKeys }) {
  const translate = makeTranslator(translations, lang);
  const t = (key, vars) => applyTypography(translate(key, vars), lang);
  const dirName = LANG_DIRS[lang];
  const outDir = path.join(OUT_DIR, dirName);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Captures du popup réel, une par vue.
  //    Une capture manuelle déposée dans le dossier de la langue sous le nom
  //    `source-<vue>.png` remplace le rendu automatique. Utile quand on veut du
  //    vrai contenu de stream plutôt que le jeu de démonstration : à condition
  //    de fournir une image ~1640px de large, sinon elle sera floue une fois
  //    intégrée au cadre 1280x800.
  const popupShots = {};
  for (const spec of POPUP_VARIANTS) {
    const override = path.join(outDir, `source-${spec.name}.png`);
    if (fs.existsSync(override)) {
      const { width } = await pixelSize(override);
      if (width < 1200) {
        console.warn(
          `  ⚠︎ ${path.relative(ROOT, override)} fait ${width}px de large ; ` +
            "elle sera agrandie et perdra en netteté (viser 1640px).",
        );
      }
      popupShots[spec.name] = override;
      continue;
    }
    if (!spec.panel) {
      throw new Error(
        `Capture manquante : ${path.relative(ROOT, override)} (vraie capture du popup, ~1240px de large)`,
      );
    }
    const html = buildPopupPage({
      lang,
      locale: LOCALES[lang],
      strings: translations[lang],
      fallback: translations.en,
      panel: spec.panel,
    });
    const htmlPath = writeWork(`popup-${lang}-${spec.name}.html`, html);
    const shotPath = path.join(WORK_DIR, `popup-${lang}-${spec.name}.png`);
    await capture({
      htmlPath,
      outPath: shotPath,
      width: POPUP_VIEWPORT.width,
      height: POPUP_VIEWPORT.height,
    });
    popupShots[spec.name] = shotPath;
  }

  const tagline = resolveTagline(t("onboarding.welcomeTagline"), lang);

  // La description courte du listing se termine sur une accroche du type
  // « Dispo en 15 langues ! Gratuit. » : « gratuit » est un mot-clé interdit sur
  // les assets, on retire la phrase et on garde l'énumération factuelle.
  const featuresSubtitle = stripPromotionalSentences(listing[lang].short, lang);
  const bullets = listing[lang].bullets.map((bullet) => ({
    title: applyTypography(bullet.title, lang),
    body: applyTypography(bullet.body, lang),
  }));

  assertPolicyClean(
    [
      { label: "tagline", text: tagline },
      { label: "titre 01", text: t("popup.greetingSub") },
      { label: "sous-titre 01", text: t("popup.settings.liveNotificationsDescription") },
      { label: "titre 02", text: t("onboarding.autoClaimTitle") },
      { label: "sous-titre 02", text: t("onboarding.autoClaimDescription") },
      { label: "titre 03", text: t("onboarding.welcomeTitle") },
      { label: "sous-titre 03", text: featuresSubtitle },
      ...bullets.flatMap((bullet, index) => [
        { label: `puce ${index + 1} titre`, text: bullet.title },
        { label: `puce ${index + 1} corps`, text: bullet.body },
      ]),
    ],
    lang,
  );

  warnPolicySoft(
    uiKeys.map((key) => ({ label: key, text: translate(key) })),
    lang,
  );

  // 2. Cadres marketing. Les titres viennent des traductions embarquées, les
  //    puces de CHROMEWEBSTORE.md : aucun texte n'est produit à la volée.
  await renderFrame({
    name: `frame-${lang}-01`,
    outPath: path.join(outDir, "01-dashboard.png"),
    flatten: true,
    html: buildProductFrame({
      logoPath: LOGO,
      tagline,
      title: t("popup.greetingSub"),
      subtitle: t("popup.settings.liveNotificationsDescription"),
      shotPath: popupShots.dashboard,
    }),
  });

  await renderFrame({
    name: `frame-${lang}-02`,
    outPath: path.join(outDir, "02-automation.png"),
    flatten: true,
    html: buildProductFrame({
      logoPath: LOGO,
      tagline,
      title: t("onboarding.autoClaimTitle"),
      subtitle: t("onboarding.autoClaimDescription"),
      shotPath: popupShots.automation,
    }),
  });

  await renderFrame({
    name: `frame-${lang}-03`,
    outPath: path.join(outDir, "03-features.png"),
    flatten: true,
    html: buildFeaturesFrame({
      logoPath: LOGO,
      tagline,
      title: t("onboarding.welcomeTitle"),
      subtitle: applyTypography(featuresSubtitle, lang),
      features: bullets,
    }),
  });

  // 3. Page « Mon récap » avec des données de démonstration.
  const recapShot = await captureHarness(
    `recap-${lang}`,
    `/scripts/dev/page-harness.html?page=recap&shot=1&lang=${encodeURIComponent(lang)}`,
    { width: 1280, height: 520 },
  );
  const recapTitle = t("recap.title");
  const recapSubtitle = t("recap.subtitle");

  // 4. Éléments ajoutés sur Twitch : la scène n'existe qu'en français et anglais.
  const twitchShot = await captureHarness(
    `twitch-${lang}`,
    `/scripts/dev/twitch-harness.html?shot=1&lang=${lang === "fr" ? "fr" : "en"}`,
    { width: 1000, height: 820 },
  );
  // Puce « Bouton Ajouter à StreamPulse » : la scène montre le panneau et le bouton.
  const twitchBullet = bullets[2];

  assertPolicyClean(
    [
      { label: "titre 04", text: recapTitle },
      { label: "sous-titre 04", text: recapSubtitle },
      { label: "titre 05", text: twitchBullet.title },
      { label: "sous-titre 05", text: twitchBullet.body },
    ],
    lang,
  );

  await renderFrame({
    name: `frame-${lang}-04`,
    outPath: path.join(outDir, "04-recap.png"),
    flatten: true,
    html: buildProductFrame({ logoPath: LOGO, tagline, title: recapTitle, subtitle: recapSubtitle, shotPath: recapShot }),
  });

  await renderFrame({
    name: `frame-${lang}-05`,
    outPath: path.join(outDir, "05-twitch.png"),
    flatten: true,
    html: buildProductFrame({
      logoPath: LOGO,
      tagline,
      title: twitchBullet.title,
      subtitle: twitchBullet.body,
      shotPath: twitchShot,
    }),
  });

  return outDir;
}

/**
 * Petite tuile promotionnelle : un seul visuel pour toute la fiche, pas un par
 * langue. Rédigé dans la langue principale du store (français, cf.
 * CHROMEWEBSTORE.md § 1). Seul asset qui doit être sans canal alpha.
 */
async function buildPromo({ translations, listing, lang = PROMO_LANG }) {
  const t = makeTranslator(translations, lang);
  const suffix = lang === PROMO_LANG ? "" : `_${lang}`;
  const outDir = path.join(ROOT, "images", "promo");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `small_tile${suffix}.png`);

  // Points de chaîne, alertes live, aperçus au survol : les trois arguments les
  // plus vendeurs parmi les puces du listing, dans leur ordre d'origine.
  const bullets = listing[lang].bullets;
  const benefits = [bullets[0], bullets[1], bullets[3]].map((bullet) =>
    applyTypography(bullet.title, lang),
  );
  const tagline = resolveTagline(t("onboarding.welcomeTagline"), lang);

  assertPolicyClean(
    [
      { label: "tagline", text: tagline },
      ...benefits.map((text, index) => ({ label: `bénéfice ${index + 1}`, text })),
    ],
    lang,
  );

  await renderFrame({
    name: `promo-small${suffix}`,
    outPath,
    size: PROMO_TILE,
    flatten: true,
    html: buildPromoTile({ logoPath: LOGO, tagline, benefits }),
  });

  // Grande image en haut de la fiche, avec la vraie capture du popup.
  const marqueePath = path.join(outDir, `marquee_1400x560${suffix}.png`);
  const title = lang === "fr" ? "Ne rate aucun live." : "Never miss a live.";
  const accent = lang === "fr" ? "Et bien plus." : "And plenty more.";
  assertPolicyClean(
    [
      { label: "marquee titre", text: title },
      { label: "marquee accent", text: accent },
    ],
    lang,
  );
  await renderFrame({
    name: `promo-marquee${suffix}`,
    outPath: marqueePath,
    size: PROMO_MARQUEE,
    flatten: true,
    html: buildPromoMarquee({
      logoPath: LOGO,
      title,
      accent,
      benefits,
      shotPath: path.join(OUT_DIR, LANG_DIRS[lang], "source-dashboard.png"),
    }),
  });

  return [outPath, marqueePath];
}

async function main() {
  assertChromeAvailable();
  await assertHarnessUp();

  const i18n = await import(path.join(ROOT, "i18n", "translations.js"));
  const listing = loadListingCopy();
  const uiKeys = popupI18nKeys();


  const requested = process.argv.slice(2);
  const targets = requested.length ? requested : Object.keys(LANG_DIRS);
  for (const lang of targets) {
    if (!LANG_DIRS[lang]) {
      throw new Error(
        `Langue inconnue : ${lang} (attendu : ${Object.keys(LANG_DIRS).join(", ")})`,
      );
    }
  }

  fs.rmSync(WORK_DIR, { recursive: true, force: true });
  fs.mkdirSync(WORK_DIR, { recursive: true });

  try {
    for (const lang of targets) {
      const outDir = await buildLanguage({
        lang,
        translations: i18n.translations,
        listing,
        uiKeys,
      });
      console.log(`✓ ${lang.padEnd(6)} → ${path.relative(ROOT, outDir)}`);
    }

    for (const lang of [PROMO_LANG, "en"]) {
      const promoPaths = await buildPromo({ translations: i18n.translations, listing, lang });
      for (const promoPath of promoPaths) console.log(`✓ promo  → ${path.relative(ROOT, promoPath)} (24 bits)`);
    }
  } finally {
    if (!process.env.KEEP_BUILD) {
      fs.rmSync(WORK_DIR, { recursive: true, force: true });
    } else {
      console.log(`\nIntermédiaires conservés : ${path.relative(ROOT, WORK_DIR)}`);
    }
  }

  console.log(`\n${targets.length} langue(s) · 5 captures 1280x800 chacune.`);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
