<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isFuture, parseISO, isPast } from 'date-fns'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppointmentStore } from '../stores/useAppointmentStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useNotifications } from '../composables/useNotifications'
import { useI18n } from 'vue-i18n'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appointmentStore = useAppointmentStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const { errorMessage, showSuccess, showError } = useNotifications()

const activeTab = ref<'upcoming' | 'past'>('upcoming')
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingCancelId = ref<string | null>(null)

// Computed for appointments
const upcomingAppointments = computed(() => {
  return appointmentStore.appointments
    .filter(apt => {
      // Include today's future appointments or later dates
      // Simple check: appointment_date >= today
      const aptDate = parseISO(apt.appointment_date + 'T' + apt.start_time)
      return isFuture(aptDate) && apt.status !== 'cancelled'
    })
    .sort((a, b) => {
      // Sort ascending (soonest first)
      const dateA = new Date(a.appointment_date + 'T' + a.start_time)
      const dateB = new Date(b.appointment_date + 'T' + b.start_time)
      return dateA.getTime() - dateB.getTime()
    })
})

const pastAppointments = computed(() => {
  return appointmentStore.appointments
    .filter(apt => {
      const aptDate = parseISO(apt.appointment_date + 'T' + apt.start_time)
      return isPast(aptDate) || apt.status === 'cancelled' || apt.status === 'completed'
    })
    .sort((a, b) => {
      // Sort descending (most recent first)
      const dateA = new Date(a.appointment_date + 'T' + a.start_time)
      const dateB = new Date(b.appointment_date + 'T' + b.start_time)
      return dateB.getTime() - dateA.getTime()
    })
})

const filteredAppointments = computed(() => {
  return activeTab.value === 'upcoming' 
    ? upcomingAppointments.value 
    : pastAppointments.value
})

onMounted(async () => {
  if (!authStore.customer) {
    router.push('/login')
    return
  }

  if (route.query.bookingLimitReached === '1') {
    showError(t('booking.limit_reached'))
    const { bookingLimitReached, ...query } = route.query
    router.replace({ path: '/my-bookings', query })
  }

  await appointmentStore.fetchCustomerAppointments(authStore.customer.id)
})

function formatTime(time: string) {
  return time.substring(0, 5)
}



function getStatusColor(status: string) {
  const colors = {
    confirmed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
    'no-show': 'bg-gray-100 text-gray-800'
  }
  return colors[status as keyof typeof colors] || colors.confirmed
}

function openCancelModal(id: string) {
  pendingCancelId.value = id
  confirmTitle.value = t('my_bookings.cancel_confirm_title')
  confirmMessage.value = t('my_bookings.cancel_confirm_msg')
  showConfirmModal.value = true
}

async function handleCancel() {
  if (!pendingCancelId.value) return

  try {
    await appointmentStore.updateAppointment(pendingCancelId.value, { status: 'cancelled' })
    showSuccess(t('my_bookings.cancel_success'))
    // Refresh list
    if (authStore.customer) {
      await appointmentStore.fetchCustomerAppointments(authStore.customer.id)
    }
  } catch (e) {
    console.error('Error cancelling booking:', e)
    showError(t('my_bookings.cancel_failed'))
  } finally {
    showConfirmModal.value = false
    pendingCancelId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('my_bookings.title') }}</h1>
      <p class="text-gray-600 mb-8">{{ $t('my_bookings.subtitle') }}</p>

      <div v-if="errorMessage" class="bookings-alert" role="alert">{{ errorMessage }}</div>

      <!-- Tabs -->
      <div class="bg-white rounded-lg shadow-sm mb-6">
        <div class="flex border-b border-gray-200">
          <button
            @click="activeTab = 'upcoming'"
            class="flex-1 py-4 text-center font-medium text-sm transition-colors relative"
            :class="activeTab === 'upcoming' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'"
          >
            {{ $t('my_bookings.upcoming') }}
            <span 
              v-if="activeTab === 'upcoming'" 
              class="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600"
            ></span>
          </button>
          <button
            @click="activeTab = 'past'"
            class="flex-1 py-4 text-center font-medium text-sm transition-colors relative"
            :class="activeTab === 'past' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'"
          >
            {{ $t('my_bookings.past') }}
            <span 
              v-if="activeTab === 'past'" 
              class="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600"
            ></span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <LoadingSpinner v-if="appointmentStore.loading" :text="$t('my_bookings.loading')" />

      <!-- Empty State -->
      <div v-else-if="filteredAppointments.length === 0" class="text-center py-16 bg-white rounded-lg shadow-sm">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900">{{ $t('my_bookings.no_upcoming') }}</h3>
        <p class="text-gray-500 mt-2">
          {{ activeTab === 'upcoming' ? $t('my_bookings.no_upcoming') : $t('my_bookings.no_past') }}
        </p>
      </div>

      <!-- Booking List -->
      <div v-else class="space-y-4">
        <div 
          v-for="booking in filteredAppointments" 
          :key="booking.id"
          class="bg-white rounded-lg shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div class="flex flex-col sm:flex-row justify-between gap-4">
            <!-- Left: Info -->
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span 
                  v-if="!(activeTab === 'past' && booking.status === 'confirmed')"
                  :class="['px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide', getStatusColor(booking.status)]"
                >
                  {{ $t(`status.${booking.status}`) }}
                </span>
                <span class="text-sm text-gray-500">
                  {{ parseISO(booking.appointment_date).toLocaleDateString(settingsStore.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }}
                </span>
              </div>
              
              <h3 class="text-xl font-bold text-gray-900 mb-1">
                {{ booking.service?.name || 'Unknown Service' }}
              </h3>
              
              <div class="flex items-center gap-2 text-gray-600 mb-4">
                <router-link
                  v-if="booking.service?.provider?.slug"
                  :to="`/${booking.service.provider.slug}`"
                  class="booking-provider-link"
                >
                  {{ booking.service?.provider?.business_name || 'Provider' }}
                </router-link>
                <span v-else class="font-medium text-primary-700">
                  {{ booking.service?.provider?.business_name || 'Provider' }}
                </span>
                <span class="text-gray-300">•</span>
                <span>{{ $t('booking.staff_label', { name: booking.staff?.name || 'Staff' }) }}</span>
              </div>

              <div class="grid grid-cols-2 gap-4 text-sm max-w-sm">
                <div>
                  <span class="block text-gray-500">Time</span>
                  <span class="font-medium text-gray-900">
                    {{ formatTime(booking.start_time) }} - {{ formatTime(booking.end_time) }}
                  </span>
                </div>
                <div>
                  <span class="block text-gray-500">Price</span>
                  <span class="font-medium text-gray-900">
                    {{ settingsStore.formatPrice(booking.booked_price || 0, booking.booked_price_currency || booking.service?.provider?.currency) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Right: Actions -->
            <div class="flex flex-col justify-center items-end gap-3 min-w-[120px]">
              <div v-if="booking.service?.provider?.logo_url" class="hidden sm:block w-12 h-12 rounded-full overflow-hidden bg-gray-100 mb-auto">
                <img :src="booking.service.provider.logo_url" alt="Logo" class="w-full h-full object-cover">
              </div>

              <button
                v-if="activeTab === 'upcoming' && booking.status !== 'cancelled'"
                @click="openCancelModal(booking.id)"
                class="w-full sm:w-auto text-red-600 hover:bg-red-50 hover:text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-red-200"
              >
                {{ $t('my_bookings.cancel_booking') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :isDestructive="true"
      @close="showConfirmModal = false"
      @confirm="handleCancel"
    />
  </div>
</template>

<style scoped>
@reference "../style.css";

.bookings-alert {
  @apply mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800;
}

.booking-provider-link {
  @apply rounded-md font-semibold text-primary-700 underline underline-offset-4 transition-colors hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
}
</style>
