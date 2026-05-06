<script setup lang="ts">
import Modal from '../../components/common/Modal.vue'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Trash2 } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

import { computed } from 'vue'

const props = defineProps<{
  isOpen: boolean
  block: any
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete', payload: { id: string; scope: 'series' | 'occurrence'; date?: Date }): void
}>()

const settingsStore = useSettingsStore()

function formatDateDisplay(date: Date) {
  return date.toLocaleDateString(settingsStore.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const dateDisplay = computed(() => {
  if (!props.block) return ''
  
  // For recurring blocks, show the instance date
  if (props.block.isRecurring) {
    return formatDateDisplay(props.block.start)
  }

  // For non-recurring (Single/Multi-day) blocks
  const original = props.block.original
  if (original && original.start_date && original.end_date) {
      if (original.start_date !== original.end_date) {
         // Create dates in local time (browser default for YYYY-MM-DDT00:00:00)
         const start = new Date(original.start_date + "T00:00:00")
         const end = new Date(original.end_date + "T00:00:00")
         return `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`
      }
      const start = new Date(original.start_date + "T00:00:00")
      return formatDateDisplay(start)
  }
  
  return formatDateDisplay(props.block.start)
})

function formatTime(time: string) {
    if (!time) return ''
    // Assuming time is HH:mm:ss or HH:mm
    const [h = '0', m = '00'] = time.split(':')
    const d = new Date()
    d.setHours(parseInt(h), parseInt(m))
    return d.toLocaleTimeString(settingsStore.language, { hour: 'numeric', minute: '2-digit' })
}

function handleDelete(scope: 'series' | 'occurrence') {
    // Confirmation removed as requested
    emit('delete', {
      id: props.block.original.id,
      scope,
      date: scope === 'occurrence' ? props.block.start : undefined
    })
}
</script>

<template>
  <Modal
    :is-open="isOpen"
    :title="$t('modals.blocked_date.title')"
    @close="$emit('close')"
  >
    <div v-if="block" class="mt-4 space-y-6">
      
      <!-- Header -->
      <div class="flex items-start justify-between">
          <div>
            <h3 class="text-xl font-bold text-gray-900">{{ block.title }}</h3>
            <p v-if="block.original.reason" class="text-gray-500 mt-1">{{ block.original.reason }}</p>
          </div>
          <div v-if="block.isRecurring" class="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium uppercase">
              {{ $t('calendar.repeat') }}
          </div>
      </div>

      <!-- Details -->
      <div class="space-y-4">
          <div class="flex items-center gap-3 text-gray-700">
             <div class="w-24 text-sm font-medium text-gray-500">{{ $t('common.date') }}</div>
             <div>{{ dateDisplay }}</div>
          </div>
          
          <div v-if="block.original.start_time" class="flex items-center gap-3 text-gray-700">
             <div class="w-24 text-sm font-medium text-gray-500">{{ $t('common.start_time') }}</div>
             <div>
                 {{ formatTime(block.original.start_time) }} - {{ formatTime(block.original.end_time) }}
             </div>
          </div>
           <div v-else class="flex items-center gap-3 text-gray-700">
             <div class="w-24 text-sm font-medium text-gray-500">{{ $t('calendar.all_day') }}</div>
             <div>{{ $t('calendar.all_day') }}</div>
          </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-between items-center pt-4 border-t gap-3">
        <div class="flex flex-wrap gap-2">
         <button
          type="button"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          :disabled="loading"
          :class="{ 'opacity-75 cursor-not-allowed': loading }"
          @click="handleDelete(block.isRecurring ? 'occurrence' : 'series')"
        >
          <LoadingSpinner v-if="loading" inline size="sm" class="mr-2" />
          <Trash2 v-else class="w-4 h-4 mr-2" />
          {{
            loading
              ? $t('common.deleting')
              : block.isRecurring
                ? 'Delete this occurrence'
                : $t('common.delete')
          }}
        </button>

        <button
          v-if="block.isRecurring"
          type="button"
          class="inline-flex items-center px-4 py-2 border border-red-200 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          :disabled="loading"
          :class="{ 'opacity-75 cursor-not-allowed': loading }"
          @click="handleDelete('series')"
        >
          <Trash2 class="w-4 h-4 mr-2" />
          Delete entire series
        </button>
        </div>

        <button
          type="button"
          class="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
          @click="$emit('close')"
        >
          {{ $t('common.close') }}
        </button>
      </div>
    </div>
  </Modal>
</template>
