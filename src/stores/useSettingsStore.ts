import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../lib/i18n'
import { fetchGeoInfo, getLanguageFromGeo, getCurrencyFromGeo, getCountryCodeFromLocale, saveCountryCode } from '../services/geo'

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

    // We need to determine if we need to fetch geo.
    const needsGeo = !finalCurr || !finalLang

    let geoData: import('../services/geo').GeoInfo | null = null
    if (needsGeo) {
      geoData = await fetchGeoInfo()
    }

    // Resolve Currency
    if (!finalCurr) {
      if (geoData) {
        finalCurr = getCurrencyFromGeo(geoData.country_code, geoData.currency)
      } else {
        finalCurr = 'USD' // Fallback
      }
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
      // 3. Country detection (IP)
      else if (geoData) {
        finalLang = normalizeSupportedLanguage(getLanguageFromGeo(geoData.country_code))
      }
      // 4. Fallback
      else {
        finalLang = 'en'
      }
      setLanguage(finalLang)
    } else {
      // Ensure i18n is set if it was loaded from storage
      setLanguage(finalLang)
    }
  }

  function formatPrice(value: number) {
    if (!value && value !== 0) return ''
    if (value === 0) return 'Free' // Or localized 'Free' if we want detailed i18n

    const locale = language.value || navigator.language || 'en-US'
    const curr = currency.value || 'USD'

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
