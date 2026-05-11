<script setup lang="ts">
import { computed } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  loading?: boolean
  disabled?: boolean
  label: string
  loadingLabel?: string
  type?: 'submit' | 'button'
  variant?: 'primary' | 'danger'
  fullWidth?: boolean
  responsive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  loadingLabel: '',
  type: 'submit',
  variant: 'primary',
  fullWidth: false,
  responsive: false
})

const buttonLabel = computed(() => props.loading ? props.loadingLabel || props.label : props.label)
const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    :type="type"
    :disabled="isDisabled"
    class="submit-button"
    :class="[
      `submit-button--${variant}`,
      {
        'submit-button--full-width': fullWidth,
        'submit-button--responsive': responsive
      }
    ]"
  >
    <LoadingSpinner
      v-if="loading"
      inline
      size="sm"
      class="submit-button__spinner"
      color="text-white"
    />
    <span class="submit-button__label">{{ buttonLabel }}</span>
  </button>
</template>

<style scoped>
@reference "../../style.css";

.submit-button {
  @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60;
}

.submit-button--primary {
  @apply bg-amber-600 text-white hover:bg-amber-700;
}

.submit-button--danger {
  @apply bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300;
}

.submit-button--full-width {
  @apply w-full;
}

.submit-button--responsive {
  @apply flex-1 sm:flex-none;
}

.submit-button__spinner {
  @apply shrink-0;
}

.submit-button__label {
  @apply min-w-0 truncate;
}
</style>
