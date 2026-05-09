import { supabase } from '../lib/supabase'
import { appendSlugSuffix, slugify } from '../lib/slug'
import type { Service } from '../types'
import { canAddService } from './subscriptionService'

async function createUniqueServiceSlug(providerId: string, name: string, serviceId?: string) {
    const baseSlug = slugify(name)

    for (let suffix = 0; suffix < 50; suffix++) {
        const candidate = appendSlugSuffix(baseSlug, suffix)
        let query = supabase
            .from('services')
            .select('id')
            .eq('provider_id', providerId)
            .eq('slug', candidate)
            .limit(1)

        if (serviceId) {
            query = query.neq('id', serviceId)
        }

        const { data, error } = await query
        if (error) throw error
        if (!data || data.length === 0) return candidate
    }

    return `${baseSlug}-${Date.now()}`
}

export async function fetchServices(providerId?: string) {
    let query = supabase
        .from('services')
        .select(`
            *,
            categories(id, name),
            service_staff (
                staff (
                    id,
                    name,
                    email
                )
            ),
            service_images (
                id,
                url,
                display_order
            )
        `)
        .order('active', { ascending: false })
        .order('name', { foreignTable: 'categories', ascending: true })
        .order('name', { ascending: true })
        // Order images by display_order
        .order('display_order', { foreignTable: 'service_images', ascending: true })

    if (providerId) {
        query = query.eq('provider_id', providerId)
    }

    const { data, error } = await query
    if (error) throw error

    // Transform the nested data structure to match the Service interface
    return (data || []).map((service: any) => ({
        ...service,
        staff: service.service_staff?.map((item: any) => item.staff).filter(Boolean) || [],
        images: service.service_images || []
    }))
}

export async function createService(service: Omit<Service, 'id' | 'created_at' | 'updated_at' | 'categories' | 'staff' | 'provider' | 'images'> & { staff_ids?: string[], image_urls?: string[] }) {
    if (!service.provider_id) throw new Error('Provider ID is required');
    if (!service.staff_ids || service.staff_ids.length === 0) {
        throw new Error('At least one staff member is required for a service.')
    }

    const limitCheck = await canAddService(service.provider_id)
    if (!limitCheck.allowed && service.active !== false) {
      throw new Error(limitCheck.message || 'Service limit reached for your plan.')
    }

    // Explicitly remove 'id' if it exists in the runtime object to avoid violating NOT NULL constraint
    // @ts-ignore
    const { staff_ids, image_urls, id, ...serviceData } = service

    const slug = serviceData.slug || await createUniqueServiceSlug(service.provider_id, serviceData.name)

    // 1. Insert the service
    const { data: insertedData, error: createError } = await supabase
        .from('services')
        .insert([{ ...serviceData, slug }])
        .select()
        .single()

    if (createError) throw createError

    // 2. Insert staff relations if present
    if (insertedData && staff_ids && staff_ids.length > 0) {
        const staffRelations = staff_ids.map(staffId => ({
            service_id: insertedData.id,
            staff_id: staffId
        }))

        const { error: staffError } = await supabase
            .from('service_staff')
            .insert(staffRelations)

        if (staffError) throw staffError
        if (staffError) throw staffError
    }

    // 3. Insert images if present
    if (insertedData && image_urls && image_urls.length > 0) {
        const imageRecords = image_urls.map((url, index) => ({
            service_id: insertedData.id,
            url: url,
            display_order: index
        }))

        const { error: imageError } = await supabase
            .from('service_images')
            .insert(imageRecords)

        if (imageError) throw imageError
    }

    // 4. Fetch the complete service with relations
    if (insertedData) {
        const { data: completeData, error: fetchError } = await supabase
            .from('services')
            .select(`
                *,
                categories(id, name),
                service_staff (
                    staff (
                        id,
                        name,
                        email
                    )
                ),
                service_images (
                    id,
                    url,
                    display_order
                )
            `)
            .eq('id', insertedData.id)
            .single()
            // Order images
            // Note: ordering in single select with inner join usually works if we could apply order to the foreign table resource, 
            // but supabase-js syntax for nested ordering is tricky. 
            // Usually we rely on the client or subsequent fetch if it's complex.
            // But let's try to assume it returns them. 
            // To ensure order we might need .order('display_order', { foreignTable: 'service_images', ascending: true }) but keys might conflict in single().
            // We'll sort in the transform.

        if (fetchError) throw fetchError

        // Transform
        return {
            ...completeData,
            staff: completeData.service_staff?.map((item: any) => item.staff).filter(Boolean) || [],
            images: completeData.service_images?.sort((a: any, b: any) => a.display_order - b.display_order) || []
        }
    }
    return insertedData
}

export async function updateService(id: string, updates: Partial<Service> & { staff_ids?: string[], image_urls?: string[] }) {
    // Remove joined data from updates if present
    const { categories, staff, provider, images, staff_ids, image_urls, ...cleanUpdates } = updates
    if (staff_ids !== undefined && staff_ids.length === 0) {
        throw new Error('At least one staff member is required for a service.')
    }

    if (cleanUpdates.name && !cleanUpdates.slug) {
        const { data: existingService, error: existingError } = await supabase
            .from('services')
            .select('provider_id, slug')
            .eq('id', id)
            .single()

        if (existingError) throw existingError

        if (existingService?.provider_id && !existingService.slug) {
            cleanUpdates.slug = await createUniqueServiceSlug(existingService.provider_id, cleanUpdates.name, id)
        }
    }

    // 1. Update basic service info
    if (Object.keys(cleanUpdates).length > 0) {
        const { error } = await supabase
            .from('services')
            .update(cleanUpdates)
            .eq('id', id)

        if (error) throw error
    }

    // 2. Update staff relations if provided
    if (staff_ids !== undefined) {
        // First delete existing relations
        const { error: deleteError } = await supabase
            .from('service_staff')
            .delete()
            .eq('service_id', id)

        if (deleteError) throw deleteError

        // Then insert new ones
        if (staff_ids.length > 0) {
            const staffRelations = staff_ids.map(staffId => ({
                service_id: id,
                staff_id: staffId
            }))

            const { error: insertError } = await supabase
                .from('service_staff')
                .insert(staffRelations)

            if (insertError) throw insertError
            if (insertError) throw insertError
        }
    }

    // 3. Update images if provided
    if (image_urls !== undefined) {
        // Delete existing images
        const { error: deleteError } = await supabase
            .from('service_images')
            .delete()
            .eq('service_id', id)
        
        if (deleteError) throw deleteError

        // Insert new images
        if (image_urls.length > 0) {
             const imageRecords = image_urls.map((url, index) => ({
                service_id: id,
                url: url,
                display_order: index
            }))

             const { error: insertError } = await supabase
                .from('service_images')
                .insert(imageRecords)

            if (insertError) throw insertError
        }
    }

    // 4. Fetch updated service with all relations
    const { data: completeData, error } = await supabase
        .from('services')
        .select(`
            *,
            categories(id, name),
            service_staff (
                staff (
                    id,
                    name,
                    email
                )
            ),
            service_images (
                id,
                url,
                display_order
            )
        `)
        .eq('id', id)
        .single()

    if (error) throw error

    // Transform
    return {
        ...completeData,
        staff: completeData.service_staff?.map((item: any) => item.staff).filter(Boolean) || [],
        images: completeData.service_images?.sort((a: any, b: any) => a.display_order - b.display_order) || []
    }
}

export async function deleteService(id: string) {
    // Soft delete by setting active to false
    const { error } = await supabase
        .from('services')
        .update({ active: false })
        .eq('id', id)

    if (error) throw error
}
