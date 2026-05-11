<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotifications } from '@/composables/useNotifications'
import { getAllPlans, getProviderSubscription, createSubscription, changePlan, previewPlanChange } from '../../services/subscriptionService'
import type { Plan, Subscription } from '../../types'
import { useAuthStore } from '../../stores/useAuthStore'
import { Check, AlertCircle, RefreshCw, ArrowUp, Calendar, Lock, Users, MapPin, Scissors, AlertTriangle, ArrowRight } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BackButton from '@/components/common/BackButton.vue'


import Modal from '@/components/common/Modal.vue'
import LegalDocumentViewer from '@/components/legal/LegalDocumentViewer.vue'

import { useCurrency } from '@/composables/useCurrency'
import { useDomainTranslation } from '@/composables/useDomainTranslation'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const { showError, errorMessage } = useNotifications()
const { targetCurrency, currencySymbol } = useCurrency()
const { td } = useDomainTranslation()

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
        features.push(...plan.features.map((f: string) => td('plan_features', f)))
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
                <div v-if="isChangeMode" class="sm:absolute sm:left-0 sm:top-0 mb-4 sm:mb-0">
                    <BackButton to="/provider/dashboard" />
                </div>
                
                <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-4">
                    {{ $t('pricing.title') }}
                </h1>


                <!-- Billing Toggle -->
                <div class="mt-8 flex items-center justify-center gap-4">
                    <span 
                        :class="billingCycle === 'monthly' ? 'text-gray-900 font-semibold' : 'text-gray-500'"
                    >
                        {{ $t('pricing.monthly') }}
                    </span>
                    <button
                        type="button"
                        class="pricing-switch"
                        :class="{ 'pricing-switch--on': billingCycle === 'yearly' }"
                        disabled
                        aria-disabled="true"
                        :aria-pressed="billingCycle === 'yearly'"
                        @click="billingCycle = billingCycle === 'yearly' ? 'monthly' : 'yearly'"
                    >
                        <span class="pricing-switch__thumb"></span>
                    </button>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-400">
                            {{ $t('pricing.yearly') }}
                        </span>
                        <span class="pricing-badge pricing-badge--muted">
                            {{ $t('pricing.coming_soon') }}
                        </span>
                    </div>
                </div>


                
                <!-- No Card Required Badge -->
                <div class="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Lock class="h-4 w-4" />
                    {{ $t('pricing.no_card_required') }}
                </div>
            </div>

            <!-- Error Alert for Actions -->
            <div v-if="errorMessage" class="mb-6 max-w-2xl mx-auto">
                <div class="pricing-error-alert" role="alert">
                    <AlertCircle class="pricing-error-alert__icon" />
                    <div>
                        <p class="pricing-error-alert__title">Error</p>
                        <p>{{ errorMessage }}</p>
                    </div>
                </div>
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
                    <button @click="loadPlans" class="pricing-button pricing-button--secondary gap-2">
                        <RefreshCw class="h-4 w-4" />
                        {{ $t('common.retry') }}
                    </button>
                    <button class="pricing-button" @click="$router.push('/contact')">
                        {{ $t('pricing.contact_support') }}
                    </button>
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
                <article 
                    v-for="plan in plans" 
                    :key="plan.id"
                    :class="[
                        'pricing-plan-card',
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
                            <span class="pricing-badge pricing-badge--popular">
                                {{ $t('pricing.most_popular') }}
                            </span>
                        </div>

                        <!-- Status Badge (Only for legacy, since soon has overlay) -->
                        <div 
                            v-if="plan.status === 'legacy'" 
                            class="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
                        >
                            <span class="pricing-badge pricing-badge--muted">
                                Legacy Plan
                            </span>
                        </div>

                        <header class="text-center pt-8 px-6">
                            <h2 class="text-2xl font-bold">
                                {{ plan.display_name }}
                            </h2>
                            <p class="mt-2 text-sm text-gray-600">
                                {{ td('plan_descriptions', plan.name) }}
                            </p>
                        </header>

                        <div class="text-center px-6 py-6">
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
                                                <span class="pricing-badge pricing-badge--discount">
                                                    {{ plan.discount_percent }}% off
                                                    <span v-if="plan.discount_duration_months">
                                                        for {{ plan.discount_duration_months }} mos
                                                    </span>
                                                </span>
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
                        </div>

                        <footer class="mt-auto px-6 pb-6">
                            <button 
                                :disabled="plan.status !== 'active' || (isChangeMode && isCurrentPlan(plan)) || processing"
                                :class="[
                                    'pricing-button pricing-button--secondary w-full',
                                    isSelected(plan) ? 'pricing-button--selected' : ''
                                ]"
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
                            </button>
                        </footer>
                    </div>
                </article>
            </div>

            <!-- Footer Note -->
            <p class="text-center text-gray-500 text-sm mt-12">
                {{ $t('pricing.footer_note') }}
            </p>
            
            <!-- Implicit Terms Agreement -->
            <p class="text-center text-gray-600 text-base font-medium mt-8 max-w-4xl mx-auto px-4 text-balance">
                {{ $t('pricing.terms_agree') }} 
                <button type="button" @click="showTermsModal = true" class="underline hover:text-gray-900 font-semibold text-primary-600 whitespace-nowrap">{{ $t('auth.terms_of_service') }}</button> 
                {{ $t('common.and') }}
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
                <button class="pricing-button" @click="showTermsModal = false">
                    {{ $t('common.close') }}
                </button>
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
                <button class="pricing-button" @click="showPrivacyModal = false">
                    {{ $t('common.close') }}
                </button>
            </div>
        </Modal>

        <!-- Resource Limit Modal -->
        <div
            v-if="showLimitModal"
            class="pricing-modal-backdrop"
            role="dialog"
            aria-modal="true"
            @click.self="showLimitModal = false"
        >
            <div class="pricing-modal">
                <header>
                    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                        <Users v-if="limitViolation?.reason === 'staff_limit'" class="h-6 w-6 text-red-600" />
                        <Scissors v-else-if="limitViolation?.reason === 'service_limit'" class="h-6 w-6 text-red-600" />
                        <MapPin v-else-if="limitViolation?.reason === 'location_limit'" class="h-6 w-6 text-red-600" />
                        <AlertTriangle v-else class="h-6 w-6 text-red-600" />
                    </div>
                    <h2 class="text-center text-xl font-semibold text-gray-950">
                        {{ 
                            limitViolation?.reason === 'staff_limit' ? 'Staff Limit Reached' :
                            limitViolation?.reason === 'service_limit' ? 'Service Limit Reached' :
                            limitViolation?.reason === 'location_limit' ? 'Location Limit Reached' :
                            'Plan Limit Reached'
                        }}
                    </h2>
                    <p class="text-center pt-2 text-sm text-gray-600">
                        You have <span class="font-bold text-gray-900">{{ limitViolation?.currentCount }}</span> active 
                        {{ 
                            limitViolation?.reason === 'staff_limit' ? 'staff members' :
                            limitViolation?.reason === 'service_limit' ? 'services' :
                            'locations'
                        }}, but the <span class="font-semibold">{{ limitViolation?.planName }}</span> plan allows only <span class="font-bold text-gray-900">{{ limitViolation?.limit }}</span>.
                        <br/><br/>
                        Please deactivate {{ (limitViolation?.currentCount || 0) - (limitViolation?.limit || 0) }} item(s) to continue with the downgrade.
                    </p>
                </header>
                <footer class="mt-4 flex justify-center gap-3">
                    <button class="pricing-button pricing-button--secondary" @click="showLimitModal = false">
                        Cancel
                    </button>
                    <button class="pricing-button pricing-button--danger gap-2" @click="resolveLimitViolation">
                        <span>Manage {{ 
                            limitViolation?.reason === 'staff_limit' ? 'Staff' :
                            limitViolation?.reason === 'service_limit' ? 'Services' :
                            'Locations'
                        }}</span>
                        <ArrowRight class="h-4 w-4" />
                    </button>
                </footer>
            </div>
        </div>

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
                    <button 
                        class="pricing-button pricing-button--secondary flex-1"
                        @click="cancelPreview"
                        :disabled="processing"
                    >
                        {{ $t('common.cancel') }}
                    </button>
                    <button 
                        :class="prorationPreview.isUpgrade ? 'pricing-button pricing-button--blue flex-1' : 'pricing-button pricing-button--secondary flex-1'"
                        @click="confirmPlanChange"
                        :disabled="processing"
                    >
                        <LoadingSpinner v-if="processing" inline size="sm" class="mr-2" :color="prorationPreview.isUpgrade ? 'text-white' : undefined" />
                        {{ $t('pricing.confirm_change') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
@reference "../../style.css";

.pricing-switch {
    @apply relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-gray-200 transition-colors opacity-60;
}

.pricing-switch--on {
    @apply bg-amber-600;
}

.pricing-switch__thumb {
    @apply inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform;
}

.pricing-switch--on .pricing-switch__thumb {
    @apply translate-x-5;
}

.pricing-badge {
    @apply inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold;
}

.pricing-badge--muted {
    @apply bg-gray-100 text-gray-700;
}

.pricing-badge--popular {
    @apply bg-violet-600 text-white;
}

.pricing-badge--discount {
    @apply border border-green-200 bg-green-50 text-green-700;
}

.pricing-error-alert {
    @apply flex gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.pricing-error-alert__icon {
    @apply mt-0.5 h-4 w-4 flex-shrink-0;
}

.pricing-error-alert__title {
    @apply font-semibold;
}

.pricing-plan-card {
    @apply relative flex h-full flex-col rounded-lg bg-white shadow-sm transition-all duration-200;
}

.pricing-button {
    @apply inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60;
}

.pricing-button--secondary {
    @apply border border-gray-300 bg-white text-gray-800 hover:bg-gray-50;
}

.pricing-button--selected {
    @apply border-green-600 bg-green-600 text-white hover:bg-green-700;
}

.pricing-button--danger {
    @apply bg-red-600 text-white hover:bg-red-700;
}

.pricing-button--blue {
    @apply bg-blue-600 text-white hover:bg-blue-700;
}

.pricing-modal-backdrop {
    @apply fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4;
}

.pricing-modal {
    @apply w-full max-w-[425px] rounded-xl bg-white p-6 shadow-2xl;
}
</style>
