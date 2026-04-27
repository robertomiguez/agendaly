<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, MapPin, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useLocation } from '@/composables/useLocation'
import { supabase } from '@/lib/supabase'

const props = defineProps<{
  initialLocation?: string
}>()

const emit = defineEmits<{
  search: [{ location: string, lat?: number, lng?: number }]
}>()

const { t, locale } = useI18n()
const { location: userLocation } = useLocation()

const location = ref(props.initialLocation || '')
const selectedLat = ref<number | undefined>()
const selectedLng = ref<number | undefined>()

watch(() => props.initialLocation, (newVal) => {
  if (newVal !== undefined && newVal !== location.value) {
    location.value = newVal
  }
})

const locationPlaceholder = computed(() => userLocation.value || t('search.location_placeholder'))

// Photon Autocomplete Logic
interface PhotonFeature {
  geometry: {
    coordinates: [number, number] // [lon, lat]
  }
  properties: {
    name: string
    city?: string
    state?: string
    country?: string
    osm_id: number
  }
}

const suggestions = ref<PhotonFeature[]>([])
const isSearching = ref(false)
const showSuggestions = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

function formatAddress(props: any) {
  const parts = [props.name]
  if (props.state && props.state !== props.name) parts.push(props.state)
  if (props.country) parts.push(props.country)
  return parts.join(', ')
}

async function fetchSuggestions(query: string) {
  if (!query || query.length < 3) {
    suggestions.value = []
    return
  }
  
  isSearching.value = true
  
  // Map our locales to Photon supported languages (default uses the location's native language, perfect for PT in Brazil)
  const langParam = locale.value.startsWith('pt') ? 'default' : (locale.value.startsWith('fr') ? 'fr' : 'en')
  
  try {
    // Using our Edge Function (with DB cache) instead of direct Photon call
    const { data, error } = await supabase.functions.invoke('search-locations', {
      body: { q: query, lang: langParam }
    })
    
    if (error) throw error
    suggestions.value = data?.features || []
  } catch (error) {
    console.error('Failed to fetch location suggestions', error)
  } finally {
    isSearching.value = false
  }
}

function onInput() {
  selectedLat.value = undefined
  selectedLng.value = undefined
  showSuggestions.value = true
  
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchSuggestions(location.value)
  }, 400)
}

function selectSuggestion(feature: PhotonFeature) {
  const [lng, lat] = feature.geometry.coordinates
  location.value = formatAddress(feature.properties)
  selectedLat.value = lat
  selectedLng.value = lng
  showSuggestions.value = false
  suggestions.value = []
  
  // Auto-search when selected
  handleSearch() 
}

function handleSearch() {
  showSuggestions.value = false
  emit('search', {
    location: location.value,
    lat: selectedLat.value,
    lng: selectedLng.value
  })
}

// Close suggestions on click outside
const searchContainer = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (searchContainer.value && !searchContainer.value.contains(event.target as Node)) {
    showSuggestions.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="searchContainer" class="flex flex-col md:flex-row gap-3 items-stretch p-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 shadow-2xl relative">
    <!-- Location Input -->
    <div class="flex-1 flex items-center px-4 py-2 bg-white rounded-lg shadow-sm border border-transparent focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200 transition-all relative z-20">
      <MapPin class="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
      <div class="flex-1">
        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">{{ $t('search.location_label') }}</label>
        <input
          v-model="location"
          @input="onInput"
          @focus="showSuggestions = location.length >= 3"
          @keydown.enter="handleSearch"
          type="text"
          :placeholder="locationPlaceholder"
          class="w-full outline-none text-gray-900 placeholder-gray-400 bg-transparent text-sm font-medium"
        />
      </div>
      <div v-if="isSearching" class="absolute right-4 top-1/2 -translate-y-1/2">
        <Loader2 class="w-5 h-5 text-primary-500 animate-spin" />
      </div>
    </div>

    <!-- Dropdown Suggestions -->
    <div 
      v-if="showSuggestions && suggestions.length > 0" 
      class="absolute left-2 right-2 md:right-[150px] top-[calc(100%+8px)] bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-50"
    >
      <ul class="max-h-60 overflow-y-auto py-2">
        <li 
          v-for="suggestion in suggestions" 
          :key="suggestion.properties.osm_id"
          @click="selectSuggestion(suggestion)"
          class="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors flex items-start gap-3"
        >
          <MapPin class="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <div class="text-sm font-medium text-gray-900">{{ suggestion.properties.name }}</div>
            <div class="text-xs text-gray-500">{{ formatAddress(suggestion.properties) }}</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Search Button -->
    <div class="flex items-center relative z-20">
      <Button
        @click="handleSearch"
        size="lg"
        class="h-14 w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white px-8 rounded-lg font-bold shadow-lg transition-all hover:scale-105"
      >
        <Search class="w-5 h-5 mr-2" />
        {{ $t('search.button') }}
      </Button>
    </div>
  </div>
</template>
