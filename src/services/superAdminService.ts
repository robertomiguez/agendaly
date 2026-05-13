import { supabase } from '../lib/supabase'
import type { Provider, Service, Staff, ProviderAddress, Ad } from '../types'

/**
 * Log an administrative action to the audit table.
 */
async function logAdminAction(adminId: string, action: string, targetType: string, targetId: string, details: any = {}) {
    const { error } = await supabase
        .from('admin_activity_logs')
        .insert({
            admin_id: adminId,
            action,
            target_type: targetType,
            target_id: targetId,
            details
        })

    if (error) {
        console.error('[superAdminService] Error logging admin action:', error)
    }
}

const ALLOWED_AD_IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp']
])
const MAX_AD_IMAGE_SIZE = 5 * 1024 * 1024

function buildAdCreatePayload(adData: Partial<Ad>) {
    return {
        title: adData.title,
        description: adData.description || null,
        link_url: adData.link_url || null,
        placement: adData.placement || [],
        is_active: adData.is_active ?? true,
        priority: adData.priority ?? 0,
        start_at: adData.start_at || null,
        end_at: adData.end_at || null
    }
}

function buildAdUpdatePayload(adData: Partial<Ad>) {
    const payload: Record<string, unknown> = {}

    if (adData.title !== undefined) payload.title = adData.title
    if (adData.description !== undefined) payload.description = adData.description || null
    if (adData.link_url !== undefined) payload.link_url = adData.link_url || null
    if (adData.placement !== undefined) payload.placement = adData.placement
    if (adData.is_active !== undefined) payload.is_active = adData.is_active
    if (adData.priority !== undefined) payload.priority = adData.priority
    if (adData.start_at !== undefined) payload.start_at = adData.start_at || null
    if (adData.end_at !== undefined) payload.end_at = adData.end_at || null

    return payload
}

async function uploadAdImage(imageFile: File) {
    const extension = ALLOWED_AD_IMAGE_TYPES.get(imageFile.type)

    if (!extension) {
        throw new Error('Banner image must be a JPG, PNG, or WebP file')
    }

    if (imageFile.size > MAX_AD_IMAGE_SIZE) {
        throw new Error('Banner image must be 5MB or smaller')
    }

    const imagePath = `banners/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
        .from('ads')
        .upload(imagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false
        })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
        .from('ads')
        .getPublicUrl(imagePath)

    return { imagePath, imageUrl: publicUrl }
}

export const superAdminService = {
    /**
     * Fetch platform-wide statistics for the dashboard.
     */
    async getDashboardStats() {
        const [providers, services, staff, appts] = await Promise.all([
            supabase.from('providers').select('*', { count: 'exact', head: true }),
            supabase.from('services').select('*', { count: 'exact', head: true }),
            supabase.from('staff').select('*', { count: 'exact', head: true }),
            supabase.from('appointments').select('*', { count: 'exact', head: true })
        ])

        return {
            totalProviders: providers.count || 0,
            totalServices: services.count || 0,
            totalStaff: staff.count || 0,
            totalAppointments: appts.count || 0
        }
    },

    /**
     * Providers Management
     */
    async listProviders() {
        const { data, error } = await supabase
            .from('providers')
            .select('*, profiles(email, phone)')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as (Provider & { profiles: { email: string, phone: string } })[]
    },

    async updateProviderStatus(adminId: string, providerId: string, updates: { active?: boolean; status?: any; deactivation_reason?: string }) {
        const { error } = await supabase
            .from('providers')
            .update(updates)
            .eq('id', providerId)

        if (error) throw error

        await logAdminAction(
            adminId,
            updates.active === false || updates.status === 'suspended' ? 'deactivate_provider' : 'activate_provider',
            'provider',
            providerId,
            updates
        )
    },

    /**
     * Services Management
     */
    async listServices() {
        const { data, error } = await supabase
            .from('services')
            .select('*, providers(business_name, currency)')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as (Service & { providers: { business_name: string } })[]
    },

    async updateServiceStatus(adminId: string, serviceId: string, active: boolean, reason?: string) {
        const { error } = await supabase
            .from('services')
            .update({ active, deactivation_reason: reason })
            .eq('id', serviceId)

        if (error) throw error

        await logAdminAction(
            adminId,
            active ? 'activate_service' : 'deactivate_service',
            'service',
            serviceId,
            { active, reason }
        )
    },

    /**
     * Staff Management
     */
    async listStaff() {
        const { data, error } = await supabase
            .from('staff')
            .select('*, providers!staff_provider_id_fkey(business_name)')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as (Staff & { providers: { business_name: string } })[]
    },

    async updateStaffStatus(adminId: string, staffId: string, active: boolean, reason?: string) {
        const { error } = await supabase
            .from('staff')
            .update({ active, deactivation_reason: reason })
            .eq('id', staffId)

        if (error) throw error

        await logAdminAction(
            adminId,
            active ? 'activate_staff' : 'deactivate_staff',
            'staff',
            staffId,
            { active, reason }
        )
    },

    /**
     * Locals (Addresses) Management
     */
    async listLocals() {
        const { data, error } = await supabase
            .from('provider_addresses')
            .select('*, providers(business_name)')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as (ProviderAddress & { providers: { business_name: string } })[]
    },

    async updateLocalStatus(adminId: string, localId: string, active: boolean, reason?: string) {
        const { error } = await supabase
            .from('provider_addresses')
            .update({ active, deactivation_reason: reason })
            .eq('id', localId)

        if (error) throw error

        await logAdminAction(
            adminId,
            active ? 'activate_local' : 'deactivate_local',
            'local',
            localId,
            { active, reason }
        )
    },

    /**
     * Ads Management
     */
    async listAllAds() {
        const { data, error } = await supabase
            .from('ads')
            .select('*')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as Ad[]
    },

    async createAd(adminId: string, adData: Partial<Ad>, imageFile?: File) {
        let imageUrl = adData.image_url
        let imagePath = adData.image_path
        let uploadedImagePath: string | null = null

        if (imageFile) {
            const uploadedImage = await uploadAdImage(imageFile)
            imagePath = uploadedImage.imagePath
            imageUrl = uploadedImage.imageUrl
            uploadedImagePath = uploadedImage.imagePath
        }

        const payload = buildAdCreatePayload(adData)
        const { data, error } = await supabase
            .from('ads')
            .insert([{ ...payload, image_url: imageUrl, image_path: imagePath }])
            .select()
            .single()

        if (error) {
            if (uploadedImagePath) {
                await supabase.storage.from('ads').remove([uploadedImagePath])
            }
            throw error
        }

        await logAdminAction(adminId, 'create_ad', 'ad', data.id, data)
        return data as Ad
    },

    async updateAd(adminId: string, adId: string, adData: Partial<Ad>, imageFile?: File) {
        let imageUrl = adData.image_url
        let imagePath = adData.image_path
        const previousImagePath = adData.image_path
        let uploadedImagePath: string | null = null

        if (imageFile) {
            const uploadedImage = await uploadAdImage(imageFile)
            imagePath = uploadedImage.imagePath
            imageUrl = uploadedImage.imageUrl
            uploadedImagePath = uploadedImage.imagePath
        }

        const payload = buildAdUpdatePayload(adData)
        const imageUpdates = {
            ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
            ...(imagePath !== undefined ? { image_path: imagePath } : {})
        }
        const { error } = await supabase
            .from('ads')
            .update({ ...payload, ...imageUpdates, updated_at: new Date().toISOString() })
            .eq('id', adId)

        if (error) {
            if (uploadedImagePath) {
                await supabase.storage.from('ads').remove([uploadedImagePath])
            }
            throw error
        }

        if (uploadedImagePath && previousImagePath) {
            const { error: removeError } = await supabase.storage.from('ads').remove([previousImagePath])
            if (removeError) {
                console.error('[superAdminService] Error removing replaced ad image:', removeError)
            }
        }

        await logAdminAction(adminId, 'update_ad', 'ad', adId, payload)
    },

    async deleteAd(adminId: string, ad: Ad) {
        const { error } = await supabase
            .from('ads')
            .delete()
            .eq('id', ad.id)

        if (error) throw error

        if (ad.image_path) {
            const { error: removeError } = await supabase.storage.from('ads').remove([ad.image_path])
            if (removeError) {
                console.error('[superAdminService] Error removing deleted ad image:', removeError)
            }
        }

        await logAdminAction(adminId, 'delete_ad', 'ad', ad.id, ad)
    },

}
