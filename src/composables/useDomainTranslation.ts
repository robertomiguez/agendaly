import { useI18n } from 'vue-i18n'

/**
 * Translates database domain values (e.g. category names, plan features)
 * using the `domains.*` namespace in locale files.
 *
 * Falls back to the original English value when no translation key exists.
 */
export function useDomainTranslation() {
    const { t, te } = useI18n()

    /**
     * Translate a domain value from the database.
     * @param domain - namespace under `domains` (e.g. 'categories', 'plan_features')
     * @param value  - the raw English value from the DB
     * @returns translated string, or the original value as fallback
     */
    function td(domain: string, value: string): string {
        const key = `domains.${domain}.${toKey(value)}`
        return te(key) ? t(key) : value
    }

    return { td }
}

function toKey(value: string): string {
    return value.toLowerCase().replace(/[\s-]+/g, '_')
}
