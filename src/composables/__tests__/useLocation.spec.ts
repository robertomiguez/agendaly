import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}))

// Mock Vue onMounted to avoid side effects
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: vi.fn(), // No-op
  }
})

// Mock global objects
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock Navigator Geolocation
const geolocationMock = {
  getCurrentPosition: vi.fn()
}

Object.defineProperty(window.navigator, 'geolocation', {
  value: geolocationMock,
  writable: true
})

// Mock global fetch for reverse geocoding
globalThis.fetch = vi.fn()

// Import AFTER mocks
import { useLocation } from '../useLocation'

describe('useLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    
    // Reset singleton state manually
    const { city, region, country_name, country_code, location, error, loading, isPreciseLocation, latitude, longitude } = useLocation()
    city.value = null
    region.value = null
    country_name.value = null
    country_code.value = null
    location.value = null
    latitude.value = null
    longitude.value = null
    error.value = null
    loading.value = false
    isPreciseLocation.value = false
    
    // We also need to hack the 'initialized' ref if possible, 
    // but since it's not exported, we rely on 'refresh()' 
    // which sets initialized = false.
  })

  it('1. Loads location from localStorage if valid', async () => {
    // Setup cache
    const cachedData = {
      city: 'Cached City',
      region: 'Cached Region',
      country_name: 'Cached Country',
      country_code: 'CC',
      location: 'Cached City, Cached Region',
      latitude: 10,
      longitude: 20
    }
    localStorageMock.setItem('user_location', JSON.stringify({
      data: cachedData,
      timestamp: Date.now()
    }))

    const { city, refresh } = useLocation()
    await refresh()

    expect(city.value).toBe('Cached City')
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('2. Does not call Edge Function if cache is missing', async () => {
    const { city, refresh, isPreciseLocation } = useLocation()
    await refresh()

    expect(city.value).toBeNull()
    expect(isPreciseLocation.value).toBe(false)
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('3. Does not request Browser Geolocation if cache is missing', async () => {
    const { city, refresh, isPreciseLocation } = useLocation()
    await refresh()

    expect(city.value).toBeNull()
    expect(isPreciseLocation.value).toBe(false)
    expect(geolocationMock.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('does not set browser coordinates when precise location is disabled', async () => {
    const { latitude, longitude, isPreciseLocation, refresh } = useLocation()
    await refresh()

    expect(latitude.value).toBeNull()
    expect(longitude.value).toBeNull()
    expect(isPreciseLocation.value).toBe(false)
    expect(geolocationMock.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('4. Singleton Behavior: State is shared', async () => {
    const { city } = useLocation()
    
    // Force a specific state
    city.value = 'Shared City'

    // Call useLocation again in a "different component"
    const { city: city2 } = useLocation()

    expect(city2.value).toBe('Shared City')
  })
  
  it('5. Leaves error empty when disabled location detection is unavailable', async () => {
    const { error, refresh } = useLocation()
    await refresh()
    
    expect(error.value).toBeNull()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    expect(geolocationMock.getCurrentPosition).not.toHaveBeenCalled()
  })
})
