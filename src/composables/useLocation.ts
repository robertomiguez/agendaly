import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'

interface LocationData {
  city: string | null
  region: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  location: string | null // Pre-formatted "City, Region" string
}

const CACHE_KEY = 'user_location'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Global state (Singleton) - Defined outside the function to share state
const city = ref<string | null>(null)
const region = ref<string | null>(null)
const country = ref<string | null>(null)

const location = ref<string | null>(null) // Formatted "City, Region"
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const initialized = ref(false)

/**
 * Composable for getting user's location.
 * Uses a hybrid approach:
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
   * Save location to localStorage cache
   */
  function saveToCache(data: LocationData): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch {
      // localStorage might be full or disabled
    }
  }

  /**
   * Apply location data to refs
   */
  function applyLocation(data: LocationData): void {
    city.value = data.city
    region.value = data.region

    country.value = data.country
    location.value = data.location
    latitude.value = data.latitude
    longitude.value = data.longitude
  }

  /**
   * Fetch location from Edge Function (IP-based)
   */
  async function fetchFromEdge(): Promise<LocationData | null> {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-location')
      
      if (fnError) {
        console.warn('Edge function error:', fnError)
        return null
      }
      
      return data as LocationData
    } catch (err) {
      console.warn('Failed to fetch location from edge:', err)
      return null
    }
  }

  /**
   * Get precise location using browser Geolocation API
   * Returns a promise that resolves to formatted location string
   */
  async function requestPreciseLocation(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Use OpenStreetMap Nominatim for reverse geocoding (free)
            const { latitude, longitude } = position.coords
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { 'Accept-Language': navigator.language || 'en' } }
            )
            
            if (!response.ok) {
              resolve(null)
              return
            }

            const data = await response.json()
            const preciseCity = data.address?.city || data.address?.town || data.address?.village
            const preciseRegion = data.address?.state || data.address?.county
            
            if (preciseCity) {
              const preciseLocation = preciseRegion 
                ? `${preciseCity}, ${preciseRegion}`
                : preciseCity
              
              // Update refs and cache
              const locationData = {
                city: preciseCity,
                region: preciseRegion || null,
                country: data.address?.country || null,
                latitude,
                longitude,
                location: preciseLocation
              }
              
              applyLocation(locationData)
              saveToCache(locationData)
              
              resolve(preciseLocation)
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        },
        () => {
          // User denied or error
          resolve(null)
        },
        { timeout: 5000, maximumAge: 300000 }
      )
    })
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

      // Step 2: Fetch from Edge Function
      const edgeData = await fetchFromEdge()
      if (edgeData?.location) {
        applyLocation(edgeData)
        saveToCache(edgeData)
        loading.value = false
        initialized.value = true
        return
      }

      // Step 3: If IP-based detection failed, try browser geolocation
      // This will trigger the browser permission prompt
      await requestPreciseLocation()
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
    country,
    location,
    loading,
    error,

    requestPreciseLocation,
    refresh: async () => {
        initialized.value = false
        await initLocation()
    },
    latitude,
    longitude
  }
}
