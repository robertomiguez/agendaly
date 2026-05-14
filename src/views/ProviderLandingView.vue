<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fetchPublicProviderBySlug } from '@/services/providerService'
import { fetchServices } from '@/services/serviceService'
import { fetchStaff } from '@/services/staffService'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useNotifications } from '@/composables/useNotifications'
import { getProviderSlugFromHost } from '@/lib/publicHost'
import type { Provider, ProviderAddress, Service, Staff } from '@/types'
import { ArrowRight, CalendarDays, Check, Clock, ListChecks, MapPin, Scissors, Share2, Star, Users } from 'lucide-vue-next'

const props = defineProps<{
  providerSlug?: string | null
}>()

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const { t } = useI18n()
const { showSuccess, showError } = useNotifications()

const provider = ref<Provider | null>(null)
const services = ref<Service[]>([])
const staff = ref<Staff[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const copiedProviderLink = ref(false)
const supportEmail = 'agendaly.co+support@gmail.com'

const resolvedSlug = computed(() => {
  return props.providerSlug || route.params.providerSlug as string || getProviderSlugFromHost()
})

const activeServices = computed(() => services.value.filter(service => service.active))
const activeStaff = computed(() => staff.value.filter(member => member.active))
const addresses = computed(() => {
  return (provider.value?.provider_addresses || []).filter(address => address.active !== false)
})
const primaryAddress = computed(() => {
  return addresses.value.find(address => address.is_primary) || addresses.value[0] || null
})
const featuredImages = computed(() => {
  return activeServices.value
    .flatMap(service => service.images?.map(image => image.url) || (service.image_url ? [service.image_url] : []))
    .slice(0, 6)
})
const isProviderContext = computed(() => {
  return route.query.menu === '1' && !!provider.value && authStore.provider?.id === provider.value.id
})
const providerShareUrl = computed(() => {
  if (!provider.value?.slug) return ''
  return `${window.location.origin}/${provider.value.slug}`
})

function formatAddress(address: ProviderAddress | null) {
  if (!address) return ''
  return [
    address.street_address,
    address.street_address_2,
    address.city,
    address.state,
    address.postal_code
  ].filter(Boolean).join(', ')
}

function bookNow() {
  if (!provider.value) return
  router.push(`/booking?provider=${provider.value.id}`)
}

function bookService(serviceId: string) {
  if (!provider.value) return
  router.push(`/booking?provider=${provider.value.id}&service=${serviceId}`)
}

function goToMyBookings() {
  if (authStore.customer) {
    router.push('/my-bookings')
  } else {
    router.push('/login?redirect=/my-bookings&context=customer')
  }
}

async function shareProviderLink() {
  if (!provider.value || !providerShareUrl.value) return

  if (navigator.share) {
    try {
      await navigator.share({
        title: t('provider_page.share_title', { name: provider.value.business_name }),
        text: t('provider_page.share_text', { name: provider.value.business_name }),
        url: providerShareUrl.value
      })
      return
    } catch (err) {
      console.error('Share canceled or failed, falling back to copy', err)
    }
  }

  try {
    await navigator.clipboard.writeText(providerShareUrl.value)
    copiedProviderLink.value = true
    showSuccess(t('provider_page.link_copied'))
    setTimeout(() => {
      copiedProviderLink.value = false
    }, 3000)
  } catch (err) {
    console.error('Failed to copy provider link', err)
    showError(t('provider.staff.copy_error'))
  }
}

function getDirectionsUrl(address: ProviderAddress) {
  const query = encodeURIComponent(formatAddress(address))
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

onMounted(async () => {
  if (!resolvedSlug.value) {
    loading.value = false
    error.value = t('provider_page.not_found_message')
    return
  }

  try {
    const publicProvider = await fetchPublicProviderBySlug(resolvedSlug.value)
    provider.value = publicProvider

    if (!publicProvider) {
      error.value = t('provider_page.not_found_message')
      return
    }

    const [providerServices, providerStaff] = await Promise.all([
      fetchServices(publicProvider.id),
      fetchStaff(publicProvider.id)
    ])

    services.value = providerServices
    staff.value = providerStaff
  } catch (e) {
    console.error('Failed to load provider page:', e)
    error.value = t('provider_page.load_error')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="provider-page">
    <section v-if="loading" class="provider-state">
      <div class="provider-spinner"></div>
      <p>{{ $t('provider_page.loading') }}</p>
    </section>

    <section v-else-if="error || !provider" class="provider-state">
      <h1>{{ $t('provider_page.not_found_title') }}</h1>
      <p>{{ error }}</p>
      <button type="button" class="provider-button provider-button--primary" @click="router.push('/')">{{ $t('provider_page.go_to_agendaly') }}</button>
    </section>

    <template v-else>
      <section class="provider-hero">
        <div class="provider-hero-inner">
          <div class="provider-hero-copy">
            <div class="provider-identity">
              <img
                v-if="provider.logo_url"
                class="provider-logo"
                :src="provider.logo_url"
                :alt="provider.business_name"
              />
              <div v-else class="provider-logo-fallback">
                {{ provider.business_name.slice(0, 2).toUpperCase() }}
              </div>
              <p class="provider-eyebrow">{{ $t('provider_page.eyebrow') }}</p>
            </div>

            <h1>{{ provider.business_name }}</h1>
            <p class="provider-description">
              {{ provider.description || $t('provider_page.default_description') }}
            </p>

            <div class="provider-proof-strip">
              <span><Scissors class="provider-summary-icon" />{{ $t('provider_page.services_count', { count: activeServices.length }) }}</span>
              <span><Users class="provider-summary-icon" />{{ $t('provider_page.professionals_count', { count: activeStaff.length }) }}</span>
              <span><Star class="provider-summary-icon" />{{ $t('provider_page.trusted_business') }}</span>
            </div>
          </div>

          <div class="provider-hero-media" aria-hidden="true">
            <img
              v-if="featuredImages[0]"
              class="provider-feature-image provider-feature-image--large"
              :src="featuredImages[0]"
              alt=""
            />
            <div v-else class="provider-feature-fallback">
              {{ provider.business_name.slice(0, 2).toUpperCase() }}
            </div>
            <img
              v-if="featuredImages[1]"
              class="provider-feature-image provider-feature-image--small"
              :src="featuredImages[1]"
              alt=""
            />
          </div>
        </div>
      </section>

      <section class="provider-booking-panel" aria-label="Booking actions">
        <div class="provider-booking-copy">
          <p>{{ $t('provider_page.booking_panel_label') }}</p>
          <span class="provider-booking-hint">{{ $t('provider_page.booking_panel_hint') }}</span>
        </div>
        <div class="provider-actions provider-actions--booking">
          <button
            type="button"
            class="provider-button provider-button--primary"
            :disabled="isProviderContext"
            @click="bookNow"
          >
            <CalendarDays class="provider-button-icon" />
            {{ $t('nav.book_now') }}
          </button>

          <div class="provider-secondary-row">
            <button
              v-if="isProviderContext"
              type="button"
              class="provider-text-action"
              @click="shareProviderLink"
            >
              <Check v-if="copiedProviderLink" class="provider-button-icon" />
              <Share2 v-else class="provider-button-icon" />
              {{ copiedProviderLink ? $t('provider_page.link_copied') : $t('provider_page.share_link') }}
            </button>
            <button
              type="button"
              class="provider-text-action"
              :disabled="isProviderContext"
              @click="goToMyBookings"
            >
              <ListChecks class="provider-button-icon" />
              {{ $t('nav.my_bookings') }}
            </button>
            <a
              v-if="primaryAddress"
              class="provider-text-action"
              :href="getDirectionsUrl(primaryAddress)"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin class="provider-button-icon" />
              {{ $t('provider_page.directions') }}
            </a>
          </div>
        </div>
      </section>

      <section class="provider-customer-path">
        <div class="provider-customer-path-inner">
          <div class="provider-customer-icon">
            <ListChecks />
          </div>
          <div class="provider-customer-copy">
            <p class="provider-customer-eyebrow">{{ $t('provider_page.customer_path_eyebrow') }}</p>
            <h2>{{ $t('provider_page.customer_path_title') }}</h2>
            <p>{{ $t('provider_page.customer_path_description') }}</p>
          </div>
          <div class="provider-actions">
            <button
              type="button"
              class="provider-button provider-button--dark"
              :disabled="isProviderContext"
              @click="goToMyBookings"
            >
              {{ $t('nav.my_bookings') }}
              <ArrowRight class="provider-button-icon" />
            </button>
          </div>
        </div>
      </section>

      <section class="provider-section">
        <div class="provider-section-header">
          <p>{{ $t('provider_page.services_subtitle') }}</p>
          <h2>{{ $t('provider_page.services_title') }}</h2>
        </div>

        <div v-if="activeServices.length" class="service-list">
          <article v-for="service in activeServices" :key="service.id" class="service-row">
            <img
              v-if="service.images?.[0]?.url || service.image_url"
              class="service-image"
              :src="service.images?.[0]?.url || service.image_url"
              :alt="service.name"
            />
            <div class="service-content">
              <h3>{{ service.name }}</h3>
              <p v-if="service.description">{{ service.description }}</p>
              <div class="service-meta">
                <span><Clock class="service-meta-icon" />{{ service.duration }} {{ $t('common.minutes') }}</span>
                <span>{{ settingsStore.formatPrice(service.price || 0, provider?.currency) }}</span>
              </div>
            </div>
            <button
              type="button"
              class="provider-button provider-button--outline"
              :disabled="isProviderContext"
              @click="bookService(service.id)"
            >
              {{ $t('provider_page.book') }}
            </button>
          </article>
        </div>

        <div v-else class="provider-empty">
          {{ $t('provider_page.empty_services') }}
        </div>
      </section>

      <section v-if="activeStaff.length" class="provider-section">
        <div class="provider-section-header">
          <p>{{ $t('provider_page.team_subtitle') }}</p>
          <h2>{{ $t('provider_page.team_title') }}</h2>
        </div>

        <div class="staff-strip">
          <article v-for="member in activeStaff" :key="member.id" class="staff-card">
            <img
              v-if="member.photo_url"
              class="staff-photo"
              :src="member.photo_url"
              :alt="member.name"
            />
            <div v-else class="staff-photo-fallback">
              {{ member.name.slice(0, 2).toUpperCase() }}
            </div>
            <h3>{{ member.name }}</h3>
          </article>
        </div>
      </section>

      <section v-if="featuredImages.length" class="provider-section">
        <div class="provider-section-header">
          <p>{{ $t('provider_page.gallery_subtitle') }}</p>
          <h2>{{ $t('provider_page.gallery_title') }}</h2>
        </div>

        <div class="gallery-grid">
          <img
            v-for="image in featuredImages"
            :key="image"
            class="gallery-image"
            :src="image"
            alt=""
          />
        </div>
      </section>

      <section class="provider-section provider-location">
        <div>
          <h2>{{ $t('provider_page.location_title') }}</h2>
          <p v-if="primaryAddress">{{ formatAddress(primaryAddress) }}</p>
          <p v-else>{{ $t('provider_page.location_fallback') }}</p>
        </div>
        <a
          v-if="primaryAddress"
          class="provider-link-button"
          :href="getDirectionsUrl(primaryAddress)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin class="provider-button-icon" />
          {{ $t('provider_page.open_map') }}
        </a>
      </section>

      <footer class="provider-footer">
        <p>{{ $t('footer.powered_by') }}</p>
        <nav class="provider-footer-nav" aria-label="Support and legal">
          <a href="/privacy" class="provider-footer-link">
            {{ $t('footer.privacy') }}
          </a>
          <a href="/terms" class="provider-footer-link">
            {{ $t('footer.terms') }}
          </a>
          <a :href="`mailto:${supportEmail}`" class="provider-footer-link">
            {{ $t('footer.support') }}
          </a>
        </nav>
      </footer>
    </template>
  </main>
</template>

<style scoped>
@reference "../style.css";

.provider-page {
  @apply min-h-screen bg-gray-50 text-gray-950;
}

.provider-state {
  @apply mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center text-gray-600;
}

.provider-state h1 {
  @apply text-3xl font-bold text-gray-950;
}

.provider-spinner {
  @apply h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600;
}

.provider-hero {
  @apply overflow-hidden bg-gradient-to-br from-stone-100 via-amber-50 to-gray-100 text-gray-950;
}

.provider-hero-inner {
  @apply mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-12 md:grid-cols-[minmax(0,1fr)_360px] md:items-center md:pb-20 md:pt-20 lg:grid-cols-[minmax(0,1fr)_440px];
}

.provider-hero-copy {
  @apply max-w-3xl;
}

.provider-identity {
  @apply mb-7 flex items-center gap-4;
}

.provider-logo,
.provider-logo-fallback {
  @apply h-16 w-16 shrink-0 rounded-md border border-stone-300 object-cover shadow-sm;
}

.provider-logo-fallback {
  @apply flex items-center justify-center bg-primary-600 text-xl font-bold text-white;
}

.provider-eyebrow {
  @apply text-sm font-semibold uppercase tracking-wide text-primary-700;
}

.provider-hero-copy h1 {
  @apply max-w-3xl text-4xl font-bold leading-tight text-stone-950 md:text-6xl;
}

.provider-description {
  @apply mt-5 max-w-2xl text-lg leading-8 text-stone-700;
}

.provider-proof-strip {
  @apply mt-8 flex flex-wrap gap-x-6 gap-y-3 border-y border-stone-300 py-4 text-sm font-semibold text-stone-700;
}

.provider-proof-strip span {
  @apply inline-flex items-center gap-2;
}

.provider-hero-media {
  @apply relative hidden min-h-[420px] md:block;
}

.provider-feature-image,
.provider-feature-fallback {
  @apply absolute object-cover shadow-2xl;
}

.provider-feature-image--large,
.provider-feature-fallback {
  @apply inset-x-0 bottom-0 h-96 rounded-t-full rounded-b-md border border-stone-200;
}

.provider-feature-image--small {
  @apply right-4 top-0 h-40 w-40 rounded-md border-8 border-amber-50;
}

.provider-feature-fallback {
  @apply flex items-center justify-center bg-stone-900 text-5xl font-bold text-amber-50;
}

.provider-booking-panel {
  @apply sticky top-0 z-20 mx-auto -mt-8 flex max-w-7xl flex-col gap-3 border border-stone-200 bg-white px-5 py-3 shadow-lg sm:rounded-lg sm:px-6 sm:py-4 md:flex-row md:items-center md:justify-between;
}

.provider-booking-copy {
  @apply min-w-0;
}

.provider-booking-copy p {
  @apply text-xs font-semibold uppercase tracking-wide text-primary-700;
}

.provider-booking-hint {
  @apply mt-0.5 block text-sm font-semibold leading-5 text-gray-700;
}

.provider-actions {
  @apply flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-row sm:flex-wrap;
}

.provider-actions--booking {
  @apply grid w-full gap-2 sm:flex sm:w-auto sm:justify-end;
}

.provider-button {
  @apply inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 focus:ring-offset-white;
}

.provider-button:disabled {
  @apply cursor-not-allowed opacity-50;
}

.provider-button--primary {
  @apply bg-primary-700 text-white hover:bg-primary-600;
}

.provider-button--outline {
  @apply border border-gray-300 bg-white text-gray-900 shadow-sm hover:bg-gray-50;
}

.provider-button--dark {
  @apply bg-gray-950 text-white shadow-sm hover:bg-gray-800;
}

.provider-button-icon {
  @apply h-4 w-4;
}

.provider-link-button {
  @apply inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 focus:ring-offset-white;
}

.provider-booking-panel .provider-button--primary {
  @apply h-10 w-full sm:h-11 sm:w-auto;
}

.provider-secondary-row {
  @apply flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start;
}

.provider-text-action {
  @apply inline-flex h-6 items-center justify-center gap-1.5 rounded-md px-1 text-sm font-semibold text-stone-700 underline-offset-4 transition-colors hover:text-stone-950 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:border sm:border-gray-300 sm:bg-white sm:px-5 sm:text-gray-900 sm:shadow-sm sm:hover:bg-gray-50 sm:hover:no-underline;
}

.provider-summary-icon {
  @apply h-4 w-4 text-primary-700;
}

.provider-customer-path {
  @apply px-6 py-8;
}

.provider-customer-path-inner {
  @apply mx-auto flex max-w-7xl flex-col gap-5 border-y border-stone-200 bg-gray-50 py-6 sm:flex-row sm:items-center;
}

.provider-customer-icon {
  @apply flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700;
}

.provider-customer-icon svg {
  @apply h-6 w-6;
}

.provider-customer-copy {
  @apply flex-1;
}

.provider-customer-eyebrow {
  @apply mb-1 text-xs font-semibold uppercase tracking-wide text-primary-700;
}

.provider-customer-copy h2 {
  @apply text-xl font-bold text-gray-950;
}

.provider-customer-copy p:not(.provider-customer-eyebrow) {
  @apply mt-1 max-w-2xl text-sm text-gray-600;
}

.provider-section {
  @apply mx-auto max-w-7xl px-6 py-12;
}

.provider-section-header {
  @apply mb-6 max-w-2xl;
}

.provider-section h2 {
  @apply mt-1 text-3xl font-bold leading-tight text-gray-950;
}

.provider-section p {
  @apply text-sm font-medium text-gray-600;
}

.service-list {
  @apply divide-y divide-stone-200 border-y border-stone-300 bg-white;
}

.service-row {
  @apply grid gap-4 py-5 sm:grid-cols-[112px_1fr_auto] sm:items-center;
}

.service-image {
  @apply h-32 w-full rounded-md object-cover sm:h-28 sm:w-28;
}

.service-content h3 {
  @apply text-lg font-semibold text-gray-950;
}

.service-meta {
  @apply mt-3 flex flex-wrap gap-4 text-sm font-semibold text-gray-800;
}

.service-meta span {
  @apply inline-flex items-center gap-1.5;
}

.service-meta-icon {
  @apply h-4 w-4 text-gray-500;
}

.provider-empty {
  @apply rounded-lg border border-dashed p-8 text-center text-gray-500;
}

.staff-strip {
  @apply flex gap-4 overflow-x-auto pb-2;
}

.staff-card {
  @apply min-w-36 border-y border-stone-200 bg-white px-4 py-5 text-center;
}

.staff-photo,
.staff-photo-fallback {
  @apply mx-auto mb-3 h-20 w-20 rounded-full object-cover;
}

.staff-photo-fallback {
  @apply flex items-center justify-center bg-gray-100 font-semibold text-gray-700;
}

.staff-card h3 {
  @apply font-semibold text-gray-950;
}

.gallery-grid {
  @apply grid grid-cols-2 gap-3 md:grid-cols-[1.2fr_0.8fr_1fr];
}

.gallery-image {
  @apply aspect-square w-full rounded-md object-cover;
}

.gallery-image:first-child {
  @apply md:row-span-2 md:aspect-auto;
}

.provider-location {
  @apply mb-10 flex flex-col gap-4 border-t border-gray-200 md:flex-row md:items-center md:justify-between;
}

.provider-footer {
  @apply flex flex-col items-center justify-center gap-3 border-t bg-gray-50 px-6 py-6 text-center text-sm text-gray-500 sm:flex-row;
}

.provider-footer-nav {
  @apply flex flex-wrap items-center justify-center gap-2;
}

.provider-footer-link {
  @apply rounded-md px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 focus:ring-offset-gray-50;
}
</style>
