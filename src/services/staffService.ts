import { supabase } from '../lib/supabase'
import type { Staff } from '../types'
import { canAddStaff } from './subscriptionService'

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

export async function createStaff(staff: Omit<Staff, 'id' | 'created_at' | 'updated_at'>) {
    if (!staff.provider_id) throw new Error('Provider ID is required');
    const limitCheck = await canAddStaff(staff.provider_id)
    if (!limitCheck.allowed && staff.active !== false) {
      throw new Error(limitCheck.message || 'Staff limit reached for your plan.')
    }

    const { data, error } = await supabase
        .from('staff')
        .insert([staff])
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateStaff(id: string, updates: Partial<Staff>) {
    const { data, error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteStaff(id: string) {
    const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id)

    if (error) throw error
}
