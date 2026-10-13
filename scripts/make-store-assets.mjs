#!/usr/bin/env node
/**
 * Génère les captures d'écran localisées du Chrome Web Store.
 *
 *   node scripts/make-store-assets.mjs            # les 11 langues
 *   node scripts/make-store-assets.mjs fr en      # seulement celles listées
 *   KEEP_BUILD=1 node scripts/make-store-assets.mjs fr   # garde les intermédiaires
 *
 * Sortie : images/cws_screenshots/<LANGUE>/01-dashboard, 02-drops, 03-plus,
 * 04-twitch, 05-compat : cinq PNG 1280x800 par langue (le store en accepte 5).
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
import { buildProductFrame, buildCompatibilityFrame } from "./store-assets/frames.mjs";
import { COLORS as BRAND_COLORS } from "./store-assets/brand.mjs";
import { buildPromoTile, PROMO_TILE, buildPromoMarquee, PROMO_MARQUEE } from "./store-assets/promo.mjs";
import { findBannedTerms, stripPromotionalSentences } from "./store-assets/policy.mjs";
import {
  assertChromeAvailable,
  capture,
  captureWhenReady,
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

/**
 * Capture du popup par le banc, en temps réel : on attend que les vraies
 * données du faux chrome.* soient à l'écran avant de photographier.
 */
const POPUP_READY = {
  dashboard: "document.body.innerText.includes('Pixelkat')",
  drops: "document.body.innerText.includes('Vehicle XP')",
  plus: "(() => { const v = document.querySelector('.plus-view'); return !!v && getComputedStyle(v).display !== 'none' && v.innerText.length > 80; })()",
};

async function capturePopup(name, lang, view) {
  const outPath = path.join(WORK_DIR, `popup-${lang}-${name}.png`);
  const viewParam = view ? `&view=${view}` : "";
  const options = {
    url: `${HARNESS_URL}/scripts/dev/page-harness.html?page=popup&store=1&lang=${encodeURIComponent(lang)}${viewParam}`,
    outPath,
    width: POPUP_VIEWPORT.width,
    height: POPUP_VIEWPORT.height,
    readyExpr: POPUP_READY[name] || POPUP_READY.dashboard,
  };
  // Le serveur statique du banc (http.server) coupe parfois une connexion
  // pendant le chargement en rafale des modules ES : la page reste alors
  // squelettique. On retente plutôt que de photographier un popup vide.
  const attempts = 8;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await captureWhenReady(options);
      return outPath;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`  ↻ ${name} ${lang} : tentative ${attempt} sans données, nouvel essai`);
    }
  }
}

/** Langue de la tuile promotionnelle : celle déclarée comme principale au store. */
/**
 * Le Chrome Web Store ne stocke qu'un seul jeu de tuiles promo pour toute la
 * fiche : il n'y a pas de variante par langue a televerser. On ne produit donc
 * que l'anglais, la langue par defaut de la fiche.
 */
const PROMO_LANG = "en";

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

/**
 * Vues du popup que l'on capture, par le banc (vrai popup + faux chrome.*).
 * `view` ouvre l'onglet avant la capture ; l'accueil n'en a pas.
 */
const POPUP_VIEWS = [
  { name: "dashboard", view: "" },
  { name: "drops", view: "drops" },
  { name: "plus", view: "plus" },
];

/**
 * Textes des cadres Drops et Plus. Ils décrivent ce que la capture montre et
 * rien de plus : pas de gratuité, pas de superlatif (policy.mjs). Le cadre Plus
 * dit que l'offre est un abonnement optionnel, pour que la fiche reste
 * cohérente avec l'offre payante visible dans le popup.
 */
const DROPS_TITLES = {
  fr: "Tes Drops, de la campagne à l'inventaire",
  en: "Your Drops, from campaign to inventory",
  es: "Tus Drops, de la campaña al inventario",
  "pt-BR": "Seus Drops, da campanha ao inventário",
  de: "Deine Drops, von der Kampagne bis zum Inventar",
  it: "I tuoi Drops, dalla campagna all'inventario",
  pl: "Twoje Dropy, od kampanii po ekwipunek",
  tr: "Drops'un, kampanyadan envantere",
  ru: "Твои Drops: от кампании до инвентаря",
  ja: "ドロップを、キャンペーンからインベントリまで",
  ko: "드롭을 캠페인부터 인벤토리까지",
};

const DROPS_SUBTITLES = {
  fr: "Les campagnes en cours, la progression de chaque récompense et ce qui arrive bientôt, au même endroit.",
  en: "Active campaigns, the progress of each reward and what is coming next, all in one place.",
  es: "Las campañas activas, el progreso de cada recompensa y lo que viene después, en un solo lugar.",
  "pt-BR": "As campanhas ativas, o progresso de cada recompensa e o que vem a seguir, tudo num só lugar.",
  de: "Laufende Kampagnen, der Fortschritt jeder Belohnung und was als Nächstes kommt, an einem Ort.",
  it: "Le campagne attive, i progressi di ogni ricompensa e le prossime in arrivo, in un unico posto.",
  pl: "Aktywne kampanie, postęp każdej nagrody i to, co nadchodzi, w jednym miejscu.",
  tr: "Süren kampanyalar, her ödülün ilerlemesi ve sıradaki kampanyalar tek bir yerde.",
  ru: "Текущие кампании, прогресс каждой награды и ближайшие кампании в одном месте.",
  ja: "開催中のキャンペーン、報酬ごとの進捗、これから始まるキャンペーンを一か所で確認できます。",
  ko: "진행 중인 캠페인, 보상별 진행 상황, 곧 시작될 캠페인을 한곳에서 확인합니다.",
};

const PLUS_TITLES = {
  fr: "Une formule optionnelle : StreamPulse+",
  en: "An optional plan: StreamPulse+",
  es: "Un plan opcional: StreamPulse+",
  "pt-BR": "Um plano opcional: StreamPulse+",
  de: "Ein optionales Abo: StreamPulse+",
  it: "Un piano facoltativo: StreamPulse+",
  pl: "Opcjonalny plan: StreamPulse+",
  tr: "İsteğe bağlı bir plan: StreamPulse+",
  ru: "Необязательный план: StreamPulse+",
  ja: "任意のプラン：StreamPulse+",
  ko: "선택형 플랜: StreamPulse+",
};

const PLUS_SUBTITLES = {
  fr: "Drops et badges récupérés tout seuls, alertes avancées, récap enrichi et prédictions automatiques.",
  en: "Drops and badges claimed for you, advanced alerts, an enriched recap and automatic predictions.",
  es: "Drops e insignias recogidos por ti, alertas avanzadas, resumen ampliado y predicciones automáticas.",
  "pt-BR": "Drops e emblemas resgatados por você, alertas avançados, resumo completo e previsões automáticas.",
  de: "Drops und Abzeichen werden für dich abgeholt, dazu erweiterte Hinweise, Rückblick und automatische Vorhersagen.",
  it: "Drops e badge riscattati per te, avvisi avanzati, riepilogo esteso e previsioni automatiche.",
  pl: "Dropy i odznaki odbierane za ciebie, zaawansowane powiadomienia, rozbudowane podsumowanie i automatyczne przewidywania.",
  tr: "Drops ve rozetler senin yerine alınır; gelişmiş bildirimler, zengin özet ve otomatik tahminler.",
  ru: "Drops и значки забираются за тебя, плюс расширенные уведомления, подробная сводка и автоматические прогнозы.",
  ja: "ドロップとバッジの自動受け取り、高度な通知、充実したまとめ、自動予想を利用できます。",
  ko: "드롭과 배지 자동 수령, 고급 알림, 확장된 리캡, 자동 예측을 이용할 수 있습니다.",
};

async function buildLanguage({ lang, translations, listing, uiKeys }) {
  const translate = makeTranslator(translations, lang);
  const t = (key, vars) => applyTypography(translate(key, vars), lang);
  const dirName = LANG_DIRS[lang];
  const outDir = path.join(OUT_DIR, dirName);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Captures du popup réel, une par vue. Le banc fait tourner le vrai popup
  //    avec le faux chrome.* de mock-chrome.js : la capture suit le code au
  //    lieu de figer une photo. Le mode store=1 retire le lecteur Kick en
  //    direct, pour qu'aucune chaîne réelle n'entre dans un visuel public.
  const popupShots = {};
  for (const spec of POPUP_VIEWS) {
    popupShots[spec.name] = await capturePopup(spec.name, lang, spec.view);
  }

  const tagline = resolveTagline(t("onboarding.welcomeTagline"), lang);
  const bullets = listing[lang].bullets.map((bullet) => ({
    title: applyTypography(bullet.title, lang),
    body: applyTypography(bullet.body, lang),
  }));

  const dashboardSubtitle = applyTypography(DASHBOARD_SUBTITLES[lang] || DASHBOARD_SUBTITLES.en, lang);
  const dropsTitle = applyTypography(DROPS_TITLES[lang] || DROPS_TITLES.en, lang);
  const dropsSubtitle = applyTypography(DROPS_SUBTITLES[lang] || DROPS_SUBTITLES.en, lang);
  const plusTitle = applyTypography(PLUS_TITLES[lang] || PLUS_TITLES.en, lang);
  const plusSubtitle = applyTypography(PLUS_SUBTITLES[lang] || PLUS_SUBTITLES.en, lang);
  // Puce « Bouton Ajouter à StreamPulse » : la scène Twitch montre le panneau et le bouton.
  const twitchBullet = bullets[2];

  assertPolicyClean(
    [
      { label: "tagline", text: tagline },
      { label: "titre 01", text: t("popup.greetingSub") },
      { label: "sous-titre 01", text: dashboardSubtitle },
      { label: "titre 02", text: dropsTitle },
      { label: "sous-titre 02", text: dropsSubtitle },
      { label: "titre 03", text: plusTitle },
      { label: "sous-titre 03", text: plusSubtitle },
      { label: "titre 04", text: twitchBullet.title },
      { label: "sous-titre 04", text: twitchBullet.body },
    ],
    lang,
  );

  warnPolicySoft(
    uiKeys.map((key) => ({ label: key, text: translate(key) })),
    lang,
  );

  // 2. Cadres marketing. Les titres viennent des traductions embarquées ou des
  //    tables ci-dessus, les puces de CHROMEWEBSTORE.md : rien n'est produit
  //    à la volée.
  const frames = [
    { file: "01-dashboard.png", title: t("popup.greetingSub"), subtitle: dashboardSubtitle, shot: popupShots.dashboard },
    { file: "02-drops.png", title: dropsTitle, subtitle: dropsSubtitle, shot: popupShots.drops },
    { file: "03-plus.png", title: plusTitle, subtitle: plusSubtitle, shot: popupShots.plus },
  ];
  for (const [index, frame] of frames.entries()) {
    await renderFrame({
      name: `frame-${lang}-0${index + 1}`,
      outPath: path.join(outDir, frame.file),
      flatten: true,
      html: buildProductFrame({
        logoPath: LOGO,
        tagline,
        title: frame.title,
        subtitle: frame.subtitle,
        shotPath: frame.shot,
      }),
    });
  }

  // 3. Éléments ajoutés sur Twitch : la scène n'existe qu'en français et anglais.
  const twitchShot = await captureHarness(
    `twitch-${lang}`,
    `/scripts/dev/twitch-harness.html?shot=1&lang=${lang === "fr" ? "fr" : "en"}`,
    { width: 1000, height: 820 },
  );
  await renderFrame({
    name: `frame-${lang}-04`,
    outPath: path.join(outDir, "04-twitch.png"),
    flatten: true,
    html: buildProductFrame({
      logoPath: LOGO,
      tagline,
      title: twitchBullet.title,
      subtitle: twitchBullet.body,
      shotPath: twitchShot,
    }),
  });

  // 5. Cadre « compatibilite » : la marque en pivot, les trois plateformes
  //    reliees, et sous chacune ce qu'elle sait reellement y faire.
  const compatNote = COMPAT_NOTES[lang] || COMPAT_NOTES.en;
  const headline = COMPAT_HEADLINES[lang] || COMPAT_HEADLINES.en;
  const caps = COMPAT_CAPS[lang] || COMPAT_CAPS.en;
  assertPolicyClean(
    [
      { label: "titre 05", text: headline },
      { label: "note 05", text: compatNote },
      ...Object.entries(caps).map(([key, text]) => ({ label: `capacite 05 ${key}`, text })),
    ],
    lang,
  );
  await renderFrame({
    name: `frame-${lang}-05`,
    outPath: path.join(outDir, "05-compat.png"),
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
  // Capture du vrai popup, par le banc : les tuiles montraient un cadre vide
  // depuis que source-dashboard.png, la photo manuelle, a disparu.
  const promoShot = await capturePopup("dashboard", lang, "");
  const suffix = lang === PROMO_LANG ? "" : `_${lang}`;
  const outDir = path.join(ROOT, "images", "promo");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `small_tile${suffix}.png`);

  // Accroche courte et vraies cartes live du popup : sur 440x280, une promesse
  // lisible d'un coup d'oeil vaut mieux qu'une liste de fonctions.
  const tile = {
    title: "Never miss",
    accent: "a live again.",
    subtitle: "Your Twitch, Kick and YouTube streamers live, one click away.",
    liveLabel: "Live now",
    pointsLabel: "+250 pts",
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
      shotPath: promoShot,
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
      shotPath: promoShot,
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

    const promoPaths = await buildPromo({ listing });
    for (const promoPath of promoPaths) console.log(`✓ promo  → ${path.relative(ROOT, promoPath)} (24 bits)`);
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
