<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

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
  <Button
    variant="ghost"
    size="sm"
    class="gap-2 text-gray-500 hover:text-gray-700 px-2"
    @click="goBack"
  >
    <ArrowLeft class="h-5 w-5" />
    <span v-if="label" class="hidden sm:inline text-sm">{{ label }}</span>
    <span v-else class="hidden sm:inline text-sm">{{ $t('common.back') }}</span>
  </Button>
</template>
