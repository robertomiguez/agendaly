<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import { useI18n } from 'vue-i18n'
import { useServiceStore } from '../../stores/useServiceStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCategoryStore } from '../../stores/useCategoryStore'
import { useAppointmentStore } from '../../stores/useAppointmentStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useModal } from '../../composables/useModal'
import { useNotifications } from '../../composables/useNotifications'
import type { Service } from '../../types'
import ServiceFormModal from '../../components/provider/ServiceFormModal.vue'
import ConfirmationModal from '../../components/common/ConfirmationModal.vue'
import LoadingSpinner from '../../components/common/LoadingSpinner.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-vue-next'
import { canAddService } from '../../services/subscriptionService'
import BackButton from '../../components/common/BackButton.vue'

const router = useRouter()
const { t } = useI18n()
const { showSuccess } = useNotifications()

const serviceStore = useServiceStore()
const authStore = useAuthStore()
const categoryStore = useCategoryStore()
const appointmentStore = useAppointmentStore()
const settingsStore = useSettingsStore()
const allCategoriesValue = '__all__'

const modal = useModal<Service>()
const searchQuery = ref('')
const categoryFilter = ref(allCategoriesValue)
const saving = ref(false)
const serviceFormError = ref<string | null>(null)
const serviceActionErrors = ref<Record<string, string>>({})
const isLoading = ref(true)
const canAdd = ref(false)
const limitState = ref<{
    allowed: boolean;
    reason?: 'limit_reached' | 'no_subscription';
    resource?: 'service';
    limit?: number;
    currentCount?: number;
    planName?: string;
    message?: string;
} | null>(null)

// Conflict modal state
const showConflictModal = ref(false)
const conflicts = ref<any[]>([])
const pendingDeactivationService = ref<Service | null>(null)
const isTogglingFromList = ref(false)
const pendingServiceData = ref<any>(null)

const groupedConflicts = computed(() => {
  const groups: Record<string, any[]> = {}
  conflicts.value.forEach(apt => {
    const date = apt.appointment_date
    if (!groups[date]) groups[date] = []
    groups[date].push(apt)
  })
  
  return Object.entries(groups)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, appointments]) => ({
      date,
      dayName: format(parseISO(date), 'EEEE'),
      displayDate: format(parseISO(date), 'MMM d'),
      appointments
    }))
})

function formatTime(time: string) {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const date = new Date()
  date.setHours(parseInt(hours || '0'), parseInt(minutes || '0'))
  return format(date, 'HH:mm')
}

// Categories from store
const categories = computed(() => {
  return [
    { value: allCategoriesValue, label: t('category_pills.all') },
    ...categoryStore.categories.map(c => ({ value: c.name, label: c.name }))
  ]
})

// Filtered services
const filteredServices = computed(() => {
  return serviceStore.services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    const serviceCategoryName = service.categories?.name || 'Uncategorized'
    const matchesCategory = categoryFilter.value === allCategoriesValue || serviceCategoryName === categoryFilter.value
    // Only show services belonging to this provider
    const matchesProvider = service.provider_id === authStore.provider?.id
    return matchesSearch && matchesCategory && matchesProvider
  })
})

async function checkLimits() {
  if (!authStore.provider) return
  const limitCheck = await canAddService(authStore.provider.id)
  canAdd.value = limitCheck.allowed
  limitState.value = limitCheck
}

onMounted(async () => {
  try {
    if (!authStore.provider) {
      router.push('/booking')
      return
    }
    await Promise.all([
      serviceStore.fetchAllServices(authStore.provider.id),
      categoryStore.fetchCategories()
    ])
    
    await checkLimits()
  } finally {
    isLoading.value = false
  }
})

function openAddModal() {
  serviceFormError.value = null
  modal.open(null)
}

function openEditModal(service: Service) {
  serviceFormError.value = null
  modal.open({ ...service })
}

function closeServiceModal() {
  serviceFormError.value = null
  modal.close()
}

async function handleSave(serviceData: any) {
  serviceFormError.value = null

  // Check limits if activating an inactive service
  if (modal.data.value && !modal.data.value.active && serviceData.active) {
    if (!authStore.provider?.id) return
    const limitCheck = await canAddService(authStore.provider.id)
    if (!limitCheck.allowed) {
      serviceFormError.value = limitCheck.message || t('pricing.limits.upgrade')
      return
    }
  }

  // Check for conflicts if deactivating an existing service
  if (modal.data.value && modal.data.value.active && !serviceData.active) {
    const foundConflicts = await appointmentStore.fetchFutureAppointments(modal.data.value.id, 'service')
    if (foundConflicts.length > 0) {
      conflicts.value = foundConflicts
      pendingDeactivationService.value = modal.data.value
      pendingServiceData.value = serviceData
      isTogglingFromList.value = false
      showConflictModal.value = true
      return
    }
  }

  // Check for conflicts if updating duration or buffers on existing service
  if (modal.data.value && serviceData.id) {
    // Only check if time-related fields changed
    const durationChanged = serviceData.duration !== modal.data.value.duration
    const bufferBeforeChanged = serviceData.buffer_before !== modal.data.value.buffer_before
    const bufferAfterChanged = serviceData.buffer_after !== modal.data.value.buffer_after

    if (durationChanged || bufferBeforeChanged || bufferAfterChanged) {
        const foundConflicts = await appointmentStore.checkServiceUpdateConflicts(
            serviceData.id,
            Number(serviceData.duration),
            Number(serviceData.buffer_before || 0),
            Number(serviceData.buffer_after || 0)
        )

        if (foundConflicts.length > 0) {
            conflicts.value = foundConflicts
            // We reuse the same modal but maybe need to adjust title/message context?
            // The existing modal uses pendingDeactivationService but we can set pendingServiceData
            // and maybe a flag to know it's an update conflict, not deactivation.
            // But relying on pendingDeactivationService might be confusing if we display its name.
            // Let's set pendingDeactivationService to the current service just for the name display.
            pendingDeactivationService.value = modal.data.value
            pendingServiceData.value = serviceData
            isTogglingFromList.value = false
            showConflictModal.value = true
            return
        }
    }
  }

  await executeSave(serviceData)
}

async function executeSave(serviceData: any) {
  
  saving.value = true
  try {
    if (serviceData.id) {
      await serviceStore.updateService(serviceData.id, serviceData)
      showSuccess(t('provider.services.save_success'))
    } else {
      const newService = {
        ...serviceData,
        // Sanitize: Postgres might complain if category_id is empty string for UUID column
        category_id: serviceData.category_id || null, 
        price: parseFloat(serviceData.price), // Ensure number
        provider_id: authStore.provider?.id,
        active: true
      }
      await serviceStore.createService(newService)
      showSuccess(t('provider.services.add_success'))
    }
    closeServiceModal()
    showConflictModal.value = false
    await checkLimits()
  } catch (err) {
    console.error('Error in handleSave:', err)
    serviceFormError.value = t('provider.services.save_error') + ': ' + (err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

async function toggleActive(service: Service) {
  serviceActionErrors.value = {
    ...serviceActionErrors.value,
    [service.id]: ''
  }

  // Check limits if activating an inactive service
  if (!service.active) {
    if (!authStore.provider?.id) return
    const limitCheck = await canAddService(authStore.provider.id)
    if (!limitCheck.allowed) {
      serviceActionErrors.value = {
        ...serviceActionErrors.value,
        [service.id]: limitCheck.message || t('pricing.limits.upgrade')
      }
      return
    }
  }

  // Check for conflicts only if deactivating
  if (service.active) {
    const foundConflicts = await appointmentStore.fetchFutureAppointments(service.id, 'service')
    if (foundConflicts.length > 0) {
      conflicts.value = foundConflicts
      pendingDeactivationService.value = service
      isTogglingFromList.value = true
      showConflictModal.value = true
      return
    }
  }

  await executeToggleActive(service)
}

async function executeToggleActive(service: Service) {
  try {
    await serviceStore.updateService(service.id, { active: !service.active })
    showSuccess(t('provider.staff.toggle_success'))
    serviceActionErrors.value = {
      ...serviceActionErrors.value,
      [service.id]: ''
    }
    showConflictModal.value = false
    await checkLimits()
  } catch (err) {
    console.error('Error in toggleActive:', err)
    serviceActionErrors.value = {
      ...serviceActionErrors.value,
      [service.id]: t('provider.services.toggle_error')
    }
  }
}

async function confirmDeactivation() {
  if (isTogglingFromList.value) {
    if (pendingDeactivationService.value) {
      await executeToggleActive(pendingDeactivationService.value)
    }
  } else {
    if (pendingServiceData.value) {
      await executeSave(pendingServiceData.value)
    }
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
            <h1 class="text-2xl font-bold text-gray-900">{{ $t('provider.services.title') }}</h1>
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
                {{ $t('provider.services.add_button') }}
              </button>
            <div v-if="!canAdd && limitState?.reason === 'limit_reached'" class="mt-2 w-full max-w-[400px]">
              <Alert variant="warning">
                <AlertCircle class="h-4 w-4" />
                <AlertTitle>{{ $t('pricing.limits.service_msg', { planName: limitState.planName, count: limitState.limit }) }}</AlertTitle>
                <AlertDescription>
                  <router-link to="/provider/pricing" class="underline font-medium hover:text-red-900">
                    {{ $t('pricing.limits.upgrade') }}
                  </router-link>
                </AlertDescription>
              </Alert>
            </div>
          </div>
          </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="relative w-full md:w-96">
          <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('provider.services.search_placeholder')"
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div class="flex items-center gap-2 w-full md:w-auto">
          <label class="text-gray-600 whitespace-nowrap">{{ $t('provider.services.category_label') }}</label>
          <select
            v-model="categoryFilter"
            class="w-full md:w-48 border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <LoadingSpinner v-if="serviceStore.loading || isLoading" :text="$t('services.loading')" />

      <!-- Empty State -->
      <div v-else-if="filteredServices.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900">{{ $t('provider.services.no_services_found') }}</h3>
        <p class="text-gray-500 mt-2">{{ $t('provider.services.no_services_desc') }}</p>
          <div class="flex flex-col items-center">
            <button
              @click="openAddModal"
              :disabled="!canAdd"
              class="mt-4 text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {{ $t('provider.services.add_button') }} →
            </button>
            
            <div v-if="!canAdd && limitState?.reason === 'limit_reached'" class="mt-4 w-full max-w-[400px] text-left">
              <Alert variant="warning">
                <AlertCircle class="h-4 w-4" />
                <AlertTitle>{{ $t('pricing.limits.service_msg', { planName: limitState.planName, count: limitState.limit }) }}</AlertTitle>
                <AlertDescription>
                  <router-link to="/provider/pricing" class="underline font-medium hover:text-red-900">
                    {{ $t('pricing.limits.upgrade') }}
                  </router-link>
                </AlertDescription>
              </Alert>
            </div>
          </div>
      </div>

      <!-- Services Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="service in filteredServices"
          :key="service.id"
          class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border overflow-hidden"
          :class="service.active ? 'border-gray-200' : 'border-gray-300 bg-gray-50 opacity-75'"
        >
          <div class="p-6">
            <!-- Inactive banner -->
            <div v-if="!service.active" class="mb-3 -mx-6 -mt-6 px-6 py-2 bg-gray-200 border-b border-gray-300">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                ⚠️ {{ $t('provider.services.inactive_banner') }}
              </span>
            </div>
            
            <div class="flex justify-between items-start mb-4">
              <div>
                <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full mb-2"
                  :class="service.active ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'">
                  {{ service.categories?.name || $t('provider.services.uncategorized') }}
                </span>
                <h3 class="text-xl font-bold" :class="service.active ? 'text-gray-900' : 'text-gray-600'">
                  {{ service.name }}
                </h3>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-lg font-bold" :class="service.active ? 'text-primary-600' : 'text-gray-500'">
                  {{ settingsStore.formatPrice(service.price || 0) }}
                </span>
                <span class="text-sm" :class="service.active ? 'text-gray-500' : 'text-gray-400'">
                  {{ service.duration }} min
                </span>
              </div>
            </div>
            
            <p class="text-sm mb-4 line-clamp-2" :class="service.active ? 'text-gray-600' : 'text-gray-500'">
              {{ service.description || $t('provider.services.description_fallback') }}
            </p>

            <div
              v-if="serviceActionErrors[service.id]"
              class="service-card-feedback"
              role="alert"
            >
              {{ serviceActionErrors[service.id] }}
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
              <!-- Toggle Switch -->
              <div class="flex items-center gap-3">
                <button
                  @click="toggleActive(service)"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  :class="service.active ? 'bg-green-600' : 'bg-gray-300'"
                  :title="service.active ? 'Click to deactivate' : 'Click to activate'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    :class="service.active ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
                <span class="text-sm font-medium" :class="service.active ? 'text-green-600' : 'text-gray-500'">
                  {{ service.active ? $t('provider.staff.active') : $t('provider.staff.inactive') }}
                </span>
              </div>
              
              <div class="flex gap-2">
                <button
                  @click="openEditModal(service)"
                  class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  :title="$t('services.edit_service')"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Service Form Modal -->
    <ServiceFormModal
      v-if="modal.isOpen.value"
      :service="modal.data.value"
      :loading="saving"
      :submit-error="serviceFormError"
      @close="closeServiceModal"
      @save="handleSave"
    />

    <!-- Conflict Confirmation -->
    <ConfirmationModal
      :isOpen="showConflictModal"
      :title="$t('provider.services.conflict_title')"
      :message="isTogglingFromList || !pendingServiceData?.active ? 
        $t('provider.services.conflict_msg', { name: pendingDeactivationService?.name }) :
        $t('provider.services.conflict_update_msg', { name: pendingDeactivationService?.name })"
      :confirmLabel="isTogglingFromList || !pendingServiceData?.active ? 'Deactivate' : 'Update Anyway'" 
      :isDestructive="true"
      @close="showConflictModal = false"
      @confirm="confirmDeactivation"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-500">
          {{ isTogglingFromList || !pendingServiceData?.active ? 
            $t('provider.services.conflict_msg', { name: pendingDeactivationService?.name }) :
            $t('provider.services.conflict_update_msg', { name: pendingDeactivationService?.name })
          }}
        </p>
        <div v-if="conflicts.length > 0">
        <div class="space-y-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          <div v-for="group in groupedConflicts" :key="group.date" class="space-y-2">
            <h4 class="text-sm font-bold text-gray-900 flex items-center gap-2">
              {{ group.dayName }} 
              <span class="text-gray-400 font-normal">({{ group.appointments.length }} {{ group.appointments.length === 1 ? 'booking' : 'bookings' }})</span>
            </h4>
            <ul class="space-y-1 ml-2">
              <li v-for="apt in group.appointments" :key="apt.id" class="text-sm text-gray-600 flex items-center gap-2">
                <span class="text-gray-300">•</span>
                <span>{{ group.displayDate }} @ {{ formatTime(apt.start_time) }}</span>
              </li>
            </ul>
          </div>
        </div>
        <p class="mt-6 text-sm text-gray-500 italic">
          {{ isTogglingFromList || !pendingServiceData?.active ? 
            $t('provider.staff.conflict_notice') : 
            $t('provider.services.conflict_update_notice') 
          }}
        </p>
      </div>
    </div>
    </ConfirmationModal>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}

.service-card-feedback {
  @apply mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}
</style>
