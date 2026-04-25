<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/useAuthStore'
import { getProviderSubscription, getPlan } from '../../services/subscriptionService'
import type { Subscription, Plan } from '../../types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BackButton from '@/components/common/BackButton.vue'

import { 
    Calendar, 
    CreditCard,
    AlertTriangle,
    CheckCircle2,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-vue-next'

import { useNotifications } from '@/composables/useNotifications'
import { useRoute } from 'vue-router'
import { useCurrency } from '@/composables/useCurrency'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { showSuccess } = useNotifications()

const subscription = ref<Subscription | null>(null)
const loading = ref(true)
const processing = ref(false)




onMounted(async () => {
    if (authStore.provider?.id) {
        await loadSubscription()
    }
    
    // Check for success message from payment setup
    if (route.query.payment_added === 'true') {
        showSuccess('Payment method added successfully')
        // Clean up URL
        router.replace({ query: {} })
    }
})

async function loadSubscription() {
    loading.value = true
    try {
        subscription.value = await getProviderSubscription(authStore.provider!.id)
        await loadPendingDowngradePlan()
    } catch (error) {
        console.error('Failed to load subscription:', error)
    } finally {
        loading.value = false
    }
}

const isCancelled = computed(() => {
    return subscription.value?.cancel_at_period_end === true
})

const hasPendingDowngrade = computed(() => {
    return !!subscription.value?.pending_downgrade_plan_id
})

const pendingDowngradePlan = ref<Plan | null>(null)

// Load pending downgrade plan details when subscription changes
async function loadPendingDowngradePlan() {
    if (subscription.value?.pending_downgrade_plan_id) {
        try {
            pendingDowngradePlan.value = await getPlan(subscription.value.pending_downgrade_plan_id)
        } catch (error) {
            console.error('Failed to load pending downgrade plan:', error)
        }
    } else {
        pendingDowngradePlan.value = null
    }
}

const { formatPrice, targetCurrency } = useCurrency()

const planPrice = computed(() => {
    if (!subscription.value) return 0
    // Use locked price if available, otherwise current plan price from the prices map
    const cur = subscription.value.currency?.toLowerCase() || targetCurrency.value
    return subscription.value.locked_price ?? (subscription.value.plan as any)?.prices?.[cur] ?? (subscription.value.plan as any)?.prices?.['usd'] ?? 0
})

const planDiscount = computed(() => {
    if (!subscription.value) return 0
    return subscription.value.locked_discount_percent ?? subscription.value.plan?.discount_percent ?? 0
})

const currentPrice = computed(() => {
    if (planDiscount.value > 0) {
        return planPrice.value * (1 - planDiscount.value / 100)
    }
    return planPrice.value
})

const subscriptionCurrency = computed(() => subscription.value?.currency?.toLowerCase() || targetCurrency.value)

const currencyMismatch = computed(() => {
    if (!subscription.value?.currency) return false
    return subscription.value.currency.toLowerCase() !== targetCurrency.value
})

const currentPriceFormatted = computed(() => {
    // If mismatch, we might want to be explicit? 
    // formatPrice handles the symbol correctly based on currency code.
    // e.g. if USD but locale is en-GB, it shows US$10.00
    // If USD and locale is pt-BR, it shows US$ 10,00
    return formatPrice(currentPrice.value, subscription.value?.currency || undefined)
})

const formattedPeriodEnd = computed(() => {
    if (!subscription.value?.current_period_end) {
        return '...';
    }
    const date = new Date(subscription.value.current_period_end);
    return isNaN(date.getTime()) ? '...' : date.toLocaleDateString();
})

const isFreemium = computed(() => {
    return subscription.value?.plan?.name === 'freemium'
})

function verifyChangePlan() {
    router.push('/provider/pricing?mode=change')
}
</script>

<template>
    <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div class="mb-8">
            <div class="flex items-center gap-4">
                <BackButton to="/provider/dashboard" />
                <h1 class="text-3xl font-bold text-gray-900">{{ $t('subscription.title') }}</h1>
            </div>
            <p class="mt-2 text-gray-600">{{ $t('subscription.subtitle') }}</p>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
            <LoadingSpinner size="md" color="text-primary-600" :inline="false" />
        </div>

        <div v-else-if="!subscription" class="text-center py-12 bg-gray-50 rounded-lg">
            <p class="text-gray-500 mb-4">{{ $t('subscription.no_subscription') }}</p>
            <Button @click="$router.push('/provider/pricing')">
                {{ $t('subscription.view_plans') }}
            </Button>
        </div>

        <div v-else class="space-y-6">
            <!-- Main Subscription Card -->
            <Card>
                <CardHeader>
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <CardTitle class="text-xl">
                                    {{ subscription.plan?.display_name }} Plan
                                </CardTitle>
                                <Badge 
                                    :variant="isCancelled ? 'destructive' : 'default'"
                                    :class="isCancelled ? '' : 'bg-green-600'"
                                >
                                    {{ isCancelled ? $t('subscription.status_cancelling') : subscription.status.toUpperCase() }}
                                </Badge>
                            </div>
                            <CardDescription>
                                {{ subscription.plan?.description }}
                            </CardDescription>
                        </div>
                        <div class="sm:text-right">
                            <div class="text-2xl font-bold text-gray-900">
                                {{ currentPriceFormatted }}<span class="text-sm text-gray-500 font-normal">/mo</span>
                            </div>
                            <!-- Currency Mismatch Warning -->
                            <div v-if="currencyMismatch" class="text-xs text-amber-600 font-medium mt-1">
                                {{ $t('subscription.billed_in', { currency: subscriptionCurrency.toUpperCase() }) }}
                            </div>
                            <div v-if="planDiscount > 0" class="text-xs text-green-600 font-medium mt-1">
                                {{ planDiscount }}% {{ $t('subscription.discount_applied') }}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="space-y-6">
                    <!-- Billing Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-white rounded-md shadow-sm">
                                <Calendar class="h-5 w-5 text-gray-500" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">{{ $t('subscription.current_period') }}</p>
                                <p class="text-sm text-gray-900">
                                    {{ isFreemium ? $t('subscription.lifetime') : formattedPeriodEnd }}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-white rounded-md shadow-sm">
                                <CreditCard class="h-5 w-5 text-gray-500" />
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-500">{{ $t('subscription.next_billing') }}</p>
                                <p v-if="isFreemium" class="text-sm text-gray-900 font-medium">
                                    {{ $t('subscription.no_charge') }}
                                </p>
                                <p v-else-if="isCancelled" class="text-sm text-red-600 font-medium">
                                    {{ $t('subscription.ends_on') }} {{ formattedPeriodEnd }}
                                </p>
                                <p v-else class="text-sm text-gray-900">
                                    {{ $t('subscription.auto_renew') }} {{ formattedPeriodEnd }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Usage Limits - Could be dynamic based on plan -->
                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-gray-900">{{ $t('subscription.plan_includes') }}</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div class="flex items-center gap-2 text-sm text-gray-600">
                                <CheckCircle2 class="h-4 w-4 text-green-500" />
                                <span>{{ subscription.plan?.max_staff || 'Unlimited' }} Staff</span>
                            </div>
                            <div class="flex items-center gap-2 text-sm text-gray-600">
                                <CheckCircle2 class="h-4 w-4 text-green-500" />
                                <span>{{ subscription.plan?.max_locations || 'Unlimited' }} Locations</span>
                            </div>
                            <div class="flex items-center gap-2 text-sm text-gray-600">
                                <CheckCircle2 class="h-4 w-4 text-green-500" />
                                <span>{{ subscription.plan?.max_services || 'Unlimited' }} Services</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter class="flex flex-col sm:flex-row gap-3 border-t pt-6 bg-gray-50/50" v-show="false">                    <Button 
                        variant="outline" 
                        class="w-full sm:w-auto"
                        @click="verifyChangePlan"
                        :disabled="processing || isCancelled"
                    >
                        <ArrowUpCircle class="mr-2 h-4 w-4" />
                        {{ $t('subscription.change_plan') }}
                    </Button>
                </CardFooter>
            </Card>

            <!-- Cancellation Warning (if cancelled) -->
            <div v-if="isCancelled" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle class="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                    <h4 class="text-sm font-medium text-yellow-800">{{ $t('subscription.cancellation_pending') }}</h4>
                    <p class="text-sm text-yellow-700 mt-1">
                        {{ $t('subscription.loss_warning', { date: formattedPeriodEnd }) }}
                    </p>
                </div>
            </div>

            <!-- Pending Downgrade Warning -->
            <div v-if="hasPendingDowngrade" class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <ArrowDownCircle class="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div class="flex-1">
                    <h4 class="text-sm font-medium text-amber-800">{{ $t('subscription.downgrade_pending') }}</h4>
                    <p class="text-sm text-amber-700 mt-1">
                        {{ $t('subscription.downgrade_info', { 
                            plan: pendingDowngradePlan?.display_name || $t('common.loading'),
                            date: formattedPeriodEnd
                        }) }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
