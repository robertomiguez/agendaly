<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { Calendar as CalendarIcon, Clock, ArrowLeft } from 'lucide-vue-next'
import { format } from 'date-fns'
import type { TimeSlot } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Service {
  id: string
  name: string
}

const props = defineProps<{
  selectedService: Service | undefined
  selectedStaffId: string
  availableDates: Date[]
  selectedDate: Date
  availableSlots: TimeSlot[]
  selectedTime: string
  loadingSlots: boolean
  loadingDates?: boolean
  isDateAvailable: (date: Date) => boolean
  getDateStatus: (date: Date) => 'Available' | 'Busy' | 'Unavailable'
}>()

const emit = defineEmits<{
  'update:selectedDate': [date: Date]
  'update:selectedTime': [time: string]
  confirm: []
  back: []
}>()

const settingsStore = useSettingsStore()
const staffStore = useStaffStore()

const selectedStaffName = computed(() => 
  staffStore.staff.find(s => s.id === props.selectedStaffId)?.name
)
</script>

<template>
  <div class="animate-in fade-in slide-in-from-right-4 duration-300">
    <button type="button" class="booking-back-command" @click="emit('back')">
      <ArrowLeft class="mr-2 h-4 w-4" /> {{ $t('common.back') }}
    </button>
    
    <div class="mb-6 pb-6 border-b border-gray-100">
      <h2 class="text-2xl font-bold mb-2 flex items-center gap-2">
        <CalendarIcon class="h-6 w-6 text-primary-600" />
        {{ $t('booking.select_datetime') }}
      </h2>
      <div class="flex flex-wrap gap-2 mt-2">
        <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {{ selectedService?.name }}
        </span>
        <span class="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
          {{ selectedStaffName }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Date Picker -->
      <div>
        <h3 class="font-medium text-gray-900 mb-3 ml-1">{{ $t('booking.choose_date') }}</h3>
        
        <div v-if="loadingDates" class="h-80 flex items-center justify-center border rounded-md bg-gray-50">
          <LoadingSpinner :text="$t('calendar.loading')" />
        </div>

        <div v-else class="space-y-2 h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
          <button
            v-for="date in availableDates"
            :key="date.toISOString()"
            @click="isDateAvailable(date) ? emit('update:selectedDate', date) : null"
            :disabled="!isDateAvailable(date)"
            class="w-full flex items-center justify-between p-3 rounded-md border text-sm transition-all"
            :class="[
              format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600 text-primary-900'
                : isDateAvailable(date)
                  ? 'border-gray-200 hover:border-primary-300'
                  : 'bg-gray-100 text-gray-300 border-transparent cursor-not-allowed'
            ]"
          >
            <div class="flex items-center gap-3">
              <div class="flex flex-col items-center justify-center w-10 h-10 rounded bg-white border border-gray-100" :class="{'bg-primary-100 border-primary-200': format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')}">
                <span class="text-xs uppercase font-bold text-gray-500">{{ date.toLocaleDateString(settingsStore.language, { weekday: 'short' }) }}</span>
                <span class="font-bold text-gray-900">{{ date.getDate() }}</span>
              </div>
              <span class="font-medium">{{ date.toLocaleDateString(settingsStore.language, { month: 'long' }) }}</span>
            </div>
            
            <div v-if="!isDateAvailable(date)" class="text-xs font-medium text-gray-400">
              {{ getDateStatus(date) === 'Busy' ? $t('status.busy') : $t('booking.closed') }}
            </div>
          </button>
        </div>
      </div>

      <!-- Time Slots -->
      <div>
        <h3 class="font-medium text-gray-900 mb-3 ml-1 flex items-center gap-2">
          <Clock class="h-4 w-4" />
          {{ $t('booking.available_times_header') }}
        </h3>
        
        <div v-if="loadingSlots" class="flex justify-center py-12">
          <LoadingSpinner :text="$t('booking.loading_slots')" />
        </div>

        <div v-else-if="availableSlots.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
          <button
            v-for="slot in availableSlots"
            :key="slot.time"
            @click="slot.available ? emit('update:selectedTime', slot.time) : null"
            :disabled="!slot.available"
            class="relative px-3 py-2 text-sm font-medium text-center rounded border transition-all"
            :class="[
              selectedTime === slot.time
                ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                : slot.available
                  ? 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-sm'
                  : 'bg-gray-100 text-gray-300 border-transparent cursor-not-allowed'
            ]"
          >
            {{ slot.time }}
            <div v-if="!slot.available" class="absolute inset-0 flex items-center justify-center">
              <div class="h-px w-full bg-gray-300 rotate-12"></div>
            </div>
          </button>
        </div>

        <div v-else class="text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p class="text-gray-500 text-sm">
            {{ !isDateAvailable(selectedDate) 
                ? (getDateStatus(selectedDate) === 'Busy' ? $t('booking.fully_booked') : $t('booking.staff_unavailable_day')) 
                : $t('booking.no_slots') 
            }}
          </p>
        </div>
      </div>
    </div>

    <div class="mt-8 pt-6 border-t border-gray-100 flex justify-end">
      <button 
        type="button"
        class="booking-primary-command"
        @click="emit('confirm')" 
        :disabled="!selectedTime"
      >
        Continue <span class="ml-2">→</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.booking-back-command {
  @apply mb-4 inline-flex items-center rounded-md text-sm font-medium text-gray-600 transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2;
}

.booking-primary-command {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-8 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
}
</style>
