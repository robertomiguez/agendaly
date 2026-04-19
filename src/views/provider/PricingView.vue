<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotifications } from '@/composables/useNotifications'
import { getAllPlans, getProviderSubscription, createSubscription, changePlan, previewPlanChange } from '../../services/subscriptionService'
import type { Plan, Subscription } from '../../types'
import { useAuthStore } from '../../stores/useAuthStore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Check, AlertCircle, RefreshCw, ArrowUp, ArrowLeft, Calendar, Lock, Users, MapPin, Scissors, AlertTriangle, ArrowRight } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

import { TERMS_VERSION } from '../../constants'
import Modal from '@/components/common/Modal.vue'
import LegalDocumentViewer from '@/components/legal/LegalDocumentViewer.vue'

import { useCurrency } from '@/composables/useCurrency'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const { showError, errorMessage } = useNotifications()
const { targetCurrency, currencySymbol } = useCurrency()

const plans = ref<Plan[]>([])
const currentSubscription = ref<Subscription | null>(null)
const loading = ref(true)
const processing = ref(false)
const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const selectedPlan = ref<string | null>(null)
const error = ref(false)

// Proration preview state
const prorationPreview = ref<{
    planId: string
    planName: string
    isUpgrade: boolean
    isDowngrade: boolean
    credit: number
    charge: number
    netCharge: number
    scheduledDate?: string
    canChange: boolean
    message?: string
} | null>(null)
const showPreviewModal = ref(false)
const showTermsModal = ref(false)
const showPrivacyModal = ref(false)

// Limit validation state
const showLimitModal = ref(false)
const limitViolation = ref<{
    reason: 'staff_limit' | 'service_limit' | 'location_limit'
    currentCount: number
    limit: number
    planName: string
} | null>(null)

const isChangeMode = computed(() => route.query.mode === 'change')

function getPlanPrice(plan: Plan): number {
    const cur = targetCurrency.value
    if (plan.prices && plan.prices[cur]) {
        return plan.prices[cur]
    }
    // Fallback to USD
    return plan.prices?.['usd'] || 0
}
// --- Currency Logic End ---

onMounted(async () => {
    await loadPlans()
})

async function loadPlans() {
    loading.value = true
    error.value = false
    try {

        const [plansData, subData] = await Promise.all([
            getAllPlans(),
            authStore.provider ? getProviderSubscription(authStore.provider.id) : Promise.resolve(null)
        ])
        
        // Filter out inactive/archived plans
        plans.value = plansData.filter(plan => {
            if (plan.status === 'active' || plan.status === 'coming_soon') return true;
            if (plan.status === 'legacy' && plan.id === subData?.plan_id) return true;
            return false;
        })
        currentSubscription.value = subData
        
        if (plans.value.length === 0) {
            error.value = true
        }
    } catch (err) {
        console.error('Failed to load plans:', err)
        error.value = true
    } finally {
        loading.value = false
    }
}

function selectPlan(plan: Plan) {
    if (plan.status !== 'active') return
    selectedPlan.value = plan.name
}



function isSelected(plan: Plan): boolean {
    return selectedPlan.value === plan.name
}

function isCurrentPlan(plan: Plan): boolean {
    return currentSubscription.value?.plan_id === plan.id
}

async function handlePlanAction(plan: Plan) {
    if (plan.status !== 'active') return

    if (isChangeMode.value) {
        if (isCurrentPlan(plan)) return
        
        // Show proration preview before confirming
        processing.value = true
        try {
            const preview = await previewPlanChange(currentSubscription.value!.id, plan.id)
            
            if (!preview.canChange) {
                // Check if it's a specific resource limit issue
                if (preview.reason) {
                    limitViolation.value = {
                        reason: preview.reason,
                        currentCount: preview.currentCount || 0,
                        limit: preview.limit || 0,
                        planName: plan.display_name
                    }
                    showLimitModal.value = true
                    return
                }

                showError(preview.message || t('common.error_occurred'))
                return
            }
            
            prorationPreview.value = {
                planId: plan.id,
                planName: plan.display_name,
                ...preview
            }
            showPreviewModal.value = true
        } catch (err) {
            console.error('Failed to preview plan change:', err)
            showError(t('common.error_occurred'))
        } finally {
            processing.value = false
        }
    } else {
        // Handle initial plan selection
        if (plan.status !== 'active') {
            showError(t('pricing.coming_soon'))
            processing.value = false
            return
        }

        if (!authStore.provider) {
            // New provider: no provider record yet, go to profile creation
            // Pass the selected plan name so saveProvider creates provider + subscription together
            router.push({ path: '/provider/profile', query: { plan: plan.name } })
            return
        }

        // Existing provider without subscription (edge case / retry)
        processing.value = true
        try {
            if (!currentSubscription.value) {
                await createSubscription({
                    providerId: authStore.provider.id,
                    planId: plan.id
                })
            } else if (currentSubscription.value.plan_id !== plan.id) {
                await changePlan(currentSubscription.value.id, plan.id)
            }
            router.push('/provider/dashboard')
        } catch (err) {
            console.error('Failed to select plan:', err)
            showError(t('common.error_occurred'))
        } finally {
            processing.value = false
        }
    }
}

async function confirmPlanChange() {
    if (!prorationPreview.value) return
    
    processing.value = true
    try {
        const result = await changePlan(currentSubscription.value!.id, prorationPreview.value.planId)
        
        if (!result.success) {
            showError(result.message || t('common.error_occurred'))
            return
        }
        
        showPreviewModal.value = false
        router.push('/provider/subscription')
    } catch (err) {
        console.error('Failed to change plan:', err)
        showError(t('common.error_occurred'))
    } finally {
        processing.value = false
    }
}

function cancelPreview() {
    showPreviewModal.value = false
    prorationPreview.value = null
}

function getFeatures(plan: Plan): string[] {
    const features: string[] = []
    
    // Staff limit feature
    if (plan.max_staff === null) {
        features.push(t('pricing.features.unlimited_staff'))
    } else if (plan.max_staff === 1) {
        features.push(t('pricing.features.one_staff'))
    } else {
        features.push(t('pricing.features.staff_count', { count: plan.max_staff }))
    }
    
    // Location limit feature
    if (plan.max_locations === null) {
        features.push(t('pricing.features.unlimited_locations'))
    } else if (plan.max_locations === 1) {
        features.push(t('pricing.features.one_location'))
    } else {
        features.push(t('pricing.features.location_count', { count: plan.max_locations }))
    }
    
    // Services limit feature
    if (plan.max_services === null) {
        features.push(t('pricing.features.unlimited_services'))
    } else {
        features.push(t('pricing.features.service_count', { count: plan.max_services }))
    }
    
    // Add extra features from database
    if (plan.features && Array.isArray(plan.features)) {
        features.push(...plan.features)
    }
    
    return features
}

function isPopular(plan: Plan): boolean {
    return plan.name === 'solo_plus'
}

function getDiscountedPrice(plan: Plan): number {
    const basePrice = getPlanPrice(plan)
    if (!plan.discount_percent) return basePrice
    return basePrice * (1 - plan.discount_percent / 100)
}

function hasDiscount(plan: Plan): boolean {
    return !!plan.discount_percent && plan.discount_percent > 0
}

function resolveLimitViolation() {
    showLimitModal.value = false
    if (!limitViolation.value) return

    switch (limitViolation.value.reason) {
        case 'staff_limit':
            router.push('/provider/staff')
            break
        case 'service_limit':
            router.push('/provider/services')
            break
        case 'location_limit':
            router.push('/provider/addresses')
            break
    }
}
</script>

<template>
    <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-7xl mx-auto">
            <!-- Header -->
            <!-- Header -->
            <div class="text-center mb-12 relative">
                <!-- Back Button (only in change mode) -->
                <div v-if="isChangeMode" class="absolute left-0 top-0 hidden sm:block">
                     <Button variant="ghost" @click="$router.push('/provider/dashboard')" class="gap-2 pl-0 hover:bg-transparent hover:text-primary-600">
                        <ArrowLeft class="h-4 w-4" />
                        {{ $t('common.back_to_dashboard') }}
                    </Button>
                </div>
                 <!-- Mobile Back Button (only in change mode) -->
                <div v-if="isChangeMode" class="sm:hidden mb-4 flex justify-start">
                     <Button variant="ghost" @click="$router.push('/provider/dashboard')" class="gap-2 pl-0 hover:bg-transparent hover:text-primary-600">
                        <ArrowLeft class="h-4 w-4" />
                        {{ $t('common.back_to_dashboard') }}
                    </Button>
                </div>
                
                <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-4">
                    {{ $t('pricing.title') }}
                </h1>


                <!-- Billing Toggle -->
                <div class="mt-8 flex items-center justify-center gap-4">
                    <Label 
                        :class="billingCycle === 'monthly' ? 'text-gray-900 font-semibold' : 'text-gray-500'"
                    >
                        {{ $t('pricing.monthly') }}
                    </Label>
                    <Switch 
                        :checked="billingCycle === 'yearly'"
                        @update:checked="billingCycle = $event ? 'yearly' : 'monthly'"
                        disabled
                    />
                    <div class="flex items-center gap-2">
                        <Label class="text-gray-400">
                            {{ $t('pricing.yearly') }}
                        </Label>
                        <Badge variant="secondary" class="text-xs">
                            {{ $t('pricing.coming_soon') }}
                        </Badge>
                    </div>
                </div>


                
                <!-- No Card Required Badge -->
                <div class="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Lock class="h-4 w-4" />
                    {{ $t('checkout.no_card_required') }}
                </div>
            </div>

            <!-- Error Alert for Actions -->
            <div v-if="errorMessage" class="mb-6 max-w-2xl mx-auto">
                <Alert variant="destructive">
                    <AlertCircle class="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{{ errorMessage }}</AlertDescription>
                </Alert>
            </div>

            <!-- Loading State -->
            <LoadingSpinner v-if="loading" size="md" color="text-primary-600" :inline="false" />

            <!-- Error State -->
            <!-- Error State -->
            <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle class="h-8 w-8 text-red-500" />
                </div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">
                    {{ $t('pricing.error_title') }}
                </h3>
                <p class="text-gray-600 max-w-md mb-6">
                    {{ $t('pricing.error_message') }}
                </p>
                <div class="flex gap-3">
                    <Button @click="loadPlans" variant="outline" class="gap-2">
                        <RefreshCw class="h-4 w-4" />
                        {{ $t('common.retry') }}
                    </Button>
                    <Button variant="default" @click="$router.push('/contact')">
                        {{ $t('pricing.contact_support') }}
                    </Button>
                </div>
            </div>

            <!-- Pricing Cards -->
            <div v-else :class="[
                'grid gap-6 lg:gap-8 mx-auto w-full',
                {
                    'max-w-md': plans.length === 1,
                    'grid-cols-1 md:grid-cols-2 max-w-3xl': plans.length === 2,
                    'grid-cols-1 md:grid-cols-3 max-w-5xl': plans.length === 3,
                    'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-7xl': plans.length >= 4
                }
            ]">
                <Card 
                    v-for="plan in plans" 
                    :key="plan.id"
                    :class="[
                        'relative transition-all duration-200 flex flex-col h-full',
                        isSelected(plan) ? 'border-2 border-green-500 shadow-lg ring-2 ring-green-100' : 
                            isPopular(plan) ? 'border-2 border-violet-200 shadow-md' : 'border border-gray-200',
                        plan.status === 'active' ? 'hover:shadow-lg cursor-pointer' : 'cursor-default'
                    ]"
                    @click="selectPlan(plan)"
                >
                    <!-- Coming Soon Overlay -->
                    <div 
                        v-if="plan.status === 'coming_soon'" 
                        class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] transition-all"
                    >
                        <div class="bg-white/90 p-4 rounded-full shadow-sm mb-3 border border-gray-100">
                            <Lock class="h-8 w-8 text-gray-400" />
                        </div>
                        <span class="text-xl font-bold text-gray-500 bg-white/80 px-4 py-1.5 rounded-full shadow-sm border border-gray-100 uppercase tracking-widest text-sm">
                            {{ $t('pricing.coming_soon') }}
                        </span>
                    </div>

                    <!-- Content wrapper that gets blurred if coming soon -->
                    <div :class="['flex-1 flex flex-col h-full', { 'blur-[2px] select-none pointer-events-none grayscale-[0.3]': plan.status === 'coming_soon' }]">
                        <!-- Selected Indicator -->
                        <div 
                            v-if="isSelected(plan) || isCurrentPlan(plan)" 
                            class="absolute -top-3 right-3 z-10"
                        >
                            <div class="bg-green-500 text-white rounded-full p-1 shadow-sm">
                                <Check class="h-4 w-4" />
                            </div>
                        </div>

                        <!-- Popular Badge -->
                        <div 
                            v-if="isPopular(plan) && !isSelected(plan)" 
                            class="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
                        >
                            <Badge class="bg-violet-600 text-white px-3 py-1">
                                {{ $t('pricing.most_popular') }}
                            </Badge>
                        </div>

                        <!-- Status Badge (Only for legacy, since soon has overlay) -->
                        <div 
                            v-if="plan.status === 'legacy'" 
                            class="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
                        >
                            <Badge variant="secondary" class="px-3 py-1">
                                Legacy Plan
                            </Badge>
                        </div>

                        <CardHeader class="text-center pt-8">
                            <CardTitle class="text-2xl font-bold">
                                {{ plan.display_name }}
                            </CardTitle>
                            <CardDescription class="mt-2">
                                {{ plan.description }}
                            </CardDescription>
                        </CardHeader>

                        <CardContent class="text-center">
                            <!-- Price -->
                            <div class="mb-6">
                                <template v-if="plan.status === 'active' || plan.status === 'legacy'">
                                    <div class="flex flex-col items-center justify-center min-h-[5rem]">
                                        <template v-if="hasDiscount(plan)">
                                            <!-- Original Price -->
                                            <div class="text-gray-400 text-lg line-through font-medium">
                                                {{ currencySymbol }}{{ getPlanPrice(plan).toFixed(2) }}
                                            </div>
                                            <!-- Discounted Price -->
                                            <div class="flex items-baseline justify-center gap-1">
                                                <span class="text-4xl font-bold text-gray-900">
                                                    {{ currencySymbol }}{{ getDiscountedPrice(plan).toFixed(2) }}
                                                </span>
                                                <span class="text-gray-500">
                                                    {{ $t('pricing.per_month') }}
                                                </span>
                                            </div>
                                            <div class="mt-2">
                                                <Badge variant="outline" class="text-green-600 border-green-200 bg-green-50">
                                                    {{ plan.discount_percent }}% off
                                                    <span v-if="plan.discount_duration_months">
                                                        for {{ plan.discount_duration_months }} mos
                                                    </span>
                                                </Badge>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <div class="flex items-baseline justify-center gap-1">
                                                <span class="text-4xl font-bold text-gray-900">
                                                    {{ currencySymbol }}{{ getPlanPrice(plan).toFixed(2) }}
                                                </span>
                                                <span class="text-gray-500">
                                                    {{ $t('pricing.per_month') }}
                                                </span>
                                            </div>
                                        </template>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="flex flex-col items-center justify-center min-h-[5rem]">
                                        <span class="text-34xl font-bold text-gray-300">---</span>
                                    </div>
                                </template>
                            </div>

                            <!-- Features List -->
                            <ul class="space-y-3 text-left">
                                <li 
                                    v-for="(feature, idx) in getFeatures(plan)" 
                                    :key="idx"
                                    class="flex items-start gap-3"
                                >
                                    <Check class="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                    <span class="text-gray-600 text-sm">{{ feature }}</span>
                                </li>
                            </ul>
                        </CardContent>

                        <CardFooter class="mt-auto">
                            <Button 
                                variant="outline"
                                :disabled="plan.status !== 'active' || (isChangeMode && isCurrentPlan(plan)) || processing"
                                :class="[
                                    'w-full',
                                    isSelected(plan) ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : ''
                                ]"
                                size="lg"
                                @click.stop="handlePlanAction(plan)"
                            >
                                <LoadingSpinner v-if="processing && isSelected(plan)" inline size="sm" class="mr-2" color="text-white" />
                                <template v-else>
                                    <span v-if="plan.status === 'coming_soon'">{{ $t('pricing.coming_soon') }}</span>
                                    <span v-else-if="plan.status === 'legacy'">Legacy Plan</span>
                                    <span v-else-if="isChangeMode && isCurrentPlan(plan)">{{ $t('pricing.current_plan') }}</span>
                                    <span v-else-if="isChangeMode">{{ $t('pricing.switch_plan') }}</span>
                                    <span v-else>{{ $t('pricing.start_trial') }}</span>
                                </template>
                            </Button>
                        </CardFooter>
                    </div>
                </Card>
            </div>

            <!-- Footer Note -->
            <p class="text-center text-gray-500 text-sm mt-12">
                {{ $t('pricing.footer_note') }}
            </p>
            
            <!-- Implicit Terms Agreement -->
            <p class="text-center text-gray-600 text-base font-medium mt-8 max-w-4xl mx-auto px-4 text-balance">
                {{ $t('checkout.terms_agree') }} 
                <button type="button" @click="showTermsModal = true" class="underline hover:text-gray-900 font-semibold text-primary-600 whitespace-nowrap">{{ $t('auth.terms_of_service') }}</button> 
                {{ $t('checkout.and') }}
                <button type="button" @click="showPrivacyModal = true" class="underline hover:text-gray-900 font-semibold text-primary-600 whitespace-nowrap">{{ $t('auth.privacy_policy') }}</button>.
            </p>
        </div>

        <!-- Terms Modal -->
        <Modal 
            :isOpen="showTermsModal" 
            @close="showTermsModal = false"
            title="Terms of Service"
            maxWidth="max-w-4xl"
        >
            <div class="h-[70vh] overflow-y-auto">
                <LegalDocumentViewer documentType="terms" />
            </div>
            <div class="mt-4 flex justify-end">
                <Button @click="showTermsModal = false">
                    {{ $t('common.close') }}
                </Button>
            </div>
        </Modal>

        <!-- Privacy Modal -->
        <Modal 
            :isOpen="showPrivacyModal" 
            @close="showPrivacyModal = false"
            title="Privacy Policy"
            maxWidth="max-w-4xl"
        >
            <div class="h-[70vh] overflow-y-auto">
                <LegalDocumentViewer documentType="privacy" />
            </div>
            <div class="mt-4 flex justify-end">
                <Button @click="showPrivacyModal = false">
                    {{ $t('common.close') }}
                </Button>
            </div>
        </Modal>

        <!-- Resource Limit Modal -->
        <Dialog :open="showLimitModal" @update:open="showLimitModal = false">
            <DialogContent class="sm:max-w-[425px]">
                <DialogHeader>
                    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                        <Users v-if="limitViolation?.reason === 'staff_limit'" class="h-6 w-6 text-red-600" />
                        <Scissors v-else-if="limitViolation?.reason === 'service_limit'" class="h-6 w-6 text-red-600" />
                        <MapPin v-else-if="limitViolation?.reason === 'location_limit'" class="h-6 w-6 text-red-600" />
                        <AlertTriangle v-else class="h-6 w-6 text-red-600" />
                    </div>
                    <DialogTitle class="text-center text-xl">
                        {{ 
                            limitViolation?.reason === 'staff_limit' ? 'Staff Limit Reached' :
                            limitViolation?.reason === 'service_limit' ? 'Service Limit Reached' :
                            limitViolation?.reason === 'location_limit' ? 'Location Limit Reached' :
                            'Plan Limit Reached'
                        }}
                    </DialogTitle>
                    <DialogDescription class="text-center pt-2">
                        You have <span class="font-bold text-gray-900">{{ limitViolation?.currentCount }}</span> active 
                        {{ 
                            limitViolation?.reason === 'staff_limit' ? 'staff members' :
                            limitViolation?.reason === 'service_limit' ? 'services' :
                            'locations'
                        }}, but the <span class="font-semibold">{{ limitViolation?.planName }}</span> plan allows only <span class="font-bold text-gray-900">{{ limitViolation?.limit }}</span>.
                        <br/><br/>
                        Please deactivate {{ (limitViolation?.currentCount || 0) - (limitViolation?.limit || 0) }} item(s) to continue with the downgrade.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter class="sm:justify-center mt-4">
                    <Button variant="outline" @click="showLimitModal = false">
                        Cancel
                    </Button>
                    <Button variant="default" @click="resolveLimitViolation" class="gap-2 bg-red-600 hover:bg-red-700 text-white">
                        <span>Manage {{ 
                            limitViolation?.reason === 'staff_limit' ? 'Staff' :
                            limitViolation?.reason === 'service_limit' ? 'Services' :
                            'Locations'
                        }}</span>
                        <ArrowRight class="h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Proration Preview Modal -->
        <div 
            v-if="showPreviewModal && prorationPreview" 
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            @click.self="cancelPreview"
        >
            <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                    {{ prorationPreview.isUpgrade ? $t('pricing.upgrade_title') : $t('pricing.downgrade_title') }}
                </h3>
                
                <div class="space-y-4">
                    <p class="text-gray-600">
                        {{ $t('pricing.change_to', { plan: prorationPreview.planName }) }}
                    </p>
                    
                    <!-- Upgrade: Show proration details -->
                    <div v-if="prorationPreview.isUpgrade" class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <div class="flex items-center gap-2 text-blue-700 font-medium">
                            <ArrowUp class="h-4 w-4" />
                            {{ $t('pricing.upgrade_now') }}
                        </div>
                        <div class="text-sm text-gray-600 space-y-1">
                            <div class="flex justify-between">
                                <span>{{ $t('pricing.credit_unused') }}</span>
                                <span class="text-green-600">-{{ currencySymbol }}{{ prorationPreview.credit.toFixed(2) }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>{{ $t('pricing.charge_remaining') }}</span>
                                <span>+{{ currencySymbol }}{{ prorationPreview.charge.toFixed(2) }}</span>
                            </div>
                            <div class="flex justify-between font-semibold pt-2 border-t border-blue-200">
                                <span>{{ $t('pricing.net_charge') }}</span>
                                <span class="text-blue-700">{{ currencySymbol }}{{ prorationPreview.netCharge.toFixed(2) }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Downgrade: Show scheduled date -->
                    <div v-else-if="prorationPreview.isDowngrade" class="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                        <div class="flex items-center gap-2 text-amber-700 font-medium">
                            <Calendar class="h-4 w-4" />
                            {{ $t('pricing.downgrade_scheduled') }}
                        </div>
                        <p class="text-sm text-gray-600">
                            {{ $t('pricing.downgrade_date', { date: new Date(prorationPreview.scheduledDate!).toLocaleDateString() }) }}
                        </p>
                        <p class="text-sm text-gray-500">
                            {{ $t('pricing.keep_features') }}
                        </p>
                    </div>
                    
                    <!-- Trial: Free switch -->
                    <div v-else-if="prorationPreview.message" class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p class="text-sm text-green-700">{{ prorationPreview.message }}</p>
                    </div>
                </div>
                
                <div class="flex gap-3 mt-6">
                    <Button 
                        variant="outline" 
                        class="flex-1"
                        @click="cancelPreview"
                        :disabled="processing"
                    >
                        {{ $t('common.cancel') }}
                    </Button>
                    <Button 
                        :variant="prorationPreview.isUpgrade ? 'default' : 'outline'"
                        :class="prorationPreview.isUpgrade ? 'flex-1 bg-blue-600 hover:bg-blue-700' : 'flex-1'"
                        @click="confirmPlanChange"
                        :disabled="processing"
                    >
                        <LoadingSpinner v-if="processing" inline size="sm" class="mr-2" :color="prorationPreview.isUpgrade ? 'text-white' : undefined" />
                        {{ $t('pricing.confirm_change') }}
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>
