<script setup lang="ts">
import LegalDocumentViewer from '@/components/legal/LegalDocumentViewer.vue'
import BackButton from '@/components/common/BackButton.vue'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

const backDestination = computed(() => {
  const from = route.query.from as string
  if (from) {
    return `/login?redirect=${from}`
  }
  return '/'
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="container max-w-4xl mx-auto py-8">
      <BackButton :to="backDestination" class="mb-6" />
      
      <div class="bg-card rounded-lg border shadow-sm">
        <LegalDocumentViewer documentType="privacy" />
      </div>
    </div>
  </div>
</template>
