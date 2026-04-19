<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavigationBar from './components/NavigationBar.vue'
import { useSettingsStore } from './stores/useSettingsStore'
import { useAuthStore } from './stores/useAuthStore'
import { getProviderSubscription } from './services/subscriptionService'
import type { Subscription } from './types'
import { AlertTriangle, ChevronRight } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const subscription = ref<Subscription | null>(null)

onMounted(async () => {
  settingsStore.initializeSettings()
  if (authStore.provider) {
    await checkSubscription()
  }
})

watch(() => authStore.provider, async (provider) => {
  if (provider) {
    await checkSubscription()
  } else {
    subscription.value = null
  }
})

async function checkSubscription() {
  try {
    if (authStore.provider?.id) {
      subscription.value = await getProviderSubscription(authStore.provider.id)
    }
  } catch (e) {
    console.error('Failed to check subscription', e)
  }
}

// Check if trial is expiring soon (within 7 days)
const showTrialWarning = computed(() => {
  if (!subscription.value) return false
  
  const isTrialing = subscription.value.status === 'trialing'
  if (!isTrialing) return false
  
  // Check if days remaining <= 7
  if (subscription.value.trial_ends_at) {
    const trialEnd = new Date(subscription.value.trial_ends_at)
    const now = new Date()
    const diffTime = trialEnd.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays <= 7 && diffDays >= 0
  }
  
  return false
})

const daysLeft = computed(() => {
  if (!subscription.value?.trial_ends_at) return 0
  const trialEnd = new Date(subscription.value.trial_ends_at)
  const now = new Date()
  const diffTime = trialEnd.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Hide navigation on certain pages
const hideNavigation = computed(() => {
  const hiddenRoutes = [
    '/login', 
    '/provider/profile',
    '/provider/pricing',
    '/provider/checkout',
    '/provider/checkout/success',
    '/profile',
    '/super-admin'
  ]
  return hiddenRoutes.includes(route.path) || route.path.startsWith('/super-admin')
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Global Loading State -->
    <div v-if="!authStore.isReady" class="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div class="flex flex-col items-center gap-4">
        <div class="relative flex h-10 w-10">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span class="relative inline-flex rounded-full h-10 w-10 bg-primary"></span>
        </div>
        <p class="text-muted-foreground animate-pulse">Loading Agendaly...</p>
      </div>
    </div>

    <template v-else>
      <!-- Trial Warning Banner -->
      <div 
        v-if="showTrialWarning && !hideNavigation" 
        class="bg-orange-50 border-b border-orange-200 px-4 py-3"
      >
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <AlertTriangle class="h-5 w-5 text-orange-600 shrink-0" />
            <p class="text-sm font-medium text-orange-800">
              Your free trial ends in <span class="font-bold">{{ daysLeft }} days</span>. 
              Add your payment details to avoid interruption.
            </p>
          </div>
          <button 
            @click="router.push('/provider/subscription')"
            class="text-sm font-semibold text-orange-900 flex items-center hover:underline whitespace-nowrap"
          >
            Add Payment Method <ChevronRight class="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>

      <NavigationBar v-if="!hideNavigation" />
      <RouterView />
    </template>
  </div>
</template>
