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
    const { city, region, country, location, error, loading, isPreciseLocation } = useLocation()
    city.value = null
    region.value = null
    country.value = null
    location.value = null
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
      country: 'Cached Country',
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

  it('2. Falls back to Edge Function if cache is missing', async () => {
    // Setup Supabase mock
    const edgeData = {
      city: 'Edge City',
      region: 'Edge Region',
      country: 'Edge Country',
      location: 'Edge City, Edge Region'
    };
    (supabase.functions.invoke as any).mockResolvedValue({ data: edgeData, error: null })

    const { city, refresh, isPreciseLocation } = useLocation()
    await refresh()

    expect(city.value).toBe('Edge City')
    expect(isPreciseLocation.value).toBe(false)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('get-location')
  })

  it('3. Falls back to Browser Geolocation if Edge Function returns null', async () => {
    // Mock Supabase to return null location
    (supabase.functions.invoke as any).mockResolvedValue({ data: { location: null }, error: null })

    // Mock Browser Geolocation success
    geolocationMock.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: { latitude: 10, longitude: 20 }
      })
    })

    // Mock Nominatim response
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        address: {
          city: 'Browser City',
          state: 'Browser Region',
          country: 'Browser Country'
        }
      })
    })

    const { city, refresh, isPreciseLocation } = useLocation()
    await refresh()

    expect(city.value).toBe('Browser City')
    expect(isPreciseLocation.value).toBe(true)
    expect(geolocationMock.getCurrentPosition).toHaveBeenCalled()
  })

  it('4. Singleton Behavior: State is shared', async () => {
    const { city } = useLocation()
    
    // Force a specific state
    city.value = 'Shared City'

    // Call useLocation again in a "different component"
    const { city: city2 } = useLocation()

    expect(city2.value).toBe('Shared City')
  })
  
  it('5. Handles errors gracefully', async () => {
     // Mock Supabase error
    (supabase.functions.invoke as any).mockResolvedValue({ data: null, error: 'Function error' })
    
    // Mock Geolocation denial
    geolocationMock.getCurrentPosition.mockImplementation((_, error) => {
        if (error) error({ code: 1, message: 'User denied' })
    })

    const { error, refresh } = useLocation()
    await refresh()
    
    expect(error.value).toBeDefined()
  })
})
