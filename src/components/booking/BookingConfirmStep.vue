<script setup lang="ts">
import { useSettingsStore } from '@/stores/useSettingsStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
    <Button variant="ghost" class="mb-4 pl-0 hover:bg-transparent hover:text-primary-600" @click="emit('back')">
      <ArrowLeft class="mr-2 h-4 w-4" /> {{ $t('common.back') }}
    </Button>
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
      <Card class="border-2 border-primary-100 shadow-md">
        <CardHeader>
          <CardTitle class="text-xl">Authentication Required</CardTitle>
          <CardDescription>Please log in to finalize your booking</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm :embedded="true" :on-before-o-auth-redirect="saveBookingState" @success="emit('loginSuccess')" />
        </CardContent>
      </Card>
    </div>

    <!-- Final Form -->
    <form v-else @submit.prevent="emit('submit')" class="space-y-6">
      <div class="space-y-2">
        <Label for="notes">{{ $t('booking.notes_label') }}</Label>
        <Textarea
          id="notes"
          :model-value="notes"
          @update:model-value="emit('update:notes', String($event))"
          :placeholder="$t('booking.notes_placeholder')"
        />
      </div>

      <Alert v-if="errorMessage" variant="destructive" class="booking-error-alert">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription class="booking-error-description">
          <span>{{ errorMessage }}</span>
          <Button
            v-if="isLimitReached"
            variant="outline"
            size="sm"
            class="booking-limit-button"
            @click="emit('go-to-bookings')"
          >
            {{ $t('nav.my_bookings') }}
          </Button>
        </AlertDescription>
      </Alert>

      <Button type="submit" size="lg" class="w-full font-bold" :disabled="loading">
        <LoadingSpinner v-if="loading" inline size="sm" class="mr-2" color="text-white" />
        {{ $t('booking.confirm_button') }}
      </Button>
    </form>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.booking-error-alert {
  @apply mb-6;
}

.booking-error-description {
  @apply flex flex-col gap-4;
}

.booking-limit-button {
  @apply w-full bg-white text-destructive border-destructive hover:bg-destructive/10 font-bold;
}
</style>
