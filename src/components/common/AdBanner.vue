<script setup lang="ts">
import { computed } from 'vue'
import { Card } from '@/components/ui/card'

const props = withDefaults(defineProps<{
  placement?: 'default' | 'landing' | 'booking'
}>(), {
  placement: 'default',
})

const placementClass = computed(() => `ad-banner--${props.placement}`)
</script>

<template>
  <Card
    class="ad-banner"
    :class="placementClass"
  >
    <div class="ad-banner__label">Advertisement</div>
    <div class="ad-banner__content">
      <p class="ad-banner__title">Premium beauty &amp; wellness supplies at wholesale prices.</p>
      <p class="ad-banner__copy">
        <span class="ad-banner__link">Click here to discover special offers for professionals!</span>
      </p>
    </div>
  </Card>
</template>

<style scoped>
@reference "../../style.css";

.ad-banner {
  @apply bg-gray-50 border-dashed border-2 border-gray-300 p-4 text-center text-gray-500 my-6 shadow-sm hover:shadow transition-shadow;
}

.ad-banner--landing {
  @apply md:col-span-2 lg:col-span-3 xl:col-span-4;
}

.ad-banner--booking {
  @apply mt-6;
}

.ad-banner__label {
  @apply text-xs uppercase font-semibold tracking-wider text-gray-400 mb-2;
}

.ad-banner__content {
  @apply flex flex-col items-center justify-center min-h-[90px];
}

.ad-banner__title {
  @apply text-sm font-medium;
}

.ad-banner__copy {
  @apply text-sm mt-1;
}

.ad-banner__link {
  @apply text-primary-600 font-semibold cursor-pointer hover:underline;
}
</style>
