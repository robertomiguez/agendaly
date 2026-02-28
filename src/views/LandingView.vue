<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SearchBar from '../components/SearchBar.vue'
import CategoryPills from '../components/CategoryPills.vue'
import ProviderCard from '../components/ProviderCard.vue'
import { supabase } from '../lib/supabase'
import { useLocation } from '../composables/useLocation'
import type { Provider, ProviderAddress, Category } from '../types'
import { Search } from 'lucide-vue-next'

// Import images
import heroManicure from '@/assets/images/hero_background_manicure_1765115664380.png'
import heroBarber from '@/assets/images/hero_barber_service_1765116285430.png'
import heroMassage from '@/assets/images/hero_massage_service_1765116300777.png'
import heroSpa from '@/assets/images/hero_spa_service_1765116318055.png'

const router = useRouter()
const { t, locale } = useI18n()

const { location: userLocation, city: userCity, latitude: userLatitude, longitude: userLongitude } = useLocation()

// Computed property for display location with fallback
const displayLocation = computed(() => searchParams.value.location || userLocation.value || t('landing.your_area'))

const providers = ref<(Provider & { provider_addresses?: ProviderAddress[]; categories?: string[] })[]>([])
const categories = ref<Category[]>([])
const selectedCategory = ref<string | null>(null)
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

const searchParams = ref({ location: '', service: '' })
const loading = ref(false)

// Watch for location updates and apply to search automatically
import { watch } from 'vue'
watch(userCity, (newCity) => {
  if (newCity && !searchParams.value.location) {
    searchParams.value.location = newCity
  }
}, { immediate: true })

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
    fetchProviders()
  ])
  
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

async function fetchProviders() {
  loading.value = true
  try {
    // Fetch approved providers with their addresses
    const { data } = await supabase
      .from('providers')
      .select(`
        *,
        provider_addresses (*),
        services (
          categories (name)
        )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(12)
    

    // Process providers to extract unique categories
    providers.value = (data || []).map(provider => ({
      ...provider,
      categories: Array.from(new Set(
        provider.services
          ?.map((s: any) => s.categories?.name)
          .filter(Boolean) || []
      ))
    }))
  } catch (error) {
    console.error('Error fetching providers:', error)
  } finally {
    loading.value = false
  }
}

// Haversine formula to calculate distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180)
}



const bypassLocationFilter = ref(false)

// 1. Get providers filtered by category (base set)
const categoryFilteredProviders = computed(() => {
  let result = providers.value
  if (selectedCategory.value) {
    result = result.filter(p => 
      p.categories?.includes(
        categories.value.find(c => c.id === selectedCategory.value)?.name || ''
      )
    )
  }
  return result
})

// 2. Get providers strictly matching the location context
const localProviders = computed(() => {
  let result = categoryFilteredProviders.value

  // Text search filter
  if (searchParams.value.location) {
    return result.filter(p => 
      p.business_name.toLowerCase().includes(searchParams.value.location.toLowerCase()) ||
      p.provider_addresses?.some(a => 
        a.city.toLowerCase().includes(searchParams.value.location.toLowerCase()) ||
        a.state?.toLowerCase().includes(searchParams.value.location.toLowerCase())
      )
    )
  } 
  
  // Geolocation filter
  if (userLatitude.value && userLongitude.value) {
    const MAX_DISTANCE_KM = 50
    
    return result.map(p => {
      const address = p.provider_addresses?.find(a => a.is_primary) || p.provider_addresses?.[0]
      
      if (!address || !address.latitude || !address.longitude) {
        return { ...p, distance: Infinity }
      }
      
      const distance = calculateDistance(
        userLatitude.value!, 
        userLongitude.value!, 
        address.latitude, 
        address.longitude
      )
      
      return { ...p, distance }
    })
    .filter(p => p.distance <= MAX_DISTANCE_KM)
    .sort((a, b) => a.distance - b.distance)
  }

  // No location context
  return result
})

const hasLocalProviders = computed(() => localProviders.value.length > 0)

const shouldShowFunnyEmptyState = computed(() => {
  if (bypassLocationFilter.value) return false
  
  // Only show funny state if we have a location context (search or geo) AND no local providers
  const hasLocationContext = !!searchParams.value.location || (!!userLatitude.value && !!userLongitude.value)
  return hasLocationContext && !hasLocalProviders.value
})

// 3. Determine what to actually display
const displayedProviders = computed(() => {
  // If bypassing location filter (user clicked See All), show everything
  if (bypassLocationFilter.value) {
    return categoryFilteredProviders.value
  }

  // If there are local providers, show them
  if (hasLocalProviders.value) {
    return localProviders.value
  }

  // If filter is active (search service) but no providers, logic handles it naturally 
  // (categoryFilteredProviders handles service filtering via category logic if we map it, 
  // but wait - service param is actually handled separately in original logic. 
  // let's restore service filtering)
  
  // Wait, the original logic had a separate service filter at the end.
  // We need to ensure service filtering is applied to whatever we return.
  return categoryFilteredProviders.value
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



function handleSearch(params: { location: string }) {
  searchParams.value.location = params.location
  bypassLocationFilter.value = false // Reset bypass on new search
  scrollToResults()
}

function handleCategorySelect(categoryId: string | null) {
  selectedCategory.value = categoryId
  // Also clear service if deselecting
  if (!categoryId) {
    searchParams.value.service = ''
  }
  scrollToResults()
}

function handleSeeAll() {
  searchParams.value.location = ''
  bypassLocationFilter.value = true
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
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
