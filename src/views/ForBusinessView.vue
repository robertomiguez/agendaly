<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '@/components/ui/button'
import { 
  Briefcase, 
  Users, 
  Calendar, 
  MapPin, 
  Clock, 
  Zap 
} from 'lucide-vue-next'
import BackButton from '../components/common/BackButton.vue'

const router = useRouter()
const authStore = useAuthStore()

function goToRegister() {
  if (authStore.isAuthenticated) {
    if (authStore.provider) {
      router.push('/provider/dashboard')
    } else {
      router.push('/provider/pricing')
    }
  } else {
    // Not authenticated - go to login with provider redirect
    router.push('/login?redirect=/provider')
  }
}

function goToDashboard() {
  if (authStore.provider) {
    router.push('/provider/dashboard')
  } else {
    // Redirect to login with simpler /provider redirect
    router.push('/login?redirect=/provider')
  }
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Hero Section -->
    <div class="bg-gradient-to-br from-purple-600 via-primary-600 to-blue-600 text-white">
      <div class="max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <BackButton to="/" class="text-white/80 hover:text-white mb-4" />
        <div class="max-w-3xl">
          <h1 class="text-5xl lg:text-6xl font-bold mb-6">
            {{ $t('business.hero_title') }}
          </h1>
          <p class="text-xl lg:text-2xl mb-8 text-purple-100">
            {{ $t('business.hero_subtitle') }}
          </p>
          <div class="flex flex-col sm:flex-row gap-4">
            <Button
              @click="goToRegister"
              size="lg"
              class="px-8 py-6 bg-white text-primary-600 hover:bg-gray-100 font-semibold text-lg shadow-lg h-auto"
            >
              {{ $t('business.get_started_free') }}
            </Button>
            <Button
              v-if="authStore.provider"
              @click="goToDashboard"
              variant="outline"
              size="lg"
              class="px-8 py-6 bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary-600 font-semibold text-lg h-auto"
            >
              {{ $t('business.go_to_dashboard') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="max-w-7xl mx-auto px-6 py-20">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-bold text-gray-900 mb-4">{{ $t('business.features_title') }}</h2>
        <p class="text-xl text-gray-600">{{ $t('business.features_subtitle') }}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Service Management -->
        <div class="bg-white p-8 rounded-xl border-2 border-gray-100 hover:border-primary-500 hover:shadow-lg transition-all">
          <div class="w-14 h-14 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
            <Briefcase class="w-8 h-8 text-primary-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ $t('business.features.services_title') }}</h3>
          <p class="text-gray-600">{{ $t('business.features.services_desc') }}</p>
        </div>

        <!-- Staff Management -->
        <div class="bg-white p-8 rounded-xl border-2 border-gray-100 hover:border-purple-500 hover:shadow-lg transition-all">
          <div class="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Users class="w-8 h-8 text-purple-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ $t('business.features.team_title') }}</h3>
          <p class="text-gray-600">{{ $t('business.features.team_desc') }}</p>
        </div>

        <!-- Calendar -->
        <div class="bg-white p-8 rounded-xl border-2 border-gray-100 hover:border-green-500 hover:shadow-lg transition-all">
          <div class="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Calendar class="w-8 h-8 text-green-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ $t('business.features.calendar_title') }}</h3>
          <p class="text-gray-600">{{ $t('business.features.calendar_desc') }}</p>
        </div>

        <!-- Locations -->
        <div class="bg-white p-8 rounded-xl border-2 border-gray-100 hover:border-orange-500 hover:shadow-lg transition-all">
          <div class="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
            <MapPin class="w-8 h-8 text-orange-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ $t('business.features.locations_title') }}</h3>
          <p class="text-gray-600">{{ $t('business.features.locations_desc') }}</p>
        </div>

        <!-- Availability -->
        <div class="bg-white p-8 rounded-xl border-2 border-gray-100 hover:border-blue-500 hover:shadow-lg transition-all">
          <div class="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Clock class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ $t('business.features.scheduling_title') }}</h3>
          <p class="text-gray-600">{{ $t('business.features.scheduling_desc') }}</p>
        </div>

        <!-- Real-time Bookings -->
        <div class="bg-white p-8 rounded-xl border-2 border-gray-100 hover:border-indigo-500 hover:shadow-lg transition-all">
          <div class="w-14 h-14 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
            <Zap class="w-8 h-8 text-indigo-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">{{ $t('business.features.bookings_title') }}</h3>
          <p class="text-gray-600">{{ $t('business.features.bookings_desc') }}</p>
        </div>
      </div>
    </div>

    <!-- How It Works -->
    <div class="bg-gray-50 py-20">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-bold text-gray-900 mb-4">{{ $t('business.setup_title') }}</h2>
          <p class="text-xl text-gray-600">{{ $t('business.setup_subtitle') }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div class="text-center">
            <div class="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">{{ $t('business.setup_steps.step1_title') }}</h3>
            <p class="text-gray-600">{{ $t('business.setup_steps.step1_desc') }}</p>
          </div>

          <div class="text-center">
            <div class="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">{{ $t('business.setup_steps.step2_title') }}</h3>
            <p class="text-gray-600">{{ $t('business.setup_steps.step2_desc') }}</p>
          </div>

          <div class="text-center">
            <div class="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">{{ $t('business.setup_steps.step3_title') }}</h3>
            <p class="text-gray-600">{{ $t('business.setup_steps.step3_desc') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-gradient-to-r from-primary-600 to-purple-600 text-white py-20">
      <div class="max-w-4xl mx-auto px-6 text-center">
        <h2 class="text-4xl font-bold mb-6">{{ $t('business.cta_title') }}</h2>
        <p class="text-xl mb-8 text-purple-100">
          {{ $t('business.cta_subtitle') }}
        </p>
        <Button
          @click="goToRegister"
          size="lg"
          class="px-10 py-6 bg-white text-primary-600 hover:bg-gray-100 font-semibold text-lg shadow-lg h-auto"
        >
          {{ $t('business.get_started_free') }}
        </Button>
      </div>
    </div>

    <!-- Footer -->
    <div class="bg-gray-900 text-gray-400 py-12">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center">
          <p class="mb-4">&copy; 2026 Agendaly. {{ $t('footer.rights') }}</p>
          <div class="flex justify-center gap-6 text-sm">
            <a href="#" class="hover:text-white transition-colors">{{ $t('footer.about') }}</a>
            <a href="#" class="hover:text-white transition-colors">{{ $t('footer.privacy') }}</a>
            <a href="#" class="hover:text-white transition-colors">{{ $t('footer.terms') }}</a>
            <a href="#" class="hover:text-white transition-colors">{{ $t('footer.contact') }}</a>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
