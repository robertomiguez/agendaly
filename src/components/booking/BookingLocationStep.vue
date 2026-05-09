<script setup lang="ts">
import { MapPin, ArrowLeft, Navigation } from 'lucide-vue-next'
import type { ProviderAddress } from '@/types'

defineProps<{
  addresses: ProviderAddress[]
  selectedAddressId: string
  getMapUrl: (address: ProviderAddress) => string
  getDirectionsUrl: (address: ProviderAddress) => string
}>()

const emit = defineEmits<{
  select: [addressId: string]
  confirm: []
  back: []
}>()
</script>

<template>
  <div class="animate-in fade-in slide-in-from-right-4 duration-300">
    <button type="button" class="booking-back-command" @click="emit('back')">
      <ArrowLeft class="mr-2 h-4 w-4" /> {{ $t('common.back') }}
    </button>
    <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
      <MapPin class="h-6 w-6 text-primary-600" />
      {{ $t('booking.select_location') }}
    </h2>

    <div class="grid grid-cols-1 gap-4">
      <div
        v-for="address in addresses"
        :key="address.id"
        @click="emit('select', address.id)"
        class="group relative rounded-lg border px-6 py-5 shadow-sm cursor-pointer transition-all hover:bg-gray-50 bg-white"
        :class="selectedAddressId === address.id ? 'border-primary-600 ring-1 ring-primary-600' : 'border-gray-300 hover:border-primary-400'"
      >
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1 flex items-start gap-4">
            <MapPin class="h-6 w-6 mt-1 flex-shrink-0" :class="selectedAddressId === address.id ? 'text-primary-600' : 'text-gray-400 group-hover:text-primary-600'" />
            <div>
              <h3 class="font-semibold text-gray-900" :class="{'group-hover:text-primary-600': selectedAddressId !== address.id}">{{ address.label || 'Location' }}</h3>
              <p class="text-gray-600 text-sm mt-1">{{ address.street_address }}</p>
              <p class="text-gray-500 text-xs">{{ address.city }}, {{ address.state }} {{ address.postal_code }}</p>
            </div>
          </div>
          
          <!-- Map Preview -->
          <div class="w-full md:w-80 h-40 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
            <iframe 
              :src="getMapUrl(address)" 
              width="100%" 
              height="100%" 
              style="border:0;" 
              allowfullscreen 
              loading="lazy" 
              referrerpolicy="no-referrer-when-downgrade"
              class="w-full h-full"
            ></iframe>
          </div>
        </div>
        <a 
          :href="getDirectionsUrl(address)" 
          target="_blank" 
          rel="noopener noreferrer"
          class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          @click.stop
        >
          <Navigation class="h-4 w-4" />
          {{ $t('booking.get_directions') }}
        </a>
      </div>
    </div>

    <div class="mt-8 pt-6 border-t border-gray-100 flex justify-end">
      <button 
        type="button"
        class="booking-primary-command"
        @click="emit('confirm')" 
        :disabled="!selectedAddressId"
      >
        Continue <span class="ml-2">→</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.booking-back-command {
  @apply mb-4 inline-flex items-center rounded-md text-sm font-medium text-gray-600 transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2;
}

.booking-primary-command {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-8 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
}
</style>
