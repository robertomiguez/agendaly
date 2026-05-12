<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ProviderLandingView from './ProviderLandingView.vue'
import { getProviderSlugFromHost } from '@/lib/publicHost'
import { useAuthStore } from '@/stores/useAuthStore'
import { ArrowRight, CalendarCheck, Clock, Globe2, Link, MapPin, Scissors, Share2, Smartphone, UserPlus, Users } from 'lucide-vue-next'
import heroManicure from '@/assets/images/hero_background_manicure_1765115664380.png'
import heroBarber from '@/assets/images/hero_barber_service_1765116285430.png'
import heroMassage from '@/assets/images/hero_massage_service_1765116300777.png'
import heroSpa from '@/assets/images/hero_spa_service_1765116318055.png'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const providerSlug = computed(() => getProviderSlugFromHost())

const valueItems = computed(() => [
  {
    icon: Link,
    title: t('landing.provider_first_links_title'),
    description: t('landing.provider_first_links_desc')
  },
  {
    icon: CalendarCheck,
    title: t('landing.same_booking_flow_title'),
    description: t('landing.same_booking_flow_desc')
  },
  {
    icon: Globe2,
    title: t('landing.public_minisite_title'),
    description: t('landing.public_minisite_desc')
  }
])

const workflowSteps = computed(() => [
  {
    icon: Smartphone,
    title: t('landing.workflow.publish_title'),
    description: t('landing.workflow.publish_desc')
  },
  {
    icon: Users,
    title: t('landing.workflow.share_title'),
    description: t('landing.workflow.share_desc')
  },
  {
    icon: CalendarCheck,
    title: t('landing.workflow.relationship_title'),
    description: t('landing.workflow.relationship_desc')
  }
])

const featureItems = computed(() => [
  {
    icon: Globe2,
    title: t('landing.features.mini_pages_title'),
    description: t('landing.features.mini_pages_desc')
  },
  {
    icon: Scissors,
    title: t('landing.features.service_links_title'),
    description: t('landing.features.service_links_desc')
  },
  {
    icon: UserPlus,
    title: t('landing.features.staff_links_title'),
    description: t('landing.features.staff_links_desc')
  },
  {
    icon: MapPin,
    title: t('landing.features.locations_title'),
    description: t('landing.features.locations_desc')
  },
  {
    icon: CalendarCheck,
    title: t('landing.features.availability_title'),
    description: t('landing.features.availability_desc')
  },
  {
    icon: Share2,
    title: t('landing.features.customer_return_title'),
    description: t('landing.features.customer_return_desc')
  }
])

const providerFlowSteps = computed(() => [
  t('landing.provider_flow.profile'),
  t('landing.provider_flow.services'),
  t('landing.provider_flow.share'),
  t('landing.provider_flow.customer')
])

const beautyImages = [
  { src: heroManicure, alt: 'Manicure service detail' },
  { src: heroBarber, alt: 'Barber service detail' },
  { src: heroMassage, alt: 'Massage service detail' },
  { src: heroSpa, alt: 'Spa service detail' }
]

function goToLogin() {
  router.push('/login?redirect=/provider')
}

async function goToMyBookings() {
  if (!authStore.isAuthenticated) {
    router.push('/login?redirect=/my-bookings&context=customer')
    return
  }

  if (!authStore.customer) {
    await authStore.ensureProfileAndCustomer()
    await authStore.fetchCustomerProfile()
  }

  router.push({ name: 'CustomerBookings' })
}
</script>

<template>
  <ProviderLandingView v-if="providerSlug" :provider-slug="providerSlug" />

  <main v-else class="institutional-page">
    <section class="institutional-hero">
      <div class="institutional-hero-inner">
        <div class="institutional-copy">
          <p class="institutional-eyebrow">{{ $t('landing.institutional_eyebrow') }}</p>
          <h1>{{ $t('landing.institutional_title') }}</h1>
          <p class="institutional-subtitle">
            {{ $t('landing.institutional_subtitle') }}
          </p>
          <div class="institutional-actions">
            <button type="button" class="institutional-login-command" @click="goToLogin">
              {{ $t('landing.provider_login') }}
            </button>
          </div>
        </div>

        <div class="institutional-visual">
          <div class="beauty-collage">
            <img class="beauty-collage-main" :src="heroManicure" alt="Beauty appointment service" />
            <img class="beauty-collage-side beauty-collage-side--top" :src="heroBarber" alt="" />
            <img class="beauty-collage-side beauty-collage-side--bottom" :src="heroSpa" alt="" />
          </div>

          <div class="institutional-preview">
            <div class="preview-header">
              <div class="preview-logo">RG</div>
              <div>
                <h2>Rob Glamour</h2>
                <p>robglamour.agendaly.co</p>
              </div>
            </div>
            <div class="preview-services">
              <div class="preview-service">
                <span>{{ $t('landing.preview.services.hair') }}</span>
                <strong>$45</strong>
              </div>
              <div class="preview-service">
                <span>{{ $t('landing.preview.services.manicure') }}</span>
                <strong>$32</strong>
              </div>
              <div class="preview-service">
                <span>{{ $t('landing.preview.services.makeup') }}</span>
                <strong>$75</strong>
              </div>
            </div>
            <div class="preview-cta">{{ $t('nav.book_now') }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="institutional-band">
      <div class="institutional-band-inner">
        <article v-for="item in valueItems" :key="item.title" class="value-item">
          <component :is="item.icon" class="value-icon" />
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="customer-return-section">
      <div class="customer-return-inner">
        <div class="customer-return-copy">
          <p class="customer-return-eyebrow">{{ $t('landing.customer_return_eyebrow') }}</p>
          <h2>{{ $t('landing.customer_return_title') }}</h2>
          <p>{{ $t('landing.customer_return_desc') }}</p>
          <button type="button" class="customer-return-command" @click="goToMyBookings">
            {{ $t('landing.customer_return_cta') }}
            <ArrowRight />
          </button>
        </div>

        <div class="customer-return-preview" aria-hidden="true">
          <div class="customer-preview-header">
            <span>{{ $t('landing.customer_return_preview_label') }}</span>
            <strong>{{ $t('landing.customer_return_preview_status') }}</strong>
          </div>
          <div class="customer-preview-row">
            <CalendarCheck />
            <div>
              <strong>{{ $t('landing.customer_return_preview_service') }}</strong>
              <span>{{ $t('landing.customer_return_preview_provider') }}</span>
            </div>
          </div>
          <div class="customer-preview-meta">
            <span>
              <Clock />
              {{ $t('landing.customer_return_preview_time') }}
            </span>
            <span>{{ $t('landing.customer_return_preview_action') }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="beauty-gallery-section" aria-label="Beauty services">
      <div class="beauty-gallery">
        <img v-for="image in beautyImages" :key="image.src" :src="image.src" :alt="image.alt" />
      </div>
    </section>

    <section class="institutional-section">
      <div class="section-heading">
        <h2>{{ $t('landing.provider_workflow_title') }}</h2>
        <p>{{ $t('landing.provider_workflow_subtitle') }}</p>
      </div>

      <div class="workflow-grid">
        <div v-for="step in workflowSteps" :key="step.title" class="workflow-step">
          <component :is="step.icon" class="workflow-icon" />
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
        </div>
      </div>
    </section>

    <section class="institutional-section feature-section">
      <div class="section-heading">
        <h2>{{ $t('landing.features_title') }}</h2>
        <p>{{ $t('landing.features_subtitle') }}</p>
      </div>

      <div class="feature-grid">
        <article v-for="item in featureItems" :key="item.title" class="feature-item">
          <component :is="item.icon" class="feature-icon" />
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="institutional-section split-section">
      <div class="split-copy">
        <h2>{{ $t('landing.flow_title') }}</h2>
        <p>
          {{ $t('landing.flow_subtitle') }}
        </p>
      </div>

      <div class="flow-list">
        <div v-for="(step, index) in providerFlowSteps" :key="step" class="flow-row">
          <span>{{ index + 1 }}</span>
          <p>{{ step }}</p>
        </div>
      </div>
    </section>

    <footer class="institutional-footer">
      <div class="institutional-footer-inner">
        <p>&copy; 2026 Agendaly. {{ $t('footer.rights') }}</p>
        <span class="institutional-footer-separator" aria-hidden="true"></span>
        <nav class="institutional-footer-nav" aria-label="Legal">
          <a href="/privacy" class="institutional-footer-link">
            {{ $t('footer.privacy') }}
          </a>
        </nav>
      </div>
    </footer>
  </main>
</template>

<style scoped>
@reference "../style.css";

.institutional-page {
  @apply min-h-screen bg-amber-50/30 text-gray-950;
}

.institutional-hero {
  @apply overflow-hidden bg-gray-950 text-white;
}

.institutional-hero-inner {
  @apply mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center;
}

.institutional-copy {
  @apply max-w-3xl;
}

.institutional-eyebrow {
  @apply mb-4 text-sm font-semibold uppercase tracking-wide text-primary-200;
}

.institutional-copy h1 {
  @apply text-5xl font-bold leading-tight md:text-6xl;
}

.institutional-subtitle {
  @apply mt-6 max-w-2xl text-xl text-gray-200;
}

.institutional-actions {
  @apply mt-8 flex flex-col gap-3 sm:flex-row;
}

.institutional-login-command {
  @apply inline-flex h-10 items-center justify-center rounded-md border border-white/70 bg-transparent px-6 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-gray-950;
}

.institutional-visual {
  @apply relative min-h-[440px] md:min-h-[520px];
}

.beauty-collage {
  @apply grid h-[440px] grid-cols-[1fr_112px] grid-rows-2 gap-3 md:h-[520px] md:grid-cols-[1fr_160px];
}

.beauty-collage img {
  @apply h-full w-full rounded-lg object-cover;
}

.beauty-collage-main {
  @apply row-span-2 min-h-0 shadow-2xl;
}

.beauty-collage-side {
  @apply min-h-0 border border-white/10;
}

.beauty-collage-side--top {
  @apply min-h-0;
}

.beauty-collage-side--bottom {
  @apply min-h-0;
}

.institutional-preview {
  @apply absolute bottom-6 left-6 right-6 rounded-lg bg-white p-5 text-gray-950 shadow-2xl sm:left-auto sm:w-80;
}

.preview-header {
  @apply flex items-center gap-4 border-b pb-4;
}

.preview-logo {
  @apply flex h-14 w-14 items-center justify-center rounded-lg bg-primary-600 font-bold text-white;
}

.preview-header h2 {
  @apply text-xl font-bold;
}

.preview-header p {
  @apply text-sm text-gray-500;
}

.preview-services {
  @apply my-5 divide-y rounded-md border;
}

.preview-service {
  @apply flex items-center justify-between px-4 py-3 text-sm;
}

.preview-cta {
  @apply rounded-md bg-gray-950 px-4 py-3 text-center text-sm font-semibold text-white;
}

.institutional-band {
  @apply border-b border-amber-100 bg-white;
}

.institutional-band-inner {
  @apply mx-auto grid max-w-7xl gap-4 px-6 py-8 md:grid-cols-3;
}

.value-item {
  @apply rounded-lg border bg-white p-5;
}

.value-icon,
.workflow-icon {
  @apply mb-4 h-6 w-6 text-primary-600;
}

.value-item h2,
.workflow-step h3 {
  @apply text-lg font-bold text-gray-950;
}

.value-item p,
.workflow-step p,
.section-heading p {
  @apply mt-2 text-gray-600;
}

.customer-return-section {
  @apply bg-amber-50/30 px-6 py-14;
}

.customer-return-inner {
  @apply mx-auto grid max-w-7xl gap-8 rounded-lg border border-amber-100 bg-white p-6 shadow-sm md:grid-cols-[1fr_360px] md:items-center lg:p-8;
}

.customer-return-copy {
  @apply max-w-2xl;
}

.customer-return-eyebrow {
  @apply mb-3 text-sm font-semibold uppercase tracking-wide text-primary-700;
}

.customer-return-copy h2 {
  @apply text-3xl font-bold text-gray-950;
}

.customer-return-copy p {
  @apply mt-3 text-gray-600;
}

.customer-return-command {
  @apply mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2;
}

.customer-return-command svg {
  @apply h-4 w-4;
}

.customer-return-preview {
  @apply rounded-lg border border-gray-200 bg-white p-4 shadow-sm;
}

.customer-preview-header {
  @apply flex items-center justify-between border-b border-gray-100 pb-3 text-sm;
}

.customer-preview-header span {
  @apply font-medium text-gray-500;
}

.customer-preview-header strong {
  @apply rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700;
}

.customer-preview-row {
  @apply grid grid-cols-[40px_1fr] gap-3 py-4;
}

.customer-preview-row > svg {
  @apply h-10 w-10 rounded-md bg-primary-50 p-2.5 text-primary-700;
}

.customer-preview-row div {
  @apply grid gap-1;
}

.customer-preview-row strong {
  @apply text-sm font-semibold text-gray-950;
}

.customer-preview-row span {
  @apply text-sm text-gray-500;
}

.customer-preview-meta {
  @apply flex flex-col gap-2 rounded-md bg-gray-50 p-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between;
}

.customer-preview-meta span {
  @apply inline-flex items-center gap-1.5;
}

.customer-preview-meta svg {
  @apply h-4 w-4 text-gray-500;
}

.beauty-gallery-section {
  @apply bg-white px-6 py-6;
}

.beauty-gallery {
  @apply mx-auto grid max-w-7xl grid-cols-2 gap-3 md:grid-cols-4;
}

.beauty-gallery img {
  @apply aspect-[4/3] w-full rounded-lg object-cover shadow-sm;
}

.institutional-section {
  @apply mx-auto max-w-7xl px-6 py-16;
}

.section-heading {
  @apply max-w-2xl;
}

.section-heading h2 {
  @apply text-3xl font-bold text-gray-950;
}

.workflow-grid {
  @apply mt-8 grid gap-4 md:grid-cols-3;
}

.workflow-step {
  @apply rounded-lg border bg-white p-6;
}

.feature-section {
  @apply border-t border-amber-100 bg-white;
}

.feature-grid {
  @apply mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3;
}

.feature-item {
  @apply rounded-lg border bg-white p-6;
}

.feature-icon {
  @apply mb-4 h-6 w-6 text-primary-600;
}

.feature-item h3 {
  @apply text-lg font-bold text-gray-950;
}

.feature-item p {
  @apply mt-2 text-gray-600;
}

.split-section {
  @apply grid gap-8 border-t lg:grid-cols-[0.8fr_1fr] lg:items-start;
}

.split-copy h2 {
  @apply text-3xl font-bold text-gray-950;
}

.split-copy p {
  @apply mt-3 text-gray-600;
}

.flow-list {
  @apply grid gap-3;
}

.flow-row {
  @apply grid grid-cols-[40px_1fr] gap-4 rounded-lg border bg-white p-4;
}

.flow-row span {
  @apply flex h-10 w-10 items-center justify-center rounded-full bg-gray-950 text-sm font-bold text-white;
}

.flow-row p {
  @apply self-center text-gray-700;
}

.institutional-footer {
  @apply border-t border-gray-800 bg-gray-950 px-6 py-7 text-sm text-gray-400;
}

.institutional-footer-inner {
  @apply mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 text-center sm:flex-row;
}

.institutional-footer-separator {
  @apply hidden h-1 w-1 rounded-full bg-gray-600 sm:block;
}

.institutional-footer-nav {
  @apply flex items-center gap-2;
}

.institutional-footer-link {
  @apply rounded-md px-3 py-2 font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 focus:ring-offset-gray-950;
}
</style>
