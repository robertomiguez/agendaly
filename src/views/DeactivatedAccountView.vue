<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore'
import { ShieldAlert, LogOut } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const router = useRouter()
const authStore = useAuthStore()

const provider = computed(() => authStore.provider)

async function handleLogout() {
  await authStore.signOut()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
      <div class="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert class="h-10 w-10 text-red-600" />
      </div>
      
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Account Deactivated</h1>
      <p class="text-gray-600 mb-6">
        Your provider account for <strong>{{ provider?.business_name || 'Agendaly' }}</strong> has been deactivated by the platform administration.
      </p>

      <div v-if="provider?.deactivation_reason" class="bg-red-50 border border-red-100 rounded-lg p-4 mb-8 text-left">
        <h2 class="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Reason:</h2>
        <p class="text-red-700 text-sm italic">"{{ provider.deactivation_reason }}"</p>
      </div>

      <div class="space-y-3">
        <Button 
          variant="outline" 
          class="w-full h-12 flex items-center justify-center gap-2"
          @click="handleLogout"
        >
          <LogOut class="h-4 w-4" />
          Sign Out
        </Button>
        
        <a 
          href="mailto:support@agendaly.com" 
          class="block text-sm text-primary-600 hover:text-primary-700 font-medium py-2"
        >
          Contact Support
        </a>
      </div>
    </div>
    
    <p class="mt-8 text-gray-400 text-sm">
      &copy; {{ new Date().getFullYear() }} Agendaly Platform
    </p>
  </div>
</template>
