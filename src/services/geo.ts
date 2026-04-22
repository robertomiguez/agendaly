
export interface GeoInfo {
    country_code: string
    region_code: string
    currency: string
}

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

export const getLanguageFromGeo = (country: string, region?: string): string => {
    const code = country.toUpperCase()

    // Portuguese
    const portugueseCountries = ['PT', 'BR', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL']
    if (portugueseCountries.includes(code)) {
        return 'pt'
    }


    // Default to English (including US, UK, Rest of World)
    return 'en'
}

export const getCurrencyFromGeo = (country: string, apiCurrency?: string): string => {
    // Priority: hardcoded rules -> api provided -> fallback
    const code = country.toUpperCase()

    // Explicit overrides/confirmations based on user requirements
    if (code === 'FR' || code === 'PT') return 'EUR' // France, Portugal
    if (code === 'BR') return 'BRL' // Brazil
    if (code === 'CA') return 'CAD' // Canada
    if (code === 'US') return 'USD' // USA

    // Use API provided currency if available and seemingly valid (3 chars)
    if (apiCurrency && apiCurrency.length === 3) {
        return apiCurrency
    }

    // Fallback based on region if API fails or empty
    const euroZone = ['DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'GR', 'FI', 'IE']
    if (euroZone.includes(code)) return 'EUR'

    return 'USD' // Final fallback
}
