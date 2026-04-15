<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
    <Card v-if="subscription?.plan">
        <CardHeader>
            <CardTitle class="text-xl leading-none">Resource Usage</CardTitle>
            <CardDescription>
                Track your active resources against your {{ subscription.plan.display_name }} plan limits
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div v-if="loading" class="animate-pulse space-y-6">
                <div class="h-10 bg-gray-100 rounded-md"></div>
                <div class="h-10 bg-gray-100 rounded-md"></div>
                <div class="h-10 bg-gray-100 rounded-md"></div>
            </div>
            <div v-else class="space-y-6">
                <!-- Location Usage -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center gap-2 font-medium text-gray-700">
                            <MapPin class="h-4 w-4" />
                            <span>Locations</span>
                        </div>
                        <span class="text-gray-500 font-medium">
                            {{ locationsCount }} / {{ subscription.plan.max_locations === null ? '∞' : subscription.plan.max_locations }}
                        </span>
                    </div>
                    <Progress 
                        v-if="subscription.plan.max_locations !== null"
                        :model-value="calculatePercentage(locationsCount, subscription.plan.max_locations)" 
                        class="h-2"
                        :class="locationsCount >= (subscription.plan.max_locations || 0) ? 'text-red-500' : 'text-primary-600'"
                    />
                </div>

                <!-- Services Usage -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center gap-2 font-medium text-gray-700">
                            <Briefcase class="h-4 w-4" />
                            <span>Active Services</span>
                        </div>
                        <span class="text-gray-500 font-medium">
                            {{ servicesCount }} / {{ subscription.plan.max_services === null ? '∞' : subscription.plan.max_services }}
                        </span>
                    </div>
                    <Progress 
                        v-if="subscription.plan.max_services !== null"
                        :model-value="calculatePercentage(servicesCount, subscription.plan.max_services)" 
                        class="h-2"
                        :class="servicesCount >= (subscription.plan.max_services || 0) ? 'text-red-500' : 'text-primary-600'"
                    />
                </div>

                <!-- Staff Usage -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center gap-2 font-medium text-gray-700">
                            <Users class="h-4 w-4" />
                            <span>Active Staff</span>
                        </div>
                        <span class="text-gray-500 font-medium">
                            {{ staffCount }} / {{ subscription.plan.max_staff === null ? '∞' : subscription.plan.max_staff }}
                        </span>
                    </div>
                    <Progress 
                        v-if="subscription.plan.max_staff !== null"
                        :model-value="calculatePercentage(staffCount, subscription.plan.max_staff)" 
                        class="h-2"
                        :class="staffCount >= (subscription.plan.max_staff || 0) ? 'text-red-500' : 'text-primary-600'"
                    />
                </div>
            </div>
        </CardContent>
    </Card>
</template>
