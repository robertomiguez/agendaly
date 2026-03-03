import { supabase } from '../lib/supabase'
import type { ProviderAddress } from '../types'
import { canAddLocation } from './subscriptionService'

export async function fetchAddresses(providerId: string): Promise<ProviderAddress[]> {
  const { data, error } = await supabase
    .from('provider_addresses')
    .select('*')
    .eq('provider_id', providerId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createAddress(address: Omit<ProviderAddress, 'id' | 'created_at' | 'updated_at'>): Promise<ProviderAddress> {
  const limitCheck = await canAddLocation(address.provider_id)
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message || 'Location limit reached for your plan.')
  }

  const { data, error } = await supabase
    .from('provider_addresses')
    .insert([address])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAddress(id: string, updates: Partial<ProviderAddress>): Promise<ProviderAddress> {
  const { data, error } = await supabase
    .from('provider_addresses')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase
    .from('provider_addresses')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function setPrimaryAddress(id: string, providerId: string): Promise<ProviderAddress> {
  // Quick fix: ensure we check for errors on the unset step before continuing.
  // Prefer: implement a DB-side function (RPC) to make this atomic.
  const { error: unsetError } = await supabase
    .from('provider_addresses')
    .update({ is_primary: false })
    .eq('provider_id', providerId)

  if (unsetError) throw unsetError

  const { data, error } = await supabase
    .from('provider_addresses')
    .update({ is_primary: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
