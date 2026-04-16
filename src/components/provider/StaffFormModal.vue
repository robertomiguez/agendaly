<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Staff, ProviderAddress } from '../../types'
import Modal from '../../components/common/Modal.vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
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
        <Label for="staff-name">{{ $t('modals.staff.name') }}</Label>
        <Input
          id="staff-name"
          v-model="form.name"
          type="text"
          required
        />
      </div>

      <div class="space-y-2">
        <Label for="staff-email">{{ $t('modals.staff.email') }}</Label>
        <Input
          id="staff-email"
          v-model="form.email"
          type="email"
          required
        />
      </div>

      <div class="space-y-2">
        <Label for="staff-role">{{ $t('modals.staff.role') }}</Label>
        <select
          id="staff-role"
          v-model="form.role"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <Label for="staff-active" class="cursor-pointer">{{ $t('modals.staff.active') }}</Label>
      </div>

      <!-- Work Locations (Branches) -->
      <div v-if="providerAddresses.length > 0" class="space-y-2">
        <Label>{{ $t('modals.staff.locations') }}</Label>
        <div class="space-y-2 max-h-40 overflow-y-auto border border-input rounded-md p-3">
          <div v-for="address in providerAddresses" :key="address.id" class="flex items-start">
            <input
              :id="'addr-' + address.id"
              type="checkbox"
              :value="address.id"
              v-model="selectedAddressIds"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
            />
            <label :for="'addr-' + address.id" class="ml-2 text-sm text-foreground select-none cursor-pointer">
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
        <Button
          type="button"
          variant="outline"
          class="flex-1 sm:flex-none"
          @click="$emit('close')"
        >
          {{ $t('common.cancel') }}
        </Button>
        <Button
          type="submit"
          :disabled="loading || (providerAddresses.length > 0 && selectedAddressIds.length === 0)"
          class="flex-1 sm:flex-none bg-primary-600 hover:bg-primary-700"
        >
          <LoadingSpinner v-if="loading" inline size="sm" class="mr-2" color="text-white" />
          {{ loading ? $t('common.saving') : $t('common.save') }}
        </Button>
      </div>
    </form>
  </Modal>
</template>
