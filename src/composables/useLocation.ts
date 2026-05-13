import { ref, onMounted } from 'vue'

interface LocationData {
  city: string | null
  region: string | null
  country_name: string | null
  country_code: string | null
  country?: string | null
  latitude: number | null
  longitude: number | null
  location: string | null // Pre-formatted "City, Region" string
  source?: 'edge' | 'browser'
}

const CACHE_KEY = 'user_location'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Global state (Singleton) - Defined outside the function to share state
const city = ref<string | null>(null)
const region = ref<string | null>(null)
const country_name = ref<string | null>(null)
const country_code = ref<string | null>(null)

const location = ref<string | null>(null) // Formatted "City, Region"
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const initialized = ref(false)
const isPreciseLocation = ref(false)

/**
 * Composable for getting user's location.
 * Marketplace localization is disabled for now.
 * The previous flow used:
 * 1. Immediate: Check localStorage cache
 * 2. Background: Fetch from Edge Function (IP-based)
 * 3. Optional: Request precise location via browser Geolocation API
 * 
 * Note: Uses singleton pattern so state is shared across the app.
 */
export function useLocation() {
  /**
   * Load cached location from localStorage
   */
  function loadFromCache(): LocationData | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const { data, timestamp } = JSON.parse(cached)
      

      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_DURATION) {
        // Ensure we have coordinates (legacy cache might not have them)
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            return data
        }
      }
      
      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY)
      return null
    } catch {
      return null
    }
  }

  /**
   * Apply location data to refs
   */
  function applyLocation(data: LocationData): void {
    city.value = data.city || null
    region.value = data.region || null

    country_name.value = data.country_name || null
    country_code.value = data.country_code || data.country?.toUpperCase() || null
    location.value = data.location || null
    latitude.value = data.latitude ?? null
    longitude.value = data.longitude ?? null
    isPreciseLocation.value = data.source === 'browser'
  }

  // IP-based Edge Function lookup disabled for now.
  // Restore this with the supabase import when marketplace region detection is needed again.
  // async function fetchFromEdge(): Promise<LocationData | null> {
  //   try {
  //     const { data, error: fnError } = await supabase.functions.invoke('get-location')
  //
  //     if (fnError) {
  //       console.warn('Edge function error:', fnError)
  //       return null
  //     }
  //
  //     return data as LocationData
  //   } catch (err) {
  //     console.warn('Failed to fetch location from edge:', err)
  //     return null
  //   }
  // }

  /**
   * Get precise location using browser Geolocation API
   * Returns a promise that resolves to formatted location string
   */
  async function requestPreciseLocation(): Promise<string | null> {
    // Browser geolocation disabled to avoid permission prompts.
    // Restore the previous precise-location flow here if marketplace
    // precise-location features are needed again.
    return null
  }

  /**
   * Initialize location detection
   * Called automatically on mount
   */
  async function initLocation(): Promise<void> {
    if (initialized.value || location.value) return // Don't re-init if already done

    loading.value = true
    error.value = null

    try {
      // Step 1: Try cache first (instant)
      const cached = loadFromCache()
      if (cached?.location) {
        applyLocation(cached)
        loading.value = false
        initialized.value = true
        return
      }

      // Marketplace region detection disabled for now.
      // Previous IP-based detection:
      // const edgeData = await fetchFromEdge()
      // if (edgeData?.location) {
      //   const locationData = { ...edgeData, source: 'edge' as const }
      //   applyLocation(locationData)
      //   saveToCache(locationData)
      //   loading.value = false
      //   initialized.value = true
      //   return
      // }

      // Browser geolocation fallback disabled to avoid permission prompts.
      // await requestPreciseLocation()
      initialized.value = true
    } catch (err: any) {
      error.value = err.message || 'Failed to get location'
    } finally {
      loading.value = false
    }
  }

  // Auto-initialize on mount
  onMounted(() => {
    initLocation()
  })

  return {
    city,
    region,
    country_name,
    country_code,
    location,
    loading,
    error,

    requestPreciseLocation,
    refresh: async () => {
        initialized.value = false
        await initLocation()
    },
    latitude,
    longitude,
    isPreciseLocation
  }
}
