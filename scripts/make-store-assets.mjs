#!/usr/bin/env node
/**
 * Génère les captures d'écran localisées du Chrome Web Store.
 *
 *   node scripts/make-store-assets.mjs            # les 15 langues
 *   node scripts/make-store-assets.mjs fr en      # seulement celles listées
 *   KEEP_BUILD=1 node scripts/make-store-assets.mjs fr   # garde les intermédiaires
 *
 * Sortie : images/cws_screenshots/<LANGUE>/01-dashboard.png, 02-automation.png,
 * 03-features.png — trois PNG 1280x800 par langue.
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
import { buildPromoTile, PROMO_TILE } from "./store-assets/promo.mjs";
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
  { name: "dashboard", variant: "dashboard" },
  {
    name: "automation",
    variant: "settings",
    scrollToSelector: '[data-i18n="popup.settings.groupNotifications"]',
  },
];

/**
 * Clés i18n effectivement rendues dans le popup. Elles apparaissent en clair
 * dans les captures, donc elles tombent sous le même règlement que les textes
 * du cadre — le contrôle serait incomplet sans elles.
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

async function buildLanguage({ lang, translations, platforms, languages, listing, uiKeys }) {
  const translate = makeTranslator(translations, lang);
  const t = (key, vars) => applyTypography(translate(key, vars), lang);
  const dirName = LANG_DIRS[lang];
  const outDir = path.join(OUT_DIR, dirName);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Captures du popup réel, une par vue.
  //    Une capture manuelle déposée dans le dossier de la langue sous le nom
  //    `source-<vue>.png` remplace le rendu automatique. Utile quand on veut du
  //    vrai contenu de stream plutôt que le jeu de démonstration — à condition
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
    const html = buildPopupPage({
      lang,
      locale: LOCALES[lang],
      strings: translations[lang],
      fallback: translations.en,
      platforms,
      languages,
      variant: spec.variant,
      scrollToSelector: spec.scrollToSelector,
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
    html: buildFeaturesFrame({
      logoPath: LOGO,
      tagline,
      title: t("onboarding.welcomeTitle"),
      subtitle: applyTypography(featuresSubtitle, lang),
      features: bullets,
    }),
  });

  return outDir;
}

/**
 * Petite tuile promotionnelle : un seul visuel pour toute la fiche, pas un par
 * langue. Rédigé dans la langue principale du store (français, cf.
 * CHROMEWEBSTORE.md § 1). Seul asset qui doit être sans canal alpha.
 */
async function buildPromo({ translations, listing }) {
  const t = makeTranslator(translations, PROMO_LANG);
  const outDir = path.join(ROOT, "images", "promo");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "small_tile.png");

  // Points de chaîne, alertes live, aperçus au survol : les trois arguments les
  // plus vendeurs parmi les puces du listing, dans leur ordre d'origine.
  const bullets = listing[PROMO_LANG].bullets;
  const benefits = [bullets[0], bullets[1], bullets[3]].map((bullet) =>
    applyTypography(bullet.title, PROMO_LANG),
  );
  const tagline = resolveTagline(t("onboarding.welcomeTagline"), PROMO_LANG);

  assertPolicyClean(
    [
      { label: "tagline", text: tagline },
      ...benefits.map((text, index) => ({ label: `bénéfice ${index + 1}`, text })),
    ],
    PROMO_LANG,
  );

  await renderFrame({
    name: "promo-small",
    outPath,
    size: PROMO_TILE,
    flatten: true,
    html: buildPromoTile({ logoPath: LOGO, tagline, benefits }),
  });

  return outPath;
}

async function main() {
  assertChromeAvailable();

  const i18n = await import(path.join(ROOT, "i18n", "translations.js"));
  const platformsModule = await import(path.join(ROOT, "js", "platforms.js"));
  const listing = loadListingCopy();
  const uiKeys = popupI18nKeys();

  const platforms = platformsModule.AVAILABLE_PLATFORMS.map((definition) => ({
    id: definition.id,
    icon: definition.icon,
  }));
  const languages = i18n.AVAILABLE_LANGUAGES.map(({ code, label }) => ({ code, label }));

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
        platforms,
        languages,
        listing,
        uiKeys,
      });
      console.log(`✓ ${lang.padEnd(6)} → ${path.relative(ROOT, outDir)}`);
    }

    const promoPath = await buildPromo({ translations: i18n.translations, listing });
    console.log(`✓ promo  → ${path.relative(ROOT, promoPath)} (440x280, 24 bits)`);
  } finally {
    if (!process.env.KEEP_BUILD) {
      fs.rmSync(WORK_DIR, { recursive: true, force: true });
    } else {
      console.log(`\nIntermédiaires conservés : ${path.relative(ROOT, WORK_DIR)}`);
    }
  }

  console.log(`\n${targets.length} langue(s) · 3 captures 1280x800 chacune.`);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
