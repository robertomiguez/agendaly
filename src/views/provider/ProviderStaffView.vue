<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useStaffStore } from '../../stores/useStaffStore'
import { useAppointmentStore } from '../../stores/useAppointmentStore'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import * as staffService from '../../services/staffService'
import { format, parseISO } from 'date-fns'
import type { Staff, ProviderAddress } from '../../types'
import { useModal } from '../../composables/useModal'
import { useNotifications } from '../../composables/useNotifications'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/useSettingsStore'
import ConfirmationModal from '../../components/common/ConfirmationModal.vue'
import StaffFormModal from '../../components/provider/StaffFormModal.vue'
import LoadingSpinner from '../../components/common/LoadingSpinner.vue'
import { AlertCircle } from 'lucide-vue-next'
import { canAddStaff } from '../../services/subscriptionService'
import BackButton from '../../components/common/BackButton.vue'

const authStore = useAuthStore()
const staffStore = useStaffStore()
const appointmentStore = useAppointmentStore()
const router = useRouter()
const { t } = useI18n()
const settingsStore = useSettingsStore()
const { showSuccess, showError } = useNotifications()

const staff = ref<Staff[]>([])
const loading = ref(false)
const canAdd = ref(false)
const limitState = ref<{
    allowed: boolean;
    reason?: 'limit_reached' | 'no_subscription';
    resource?: 'staff';
    limit?: number;
    currentCount?: number;
    planName?: string;
    message?: string;
} | null>(null)
const saving = ref(false) // Added saving ref
const modal = useModal<Staff>()

// Provider Addresses (branches)
const providerAddresses = ref<ProviderAddress[]>([])
const selectedAddressIds = ref<string[]>([])

// Temporary storage for form data when handling conflicts
const pendingSavePayload = ref<{
  name: string
  email: string
  role: 'admin' | 'staff'
  active: boolean
  addressIds: string[]
  photoFile: File | null
} | null>(null)

// Conflict modal state
const showConflictModal = ref(false)
const conflicts = ref<any[]>([])
const pendingDeactivationStaff = ref<Staff | null>(null)
const isTogglingFromList = ref(false)

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
      dayName: parseISO(date).toLocaleDateString(settingsStore.language, { weekday: 'long' }),
      displayDate: parseISO(date).toLocaleDateString(settingsStore.language, { month: 'short', day: 'numeric' }),
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

const copiedStaffId = ref<string | null>(null)
// We use this only for UI toggle purposes
const isShareSupported = ref(false)

async function copyStaffLink(member: Staff) {
  const url = authStore.provider?.slug && member.slug
    ? `${window.location.origin}/${authStore.provider.slug}/${member.slug}`
    : `${window.location.origin}/booking?staff=${member.id}`
  
  // Try native share first (Mobile/Supported Browsers)
  if (navigator.share) {
    try {
      await navigator.share({
        title: t('provider.staff.share_title', { name: member.name }),
        text: t('provider.staff.share_text', { name: member.name }),
        url: url
      })
      return // Success!
    } catch (err) {
       console.error('Share canceled or failed, falling back to copy', err)
    }
  }

  // Fallback to strict Clipboard API (simpler, requires HTTPS or Localhost)
  try {
    await navigator.clipboard.writeText(url)
    setCopiedState(member.id)
  } catch (err) {
    console.error('Failed to copy link', err)
    showError(t('provider.staff.copy_error'))
  }
}

function setCopiedState(id: string) {
    copiedStaffId.value = id
    setTimeout(() => {
      if (copiedStaffId.value === id) {
        copiedStaffId.value = null
      }
    }, 3000)
}

async function checkLimits() {
  if (!authStore.provider) return
  const limitCheck = await canAddStaff(authStore.provider.id)
  canAdd.value = limitCheck.allowed
  limitState.value = limitCheck
}

onMounted(async () => {
  // Trust the browser OR User Agent for share UI (force share icon on mobile)
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)
  isShareSupported.value = (typeof navigator !== 'undefined' && !!navigator.share) || isMobile

  if (!authStore.provider) {
    router.push('/booking')
    return
  }
  await Promise.all([
    fetchStaff(),
    fetchProviderAddresses()
  ])

  await checkLimits()
})

async function fetchStaff() {
  loading.value = true
  try {
    if (authStore.provider?.id) {
       staff.value = await staffService.fetchStaff(authStore.provider.id)
    }
  } catch (e) {
    console.error('Error fetching staff:', e)
  } finally {
    loading.value = false
  }
}

async function fetchProviderAddresses() {
  if (!authStore.provider?.id) return
  try {
    const { data, error } = await supabase
      .from('provider_addresses')
      .select('*')
      .eq('provider_id', authStore.provider.id)
      .order('is_primary', { ascending: false })
    if (error) throw error
    providerAddresses.value = data || []
  } catch (e) {
    console.error('Error fetching provider addresses:', e)
  }
}

function openAddModal() {
  selectedAddressIds.value = [] // Component will handle default selection
  modal.open(null)
}

async function openEditModal(staffMember: Staff) {
  // Load existing address assignments first
  const addresses = await staffStore.fetchStaffAddresses(staffMember.id)
  selectedAddressIds.value = addresses.map(a => a.id)
  modal.open(staffMember)
}

async function onSaveStaff(payload: {
  name: string
  email: string
  role: 'admin' | 'staff'
  active: boolean
  addressIds: string[]
  photoFile: File | null
}) {
  if (!authStore.provider) return

  // Check limits if activating an inactive staff member
  if (modal.data.value && !modal.data.value.active && payload.active) {
    const limitCheck = await canAddStaff(authStore.provider.id)
    if (!limitCheck.allowed) {
      showError(limitCheck.message || t('pricing.limits.upgrade'))
      return
    }
  }

  // Check for conflicts if deactivating an existing staff member
  if (modal.data.value && modal.data.value.active && !payload.active) {
    const foundConflicts = await appointmentStore.fetchFutureAppointments(modal.data.value.id, 'staff')
    if (foundConflicts.length > 0) {
      conflicts.value = foundConflicts
      pendingDeactivationStaff.value = modal.data.value
      pendingSavePayload.value = payload
      isTogglingFromList.value = false
      showConflictModal.value = true
      return
    }
  }

  await executeSave(payload)
}

async function executeSave(payload: typeof pendingSavePayload.value) {
  if (!authStore.provider || !payload) return
  
  saving.value = true // Set saving to true
  try {
    let staffId: string | undefined
    
    if (modal.data.value) {
      // Update existing staff
      const data = await staffService.updateStaff({
        id: modal.data.value.id,
        updates: {
          name: payload.name,
          email: payload.email,
          role: payload.role,
          active: payload.active
        },
        photoFile: payload.photoFile,
        authUserId: authStore.user!.id,
        existingPhotoPath: modal.data.value.photo_path
      })
      
      // Update local state
      if (data) {
        staffId = data.id
        const index = staff.value.findIndex(s => s.id === modal.data.value!.id)
        if (index !== -1) {
          staff.value[index] = data
        }
      }
    } else {
      // Create new staff
      const data = await staffService.createStaff({
        staff: {
          name: payload.name,
          email: payload.email,
          role: payload.role,
          active: payload.active,
          provider_id: authStore.provider.id
        },
        photoFile: payload.photoFile,
        authUserId: authStore.user!.id
      })
      
      // Add to local state
      if (data) {
        staffId = data.id
        staff.value.push(data)
      }
    }

    // Sync address assignments
    if (staffId) {
      await staffStore.syncStaffAddresses(staffId, payload.addressIds)
      showSuccess(modal.data.value ? t('provider.staff.save_success') : t('provider.staff.add_success'))
    }

    modal.close()
    showConflictModal.value = false
    pendingSavePayload.value = null
    await checkLimits()
  } catch (e) {
    console.error('Error saving staff:', e)
    showError(t('provider.staff.save_error') + ': ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    saving.value = false // Set saving to false
  }
}

async function toggleActive(staffMember: Staff) {
  // Check limits if activating an inactive staff member
  if (!staffMember.active) {
     if (!authStore.provider?.id) return
     const limitCheck = await canAddStaff(authStore.provider.id)
     if (!limitCheck.allowed) {
       showError(limitCheck.message || t('pricing.limits.upgrade'))
       return
     }
  }

  // Check for conflicts only if deactivating
  if (staffMember.active) {
    const foundConflicts = await appointmentStore.fetchFutureAppointments(staffMember.id, 'staff')
    if (foundConflicts.length > 0) {
      conflicts.value = foundConflicts
      pendingDeactivationStaff.value = staffMember
      isTogglingFromList.value = true
      showConflictModal.value = true
      return
    }
  }

  await executeToggleActive(staffMember)
}

async function executeToggleActive(staffMember: Staff) {
  if (!authStore.user) return
  
  try {
    const data = await staffService.updateStaff({
      id: staffMember.id,
      updates: { active: !staffMember.active },
      authUserId: authStore.user.id
    })
    
    // Update local state
    if (data) {
      const index = staff.value.findIndex(s => s.id === staffMember.id)
      if (index !== -1) {
        staff.value[index] = data
      }
    }
    await checkLimits()
    showSuccess(t('provider.staff.toggle_success'))
    showConflictModal.value = false
  } catch (e) {
    console.error('Error updating staff status:', e)
    showError(t('provider.staff.toggle_error'))
  }
}

async function confirmDeactivation() {
  if (!pendingDeactivationStaff.value) return

  if (isTogglingFromList.value) {
    await executeToggleActive(pendingDeactivationStaff.value)
  } else {
    await executeSave(pendingSavePayload.value)
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
            <h1 class="text-2xl font-bold text-gray-900">{{ $t('provider.staff.title') }}</h1>
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
              {{ $t('provider.staff.add_button') }}
            </button>
            <div v-if="!canAdd && limitState?.reason === 'limit_reached'" class="mt-2 w-full max-w-[400px]">
              <div class="provider-limit-alert" role="alert">
                <AlertCircle class="provider-limit-alert__icon" />
                <div>
                  <p class="provider-limit-alert__title">{{ $t('pricing.limits.staff_msg', { planName: limitState.planName, count: limitState.limit }) }}</p>
                  <router-link to="/provider/pricing" class="underline font-medium hover:text-red-900">
                    {{ $t('pricing.limits.upgrade') }}
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Loading State -->
      <LoadingSpinner v-if="loading" :text="$t('provider.staff.loading')" />

      <!-- Empty State -->
      <div v-else-if="staff.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
        <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        <h3 class="text-lg font-medium text-gray-900">{{ $t('provider.staff.no_staff') }}</h3>
        <p class="text-gray-500 mt-2">{{ $t('provider.staff.no_staff_desc') }}</p>
        <div class="flex flex-col items-center">
          <button
            @click="openAddModal"
            :disabled="!canAdd"
             class="mt-4 text-primary-600 hover:text-primary-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {{ $t('provider.staff.add_button') }} →
          </button>
          <div v-if="!canAdd && limitState?.reason === 'limit_reached'" class="mt-4 w-full max-w-[400px] text-left">
            <div class="provider-limit-alert" role="alert">
              <AlertCircle class="provider-limit-alert__icon" />
              <div>
                <p class="provider-limit-alert__title">{{ $t('pricing.limits.staff_msg', { planName: limitState.planName, count: limitState.limit }) }}</p>
                <router-link to="/provider/pricing" class="underline font-medium hover:text-red-900">
                  {{ $t('pricing.limits.upgrade') }}
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Staff Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="member in staff"
          :key="member.id"
          class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border overflow-hidden"
          :class="member.active ? 'border-gray-200' : 'border-gray-300 bg-gray-50 opacity-75'"
        >
          <div class="p-6">
            <!-- Inactive banner -->
            <div v-if="!member.active" class="mb-3 -mx-6 -mt-6 px-6 py-2 bg-gray-200 border-b border-gray-300">
              <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                ⚠️ {{ $t('provider.staff.inactive_banner') }}
              </span>
            </div>

            <div class="flex items-center gap-4 mb-4">
              <div class="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
                <img v-if="member.photo_url" :src="member.photo_url" :alt="member.name" class="w-full h-full object-cover" />
                <div 
                  v-else
                  class="w-full h-full flex items-center justify-center font-bold text-xl"
                  :class="member.active ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'"
                >
                  {{ member.name.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-bold" :class="member.active ? 'text-gray-900' : 'text-gray-600'">
                  {{ member.name }}
                </h3>
                <p class="text-sm" :class="member.active ? 'text-gray-500' : 'text-gray-400'">
                  {{ member.email }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 mb-4">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="member.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'">
                {{ member.role === 'admin' ? $t('modals.staff.roles.admin') : $t('modals.staff.roles.staff') }}
              </span>
              
              <button
                @click="copyStaffLink(member)"
                class="ml-auto text-sm flex items-center gap-1 transition-colors"
                :class="copiedStaffId === member.id ? 'text-green-600 font-medium' : 'text-primary-600 hover:text-primary-700'"
                :title="isShareSupported ? $t('provider.staff.share_link') : $t('provider.staff.copy_link')"
              >
                <template v-if="isShareSupported">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                  </svg>
                  {{ $t('provider.staff.share_link') }}
                </template>
                <template v-else>
                  <svg v-if="copiedStaffId === member.id" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  {{ copiedStaffId === member.id ? $t('provider.staff.link_copied') : $t('provider.staff.copy_link') }}
                </template>
              </button>
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
              <!-- Toggle Switch -->
              <div class="flex items-center gap-3">
                <button
                  @click="toggleActive(member)"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  :class="member.active ? 'bg-green-600' : 'bg-gray-300'"
                  :title="member.active ? 'Click to deactivate' : 'Click to activate'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    :class="member.active ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
                <span class="text-sm font-medium" :class="member.active ? 'text-green-600' : 'text-gray-500'">
                  {{ member.active ? $t('provider.staff.active') : $t('provider.staff.inactive') }}
                </span>
              </div>
              
              <button
                @click="openEditModal(member)"
                class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                :title="$t('provider.staff.edit_title')"
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

    <!-- Staff Form Modal -->
    <StaffFormModal
      :isOpen="modal.isOpen.value"
      :staff="modal.data.value"
      :providerAddresses="providerAddresses"
      :initialAddressIds="selectedAddressIds"
      :loading="saving"
      @close="modal.close()"
      @save="onSaveStaff"
    />

    <!-- Conflict Confirmation -->
    <ConfirmationModal
      :isOpen="showConflictModal"
      :title="$t('provider.staff.conflict_title')"
      :message="$t('provider.staff.conflict_msg', { name: pendingDeactivationStaff?.name })"
      :confirmLabel="$t('common.confirm')"
      :isDestructive="true"
      @close="showConflictModal = false"
      @confirm="confirmDeactivation"
    >
      <div v-if="conflicts.length > 0" class="mt-4">
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
          {{ $t('provider.staff.conflict_notice') }}
        </p>
      </div>
    </ConfirmationModal>
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
</style>
