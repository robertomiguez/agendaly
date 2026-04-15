<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-vue-next'
</script>

<template>
  <Alert variant="default" class="bg-blue-50 border-blue-200 text-blue-800">
    <Info class="h-5 w-5 text-blue-600" />
    <AlertTitle class="text-blue-900 font-semibold">Early Access Notice</AlertTitle>
    <AlertDescription class="text-blue-800 mt-1">
      You are currently on our <b>Freemium</b> Early Access tier. During our beta launch, we've implemented some initial limits to maintain system stability. Soon, we will introduce premium subscription tiers unlocking unlimited resources, advanced analytics, and ad-free customer booking pages!
    </AlertDescription>
  </Alert>
</template>
