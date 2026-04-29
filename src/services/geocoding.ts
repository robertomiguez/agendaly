
/**
 * Geocoding service using OpenStreetMap Nominatim API
 */


interface GeocodingResult {
  latitude: number
  longitude: number
  address?: {
    city?: string
    state?: string
    country_name?: string
    country_code?: string
    postal_code?: string
    road?: string
  }
}


interface StructuredAddress {
  street?: string
  city?: string
  state?: string
  postal_code?: string
  country_name?: string
  country_code?: string
}

/**
 * Geocode an address string or object to get latitude, longitude, and address details
 * @param address The address string or structured object to geocode
 * @returns Promise<GeocodingResult | null>
 */
export async function geocodeAddress(address: string | StructuredAddress): Promise<GeocodingResult | null> {
  try {
    let url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1'
    
    if (typeof address === 'string') {
      url += `&q=${encodeURIComponent(address)}`
    } else {
      // Structured query
      if (address.street) url += `&street=${encodeURIComponent(address.street)}`
      if (address.city) url += `&city=${encodeURIComponent(address.city)}`
      if (address.state) url += `&state=${encodeURIComponent(address.state)}`
      if (address.postal_code) url += `&postalcode=${encodeURIComponent(address.postal_code)}`
      if (address.country_name) url += `&country=${encodeURIComponent(address.country_name)}`
      if (address.country_code) url += `&countrycodes=${encodeURIComponent(address.country_code)}`
    }

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      }
    })

    if (!response.ok) {
      console.warn('Geocoding failed:', response.statusText)
      return null
    }

    const data = await response.json()

    if (data && data.length > 0) {
      const result = data[0]
      const addr = result.address || {}

      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: {
          city: addr.city || addr.town || addr.village || addr.municipality,
          state: addr.state || addr.region,
          country_name: addr.country,
          country_code: addr.country_code,
          postal_code: addr.postcode,
          road: addr.road
        }
      }
    }


    return null
  } catch (error) {
    console.warn('Geocoding error:', error)
    return null
  }
}

/**
 * Reverse geocode coordinates to get address details
 * @param latitude Latitude
 * @param longitude Longitude
 * @returns Promise<GeocodingResult | null>
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en', // Or user's locale if available
        }
      }
    )

    if (!response.ok) {
      console.warn('Reverse geocoding failed:', response.statusText)
      return null
    }

    const data = await response.json()

    if (data) {
      const addr = data.address || {}

      return {
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        address: {
          city: addr.city || addr.town || addr.village || addr.municipality,
          state: addr.state || addr.region,
          country_name: addr.country,
          country_code: addr.country_code,
          postal_code: addr.postcode,
          road: addr.road || addr.pedestrian || addr.footway || addr.path || addr.suburb
        }
      }
    }

    return null
  } catch (error) {
    console.warn('Reverse geocoding error:', error)
    return null
  }
}
