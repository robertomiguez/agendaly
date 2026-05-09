export function slugify(value: string) {
    const slug = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return slug || 'link'
}

export function appendSlugSuffix(baseSlug: string, suffix: number) {
    return suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`
}

export const RESERVED_PROVIDER_SLUGS = new Set([
    'admin',
    'agendaly',
    'auth',
    'b',
    'biz',
    'booking',
    'deactivated',
    'for-business',
    'login',
    'my-bookings',
    'p',
    'privacy',
    'profile',
    'provider',
    'super-admin',
    'terms',
    'www'
])

export function isReservedProviderSlug(slug: string) {
    return RESERVED_PROVIDER_SLUGS.has(slug)
}
