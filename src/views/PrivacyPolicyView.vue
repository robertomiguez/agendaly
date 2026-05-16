<script setup lang="ts">
import LegalDocumentViewer from '@/components/legal/LegalDocumentViewer.vue'
import BackButton from '@/components/common/BackButton.vue'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useSeo } from '@/composables/useSeo'

const route = useRoute()

useSeo({
  title: 'Privacy Policy | Agendaly',
  description: 'Learn how Agendaly collects, uses, and protects customer and provider information.',
  canonical: 'https://agendaly.co/privacy',
  image: 'https://agendaly.co/og-image.png'
})

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
