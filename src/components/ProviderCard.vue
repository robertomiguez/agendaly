<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Provider, ProviderAddress } from '../types'
import { useDomainTranslation } from '../composables/useDomainTranslation'
import { Star } from 'lucide-vue-next'

const props = defineProps<{
  provider: Provider & {
    provider_addresses?: ProviderAddress[]
  }
  rating?: number
  reviewCount?: number
  categories?: string[]
}>()

const { t } = useI18n()
const { td } = useDomainTranslation()
const initials = computed(() => {
  return props.provider.business_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const locationText = computed(() => {
  const addresses = props.provider.provider_addresses || []
  if (addresses.length === 0) return t('provider_card.location_tbd')

  // Get unique states
  const states = [...new Set(addresses.map(a => a.state).filter(Boolean))] as string[]

  if (states.length > 1) {
    // If multiple states, pick one address for each state to display
    const locations = states.map(state => {
      const addr = addresses.find(a => a.state === state && a.is_primary) || 
                   addresses.find(a => a.state === state)
      return addr ? `${addr.city}, ${addr.state}` : null
    }).filter(Boolean)
    
    return locations.join(' & ')
  }

  // Fallback to single location (primary or first)
  const primaryAddress = addresses.find(a => a.is_primary) || addresses[0]
  if (!primaryAddress) return t('provider_card.location_tbd')
  return `${primaryAddress.city}, ${primaryAddress.state || primaryAddress.postal_code}`
})

const ratingStars = computed(() => {
  const rating = props.rating || 0
  return Array.from({ length: 5 }, (_, i) => i < Math.floor(rating))
})
</script>

<template>
  <div class="provider-card">
    <!-- Provider Avatar/Logo -->
    <div class="provider-card__header">
      <div class="provider-card__avatar">
        <img v-if="provider.logo_url" :src="provider.logo_url" :alt="provider.business_name" class="provider-card__logo" />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="provider-card__identity">
        <h3>{{ provider.business_name }}</h3>
        <p>{{ locationText }}</p>
      </div>
    </div>

    <!-- Rating & Reviews -->
    <div class="provider-card__rating">
      <div class="provider-card__rating-row">
        <div class="provider-card__stars">
          <Star
            v-for="(filled, index) in ratingStars"
            :key="index"
            class="provider-card__star"
            :class="filled ? 'provider-card__star--filled' : 'provider-card__star--empty'"
          />
        </div>
        <span class="provider-card__rating-value">{{ rating || 5.0 }}</span>
        <span class="provider-card__review-count">({{ $t('provider_card.reviews', { count: reviewCount || 0 }) }})</span>
      </div>
    </div>

    <!-- Categories/Services -->
    <div v-if="categories && categories.length > 0" class="provider-card__categories">
      <div class="provider-card__category-list">
        <span
          v-for="(category, index) in categories.slice(0, 3)"
          :key="index"
          class="provider-category"
        >
          {{ td('categories', category) }}
        </span>
        <span
          v-if="categories.length > 3"
          class="provider-category provider-category--muted"
        >
          {{ $t('provider_card.more', { count: categories.length - 3 }) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";

.provider-card {
  @apply group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white shadow transition-shadow hover:shadow-lg;
}

.provider-card__header {
  @apply flex items-center gap-4 border-b border-gray-100 p-6;
}

.provider-card__avatar {
  @apply flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-xl font-bold text-white;
}

.provider-card__logo {
  @apply h-full w-full object-cover;
}

.provider-card__identity {
  @apply min-w-0 flex-1;
}

.provider-card__identity h3 {
  @apply truncate text-lg font-bold text-gray-900 transition-colors group-hover:text-primary-600;
}

.provider-card__identity p {
  @apply truncate text-sm text-gray-500;
}

.provider-card__rating {
  @apply bg-gray-50 px-6 py-3;
}

.provider-card__rating-row {
  @apply flex items-center gap-2;
}

.provider-card__stars {
  @apply flex;
}

.provider-card__star {
  @apply h-4 w-4;
}

.provider-card__star--filled {
  @apply fill-yellow-400 text-yellow-400;
}

.provider-card__star--empty {
  @apply text-gray-300;
}

.provider-card__rating-value {
  @apply text-sm font-medium text-gray-700;
}

.provider-card__review-count {
  @apply text-sm text-gray-500;
}

.provider-card__categories {
  @apply px-6 py-4;
}

.provider-card__category-list {
  @apply flex flex-wrap gap-2;
}

.provider-category {
  @apply inline-flex w-fit shrink-0 items-center justify-center rounded-full border border-transparent bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700;
}

.provider-category--muted {
  @apply bg-gray-100 text-gray-600;
}
</style>
