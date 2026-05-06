import { supabase } from '../lib/supabase'
import type { Availability, BlockedDate, BlockedDateException } from '../types'

export async function fetchAvailability(staffId: string): Promise<Availability[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('staff_id', staffId)
    .order('day_of_week')

  if (error) throw error
  return data || []
}

export async function upsertAvailability(availabilities: Partial<Availability>[], onConflict?: string): Promise<Availability[]> {
  // Supabase upsert supports an onConflict option to avoid duplication.
  const { data, error } = await supabase
    .from('availability')
    .upsert(availabilities, onConflict ? { onConflict } : undefined)
    .select()

  if (error) throw error
  return data || []
}

export async function fetchBlockedDates(staffId: string, fromDate?: string): Promise<BlockedDate[]> {
  const cutoff = fromDate ?? new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('staff_id', staffId)
    .gte('end_date', cutoff)
    .order('start_date')

  if (error) throw error
  return data || []
}

export async function createBlockedDate(blockedDate: Omit<BlockedDate, 'id' | 'created_at'>): Promise<BlockedDate> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .insert([blockedDate])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBlockedDate(id: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function fetchBlockedDateExceptions(blockedDateIds: string[]): Promise<BlockedDateException[]> {
  if (blockedDateIds.length === 0) return []

  const { data, error } = await supabase
    .from('blocked_date_exceptions')
    .select('*')
    .in('blocked_date_id', blockedDateIds)

  if (error) throw error
  return data || []
}

export async function createBlockedDateException(
  exception: Omit<BlockedDateException, 'id' | 'created_at'>
): Promise<BlockedDateException> {
  const { data, error } = await supabase
    .from('blocked_date_exceptions')
    .upsert([exception], { onConflict: 'blocked_date_id,exception_date,type' })
    .select()
    .single()

  if (error) throw error
  return data
}
