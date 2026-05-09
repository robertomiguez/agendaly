<script setup lang="ts">
import Modal from './Modal.vue'

defineProps<{
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Modal
    :isOpen="isOpen"
    :title="title"
    @close="emit('close')"
    maxWidth="sm:max-w-md"
  >
    <div class="mt-2">
      <slot>
        <p class="text-sm text-gray-500 whitespace-pre-wrap">
          {{ message }}
        </p>
      </slot>
    </div>

    <div class="mt-6 flex gap-3 sm:justify-end">
      <button
        type="button"
        class="modal-command modal-command--outline"
        @click="emit('close')"
      >
        {{ cancelLabel || $t('common.cancel') }}
      </button>
      <button
        type="button"
        class="modal-command"
        :class="isDestructive ? 'modal-command--danger' : 'modal-command--primary'"
        @click="emit('confirm')"
      >
        {{ confirmLabel || $t('common.confirm') }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
@reference "../../style.css";

.modal-command {
  @apply inline-flex h-9 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 sm:flex-none;
}

.modal-command--outline {
  @apply border border-gray-200 bg-white text-gray-900 shadow-sm hover:bg-gray-50;
}

.modal-command--primary {
  @apply bg-primary-600 text-white hover:bg-primary-700;
}

.modal-command--danger {
  @apply bg-red-600 text-white hover:bg-red-700 focus:ring-red-200;
}
</style>
