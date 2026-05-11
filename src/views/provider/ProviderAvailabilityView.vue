<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useAppointmentStore } from '../../stores/useAppointmentStore'
import { useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import * as staffService from '../../services/staffService'
import * as availabilityService from '../../services/availabilityService'
import { useNotifications } from '../../composables/useNotifications'

import { useI18n } from 'vue-i18n'
import ConfirmationModal from '../../components/common/ConfirmationModal.vue'
import LoadingSpinner from '../../components/common/LoadingSpinner.vue'
import SubmitButton from '../../components/common/SubmitButton.vue'
import BackButton from '../../components/common/BackButton.vue'
import { useDays } from '../../composables/useDays'
import type { Availability, Staff } from '../../types'

const authStore = useAuthStore()
const appointmentStore = useAppointmentStore()
const router = useRouter()
const { t } = useI18n()

const { daysOfWeek } = useDays()


const staff = ref<Staff[]>([])
const selectedStaffId = ref<string>('')
const weeklySchedule = ref<Availability[]>([])
const originalSchedule = ref<Availability[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const { successMessage, errorMessage, showSuccess, showError, clearMessages } = useNotifications()

// Confirmation logic
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingSave = ref(false)
onMounted(async () => {
  if (!authStore.provider) {
    router.push('/booking')
    return
  }
  await fetchStaff()
})

async function fetchStaff() {
  if (!authStore.provider?.id) {
    isLoading.value = false
    return
  }
  try {
    const data = await staffService.fetchStaff(authStore.provider.id)
    const activeStaff = data.filter(s => s.active)
    
    staff.value = activeStaff || []
    if (staff.value.length > 0) {
      const firstStaff = staff.value[0]
      if (firstStaff) {
        selectedStaffId.value = firstStaff.id
        await fetchSchedule()
      } else {
        isLoading.value = false
      }
    } else {
      isLoading.value = false
    }
  } catch (e) {
    console.error('Error fetching staff:', e)
    isLoading.value = false
  }
}

function onStaffChange() {
  clearMessages()
  fetchSchedule()
}

async function fetchSchedule() {
  if (!selectedStaffId.value) return
  isLoading.value = true
  
  try {
    const availData = await availabilityService.fetchAvailability(selectedStaffId.value)

    // Map through 7 days to ensure a complete UI, using existing data or a fallback
    weeklySchedule.value = daysOfWeek.value.map((_, index: number) => {
      const existing = availData.find(a => a.day_of_week === index)
      if (existing) return existing
      
      const isFriToSat = index >= 5 && index <= 6
      
      return {
        id: `temp-${index}`,
        staff_id: selectedStaffId.value,
        provider_id: authStore.provider?.id || '',
        day_of_week: index,
        start_time: isFriToSat ? '08:00' : '09:00',
        end_time: isFriToSat ? '20:00' : '19:00',
        is_available: false
      }
    })

    originalSchedule.value = JSON.parse(JSON.stringify(weeklySchedule.value))
  } catch (e) {
    console.error('Error fetching schedule:', e)
    showError(t('provider.availability.save_error'))
  } finally {
    isLoading.value = false
  }
}

const conflictList = ref<{day: string, count: number, samples: string[]}[]>([])

async function checkForConflicts(): Promise<boolean> {
  const futureAppointments = await appointmentStore.fetchFutureAppointments(selectedStaffId.value)
  if (!futureAppointments.length) return false

  const bookingsByDay = new Map<string, any[]>()
  
  for (const appt of futureAppointments) {
    const dateStr = appt.appointment_date
    if (!dateStr) continue 
    
    const date = parseISO(dateStr)
    const dayIndex = date.getDay()
    const dayName = daysOfWeek.value[dayIndex]?.label
    
    if (!dayName) continue
    
    if (!bookingsByDay.has(dayName)) {
      bookingsByDay.set(dayName, [])
    }
    bookingsByDay.get(dayName)?.push(appt)
  }

  const conflicts: {day: string, count: number, samples: string[]}[] = []

  for (const slot of weeklySchedule.value) {
    const dayName = daysOfWeek.value[slot.day_of_week]?.label
    if (!dayName) continue
    const originalSlot = originalSchedule.value.find(s => s.day_of_week === slot.day_of_week)
    
    if (!slot.is_available && originalSlot && originalSlot.is_available) {
       const bookings = bookingsByDay.get(dayName)
       if (bookings && bookings.length > 0) {
         conflicts.push({
           day: dayName,
           count: bookings.length,
           samples: bookings.slice(0, 3).map(a => {
             const d = a.appointment_date ? format(parseISO(a.appointment_date), 'MMM d') : 'Unknown Date'
             const t = a.start_time ? a.start_time.slice(0, 5) : '??:??'
             return `${d} @ ${t}`
           })
         })
       }
    }
  }

  if (conflicts.length > 0) {
    conflictList.value = conflicts
    confirmTitle.value = t('provider.availability.conflict_title')
    confirmMessage.value = t('provider.availability.conflict_msg')
    
    pendingSave.value = true
    showConfirmModal.value = true
    return true
  }
  
  return false
}

async function handleConfirmSave() {
  showConfirmModal.value = false
  if (pendingSave.value) {
    await performSave()
    pendingSave.value = false
  }
}

async function handleCloseModal() {
  showConfirmModal.value = false
  if (pendingSave.value) {
    pendingSave.value = false
    await fetchSchedule()
  }
}

async function saveSchedule() {
  isSaving.value = true
  clearMessages()

  try {
    const hasConflicts = await checkForConflicts()
    if (hasConflicts) {
        isSaving.value = false
        return
    }
    
    await performSave()
  } catch (e) {
    console.error('Error in save flow:', e)
    showError('An error occurred')
    isSaving.value = false
  }
}

async function performSave() {
  isSaving.value = true
  try {
    const updates = weeklySchedule.value.map(slot => {
      const { id, ...data } = slot
      return String(id).startsWith('temp-') ? data : slot
    })

    await availabilityService.upsertAvailability(updates)

    showSuccess(t('provider.availability.save_success'))
    await fetchSchedule()
  } catch (e) {
    console.error('Error saving schedule:', e)
    showError(t('provider.availability.save_error'))
  } finally {
    isSaving.value = false
  }
}


</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-4 w-full sm:w-auto">
            <BackButton to="/provider/dashboard" />
            <h1 class="text-2xl font-bold text-gray-900">{{ $t('provider.availability.title') }}</h1>
          </div>
          <div class="flex flex-wrap justify-end items-center gap-4 w-full sm:w-auto">
            <select 
              v-model="selectedStaffId" 
              @change="onStaffChange"
              class="border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option v-for="member in staff" :key="member.id" :value="member.id">
                {{ member.name }}
              </option>
            </select>
            <SubmitButton
              type="button"
              :loading="isSaving"
              :disabled="isLoading"
              :label="$t('common.save')"
              :loading-label="$t('common.saving')"
              @click="saveSchedule"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-8">
      
      <!-- Status Messages -->
      <div v-if="successMessage" class="rounded-md bg-green-50 p-4 mb-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-green-800">{{ successMessage }}</h3>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-md bg-red-50 p-4 mb-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">{{ errorMessage }}</h3>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8">
        <!-- Loading -->
        <div v-if="isLoading && weeklySchedule.length === 0" class="flex justify-center items-center py-12">
            <LoadingSpinner :text="$t('common.loading')" />
        </div>
        
        <!-- Weekly Schedule -->
        <div v-else class="bg-white rounded-lg shadow overflow-hidden">
          <div class="p-6 border-b border-gray-200">
            <h2 class="text-lg font-bold text-gray-900">{{ $t('provider.availability.weekly_schedule') }}</h2>
            <p class="text-sm text-gray-500">{{ $t('provider.availability.set_hours') }}</p>
          </div>
          
          <div class="divide-y divide-gray-200">
            <div v-for="(day, index) in weeklySchedule" :key="index" class="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 gap-4">
              <div class="flex items-center gap-4 w-full sm:w-1/3">
                <input 
                  type="checkbox" 
                  v-model="day.is_available"
                  class="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                >
                <span class="font-medium text-gray-900" :class="{'text-gray-400': !day.is_available}">
                  {{ daysOfWeek[day.day_of_week]?.label }}
                </span>
              </div>

              <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto" v-if="day.is_available">
                <input 
                  type="time" 
                  v-model="day.start_time"
                  class="border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500 w-32"
                >
                <span class="text-gray-500">to</span>
                <input 
                  type="time" 
                  v-model="day.end_time"
                  class="border border-gray-300 rounded-md px-2 py-1 focus:ring-primary-500 focus:border-primary-500 w-32"
                >
              </div>
              <div v-else class="text-gray-400 italic text-sm">
                {{ $t('provider.availability.closed') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>



    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirmLabel="$t('common.confirm')"
      :isDestructive="true"
      @close="handleCloseModal"
      @confirm="handleConfirmSave"
    >
      <div v-if="pendingSave && conflictList.length > 0" class="mt-2 text-sm text-gray-500">
        <p class="mb-3">
          {{ $t('provider.availability.conflict_active') }}
        </p>
        <ul class="space-y-3">
          <li v-for="conflict in conflictList" :key="conflict.day">
            <div class="font-medium text-red-600">
              {{ conflict.day }} ({{ conflict.count }} bookings)
            </div>
            <ul class="pl-4 mt-1 space-y-1 text-gray-400 text-xs">
              <li v-for="sample in conflict.samples" :key="sample">
                - {{ sample }}
              </li>
              <li v-if="conflict.count > 3">...and more</li>
            </ul>
          </li>
        </ul>
        <p class="mt-4 font-medium text-gray-700">
          {{ $t('provider.availability.conflict_proceed') }}
        </p>
      </div>
    </ConfirmationModal>
  </div>
</template>
