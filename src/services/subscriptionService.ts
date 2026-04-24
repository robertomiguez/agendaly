import { supabase } from '../lib/supabase'
import type { Plan, Subscription } from '../types'

/**
 * Fetch all active subscription plans
 */
export async function getPlans(): Promise<Plan[]> {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('status', 'active')
        .order('sort_order')

    if (error) throw error
    return data || []
}

/**
 * Fetch all plans including inactive (for admin)
 */
export async function getAllPlans(): Promise<Plan[]> {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order')

    if (error) throw error
    return data || []
}

/**
 * Get a single plan by ID
 */
export async function getPlan(planId: string): Promise<Plan | null> {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single()

    if (error) throw error
    return data
}

/**
 * Get a plan by name (e.g., 'solo', 'solo_plus')
 */
export async function getPlanByName(name: string): Promise<Plan | null> {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('name', name)
        .single()

    if (error) throw error
    return data
}

/**
 * Get provider's current subscription with plan details
 */
export async function getProviderSubscription(providerId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('*, plan:plans!plan_id(*)')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Create a new subscription for a provider
 */
export async function createSubscription({
    providerId,
    planId,
    trialDays = 30
}: {
    providerId: string
    planId: string
    trialDays?: number
}): Promise<Subscription> {
    // Fetch plan details first to snapshot pricing
    const plan = await getPlan(planId)
    if (!plan) throw new Error('Plan not found')

    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
    
    // Calculate discount end date if applicable
    let discountEndsAt: Date | undefined
    if (plan.discount_duration_months && plan.discount_duration_months > 0) {
        // Discount starts AFTER trial
        discountEndsAt = new Date(trialEndsAt.getTime())
        discountEndsAt.setMonth(discountEndsAt.getMonth() + plan.discount_duration_months)
    }

    const { data, error } = await supabase
        .from('subscriptions')
        .insert({
            provider_id: providerId,
            plan_id: planId,
            status: 'trialing',
            trial_ends_at: trialEndsAt.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: trialEndsAt.toISOString(),
            // Snapshot current plan terms
            locked_price: getPlanPrice(plan, 'usd'),
            locked_discount_percent: plan.discount_percent || 0,
            discount_ends_at: discountEndsAt?.toISOString()
        })
        .select('*, plan:plans!plan_id(*)')
        .single()

    if (error) throw error

    // Update provider with subscription_id
    await supabase
        .from('providers')
        .update({ subscription_id: data.id })
        .eq('id', providerId)

    return data
}

/**
 * Check if provider can add more staff based on plan limits
 */
/**
 * Check if provider can add more staff based on plan limits, returning structured data
 */
export async function canAddStaff(providerId: string): Promise<{ 
    allowed: boolean; 
    reason?: 'limit_reached' | 'no_subscription';
    resource?: 'staff';
    limit?: number;
    currentCount?: number;
    planName?: string;
    message?: string; // Kept for backward compatibility if needed temporarily
}> {
    const subscription = await getProviderSubscription(providerId)
    
    if (!subscription || !subscription.plan) {
        return { allowed: false, reason: 'no_subscription', message: 'No active subscription' }
    }

    // Unlimited staff
    if (subscription.plan.max_staff === null) {
        return { allowed: true }
    }

    // Count current staff
    const { count, error } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('active', true)

    if (error) throw error

    if ((count || 0) >= (subscription.plan.max_staff ?? 0)) {
        return { 
            allowed: false, 
            reason: 'limit_reached',
            resource: 'staff',
            limit: subscription.plan.max_staff,
            currentCount: count || 0,
            planName: subscription.plan.display_name,
            message: `Your ${subscription.plan.display_name} plan allows up to ${subscription.plan.max_staff} staff member(s). Upgrade to add more.` 
        }
    }

    return { allowed: true }
}

/**
 * Check if provider can add more services based on plan limits
 */
export async function canAddService(providerId: string): Promise<{ 
    allowed: boolean; 
    reason?: 'limit_reached' | 'no_subscription';
    resource?: 'service';
    limit?: number;
    currentCount?: number;
    planName?: string;
    message?: string;
}> {
    const subscription = await getProviderSubscription(providerId)
    
    if (!subscription || !subscription.plan) {
        return { allowed: false, reason: 'no_subscription', message: 'No active subscription' }
    }

    // Unlimited services
    if (subscription.plan.max_services === null) {
        return { allowed: true }
    }

    // Count current services
    const { count, error } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('active', true)

    if (error) throw error

    if ((count || 0) >= (subscription.plan.max_services ?? 0)) {
        return { 
            allowed: false, 
            reason: 'limit_reached',
            resource: 'service',
            limit: subscription.plan.max_services,
            currentCount: count || 0,
            planName: subscription.plan.display_name,
            message: `Your ${subscription.plan.display_name} plan allows up to ${subscription.plan.max_services} service(s). Upgrade to add more.` 
        }
    }

    return { allowed: true }
}

/**
 * Check if provider can add more locations based on plan limits
 */
export async function canAddLocation(providerId: string): Promise<{ 
    allowed: boolean; 
    reason?: 'limit_reached' | 'no_subscription';
    resource?: 'location';
    limit?: number;
    currentCount?: number;
    planName?: string;
    message?: string;
}> {
    const subscription = await getProviderSubscription(providerId)
    
    if (!subscription || !subscription.plan) {
        return { allowed: false, reason: 'no_subscription', message: 'No active subscription' }
    }

    // Unlimited locations
    if (subscription.plan.max_locations === null) {
        return { allowed: true }
    }

    // Count current locations
    const { count, error } = await supabase
        .from('provider_addresses')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)

    if (error) throw error

    if ((count || 0) >= (subscription.plan.max_locations ?? 0)) {
        return { 
            allowed: false, 
            reason: 'limit_reached',
            resource: 'location',
            limit: subscription.plan.max_locations,
            currentCount: count || 0,
            planName: subscription.plan.display_name,
            message: `Your ${subscription.plan.display_name} plan allows up to ${subscription.plan.max_locations} location(s).` 
        }
    }

    return { allowed: true }
}

/**
 * Cancel a subscription at the end of the period
 * Also clears any pending downgrade since it's no longer relevant
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            cancel_at_period_end: true,
            cancelled_at: new Date().toISOString(),
            pending_downgrade_plan_id: null,  // Clear pending downgrade if any
            updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)

    if (error) throw error
}

/**
 * Resume a subscription (undo cancellation)
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            cancel_at_period_end: false,
            cancelled_at: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)

    if (error) throw error
}


/**
 * Helper to resolve plan price based on currency
 */
function getPlanPrice(plan: Plan, currency: string = 'usd'): number {
    const cur = currency.toLowerCase()
    if (plan.prices && plan.prices[cur]) {
        return plan.prices[cur]
    }
    // Fallback to USD if requested currency not found
    return plan.prices?.['usd'] || 0
}

/**
 * Check if provider's current usage fits within a target plan's limits
 */
async function checkResourceLimits(providerId: string, plan: Plan): Promise<{ 
    allowed: boolean; 
    message?: string;
    reason?: 'staff_limit' | 'service_limit' | 'location_limit';
    currentCount?: number;
    limit?: number;
}> {
    // 1. Check Staff
    if (plan.max_staff != null) {
        const { count, error } = await supabase
            .from('staff')
            .select('*', { count: 'exact', head: true })
            .eq('provider_id', providerId)
            .eq('active', true)

        if (error) throw error
        
        if ((count || 0) > plan.max_staff) {
            return {
                allowed: false,
                reason: 'staff_limit',
                currentCount: count || 0,
                limit: plan.max_staff,
                message: `Cannot change plan. You have ${count} active staff members, but the ${plan.display_name} plan allows only ${plan.max_staff}. Please deactivate ${count! - plan.max_staff} staff member(s) first.`
            }
        }
    }

    // 2. Check Services
    if (plan.max_services != null) {
        const { count, error } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true })
            .eq('provider_id', providerId)
            .eq('active', true)

        if (error) throw error

        if ((count || 0) > plan.max_services) {
            return {
                allowed: false,
                reason: 'service_limit',
                currentCount: count || 0,
                limit: plan.max_services,
                message: `Cannot change plan. You have ${count} active services, but the ${plan.display_name} plan allows only ${plan.max_services}. Please deactivate ${count! - plan.max_services} service(s) first.`
            }
        }
    }

    // 3. Check Locations
    if (plan.max_locations != null) {
        const { count, error } = await supabase
            .from('provider_addresses')
            .select('*', { count: 'exact', head: true })
            .eq('provider_id', providerId)

        if (error) throw error

        if ((count || 0) > plan.max_locations) {
            return {
                allowed: false,
                reason: 'location_limit',
                currentCount: count || 0,
                limit: plan.max_locations,
                message: `Cannot change plan. You have ${count} locations, but the ${plan.display_name} plan allows only ${plan.max_locations}. Please remove ${count! - plan.max_locations} location(s) first.`
            }
        }
    }

    return { allowed: true }
}


/**
 * Change subscription plan with proper proration and business rules
 * - Upgrades: Immediate effect with prorated charge
 * - Downgrades: Scheduled for next billing cycle
 * - Trial: Free switch with cap (1 free change, then upgrades only)
 */
export async function changePlan(
    subscriptionId: string, 
    newPlanId: string
): Promise<{ 
    success: boolean
    charge?: number
    credit?: number
    scheduledDate?: string
    message?: string 
}> {
    // 1. Fetch current subscription with plan
    const { data: currentSub, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:plans!plan_id(*)')
        .eq('id', subscriptionId)
        .single()
    
    if (subError || !currentSub) throw new Error('Subscription not found')
    
    // 2. Fetch new plan details
    const newPlan = await getPlan(newPlanId)
    if (!newPlan) throw new Error('New plan not found')
    
    const oldPlan = currentSub.plan
    if (!oldPlan) throw new Error('Current plan not found')
    
    // Same plan check
    if (currentSub.plan_id === newPlanId) {
        return { success: false, message: 'Already on this plan' }
    }

    // --- RESOURCE LIMIT CHECK ---
    // Check if user has too many resources (active staff, services, etc) for the new plan
    const { allowed, message } = await checkResourceLimits(currentSub.provider_id, newPlan)
    if (!allowed) {
        return { success: false, message }
    }
    
    const currency = currentSub.currency || 'usd'
    const newPriceValue = getPlanPrice(newPlan, currency)
    const oldPriceValue = currentSub.locked_price ?? getPlanPrice(oldPlan, currency)
    
    const isUpgrade = newPriceValue > oldPriceValue
    const isDowngrade = newPriceValue < oldPriceValue
    const isTrialing = currentSub.status === 'trialing'
    const trialChangeCount = currentSub.trial_plan_change_count || 0
    
    // --- TRIAL CAP LOGIC ---
    if (isTrialing && trialChangeCount >= 1 && isDowngrade) {
        return { 
            success: false, 
            message: 'Downgrades not allowed after first plan change during trial. You can upgrade to a higher plan.' 
        }
    }

    // --- LOCAL DATABASE UPDATES ---
    if (isTrialing) {
        // Free switch during trial - update immediately, no billing
        const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
                plan_id: newPlanId,
                locked_price: newPriceValue,
                // Preserve original discount_ends_at - DO NOT recalculate
                trial_plan_change_count: trialChangeCount + 1,
                // Clear any pending downgrade
                pending_downgrade_plan_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionId)
        
        if (updateError) throw updateError
        
        return { success: true, charge: 0, credit: 0, message: 'Plan changed successfully (trial)' }
    }
    
    // --- ACTIVE SUBSCRIPTION LOGIC ---
    
    if (isUpgrade) {
        // Calculate proration
        const { credit, charge } = calculateProration(currentSub, newPlan)
        const netCharge = Math.max(0, charge - credit) // Ensure non-negative
        
        // Update subscription immediately
        const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
                plan_id: newPlanId,
                locked_price: newPriceValue,
                // Preserve discount_ends_at - DO NOT recalculate
                // Clear pending downgrade if any
                pending_downgrade_plan_id: null,
                cancel_at_period_end: false,
                cancelled_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionId)
        
        if (updateError) throw updateError
        
        return { 
            success: true, 
            charge: netCharge, 
            credit, 
            message: `Upgraded to ${newPlan.display_name}. Prorated charge: ${netCharge.toFixed(2)}` 
        }
    }
    
    if (isDowngrade) {
        // Schedule for next billing cycle
        const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
                pending_downgrade_plan_id: newPlanId,
                updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionId)
        
        if (updateError) throw updateError
        
        const scheduledDate = currentSub.current_period_end
        
        return { 
            success: true, 
            charge: 0, 
            credit: 0,
            scheduledDate,
            message: `Downgrade to ${newPlan.display_name} scheduled for ${new Date(scheduledDate).toLocaleDateString()}` 
        }
    }
    
    // Lateral move (same price) - treat like upgrade (immediate)
    const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
            plan_id: newPlanId,
            locked_price: newPriceValue,
            pending_downgrade_plan_id: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
    
    if (updateError) throw updateError
    
    return { success: true, charge: 0, credit: 0, message: `Changed to ${newPlan.display_name}` }
}

/**
 * Cancel a pending downgrade
 */
export async function cancelPendingDowngrade(subscriptionId: string): Promise<void> {
    const { error } = await supabase
        .from('subscriptions')
        .update({ 
            pending_downgrade_plan_id: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
    
    if (error) throw error
}

/**
 * Calculate proration for plan change
 * Returns credit for old plan's unused time and charge for new plan's remaining time
 */
function calculateProration(
    subscription: { 
        current_period_start?: string
        current_period_end?: string
        locked_price?: number
        locked_discount_percent?: number
        discount_ends_at?: string
        plan?: { prices: Record<string, number> }
        currency?: string
    }, 
    newPlan: Plan
): { credit: number; charge: number; daysRemaining: number; totalDays: number } {
    const now = new Date()
    const periodStart = new Date(subscription.current_period_start || now)
    const periodEnd = new Date(subscription.current_period_end || now)
    
    const totalMs = periodEnd.getTime() - periodStart.getTime()
    const remainingMs = periodEnd.getTime() - now.getTime()
    
    const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)))
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)))
    
    const currency = subscription.currency || 'usd'

    // Current plan's effective price (with discount if still active)
    const oldPrice = subscription.locked_price ?? getPlanPrice(subscription.plan as Plan, currency) ?? 0
    const oldDiscount = subscription.locked_discount_percent ?? 0
    const discountEndsAt = subscription.discount_ends_at ? new Date(subscription.discount_ends_at) : null
    
    const oldDiscountActive = discountEndsAt && discountEndsAt > now
    const effectiveOldPrice = oldDiscountActive 
        ? oldPrice * (1 - oldDiscount / 100) 
        : oldPrice
    
    // New plan's effective price (inherit remaining discount time)
    const newPrice = getPlanPrice(newPlan, currency)
    const effectiveNewPrice = oldDiscountActive 
        ? newPrice * (1 - oldDiscount / 100) 
        : newPrice
    
    // Daily rates
    const oldDailyRate = effectiveOldPrice / 30 // Standardize to 30-day month
    const newDailyRate = effectiveNewPrice / 30
    
    const credit = Number((oldDailyRate * daysRemaining).toFixed(2))
    const charge = Number((newDailyRate * daysRemaining).toFixed(2))
    
    return { credit, charge, daysRemaining, totalDays }
}

/**
 * Preview proration without making changes
 */
export async function previewPlanChange(
    subscriptionId: string, 
    newPlanId: string
): Promise<{
    isUpgrade: boolean
    isDowngrade: boolean
    credit: number
    charge: number
    netCharge: number
    scheduledDate?: string
    canChange: boolean
    message?: string
    reason?: 'staff_limit' | 'service_limit' | 'location_limit'
    currentCount?: number
    limit?: number
}> {
    // Fetch current subscription
    const { data: currentSub, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:plans!plan_id(*)')
        .eq('id', subscriptionId)
        .single()
    
    if (subError || !currentSub) throw new Error('Subscription not found')
    
    const newPlan = await getPlan(newPlanId)
    if (!newPlan) throw new Error('New plan not found')
    
    const oldPlan = currentSub.plan
    if (!oldPlan) throw new Error('Current plan not found')

    // Check usage limits for the new plan *before* even checking prices/trial rules
    const { allowed, message: limitMessage, reason, currentCount, limit } = await checkResourceLimits(currentSub.provider_id, newPlan)
    if (!allowed) {
         return {
            isUpgrade: false,
            isDowngrade: false, // It might be a downgrade, but we block it here
            credit: 0,
            charge: 0,
            netCharge: 0,
            canChange: false,
            message: limitMessage,
            reason,
            currentCount,
            limit
        }
    }
    
    const currency = currentSub.currency || 'usd'
    const newPriceValue = getPlanPrice(newPlan, currency)
    const oldPriceValue = currentSub.locked_price ?? getPlanPrice(oldPlan, currency)

    const isUpgrade = newPriceValue > oldPriceValue
    const isDowngrade = newPriceValue < oldPriceValue
    const isTrialing = currentSub.status === 'trialing'
    const trialChangeCount = currentSub.trial_plan_change_count || 0
    
    // Check trial restrictions
    if (isTrialing && trialChangeCount >= 1 && isDowngrade) {
        return {
            isUpgrade: false,
            isDowngrade: true,
            credit: 0,
            charge: 0,
            netCharge: 0,
            canChange: false,
            message: 'Downgrades not allowed after first plan change during trial'
        }
    }
    
    if (isTrialing) {
        return {
            isUpgrade,
            isDowngrade,
            credit: 0,
            charge: 0,
            netCharge: 0,
            canChange: true,
            message: 'Free plan change during trial'
        }
    }
    
    if (isUpgrade) {
        const { credit, charge } = calculateProration(currentSub, newPlan)
        const netCharge = Math.max(0, charge - credit)
        return {
            isUpgrade: true,
            isDowngrade: false,
            credit,
            charge,
            netCharge,
            canChange: true
        }
    }
    
    if (isDowngrade) {
        return {
            isUpgrade: false,
            isDowngrade: true,
            credit: 0,
            charge: 0,
            netCharge: 0,
            scheduledDate: currentSub.current_period_end,
            canChange: true,
            message: `Will take effect on ${new Date(currentSub.current_period_end!).toLocaleDateString()}`
        }
    }
    
    // Lateral move
    return {
        isUpgrade: false,
        isDowngrade: false,
        credit: 0,
        charge: 0,
        netCharge: 0,
        canChange: true
    }
}


