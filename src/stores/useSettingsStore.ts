import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../lib/i18n'
import { getCountryCodeFromLocale, getCurrencyFromBrowserLocale, saveCountryCode } from '../services/geo'

function normalizeSupportedLanguage(locale?: string | null): 'en' | 'pt' {
  const language = (locale || 'en').replace('_', '-').split('-')[0] || 'en'
  if (language === 'pt') return 'pt'
  return 'en'
}

export const useSettingsStore = defineStore('settings', () => {
  const language = ref<string>(localStorage.getItem('language') || '')
  const currency = ref<string>(localStorage.getItem('currency') || '')

  function setLanguage(lang: string) {
    const normalizedLang = normalizeSupportedLanguage(lang)
    language.value = normalizedLang
    localStorage.setItem('language', normalizedLang)
    const countryCode = getCountryCodeFromLocale(normalizedLang)
    if (countryCode) saveCountryCode(countryCode)
    if (i18n.global) {
      // @ts-ignore
      i18n.global.locale.value = normalizedLang
    }
  }

  function setCurrency(curr: string) {
    currency.value = curr
    localStorage.setItem('currency', curr)
  }

  async function init() {
    // 1. Saved User Preference (handled by ref init)
    const savedLang = language.value || localStorage.getItem('language') || ''
    let finalLang: string = savedLang ? normalizeSupportedLanguage(savedLang) : ''
    let finalCurr = currency.value

    // Resolve Currency
    if (!finalCurr) {
      // IP-based currency detection disabled for now.
      // Previously this called fetchGeoInfo() -> https://ipapi.co/json/.
      finalCurr = getCurrencyFromBrowserLocale(navigator.language)
      setCurrency(finalCurr)
    }

    // Resolve Language
    if (!finalLang) {
      // 2. Browser Language
      const browserLang = navigator.language.split('-')[0] || ''
      const supportedLangs = ['en', 'pt']

      if (supportedLangs.includes(browserLang)) {
        finalLang = normalizeSupportedLanguage(browserLang)
      }
      else {
        // IP country language fallback disabled for now.
        // Previously Portuguese countries became pt and other countries became en.
        finalLang = 'en'
      }
      setLanguage(finalLang)
    } else {
      // Ensure i18n is set if it was loaded from storage
      setLanguage(finalLang)
    }
  }

  function formatPrice(value: number, currencyCode?: string, options: { zeroAsFree?: boolean } = {}) {
    if (!value && value !== 0) return ''
    if (value === 0 && options.zeroAsFree !== false) return 'Free' // Or localized 'Free' if we want detailed i18n

    const locale = language.value || navigator.language || 'en-US'
    const curr = currencyCode || currency.value || 'USD'

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: curr,
      }).format(value)
    } catch (e) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
      }).format(value)
    }
  }

  return {
    language,
    currency,
    setLanguage,
    setCurrency,
    initializeSettings: init,
    formatPrice
  }
})
