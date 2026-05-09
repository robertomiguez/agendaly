<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Subscription } from '@/types'
import { Users, Briefcase, MapPin } from 'lucide-vue-next'

const props = defineProps<{
    subscription: Subscription | null
}>()

const staffCount = ref(0)
const servicesCount = ref(0)
const locationsCount = ref(0)
const loading = ref(true)

watch(() => props.subscription, (newSub) => {
    if (newSub) {
        fetchUsageData()
    }
}, { immediate: true })

onMounted(() => {
    if (props.subscription) {
        fetchUsageData()
    }
})

async function fetchUsageData() {
    if (!props.subscription?.provider_id) return
    loading.value = true

    try {
        const [{ count: staff }, { count: services }, { count: locations }] = await Promise.all([
            supabase
                .from('staff')
                .select('*', { count: 'exact', head: true })
                .eq('provider_id', props.subscription.provider_id)
                .eq('active', true),
            supabase
                .from('services')
                .select('*', { count: 'exact', head: true })
                .eq('provider_id', props.subscription.provider_id)
                .eq('active', true),
            supabase
                .from('provider_addresses')
                .select('*', { count: 'exact', head: true })
                .eq('provider_id', props.subscription.provider_id)
        ])

        staffCount.value = staff || 0
        servicesCount.value = services || 0
        locationsCount.value = locations || 0
    } catch (e) {
        console.error('Error fetching usage data:', e)
    } finally {
        loading.value = false
    }
}

function calculatePercentage(current: number, max: number | null | undefined): number {
    if (max === null || max === undefined) return 0 // Unlimited
    if (max === 0) return 100
    return Math.min(100, Math.round((current / max) * 100))
}
</script>

<template>
    <section v-if="subscription?.plan" class="usage-card">
        <header class="usage-card__header">
            <h2>Resource Usage</h2>
            <p>
                Track your active resources against your {{ subscription.plan.display_name }} plan limits
            </p>
        </header>
        <div class="usage-card__content">
            <div v-if="loading" class="usage-skeleton">
                <div></div>
                <div></div>
                <div></div>
            </div>
            <div v-else class="usage-list">
                <div class="usage-row">
                    <div class="usage-row__meta">
                        <div>
                            <MapPin />
                            <span>Locations</span>
                        </div>
                        <span>
                            {{ locationsCount }} / {{ subscription.plan.max_locations === null ? '∞' : subscription.plan.max_locations }}
                        </span>
                    </div>
                    <progress
                        v-if="subscription.plan.max_locations !== null"
                        class="usage-progress"
                        :class="{ 'is-full': locationsCount >= (subscription.plan.max_locations || 0) }"
                        :value="calculatePercentage(locationsCount, subscription.plan.max_locations)"
                        max="100"
                    />
                </div>

                <div class="usage-row">
                    <div class="usage-row__meta">
                        <div>
                            <Briefcase />
                            <span>Active Services</span>
                        </div>
                        <span>
                            {{ servicesCount }} / {{ subscription.plan.max_services === null ? '∞' : subscription.plan.max_services }}
                        </span>
                    </div>
                    <progress
                        v-if="subscription.plan.max_services !== null"
                        class="usage-progress"
                        :class="{ 'is-full': servicesCount >= (subscription.plan.max_services || 0) }"
                        :value="calculatePercentage(servicesCount, subscription.plan.max_services)"
                        max="100"
                    />
                </div>

                <div class="usage-row">
                    <div class="usage-row__meta">
                        <div>
                            <Users />
                            <span>Active Staff</span>
                        </div>
                        <span>
                            {{ staffCount }} / {{ subscription.plan.max_staff === null ? '∞' : subscription.plan.max_staff }}
                        </span>
                    </div>
                    <progress
                        v-if="subscription.plan.max_staff !== null"
                        class="usage-progress"
                        :class="{ 'is-full': staffCount >= (subscription.plan.max_staff || 0) }"
                        :value="calculatePercentage(staffCount, subscription.plan.max_staff)"
                        max="100"
                    />
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
@reference "../../style.css";

.usage-card {
    @apply rounded-xl border border-gray-200 bg-white py-6 text-gray-950 shadow-sm;
}

.usage-card__header {
    @apply px-6;
}

.usage-card__header h2 {
    @apply text-xl font-semibold leading-tight;
}

.usage-card__header p {
    @apply mt-1 text-sm leading-6 text-gray-600;
}

.usage-card__content {
    @apply px-6 pt-6;
}

.usage-skeleton {
    @apply grid animate-pulse gap-6;
}

.usage-skeleton div {
    @apply h-10 rounded-md bg-gray-100;
}

.usage-list {
    @apply grid gap-6;
}

.usage-row {
    @apply grid gap-2;
}

.usage-row__meta {
    @apply flex items-center justify-between gap-4 text-sm;
}

.usage-row__meta div {
    @apply flex items-center gap-2 font-medium text-gray-700;
}

.usage-row__meta svg {
    @apply h-4 w-4;
}

.usage-row__meta > span {
    @apply shrink-0 font-medium text-gray-500;
}

.usage-progress {
    @apply h-2 w-full overflow-hidden rounded-full bg-primary-100;
}

.usage-progress::-webkit-progress-bar {
    @apply rounded-full bg-primary-100;
}

.usage-progress::-webkit-progress-value {
    @apply rounded-full bg-primary-600 transition-all;
}

.usage-progress::-moz-progress-bar {
    @apply rounded-full bg-primary-600 transition-all;
}

.usage-progress.is-full {
    @apply bg-red-100;
}

.usage-progress.is-full::-webkit-progress-bar {
    @apply bg-red-100;
}

.usage-progress.is-full::-webkit-progress-value,
.usage-progress.is-full::-moz-progress-bar {
    @apply bg-red-600;
}
</style>
