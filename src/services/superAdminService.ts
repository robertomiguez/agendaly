import { supabase } from '../lib/supabase'
import type { Provider, Service, Staff, ProviderAddress } from '../types'

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

export const superAdminService = {
    /**
     * Fetch platform-wide statistics for the dashboard.
     */
    async getDashboardStats() {
        const { count: providersCount } = await supabase
            .from('providers')
            .select('*', { count: 'exact', head: true })

        const { count: servicesCount } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true })

        const { count: staffCount } = await supabase
            .from('staff')
            .select('*', { count: 'exact', head: true })

        const { count: apptsCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })

        return {
            totalProviders: providersCount || 0,
            totalServices: servicesCount || 0,
            totalStaff: staffCount || 0,
            totalAppointments: apptsCount || 0
        }
    },

    /**
     * Providers Management
     */
    async listProviders() {
        const { data, error } = await supabase
            .from('providers')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (error) throw error
        return data as Provider[]
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
            .select('*, providers(business_name)')
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
    }
}
