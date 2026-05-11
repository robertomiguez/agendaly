<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useServiceStore } from '../stores/useServiceStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import type { Service } from '../types'
import { useModal } from '../composables/useModal'
import { useNotifications } from '../composables/useNotifications'
import { useI18n } from 'vue-i18n'
import { useDomainTranslation } from '../composables/useDomainTranslation'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

const serviceStore = useServiceStore()
const settingsStore = useSettingsStore()
const modal = useModal<Service>()
const { t } = useI18n()
const { td } = useDomainTranslation()
const { showSuccess, showError } = useNotifications()

const isEditing = ref(false)
const formData = ref({
  name: '',
  duration: 30,
  price: 0,
  buffer_before: 0,
  buffer_after: 0,
  category: '',
  active: true
})
const editingId = ref<string | null>(null)

// Confirmation logic
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingDeleteId = ref<string | null>(null)

function openDeleteConfirm(id: string) {
  pendingDeleteId.value = id
  confirmTitle.value = t('services.delete_confirm_title')
  confirmMessage.value = t('services.delete_confirm_msg')
  showConfirmModal.value = true
}

async function handleConfirmDelete() {
  if (!pendingDeleteId.value) return
  
  try {
    await serviceStore.deleteService(pendingDeleteId.value)
    showSuccess(t('services.delete_success'))
  } catch (e) {
    console.error('Error deleting service:', e)
    showError(t('services.delete_failed'))
  } finally {
    showConfirmModal.value = false
    pendingDeleteId.value = null
  }
}
const isLoading = ref(true)

onMounted(async () => {
  try {
    await serviceStore.fetchAllServices()
  } finally {
    isLoading.value = false
  }
})

function openCreateModal() {
  isEditing.value = false
  formData.value = {
    name: '',
    duration: 30,
    price: 0,
    buffer_before: 0,
    buffer_after: 0,
    category: '',
    active: true
  }
  modal.open(null)
}

function openEditModal(service: Service) {
  isEditing.value = true
  editingId.value = service.id
  formData.value = {
    name: service.name,
    duration: service.duration,
    price: service.price || 0,
    buffer_before: service.buffer_before,
    buffer_after: service.buffer_after,
    category: service.categories?.name || '',
    active: service.active
  }
  modal.open(service)
}

function closeModal() {
  modal.close()
  editingId.value = null
}

async function handleSubmit() {
  try {
    if (isEditing.value && editingId.value) {
      await serviceStore.updateService(editingId.value, formData.value)
      showSuccess(t('services.update_success'))
    } else {
      await serviceStore.createService(formData.value)
      showSuccess(t('services.create_success'))
    }
    closeModal()
  } catch (e) {
    console.error('Error saving service:', e)
    showError(t('services.save_failed'))
  }
}

function handleDelete(id: string) {
  openDeleteConfirm(id)
}


</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto p-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('services.title') }}</h1>
          <p class="text-gray-600">{{ $t('services.subtitle') }}</p>
        </div>
        <button
          @click="openCreateModal"
          class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + {{ $t('services.add_service') }}
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="serviceStore.error" class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
        {{ serviceStore.error }}
      </div>

      <!-- Loading State -->
      <div v-if="(serviceStore.loading || isLoading) && serviceStore.services.length === 0" class="bg-white rounded-lg shadow p-12 text-center">
        <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
        <p class="text-gray-500 mt-4">{{ $t('services.loading') }}</p>
      </div>

      <!-- Services Grid -->
      <div v-else-if="serviceStore.services.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="service in serviceStore.services"
          :key="service.id"
          class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
        >
          <div class="flex justify-between items-start mb-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ service.name }}</h3>
              <p v-if="service.categories?.name" class="text-sm text-gray-500">{{ td('categories', service.categories.name) }}</p>
            </div>
            <span class="text-lg font-bold text-primary-600">{{ settingsStore.formatPrice(service.price || 0) }}</span>
          </div>
          
          <div class="space-y-2 mb-4">
            <div class="flex items-center text-sm text-gray-600">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              {{ service.duration }} minutes
            </div>
            <div v-if="service.buffer_before > 0 || service.buffer_after > 0" class="flex items-center text-sm text-gray-600">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              Buffer: {{ service.buffer_before }}m before, {{ service.buffer_after }}m after
            </div>
          </div>
          
          <div class="flex gap-2">
            <button
              @click="openEditModal(service)"
              class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium transition-colors"
            >
              {{ $t('common.edit') }}
            </button>
            <button
              @click="handleDelete(service.id)"
              class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded text-sm font-medium transition-colors"
            >
              {{ $t('common.delete') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="bg-white rounded-lg shadow p-12 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
        </svg>
        <h3 class="mt-2 text-lg font-medium text-gray-900">{{ $t('services.no_services') }}</h3>
        <p class="mt-1 text-gray-500">{{ $t('services.no_services_desc') }}</p>
        <button
          @click="openCreateModal"
          class="mt-6 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + {{ $t('services.add_first') }}
        </button>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="modal.isOpen.value" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">
            {{ isEditing ? $t('services.edit_service') : $t('services.new_service') }}
          </h2>
          
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('services.form.name') }}</label>
              <input
                v-model="formData.name"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Haircut"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('services.form.category') }}</label>
              <input
                v-model="formData.category"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Hair, Spa, Nails"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('services.form.duration') }}</label>
                <input
                  v-model.number="formData.duration"
                  type="number"
                  required
                  min="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('services.form.price') }}</label>
                <input
                  v-model.number="formData.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('services.form.buffer_before') }}</label>
                <input
                  v-model.number="formData.buffer_before"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('services.form.buffer_after') }}</label>
                <input
                  v-model.number="formData.buffer_after"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div class="flex gap-3 pt-4">
              <button
                type="button"
                @click="closeModal"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                {{ $t('common.cancel') }}
              </button>
              <button
                type="submit"
                class="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {{ isEditing ? $t('services.form.save_changes') : $t('services.form.create_service') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

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
