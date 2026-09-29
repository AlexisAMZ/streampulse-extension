/**
 * Agrégateur : toutes les langues d'un coup.
 *
 * Réservé au service worker (un service worker MV3 ne peut pas faire d'import()
 * dynamique) et aux outils (verify, tests, génération de js/inject/i18n-inline.js).
 * Les pages de l'extension ne l'importent PAS : js/i18n.js charge seulement la
 * langue choisie, et l'anglais en repli.
 *
 * Les chaînes s'éditent dans i18n/lang/<code>.js. Ajouter une langue : créer son
 * fichier, l'importer ici et la déclarer dans ALL_LANGUAGES (i18n/meta.js).
 */
import fr from "./lang/fr.js";
import en from "./lang/en.js";
import es from "./lang/es.js";
import ptBR from "./lang/pt-BR.js";
import de from "./lang/de.js";
import it from "./lang/it.js";
import pl from "./lang/pl.js";
import tr from "./lang/tr.js";
import ru from "./lang/ru.js";
import ja from "./lang/ja.js";
import ko from "./lang/ko.js";

export {
  ALL_LANGUAGES,
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  formatTemplate,
  matchLanguage,
  resolveLocale,
} from "./meta.js";

export const translations = {
  fr,
  en,
  es,
  "pt-BR": ptBR,
  de,
  it,
  pl,
  tr,
  ru,
  ja,
  ko,
};
