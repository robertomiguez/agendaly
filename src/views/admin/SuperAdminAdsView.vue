<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { format } from 'date-fns'
import { useSuperAdminStore } from '../../stores/useSuperAdminStore'
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Calendar,
  MousePointerClick,
  Loader2,
  AlertCircle,
  PackageX,
  Image as ImageIcon
} from 'lucide-vue-next'
import type { Ad } from '@/types'

const adminStore = useSuperAdminStore()
const searchQuery = ref('')
const isModalOpen = ref(false)
const isDeleting = ref(false)
const adToDelete = ref<Ad | null>(null)

// Form state
const isEditing = ref(false)
const adForm = ref<Partial<Ad>>({
  title: '',
  description: '',
  link_url: '',
  placement: ['landing'],
  is_active: true,
  priority: 0,
  start_at: '',
  end_at: ''
})
const selectedFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  adminStore.fetchAds()
})

const filteredAds = computed(() => {
  if (!searchQuery.value) return adminStore.ads
  const q = searchQuery.value.toLowerCase()
  return adminStore.ads.filter(ad =>
    ad.title.toLowerCase().includes(q) ||
    ad.description?.toLowerCase().includes(q) ||
    ad.placement.some(p => p.toLowerCase().includes(q))
  )
})

function openCreateModal() {
  isEditing.value = false
  adForm.value = {
    title: '',
    description: '',
    link_url: '',
    placement: ['landing'],
    is_active: true,
    priority: 0,
    start_at: '',
    end_at: ''
  }
  selectedFile.value = null
  imagePreview.value = null
  isModalOpen.value = true
}

function formatDateForInput(dateStr?: string) {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return format(date, "yyyy-MM-dd'T'HH:mm")
  } catch (e) {
    return ''
  }
}

function openEditModal(ad: Ad) {
  isEditing.value = true
  adForm.value = {
    ...ad,
    placement: Array.isArray(ad.placement) ? [...ad.placement] : [ad.placement],
    start_at: ad.start_at ? formatDateForInput(ad.start_at) : '',
    end_at: ad.end_at ? formatDateForInput(ad.end_at) : ''
  }
  selectedFile.value = null
  imagePreview.value = ad.image_url || null
  isModalOpen.value = true
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    // Revoke previous preview URL to avoid memory leaks
    if (imagePreview.value && imagePreview.value.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview.value)
    }
    
    selectedFile.value = target.files[0]
    imagePreview.value = URL.createObjectURL(target.files[0])
  }
}

onUnmounted(() => {
  if (imagePreview.value && imagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview.value)
  }
})

async function handleSubmit() {
  try {
    const dataToSave = { ...adForm.value }

    // Convert local datetime-local strings back to ISO for storage
    if (dataToSave.start_at) {
      dataToSave.start_at = new Date(dataToSave.start_at).toISOString()
    }
    if (dataToSave.end_at) {
      dataToSave.end_at = new Date(dataToSave.end_at).toISOString()
    }

    await adminStore.saveAd(dataToSave, selectedFile.value || undefined)
    isModalOpen.value = false
  } catch (e) {
    console.error('Failed to save ad:', e)
  }
}

async function confirmDelete(ad: Ad) {
  adToDelete.value = ad
  isDeleting.value = true
}

async function handleDelete() {
  if (!adToDelete.value) return
  try {
    await adminStore.removeAd(adToDelete.value)
    isDeleting.value = false
    adToDelete.value = null
  } catch (e) {
    console.error('Failed to delete ad:', e)
  }
}

async function toggleStatus(ad: Ad) {
  try {
    await adminStore.toggleAdActive(ad, !ad.is_active)
  } catch (e) {
    console.error('Failed to toggle ad status:', e)
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Not set'
  return new Date(dateStr).toLocaleDateString()
}

function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="ads-page">
    <div class="ads-header">
      <div>
        <h1 class="ads-title">Advertisement Management</h1>
        <p class="ads-subtitle">Manage banners, promotions, and platform-wide ads.</p>
      </div>

      <div class="ads-toolbar">
        <div class="ads-search">
          <Search class="ads-search__icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search ads..."
            class="ads-search__input"
          />
        </div>
        <button @click="openCreateModal" class="ads-button ads-button--primary">
          <Plus class="ads-button__icon" />
          Create Ad
        </button>
      </div>
    </div>

    <div v-if="adminStore.loading && adminStore.ads.length === 0" class="ads-loading">
      <Loader2 class="ads-loading__icon" />
      <p class="ads-loading__text">Fetching ads...</p>
    </div>

    <div v-else-if="adminStore.error" class="ads-error">
      <div class="ads-error__icon-wrap">
        <AlertCircle class="ads-error__icon" />
      </div>
      <div>
        <h3 class="ads-error__title">Something went wrong</h3>
        <p class="ads-error__message">{{ adminStore.error }}</p>
        <button
          class="ads-button ads-error__button"
          @click="adminStore.fetchAds()"
        >
          Try Again
        </button>
      </div>
    </div>

    <div v-else class="ads-table-card">
      <div v-if="filteredAds.length > 0" class="ads-table-scroll">
        <table class="ads-table">
          <thead class="ads-table__head">
            <tr>
              <th class="ads-table__heading">Ad Content</th>
              <th class="ads-table__heading">Placement</th>
              <th class="ads-table__heading">Stats</th>
              <th class="ads-table__heading">Schedule</th>
              <th class="ads-table__heading">Status</th>
              <th class="ads-table__heading"></th>
            </tr>
          </thead>
          <tbody class="ads-table__body">
            <tr v-for="ad in filteredAds" :key="ad.id" class="ads-table__row">
              <td class="ads-table__cell">
                <div class="ads-content-cell">
                  <div class="ads-thumbnail">
                    <img v-if="ad.image_url" :src="ad.image_url" class="ads-thumbnail__image" />
                    <ImageIcon v-else class="ads-thumbnail__icon" />
                  </div>
                  <div class="ads-content-cell__copy">
                    <div class="ads-content-cell__title">{{ ad.title }}</div>
                    <div class="ads-content-cell__description">{{ ad.description || 'No description' }}</div>
                  </div>
                </div>
              </td>
              <td class="ads-table__cell">
                <div class="ads-placement-list">
                  <span
                    v-for="p in ad.placement"
                    :key="p"
                    class="ads-placement-pill"
                  >
                    {{ p }}
                  </span>
                </div>
              </td>
              <td class="ads-table__cell">
                <div class="ads-stat">
                  <MousePointerClick class="ads-stat__icon" />
                  {{ ad.click_count }} <span class="ads-stat__label">clicks</span>
                </div>
              </td>
              <td class="ads-table__cell">
                <div class="ads-schedule">
                  <div class="ads-schedule__row">
                    <Calendar class="ads-schedule__icon" />
                    <span>Start: {{ formatDate(ad.start_at) }}</span>
                  </div>
                  <div class="ads-schedule__row">
                    <Calendar class="ads-schedule__icon" />
                    <span>End: {{ formatDate(ad.end_at) }}</span>
                  </div>
                </div>
              </td>
              <td class="ads-table__cell">
                <button
                  @click="toggleStatus(ad)"
                  :class="[
                    'ads-status',
                    ad.is_active ? 'ads-status--active' : 'ads-status--paused'
                  ]"
                >
                  {{ ad.is_active ? 'Active' : 'Paused' }}
                </button>
              </td>
              <td class="ads-table__cell ads-table__cell--actions">
                <details class="ads-menu">
                  <summary class="ads-menu-button">
                    <MoreVertical class="ads-menu-button__icon" />
                  </summary>
                  <div class="ads-menu-content">
                    <button @click="openEditModal(ad)" class="ads-menu-item">
                      <Pencil class="ads-menu-icon" />
                      Edit
                    </button>
                    <button v-if="ad.link_url" @click="openLink(ad.link_url)" class="ads-menu-item">
                      <ExternalLink class="ads-menu-icon" />
                      Preview Link
                    </button>
                    <button @click="toggleStatus(ad)" class="ads-menu-item">
                      <component :is="ad.is_active ? EyeOff : Eye" class="ads-menu-icon" />
                      {{ ad.is_active ? 'Deactivate' : 'Activate' }}
                    </button>
                    <div class="ads-menu-separator"></div>
                    <button @click="confirmDelete(ad)" class="ads-menu-item ads-menu-danger">
                      <Trash2 class="ads-menu-icon" />
                      Delete
                    </button>
                  </div>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="ads-empty">
        <div class="ads-empty__icon-wrap">
          <PackageX class="ads-empty__icon" />
        </div>
        <h3 class="ads-empty__title">No ads found</h3>
        <p class="ads-empty__message">
          {{ searchQuery ? 'No ads match your search criteria.' : 'Create your first advertisement campaign to see it here.' }}
        </p>
        <button v-if="searchQuery" class="ads-empty__link" @click="searchQuery = ''">
          Clear Search
        </button>
        <button v-else @click="openCreateModal" class="ads-button ads-empty__button">
          Create New Ad
        </button>
      </div>
    </div>

    <div v-if="isModalOpen" class="ads-modal">
      <div class="ads-modal__panel">
        <div class="ads-modal__header">
          <h2 class="ads-modal__title">{{ isEditing ? 'Edit Advertisement' : 'Create New Advertisement' }}</h2>
        </div>

        <form @submit.prevent="handleSubmit" class="ads-form">
          <div class="ads-field">
            <label class="ads-label">Banner Image</label>
            <div
              class="ads-upload"
              @click="fileInput?.click()"
            >
              <img v-if="imagePreview" :src="imagePreview" class="ads-upload__preview" />
              <div v-else class="ads-upload__empty">
                <ImageIcon class="ads-upload__icon" />
                <p class="ads-upload__text">Click to upload banner image</p>
                <p class="ads-upload__hint">PNG, JPG or WebP. Recommended 1200x400</p>
              </div>
              <input
                type="file"
                ref="fileInput"
                class="ads-upload__input"
                accept="image/png,image/jpeg,image/webp"
                @change="handleFileChange"
              />
            </div>
          </div>

          <div class="ads-form-grid">
            <div class="ads-field">
              <label class="ads-label">Title</label>
              <input v-model="adForm.title" required type="text" class="ads-input" />
            </div>
            <div class="ads-field">
              <label class="ads-label">Placement(s)</label>
              <div class="ads-checkbox-list">
                <label class="ads-checkbox">
                  <input
                    type="checkbox"
                    value="landing"
                    v-model="adForm.placement"
                    class="ads-checkbox__input"
                  />
                  <span class="ads-checkbox__label">Landing Page</span>
                </label>
                <label class="ads-checkbox">
                  <input
                    type="checkbox"
                    value="booking"
                    v-model="adForm.placement"
                    class="ads-checkbox__input"
                  />
                  <span class="ads-checkbox__label">Booking Page</span>
                </label>
              </div>
            </div>
          </div>

          <div class="ads-field">
            <label class="ads-label">Description (Optional)</label>
            <textarea v-model="adForm.description" rows="2" class="ads-input"></textarea>
          </div>

          <div class="ads-form-grid">
            <div class="ads-field">
              <label class="ads-label">Redirect Link (URL)</label>
              <input v-model="adForm.link_url" type="url" placeholder="https://..." class="ads-input" />
            </div>
            <div class="ads-field">
              <label class="ads-label">Priority (Higher shows first)</label>
              <input v-model.number="adForm.priority" type="number" class="ads-input" />
            </div>
          </div>

          <div class="ads-form-grid ads-form-grid--dates">
            <div class="ads-field">
              <label class="ads-label">Start Date</label>
              <input v-model="adForm.start_at" type="datetime-local" class="ads-input" />
            </div>
            <div class="ads-field">
              <label class="ads-label">End Date</label>
              <input v-model="adForm.end_at" type="datetime-local" class="ads-input" />
            </div>
          </div>

          <div class="ads-active-field">
            <input v-model="adForm.is_active" type="checkbox" id="is_active" class="ads-checkbox__input" />
            <label for="is_active" class="ads-active-field__label">Active Immediately</label>
          </div>

          <div class="ads-form-actions">
            <button type="button" class="ads-button ads-form-actions__button" @click="isModalOpen = false">Cancel</button>
            <button type="submit" class="ads-button ads-button--primary ads-form-actions__button" :disabled="adminStore.loading">
              <Loader2 v-if="adminStore.loading" class="ads-button__icon ads-button__icon--spin" />
              {{ isEditing ? 'Update Advertisement' : 'Create Advertisement' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="isDeleting" class="ads-modal">
      <div class="ads-delete-panel">
        <div class="ads-delete-icon-wrap">
          <Trash2 class="ads-delete-icon" />
        </div>
        <h3 class="ads-delete-title">Delete Advertisement?</h3>
        <p class="ads-delete-message">This action cannot be undone. The banner image will also be removed from storage.</p>
        <div class="ads-delete-actions">
          <button class="ads-button ads-delete-actions__button" @click="isDeleting = false">Cancel</button>
          <button class="ads-button ads-button--danger ads-delete-actions__button" @click="handleDelete" :disabled="adminStore.loading">
            <Loader2 v-if="adminStore.loading" class="ads-button__icon ads-button__icon--spin" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.ads-page {
  @apply space-y-6;
}

.ads-header {
  @apply flex flex-col md:flex-row md:items-center justify-between gap-4;
}

.ads-title {
  @apply text-2xl font-bold text-slate-900;
}

.ads-subtitle {
  @apply text-slate-500 text-sm;
}

.ads-toolbar {
  @apply flex items-center gap-3;
}

.ads-search {
  @apply relative w-full md:w-64;
}

.ads-search__icon {
  @apply absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400;
}

.ads-search__input,
.ads-input {
  @apply w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm;
}

.ads-search__input {
  @apply pl-10 pr-4 py-2;
}

.ads-button {
  @apply inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60;
}

.ads-button--primary {
  @apply bg-indigo-600 hover:bg-indigo-700 text-white;
}

.ads-button--danger {
  @apply bg-rose-600 hover:bg-rose-700 text-white;
}

.ads-button__icon {
  @apply h-4 w-4 mr-2;
}

.ads-button__icon--spin,
.ads-loading__icon {
  @apply animate-spin;
}

.ads-loading {
  @apply flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm;
}

.ads-loading__icon {
  @apply h-10 w-10 text-indigo-500 mb-4;
}

.ads-loading__text {
  @apply text-slate-500 font-medium;
}

.ads-error {
  @apply bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-4;
}

.ads-error__icon-wrap {
  @apply p-2 bg-rose-100 text-rose-600 rounded-lg;
}

.ads-error__icon {
  @apply h-6 w-6;
}

.ads-error__title {
  @apply font-bold text-rose-900;
}

.ads-error__message {
  @apply text-sm text-rose-700 mt-1;
}

.ads-error__button {
  @apply mt-4 border-rose-200 text-rose-700 hover:bg-rose-100;
}

.ads-table-card {
  @apply bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden;
}

.ads-table-scroll {
  @apply overflow-x-auto;
}

.ads-table {
  @apply w-full text-left;
}

.ads-table__head {
  @apply bg-slate-50 border-b border-slate-200;
}

.ads-table__heading {
  @apply px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider;
}

.ads-table__body {
  @apply divide-y divide-slate-100;
}

.ads-table__row {
  @apply hover:bg-slate-50 transition-colors;
}

.ads-table__cell {
  @apply px-6 py-4;
}

.ads-table__cell--actions {
  @apply text-right;
}

.ads-content-cell {
  @apply flex items-center gap-4;
}

.ads-content-cell__copy {
  @apply min-w-0;
}

.ads-content-cell__title {
  @apply font-bold text-slate-900 truncate max-w-[200px];
}

.ads-content-cell__description {
  @apply text-xs text-slate-500 truncate max-w-[200px];
}

.ads-thumbnail {
  @apply h-12 w-20 rounded bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 shrink-0;
}

.ads-thumbnail__image {
  @apply h-full w-full object-cover;
}

.ads-thumbnail__icon {
  @apply h-5 w-5 text-slate-300;
}

.ads-placement-list {
  @apply flex flex-wrap gap-1;
}

.ads-placement-pill {
  @apply px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider;
}

.ads-stat {
  @apply flex items-center text-sm text-slate-600;
}

.ads-stat__icon {
  @apply h-3.5 w-3.5 mr-1.5 text-indigo-400;
}

.ads-stat__label {
  @apply text-xs text-slate-400 ml-1;
}

.ads-schedule {
  @apply flex flex-col text-[10px] text-slate-500;
}

.ads-schedule__row {
  @apply flex items-center mt-0.5 first:mt-0;
}

.ads-schedule__icon {
  @apply h-3 w-3 mr-1 opacity-50;
}

.ads-status {
  @apply px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors;
}

.ads-status--active {
  @apply bg-emerald-100 text-emerald-700 hover:bg-emerald-200;
}

.ads-status--paused {
  @apply bg-rose-100 text-rose-700 hover:bg-rose-200;
}

.ads-menu {
  @apply relative inline-block text-left;
}

.ads-menu-button {
  @apply flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100;
}

.ads-menu-content {
  @apply absolute right-0 z-20 mt-2 min-w-40 rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg;
}

.ads-menu-button__icon,
.ads-menu-icon {
  @apply h-4 w-4;
}

.ads-menu-icon {
  @apply mr-2;
}

.ads-menu-separator {
  @apply h-px bg-slate-100 my-1;
}

.ads-menu-item {
  @apply flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50;
}

.ads-menu-danger {
  @apply text-rose-600;
}

.ads-empty {
  @apply py-24 text-center;
}

.ads-empty__icon-wrap {
  @apply inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-50 text-slate-300 mb-4;
}

.ads-empty__icon {
  @apply h-8 w-8;
}

.ads-empty__title {
  @apply text-lg font-bold text-slate-900;
}

.ads-empty__message {
  @apply text-slate-500 max-w-xs mx-auto mt-1;
}

.ads-empty__link {
  @apply mt-2 text-indigo-600;
}

.ads-empty__button {
  @apply mt-4;
}

.ads-modal {
  @apply fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm;
}

.ads-modal__panel {
  @apply bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl;
}

.ads-modal__header {
  @apply p-6 border-b border-slate-100;
}

.ads-modal__title {
  @apply text-xl font-bold text-slate-900;
}

.ads-form {
  @apply p-6 space-y-4;
}

.ads-field {
  @apply space-y-2;
}

.ads-label {
  @apply text-sm font-bold text-slate-700;
}

.ads-upload {
  @apply relative h-40 w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors;
}

.ads-upload__preview {
  @apply h-full w-full object-cover;
}

.ads-upload__empty {
  @apply text-center;
}

.ads-upload__icon {
  @apply h-10 w-10 text-slate-300 mx-auto mb-2;
}

.ads-upload__text {
  @apply text-xs text-slate-500 font-medium;
}

.ads-upload__hint {
  @apply text-[10px] text-slate-400;
}

.ads-upload__input {
  @apply hidden;
}

.ads-form-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.ads-form-grid--dates {
  @apply pt-2;
}

.ads-checkbox-list {
  @apply flex flex-wrap gap-4 pt-1;
}

.ads-checkbox {
  @apply flex items-center gap-2 cursor-pointer;
}

.ads-checkbox__input {
  @apply h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500;
}

.ads-checkbox__label {
  @apply text-sm text-slate-600;
}

.ads-active-field {
  @apply flex items-center gap-2 pt-2;
}

.ads-active-field__label {
  @apply text-sm font-medium text-slate-700;
}

.ads-form-actions,
.ads-delete-actions {
  @apply flex gap-3;
}

.ads-form-actions {
  @apply pt-4 border-t border-slate-100;
}

.ads-form-actions__button,
.ads-delete-actions__button {
  @apply flex-1;
}

.ads-delete-panel {
  @apply bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl;
}

.ads-delete-icon-wrap {
  @apply h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4;
}

.ads-delete-icon {
  @apply h-6 w-6;
}

.ads-delete-title {
  @apply text-lg font-bold text-slate-900 mb-1;
}

.ads-delete-message {
  @apply text-sm text-slate-500 mb-6;
}
</style>
