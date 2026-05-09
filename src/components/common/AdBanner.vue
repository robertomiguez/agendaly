<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { adService } from '@/services/adService'
import type { Ad } from '@/types'

const props = withDefaults(defineProps<{
  placement?: 'landing' | 'booking'
}>(), {
  placement: 'landing',
})

const ad = ref<(Ad & { placement: string[] }) | null>(null)
const isLoading = ref(true)
const imageError = ref(false)

const placementClass = computed(() => `ad-banner--${props.placement}`)

async function loadAd() {
  isLoading.value = true
  imageError.value = false
  try {
    ad.value = await adService.getActiveAd(props.placement) as any
  } finally {
    isLoading.value = false
  }
}

function handleAdClick() {
  if (ad.value?.id) {
    adService.trackClick(ad.value.id)
    if (ad.value.link_url) {
      window.open(ad.value.link_url, '_blank', 'noopener,noreferrer')
    }
  }
}

function onImageError() {
  imageError.value = true
}

onMounted(() => {
  loadAd()
})
</script>

<template>
  <aside
    v-if="ad || isLoading"
    class="ad-banner"
    :class="[
      placementClass,
      { 'ad-banner--has-image': ad?.image_url && !imageError },
      { 'ad-banner--loading': isLoading }
    ]"
    @click="handleAdClick"
  >
    <div v-if="!isLoading" class="ad-banner__label">Advertisement</div>

    <div class="ad-banner__container">
      <!-- Loading State -->
      <div v-if="isLoading" class="ad-banner__skeleton">
        <div class="ad-banner__skeleton-pulse"></div>
      </div>

      <!-- Primary: Image -->
      <template v-else-if="ad">
        <div v-if="ad.image_url && !imageError" class="ad-banner__image-wrapper">
          <img
            :src="ad.image_url"
            :alt="ad.title"
            class="ad-banner__image"
            @error="onImageError"
          />
        </div>

        <!-- Fallback: Text content (only shows if no image or image failed) -->
        <div v-else class="ad-banner__content">
          <p class="ad-banner__title">{{ ad.title }}</p>
          <p v-if="ad.description" class="ad-banner__copy">
            {{ ad.description }}
          </p>
          <div class="ad-banner__footer">
            <span class="ad-banner__link">Learn More</span>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
@reference "../../style.css";

.ad-banner {
  @apply relative bg-gray-50 border-dashed border-2 border-gray-300 p-0 overflow-hidden text-gray-500 my-6 shadow-sm hover:shadow-md transition-all cursor-pointer;
}

.ad-banner--has-image {
  @apply border-solid border-0 bg-transparent;
}

.ad-banner--landing {
  @apply md:col-span-2 lg:col-span-3 xl:col-span-4;
}

.ad-banner--booking {
  @apply mt-6;
}

.ad-banner__label {
  @apply absolute top-2 right-2 z-10 text-[9px] uppercase font-bold tracking-widest text-gray-400 bg-white/60 px-2 py-0.5 rounded-full backdrop-blur-sm;
}

.ad-banner__container {
  @apply w-full h-full;
}

.ad-banner__image-wrapper {
  @apply w-full h-full min-h-[120px] overflow-hidden flex;
}

.ad-banner__image {
  @apply w-full h-auto object-cover transition-transform duration-700;
}

.ad-banner:hover .ad-banner__image {
  @apply scale-[1.02];
}

.ad-banner__content {
  @apply p-8 flex flex-col justify-center items-center text-center;
}

.ad-banner__title {
  @apply text-lg font-bold text-gray-900 leading-tight;
}

.ad-banner__copy {
  @apply text-sm mt-2 text-gray-600 line-clamp-2;
}

.ad-banner__footer {
  @apply mt-4;
}

.ad-banner__link {
  @apply text-primary-600 text-sm font-bold uppercase tracking-wider hover:underline;
}

.ad-banner__skeleton {
  @apply w-full h-[120px] bg-gray-100 flex items-center justify-center;
}

.ad-banner__skeleton-pulse {
  @apply w-full h-full bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[pulse_1.5s_infinite];
}

@keyframes pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
