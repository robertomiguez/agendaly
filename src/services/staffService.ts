import { supabase } from '../lib/supabase'
import type { Staff } from '../types'
import { canAddStaff } from './subscriptionService'
import { uploadImage, deleteImage } from '../lib/storage'
import { appendSlugSuffix, slugify } from '../lib/slug'

const BUCKET = 'staff-photos'

async function createUniqueStaffSlug(providerId: string, name: string, staffId?: string) {
    const baseSlug = slugify(name)

    for (let suffix = 0; suffix < 100; suffix++) {
        const slug = appendSlugSuffix(baseSlug, suffix)
        let query = supabase
            .from('staff')
            .select('id')
            .eq('provider_id', providerId)
            .eq('slug', slug)
            .limit(1)

        if (staffId) {
            query = query.neq('id', staffId)
        }

        const { data, error } = await query
        if (error) throw error
        if (!data?.length) return slug
    }

    return `${baseSlug}-${Date.now()}`
}

export async function fetchStaff(providerId: string) {
    const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('provider_id', providerId)
        .order('active', { ascending: false })
        .order('name')

    if (error) throw error
    return data || []
}

export async function createStaff({
    staff,
    photoFile,
    authUserId
}: {
    staff: Omit<Staff, 'id' | 'created_at' | 'updated_at'>,
    photoFile?: File | null,
    authUserId: string
}) {
    if (!staff.provider_id) throw new Error('Provider ID is required');
    const limitCheck = await canAddStaff(staff.provider_id)
    if (!limitCheck.allowed && staff.active !== false) {
      throw new Error(limitCheck.message || 'Staff limit reached for your plan.')
    }

    let photo_url: string | null = null
    let photo_path: string | null = null

    if (photoFile) {
        const uploaded = await uploadImage(BUCKET, authUserId, photoFile)
        photo_url = uploaded.url
        photo_path = uploaded.path
    }

    const { data, error } = await supabase
        .from('staff')
        .insert([{
            ...staff,
            slug: await createUniqueStaffSlug(staff.provider_id, staff.name),
            photo_url,
            photo_path
        }])
        .select()
        .single()

    if (error) {
        // Cleanup photo if DB insert fails
        if (photo_path) await deleteImage(BUCKET, photo_path)
        throw error
    }
    return data
}

export async function fetchStaffMemberBySlug(providerSlug: string, staffSlug: string): Promise<Staff | null> {
    const { data, error } = await supabase
        .from('staff')
        .select(`
            *,
            providers!inner(id, slug)
        `)
        .eq('slug', staffSlug)
        .eq('providers.slug', providerSlug)
        .eq('active', true)
        .maybeSingle()

    if (error) throw error
    return data
}

export async function updateStaff({
    id,
    updates,
    photoFile,
    authUserId,
    existingPhotoPath
}: {
    id: string,
    updates: Partial<Staff>,
    photoFile?: File | null,
    authUserId: string,
    existingPhotoPath?: string | null
}) {
    let photo_url = updates.photo_url
    let photo_path = updates.photo_path

    if (photoFile) {
        // Delete old photo if exists
        if (existingPhotoPath) {
            await deleteImage(BUCKET, existingPhotoPath)
        }

        // Upload new photo
        const uploaded = await uploadImage(BUCKET, authUserId, photoFile)
        photo_url = uploaded.url
        photo_path = uploaded.path
    } else if (photoFile === null && existingPhotoPath) {
        // Explicitly removed photo
        await deleteImage(BUCKET, existingPhotoPath)
        photo_url = null
        photo_path = null
    }

    const { data, error } = await supabase
        .from('staff')
        .update({
            ...updates,
            photo_url,
            photo_path
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteStaff(id: string) {
    // Get staff to check for photo
    const { data: staff } = await supabase
        .from('staff')
        .select('photo_path')
        .eq('id', id)
        .single()

    const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)

    if (error) throw error

    // Cleanup photo if exists
    if (staff?.photo_path) {
        await deleteImage(BUCKET, staff.photo_path)
    }
}
