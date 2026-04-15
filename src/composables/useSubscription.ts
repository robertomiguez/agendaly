import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { getProviderSubscription } from '../services/subscriptionService'
import type { Subscription } from '../types'

export function useSubscription() {
  const authStore = useAuthStore()
  const subscription = ref<Subscription | null>(null)
  const loading = ref(false)

  onMounted(async () => {
    if (!authStore.provider?.id) return

    loading.value = true
    try {
      subscription.value = await getProviderSubscription(authStore.provider.id)
    } catch (e) {
      console.error('[useSubscription] Failed to fetch subscription:', e)
    } finally {
      loading.value = false
    }
  })

  /**
   * True when:
   * - No provider session (anonymous visitor), or
   * - The provider is on the freemium plan (or has no subscription record)
   */
  const isFreemium = computed(() => {
    if (!authStore.isProvider) return true
    if (loading.value) return false
    return !subscription.value || subscription.value.plan?.name === 'freemium'
  })

  return {
    subscription,
    loading,
    isFreemium,
  }
}
