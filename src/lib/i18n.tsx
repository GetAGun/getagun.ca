import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const STRINGS = {
  en: {
    nav_map: 'Map',
    nav_licence: 'Get your licence',
    nav_faq: 'FAQ',
    faq_title: 'Frequently asked questions',
    faq_empty: 'No questions yet — check back soon.',
    nav_suggest: 'Suggestions',
    nav_sheet: 'Spreadsheet of Retailers',
    tagline: 'Verified Canadian firearms retailers',
    search_placeholder: 'Search retailers, or enter your address…',
    use_my_location: 'Use my location',
    locating: 'Locating…',
    geoloc_error: 'Could not get your location. Check browser permissions.',
    geocode_none: 'No matching address found.',
    geocode_error: 'Address lookup failed. Try again.',
    nearest_title: 'Nearest retailers',
    filters_title: 'Categories',
    cluster_toggle: 'Group nearby pins',
    stores_in_view: 'stores in view',
    theme_title: 'Basemap',
    theme_light: 'Light',
    theme_dark: 'Dark',
    theme_white: 'White',
    theme_black: 'Black',
    theme_grayscale: 'Grayscale',
    theme_nolabels: '(no labels)',
    load_error: 'Could not load retailers. Refresh to try again.',
    visit_website: 'Website',
    clear: 'Clear',
    close: 'Close',
    suggest_title: 'Suggestions',
    suggest_intro:
      'Know a firearms retailer that belongs on the map, spotted a listing that needs correcting, or have feedback about the site? Send it here. Everything is personally verified before anything changes on the map.',
    wip_notice: 'Work in progress — suggestions welcome!',
    s_kind: 'What are you submitting?',
    s_kind_new: 'A new retailer',
    s_kind_update: 'An update to a listed retailer',
    s_kind_feedback: 'General feedback about the site',
    s_name_update: 'Which retailer? (required)',
    s_note_required: 'Details (required)',
    s_name: 'Retailer name (required)',
    s_address: 'Street address',
    s_city: 'City',
    s_province: 'Province',
    s_website: 'Website',
    s_note: 'Anything else worth knowing',
    s_submit: 'Submit suggestion',
    s_sending: 'Submitting…',
    s_thanks: 'Thanks — your suggestion is in the review queue.',
    s_error: 'Submission failed. Please try again.',
    s_verifying: 'Human verification is loading…',
    s_verify_failed: 'Verification failed to load. Disable content blockers and refresh the page.',
    footer_privacy:
      'No analytics, no tracking. Location and address searches never reach this server — matching happens entirely in your browser. Typed addresses are geocoded by the community-run Photon service; "use my location" never leaves your device.',
  },
  fr: {
    nav_map: 'Carte',
    nav_licence: 'Obtenir son permis',
    nav_faq: 'FAQ',
    faq_title: 'Foire aux questions',
    faq_empty: 'Aucune question pour le moment — revenez bientôt.',
    nav_suggest: 'Suggestions',
    nav_sheet: 'Tableur des détaillants',
    tagline: "Détaillants d'armes à feu canadiens vérifiés",
    search_placeholder: 'Cherchez un détaillant ou entrez votre adresse…',
    use_my_location: 'Utiliser ma position',
    locating: 'Localisation…',
    geoloc_error: "Impossible d'obtenir votre position. Vérifiez les autorisations du navigateur.",
    geocode_none: 'Aucune adresse correspondante trouvée.',
    geocode_error: "La recherche d'adresse a échoué. Réessayez.",
    nearest_title: 'Détaillants les plus proches',
    filters_title: 'Catégories',
    cluster_toggle: 'Regrouper les points rapprochés',
    stores_in_view: 'magasins visibles',
    theme_title: 'Fond de carte',
    theme_light: 'Clair',
    theme_dark: 'Sombre',
    theme_white: 'Blanc',
    theme_black: 'Noir',
    theme_grayscale: 'Niveaux de gris',
    theme_nolabels: '(sans étiquettes)',
    load_error: 'Impossible de charger les détaillants. Actualisez pour réessayer.',
    visit_website: 'Site web',
    clear: 'Effacer',
    close: 'Fermer',
    suggest_title: 'Suggestions',
    suggest_intro:
      "Vous connaissez un détaillant d'armes à feu qui devrait figurer sur la carte, vous avez repéré une fiche à corriger, ou vous avez des commentaires sur le site? Envoyez-les ici. Tout est vérifié personnellement avant publication.",
    wip_notice: 'Site en développement — vos suggestions sont bienvenues!',
    s_kind: 'Que soumettez-vous?',
    s_kind_new: 'Un nouveau détaillant',
    s_kind_update: "Une mise à jour d'un détaillant répertorié",
    s_kind_feedback: 'Des commentaires généraux sur le site',
    s_name_update: 'Quel détaillant? (requis)',
    s_note_required: 'Détails (requis)',
    s_name: 'Nom du détaillant (requis)',
    s_address: 'Adresse',
    s_city: 'Ville',
    s_province: 'Province',
    s_website: 'Site web',
    s_note: 'Autre chose à savoir',
    s_submit: 'Soumettre la proposition',
    s_sending: 'Envoi…',
    s_thanks: 'Merci — votre proposition est dans la file de révision.',
    s_error: "L'envoi a échoué. Veuillez réessayer.",
    s_verifying: 'La vérification humaine se charge…',
    s_verify_failed: 'La vérification n\'a pas pu se charger. Désactivez les bloqueurs de contenu et actualisez la page.',
    footer_privacy:
      "Aucune analyse, aucun suivi. Les recherches de position et d'adresse n'atteignent jamais ce serveur — le tri se fait entièrement dans votre navigateur. Les adresses saisies sont géocodées par le service communautaire Photon; « utiliser ma position » ne quitte jamais votre appareil.",
  },
} as const;

export type Lang = 'en' | 'fr';
export type StringKey = keyof typeof STRINGS.en;

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'en',
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() =>
    localStorage.getItem('lang') === 'fr' ? 'fr' : 'en',
  );
  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

export function useT() {
  const { lang } = useLang();
  return (key: StringKey) => STRINGS[lang][key];
}
