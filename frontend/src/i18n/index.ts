import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr';
import en from './locales/en';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const STORAGE_KEY = 'pekegno_lang';

export function detectInitialLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export function applyLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  i18n.changeLanguage(lang);
}

export function currentLocale(): string {
  return i18n.resolvedLanguage === 'en' ? 'en-US' : 'fr-FR';
}

export function currentCurrency(): string {
  return i18n.resolvedLanguage === 'en' ? 'XAF' : 'FCFA';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

document.documentElement.lang = i18n.resolvedLanguage ?? 'fr';

export default i18n;
