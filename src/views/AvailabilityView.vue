<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useStaffStore } from '../stores/useStaffStore'
import { useDays } from '../composables/useDays'
import { useNotifications } from '../composables/useNotifications'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import BlockedDateModal from '../components/provider/BlockedDateModal.vue'

const staffStore = useStaffStore()
const { showSuccess, showError } = useNotifications()

const selectedStaffId = ref<string>('')
const showBlockedDateModal = ref(false)

// Confirmation logic
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingDeleteId = ref<string | null>(null)

function openDeleteConfirm(id: string) {
  pendingDeleteId.value = id
  confirmTitle.value = 'Remove Blocked Period'
  confirmMessage.value = 'Are you sure you want to remove this blocked period?'
  showConfirmModal.value = true
}

async function handleConfirmDelete() {
  if (!pendingDeleteId.value) return
  
  try {
    await staffStore.deleteBlockedDate(pendingDeleteId.value)
    showSuccess('Blocked period removed successfully')
  } catch (e) {
    console.error('Error deleting blocked date:', e)
    showError('Failed to delete blocked period')
  } finally {
    showConfirmModal.value = false
    pendingDeleteId.value = null
  }
}

const { daysOfWeek } = useDays()


interface ScheduleItem {
  enabled: boolean
  start: string
  end: string
}

const weeklySchedule = ref<ScheduleItem[]>([])


onMounted(async () => {
  await staffStore.fetchStaff()
  if (staffStore.staff.length > 0 && staffStore.staff[0]) {
    selectedStaffId.value = staffStore.staff[0].id
    await loadStaffAvailability()
  }
})

async function loadStaffAvailability() {
  if (!selectedStaffId.value) return
  
  await staffStore.fetchAvailability(selectedStaffId.value)
  await staffStore.fetchBlockedDates(selectedStaffId.value)
  
  // Initialize with 7 days (default closed)
  weeklySchedule.value = Array.from({ length: 7 }, () => ({
    enabled: false,
    start: '09:00',
    end: '17:00'
  }))
  
  // Populate from database
  staffStore.availability.forEach(avail => {
    if (avail.is_available && weeklySchedule.value[avail.day_of_week]) {
      weeklySchedule.value[avail.day_of_week] = {
        enabled: true,
        start: avail.start_time.substring(0, 5),
        end: avail.end_time.substring(0, 5)
      }
    }
  })
}

async function handleStaffChange() {
  await loadStaffAvailability()
}

async function saveSchedule() {
  if (!selectedStaffId.value) return
  
  const availabilityData = []
  
  for (let day = 0; day <= 6; day++) {
    const schedule = weeklySchedule.value[day]
    if (schedule && schedule.enabled) {
      availabilityData.push({
        staff_id: selectedStaffId.value,
        day_of_week: day,
        start_time: schedule.start,
        end_time: schedule.end,
        is_available: true
      })
    }
  }
  
  try {
    await staffStore.upsertAvailability(selectedStaffId.value, availabilityData)
    showSuccess('Schedule saved successfully')
  } catch (e) {
    console.error('Error saving schedule:', e)
    showError('Failed to save schedule')
  }
}

function openBlockedDateModal() {
  showBlockedDateModal.value = true
}

async function handleBlockedDateSubmit(payload: { start_date: string; end_date: string; reason: string }) {
  if (!selectedStaffId.value) return
  
  try {
    await staffStore.createBlockedDate({
      staff_id: selectedStaffId.value,
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: payload.reason
    })
    showSuccess('Blocked period added')
    showBlockedDateModal.value = false
  } catch (e) {
    console.error('Error creating blocked date:', e)
    showError('Failed to add blocked period')
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto p-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Staff Availability</h1>
      <p class="text-gray-600 mb-6">Manage business hours and time off</p>

      <!-- Staff Selector -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Select Staff Member</label>
        <select 
          v-model="selectedStaffId"
          @change="handleStaffChange"
          class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option v-for="member in staffStore.staff" :key="member.id" :value="member.id">
            {{ member.name }}
          </option>
        </select>
      </div>

      <div v-if="selectedStaffId" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Weekly Schedule -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Weekly Schedule</h2>
          
          <div class="space-y-3">
            <div v-for="(schedule, index) in weeklySchedule" :key="index" class="flex items-center gap-3">
              <input 
                type="checkbox" 
                v-model="schedule.enabled"
                class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span class="w-24 text-sm font-medium text-gray-700 capitalize text-left">{{ daysOfWeek[index]?.label }}</span>
              
              <template v-if="schedule.enabled">
                <input 
                  type="time"
                  v-model="schedule.start"
                  class="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <span class="text-gray-500">to</span>
                <input 
                  type="time"
                  v-model="schedule.end"
                  class="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </template>
              <span v-else class="text-sm text-gray-400">Closed</span>
            </div>
          </div>

          <button
            @click="saveSchedule"
            class="mt-6 w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Save Schedule
          </button>
        </div>

        <!-- Blocked Dates -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Blocked Dates</h2>
            <button
              @click="openBlockedDateModal"
              class="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              + Add
            </button>
          </div>

          <div v-if="staffStore.blockedDates.length > 0" class="space-y-3">
            <div
              v-for="blocked in staffStore.blockedDates"
              :key="blocked.id"
              class="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p class="text-sm font-medium text-gray-900">
                  {{ formatDate(blocked.start_date) }} - {{ formatDate(blocked.end_date) }}
                </p>
                <p v-if="blocked.reason" class="text-xs text-gray-500 mt-1">{{ blocked.reason }}</p>
              </div>
              <button
                @click="openDeleteConfirm(blocked.id)"
                class="text-red-600 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          </div>

          <div v-else class="text-center py-8 text-gray-500 text-sm">
            No blocked dates
          </div>
        </div>
      </div>

      <div v-else class="bg-white rounded-lg shadow p-12 text-center">
        <p class="text-gray-500">No staff members found. Add staff in your database.</p>
      </div>
    </div>

    <!-- Blocked Date Modal -->
    <BlockedDateModal
      :isOpen="showBlockedDateModal"
      @close="showBlockedDateModal = false"
      @save="handleBlockedDateSubmit"
    />
    
    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :isDestructive="true"
      @close="showConfirmModal = false"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>
