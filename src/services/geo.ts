
export interface GeoInfo {
    country_code: string
    region_code: string
    currency: string
}

const COUNTRY_CODE_STORAGE_KEY = 'country_code'

export const fetchGeoInfo = async (): Promise<GeoInfo | null> => {
    try {
        const response = await fetch('https://ipapi.co/json/')
        if (!response.ok) {
            throw new Error('Failed to fetch geo info')
        }
        const data = await response.json()
        return {
            country_code: data.country_code,
            region_code: data.region_code,
            currency: data.currency
        }
    } catch (error) {
        console.error('Error fetching geo info:', error)
        return null
    }
}

export const getCountryCodeFromLocale = (locale?: string | null): string | null => {
    if (!locale) return null

    const [, region] = locale.replace('_', '-').split('-')
    if (region && /^[a-z]{2}$/i.test(region)) return region.toUpperCase()

    return null
}

export const getSavedCountryCode = (): string | null => {
    try {
        const countryCode = localStorage.getItem(COUNTRY_CODE_STORAGE_KEY)
        return countryCode && /^[a-z]{2}$/i.test(countryCode) ? countryCode.toUpperCase() : null
    } catch {
        return null
    }
}

export const saveCountryCode = (countryCode: string): void => {
    try {
        localStorage.setItem(COUNTRY_CODE_STORAGE_KEY, countryCode.toUpperCase())
    } catch {
        // localStorage might be unavailable
    }
}

export const detectCountryCode = async (): Promise<string> => {
    const savedCountryCode = getSavedCountryCode()
    if (savedCountryCode) return savedCountryCode

    const savedLanguageCountry = getCountryCodeFromLocale(localStorage.getItem('language'))
    if (savedLanguageCountry) {
        saveCountryCode(savedLanguageCountry)
        return savedLanguageCountry
    }

    const browserCountry = getCountryCodeFromLocale(navigator.language)
    if (browserCountry) {
        saveCountryCode(browserCountry)
        return browserCountry
    }

    const geoInfo = await fetchGeoInfo()
    if (geoInfo?.country_code) {
        const countryCode = geoInfo.country_code.toUpperCase()
        saveCountryCode(countryCode)
        return countryCode
    }

    saveCountryCode('US')
    return 'US'
}

export const getLanguageFromGeo = (countryCode: string): string => {
    const code = countryCode.toUpperCase()

    // Portuguese
    const portugueseCountries = ['PT', 'BR', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL']
    if (portugueseCountries.includes(code)) {
        return 'pt'
    }


    // Default to English (including US, UK, Rest of World)
    return 'en'
}

export const getCurrencyFromGeo = (countryCode: string, apiCurrency?: string): string => {
    // Priority: hardcoded rules -> api provided -> fallback
    const code = countryCode.toUpperCase()

    // Explicit overrides/confirmations based on user requirements
    if (code === 'PT') return 'EUR' // Portugal
    if (code === 'BR') return 'BRL' // Brazil
    if (code === 'CA') return 'CAD' // Canada
    if (code === 'US') return 'USD' // USA

    // Use API provided currency if available and seemingly valid (3 chars)
    if (apiCurrency && apiCurrency.length === 3) {
        return apiCurrency
    }

    // Fallback based on region if API fails or empty
    const euroZone = ['FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'GR', 'FI', 'IE']
    if (euroZone.includes(code)) return 'EUR'

    return 'USD' // Final fallback
}
