// Adresse du sondage ouvert à la désinstallation : aucun identifiant, seulement la version,
// la langue et l'ancienneté de l'installation en jours (un entier).

const UNINSTALL_SURVEY_URL = "https://streampulse.tech/bye";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Jours entiers depuis l'installation, ou null si la date est absente ou incohérente. */
export function installAgeDays(installedAt, now = Date.now()) {
  if (!Number.isFinite(installedAt) || installedAt <= 0 || installedAt > now) return null;
  return Math.floor((now - installedAt) / DAY_MS);
}

export function uninstallSurveyUrl(version, uiLanguage, installedAt, now = Date.now()) {
  const lang = String(uiLanguage || "en").slice(0, 2).toLowerCase();
  const params = new URLSearchParams({ v: version, lang });
  const days = installAgeDays(installedAt, now);
  if (days !== null) params.set("d", String(days));
  return `${UNINSTALL_SURVEY_URL}?${params}`;
}
