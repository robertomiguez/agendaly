<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { 
  Bell, 
  Settings, 
  Calendar, 
  DollarSign, 
  Briefcase, 
  Users, 
  Plus, 
  MapPin, 
  Clock,
  AlertTriangle
} from 'lucide-vue-next'
import { useCurrency } from '@/composables/useCurrency'
import LoadingSpinner from '../../components/common/LoadingSpinner.vue'

const authStore = useAuthStore()
const providerStore = useProviderStore()
const router = useRouter()

onMounted(async () => {
  if (!authStore.provider) {
    router.push('/booking')
    return
  }

  await providerStore.fetchDashboardStats(authStore.provider.id)
})

const { formatPrice } = useCurrency()

function formatCurrency(amount: number) {
  // Use shared currency logic which respects browser locale
  return formatPrice(amount)
}

const hasStaff = computed(() => providerStore.stats.totalStaff > 0)

function goToServices() {
  if (!hasStaff.value) return
  router.push('/provider/services')
}

function goToStaff() {
  router.push('/provider/staff')
}

function goToAddresses() {
  router.push('/provider/addresses')
}

function goToCalendar() {
  if (!hasStaff.value) return
  router.push('/provider/calendar')
}


function goToAvailability() {
  if (!hasStaff.value) return
  router.push('/provider/availability')
}

function goToRevenueReport() {
  router.push('/provider/revenue-report')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">{{ $t('dashboard.title') }}</h1>
            <p class="text-gray-600 mt-1">{{ $t('dashboard.welcome_back', { name: authStore.provider?.business_name || 'Provider' }) }}</p>
          </div>
          <div class="flex items-center gap-4">
            <!-- Notifications placeholder -->
            <button class="p-2 text-gray-600 hover:text-gray-900 relative">
              <Bell class="w-6 h-6" />
            </button>
            <!-- Settings placeholder -->
            <button class="p-2 text-gray-600 hover:text-gray-900">
              <Settings class="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-8">
      
      <LoadingSpinner v-if="providerStore.loading" :text="$t('dashboard.loading')" />

      <!-- Stats Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Today's Appointments -->
        <div 
          @click="goToCalendar"
          class="bg-white rounded-lg shadow p-6 border-l-4 border-primary-600 transition-all"
          :class="hasStaff ? 'cursor-pointer hover:shadow-md' : 'opacity-75 cursor-not-allowed'"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">{{ $t('dashboard.stats.today_appointments') }}</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">{{ providerStore.stats.todayAppointments }}</p>
            </div>
            <div class="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <Calendar class="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <!-- Week Revenue -->
        <div 
          @click="goToRevenueReport"
          class="bg-white rounded-lg shadow p-6 border-l-4 border-green-600 cursor-pointer hover:shadow-md transition-all"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">{{ $t('dashboard.stats.week_revenue') }}</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">{{ formatCurrency(providerStore.stats.weekRevenue) }}</p>
              <p class="text-xs text-gray-400 mt-1 italic">{{ $t('dashboard.stats.revenue_projected_hint') }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign class="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <!-- Active Services -->
        <div 
          @click="goToServices"
          class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600 transition-all"
          :class="hasStaff ? 'cursor-pointer hover:shadow-md' : 'opacity-75 cursor-not-allowed'"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">{{ $t('dashboard.stats.active_services') }}</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">{{ providerStore.stats.activeServices }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Briefcase class="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <!-- Total Staff -->
        <div 
          @click="goToStaff"
          class="bg-white rounded-lg shadow p-6 border-l-4 border-purple-600 cursor-pointer hover:shadow-md transition-all"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">{{ $t('dashboard.stats.staff_members') }}</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">{{ providerStore.stats.totalStaff }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Users class="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('dashboard.quick_actions.title') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          <button
            @click="goToAddresses"
            class="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all"
          >
            <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MapPin class="w-6 h-6 text-orange-600" />
            </div>
            <div class="text-left">
              <p class="font-semibold text-gray-900">{{ $t('dashboard.quick_actions.locations_title') }}</p>
              <p class="text-sm text-gray-600">{{ $t('dashboard.quick_actions.locations_desc') }}</p>
            </div>
          </button>

          <button
            @click="goToStaff"
            class="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all"
          >
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users class="w-6 h-6 text-purple-600" />
            </div>
            <div class="text-left">
              <p class="font-semibold text-gray-900">{{ $t('dashboard.quick_actions.staff_title') }}</p>
              <p class="text-sm text-gray-600">{{ $t('dashboard.quick_actions.staff_desc') }}</p>
            </div>
          </button>

          <button
            @click="goToServices"
            :disabled="!hasStaff"
            class="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :class="hasStaff ? 'hover:border-primary-500 hover:bg-primary-50' : ''"
          >
            <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Plus class="w-6 h-6 text-primary-600" />
            </div>
            <div class="text-left">
              <p class="font-semibold text-gray-900">{{ $t('dashboard.quick_actions.services_title') }}</p>
              <p class="text-sm text-gray-600">{{ $t('dashboard.quick_actions.services_desc') }}</p>
            </div>
          </button>

          <button
            @click="goToAvailability"
            :disabled="!hasStaff"
            class="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :class="hasStaff ? 'hover:border-blue-500 hover:bg-blue-50' : ''"
          >
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock class="w-6 h-6 text-blue-600" />
            </div>
            <div class="text-left">
              <p class="font-semibold text-gray-900">{{ $t('dashboard.quick_actions.availability_title') }}</p>
              <p class="text-sm text-gray-600">{{ $t('dashboard.quick_actions.availability_desc') }}</p>
            </div>
          </button>

          <button
            @click="goToCalendar"
            :disabled="!hasStaff"
            class="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :class="hasStaff ? 'hover:border-green-500 hover:bg-green-50' : ''"
          >
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar class="w-6 h-6 text-green-600" />
            </div>
            <div class="text-left">
              <p class="font-semibold text-gray-900">{{ $t('dashboard.quick_actions.calendar_title') }}</p>
              <p class="text-sm text-gray-600">{{ $t('dashboard.quick_actions.calendar_desc') }}</p>
            </div>
          </button>

        </div>
      </div>

      <!-- Pending Status Warning (if not approved) -->
      <div v-if="providerStore.isPending" class="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8 rounded-lg">
        <div class="flex">
          <div class="flex-shrink-0">
            <AlertTriangle class="h-5 w-5 text-yellow-400" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-800">{{ $t('dashboard.status.pending_title') }}</h3>
            <div class="mt-2 text-sm text-yellow-700">
              <p>{{ $t('dashboard.status.pending_desc') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity / Upcoming Appointments -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('dashboard.upcoming.title') }}</h2>
        <div v-if="providerStore.stats.todayAppointments === 0" class="text-center py-12">
          <Calendar class="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p class="text-gray-600">{{ $t('dashboard.upcoming.no_appointments') }}</p>
          <Button v-if="hasStaff" variant="link" @click="goToCalendar" class="mt-4 text-primary-600 hover:text-primary-700">
            {{ $t('dashboard.upcoming.view_full_calendar') }} →
          </Button>
        </div>
        <div v-else class="space-y-3">
          <p class="text-gray-600">{{ $t('dashboard.upcoming.appointments_count', { count: providerStore.stats.todayAppointments }) }}</p>
          <Button v-if="hasStaff" variant="link" @click="goToCalendar" class="text-primary-600 hover:text-primary-700 p-0">
            {{ $t('dashboard.upcoming.view_details') }} →
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
