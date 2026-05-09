<script setup lang="ts">
import { useSettingsStore } from '@/stores/useSettingsStore'
import { ArrowLeft, CheckCircle2, Navigation } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LoginForm from '@/components/auth/LoginForm.vue'
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
  selectedDate: Date
  selectedTime: string
  providerInfo: Provider | null
  selectedAddressObject: ProviderAddress | null | undefined
  notes: string
  showLogin: boolean
  errorMessage?: string | null
  isLimitReached?: boolean
  loading?: boolean
  formatDateDisplay: (date: Date) => string
  formatAddress: (provider: Provider | null) => string
  getMapUrl: (address: ProviderAddress) => string
  getDirectionsUrl: (address: ProviderAddress) => string
  saveBookingState?: () => void
}>()

const emit = defineEmits<{
  'update:notes': [value: string]
  submit: []
  back: []
  loginSuccess: []
  'go-to-bookings': []
}>()

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="animate-in fade-in slide-in-from-right-4 duration-300">
    <button type="button" class="booking-back-command" @click="emit('back')">
      <ArrowLeft class="mr-2 h-4 w-4" /> {{ $t('common.back') }}
    </button>
    <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <CheckCircle2 class="h-6 w-6 text-primary-600" />
      {{ $t('booking.confirm_title') }}
    </h2>

    <div class="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
      <h3 class="font-semibold text-gray-900 mb-4 border-b pb-2">{{ $t('booking.summary_title') }}</h3>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
        <div>
          <dt class="text-gray-500">{{ $t('booking.steps.service') }}</dt>
          <dd class="font-medium text-gray-900">{{ selectedService?.name }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">{{ $t('booking.steps.staff') }}</dt>
          <dd class="font-medium text-gray-900">{{ selectedStaff?.name }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">{{ $t('booking.date_label') }}</dt>
          <dd class="font-medium text-gray-900">{{ formatDateDisplay(selectedDate) }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">{{ $t('booking.time_label') }}</dt>
          <dd class="font-medium text-gray-900">{{ selectedTime }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">{{ $t('booking.price_label') }}</dt>
          <dd class="font-bold text-primary-600 text-lg">{{ settingsStore.formatPrice(selectedService?.price || 0) }}</dd>
        </div>
        <div class="sm:col-span-2 pt-2 mt-2 border-t border-gray-200">
          <dt class="text-gray-500">{{ $t('booking.location_label') }}</dt>
          <dd class="font-medium text-gray-900">{{ providerInfo?.business_name }}</dd>
          <dd class="text-gray-500 text-xs mt-1">{{ formatAddress(providerInfo) }}</dd>
          
          <div v-if="selectedAddressObject" class="mt-4 w-full h-48 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
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
      </dl>
    </div>

    <!-- Login Gate -->
    <div v-if="showLogin" class="mt-8 animate-in fade-in zoom-in duration-300 max-w-md mx-auto">
      <section class="booking-login-card">
        <header>
          <h3>Authentication Required</h3>
          <p>Please log in to finalize your booking</p>
        </header>
        <div>
          <LoginForm :embedded="true" :on-before-o-auth-redirect="saveBookingState" @success="emit('loginSuccess')" />
        </div>
      </section>
    </div>

    <!-- Final Form -->
    <form v-else @submit.prevent="emit('submit')" class="space-y-6">
      <div class="space-y-2">
        <label class="booking-field-label" for="notes">{{ $t('booking.notes_label') }}</label>
        <textarea
          id="notes"
          class="booking-notes-field"
          :value="notes"
          @input="emit('update:notes', ($event.target as HTMLTextAreaElement).value)"
          :placeholder="$t('booking.notes_placeholder')"
        ></textarea>
      </div>

      <div v-if="errorMessage" class="booking-error-alert" role="alert">
        <h3>Error</h3>
        <div class="booking-error-description">
          <span>{{ errorMessage }}</span>
          <button
            v-if="isLimitReached"
            type="button"
            class="booking-limit-button"
            @click="emit('go-to-bookings')"
          >
            {{ $t('nav.my_bookings') }}
          </button>
        </div>
      </div>

      <button type="submit" class="booking-submit-command" :disabled="loading">
        <LoadingSpinner v-if="loading" inline size="sm" class="mr-2" color="text-white" />
        {{ $t('booking.confirm_button') }}
      </button>
    </form>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.booking-back-command {
  @apply mb-4 inline-flex items-center rounded-md text-sm font-medium text-gray-600 transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2;
}

.booking-login-card {
  @apply rounded-xl border-2 border-primary-100 bg-white py-6 shadow-md;
}

.booking-login-card header {
  @apply px-6;
}

.booking-login-card h3 {
  @apply text-xl font-semibold leading-tight text-gray-950;
}

.booking-login-card p {
  @apply mt-1 text-sm text-gray-600;
}

.booking-login-card > div {
  @apply px-6 pt-6;
}

.booking-field-label {
  @apply flex items-center gap-2 text-sm font-medium leading-none text-gray-700;
}

.booking-notes-field {
  @apply flex min-h-16 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-950 shadow-sm transition-[border-color,box-shadow] outline-none placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm;
}

.booking-error-alert {
  @apply mb-6 grid gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900;
}

.booking-error-alert h3 {
  @apply text-sm font-semibold;
}

.booking-error-description {
  @apply flex flex-col gap-4;
}

.booking-limit-button {
  @apply inline-flex h-8 w-full items-center justify-center rounded-md border border-red-300 bg-white px-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200;
}

.booking-submit-command {
  @apply inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-8 text-sm font-bold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
}
</style>
