<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServiceStore } from '@/stores/useServiceStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useBookingFlow } from '@/composables/useBookingFlow'
import { useNotifications } from '@/composables/useNotifications'
import { useI18n } from 'vue-i18n'
import { Card } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-vue-next'

// Step Components
import BookingServiceStep from '@/components/booking/BookingServiceStep.vue'
import BookingStaffStep from '@/components/booking/BookingStaffStep.vue'
import BookingLocationStep from '@/components/booking/BookingLocationStep.vue'
import BookingDateTimeStep from '@/components/booking/BookingDateTimeStep.vue'
import BookingConfirmStep from '@/components/booking/BookingConfirmStep.vue'
import BookingSuccessCard from '@/components/booking/BookingSuccessCard.vue'

const route = useRoute()
const router = useRouter()
const serviceStore = useServiceStore()
const staffStore = useStaffStore()
const authStore = useAuthStore()
const { t } = useI18n()
const { errorMessage, showError, clearMessages } = useNotifications()

// Initialize booking flow
const booking = useBookingFlow()
const isLoading = ref(true)
const isAutoSubmitting = ref(false)

onMounted(async () => {
  try {
    // Check if we're returning from OAuth with pending booking state
    const wasRestored = booking.restoreBookingState()
    
    if (!wasRestored) {
      const providerId = route.query.provider as string
      const staffId = route.query.staff as string

      if (staffId) {
        const staffMember = await staffStore.fetchStaffMember(staffId)
        if (staffMember && staffMember.provider_id) {
          booking.selectedProviderId.value = staffMember.provider_id
          booking.selectedStaffId.value = staffMember.id
          await booking.fetchProviderInfo(staffMember.provider_id)
        }
      } else if (providerId) {
        booking.selectedProviderId.value = providerId
        await booking.fetchProviderInfo(providerId)
      }
      
      if (booking.selectedProviderId.value) {
        await serviceStore.fetchAllServices(booking.selectedProviderId.value)
      }
      await staffStore.fetchStaff()

      if (staffId && booking.filteredServices.value.length === 1) {
        booking.selectService(booking.filteredServices.value[0]!.id)
      }
    } else {
      // If restored, we already have the IDs. We just need to load the data for display/computation.
      if (booking.selectedProviderId.value) {
        await booking.fetchProviderInfo(booking.selectedProviderId.value)
        await serviceStore.fetchAllServices(booking.selectedProviderId.value)
        await staffStore.fetchStaff()
      }
    }

    // If we restored from pending state, auto-submit the booking
    if (wasRestored) {
      isAutoSubmitting.value = true

      try {
        // Wait for auth to be ready
        if (!authStore.isAuthenticated || authStore.loading) {
          await new Promise<void>(resolve => {
            const unwatch = authStore.$subscribe((_, state) => {
              if (state.user && !state.loading) {
                unwatch()
                resolve()
              }
            })
            if (authStore.user && !authStore.loading) {
              unwatch()
              resolve()
            }
          })
        }

        // Ensure service is available — re-select if computed didn't resolve
        if (!booking.selectedService.value && booking.selectedServiceId.value) {
          // Services may not be in filteredServices yet, try re-fetching
          if (booking.selectedProviderId.value) {
            await serviceStore.fetchAllServices(booking.selectedProviderId.value)
          }
          // Explicitly call selectService to trigger any setup logic
          booking.selectService(booking.selectedServiceId.value)
        }

        if (!booking.selectedService.value) {
          booking.resetBooking()
          showError('Failed to restore booking. Please try again.')
          isAutoSubmitting.value = false
          return
        }

        // Ensure customer profile exists
        if (!authStore.customer) {
          await authStore.ensureCustomerProfile()
        }
        if (!authStore.customer) {
          await authStore.fetchCustomerProfile()
        }

        if (!authStore.customer) {
          booking.resetBooking()
          showError('Failed to load your profile. Please try again.')
          isAutoSubmitting.value = false
          return
        }

        // Submit the booking
        await handleSubmit()

        // Stop the auto-submit spinner regardless of outcome
        // (if confirmed, the success step will take precedence anyway, 
        // but needs to be false if user decides to book another appointment later)
        isAutoSubmitting.value = false
      } catch (e) {
        isAutoSubmitting.value = false
      } finally {
        booking.finishRestoringState()
      }
    }
  } finally {
    isLoading.value = false
  }
})

async function handleSubmit() {
  clearMessages()
  await booking.submitBooking(showError, t)
}

async function handleLoginSuccess() {
  // Check if user has a complete profile (name and phone)
  const customer = authStore.customer
  if (!customer || !customer.name || !customer.phone) {
    // New user or incomplete profile - redirect to profile first
    // Save booking state so we can restore after profile completion
    booking.saveBookingState()
    router.push('/profile?redirect=/booking')
    return
  }
  
  // Existing user with complete profile - proceed with booking
  await handleSubmit()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50 p-4 md:p-8">
    <div class="max-w-4xl mx-auto">
      
      <!-- Provider Header -->
      <header v-if="booking.providerInfo.value" class="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
        <div v-if="booking.providerInfo.value.logo_url" class="mb-4">
          <img :src="booking.providerInfo.value.logo_url" :alt="booking.providerInfo.value.business_name" class="h-24 w-24 rounded-full mx-auto object-cover shadow-md border-4 border-white" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-2">{{ booking.providerInfo.value.business_name }}</h1>
        <p v-if="booking.providerInfo.value.description" class="text-lg text-gray-600 max-w-2xl mx-auto mb-2">{{ booking.providerInfo.value.description }}</p>
        <p class="text-sm text-gray-500">{{ $t('booking.subtitle') }}</p>
      </header>

      <!-- Confirmation Success -->
      <BookingSuccessCard
        v-if="booking.bookingConfirmed.value"
        :selected-service="booking.selectedService.value"
        :selected-staff="booking.selectedStaff.value"
        :confirmed-date="booking.confirmedDate.value"
        :confirmed-time="booking.confirmedTime.value"
        :provider-info="booking.providerInfo.value"
        :selected-address-object="booking.selectedAddressObject.value"
        :format-date-display="booking.formatDateDisplay"
        :format-address="booking.formatAddress"
        :get-map-url="booking.getMapUrl"
        :get-directions-url="booking.getDirectionsUrl"
        @reset="booking.resetBooking"
      />

      <!-- Auto-submitting after OAuth restore -->
      <div v-else-if="isAutoSubmitting || isLoading" class="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
        <div class="h-8 w-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p v-if="isAutoSubmitting" class="text-lg font-medium text-gray-700">{{ $t('booking.completing') }}</p>
      </div>

      <!-- Booking Flow -->
      <div v-else class="max-w-3xl mx-auto">
        <!-- Progress Steps -->
        <nav aria-label="Progress" class="mb-8">
          <ol role="list" class="grid grid-cols-4 w-full relative">
            <li v-for="step in 4" :key="step" class="relative flex justify-center text-center">
              <div 
                class="absolute top-1/2 left-1/2 w-full -translate-y-1/2 pointer-events-none" 
                v-if="step < 4"
              >
                <div class="h-0.5 w-full bg-gray-200"></div>
              </div>
              
              <a href="#" class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white hover:bg-gray-50"
                :class="[
                  step < booking.currentStep.value ? 'border-primary-600 bg-primary-600' : '',
                  step === Math.floor(booking.currentStep.value) ? 'border-primary-600' : 'border-gray-300'
                ]"
                @click.prevent="booking.currentStep.value > step ? booking.currentStep.value = step : null"
              >
                <CheckCircle2 v-if="step < booking.currentStep.value" class="h-5 w-5 text-white" aria-hidden="true" />
                <span v-else class="h-2.5 w-2.5 rounded-full" :class="step === Math.floor(booking.currentStep.value) ? 'bg-primary-600' : 'bg-transparent'" aria-hidden="true" />
              </a>
            </li>
          </ol>
        </nav>

        <!-- Dynamic Step Content -->
        <Card class="shadow-lg border-t-4 border-t-primary-600">
          <div class="p-6 md:p-8">
            <!-- Step 1: Service Selection -->
            <BookingServiceStep
              v-if="booking.currentStep.value === 1"
              :services="booking.filteredServices.value"
              :selected-service-id="booking.selectedServiceId.value"
              :loading="serviceStore.loading || isLoading"
              @select="booking.selectService"
              @confirm="booking.confirmService"
            />

            <!-- Step 2: Staff Selection -->
            <BookingStaffStep
              v-if="booking.currentStep.value === 2"
              :staff="booking.selectedService.value?.staff || []"
              :selected-staff-id="booking.selectedStaffId.value"
              @select="booking.selectStaff"
              @confirm="booking.confirmStaff"
              @back="booking.goBack"
            />

            <!-- Step 2.5: Location Selection -->
            <BookingLocationStep
              v-if="booking.currentStep.value === 2.5"
              :addresses="booking.staffAddresses.value"
              :selected-address-id="booking.selectedAddressId.value"
              :get-map-url="booking.getMapUrl"
              :get-directions-url="booking.getDirectionsUrl"
              @select="booking.selectBranch"
              @confirm="booking.confirmLocation"
              @back="() => booking.currentStep.value = 2"
            />

            <!-- Step 3: Date & Time -->
            <BookingDateTimeStep
              v-if="booking.currentStep.value === 3"
              :selected-service="booking.selectedService.value"
              :selected-staff-id="booking.selectedStaffId.value"
              :available-dates="booking.availableDates.value"
              :selected-date="booking.selectedDate.value"
              :available-slots="booking.availableSlots.value"
              :selected-time="booking.selectedTime.value"
              :loading-slots="booking.loadingSlots.value"
              :loading-dates="booking.loadingDates.value"
              :is-date-available="booking.isDateAvailable"
              :get-date-status="booking.getDateStatus"
              @update:selected-date="booking.selectedDate.value = $event"
              @update:selected-time="booking.selectedTime.value = $event"
              @confirm="booking.selectDateTime"
              @back="booking.goBack"
            />

            <!-- Step 4: Confirmation -->
            <BookingConfirmStep
              v-if="booking.currentStep.value === 4"
              :selected-service="booking.selectedService.value"
              :selected-staff="booking.selectedStaff.value"
              :selected-date="booking.selectedDate.value"
              :selected-time="booking.selectedTime.value"
              :provider-info="booking.providerInfo.value"
              :selected-address-object="booking.selectedAddressObject.value"
              :notes="booking.notes.value"
              :show-login="booking.showLogin.value"
              :error-message="errorMessage"
              :loading="booking.isSubmitting.value"
              :format-date-display="booking.formatDateDisplay"
              :format-address="booking.formatAddress"
              :get-map-url="booking.getMapUrl"
              :get-directions-url="booking.getDirectionsUrl"
              :save-booking-state="booking.saveBookingState"
              @update:notes="booking.notes.value = $event"
              @submit="handleSubmit"
              @back="booking.goBack"
              @login-success="handleLoginSuccess"
            />
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
