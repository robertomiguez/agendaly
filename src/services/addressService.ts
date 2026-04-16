import { supabase } from '../lib/supabase'
import type { ProviderAddress } from '../types'
import { canAddLocation } from './subscriptionService'
import { uploadImage, deleteImage } from '../lib/storage'

const BUCKET = 'address-photos'

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

export async function createAddress({
    address,
    photoFile,
    authUserId
}: {
    address: Omit<ProviderAddress, 'id' | 'created_at' | 'updated_at'>,
    photoFile?: File | null,
    authUserId: string
}): Promise<ProviderAddress> {
  const limitCheck = await canAddLocation(address.provider_id)
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message || 'Location limit reached for your plan.')
  }

  let photo_url = null
  let photo_path = null

  if (photoFile) {
    const uploaded = await uploadImage(BUCKET, authUserId, photoFile)
    photo_url = uploaded.url
    photo_path = uploaded.path
  }

  const { data, error } = await supabase
    .from('provider_addresses')
    .insert([{
        ...address,
        photo_url,
        photo_path
    }])
    .select()
    .single()

  if (error) {
    if (photo_path) await deleteImage(BUCKET, photo_path)
    throw error
  }
  return data
}

export async function updateAddress({
    id,
    updates,
    photoFile,
    authUserId,
    existingPhotoPath
}: {
    id: string,
    updates: Partial<ProviderAddress>,
    photoFile?: File | null,
    authUserId: string,
    existingPhotoPath?: string | null
}): Promise<ProviderAddress> {
  let photo_url = updates.photo_url
  let photo_path = updates.photo_path

  if (photoFile) {
    if (existingPhotoPath) {
      await deleteImage(BUCKET, existingPhotoPath)
    }
    const uploaded = await uploadImage(BUCKET, authUserId, photoFile)
    photo_url = uploaded.url
    photo_path = uploaded.path
  } else if (photoFile === null && existingPhotoPath) {
    await deleteImage(BUCKET, existingPhotoPath)
    photo_url = null
    photo_path = null
  }

  const { data, error } = await supabase
    .from('provider_addresses')
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

export async function deleteAddress(id: string): Promise<void> {
  const { data: address } = await supabase
    .from('provider_addresses')
    .select('photo_path')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('provider_addresses')
    .delete()
    .eq('id', id)

  if (error) throw error

  if (address?.photo_path) {
    await deleteImage(BUCKET, address.photo_path)
  }
}

export async function setPrimaryAddress(id: string, providerId: string): Promise<ProviderAddress> {
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
