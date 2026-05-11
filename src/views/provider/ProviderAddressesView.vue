<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useAddressStore } from '../../stores/useAddressStore'
import { useRouter } from 'vue-router'
import type { ProviderAddress } from '../../types'
import { useModal } from '../../composables/useModal'
import { useNotifications } from '../../composables/useNotifications'
import { useI18n } from 'vue-i18n'
import Modal from '../../components/common/Modal.vue'
import ConfirmationModal from '../../components/common/ConfirmationModal.vue'



import LoadingSpinner from '../../components/common/LoadingSpinner.vue'
import SubmitButton from '../../components/common/SubmitButton.vue'
import { AlertCircle } from 'lucide-vue-next'
import { canAddLocation } from '../../services/subscriptionService'
import BackButton from '../../components/common/BackButton.vue'
import LocationPicker from '../../components/common/LocationPicker.vue'
import { geocodeAddress, reverseGeocode } from '../../services/geocoding'
import { watch, nextTick } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import ImageUpload from '../../components/ImageUpload.vue'
import { useCountryDisplayName } from '../../composables/useCountryDisplayName'
import { useLocation } from '../../composables/useLocation'



const authStore = useAuthStore()
const addressStore = useAddressStore()
const router = useRouter()

const { t, locale } = useI18n()
const { showSuccess, showError } = useNotifications()
const { getCountryName, normalizeCountryCode } = useCountryDisplayName(locale)

const modal = useModal<ProviderAddress>()

// Confirmation logic
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingDeleteId = ref<string | null>(null)

function openDeleteConfirm(id: string) {
  pendingDeleteId.value = id
  confirmTitle.value = t('provider.locations.delete_confirm_title')
  confirmMessage.value = t('provider.locations.delete_confirm_msg')
  showConfirmModal.value = true
}

async function handleConfirmDelete() {
  if (!pendingDeleteId.value) return
  
  try {
    await addressStore.deleteAddress(pendingDeleteId.value)
    await checkLimits()
    showSuccess(t('provider.locations.delete_success'))
  } catch (error) {
    console.error('Error deleting address:', error)
    showError(t('provider.locations.delete_error'))
  } finally {
    showConfirmModal.value = false
    pendingDeleteId.value = null
  }
}



const { country_name: userCountry, country_code: userCountryCode } = useLocation()

const form = ref({
  label: '',
  street_address: '',
  street_address_2: '',
  city: '',
  state: '',
  postal_code: '',
  country_code: userCountryCode.value || 'US',
  country_name: userCountry.value || 'United States',
  latitude: null as number | null,
  longitude: null as number | null,
  photo_url: null as string | null
})

const photoFile = ref<File | null>(null)


const saving = ref(false)
const isUpdatingFromMap = ref(false)
const canAdd = ref(false)
const limitState = ref<{
    allowed: boolean;
    reason?: 'limit_reached' | 'no_subscription';
    resource?: 'location';
    limit?: number;
    currentCount?: number;
    planName?: string;
    message?: string;
} | null>(null)

async function checkLimits() {
  if (!authStore.provider) return
  const limitCheck = await canAddLocation(authStore.provider.id)
  canAdd.value = limitCheck.allowed
  limitState.value = limitCheck
}

onMounted(async () => {
  if (!authStore.provider) {
    router.push('/booking')
    return
  }
  await addressStore.fetchAddresses(authStore.provider.id)
  await checkLimits()
})

function openAddModal() {
  modal.open(null)
  form.value = {
    label: '',
    street_address: '',
    street_address_2: '',
    city: '',
    state: '',
    postal_code: '',
    country_code: userCountryCode.value || 'US',
    country_name: userCountry.value || 'United States',
    latitude: null,
    longitude: null,
    photo_url: null
  }
  photoFile.value = null
}

function openEditModal(address: ProviderAddress) {
  modal.open(address)
  form.value = {
    label: address.label || '',
    street_address: address.street_address,
    street_address_2: address.street_address_2 || '',
    city: address.city,
    state: address.state || '',

    postal_code: address.postal_code,
    country_code: address.country_code,
    country_name: address.country_name || '',
    latitude: address.latitude || null,
    longitude: address.longitude || null,
    photo_url: address.photo_url || null
  }
  photoFile.value = null
}



// Auto-geocode when address fields change


// Auto-geocode when address fields change
const autoGeocode = useDebounceFn(async () => {
  // Relaxed validation: Geocode if we have at least a city, postal code, or street address
  if (!form.value.street_address && !form.value.city && !form.value.postal_code) return


  let structuredQuery: any = {
    country_code: form.value.country_code
  }

  // If we have a street address, use everything for maximum precision
  if (form.value.street_address) {
    // Check if we should append street_address_2 (if it looks like a number, e.g. "60")
    let streetParams = form.value.street_address
    const street2 = form.value.street_address_2
    if (street2 && street2.length < 6 && /^\d+$/.test(street2.replace(/[^\d]/g, ''))) {
       streetParams += `, ${street2}`
    }

    structuredQuery = {
      street: streetParams,
      city: form.value.city,
      state: form.value.state,
      postal_code: form.value.postal_code,
      country_code: form.value.country_code
    }
  } else if (form.value.postal_code) {
    // If no street but we have a zip, usage ONLY zip + country to avoid Nominatim
    // returning the city centroid (which happens if we include city/state in the query)
    structuredQuery = {
      postal_code: form.value.postal_code,
      country_code: form.value.country_code
    }
  } else {
    // Fallback: City/State + Country
    structuredQuery = {
      city: form.value.city,
      state: form.value.state,
      country_code: form.value.country_code
    }
  }

  const coords = await geocodeAddress(structuredQuery)
  
  if (coords) {
    form.value.latitude = coords.latitude
    form.value.longitude = coords.longitude
  }
}, 500)

watch(
  () => form.value.country_code,
  (countryCode) => {
    const normalizedCode = normalizeCountryCode(countryCode)

    if (countryCode !== normalizedCode) {
      form.value.country_code = normalizedCode
      return
    }

    const countryName = getCountryName(normalizedCode)
    if (countryName) {
      form.value.country_name = countryName
    }
  }
)



// Watch for postal code and country changes to auto-fill city/state
watch(
  () => [form.value.postal_code, form.value.country_code],
  async ([newPostal, newCountryCode]) => {
    if (newPostal && newCountryCode && newPostal.length > 3) {
      // Use structured query for higher accuracy (avoids Argentina/Brazil confusion)
      const structuredQuery = {
        postal_code: newPostal,
        country_code: newCountryCode as string
      }
      
      const result = await geocodeAddress(structuredQuery)
      if (result && result.address) {
        
        // Only fill if empty to avoid overwriting user input
        if (!form.value.city && result.address.city) form.value.city = result.address.city
        if (!form.value.state && result.address.state) form.value.state = result.address.state
        
        // Update coordinates if we have them
        form.value.latitude = result.latitude
        form.value.longitude = result.longitude
      }
    }
  }
)


watch(
  () => [
    form.value.street_address, 
    form.value.city, 
    form.value.state, 
    form.value.postal_code, 
    form.value.country_code
  ], 
  () => {
    if (!isUpdatingFromMap.value) {
      autoGeocode()
    }
  }
)

async function handleLocationUpdate(loc: { latitude: number; longitude: number }) {
  form.value.latitude = loc.latitude
  form.value.longitude = loc.longitude

  // Prevent auto-geocoding loop
  isUpdatingFromMap.value = true
  
  try {
    const result = await reverseGeocode(loc.latitude, loc.longitude)
    if (result && result.address) {
      
      form.value.street_address = result.address.road || ''
      // If road is missing, maybe use suburb or neighbourhood? (handled in service)
      
      form.value.city = result.address.city || ''
      form.value.state = result.address.state || ''
      form.value.postal_code = result.address.postal_code || ''
      form.value.country_code = result.address.country_code?.toUpperCase() || ''
      form.value.country_name = result.address.country_name || ''
      
      // Keep streets2 (apt, etc) as is, or clear it? Keeping it.
    }
  } catch (err) {
    console.error('Failed to reverse geocode:', err)
  } finally {
    // Wait for DOM updates/watchers to fire before re-enabling
    await nextTick()
    setTimeout(() => {
      isUpdatingFromMap.value = false
    }, 100) // Small buffer for debounce
  }
}

async function handleSave() {
  if (!authStore.provider) return

  saving.value = true
  try {

    // If we still don't have coordinates (user didn't use map and auto-geocode failed/didn't run), try one last time
    if (!form.value.latitude || !form.value.longitude) {
       const structuredQuery = {
        street: form.value.street_address,
        city: form.value.city,
        state: form.value.state,
        postal_code: form.value.postal_code,
        country_code: form.value.country_code
      }
      const coords = await geocodeAddress(structuredQuery)
      if (coords) {
        form.value.latitude = coords.latitude
        form.value.longitude = coords.longitude
      }
    }


    // Prepare payload with sanitized types (null -> undefined)
    const payload = {
      ...form.value,
      latitude: form.value.latitude ?? undefined,
      longitude: form.value.longitude ?? undefined,
      photo_url: form.value.photo_url ?? undefined
    }

    if (modal.data.value) {
      await addressStore.updateAddress({
        id: modal.data.value.id,
        updates: payload,
        photoFile: photoFile.value,
        authUserId: authStore.user!.id,
        existingPhotoPath: modal.data.value.photo_path
      })
    } else {
      await addressStore.createAddress({
        address: {
          ...payload,
          provider_id: authStore.provider.id,
          is_primary: addressStore.addresses.length === 0
        },
        photoFile: photoFile.value,
        authUserId: authStore.user!.id
      })
    }
    modal.close()
    await checkLimits()
    showSuccess(t('provider.locations.save_success'))
  } catch (error) {
    console.error('Error saving address:', error)
    showError(t('provider.locations.save_error') + ': ' + (error instanceof Error ? error.message : String(error)))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  openDeleteConfirm(id)
}

async function handleSetPrimary(id: string) {
  if (!authStore.provider) return
  try {
    await addressStore.setPrimaryAddress(id, authStore.provider.id)
    showSuccess(t('provider.locations.primary_update_success'))
  } catch (error) {
    console.error('Error setting primary address:', error)
    showError(t('provider.locations.primary_update_error'))
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <BackButton to="/provider/dashboard" />
            <h1 class="text-2xl font-bold text-gray-900">{{ $t('provider.locations.title') }}</h1>
          </div>
          <div class="flex flex-col items-end">
             <button
              @click="openAddModal"
              :disabled="!canAdd"
              class="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              :title="!canAdd ? (limitState?.message || '') : ''"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              {{ $t('provider.locations.add_button') }}
            </button>
            <div v-if="!canAdd && limitState?.reason === 'limit_reached'" class="mt-2 w-full max-w-[400px]">
              <div class="provider-limit-alert" role="alert">
                <AlertCircle class="provider-limit-alert__icon" />
                <p class="provider-limit-alert__title">{{ $t('pricing.limits.location_msg', { planName: limitState.planName, count: limitState.limit }) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Loading State -->
      <LoadingSpinner v-if="addressStore.loading" :text="$t('provider.locations.loading')" />

      <!-- Empty State -->
      <div v-else-if="addressStore.addresses.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900">{{ $t('provider.locations.no_locations') }}</h3>
        <p class="text-gray-500 mt-2">{{ $t('provider.locations.no_locations_desc') }}</p>
        <div class="flex flex-col items-center">
          <button
            @click="openAddModal"
            :disabled="!canAdd"
             class="mt-4 text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {{ $t('provider.locations.add_button') }} →
          </button>
          <div v-if="!canAdd && limitState?.reason === 'limit_reached'" class="mt-4 w-full max-w-[400px] text-left">
            <div class="provider-limit-alert" role="alert">
              <AlertCircle class="provider-limit-alert__icon" />
              <p class="provider-limit-alert__title">{{ $t('pricing.limits.location_msg', { planName: limitState.planName, count: limitState.limit }) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Addresses Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          v-for="address in addressStore.addresses"
          :key="address.id"
          class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border overflow-hidden"
          :class="address.is_primary ? 'border-primary-500 ring-2 ring-primary-500' : 'border-gray-200'"
        >
          <div class="p-6">
            <!-- Primary badge -->
            <div v-if="address.is_primary" class="mb-3 -mx-6 -mt-6 px-6 py-2 bg-primary-50 border-b border-primary-200">
              <span class="text-xs font-semibold text-primary-700 uppercase tracking-wide">
                ⭐ {{ $t('provider.locations.primary_badge') }}
              </span>
            </div>

            <!-- Image/Map/Label -->
            <div class="flex gap-4 items-start mb-3">
              <div v-if="address.photo_url" class="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                <img :src="address.photo_url" class="w-full h-full object-cover" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-bold text-gray-900">
                  {{ address.label || $t('provider.locations.primary_label') }}
                </h3>
              </div>
            </div>

            <!-- Address -->
            <div class="text-gray-700 space-y-1 mb-4">
              <p>{{ address.street_address }}</p>
              <p v-if="address.street_address_2" class="text-gray-500">{{ address.street_address_2 }}</p>
              <p>{{ address.city }}<span v-if="address.state">, {{ address.state }}</span> {{ address.postal_code }}</p>
              <p class="text-gray-500">{{ address.country_name || address.country_code }}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                v-if="!address.is_primary"
                @click="handleSetPrimary(address.id)"
                class="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {{ $t('provider.locations.set_primary') }}
              </button>
              <span v-else class="text-sm text-gray-400">
                {{ $t('provider.locations.primary_label') }}
              </span>
              
              <div class="flex gap-2">
                <button
                  @click="openEditModal(address)"
                  class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  :title="$t('common.edit')"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
                <button
                  @click="handleDelete(address.id)"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  :title="$t('common.delete')"
                  :disabled="address.is_primary && addressStore.addresses.length > 1"
                  :class="{ 'opacity-50 cursor-not-allowed': address.is_primary && addressStore.addresses.length > 1 }"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Address Modal -->
    <Modal
      :is-open="modal.isOpen.value"
      :title="modal.data.value ? $t('provider.locations.form.edit_title') : $t('provider.locations.form.add_title')"
      @close="modal.close()"
    >
      <form @submit.prevent="handleSave" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.label') }}</label>
          <input
            v-model="form.label"
            type="text"
            :placeholder="$t('provider.locations.form.label_placeholder')"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        <div>
          <ImageUpload
            v-model="form.photo_url"
            :label="$t('provider.locations.form.photo_label')"
            @change="file => photoFile = file"
          />
        </div>


        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.country_code') }}</label>
            <input
              v-model="form.country_code"
              type="text"
              required
              maxlength="2"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm uppercase"
              :placeholder="$t('provider.locations.form.country_placeholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.country_name') }}</label>
            <input
              v-model="form.country_name"
              type="text"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.postal') }}</label>
          <input
            v-model="form.postal_code"
            type="text"
            required
            :placeholder="$t('provider.locations.form.postal_placeholder')"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.city') }}</label>
            <input
              v-model="form.city"
              type="text"
              required
              :placeholder="$t('provider.locations.form.city_placeholder')"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.state') }}</label>
            <input
              v-model="form.state"
              type="text"
              :placeholder="$t('provider.locations.form.state_placeholder')"
              class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.street') }}</label>
          <input
            v-model="form.street_address"
            type="text"
            required
            :placeholder="$t('provider.locations.form.street_placeholder')"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">{{ $t('provider.locations.form.street2') }}</label>
          <input
            v-model="form.street_address_2"
            type="text"
            :placeholder="$t('provider.locations.form.street2_placeholder')"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>



        <!-- Map Picker -->
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Location on Map</label>
          <LocationPicker
            :latitude="form.latitude"
            :longitude="form.longitude"
            @update:location="handleLocationUpdate"
          />
          <p class="text-xs text-gray-500 mt-1">Drag the marker to pin-point your exact location.</p>
        </div>

        <div class="mt-5 flex gap-3 sm:justify-end">
          <button
            type="button"
            class="flex-1 sm:flex-none inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm"
            @click="modal.close()"
          >
            {{ $t('common.cancel') }}
          </button>
          <SubmitButton
            :loading="saving"
            :label="$t('common.save')"
            :loading-label="$t('common.saving')"
            responsive
          />
        </div>
      </form>
    </Modal>

    <ConfirmationModal
      :isOpen="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      :isDestructive="true"
      @close="showConfirmModal = false"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<style scoped>
@reference "../../style.css";

.provider-limit-alert {
  @apply flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900;
}

.provider-limit-alert__icon {
  @apply mt-0.5 h-4 w-4 flex-shrink-0;
}

.provider-limit-alert__title {
  @apply font-medium;
}
</style>
