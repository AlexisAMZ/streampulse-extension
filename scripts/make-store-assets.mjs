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
import { buildProductFrame, buildFeaturesFrame, buildCompatibilityFrame } from "./store-assets/frames.mjs";
import { COLORS as BRAND_COLORS } from "./store-assets/brand.mjs";
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
const TWITCH_ICON = path.join(ROOT, "images", "platforms", "twitch.svg");
const KICK_ICON = path.join(ROOT, "images", "platforms", "kick.svg");
const YOUTUBE_ICON = path.join(ROOT, "images", "platforms", "youtube.svg");
// Logos officiels fournis (BetterTTV, FrankerFaceZ, 7TV) : StreamPulse cohabite
// avec ces extensions d'émotes, il ne les remplace pas.
const EMOTE_ICONS = ["betterttv", "ffz", "7tv"].map((name) =>
  path.join(ROOT, "images", "platforms", `${name}.png`),
);
const EMOTE_NAMES = ["BetterTTV", "FrankerFaceZ", "7TV"];

/**
 * Mention « totalement compatible » au-dessus des pastilles : noms propres et
 * vocabulaire factuel, traduits langue par langue (aucun terme interdit par
 * policy.mjs : ni gratuité, ni nouveauté, ni superlatif).
 */
const COMPAT_NOTES = {
  fr: "StreamPulse est totalement compatible avec",
  en: "StreamPulse is fully compatible with",
  es: "StreamPulse es totalmente compatible con",
  "pt-BR": "O StreamPulse é totalmente compatível com",
  de: "StreamPulse ist voll kompatibel mit",
  it: "StreamPulse è totalmente compatibile con",
  pl: "StreamPulse jest w pełni kompatybilny z",
  tr: "StreamPulse tam uyumlu çalışır",
  ru: "StreamPulse полностью совместим с",
  ja: "StreamPulseは以下と完全な互換性があります",
  ko: "StreamPulse은 다음과 완전히 호환됩니다",
};

/**
 * Titre du cadre 06. Il remplace l'ancienne enfilade « Twitch & Kick &
 * YouTube » : les noms des plateformes sont déjà portés par les trois tuiles
 * juste dessous, et les couleurs de marque n'ont pas leur place en display
 * (cf. DESIGN.md, « Twitch et Kick ne sont pas la marque »).
 */
/**
 * Sous-titre de la capture 01. Il portait jusqu'ici
 * `popup.settings.liveNotificationsDescription`, c'est-a-dire la description
 * d'un reglage de notification : sous le titre « Voici qui est en ligne », la
 * phrase ne voulait rien dire. Texte dedie, qui decrit ce que la capture
 * montre vraiment.
 */
const DASHBOARD_SUBTITLES = {
  fr: "Tes streamers Twitch, Kick et YouTube en direct d'abord, avec spectateurs, catégorie et durée.",
  en: "Your live Twitch, Kick and YouTube streamers first, with viewers, category and uptime.",
  es: "Tus streamers de Twitch, Kick y YouTube en directo primero, con espectadores, categoría y duración.",
  "pt-BR": "Seus streamers da Twitch, Kick e YouTube ao vivo primeiro, com espectadores, categoria e tempo no ar.",
  de: "Deine Twitch-, Kick- und YouTube-Streamer zuerst live, mit Zuschauerzahl, Kategorie und Laufzeit.",
  it: "I tuoi streamer Twitch, Kick e YouTube in diretta per primi, con spettatori, categoria e durata.",
  pl: "Twoi streamerzy z Twitcha, Kicka i YouTube na żywo najpierw, z liczbą widzów, kategorią i czasem transmisji.",
  tr: "Twitch, Kick ve YouTube yayıncıların önce canlı olarak, izleyici sayısı, kategori ve yayın süresiyle.",
  ru: "Твои стримеры Twitch, Kick и YouTube сначала в эфире, со зрителями, категорией и временем трансляции.",
  ja: "Twitch・Kick・YouTube の配信中のストリーマーを先頭に、視聴者数・カテゴリ・配信時間つきで表示します。",
  ko: "Twitch, Kick, YouTube에서 방송 중인 스트리머를 먼저, 시청자 수와 카테고리, 방송 시간과 함께 보여줍니다.",
};

const COMPAT_HEADLINES = {
  fr: "Une fenêtre pour tes trois plateformes",
  en: "One window for your three platforms",
  es: "Una ventana para tus tres plataformas",
  "pt-BR": "Uma janela para suas três plataformas",
  de: "Ein Fenster für deine drei Plattformen",
  it: "Una finestra per le tue tre piattaforme",
  pl: "Jedno okno dla twoich trzech platform",
  tr: "Üç platformun için tek pencere",
  ru: "Одно окно для трёх платформ",
  ja: "3つのプラットフォームを1つのウィンドウに",
  ko: "세 플랫폼을 하나의 창에서",
};

/**
 * Ce que StreamPulse sait faire sur chaque plateforme. YouTube se limite aux
 * alertes et au temps de visionnage (pas de points de chaîne, pas de Drops,
 * pas de lecteur injecté) : la capture le dit au lieu de le taire, sinon la
 * fiche promet à un acheteur YouTube des fonctions qu'il n'aura pas.
 */
const COMPAT_CAPS = {
  fr: { alerts: "Alertes de live", watch: "Temps de visionnage", points: "Points de chaîne", drops: "Drops" },
  en: { alerts: "Live alerts", watch: "Watch time", points: "Channel points", drops: "Drops" },
  es: { alerts: "Alertas de directo", watch: "Tiempo de visionado", points: "Puntos de canal", drops: "Drops" },
  "pt-BR": { alerts: "Alertas de live", watch: "Tempo assistido", points: "Pontos de canal", drops: "Drops" },
  de: { alerts: "Live-Hinweise", watch: "Sehdauer", points: "Kanalpunkte", drops: "Drops" },
  it: { alerts: "Avvisi di diretta", watch: "Tempo di visione", points: "Punti canale", drops: "Drops" },
  pl: { alerts: "Powiadomienia o live", watch: "Czas oglądania", points: "Punkty kanału", drops: "Drops" },
  tr: { alerts: "Canlı bildirimleri", watch: "İzleme süresi", points: "Kanal puanları", drops: "Drops" },
  ru: { alerts: "Уведомления об эфире", watch: "Время просмотра", points: "Баллы канала", drops: "Drops" },
  ja: { alerts: "ライブ通知", watch: "視聴時間", points: "チャンネルポイント", drops: "ドロップ" },
  ko: { alerts: "라이브 알림", watch: "시청 시간", points: "채널 포인트", drops: "드롭" },
};

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
      { label: "sous-titre 01", text: DASHBOARD_SUBTITLES[lang] || DASHBOARD_SUBTITLES.en },
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
      subtitle: applyTypography(DASHBOARD_SUBTITLES[lang] || DASHBOARD_SUBTITLES.en, lang),
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
    // 520 coupait en plein milieu du panneau « Recap avance » : mesure a 1280 de
    // large, l'apercu se termine a 621 et la coque a 677. On cadre a 640, dans
    // la marge basse, pour ne trancher aucun element.
    { width: 1280, height: 640 },
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

  // 6. Cadre « compatibilite » : la marque en pivot, les trois plateformes
  //    reliees, et sous chacune ce qu'elle sait reellement y faire.
  const compatNote = COMPAT_NOTES[lang] || COMPAT_NOTES.en;
  const headline = COMPAT_HEADLINES[lang] || COMPAT_HEADLINES.en;
  const caps = COMPAT_CAPS[lang] || COMPAT_CAPS.en;
  assertPolicyClean(
    [
      { label: "titre 06", text: headline },
      { label: "note 06", text: compatNote },
      ...Object.entries(caps).map(([key, text]) => ({ label: `capacite 06 ${key}`, text })),
    ],
    lang,
  );
  await renderFrame({
    name: `frame-${lang}-06`,
    outPath: path.join(outDir, "06-compat.png"),
    flatten: true,
    html: buildCompatibilityFrame({
      logoPath: LOGO,
      headline,
      // L'ordre des capacites va du partage au specifique : les deux premieres
      // lignes sont identiques partout, ce qui rend lisible d'un coup d'oeil
      // ce que YouTube n'a pas.
      platforms: [
        {
          name: "Twitch",
          icon: TWITCH_ICON,
          color: BRAND_COLORS.violet,
          caps: [caps.alerts, caps.watch, caps.points, caps.drops],
        },
        {
          name: "Kick",
          icon: KICK_ICON,
          color: BRAND_COLORS.kick,
          caps: [caps.alerts, caps.watch, caps.points],
        },
        {
          name: "YouTube",
          icon: YOUTUBE_ICON,
          color: BRAND_COLORS.youtube,
          caps: [caps.alerts, caps.watch],
        },
      ],
      emoteIcons: EMOTE_ICONS,
      emoteNames: EMOTE_NAMES,
      compatNote,
    }),
  });

  return outDir;
}

/**
 * Petite tuile promotionnelle : un seul visuel pour toute la fiche, pas un par
 * langue. Rédigé dans la langue principale du store (français, cf.
 * CHROMEWEBSTORE.md § 1). Seul asset qui doit être sans canal alpha.
 */
async function buildPromo({ listing, lang = PROMO_LANG }) {
  const suffix = lang === PROMO_LANG ? "" : `_${lang}`;
  const outDir = path.join(ROOT, "images", "promo");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `small_tile${suffix}.png`);

  // Accroche courte et vraies cartes live du popup : sur 440x280, une promesse
  // lisible d'un coup d'oeil vaut mieux qu'une liste de fonctions.
  const fr = lang === "fr";
  const tile = {
    title: fr ? "Ne rate plus" : "Never miss",
    accent: fr ? "aucun live." : "a live again.",
    subtitle: fr ? "Tes streamers Twitch, Kick et YouTube en direct, en un clic." : "Your Twitch, Kick and YouTube streamers live, one click away.",
    liveLabel: fr ? "En direct" : "Live now",
    pointsLabel: fr ? "+250 pts" : "+250 pts",
  };
  assertPolicyClean(
    Object.entries(tile).map(([label, text]) => ({ label: `tuile ${label}`, text })),
    lang,
  );

  await renderFrame({
    name: `promo-small${suffix}`,
    outPath,
    size: PROMO_TILE,
    flatten: true,
    html: buildPromoTile({
      logoPath: LOGO,
      ...tile,
      shotPath: path.join(OUT_DIR, LANG_DIRS[lang], "source-dashboard.png"),
    }),
  });

  // Points de chaîne, alertes live, aperçus au survol : les trois arguments de
  // la grande image, dans l'ordre des puces du listing.
  const bullets = listing[lang].bullets;
  const benefits = [bullets[0], bullets[1], bullets[3]].map((bullet) =>
    applyTypography(bullet.title, lang),
  );

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
      const promoPaths = await buildPromo({ listing, lang });
      for (const promoPath of promoPaths) console.log(`✓ promo  → ${path.relative(ROOT, promoPath)} (24 bits)`);
    }
  } finally {
    if (!process.env.KEEP_BUILD) {
      fs.rmSync(WORK_DIR, { recursive: true, force: true });
    } else {
      console.log(`\nIntermédiaires conservés : ${path.relative(ROOT, WORK_DIR)}`);
    }
  }

  console.log(`\n${targets.length} langue(s) · 6 captures 1280x800 chacune.`);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
