import { onUnmounted } from 'vue'

const DEFAULT_TITLE = 'Agendaly'
const DEFAULT_DESCRIPTION = 'Book appointments online with Agendaly.'
const DEFAULT_URL = 'https://agendaly.co'
const DEFAULT_IMAGE = 'https://agendaly.co/og-image.png'
const SITE_NAME = 'Agendaly'

export interface SeoOptions {
  title?: string
  description?: string
  canonical?: string
  image?: string | null
  imageAlt?: string
  robots?: string
  type?: string
}

let activeOwner: symbol | null = null

function getAbsoluteUrl(value?: string | null) {
  if (!value) return DEFAULT_IMAGE

  try {
    return new URL(value, DEFAULT_URL).toString()
  } catch {
    return DEFAULT_IMAGE
  }
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    tag.dataset.agendalySeo = 'true'
    document.head.appendChild(tag)
  }

  tag.setAttribute('content', content)
}

function setCanonical(href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!tag) {
    tag = document.createElement('link')
    tag.rel = 'canonical'
    tag.dataset.agendalySeo = 'true'
    document.head.appendChild(tag)
  }

  tag.href = href
}

export function applySeo(options: SeoOptions = {}) {
  if (typeof document === 'undefined') return

  const title = options.title || DEFAULT_TITLE
  const description = options.description || DEFAULT_DESCRIPTION
  const canonical = getAbsoluteUrl(options.canonical || DEFAULT_URL)
  const image = getAbsoluteUrl(options.image)
  const imageAlt = options.imageAlt || SITE_NAME
  const robots = options.robots || 'index,follow'
  const type = options.type || 'website'

  document.title = title
  setCanonical(canonical)
  setMeta('name', 'description', description)
  setMeta('name', 'robots', robots)
  setMeta('property', 'og:type', type)
  setMeta('property', 'og:site_name', SITE_NAME)
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', canonical)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:alt', imageAlt)
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', image)
}

export function useSeo(initialOptions?: SeoOptions) {
  const owner = Symbol('seo-owner')
  activeOwner = owner

  if (initialOptions) {
    applySeo(initialOptions)
  }

  function setSeo(options: SeoOptions) {
    activeOwner = owner
    applySeo(options)
  }

  onUnmounted(() => {
    if (activeOwner === owner) {
      activeOwner = null
      applySeo()
    }
  })

  return { setSeo }
}
