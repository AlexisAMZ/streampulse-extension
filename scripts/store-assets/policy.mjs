/**
 * Garde-fou « Impersonation and Intellectual Property » du Chrome Web Store.
 *
 * Le règlement interdit, dans les assets d'une extension, tout badge ou texte
 * qui imite un classement, des performances, un état ou une info promotionnelle :
 * « recommandé », « premium », « gratuit », « n° 1 », « nouveau »…
 * https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property/
 *
 * StreamPulse a été rejeté le 2026-08-13 pour « 100% Free and Free forever »
 * sur une capture. Le contrôle ci-dessous bloque la génération plutôt que de
 * laisser repartir un asset fautif vers la validation.
 */

/**
 * Familles interdites par langue : gratuité, nouveauté, superlatif, classement,
 * offre premium.
 *
 * Un terme suffixé de `*` est une racine : il accepte n'importe quelle
 * terminaison (« gratuit* » couvre gratuite, gratuits, gratuitement). Sans `*`,
 * le mot doit être entier.
 *
 * Les deux bords sont contraints, sinon on récolte des faux positifs : « yeni »
 * (nouveau) dans « Yenile » (actualiser), « baru » dans « Pembaruan » (mise à
 * jour), « beste » dans « Bestelling » (commande), « #1 » dans « #1000 »
 * (code d'erreur Twitch).
 */
const BANNED = {
  fr: ["gratuit*", "gratos", "offert*", "nouveau*", "nouvelle*", "nouveauté*", "meilleur*", "n°1", "n° 1", "numéro 1", "premium", "recommandé*"],
  en: ["free", "best", "#1", "no. 1", "number one", "premium", "recommended", "top rated", "new"],
  es: ["gratis", "gratuit*", "nuevo*", "nueva*", "novedad*", "mejor", "mejores", "n.º 1", "premium", "recomendado*"],
  "pt-BR": ["grátis", "gratuit*", "novo*", "nova*", "novidade*", "melhor", "melhores", "nº 1", "premium", "recomendado*"],
  de: ["kostenlos", "gratis", "umsonst", "neu", "neue*", "neuheit*", "beste*", "nr. 1", "premium", "empfohlen"],
  it: ["gratis", "gratuit*", "nuovo*", "nuova*", "novità", "migliore*", "n. 1", "premium", "consigliato*"],
  pl: ["darmow*", "bezpłatn*", "za darmo", "nowy", "nowe", "nowość*", "najlepsz*", "nr 1", "premium", "polecan*"],
  tr: ["ücretsiz", "bedava", "yeni", "yenilik*", "en iyi", "1 numara", "premium", "önerilen"],
  ru: ["бесплатн*", "даром", "новый", "новая", "новинк*", "лучш*", "№ 1", "премиум", "рекомендуем*"],
  ja: ["無料", "新機能", "新登場", "最高", "ナンバーワン", "プレミアム", "おすすめ"],
  ko: ["무료", "신규", "새로운", "최고", "1위", "프리미엄", "추천"],
  id: ["gratis", "cuma-cuma", "baru", "terbaik", "nomor 1", "premium", "direkomendasikan"],
  nl: ["gratis", "kosteloos", "nieuw", "nieuwe", "beste", "nr. 1", "premium", "aanbevolen"],
  sv: ["gratis", "kostnadsfri*", "utan kostnad", "ny", "nytt", "bäst*", "nr 1", "premium", "rekommenderad*"],
  cs: ["zdarma", "bezplatn*", "nový", "nové", "novink*", "nejlep*", "č. 1", "prémi*", "doporučen*"],
};

/** Scripts sans séparateur de mots : les limites de mot n'y ont pas de sens. */
const SCRIPTS_SANS_ESPACES = /[぀-ヿ㐀-䶿一-鿿가-힯]/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Construit le motif d'un terme, avec limites de mot pour les écritures alphabétiques. */
function toPattern(term) {
  if (SCRIPTS_SANS_ESPACES.test(term)) {
    return new RegExp(escapeRegex(term), "iu");
  }
  const isStem = term.endsWith("*");
  const core = escapeRegex(isStem ? term.slice(0, -1) : term);
  const tail = isStem ? "\\p{L}*" : "";
  return new RegExp(`(?<![\\p{L}\\p{N}])${core}${tail}(?![\\p{L}\\p{N}])`, "iu");
}

const PATTERNS = Object.fromEntries(
  Object.entries(BANNED).map(([lang, terms]) => [
    lang,
    terms.map((term) => ({ term, pattern: toPattern(term) })),
  ]),
);

/**
 * Cherche les termes interdits dans un lot de textes.
 *
 * @param {{label: string, text: string}[]} entries textes réellement imprimés
 * @param {string} lang
 * @returns {{label: string, term: string, text: string}[]}
 */
export function findBannedTerms(entries, lang) {
  const patterns = PATTERNS[lang] || [];
  const hits = [];
  for (const { label, text } of entries) {
    if (!text) continue;
    for (const { term, pattern } of patterns) {
      if (pattern.test(String(text))) hits.push({ label, term, text });
    }
  }
  return hits;
}

/**
 * Retire d'une description les phrases porteuses d'un terme interdit.
 *
 * Les descriptions courtes du listing finissent toutes par une accroche du type
 * « Dispo en 15 langues ! Gratuit. » : on coupe cette phrase et on garde
 * l'énumération de fonctionnalités, qui elle est factuelle.
 */
export function stripPromotionalSentences(text, lang) {
  if (!text) return text;

  // Découpage sur la ponctuation de fin de phrase, séparateurs conservés.
  const pieces = String(text).split(/(?<=[.!?。！？])\s*/);
  const kept = pieces.filter(
    (piece) => findBannedTerms([{ label: "phrase", text: piece }], lang).length === 0,
  );

  return kept.join(" ").trim();
}
