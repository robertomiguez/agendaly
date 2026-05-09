<script setup lang="ts">
import { Info } from 'lucide-vue-next'
</script>

<template>
  <aside class="plan-disclaimer" role="note">
    <Info />
    <div>
      <h2>Early Access Notice</h2>
      You are currently on our <b>Freemium</b> Early Access tier. During our beta launch, we've implemented some initial limits to maintain system stability. Soon, we will introduce premium subscription tiers unlocking unlimited resources, advanced analytics, and ad-free customer booking pages!
    </div>
  </aside>
</template>

<style scoped>
@reference "../../style.css";

.plan-disclaimer {
  @apply grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800;
}

.plan-disclaimer svg {
  @apply mt-0.5 h-5 w-5 text-blue-600;
}

.plan-disclaimer h2 {
  @apply mb-1 text-sm font-semibold text-blue-900;
}
</style>
