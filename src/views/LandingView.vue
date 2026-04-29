<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SearchBar from '../components/SearchBar.vue'
import CategoryPills from '../components/CategoryPills.vue'
import ProviderCard from '../components/ProviderCard.vue'
import { supabase } from '../lib/supabase'
import { useLocation } from '../composables/useLocation'
import { fetchDiscoverableProviders } from '../services/providerService'
import { detectCountryCode } from '../services/geo'
import type { Provider, ProviderAddress, Category } from '../types'
import { Search, ChevronDown } from 'lucide-vue-next'

// Import images
import heroManicure from '@/assets/images/hero_background_manicure_1765115664380.png'
import heroBarber from '@/assets/images/hero_barber_service_1765116285430.png'
import heroMassage from '@/assets/images/hero_massage_service_1765116300777.png'
import heroSpa from '@/assets/images/hero_spa_service_1765116318055.png'

const router = useRouter()
const { t, locale } = useI18n()

const { location: userLocation, latitude: userLatitude, longitude: userLongitude, isPreciseLocation } = useLocation()

// Track the location string actually used for the last successful search
const searchedLocation = ref('')
const displayLocation = computed(() => searchedLocation.value || searchParams.value.location || userLocation.value || t('landing.your_area'))

const providers = ref<(Provider & { provider_addresses?: ProviderAddress[]; categories?: string[] })[]>([])
const categories = ref<Category[]>([])
const selectedCategory = ref<string | null>(null)

const currentPage = ref(1)
const pageSize = 8
const totalCount = ref(0)
const hasMore = computed(() => providers.value.length < totalCount.value)

const selectedCategoryName = computed(() => {
  const category = categories.value.find(c => c.id === selectedCategory.value)
  return category ? category.name : ''
})

const selectedCategoryPluralName = computed(() => {
  const name = selectedCategoryName.value
  if (!name) return ''
  return pluralize(name, locale.value as string)
})

function pluralize(word: string, localeCode: string): string {
  if (!word) return ''
  const lower = word.toLowerCase()
  
  if (localeCode.startsWith('pt')) {
    // Portuguese rules
    if (lower.endsWith('m')) return word.slice(0, -1) + 'ns'
    if (lower.endsWith('ão')) return word.slice(0, -2) + 'ões'
    if (lower.endsWith('r') || lower.endsWith('z') || lower.endsWith('s')) return word + 'es'
    if (lower.endsWith('l')) {
      if (lower.endsWith('al')) return word.slice(0, -1) + 'is'
      if (lower.endsWith('el')) return word.slice(0, -2) + 'éis'
      if (lower.endsWith('ol')) return word.slice(0, -2) + 'óis'
      if (lower.endsWith('ul')) return word.slice(0, -2) + 'uis'
    }
  } else if (localeCode.startsWith('en')) {
    // English rules
    if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) return word.slice(0, -1) + 'ies'
    if (lower.endsWith('s') || lower.endsWith('sh') || lower.endsWith('ch') || lower.endsWith('x') || lower.endsWith('z')) return word + 'es'
  } else if (localeCode.startsWith('fr')) {
    // French rules
    if (lower.endsWith('al')) return word.slice(0, -1) + 'ux'
    if (lower.endsWith('eau')) return word + 'x'
    if (lower.endsWith('eu')) return word + 'x'
    if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) return word
  }
  
  // Default for all: add 's'
  return word + 's'
}

const searchParams = ref({ location: '', lat: undefined as number | undefined, lng: undefined as number | undefined })
const loading = ref(false)
const detectedCountryCode = ref<string | null>(null)

watch([isPreciseLocation, userLatitude, userLongitude], ([isPrecise, lat, lng]) => {
  if (!isPrecise || lat === null || lng === null) return
  if (searchParams.value.location || bypassLocationFilter.value) return

  searchedLocation.value = userLocation.value || ''
  fetchProviders()
})

// Rotating hero content
const heroOptions = [
  {
    service: 'manicure',
    image: heroManicure
  },
  {
    service: 'haircut',
    image: heroBarber
  },
  {
    service: 'massage',
    image: heroMassage
  },
  {
    service: 'spa',
    image: heroSpa
  }
]

const currentHeroIndex = ref(0)
let rotationInterval: number | null = null

const currentHero = computed(() => (heroOptions[currentHeroIndex.value] ?? heroOptions[0])!)

const heroBackgroundImage = computed(() => 
  `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${currentHero.value.image}')`
)

function rotateHero() {
  // Get random index different from current
  let newIndex = currentHeroIndex.value
  while (newIndex === currentHeroIndex.value) {
    newIndex = Math.floor(Math.random() * heroOptions.length)
  }
  currentHeroIndex.value = newIndex
}

onMounted(async () => {
  await Promise.all([
    fetchCategories(),
    detectCountry()
  ])
  await fetchProviders()
  
  // Start rotation
  rotationInterval = window.setInterval(rotateHero, 3000)
})

onUnmounted(() => {
  if (rotationInterval) {
    clearInterval(rotationInterval)
  }
})

async function fetchCategories() {
  try {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    
    categories.value = data || []
  } catch (error) {
    console.error('Error fetching categories:', error)
  }
}

async function detectCountry() {
  detectedCountryCode.value = await detectCountryCode()
}

// Store the active filters used for the current search so pagination doesn't break if inputs change mid-way
const activeFilters = ref({
  categoryId: null as string | null,
  searchTerm: '' as string | null,
  userLat: null as number | null,
  userLng: null as number | null,
  countryCode: null as string | null
})

let currentFetchId = 0

async function fetchProviders(append = false) {
  const fetchId = ++currentFetchId

  if (!append) {
    currentPage.value = 1
    providers.value = []
    
    // If we have a geocoded search location, use that for coordinates
    const hasGeocodedLocation = searchParams.value.lat !== undefined && searchParams.value.lng !== undefined
    
    let finalSearchTerm = null
    let finalLat = null
    let finalLng = null
    let finalCountryCode = null

    if (hasGeocodedLocation) {
      // User used Maps autocomplete - use strict radius search
      finalLat = searchParams.value.lat!
      finalLng = searchParams.value.lng!
    } else if (searchParams.value.location) {
      // Manual text search - ignore system country filter
      finalSearchTerm = searchParams.value.location
    } else if (!bypassLocationFilter.value) {
      if (isPreciseLocation.value && userLatitude.value !== null && userLongitude.value !== null) {
        finalLat = userLatitude.value
        finalLng = userLongitude.value
      } else {
        // Empty search bar, but not 'See All' - default to system/IP country detection
        finalCountryCode = detectedCountryCode.value
      }
    }
    
    // Capture filters when starting a new search
    activeFilters.value = {
      categoryId: selectedCategory.value,
      searchTerm: finalSearchTerm,
      userLat: finalLat,
      userLng: finalLng,
      countryCode: finalCountryCode
    }
  }

  loading.value = true
  try {
    const { providers: newProviders, totalCount: count } = await fetchDiscoverableProviders({
      categoryId: activeFilters.value.categoryId,
      searchTerm: activeFilters.value.searchTerm,
      userLat: activeFilters.value.userLat,
      userLng: activeFilters.value.userLng,
      countryCode: activeFilters.value.countryCode,
      page: currentPage.value,
      pageSize
    })
    
    // Ignore stale responses
    if (fetchId !== currentFetchId) return

    if (append) {
      providers.value = [...providers.value, ...newProviders]
    } else {
      providers.value = newProviders
    }
    
    // Only update totalCount if we got a valid count, or if this is the initial load.
    // This prevents the "Load More" button from vanishing if a pagination call returns empty.
    if (count > 0 || !append) {
      totalCount.value = count
    }
  } catch (error) {
    if (fetchId !== currentFetchId) return
    console.error('Error fetching providers:', error)
  } finally {
    if (fetchId === currentFetchId) {
      loading.value = false
    }
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  currentPage.value++
  await fetchProviders(true)
}

const bypassLocationFilter = ref(false)

const shouldShowFunnyEmptyState = computed(() => {
  if (bypassLocationFilter.value) return false
  
  // Only show funny state if we have a location context (search or geo) AND no providers found
  const hasLocationContext = !!searchParams.value.location || !!detectedCountryCode.value
  return hasLocationContext && providers.value.length === 0
})

const displayedProviders = computed(() => {
  return providers.value.map(p => ({
    ...p,
    distance: (p as any).distance_meters ? (p as any).distance_meters / 1000 : null
  }))
})

// Apply service filter (if strict match needed beyond category) - 
// actually the original logic filtered by category OR service param. 
// The prompt removed service input, but code might still rely on searchParams.service if passed?
// Assuming searchParams.service is effectively cleared or unused now based on previous steps, 
// but let's keep consistency with `categoryFilteredProviders`.


const resultsSection = ref<HTMLElement | null>(null)

function scrollToResults() {
  if (resultsSection.value && window.innerWidth < 768) {
    resultsSection.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}



function handleSearch(params: { location: string, lat?: number, lng?: number }) {
  searchParams.value.location = params.location
  searchParams.value.lat = params.lat
  searchParams.value.lng = params.lng
  searchedLocation.value = params.location
  bypassLocationFilter.value = false
  fetchProviders()
  scrollToResults()
}

function handleCategorySelect(categoryId: string | null) {
  selectedCategory.value = categoryId
  fetchProviders()
  scrollToResults()
}

function handleSeeAll() {
  searchParams.value.location = ''
  searchParams.value.lat = undefined
  searchParams.value.lng = undefined
  selectedCategory.value = null
  bypassLocationFilter.value = true
  fetchProviders()
  scrollToResults()
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Hero Section with Background Image -->
    <div 
      class="relative bg-cover bg-center min-h-[600px] md:h-[500px] flex items-center transition-all duration-1000"
      :style="{ backgroundImage: heroBackgroundImage }"
    >
      <div class="max-w-7xl mx-auto px-6 w-full py-16 md:py-0">
        <div class="max-w-3xl">
          <h1 class="text-5xl lg:text-6xl font-bold text-white mb-6 min-h-[3.6em] lg:min-h-[2.4em] flex flex-col justify-center">
            {{ $t('landing.hero_title') }} 
            <span class="inline-block transition-all duration-500">{{ $t(`landing.hero_services.${currentHero.service}`) }}</span>
          </h1>
          
          <!-- Search Bar -->
          <SearchBar 
            :initial-location="searchParams.location" 
            @search="handleSearch" 
          />
          
          <!-- Category Pills -->
          <div class="mt-10">
            <CategoryPills 
              :categories="categories"
              :selected-category="selectedCategory"
              @select="handleCategorySelect"
              @select-all="handleSeeAll"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Popular Providers Section -->
    <div ref="resultsSection" class="max-w-7xl mx-auto px-6 py-12 scroll-mt-24">
      <div class="mb-8">

        <h2 class="text-3xl font-bold text-gray-900 mb-2">
          <template v-if="bypassLocationFilter">
             {{ $t('landing.all_providers_title') }}
          </template>
          <template v-else-if="shouldShowFunnyEmptyState">
            {{ selectedCategoryName ? $t('landing.no_service_funny', { service: selectedCategoryPluralName, city: searchParams.location || displayLocation }) : $t('landing.no_providers_funny', { city: searchParams.location || displayLocation }) }}
            <span class="block text-lg font-normal text-gray-500 mt-2">{{ $t('landing.popular_places') }}</span>
          </template>
          <template v-else>
            {{ selectedCategoryName ? $t('landing.popular_service_in', { service: selectedCategoryPluralName, location: displayLocation }) : $t('landing.popular_in', { location: displayLocation }) }}
          </template>
          <span 
            v-if="!bypassLocationFilter"
            @click="handleSeeAll"
            class="text-base font-normal text-primary-600 hover:text-primary-700 ml-4 cursor-pointer hover:underline"
          >
            {{ $t('nav.see_all') }} →
          </span>
        </h2>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p class="text-gray-500 mt-4">{{ $t('common.loading') }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="displayedProviders.length === 0" class="text-center py-12">
        <Search class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('landing.no_providers_found') }}</h3>
        <p class="text-gray-600">{{ $t('landing.adjust_search') }}</p>
      </div>

      <!-- Provider Grid -->
      <div v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <ProviderCard
            v-for="provider in displayedProviders"
            :key="provider.id"
            :provider="provider"
            :rating="5.0"
            :review-count="Math.floor(Math.random() * 100) + 10"
            :categories="provider.categories"
            @click="router.push(`/booking?provider=${provider.id}`)"
          />
        </div>

        <!-- Load More -->
        <div v-if="hasMore" class="mt-12 text-center">
          <button 
            @click="loadMore"
            :disabled="loading"
            class="inline-flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded-full text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <template v-if="loading">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
              {{ $t('common.loading') }}
            </template>
            <template v-else>
              {{ $t('common.load_more') }}
              <ChevronDown class="w-4 h-4" />
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- How It Works Section -->
    <div class="bg-gray-50 py-20">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-bold text-gray-900 mb-4">{{ $t('landing.how_it_works_title') }}</h2>
          <p class="text-xl text-gray-600">{{ $t('landing.how_it_works_subtitle') }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div class="text-center">
            <div class="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ $t('landing.steps.browse_title') }}</h3>
            <p class="text-gray-600">{{ $t('landing.steps.browse_desc') }}</p>
          </div>

          <div class="text-center">
            <div class="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ $t('landing.steps.time_title') }}</h3>
            <p class="text-gray-600">{{ $t('landing.steps.time_desc') }}</p>
          </div>

          <div class="text-center">
            <div class="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ $t('landing.steps.book_title') }}</h3>
            <p class="text-gray-600">{{ $t('landing.steps.book_desc') }}</p>
          </div>
        </div>
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
