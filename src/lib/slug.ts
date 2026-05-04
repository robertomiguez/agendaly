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
