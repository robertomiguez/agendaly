<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServiceStore } from '@/stores/useServiceStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useBookingFlow } from '@/composables/useBookingFlow'
import { useNotifications } from '@/composables/useNotifications'
import { useI18n } from 'vue-i18n'
import { CheckCircle2 } from 'lucide-vue-next'
import BackButton from '@/components/common/BackButton.vue'

// Step Components
import BookingServiceStep from '@/components/booking/BookingServiceStep.vue'
import BookingStaffStep from '@/components/booking/BookingStaffStep.vue'
import BookingLocationStep from '@/components/booking/BookingLocationStep.vue'
import BookingDateTimeStep from '@/components/booking/BookingDateTimeStep.vue'
import BookingConfirmStep from '@/components/booking/BookingConfirmStep.vue'
import BookingSuccessCard from '@/components/booking/BookingSuccessCard.vue'
import AdBanner from '@/components/common/AdBanner.vue'

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
const bookingBackPath = computed(() => {
  const providerSlug = route.params.providerSlug as string | undefined
  return providerSlug ? `/${providerSlug}` : '/'
})
const isStaffScopedBooking = computed(() => {
  return !!route.params.staffSlug || !!route.query.staff
})

function resetProviderScopedStaffChoice() {
  if (isStaffScopedBooking.value) return

  booking.selectedStaffId.value = ''
  booking.selectedAddressId.value = ''
  booking.staffAddresses.value = []
  booking.selectedTime.value = ''
}

function returnToServiceStep() {
  resetProviderScopedStaffChoice()
  booking.currentStep.value = 1
}

function handleStaffBack() {
  returnToServiceStep()
}

function handleLocationBack() {
  returnToServiceStep()
}

function handleDateTimeBack() {
  returnToServiceStep()
}

onMounted(async () => {
  try {
    // Check if we're returning from OAuth with pending booking state
    const wasRestored = booking.restoreBookingState()
    
    if (!wasRestored) {
      const providerId = route.query.provider as string
      const staffId = route.query.staff as string
      const serviceId = route.query.service as string
      const providerSlug = route.params.providerSlug as string
      const staffSlug = route.params.staffSlug as string
      const serviceSlug = route.params.serviceSlug as string

      if (providerSlug && staffSlug) {
        const staffMember = await staffStore.fetchStaffMemberBySlug(providerSlug, staffSlug)
        if (staffMember && staffMember.provider_id) {
          booking.selectedProviderId.value = staffMember.provider_id
          booking.selectedStaffId.value = staffMember.id
          await booking.fetchProviderInfo(staffMember.provider_id)
        }
      } else if (staffId) {
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

      if (serviceSlug) {
        const matchedService = booking.filteredServices.value.find(service => service.slug === serviceSlug && service.active)
        if (matchedService) {
          booking.selectService(matchedService.id)
          await booking.confirmService()
        }
      } else if (serviceId && booking.filteredServices.value.some(service => service.id === serviceId && service.active)) {
        booking.selectService(serviceId)
        await booking.confirmService()
      } else if ((staffId || staffSlug) && booking.filteredServices.value.length === 1) {
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
          await authStore.ensureProfileAndCustomer()
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
        const booked = await handleSubmit()
        if (!booked && booking.isLimitReached.value) {
          router.push('/my-bookings?bookingLimitReached=1')
          return
        }

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

  if (authStore.isAuthenticated) {
    if (!authStore.profile?.name || !authStore.profile?.phone) {
      booking.saveBookingState()
      router.push('/profile?redirect=/booking')
      return false
    }

    if (!authStore.customer) {
      await authStore.ensureProfileAndCustomer()
    }
  }

  return await booking.submitBooking(showError, t)
}

async function handleLoginSuccess() {
  // Check if user has a complete profile (name and phone)
  const profile = authStore.profile
  if (!profile || !profile.name || !profile.phone) {
    // New user or incomplete profile - redirect to profile first
    // Save booking state so we can restore after profile completion
    booking.saveBookingState()
    router.push('/profile?redirect=/booking')
    return
  }
  
  // Existing user with complete profile - proceed with booking
  const booked = await handleSubmit()
  if (!booked && booking.isLimitReached.value) {
    router.push('/my-bookings?bookingLimitReached=1')
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50 p-4 md:p-8">
    <div class="max-w-4xl mx-auto">
      <BackButton :to="bookingBackPath" />
      
      <!-- Provider Header -->
      <header v-if="booking.providerInfo.value" class="booking-header">
        <div class="booking-header-identities">
          <div class="booking-provider-identity">
            <img
              v-if="booking.providerInfo.value.logo_url"
              :src="booking.providerInfo.value.logo_url"
              :alt="booking.providerInfo.value.business_name"
              class="booking-provider-avatar"
            />
            <div v-else class="booking-provider-avatar booking-avatar-fallback">
              {{ booking.providerInfo.value.business_name.slice(0, 2).toUpperCase() }}
            </div>

            <div class="booking-identity-text">
              <p class="booking-identity-label">{{ $t('booking.with_provider') }}</p>
              <h1>{{ booking.providerInfo.value.business_name }}</h1>
            </div>
          </div>

          <div v-if="booking.selectedStaff.value" class="booking-staff-identity">
            <img
              v-if="booking.selectedStaff.value.photo_url"
              :src="booking.selectedStaff.value.photo_url"
              :alt="booking.selectedStaff.value.name"
              class="booking-staff-avatar"
            />
            <div v-else class="booking-staff-avatar booking-avatar-fallback">
              {{ booking.selectedStaff.value.name.charAt(0).toUpperCase() }}
            </div>

            <div class="booking-identity-text">
              <p class="booking-identity-label">{{ $t('booking.steps.staff') }}</p>
              <p class="booking-staff-name">{{ booking.selectedStaff.value.name }}</p>
            </div>
          </div>
        </div>

        <p v-if="booking.providerInfo.value.description" class="booking-description">{{ booking.providerInfo.value.description }}</p>
        <p class="booking-subtitle">{{ $t('booking.subtitle') }}</p>
      </header>

      <!-- Confirmation Success -->
      <template v-if="booking.bookingConfirmed.value">
        <BookingSuccessCard
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
        <AdBanner placement="booking" />
      </template>

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
        <section class="booking-step-card">
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
              @back="handleStaffBack"
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
              @back="handleLocationBack"
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
              @back="handleDateTimeBack"
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
              :is-limit-reached="booking.isLimitReached.value"
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
              @go-to-bookings="router.push('/my-bookings')"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";

.booking-step-card {
  @apply rounded-xl border border-t-4 border-gray-200 border-t-primary-600 bg-white shadow-lg;
}

.booking-header {
  @apply mb-6 animate-in fade-in slide-in-from-top-4 duration-500;
}

.booking-header-identities {
  @apply mx-auto flex max-w-2xl items-center justify-center gap-5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:gap-6;
}

.booking-provider-identity,
.booking-staff-identity {
  @apply flex min-w-0 flex-col items-center text-center sm:flex-row sm:text-left;
}

.booking-provider-identity {
  @apply gap-3;
}

.booking-staff-identity {
  @apply gap-2 border-l border-gray-200 pl-5 sm:pl-6;
}

.booking-provider-avatar {
  @apply h-12 w-12 flex-shrink-0 rounded-full border-2 border-white object-cover shadow-sm;
}

.booking-staff-avatar {
  @apply h-12 w-12 flex-shrink-0 rounded-full border-2 border-white object-cover shadow-sm;
}

.booking-avatar-fallback {
  @apply flex items-center justify-center bg-primary-100 text-sm font-bold text-primary-700;
}

.booking-identity-text {
  @apply min-w-0 text-center sm:text-left;
}

.booking-identity-label {
  @apply truncate text-xs font-semibold text-gray-500;
}

.booking-identity-text h1,
.booking-staff-name {
  @apply truncate text-base font-bold text-gray-900 sm:text-lg;
}

.booking-description {
  @apply mx-auto mt-3 max-w-2xl truncate text-center text-sm text-gray-600;
}

.booking-subtitle {
  @apply mt-1 text-center text-xs text-gray-500;
}
</style>
