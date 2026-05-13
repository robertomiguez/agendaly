<script setup lang="ts">
import { useSettingsStore } from '@/stores/useSettingsStore'
import { DollarSign } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

interface Service {
  id: string
  name: string
  description?: string
  price?: number
  price_currency?: string
  duration: number
  images?: { url: string }[]
  staff?: { id: string; name: string }[]
}

defineProps<{
  services: Service[]
  selectedServiceId: string
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [serviceId: string]
  confirm: []
}>()

const settingsStore = useSettingsStore()
</script>

<template>
  <div class="animate-in fade-in slide-in-from-right-4 duration-300">
    <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <DollarSign class="h-6 w-6 text-primary-600" />
      {{ $t('booking.choose_service') }}
    </h2>
    
    <LoadingSpinner v-if="loading" :text="$t('services.loading')" />

    <div v-else-if="services.length === 0" class="text-center py-12 text-gray-500">
      {{ $t('booking.no_services') }}
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div
        v-for="service in services"
        :key="service.id"
        class="bg-white rounded-lg border overflow-hidden shadow-sm transition-all cursor-pointer"
        :class="selectedServiceId === service.id ? 'border-primary-600 ring-1 ring-primary-600 shadow-md' : 'border-gray-300 hover:border-primary-400 hover:shadow-md'"
        @click="emit('select', service.id)"
      >
        <div class="flex flex-col sm:flex-row">
          <!-- Service Images -->
          <div v-if="service.images && service.images.length > 0" class="sm:w-1/3 h-48 sm:h-auto relative bg-gray-100">
            <img :src="service.images?.[0]?.url" class="w-full h-full object-cover absolute inset-0" />
            <div v-if="service.images.length > 1" class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              +{{ service.images.length - 1 }}
            </div>
          </div>

          <div class="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-bold text-gray-900">{{ service.name }}</h3>
                <div class="text-right">
                  <p class="text-lg font-bold text-primary-600">{{ settingsStore.formatPrice(service.price || 0, service.price_currency) }}</p>
                  <p class="text-xs text-gray-500">{{ service.duration }} {{ $t('common.minutes') }}</p>
                </div>
              </div>
              <p class="text-sm text-gray-600 line-clamp-2 mb-4">{{ service.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="mt-8 pt-6 border-t border-gray-100 flex justify-end">
      <button 
        type="button"
        class="booking-primary-command"
        @click="emit('confirm')" 
        :disabled="!selectedServiceId"
      >
        Continue <span class="ml-2">→</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.booking-primary-command {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-8 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
}
</style>
