<script setup lang="ts">
import { parseISO } from 'date-fns'
import Modal from '../../components/common/Modal.vue'
import { useSettingsStore } from '../../stores/useSettingsStore'

defineProps<{
  isOpen: boolean
  appointment: any
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update-status', status: 'confirmed' | 'completed' | 'cancelled' | 'no-show'): void
}>()

const settingsStore = useSettingsStore()

function formatTime(time: string) {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString(settingsStore.language, { 
    hour: 'numeric', 
    minute: '2-digit' 
  })
}

function formatDate(dateStr: string) {
  return parseISO(dateStr).toLocaleDateString(settingsStore.language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <Modal
    :is-open="isOpen"
    :title="$t('modals.appointment_details.title')"
    @close="$emit('close')"
  >
    <div v-if="appointment" class="mt-4 space-y-4">
      <div class="bg-gray-50 p-4 rounded-lg">
        <p class="text-sm text-gray-500">{{ $t('modals.appointment_details.customer') }}</p>
        <p class="font-bold text-lg">{{ appointment.customers?.profiles?.name || appointment.customers?.profiles?.email || 'Unknown' }}</p>
        <p class="text-gray-600">{{ appointment.customers?.profiles?.email }}</p>
        <p class="text-gray-600">{{ appointment.customers?.profiles?.phone }}</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-500">{{ $t('modals.appointment_details.service') }}</p>
          <p class="font-medium">{{ appointment.services?.name }}</p>
          <p class="text-sm text-gray-600">{{ $t('modals.appointment_details.duration', { min: appointment.services?.duration }) }}</p>
          <p class="text-sm font-medium text-primary-600">{{ settingsStore.formatPrice(appointment.booked_price || 0) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">{{ $t('modals.appointment_details.staff') }}</p>
          <p class="font-medium">{{ appointment.staff?.name }}</p>
        </div>
      </div>

      <div>
        <p class="text-sm text-gray-500">{{ $t('modals.appointment_details.datetime') }}</p>
        <p class="font-medium">
          {{ $t('modals.appointment_details.datetime_value', { date: formatDate(appointment.appointment_date), time: formatTime(appointment.start_time) }) }}
        </p>
      </div>

      <div>
        <p class="text-sm text-gray-500 mb-2">{{ $t('modals.appointment_details.status') }}</p>
        <div class="flex gap-2">
          <button 
            @click="$emit('update-status', 'confirmed')"
            class="px-3 py-1 rounded-full text-sm font-medium border transition-colors"
            :disabled="loading"
            :class="[
              appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
              loading ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            {{ $t('status.confirmed') }}
          </button>
          <button 
            @click="$emit('update-status', 'completed')"
            class="px-3 py-1 rounded-full text-sm font-medium border transition-colors"
            :disabled="loading"
            :class="[
              appointment.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
               loading ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            {{ $t('status.completed') }}
          </button>
          <button 
            @click="$emit('update-status', 'cancelled')"
            class="px-3 py-1 rounded-full text-sm font-medium border transition-colors"
            :disabled="loading"
            :class="[
              appointment.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
               loading ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            {{ $t('status.cancelled') }}
          </button>
          <button 
            @click="$emit('update-status', 'no-show')"
            class="px-3 py-1 rounded-full text-sm font-medium border transition-colors"
            :disabled="loading"
            :class="[
              appointment.status === 'no-show' ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
               loading ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            {{ $t('status.no_show') }}
          </button>
        </div>
      </div>

      <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-1 sm:gap-3">
        <button
          type="button"
          class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
          @click="$emit('close')"
        >
          {{ $t('common.close') }}
        </button>
      </div>
    </div>
  </Modal>
</template>
