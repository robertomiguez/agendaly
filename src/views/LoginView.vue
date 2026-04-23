<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useRouter, useRoute } from 'vue-router'
import LoginForm from '../components/auth/LoginForm.vue'
import heroImage from '@/assets/images/hero_barber_service_1765116285430.png'
import BackButton from '../components/common/BackButton.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// Determine context from redirect URL
const loginContext = computed(() => {
  const redirect = route.query.redirect as string
  if (redirect && redirect.startsWith('/provider')) {
    return 'provider'
  }
  return route.query.context as string || 'customer'
})

// Check if user is in booking flow - should hide business redirect
const isBookingContext = computed(() => {
  const redirect = route.query.redirect as string
  return redirect && redirect.startsWith('/booking')
})

onMounted(async () => {
  if (authStore.isAuthenticated) {
    handleLoginSuccess()
  }
})

function handleLoginSuccess() {
  // Clear any stored redirect intent — we're consuming it now
  localStorage.removeItem('authRedirect')
  const redirect = route.query.redirect as string
  
  if (redirect === '/provider') {
    if (authStore.provider) {
      router.push('/provider/dashboard')
    } else {
      router.push('/provider/pricing')
    }
  } else if (redirect === '/customer') {
    if (authStore.profile && authStore.profile.name && authStore.profile.phone) {
      router.push('/booking')
    } else {
      router.push('/profile')
    }
  } else if (authStore.provider && redirect === '/provider/profile') {
    router.push('/provider/dashboard')
  } else if (redirect) {
    router.push(redirect)
  } else if (authStore.provider) {
    router.push('/provider/dashboard')
  } else {
    router.push('/')
  }
}
</script>

<template>
  <div class="container relative flex min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
    <!-- Left Panel (Testimonial/Branding) -->
    <div 
      class="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex bg-cover bg-center"
      :style="{ backgroundImage: `url(${heroImage})` }"
    >
      <div class="absolute inset-0 bg-black/60" />
      <div class="relative z-20 flex items-center text-lg font-medium">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mr-2 h-6 w-6"
        >
          <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
        </svg>
        Agendaly Inc
      </div>
      <div class="relative z-20 mt-auto">
        <blockquote class="space-y-2">
          <p class="text-lg">
            &ldquo;{{ $t('auth.login_testimonial') }}&rdquo;
          </p>
          <footer class="text-sm">{{ $t('auth.login_testimonial_author') }}</footer>
        </blockquote>
      </div>
    </div>

    <!-- Right Panel (Login Form) -->
    <div class="p-8 lg:p-8">
      <BackButton v-if="!route.query.redirect" to="/" />
      <div class="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <!-- Provider-specific header -->
        <div v-if="loginContext === 'provider'" class="flex flex-col space-y-2 text-center">
          <h1 class="text-3xl font-bold tracking-tight">
            {{ $t('auth.provider_login_title') }}
          </h1>
          <p class="text-base text-muted-foreground whitespace-nowrap">
            {{ $t('auth.provider_login_subtitle') }}
          </p>
        </div>
        
        <!-- Customer header -->
        <div v-else class="flex flex-col space-y-2 text-center">
          <h1 class="text-3xl font-bold tracking-tight">
            {{ $t('auth.customer_login_title') }}
          </h1>
          <p class="text-base text-muted-foreground text-center">
            {{ $t('auth.customer_login_subtitle') }}
          </p>
        </div>
        
        <LoginForm @success="handleLoginSuccess" :embedded="true" />
        
        <p class="px-8 text-center text-sm text-muted-foreground">
          {{ $t('auth.agree_notice') }}
          <a href="/terms" class="underline underline-offset-4 hover:text-primary">
            {{ $t('auth.terms_of_service') }}
          </a>
          {{ $t('auth.terms_acceptance_and') }}
          <a href="/privacy" class="underline underline-offset-4 hover:text-primary">
            {{ $t('auth.privacy_policy') }}
          </a>
          .
        </p>
        
        <!-- Customer redirect for provider login -->
        <div v-if="loginContext === 'provider'" class="pt-4 border-t text-center">
          <p class="text-sm font-semibold text-foreground whitespace-nowrap">
            {{ $t('auth.customer_redirect_question') }}
          </p>
          <router-link 
            to="/" 
            class="text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            {{ $t('auth.customer_redirect_link') }} →
          </router-link>
        </div>
        
        <!-- Provider redirect for customer login (hidden during booking flow) -->
        <div v-else-if="!isBookingContext" class="pt-4 border-t text-center">
          <p class="text-sm font-semibold text-foreground whitespace-nowrap">
            {{ $t('auth.provider_redirect_question') }}
          </p>
          <router-link 
            to="/login?redirect=/provider" 
            class="text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            {{ $t('auth.provider_redirect_link') }} →
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
