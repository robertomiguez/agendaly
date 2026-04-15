<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'
import { useSubscription } from '../../composables/useSubscription'

const props = withDefaults(defineProps<{
  alwaysShow?: boolean
}>(), {
  alwaysShow: false,
})

const { isFreemium, loading } = useSubscription()

const shouldShow = computed(() => props.alwaysShow || (!loading.value && isFreemium.value))
</script>

<template>
  <Card
    v-if="shouldShow"
    class="bg-gray-50 border-dashed border-2 border-gray-300 p-4 text-center text-gray-500 my-6 shadow-sm hover:shadow transition-shadow"
  >
    <div class="text-xs uppercase font-semibold tracking-wider text-gray-400 mb-2">Advertisement</div>
    <div class="flex flex-col items-center justify-center min-h-[90px]">
      <p class="text-sm font-medium">Premium beauty &amp; wellness supplies at wholesale prices.</p>
      <p class="text-sm mt-1">
        <span class="text-primary-600 font-semibold cursor-pointer hover:underline">Click here to discover special offers for professionals!</span>
      </p>
    </div>
  </Card>
</template>
