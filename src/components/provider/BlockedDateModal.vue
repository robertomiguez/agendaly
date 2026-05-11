<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../../components/common/Modal.vue'
import SubmitButton from '../common/SubmitButton.vue'

const props = defineProps<{
  isOpen: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { 
    start_date: string
    end_date: string
    reason: string 
  }): void
}>()

const form = ref({
  start_date: '',
  end_date: '',
  reason: ''
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = {
      start_date: '',
      end_date: '',
      reason: ''
    }
  }
})

function handleSubmit() {
  emit('save', form.value)
}
</script>

<template>
  <Modal
    :is-open="isOpen"
    :title="$t('modals.blocked_date.title')"
    maxWidth="sm:max-w-md"
    @close="$emit('close')"
  >
    <form @submit.prevent="handleSubmit" class="mt-4 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('modals.blocked_date.start_date') }}</label>
        <input
          v-model="form.start_date"
          type="date"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('modals.blocked_date.end_date') }}</label>
        <input
          v-model="form.end_date"
          type="date"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('modals.blocked_date.reason') }}</label>
        <input
          v-model="form.reason"
          type="text"
          :placeholder="$t('modals.blocked_date.reason_placeholder')"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div class="flex gap-3 pt-4">
        <button
          type="button"
          @click="$emit('close')"
          class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          {{ $t('common.cancel') }}
        </button>
        <SubmitButton
          :loading="loading"
          :label="$t('modals.blocked_date.add_button')"
          :loading-label="$t('modals.blocked_date.adding')"
          responsive
        />
      </div>
    </form>
  </Modal>
</template>
