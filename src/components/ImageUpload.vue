<script setup lang="ts">
import { ref, watch } from 'vue'
import { optimizeImage } from '../lib/imageCompression'

const props = defineProps<{
  modelValue?: string | null
  processing?: boolean
  label?: string
  helpText?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  (e: 'change', file: File | null): void
}>()

const isDragging = ref(false)
const previewUrl = ref<string | null>(props.modelValue || null)
const fileInput = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, (val) => {
  previewUrl.value = val || null
})

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    if (file) processFile(file)
  }
}

async function processFile(file: File) {
  if (!file.type.startsWith('image/')) return
  
  // Local processing flag to show spinner during compression
  emit('update:modelValue', null) // Clear previous
  
  try {
    const optimized = await optimizeImage(file)
    
    // Create local preview
    const reader = new FileReader()
    reader.onload = (e) => {
      previewUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(optimized)
    
    emit('change', optimized)
  } catch (error) {
    console.error('Optimization failed in component, using original file:', error)
    // Fallback if optimization fails
    const reader = new FileReader()
    reader.onload = (e) => {
      previewUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
    emit('change', file)
  }
}

function removeImage() {
  previewUrl.value = null
  if (fileInput.value) fileInput.value.value = ''
  emit('change', null)
  emit('update:modelValue', null)
}

function triggerSelect() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-2">
      {{ label }}
    </label>
    
    <div
      class="relative group rounded-lg border-2 border-dashed transition-all duration-200 ease-in-out overflow-hidden"
      :class="[
        isDragging ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-300 hover:border-gray-400 bg-white',
        processing ? 'opacity-75 cursor-wait' : ''
      ]"
      @dragenter="handleDragEnter"
      @dragover.prevent
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        @change="handleFileSelect"
      />

      <!-- Preview State -->
      <div v-if="previewUrl" class="relative aspect-video w-full h-48 bg-gray-100">
        <img :src="previewUrl" alt="Preview" class="w-full h-full object-cover" />
        
        <!-- Overlay Actions -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            type="button"
            @click="triggerSelect"
            :disabled="processing"
            class="px-3 py-1.5 bg-white/90 text-gray-700 rounded-md text-sm font-medium hover:bg-white transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            @click="removeImage"
            :disabled="processing"
            class="px-3 py-1.5 bg-red-500/90 text-white rounded-md text-sm font-medium hover:bg-red-500 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-8 text-center cursor-pointer" @click="triggerSelect">
        <div 
          class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 transition-colors group-hover:bg-primary-50"
        >
          <svg class="w-6 h-6 text-gray-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
        <p class="text-xs text-gray-500 mt-1">PNG, JPG, WEBP up to 5MB</p>
      </div>

      <!-- Processing Overlay -->
      <div v-if="processing" class="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
    
    <p v-if="helpText" class="mt-2 text-xs text-gray-500">{{ helpText }}</p>
  </div>
</template>
