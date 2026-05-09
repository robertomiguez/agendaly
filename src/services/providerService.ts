import { supabase } from '../lib/supabase'
import { uploadImage, deleteImage } from '../lib/storage'
import { appendSlugSuffix, isReservedProviderSlug, slugify } from '../lib/slug'
import type { Provider } from '../types'

import { getPlanByName } from './subscriptionService'

async function createUniqueProviderSlug(name: string, providerId?: string) {
    const baseSlug = slugify(name)

    for (let suffix = 0; suffix < 100; suffix++) {
        const slug = appendSlugSuffix(baseSlug, suffix)
        if (isReservedProviderSlug(slug)) continue

        let query = supabase
            .from('providers')
            .select('id')
            .eq('slug', slug)
            .limit(1)

        if (providerId) {
            query = query.neq('id', providerId)
        }

        const { data, error } = await query
        if (error) throw error
        if (!data?.length) return slug
    }

    return `${baseSlug}-${Date.now()}`
}

/**
 * Create a minimal provider record for checkout flow.
 * This allows users to checkout before completing their full profile.
 */
export async function createMinimalProvider(profileId: string): Promise<string> {
    // Check if provider already exists
    const { data: existingProvider } = await supabase
        .from('providers')
        .select('id')
        .eq('profile_id', profileId)
        .single()

    if (existingProvider) {
        return existingProvider.id
    }

    // Create minimal provider record
    const { data: newProvider, error } = await supabase
        .from('providers')
        .insert({
            profile_id: profileId,
            business_name: '', // Will be filled in profile completion
            status: 'pending', // Not approved until profile is complete
        })
        .select('id')
        .single()

    if (error) throw error
    return newProvider.id
}

export async function saveProvider({
    user,
    profile,
    provider,
    form,
    logoFile,
    planName // Optional plan name to create subscription
}: {
    user: any
    profile: any
    provider?: any
    form: any
    logoFile?: File | null
    planName?: string | null
}) {
    let logo_url = provider?.logo_url ?? null
    let logo_path = provider?.logo_path ?? null

    if (logoFile) {
        // delete old
        await deleteImage('provider-logos', logo_path)

        // upload new
        const uploaded = await uploadImage('provider-logos', user.id, logoFile)
        logo_url = uploaded.url
        logo_path = uploaded.path
    }

    let newProviderId = provider?.id

    if (provider) {
        // UPDATE
        const updateData: any = {
            business_name: form.business_name,
            description: form.description,
            logo_url,
            logo_path
        }

        if (!provider.slug) {
            updateData.slug = await createUniqueProviderSlug(form.business_name, provider.id)
        }

        // Auto-approve if currently pending
        if (provider.status === 'pending') {
            updateData.status = 'approved'
            updateData.approved_at = new Date().toISOString()
        }

        const { error } = await supabase
            .from('providers')
            .update(updateData)
            .eq('id', provider.id)

        if (error) throw error
    } else {
        // INSERT
        const { data: newProvider, error } = await supabase
            .from('providers')
            .insert({
                profile_id: profile.id,
                business_name: form.business_name,
                slug: await createUniqueProviderSlug(form.business_name),
                description: form.description,
                logo_url,
                logo_path,
                status: 'approved',
                approved_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) throw error
        newProviderId = newProvider.id
    }

    // Create subscription if planName is provided
    // We check if a subscription already exists to avoid duplicates or handle upgrades mainly for new onboarding
    if (planName && newProviderId) {
        const plan = await getPlanByName(planName)
        
        // Check if subscription already exists
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('provider_id', newProviderId)
            .maybeSingle()

        if (plan && !existingSub) {
            // Calculate discount end date if applicable
            const now = new Date()
            let discountEndsAt: Date | undefined
            if (plan.discount_duration_months && plan.discount_duration_months > 0) {
                discountEndsAt = new Date(now)
                discountEndsAt.setMonth(discountEndsAt.getMonth() + plan.discount_duration_months)
            }

            const isFreemium = plan.name === 'freemium'
            const currentPeriodEnd = isFreemium ? null : new Date(now.setMonth(now.getMonth() + 1)).toISOString()

            const { error: subError } = await supabase
                .from('subscriptions')
                .insert({
                    provider_id: newProviderId,
                    plan_id: plan.id,
                    status: 'active',
                    current_period_start: now.toISOString(),
                    current_period_end: currentPeriodEnd,
                    locked_price: plan.prices?.usd || 0,
                    locked_discount_percent: plan.discount_percent || 0,
                    discount_ends_at: discountEndsAt?.toISOString()
                })
                .select()
                .single()
            
            if (subError) {
                console.error('Failed to create initial subscription:', subError)
            }
        }
    }
}

// Helper to format date as YYYY-MM-DD in local time
function formatLocalDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export async function fetchDashboardStats(providerId: string) {
    // Get today's date in local time
    const today = new Date()
    const todayStr = formatLocalDate(today)

    // Get this week's date range (Week starts on Sunday)
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay()) 
    const weekStartStr = formatLocalDate(weekStart)
    
    // For week end, we want to include through next Saturday
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const weekEndStr = formatLocalDate(weekEnd)

    // Get this month's date range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthStartStr = formatLocalDate(monthStart)
    
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const monthEndStr = formatLocalDate(monthEnd)

    // Fetch today's appointments
    // We compare appointment_date (YYYY-MM-DD) directly with our local date string
    const { data: todayAppts, error: todayError } = await supabase
        .from('appointments')
        .select('*, services!inner(provider_id, price)')
        .eq('appointment_date', todayStr)
        .eq('services.provider_id', providerId)
    
    if (todayError) throw todayError

    // Fetch week's appointments
    const { data: weekAppts, error: weekError } = await supabase
        .from('appointments')
        .select('*, services!inner(provider_id, price)')
        .gte('appointment_date', weekStartStr)
        .lt('appointment_date', weekEndStr)
        .eq('services.provider_id', providerId)

    if (weekError) throw weekError

    // Fetch month's appointments
    const { data: monthAppts, error: monthError } = await supabase
        .from('appointments')
        .select('*, services!inner(provider_id, price)')
        .gte('appointment_date', monthStartStr)
        .lte('appointment_date', monthEndStr)
        .eq('services.provider_id', providerId)

    if (monthError) throw monthError

    // Fetch active services count
    const { count: servicesCount, error: servicesError } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('active', true)
    
    if (servicesError) throw servicesError

    // Fetch staff count
    const { count: staffCount, error: staffError } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', providerId)
        .eq('active', true)
    
    if (staffError) throw staffError

    // Calculate revenue using booked_price (locked at time of booking)
    const weekRevenue = weekAppts?.reduce((sum, apt: any) => sum + (apt.booked_price || 0), 0) || 0
    const monthRevenue = monthAppts?.reduce((sum, apt: any) => sum + (apt.booked_price || 0), 0) || 0

    return {
        todayAppointments: todayAppts?.length || 0,
        weekAppointments: weekAppts?.length || 0,
        monthAppointments: monthAppts?.length || 0,
        weekRevenue,
        monthRevenue,
        activeServices: servicesCount || 0,
        totalStaff: staffCount || 0
    }
}

export async function fetchRevenueReport(providerId: string) {
    // Get this week's date range (Sunday to Saturday) using local dates
    const today = new Date()
    // Calculate start of week
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const weekStartStr = formatLocalDate(weekStart)
    
    // Calculate end of week (next Saturday)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const weekEndStr = formatLocalDate(weekEnd)

    const { data, error } = await supabase
        .from('appointments')
        .select(`
            id,
            appointment_date,
            status,
            booked_price,
            services!inner(name, price, provider_id),
            customers(name, email)
        `)
        .eq('services.provider_id', providerId)
        .gte('appointment_date', weekStartStr)
        .lte('appointment_date', weekEndStr)
        .order('appointment_date', { ascending: false })

    if (error) throw error
    return data
}

export async function fetchPublicProviderBySlug(slug: string): Promise<Provider | null> {
    const { data, error } = await supabase
        .from('providers')
        .select(`
            *,
            provider_addresses(*)
        `)
        .eq('slug', slug)
        .eq('status', 'approved')
        .or('active.is.true,active.is.null')
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Fetch providers for discovery (landing page) with server-side filtering and pagination.
 */
export async function fetchDiscoverableProviders({
    categoryId,
    searchTerm,
    userLat,
    userLng,
    countryCode,
    page = 1,
    pageSize = 12
}: {
    categoryId?: string | null
    searchTerm?: string | null
    userLat?: number | null
    userLng?: number | null
    countryCode?: string | null
    page?: number
    pageSize?: number
} = {}) {
    const { data, error } = await supabase.rpc('discover_providers', {
        p_user_lat: userLat,
        p_user_lng: userLng,
        p_category_id: categoryId || null,
        p_search_term: searchTerm || null,
        p_page: page,
        p_page_size: pageSize,
        p_country_code: countryCode || null
    })

    if (error) {
        console.error('Error fetching discoverable providers:', error)
        return { providers: [], totalCount: 0 }
    }

    const totalCount = (data && data.length > 0) ? Number(data[0].total_count) : 0
    
    return { 
        providers: data || [], 
        totalCount 
    }
}
