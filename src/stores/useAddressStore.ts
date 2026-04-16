import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as addressService from '../services/addressService'
import type { ProviderAddress } from '../types'

export const useAddressStore = defineStore('address', () => {
    const addresses = ref<ProviderAddress[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchAddresses(providerId: string) {
        loading.value = true
        error.value = null
        try {
            const data = await addressService.fetchAddresses(providerId)
            addresses.value = data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch addresses'
            console.error('Error fetching addresses:', e)
        } finally {
            loading.value = false
        }
    }

    async function createAddress(params: {
        address: Omit<ProviderAddress, 'id' | 'created_at' | 'updated_at'>,
        photoFile?: File | null,
        authUserId: string
    }) {
        loading.value = true
        error.value = null
        try {
            const data = await addressService.createAddress(params)
            if (data) {
                addresses.value.push(data)
            }
            return data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to create address'
            console.error('Error creating address:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function updateAddress(params: {
        id: string,
        updates: Partial<ProviderAddress>,
        photoFile?: File | null,
        authUserId: string,
        existingPhotoPath?: string | null
    }) {
        loading.value = true
        error.value = null
        try {
            const data = await addressService.updateAddress(params)
            if (data) {
                const index = addresses.value.findIndex(a => a.id === params.id)
                if (index !== -1) {
                    addresses.value[index] = data
                }
            }
            return data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to update address'
            console.error('Error updating address:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function deleteAddress(id: string) {
        loading.value = true
        error.value = null
        try {
            await addressService.deleteAddress(id)
            addresses.value = addresses.value.filter(a => a.id !== id)
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to delete address'
            console.error('Error deleting address:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function setPrimaryAddress(id: string, providerId: string) {
        loading.value = true
        error.value = null
        try {
            const data = await addressService.setPrimaryAddress(id, providerId)
            // Refresh the list to reflect primary status changes across all items
            await fetchAddresses(providerId)
            return data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to set primary address'
            console.error('Error setting primary address:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    return {
        addresses,
        loading,
        error,
        fetchAddresses,
        createAddress,
        updateAddress,
        deleteAddress,
        setPrimaryAddress
    }
})
