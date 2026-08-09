/**
 * Patch notes shown after an update.
 *
 * THE ONLY FILE TO EDIT WHEN YOU SHIP A RELEASE.
 *
 * Add a new entry at the TOP of RELEASES. The `version` MUST match the
 * `version` field in manifest.json — `npm run verify` fails the build if the
 * manifest version has no matching entry here, so notes can't silently drift
 * out of sync with what users actually install.
 *
 * Entry shape:
 *   version  string   Must equal manifest.json version, e.g. "26.8.8"
 *   date     string   ISO date, "YYYY-MM-DD"
 *   title    string   Short release headline (optional). Rendered as the big
 *                     serif hero, so keep it to ~6 words — the last two are
 *                     italic + violet, like the onboarding welcome screen.
 *   subtitle string   One-line summary under the hero (optional). Falls back to
 *                     a count of the changes below.
 *   changes  array    { type, text } — type is "new" | "fix" | "improved"
 *   thanks   array    Contributor credits, newest release first:
 *                       handle  string  Display name / pseudo (required)
 *                       for     string  What they helped with (optional)
 *                       url     string  Profile link, https only (optional)
 */

export const RELEASES = [
  {
    version: "26.8.8",
    date: "2026-08-09",
    title: "Un bouton, direct sur Twitch",
    subtitle:
      "Ajoutez un streamer sans ouvrir l'extension, et des confirmations de suppression enfin lisibles.",
    changes: [
      {
        type: "new",
        text: "Un bouton « Ajouter à StreamPulse » apparaît maintenant directement sur les pages de chaîne Twitch, à côté du bouton S'abonner. Violet quand le streamer n'est pas encore suivi, gris une fois ajouté.",
      },
      {
        type: "fix",
        text: "Le bouton Twitch ne s'affichait pas du tout si vous aviez 7TV installé : le garde anti-conflit remontait tout le DOM et rejetait la barre Twitch légitime.",
      },
      {
        type: "fix",
        text: "Les notifications disparaissaient silencieusement quand l'avatar du streamer ne pouvait pas être téléchargé (bloqueur de contenu, CDN indisponible). Elles utilisent désormais le logo local en secours.",
      },
      {
        type: "improved",
        text: "La confirmation de suppression d'un streamer n'était pas stylée et s'affichait avec les boutons bruts du navigateur. Nouveau design, avec le nom du streamer concerné.",
      },
      {
        type: "improved",
        text: "La confirmation ne se ferme plus toute seule au bout de 3 secondes, et la touche Entrée annule au lieu de supprimer.",
      },
    ],
    thanks: [
      { handle: "Shiro", for: "signalement des bugs de cette version" },
    ],
  },
];

/** Most recent release, or null when RELEASES is empty. */
export function getLatestRelease() {
  return RELEASES.length ? RELEASES[0] : null;
}

/** Look up a release by exact version string. */
export function getRelease(version) {
  return RELEASES.find((entry) => entry.version === version) || null;
}
