/**
 * Jeu de démonstration affiché dans les captures.
 *
 * Volontairement fictif : pas de vrais pseudos, pas de vraies vignettes de
 * stream. Une fiche Chrome Web Store est du matériel public — y afficher le
 * visage d'un streamer réel ou une capture de jeu sous licence expose à une
 * réclamation droit à l'image / copyright.
 *
 * Les avatars et vignettes sont des SVG générés en data URI, donc aucun
 * fichier binaire supplémentaire à versionner.
 */

/**
 * Vignette abstraite 480x270 : halos diffus, traînées lumineuses, grille fine
 * et vignettage. Assez travaillée pour ne pas lire comme un aplat vide, assez
 * abstraite pour qu'on ne la confonde pas avec une vraie capture de stream.
 */
function thumbnail({ from, to, accent, secondary }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur stdDeviation="20"/>
</filter>
<filter id="haze" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur stdDeviation="7"/>
</filter>
<linearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.20"/>
<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient>
<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
<path d="M20 0H0v20" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/>
</pattern>
<radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
<stop offset="0.5" stop-color="#000000" stop-opacity="0"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
</radialGradient>
</defs>
<rect width="480" height="270" fill="url(#bg)"/>
<g filter="url(#soft)">
<ellipse cx="150" cy="118" rx="132" ry="96" fill="${accent}" fill-opacity="0.55"/>
<ellipse cx="368" cy="206" rx="126" ry="92" fill="${secondary}" fill-opacity="0.48"/>
<circle cx="408" cy="46" r="52" fill="#ffffff" fill-opacity="0.13"/>
</g>
<g filter="url(#haze)" opacity="0.9">
<path d="M-30 214 C 90 150, 150 196, 260 128 S 430 66, 520 96"
 fill="none" stroke="${accent}" stroke-opacity="0.72" stroke-width="7"/>
<path d="M-30 250 C 96 190, 168 232, 286 168 S 442 112, 520 140"
 fill="none" stroke="#ffffff" stroke-opacity="0.30" stroke-width="3"/>
</g>
<g opacity="0.6">
<path d="M-60 268 L188 -24" stroke="url(#streak)" stroke-width="34" fill="none"/>
<path d="M96 302 L352 -30" stroke="url(#streak)" stroke-width="16" fill="none"/>
</g>
<circle cx="150" cy="112" r="2.5" fill="#ffffff" fill-opacity="0.85"/>
<circle cx="286" cy="166" r="1.8" fill="#ffffff" fill-opacity="0.6"/>
<circle cx="404" cy="94" r="2.2" fill="#ffffff" fill-opacity="0.7"/>
<rect width="480" height="270" fill="url(#grid)"/>
<rect width="480" height="270" fill="url(#vig)"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Avatar rond monogramme : lettre blanche sur aplat de la couleur plateforme. */
function avatar({ letter, from, to }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient></defs>
<rect width="120" height="120" rx="60" fill="url(#a)"/>
<text x="60" y="60" text-anchor="middle" dominant-baseline="central"
 font-family="Inter, Helvetica, Arial, sans-serif" font-size="52" font-weight="700"
 fill="#ffffff" fill-opacity="0.92">${letter}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const TWITCH = {
  from: "#241238",
  to: "#0d0b14",
  accent: "#9146FF",
  secondary: "#4f2bd6",
};
const KICK = {
  from: "#0f2a0b",
  to: "#0b0f0c",
  accent: "#53FC18",
  secondary: "#0f8f4a",
};

/**
 * Les `category` sont des noms de catégories Twitch génériques, pas des titres
 * de stream : rien à traduire, rien d'inventé sur le contenu d'un tiers.
 */
export const DEMO_STREAMERS = [
  {
    handle: "novastream",
    platform: "twitch",
    isLive: true,
    category: "Just Chatting",
    avatar: avatar({ letter: "N", from: "#9146FF", to: "#5b2ea6" }),
    thumbnail: thumbnail(TWITCH),
  },
  {
    handle: "pixelkat",
    platform: "kick",
    isLive: true,
    category: "Grand Theft Auto V",
    avatar: avatar({ letter: "P", from: "#53FC18", to: "#2b8c10" }),
    thumbnail: thumbnail(KICK),
  },
  {
    handle: "lunaplays",
    platform: "twitch",
    isLive: false,
    avatar: avatar({ letter: "L", from: "#7b5cff", to: "#3f2a80" }),
  },
  {
    handle: "rivertv",
    platform: "kick",
    isLive: false,
    avatar: avatar({ letter: "R", from: "#38c40f", to: "#1d6b08" }),
  },
];

/** Pseudo affiché dans le message d'accueil : celui du développeur, assumé. */
export const DEMO_PROFILE = { displayName: "AlexisAMZ" };

export const DEMO_STATS = {
  points: 12480,
  watchTimeHours: 9,
  watchTimeMinutes: 28,
  liveCount: 2,
};
