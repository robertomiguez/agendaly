import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import pt from '../locales/pt.json'

export function normalizeLocale(locale?: string | null): 'en' | 'pt' {
  const language = (locale || 'en').replace('_', '-').split('-')[0] || 'en'
  if (language === 'pt') return 'pt'
  return 'en'
}

function getBrowserLocale(): string {
  return normalizeLocale(navigator.language)
}

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  globalInjection: true,
  locale: normalizeLocale(localStorage.getItem('language') || getBrowserLocale()),
  fallbackLocale: 'en',
  messages: {
    en,
    pt
  }
})

export default i18n
