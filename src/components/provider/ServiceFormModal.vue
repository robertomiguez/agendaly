<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useCategoryStore } from '../../stores/useCategoryStore'
import { useStaffStore } from '../../stores/useStaffStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useCurrency } from '../../composables/useCurrency'
import Modal from '../../components/common/Modal.vue'
import { Trash2, ImagePlus } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { supabase } from '../../lib/supabase'
import { MAX_SERVICE_IMAGES, MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB, SERVICE_IMAGES_BUCKET } from '../../constants'

const props = defineProps<{
  service: any // Temporarily using any to debug potential type import issues
  loading?: boolean
  submitError?: string | null
}>()

const emit = defineEmits(['close', 'save'])
const categoryStore = useCategoryStore()
const staffStore = useStaffStore()
const authStore = useAuthStore()
const { currencySymbol } = useCurrency()

const uploading = ref(false)
const imageError = ref<string | null>(null)
const staffError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const images = ref<{ id: string, url: string, file?: File }[]>([])

const actionFeedback = computed(() => actionError.value || props.submitError || null)
const requiresStaffSelection = computed(() => staffStore.staff.length > 0 && form.value.staff_ids.length === 0)

const form = ref({
  name: '',
  category_id: '',
  price: 0,
  duration: 30,
  description: '',
  buffer_before: 0,
  buffer_after: 0,
  staff_ids: [] as string[]
})

onMounted(async () => {
  const promises = []
  
  // Only fetch if we don't have categories yet
  if (categoryStore.categories.length === 0) {
    promises.push(categoryStore.fetchCategories())
  }
  
  if (authStore.provider) {
    promises.push(staffStore.fetchStaff(authStore.provider.id))
  }
  
  await Promise.all(promises)
  
  if (props.service) {
    form.value = {
      name: props.service.name,
      category_id: props.service.category_id || '',
      price: props.service.price || 0,
      duration: props.service.duration,
      description: props.service.description || '',
      buffer_before: props.service.buffer_before || 0,
      buffer_after: props.service.buffer_after || 0,
      staff_ids: props.service.staff?.map((s: any) => s.id) || []
    }
    
    if (props.service.images) {
      images.value = props.service.images.map((img: any) => ({
        id: img.id,
        url: img.url
      }))
    }
  } else {
    // For new services, verify we have a valid initial state
    if (categoryStore.categories.length > 0) {
      // Default to first category
      form.value.category_id = categoryStore.categories[0]?.id || ''
    }
  }
})

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  imageError.value = null
  actionError.value = null
  const remainingSlots = MAX_SERVICE_IMAGES - images.value.length
  
  if (remainingSlots <= 0) {
      imageError.value = `Maximum ${MAX_SERVICE_IMAGES} images allowed`
      return
  }

  const files = Array.from(input.files).slice(0, remainingSlots)
  
  for (const file of files) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        imageError.value = `Image ${file.name} exceeds ${MAX_IMAGE_SIZE_MB}MB limit`
        continue
    }
    // simple type check
    if (!file.type.startsWith('image/')) {
        imageError.value = `File ${file.name} is not an image`
        continue
    }

    images.value.push({
      id: `temp-${Date.now()}-${Math.random()}`,
      url: URL.createObjectURL(file), // Preview URL
      file
    })
  }
  input.value = ''
}

function removeImage(index: number) {
    images.value.splice(index, 1)
}

function clearStaffSelectionError() {
  staffError.value = null
  actionError.value = null
}

async function handleSubmit() {
  actionError.value = null

  if (form.value.staff_ids.length === 0) {
    staffError.value = 'modals.service.staff_required'
    actionError.value = 'modals.service.staff_required'
    return
  }

  uploading.value = true
  imageError.value = null
  staffError.value = null
  
  try {
    const finalUrls: string[] = []
    
    for (const img of images.value) {
      if (img.file) {
        // Upload new file
        const fileExt = img.file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${fileName}` // Upload to root of bucket for simplicity

        const { error } = await supabase.storage
          .from(SERVICE_IMAGES_BUCKET)
          .upload(filePath, img.file)

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage
            .from(SERVICE_IMAGES_BUCKET)
            .getPublicUrl(filePath)
            
        finalUrls.push(publicUrl)
      } else {
        // Existing URL
        finalUrls.push(img.url)
      }
    }
    
    emit('save', { 
        ...form.value, 
        id: props.service?.id,
        active: props.service?.active ?? true,
        image_urls: finalUrls 
    })
  } catch (error: any) {
      console.error('Error uploading images:', error)
      imageError.value = 'Failed to upload images: ' + error.message
      actionError.value = imageError.value
      uploading.value = false // Stop loading if error, otherwise parent handles loading state
      // If parent handles loading, we should probably not set loading=true in parent if we fail here?
      // But parent sets saving=true ONLY when 'save' is emitted. 
      // So if we don't emit save, parent doesn't show loading.
  } finally {
      // If successful, uploading remains true until parent finishes? 
      // No, we set uploading=false, then emit save. Parent reads props.loading.
      // Wait, if we set uploading=false before emit, and parent sets loading=true on emit, there might be a flicker?
      // Actually 'uploading' handles our local async work.
      // Once we emit, 'props.loading' takes over for the save operation.
      // So we should set uploading=false.
      uploading.value = false
  }
}
</script>

<template>
  <Modal
    :is-open="true"
    :title="service ? $t('modals.service.title_edit') : $t('modals.service.title_new')"
    @close="$emit('close')"
  >
    <form @submit.prevent="handleSubmit" class="mt-4 space-y-4">
      <!-- Name -->
      <div class="space-y-2">
        <label for="service-name" class="service-form-label">{{ $t('modals.service.name') }}</label>
        <input
          id="service-name"
          v-model="form.name"
          type="text"
          class="service-form-input"
          required
          :placeholder="$t('modals.service.name_placeholder')"
        />
      </div>

      <!-- Images -->
      <div class="space-y-2">
        <span class="service-form-label">{{ $t('modals.service.images') }} (Max {{ MAX_SERVICE_IMAGES }})</span>
        
        <div class="flex flex-wrap gap-4">
            <!-- Existing/Preview Images -->
            <div v-for="(img, index) in images" :key="img.id" class="relative group w-24 h-24 rounded-md overflow-hidden border border-gray-200">
                <img :src="img.url" class="w-full h-full object-cover" />
                <button 
                    type="button"
                    @click="removeImage(index)"
                    class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    :title="$t('common.remove')"
                >
                    <Trash2 class="w-3 h-3" />
                </button>
            </div>

            <!-- Upload Button -->
            <div 
                v-if="images.length < MAX_SERVICE_IMAGES"
                class="relative w-24 h-24 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md hover:border-primary-500 transition-colors cursor-pointer bg-gray-50 hover:bg-white"
            >
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    class="absolute inset-0 opacity-0 cursor-pointer" 
                    @change="handleFileSelect"
                />
                <div class="text-center p-2">
                    <ImagePlus class="w-6 h-6 mx-auto text-gray-400" />
                    <span class="text-xs text-gray-500 mt-1 block">Add Image</span>
                </div>
            </div>
        </div>
        
        <div v-if="imageError" class="text-sm text-red-600 mt-1">
            {{ imageError }}
        </div>
        <p class="text-xs text-muted-foreground">
            Max {{ MAX_IMAGE_SIZE_MB }}MB per image.
        </p>
      </div>

      <!-- Category -->
      <div class="space-y-2">
        <label for="service-category" class="service-form-label">{{ $t('modals.service.category') }}</label>
        <select
          id="service-category"
          v-model="form.category_id"
          required
          class="service-form-input"
        >
          <option value="" disabled>{{ $t('modals.service.category_placeholder') }}</option>
          <option v-for="cat in categoryStore.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Price -->
        <div class="space-y-2">
          <label for="service-price" class="service-form-label">{{ $t('modals.service.price') }}</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{{ currencySymbol }}</span>
            <input
              id="service-price"
              v-model="form.price"
              type="number"
              min="0"
              step="0.01"
              required
              class="service-form-input"
              :class="currencySymbol.length > 1 ? 'service-form-input--currency-wide' : 'service-form-input--currency'"
            />
          </div>
        </div>

        <!-- Duration -->
        <div class="space-y-2">
          <label for="service-duration" class="service-form-label">{{ $t('modals.service.duration') }}</label>
          <input
            id="service-duration"
            v-model="form.duration"
            type="number"
            min="5"
            step="5"
            class="service-form-input"
            required
          />
        </div>
      </div>

      <!-- Description -->
      <div class="space-y-2">
        <label for="service-description" class="service-form-label">{{ $t('modals.service.description') }}</label>
        <textarea
          id="service-description"
          v-model="form.description"
          rows="3"
          class="service-form-textarea"
          :placeholder="$t('modals.service.description_placeholder')"
        ></textarea>
      </div>

      <!-- Staff Selection -->
      <div class="space-y-2">
        <span class="service-form-label">{{ $t('modals.service.assign_staff') }}</span>
        <div class="border border-input rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
          <div v-if="staffStore.staff.length === 0" class="text-sm text-muted-foreground italic px-2">
            {{ $t('modals.service.no_staff') }}
          </div>
          <div v-for="member in staffStore.staff" :key="member.id" class="flex items-center">
            <input
              :id="'staff-' + member.id"
              type="checkbox"
              :value="member.id"
              v-model="form.staff_ids"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              @change="clearStaffSelectionError"
            />
            <label :for="'staff-' + member.id" class="ml-2 block text-sm text-foreground select-none cursor-pointer flex-1">
              {{ member.name }}
            </label>
          </div>
        </div>
        <p v-if="requiresStaffSelection || staffError" class="text-sm text-red-600">{{ $t('modals.service.staff_required') }}</p>
        <p class="text-xs text-muted-foreground">{{ $t('modals.service.assign_staff_help') }}</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Buffer Before -->
        <div class="space-y-2">
          <label for="buffer-before" class="service-form-label">{{ $t('modals.service.buffer_before') }}</label>
          <input
            id="buffer-before"
            v-model="form.buffer_before"
            type="number"
            min="0"
            step="5"
            class="service-form-input"
          />
        </div>

        <!-- Buffer After -->
        <div class="space-y-2">
          <label for="buffer-after" class="service-form-label">{{ $t('modals.service.buffer_after') }}</label>
          <input
            id="buffer-after"
            v-model="form.buffer_after"
            type="number"
            min="0"
            step="5"
            class="service-form-input"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="service-form-actions">
        <div
          v-if="actionFeedback"
          class="service-form-actions__feedback"
          role="alert"
        >
          {{ actionFeedback.startsWith('modals.') ? $t(actionFeedback) : actionFeedback }}
        </div>

        <div class="service-form-actions__buttons">
        <button
          type="button"
          class="service-form-action service-form-action--secondary"
          @click="$emit('close')"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="submit"
          :disabled="props.loading || uploading || requiresStaffSelection"
          class="service-form-action service-form-action--primary"
        >
          <LoadingSpinner v-if="props.loading || uploading" inline size="sm" class="mr-2" color="text-white" />
          {{ props.loading || uploading ? $t('modals.service.saving') : $t('modals.service.save_button') }}
        </button>
        </div>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
@reference "../../style.css";

.service-form-label {
  @apply block text-sm font-medium text-gray-800;
}

.service-form-input {
  @apply flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200;
}

.service-form-input--currency {
  @apply pl-7;
}

.service-form-input--currency-wide {
  @apply pl-12;
}

.service-form-textarea {
  @apply flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200;
}

.service-form-actions {
  @apply mt-5 space-y-3;
}

.service-form-actions__feedback {
  @apply rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.service-form-actions__buttons {
  @apply flex gap-3 sm:justify-end;
}

.service-form-action {
  @apply flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none;
}

.service-form-action--secondary {
  @apply border border-gray-300 bg-white text-gray-800 hover:bg-gray-50;
}

.service-form-action--primary {
  @apply bg-amber-600 text-white hover:bg-amber-700;
}
</style>
