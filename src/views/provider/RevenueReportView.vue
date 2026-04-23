<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCurrency } from '@/composables/useCurrency'
import { fetchRevenueReport } from '../../services/providerService'
import { Button } from '@/components/ui/button'
import { 
  Download,
  Share2, 
  Calendar,
  DollarSign,
  TrendingUp,
} from 'lucide-vue-next'
import LoadingSpinner from '../../components/common/LoadingSpinner.vue'
import BackButton from '../../components/common/BackButton.vue'

const authStore = useAuthStore()
const { formatPrice } = useCurrency()

const loading = ref(true)
const transactions = ref<any[]>([])
const chartData = ref<any[]>([])

onMounted(async () => {
  if (authStore.provider?.id) {
    await loadData(authStore.provider.id)
  }
})

async function loadData(providerId: string) {
  loading.value = true
  try {
    const data = await fetchRevenueReport(providerId)
    
    // Process transactions
    transactions.value = data?.map((appt: any) => ({
      id: appt.id.substring(0, 8).toUpperCase(),
      date: new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString(), // Use noon to avoid timezone shift on date-only strings
      client: appt.customers?.name || appt.customers?.email || 'Unknown Client',
      service: appt.services?.name || 'Unknown Service',
      amount: appt.booked_price ?? appt.services?.price ?? 0,
      status: appt.status
    })) || []

    // Process chart data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dailyRevenue = new Array(7).fill(0)

    data?.forEach((appt: any) => {
      // Parse date safely
      // Appointment date is YYYY-MM-DD
      const dateParts = appt.appointment_date.split('-')
      const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
      const dayIndex = date.getDay()
      
      const amount = appt.booked_price ?? appt.services?.price ?? 0
      dailyRevenue[dayIndex] += amount
    })

    const maxRevenue = Math.max(...dailyRevenue, 1) // Avoid division by zero
    
    chartData.value = days.map((day, index) => ({
      name: day,
      value: dailyRevenue[index],
      height: (dailyRevenue[index] / maxRevenue) * 100
    }))

  } catch (e) {
    console.error('Failed to load revenue report:', e)
  } finally {
    loading.value = false
  }
}

const totalRevenue = computed(() => {
  return transactions.value.reduce((sum, tx) => sum + tx.amount, 0)
})

const totalAppointments = computed(() => transactions.value.length)
const averageValue = computed(() => totalRevenue.value / (totalAppointments.value || 1))


function handleExport() {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 print:bg-white">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 print:hidden">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <BackButton to="/provider/dashboard" />
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{{ $t('revenue_report.title', 'Revenue Report') }}</h1>
              <p class="text-gray-600 text-sm">This Week</p>
            </div>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" class="gap-2">
              <Share2 class="w-4 h-4" />
              {{ $t('common.share', 'Share') }}
            </Button>
            <Button variant="outline" @click="handleExport" class="gap-2">
              <Download class="w-4 h-4" />
              {{ $t('common.export_pdf', 'Export PDF') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Print Header (Only visible when printing) -->
    <div class="hidden print:block p-8 border-b border-gray-200 mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ authStore.provider?.business_name || 'Provider' }} - Revenue Report</h1>
      <p class="text-gray-600">Generated on {{ new Date().toLocaleDateString() }}</p>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-8 print:p-8 print:max-w-none">
      
      <LoadingSpinner v-if="loading" :text="$t('reports.loading')" />

      <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:grid-cols-3 print:gap-4">
        <div class="bg-white p-6 rounded-lg shadow border border-gray-100 print:shadow-none print:border-gray-300">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-500 font-medium text-sm">Total Revenue</h3>
            <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center print:hidden">
              <DollarSign class="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ formatPrice(totalRevenue) }}</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow border border-gray-100 print:shadow-none print:border-gray-300">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-500 font-medium text-sm">Total Appointments</h3>
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center print:hidden">
              <Calendar class="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ totalAppointments }}</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow border border-gray-100 print:shadow-none print:border-gray-300">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-500 font-medium text-sm">Avg. Transaction</h3>
            <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center print:hidden">
              <TrendingUp class="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-900">{{ formatPrice(averageValue) }}</p>
        </div>
      </div>

      <!-- Chart Section -->
      <div class="bg-white p-6 rounded-lg shadow border border-gray-100 mb-8 print:shadow-none print:border-gray-300 print:break-inside-avoid">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Revenue Trend</h2>
        <div class="h-64 flex items-end justify-between gap-2 px-4">
          <div v-for="item in chartData" :key="item.name" class="flex flex-col items-center flex-1 group">
            <div class="relative w-full max-w-[40px] bg-primary-100 rounded-t transition-all hover:bg-primary-200 print:bg-gray-200" :style="{ height: `${item.height}%` }">
              <div class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 print:hidden">
                {{ formatPrice(item.value) }}
              </div>
            </div>
            <span class="text-xs text-gray-500 mt-2">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <!-- Transactions List -->
      <div class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden print:shadow-none print:border-gray-300">
        <div class="p-6 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-600">
            <thead class="bg-gray-50 text-xs uppercase font-medium text-gray-500">
              <tr>
                <th class="px-6 py-4">ID</th>
                <th class="px-6 py-4">Date</th>
                <th class="px-6 py-4">Client</th>
                <th class="px-6 py-4">Service</th>
                <th class="px-6 py-4">Status</th>
                <th class="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="tx in transactions" :key="tx.id" class="hover:bg-gray-50 print:hover:bg-white">
                <td class="px-6 py-4 font-medium text-gray-900">{{ tx.id }}</td>
                <td class="px-6 py-4">{{ tx.date }}</td>
                <td class="px-6 py-4">{{ tx.client }}</td>
                <td class="px-6 py-4">{{ tx.service }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 print:bg-transparent print:text-black print:p-0 print:border print:border-gray-300">
                    {{ tx.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right font-medium text-gray-900">{{ formatPrice(tx.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
@media print {
  .print\:hidden {
    display: none !important;
  }
  .print\:block {
    display: block !important;
  }
  .print\:bg-white {
    background-color: white !important;
  }
  .print\:shadow-none {
    box-shadow: none !important;
  }
  .print\:border-gray-300 {
    border-color: #d1d5db !important; /* gray-300 */
  }
  
  /* Ensure charts print reasonably well in black/white */
  .print\:bg-gray-200 {
    background-color: #e5e7eb !important; /* gray-200 */
  }
}
</style>
