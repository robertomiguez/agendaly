<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAppointmentStore } from '../stores/useAppointmentStore'
import { useServiceStore } from '../stores/useServiceStore'
import { useStaffStore } from '../stores/useStaffStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import type { Appointment } from '../types'
import { useI18n } from 'vue-i18n'

import { useNotifications } from '../composables/useNotifications'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

const appointmentStore = useAppointmentStore()
const serviceStore = useServiceStore()
const staffStore = useStaffStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const { showSuccess, showError } = useNotifications()

const viewMode = ref<'day' | 'week'>('week')
const currentDate = ref(new Date())
const selectedAppointment = ref<Appointment | null>(null)
const showAppointmentModal = ref(false)

// Confirmation State
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmActionType = ref<'cancel' | 'delete' | null>(null)
const pendingAppointmentId = ref<string | null>(null)

onMounted(async () => {
  await serviceStore.fetchAllServices()
  await staffStore.fetchStaff()
  await loadAppointments()
})

async function loadAppointments() {
  const start = viewMode.value === 'day' 
    ? format(currentDate.value, 'yyyy-MM-dd')
    : format(startOfWeek(currentDate.value), 'yyyy-MM-dd')
  
  const end = viewMode.value === 'day'
    ? format(currentDate.value, 'yyyy-MM-dd')
    : format(endOfWeek(currentDate.value), 'yyyy-MM-dd')
  
  await appointmentStore.fetchAppointments(start, end)
}

const weekDays = computed(() => {
  if (viewMode.value === 'day') {
    return [currentDate.value]
  }
  return eachDayOfInterval({
    start: startOfWeek(currentDate.value),
    end: endOfWeek(currentDate.value)
  })
})

function getAppointmentsForDate(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd')
  return appointmentStore.appointments
    .filter(apt => apt.appointment_date === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}

function getServiceName(serviceId: string) {
  return serviceStore.services.find(s => s.id === serviceId)?.name || 'Unknown Service'
}

function getStaffName(staffId: string) {
  return staffStore.staff.find(s => s.id === staffId)?.name || 'Unknown Staff'
}

function viewAppointment(appointment: Appointment) {
  selectedAppointment.value = appointment
  showAppointmentModal.value = true
}

function openCancelConfirm(id: string) {
  pendingAppointmentId.value = id
  confirmActionType.value = 'cancel'
  confirmTitle.value = t('calendar.cancel_confirm_title')
  confirmMessage.value = t('calendar.cancel_confirm_msg')
  showConfirmModal.value = true
}

function openDeleteConfirm(id: string) {
  pendingAppointmentId.value = id
  confirmActionType.value = 'delete'
  confirmTitle.value = t('calendar.delete_confirm_title')
  confirmMessage.value = t('calendar.delete_confirm_msg')
  showConfirmModal.value = true
}

async function handleConfirmAction() {
  if (!pendingAppointmentId.value || !confirmActionType.value) return

  try {
    if (confirmActionType.value === 'cancel') {
      await appointmentStore.updateAppointment(pendingAppointmentId.value, { status: 'cancelled' })
      showSuccess(t('calendar.cancel_success'))
    } else if (confirmActionType.value === 'delete') {
      await appointmentStore.deleteAppointment(pendingAppointmentId.value)
      showSuccess(t('calendar.delete_success'))
    }
    showAppointmentModal.value = false
  } catch (e) {
    console.error('Error processing appointment action:', e)
    showError(t('calendar.action_failed'))
  } finally {
    showConfirmModal.value = false
    pendingAppointmentId.value = null
    confirmActionType.value = null
  }
}

function previousPeriod() {
  currentDate.value = viewMode.value === 'day' 
    ? subDays(currentDate.value, 1)
    : subDays(currentDate.value, 7)
  loadAppointments()
}

function nextPeriod() {
  currentDate.value = viewMode.value === 'day'
    ? addDays(currentDate.value, 1)
    : addDays(currentDate.value, 7)
  loadAppointments()
}

function goToToday() {
  currentDate.value = new Date()
  loadAppointments()
}

function getStatusColor(status: string) {
  const colors = {
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
    'no-show': 'bg-gray-100 text-gray-800 border-gray-200'
  }
  return colors[status as keyof typeof colors] || colors.confirmed
}

function formatTime(time: string) {
  return time.substring(0, 5) // HH:MM from HH:MM:SS
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('calendar.title') }}</h1>
          <p class="text-gray-600">{{ $t('calendar.subtitle') }}</p>
        </div>

        <!-- View Toggle -->
        <div class="flex gap-2">
          <button
            @click="viewMode = 'day'"
            :class="[
              'px-4 py-2 rounded-lg font-medium transition-colors',
              viewMode === 'day'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            ]"
          >
            {{ $t('calendar.day') }}
          </button>
          <button
            @click="viewMode = 'week'; loadAppointments()"
            :class="[
              'px-4 py-2 rounded-lg font-medium transition-colors',
              viewMode === 'week'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            ]"
          >
            {{ $t('calendar.week') }}
          </button>
        </div>
      </div>

      <!-- Navigation -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              @click="previousPeriod"
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <button
              @click="goToToday"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              {{ $t('calendar.today') }}
            </button>
            <button
              @click="nextPeriod"
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>

          <h2 class="text-xl font-semibold text-gray-900">
            {{ viewMode === 'day' 
              ? currentDate.toLocaleDateString(settingsStore.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : `${startOfWeek(currentDate).toLocaleDateString(settingsStore.language, { month: 'short', day: 'numeric' })} - ${endOfWeek(currentDate).toLocaleDateString(settingsStore.language, { month: 'short', day: 'numeric', year: 'numeric' })}`
            }}
          </h2>

          <div class="w-32"></div> <!-- Spacer for centering -->
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div :class="['grid', viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1']">
          <div
            v-for="day in weekDays"
            :key="day.toISOString()"
            class="border-r last:border-r-0"
          >
            <!-- Day Header -->
           <div :class="[
              'p-4 border-b',
              isSameDay(day, new Date()) ? 'bg-primary-50' : 'bg-gray-50'
            ]">
              <div class="text-center">
                <div class="text-sm font-medium text-gray-600">{{ format(day, 'EEE') }}</div>
                <div :class="[
                  'text-2xl font-bold mt-1',
                  isSameDay(day, new Date()) ? 'text-primary-600' : 'text-gray-900'
                ]">
                  {{ format(day, 'd') }}
                </div>
              </div>
            </div>

            <!-- Appointments -->
            <div class="p-3 min-h-[400px]">
              <div class="space-y-2">
                <button
                  v-for="appointment in getAppointmentsForDate(day)"
                  :key="appointment.id"
                  @click="viewAppointment(appointment)"
                  :class="[
                    'w-full text-left p-3 rounded-lg border-2 hover:shadow-md transition-all',
                    getStatusColor(appointment.status)
                  ]"
                >
                  <div class="font-semibold text-sm">{{ formatTime(appointment.start_time) }}</div>
                  <div class="text-sm font-medium mt-1">{{ getServiceName(appointment.service_id) }}</div>
                  <div class="text-xs mt-1">{{ appointment.customer?.profile?.name || 'Unknown Customer' }}</div>
                </button>
                
                <div v-if="getAppointmentsForDate(day).length === 0" class="text-center py-12 text-gray-400 text-sm">
                  {{ $t('calendar.no_appointments') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Appointment Detail Modal -->
    <div v-if="showAppointmentModal && selectedAppointment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-2xl font-bold text-gray-900">{{ $t('calendar.details_title') }}</h2>
            <button
              @click="showAppointmentModal = false"
              class="text-gray-400 hover:text-gray-600"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <span class="text-sm text-gray-500">{{ $t('booking.steps.service') }}</span>
              <p class="font-semibold text-gray-900">{{ getServiceName(selectedAppointment.service_id) }}</p>
            </div>

            <div>
              <span class="text-sm text-gray-500">Provider</span>
              <p class="font-semibold text-gray-900">{{ getStaffName(selectedAppointment.staff_id) }}</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-sm text-gray-500">Date</span>
                <p class="font-semibold text-gray-900">{{ new Date(selectedAppointment.appointment_date).toLocaleDateString(settingsStore.language, { month: 'short', day: 'numeric', year: 'numeric' }) }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-500">Time</span>
                <p class="font-semibold text-gray-900">{{ formatTime(selectedAppointment.start_time) }} - {{ formatTime(selectedAppointment.end_time) }}</p>
              </div>
            </div>

            <div>
              <span class="text-sm text-gray-500">Customer</span>
              <p class="font-semibold text-gray-900">{{ selectedAppointment.customer?.profile?.name || 'Unknown Customer' }}</p>
              <p class="text-sm text-gray-600">{{ selectedAppointment.customer?.profile?.email }}</p>
              <p class="text-sm text-gray-600">{{ selectedAppointment.customer?.profile?.phone }}</p>
            </div>

            <div v-if="selectedAppointment.notes">
              <span class="text-sm text-gray-500">{{ $t('booking.notes_label') }}</span>
              <p class="text-gray-900">{{ selectedAppointment.notes }}</p>
            </div>

            <div>
              <span class="text-sm text-gray-500">Status</span>
              <div class="mt-1">
                <span :class="['inline-block px-3 py-1 rounded-full text-sm font-medium', getStatusColor(selectedAppointment.status)]">
                  {{ $t(`status.${selectedAppointment.status}`) }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex gap-3 mt-6 pt-6 border-t">
            <button
              v-if="selectedAppointment.status !== 'cancelled'"
              @click="openCancelConfirm(selectedAppointment.id)"
              class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {{ $t('calendar.cancel_appointment') }}
            </button>
            <button
              @click="openDeleteConfirm(selectedAppointment.id)"
              class="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {{ $t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :isDestructive="true"
      @close="showConfirmModal = false"
      @confirm="handleConfirmAction"
    />
  </div>
</template>
