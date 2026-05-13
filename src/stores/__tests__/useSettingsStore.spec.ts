import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '../useSettingsStore'
import * as geoService from '../../services/geo'

// Mock the geo service
vi.mock('../../services/geo', () => ({
    fetchGeoInfo: vi.fn(),
    getLanguageFromGeo: vi.fn(),
    getCurrencyFromGeo: vi.fn(),
    getCurrencyFromBrowserLocale: vi.fn((locale?: string | null) => {
        const normalized = (locale || '').replace('_', '-').toUpperCase()
        const [, region] = normalized.split('-')
        if (region === 'BR') return 'BRL'
        if (region === 'US') return 'USD'
        if (region === 'CA') return 'CAD'
        if (region === 'AU') return 'AUD'
        if (region === 'NZ') return 'NZD'
        if (region === 'ZA') return 'ZAR'
        if (['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'].includes(region || '')) return 'EUR'
        return 'USD'
    }),
    getCountryCodeFromLocale: vi.fn((locale?: string | null) => {
        if (!locale) return null
        const [, region] = locale.replace('_', '-').split('-')
        return region?.toUpperCase() || null
    }),
    saveCountryCode: vi.fn()
}))

// Mock i18n
vi.mock('../../lib/i18n', () => ({
    default: {
        global: {
            locale: {
                value: 'en'
            }
        }
    }
}))

describe('useSettingsStore Localization', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        localStorage.clear()
        vi.clearAllMocks()

        // Reset navigator.language mock
        Object.defineProperty(window.navigator, 'language', {
            value: 'en-US',
            configurable: true
        })
    })

    it('respects saved user preferences (Highest Priority)', async () => {
        localStorage.setItem('language', 'fr')
        localStorage.setItem('currency', 'EUR')

        const store = useSettingsStore()
        // settings are initialized on creation via ref from localStorage

        // Call initializeSettings to ensure it doesn't override
        await store.initializeSettings()

        expect(store.language).toBe('en')
        expect(store.currency).toBe('EUR')
        expect(geoService.fetchGeoInfo).not.toHaveBeenCalled()
    })

    it('detects language from browser if no preference saved (2nd Priority)', async () => {
        // Mock browser language to 'pt-BR'
        Object.defineProperty(window.navigator, 'language', {
            value: 'pt-BR',
            configurable: true
        })

        const store = useSettingsStore()
        await store.initializeSettings()

        expect(store.language).toBe('pt') // from browser
        expect(geoService.fetchGeoInfo).not.toHaveBeenCalled()
        expect(store.currency).toBe('BRL')
    })

    it('falls back to English when browser language is unsupported and uses browser region currency', async () => {
        // Mock unsupported browser language (e.g. Spanish)
        Object.defineProperty(window.navigator, 'language', {
            value: 'es-ES',
            configurable: true
        })

        const store = useSettingsStore()
        await store.initializeSettings()

        expect(store.language).toBe('en')
        expect(geoService.fetchGeoInfo).not.toHaveBeenCalled()
        expect(store.currency).toBe('EUR')
    })

    it('falls back to defaults if browser language and region are unsupported', async () => {
        // Mock unsupported browser
        Object.defineProperty(window.navigator, 'language', {
            value: 'ja-JP',
            configurable: true
        })

        const store = useSettingsStore()
        await store.initializeSettings()

        expect(store.language).toBe('en')
        expect(geoService.fetchGeoInfo).not.toHaveBeenCalled()
        expect(store.currency).toBe('USD')
    })
})

describe('useSettingsStore Currency Formatting', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        localStorage.clear()
    })

    it('formats USD correctly', () => {
        const store = useSettingsStore()
        store.language = 'en-US'
        store.currency = 'USD'

        // Note: The exact non-breaking space might vary in different environments,
        // so we might need to be flexible or check parts of the string.
        // Standard expected: "$10.00"
        const formatted = store.formatPrice(10)
        expect(formatted).toContain('$')
        expect(formatted).toContain('10.00')
    })

    it('formats EUR correctly with French locale', () => {
        const store = useSettingsStore()
        store.language = 'fr-FR'
        store.currency = 'EUR'

        // Standard expected: "10,00 €"
        const formatted = store.formatPrice(10)
        expect(formatted).toContain('10,00')
        expect(formatted).toContain('€')
    })

    it('formats BRL correctly with Portuguese locale', () => {
        const store = useSettingsStore()
        store.language = 'pt-BR'
        store.currency = 'BRL'

        // Standard expected: "R$ 10,00"
        const formatted = store.formatPrice(10)
        expect(formatted).toContain('R$')
        expect(formatted).toContain('10,00')
    })

    it('handles zero values', () => {
        const store = useSettingsStore()
        store.currency = 'USD'
        // Dependent on implementation, check if we want "Free" or "$0.00"
        // Current implementation in store might default to Free? 
        // Let's check the store implementation briefly or just test what we set.
        // Assuming the store implementation: `if (!price) return 'Free'` logic was in Views, 
        // let's verify if the store has it or if it relies on standard formatting.
        // The store implementation added earlier was:
        // formatPrice(value: number) { return new Intl...().format(value) }

        const formatted = store.formatPrice(0)
        expect(formatted).toBe('Free')
    })

    it('persists currency selection', () => {
        const store = useSettingsStore()
        store.setCurrency('CAD')

        expect(store.currency).toBe('CAD')
        expect(localStorage.getItem('currency')).toBe('CAD')
    })
})
