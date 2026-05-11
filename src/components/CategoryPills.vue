<script setup lang="ts">
import { useDomainTranslation } from '../composables/useDomainTranslation'
interface Category {
  id: string
  name: string
  icon?: string
}

defineProps<{
  categories: Category[]
  selectedCategory?: string | null
}>()

const emit = defineEmits<{
  select: [categoryId: string | null]
}>()

const { td } = useDomainTranslation()

function selectCategory(categoryId: string | null) {
  emit('select', categoryId)
}
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
    <button
      type="button"
      @click="selectCategory(null)"
      class="category-pill"
      :class="!selectedCategory ? 'category-pill--active' : 'category-pill--idle'"
    >
      {{ $t('category_pills.all') }}
    </button>
    <button
      v-for="category in categories"
      :key="category.id"
      type="button"
      @click="selectCategory(category.id)"
      class="category-pill"
      :class="selectedCategory === category.id ? 'category-pill--active' : 'category-pill--idle'"
    >
      {{ td('categories', category.name) }}
    </button>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.category-pill {
  @apply cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/60;
}

.category-pill--active {
  @apply border-white bg-white text-primary-600 hover:bg-gray-100;
}

.category-pill--idle {
  @apply border-white/50 bg-transparent text-white hover:bg-white/10;
}
</style>
