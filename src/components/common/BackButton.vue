<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

const props = defineProps<{
  to?: string
  label?: string
}>()

const router = useRouter()
const route = useRoute()

const destination = computed(() => {
  if (props.to) return props.to

  if (route.path.startsWith('/provider')) {
    return '/provider/dashboard'
  }

  return '/'
})

function goBack() {
  router.push(destination.value)
}
</script>

<template>
  <button
    type="button"
    class="back-command"
    @click="goBack"
  >
    <ArrowLeft class="h-5 w-5" />
    <span v-if="label" class="hidden sm:inline text-sm">{{ label }}</span>
    <span v-else class="hidden sm:inline text-sm">{{ $t('common.back') }}</span>
  </button>
</template>

<style scoped>
@reference "../../style.css";

.back-command {
  @apply inline-flex h-8 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2;
}
</style>
