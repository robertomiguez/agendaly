import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import pt from '../locales/pt.json'

function getBrowserLocale(): string {
  const navigatorLocale = navigator.language || 'en'
  const locale = navigatorLocale.split('-')[0] || 'en'
  if (['en', 'pt'].includes(locale)) {
    return locale
  }
  return 'en'
}

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  globalInjection: true,
  locale: localStorage.getItem('language') || getBrowserLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    pt
  }
})

export default i18n
