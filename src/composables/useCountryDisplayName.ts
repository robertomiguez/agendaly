import { computed, type Ref, unref } from 'vue'

type LocaleRef = string | Ref<string>

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/

export function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase()
}

export function useCountryDisplayName(locale: LocaleRef) {
  const displayNames = computed(() => {
    try {
      return new Intl.DisplayNames([unref(locale) || 'en'], { type: 'region' })
    } catch {
      return null
    }
  })

  function getCountryName(countryCode: string): string | null {
    const normalizedCode = normalizeCountryCode(countryCode)
    if (!COUNTRY_CODE_PATTERN.test(normalizedCode) || normalizedCode === 'ZZ') return null

    try {
      const countryName = displayNames.value?.of(normalizedCode)
      if (!countryName || countryName === normalizedCode) return null
      return countryName
    } catch {
      return null
    }
  }

  return {
    getCountryName,
    normalizeCountryCode
  }
}
