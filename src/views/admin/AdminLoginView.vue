<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useRoute, useRouter } from 'vue-router'
import LoginForm from '../../components/auth/LoginForm.vue'
import { ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const adminError = ref('')

const checkRouteState = () => {
  if (route.query.error === 'not_admin') {
    adminError.value = 'Access Denied: This area is restricted to platform administrators only.'
    router.replace('/admin') // remove query param
  } else if (authStore.isAuthenticated && authStore.isSuperAdmin) {
    router.push('/super-admin/dashboard')
  }
}

onMounted(checkRouteState)
watch(() => route.query.error, checkRouteState)

async function handleLoginSuccess() {
  // Authentication was successful, now verify the Administrative role
  // Explicitly fetch super admin profile since it may not be loaded yet
  await authStore.fetchSuperAdminProfile()

  if (!authStore.isSuperAdmin) {
    adminError.value = 'Access Denied: This area is restricted to platform administrators only.'
    // Sign out immediately to clear the non-admin session
    await authStore.signOut()
    return
  }

  // If we reach here, user is a verified Super Admin
  router.push('/super-admin/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
    <div class="w-full max-w-[400px] space-y-8">
      <!-- Header -->
      <div class="text-center space-y-3">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-2">
          <ShieldCheck class="h-8 w-8 text-white" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">Platform Portal</h1>
        <p class="text-slate-500 font-medium">Administrative access required to proceed</p>
      </div>

      <!-- Error Message -->
      <transition 
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <Alert v-if="adminError" variant="destructive" class="border-rose-200 bg-rose-50">
          <ShieldAlert class="h-4 w-4" />
          <AlertTitle>Authorization Failed</AlertTitle>
          <AlertDescription>
            {{ adminError }}
          </AlertDescription>
        </Alert>
      </transition>

      <!-- Login Form Card -->
      <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
        <LoginForm @success="handleLoginSuccess" :embedded="true" redirect="/super-admin/dashboard" />
      </div>

      <!-- Footer Info -->
      <div class="text-center">
        <p class="text-xs text-slate-400 font-medium uppercase tracking-widest">
          Agendaly Platform Security &copy; 2026
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom transitions and styling for the admin portal */
</style>
