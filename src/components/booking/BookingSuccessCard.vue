<script setup lang="ts">
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { CheckCircle2, Home, Navigation } from 'lucide-vue-next'
import type { Provider, ProviderAddress } from '@/types'

interface Service {
  id: string
  name: string
  price?: number
}

interface Staff {
  id: string
  name: string
}

defineProps<{
  selectedService: Service | undefined
  selectedStaff: Staff | undefined
  confirmedDate: Date | null
  confirmedTime: string
  providerInfo: Provider | null
  selectedAddressObject: ProviderAddress | null | undefined
  formatDateDisplay: (date: Date) => string
  formatAddress: (provider: Provider | null) => string
  getMapUrl: (address: ProviderAddress) => string
  getDirectionsUrl: (address: ProviderAddress) => string
}>()

const emit = defineEmits<{
  reset: []
}>()

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
</script>

<template>
  <div class="max-w-xl mx-auto animate-in zoom-in duration-300">
    <section class="booking-success-card">
      <header>
        <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 class="h-8 w-8 text-green-600" />
        </div>
        <h2>{{ $t('booking.confirmed_title') }}</h2>
        <p>{{ $t('booking.confirmed_desc', { email: authStore.customer?.profile?.email }) }}</p>
      </header>
      <div class="booking-success-card__content">
        <div class="bg-gray-50 rounded-lg p-4 grid gap-3 text-sm border">
          <div class="flex justify-between items-center">
            <span class="text-gray-500">{{ $t('booking.steps.service') }}</span>
            <span class="font-medium">{{ selectedService?.name }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">{{ $t('booking.steps.staff') }}</span>
            <span class="font-medium">{{ selectedStaff?.name }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">{{ $t('booking.date_label') }}</span>
            <span class="font-medium">{{ confirmedDate ? formatDateDisplay(confirmedDate) : '' }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">{{ $t('booking.time_label') }}</span>
            <span class="font-medium">{{ confirmedTime }}</span>
          </div>
          <div class="border-t pt-2 mt-2 flex justify-between items-center">
            <span class="text-gray-500">{{ $t('booking.location_label') }}</span>
            <span class="font-medium text-right max-w-[200px] truncate" :title="formatAddress(providerInfo)">{{ formatAddress(providerInfo) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">{{ $t('booking.price_label') }}</span>
            <span class="font-bold text-primary-600">{{ settingsStore.formatPrice(selectedService?.price || 0) }}</span>
          </div>
          
          <div v-if="selectedAddressObject" class="mt-4 w-full h-40 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
            <iframe 
              :src="getMapUrl(selectedAddressObject)" 
              width="100%" 
              height="100%" 
              style="border:0;" 
              allowfullscreen 
              loading="lazy" 
              referrerpolicy="no-referrer-when-downgrade"
              class="w-full h-full"
            ></iframe>
          </div>
          <a 
            v-if="selectedAddressObject"
            :href="getDirectionsUrl(selectedAddressObject)" 
            target="_blank" 
            rel="noopener noreferrer"
            class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            <Navigation class="h-4 w-4" />
            {{ $t('booking.get_directions') }}
          </a>
        </div>
        <div class="booking-success-actions">
          <button type="button" class="booking-success-action booking-success-action--primary" @click="emit('reset')">
            {{ $t('booking.book_another') }}
          </button>
          <router-link
            v-if="providerInfo?.slug"
            class="booking-success-action booking-success-action--outline"
            :to="`/${providerInfo.slug}`"
          >
            <Home class="booking-success-icon" />
            {{ $t('booking.provider_page') }}
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.booking-success-card {
  @apply rounded-xl border border-green-100 bg-white py-6 shadow-xl shadow-green-50;
}

.booking-success-card header {
  @apply px-6 pb-2 text-center;
}

.booking-success-card h2 {
  @apply text-2xl font-semibold leading-tight text-green-700;
}

.booking-success-card p {
  @apply mt-1 text-sm text-gray-600;
}

.booking-success-card__content {
  @apply grid gap-4 px-6 pt-4;
}

.booking-success-actions {
  @apply mt-4 grid gap-2;
}

.booking-success-action {
  @apply inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2;
}

.booking-success-action--primary {
  @apply bg-gray-950 text-white hover:bg-gray-800;
}

.booking-success-action--outline {
  @apply border border-gray-200 bg-white text-gray-900 shadow-sm hover:bg-gray-50;
}

.booking-success-icon {
  @apply h-4 w-4;
}
</style>
