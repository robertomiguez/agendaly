const RESERVED_SUBDOMAINS = new Set([
    'agendaly',
    'app',
    'biz',
    'localhost',
    'www'
])

export function getProviderSlugFromHost(hostname = window.location.hostname): string | null {
    const normalized = hostname.toLowerCase()

    if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
        return null
    }

    const parts = normalized.split('.').filter(Boolean)
    if (parts.length < 3) return null

    const subdomain = parts[0]
    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null

    return subdomain
}

export function isBusinessHost(hostname = window.location.hostname): boolean {
    return hostname.toLowerCase().split('.')[0] === 'biz'
}
