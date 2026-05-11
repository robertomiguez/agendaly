<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Staff, ProviderAddress } from '../../types'
import Modal from '../../components/common/Modal.vue'
import { useI18n } from 'vue-i18n'
import SubmitButton from '@/components/common/SubmitButton.vue'
import ImageUpload from '../ImageUpload.vue'

const props = defineProps<{
  isOpen: boolean
  staff: Staff | null
  providerAddresses: ProviderAddress[]
  initialAddressIds: string[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { 
    name: string
    email: string
    role: 'admin' | 'staff'
    active: boolean
    addressIds: string[]
    photoFile: File | null
  }): void
}>()

const { t } = useI18n()
const form = ref({
  name: '',
  email: '',
  role: 'staff' as 'admin' | 'staff',
  active: true,
  photo_url: null as string | null
})

const photoFile = ref<File | null>(null)
const selectedAddressIds = ref<string[]>([])

// Initialize form when staff prop changes or modal opens
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.staff) {
      form.value = {
        name: props.staff.name,
        email: props.staff.email,
        role: props.staff.role,
        active: props.staff.active,
        photo_url: props.staff.photo_url || null
      }
      photoFile.value = null
      // Initialize with passed address IDs
      selectedAddressIds.value = [...props.initialAddressIds]
    } else {
      // Reset for new staff
      form.value = {
        name: '',
        email: '',
        role: 'staff',
        active: true,
        photo_url: null
      }
      photoFile.value = null
      // Default: select all addresses for new staff
      selectedAddressIds.value = props.providerAddresses.map(a => a.id)
    }
  }
})

// Watch initialAddressIds for updates if they load after modal opens (just in case)
watch(() => props.initialAddressIds, (newVal) => {
  if (props.staff && props.isOpen) {
    selectedAddressIds.value = [...newVal]
  }
})

const isEditMode = computed(() => !!props.staff)
const title = computed(() => isEditMode.value ? t('provider.staff.edit_title') : t('provider.staff.add_button'))

function handleSubmit() {
  emit('save', {
    ...form.value,
    addressIds: selectedAddressIds.value,
    photoFile: photoFile.value
  })
}
</script>

<template>
  <Modal
    :is-open="isOpen"
    :title="title"
    @close="$emit('close')"
  >
    <form @submit.prevent="handleSubmit" class="mt-4 space-y-4">
      <!-- Photo Upload -->
      <div class="space-y-2">
        <ImageUpload
          v-model="form.photo_url"
          :label="$t('modals.staff.photo_label')"
          @change="file => photoFile = file"
        />
      </div>

      <div class="space-y-2">
        <label for="staff-name" class="staff-form-label">{{ $t('modals.staff.name') }}</label>
        <input
          id="staff-name"
          v-model="form.name"
          type="text"
          class="staff-form-input"
          required
        />
      </div>

      <div class="space-y-2">
        <label for="staff-email" class="staff-form-label">{{ $t('modals.staff.email') }}</label>
        <input
          id="staff-email"
          v-model="form.email"
          type="email"
          class="staff-form-input"
          required
        />
      </div>

      <div class="space-y-2">
        <label for="staff-role" class="staff-form-label">{{ $t('modals.staff.role') }}</label>
        <select
          id="staff-role"
          v-model="form.role"
          class="staff-form-input"
        >
          <option value="staff">{{ $t('modals.staff.roles.staff') }}</option>
          <option value="admin">{{ $t('modals.staff.roles.admin') }}</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <input
          id="staff-active"
          v-model="form.active"
          type="checkbox"
          class="staff-form-checkbox"
        />
        <label for="staff-active" class="staff-form-label staff-form-label--inline">{{ $t('modals.staff.active') }}</label>
      </div>

      <!-- Work Locations (Branches) -->
      <div v-if="providerAddresses.length > 0" class="space-y-2">
        <span class="staff-form-label">{{ $t('modals.staff.locations') }}</span>
        <div class="staff-form-location-list">
          <div v-for="address in providerAddresses" :key="address.id" class="flex items-start">
            <input
              :id="'addr-' + address.id"
              type="checkbox"
              :value="address.id"
              v-model="selectedAddressIds"
              class="staff-form-checkbox staff-form-checkbox--offset"
            />
            <label :for="'addr-' + address.id" class="staff-form-location-label">
              <span class="font-medium">{{ address.label || $t('modals.staff.location_fallback') }}</span>
              <span class="text-muted-foreground block text-xs">{{ address.street_address }}, {{ address.city }}</span>
            </label>
          </div>
        </div>
        <p v-if="selectedAddressIds.length === 0" class="text-xs text-destructive">
          {{ $t('modals.staff.locations_error') }}
        </p>
      </div>

      <div class="mt-5 flex gap-3 sm:justify-end">
        <button
          type="button"
          class="staff-form-action staff-form-action--secondary"
          @click="$emit('close')"
        >
          {{ $t('common.cancel') }}
        </button>
        <SubmitButton
          :loading="loading"
          :disabled="providerAddresses.length > 0 && selectedAddressIds.length === 0"
          :label="$t('common.save')"
          :loading-label="$t('common.saving')"
          responsive
        />
      </div>
    </form>
  </Modal>
</template>

<style scoped>
@reference "../../style.css";

.staff-form-label {
  @apply block text-sm font-medium text-gray-800;
}

.staff-form-label--inline {
  @apply cursor-pointer;
}

.staff-form-input {
  @apply flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200;
}

.staff-form-checkbox {
  @apply h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500;
}

.staff-form-checkbox--offset {
  @apply mt-0.5;
}

.staff-form-location-list {
  @apply max-h-40 space-y-2 overflow-y-auto rounded-md border border-gray-300 p-3;
}

.staff-form-location-label {
  @apply ml-2 cursor-pointer select-none text-sm text-gray-900;
}

.staff-form-action {
  @apply flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none;
}

.staff-form-action--secondary {
  @apply border border-gray-300 bg-white text-gray-800 hover:bg-gray-50;
}

.staff-form-action--primary {
  @apply bg-amber-600 text-white hover:bg-amber-700;
}
</style>
