<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, MapPin, Loader2 } from 'lucide-vue-next'
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
    country_name?: string
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
  if (props.country_name) parts.push(props.country_name)
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
  <div ref="searchContainer" class="search-shell">
    <!-- Location Input -->
    <div class="search-field">
      <MapPin class="search-field__icon" />
      <div class="search-field__body">
        <label class="search-field__label">{{ $t('search.location_label') }}</label>
        <input
          v-model="location"
          @input="onInput"
          @focus="showSuggestions = location.length >= 3"
          @keydown.enter="handleSearch"
          type="text"
          :placeholder="locationPlaceholder"
          class="search-field__input"
        />
      </div>
      <div v-if="isSearching" class="search-field__loading">
        <Loader2 class="search-field__loading-icon" />
      </div>
    </div>

    <!-- Dropdown Suggestions -->
    <div 
      v-if="showSuggestions && suggestions.length > 0" 
      class="search-suggestions"
    >
      <ul class="search-suggestions__list">
        <li 
          v-for="suggestion in suggestions" 
          :key="suggestion.properties.osm_id"
          @click="selectSuggestion(suggestion)"
          class="search-suggestion"
        >
          <MapPin class="search-suggestion__icon" />
          <div>
            <div class="search-suggestion__name">{{ suggestion.properties.name }}</div>
            <div class="search-suggestion__address">{{ formatAddress(suggestion.properties) }}</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Search Button -->
    <div class="search-actions">
      <button
        type="button"
        @click="handleSearch"
        class="search-command"
      >
        <Search class="search-command__icon" />
        {{ $t('search.button') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";

.search-shell {
  @apply relative flex flex-col items-stretch gap-3 rounded-xl border border-white/30 bg-white/20 p-2 shadow-2xl backdrop-blur-sm md:flex-row;
}

.search-field {
  @apply relative z-20 flex flex-1 items-center rounded-lg border border-transparent bg-white px-4 py-2 shadow-sm transition-all focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200;
}

.search-field__icon {
  @apply mr-3 h-5 w-5 flex-shrink-0 text-gray-400;
}

.search-field__body {
  @apply flex-1;
}

.search-field__label {
  @apply mb-0.5 block text-xs font-bold uppercase tracking-wider text-gray-500;
}

.search-field__input {
  @apply w-full bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400;
}

.search-field__loading {
  @apply absolute right-4 top-1/2 -translate-y-1/2;
}

.search-field__loading-icon {
  @apply h-5 w-5 animate-spin text-primary-500;
}

.search-suggestions {
  @apply absolute left-2 right-2 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl md:right-[150px];
}

.search-suggestions__list {
  @apply max-h-60 overflow-y-auto py-2;
}

.search-suggestion {
  @apply flex cursor-pointer items-start gap-3 border-b border-gray-50 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50;
}

.search-suggestion__icon {
  @apply mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400;
}

.search-suggestion__name {
  @apply text-sm font-medium text-gray-900;
}

.search-suggestion__address {
  @apply text-xs text-gray-500;
}

.search-actions {
  @apply relative z-20 flex items-center;
}

.search-command {
  @apply inline-flex h-14 w-full items-center justify-center rounded-lg bg-primary-600 px-8 font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 md:w-auto;
}

.search-command__icon {
  @apply mr-2 h-5 w-5;
}
</style>
