import { defineStore } from 'pinia'
import { ref } from 'vue'
import { superAdminService } from '../services/superAdminService'
import type { Provider, Service, Staff, ProviderAddress, Ad } from '../types'
import { useAuthStore } from './useAuthStore'

export const useSuperAdminStore = defineStore('superAdmin', () => {
    const authStore = useAuthStore()

    const stats = ref<{
        totalProviders: number
        totalServices: number
        totalStaff: number
        totalAppointments: number
    } | null>(null)

    const providers = ref<(Provider & { profiles: { email: string, phone: string } })[]>([])
    const services = ref<(Service & { providers: { business_name: string } })[]>([])
    const staff = ref<(Staff & { providers: { business_name: string } })[]>([])
    const locals = ref<(ProviderAddress & { providers: { business_name: string } })[]>([])
    const ads = ref<Ad[]>([])

    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchAds() {
        loading.value = true
        error.value = null
        try {
            ads.value = await superAdminService.listAllAds()
        } catch (e: any) {
            error.value = e?.message || 'Failed to fetch ads'
        } finally {
            loading.value = false
        }
    }

    async function saveAd(adData: Partial<Ad>, imageFile?: File) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            if (adData.id) {
                await superAdminService.updateAd(authStore.superAdmin.id, adData.id, adData, imageFile)
            } else {
                await superAdminService.createAd(authStore.superAdmin.id, adData, imageFile)
            }
            await fetchAds()
        } catch (e: any) {
            error.value = e?.message || 'Failed to save ad'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function removeAd(ad: Ad) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            await superAdminService.deleteAd(authStore.superAdmin.id, ad)
            await fetchAds()
        } catch (e: any) {
            error.value = e?.message || 'Failed to delete ad'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function toggleAdActive(ad: Ad, is_active: boolean) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            await superAdminService.updateAd(authStore.superAdmin.id, ad.id, { is_active })
            await fetchAds()
        } catch (e: any) {
            error.value = e?.message || 'Failed to update ad status'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function fetchStats() {
        loading.value = true
        error.value = null
        try {
            stats.value = await superAdminService.getDashboardStats()
        } catch (e: any) {
            error.value = e?.message || 'Failed to fetch stats'
        } finally {
            loading.value = false
        }
    }

    async function fetchProviders() {
        loading.value = true
        error.value = null
        try {
            providers.value = await superAdminService.listProviders()
        } catch (e: any) {
            error.value = e?.message || 'Failed to fetch providers'
        } finally {
            loading.value = false
        }
    }

    async function fetchServices() {
        loading.value = true
        error.value = null
        try {
            services.value = await superAdminService.listServices()
        } catch (e: any) {
            error.value = e?.message || 'Failed to fetch services'
        } finally {
            loading.value = false
        }
    }

    async function fetchStaff() {
        loading.value = true
        error.value = null
        try {
            staff.value = await superAdminService.listStaff()
        } catch (e: any) {
            error.value = e?.message || 'Failed to fetch staff'
        } finally {
            loading.value = false
        }
    }

    async function fetchLocals() {
        loading.value = true
        error.value = null
        try {
            locals.value = await superAdminService.listLocals()
        } catch (e: any) {
            error.value = e?.message || 'Failed to fetch locals'
        } finally {
            loading.value = false
        }
    }

    async function toggleProviderActive(providerId: string, active: boolean, reason?: string) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            await superAdminService.updateProviderStatus(authStore.superAdmin.id, providerId, {
                active,
                status: active ? 'approved' : 'suspended',
                deactivation_reason: reason
            })
            await fetchProviders()
        } catch (e: any) {
            error.value = e?.message || 'Failed to update provider status'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function toggleServiceActive(serviceId: string, active: boolean, reason?: string) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            await superAdminService.updateServiceStatus(authStore.superAdmin.id, serviceId, active, reason)
            await fetchServices()
        } catch (e: any) {
            error.value = e?.message || 'Failed to update service status'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function toggleStaffActive(staffId: string, active: boolean, reason?: string) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            await superAdminService.updateStaffStatus(authStore.superAdmin.id, staffId, active, reason)
            await fetchStaff()
        } catch (e: any) {
            error.value = e?.message || 'Failed to update staff status'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function toggleLocalActive(localId: string, active: boolean, reason?: string) {
        if (!authStore.superAdmin) return

        loading.value = true
        error.value = null
        try {
            await superAdminService.updateLocalStatus(authStore.superAdmin.id, localId, active, reason)
            await fetchLocals()
        } catch (e: any) {
            error.value = e?.message || 'Failed to update local status'
            throw e
        } finally {
            loading.value = false
        }
    }

    return {
        stats,
        providers,
        services,
        staff,
        locals,
        ads,
        loading,
        error,
        fetchStats,
        fetchProviders,
        fetchServices,
        fetchStaff,
        fetchLocals,
        fetchAds,
        toggleProviderActive,
        toggleServiceActive,
        toggleStaffActive,
        toggleLocalActive,
        saveAd,
        removeAd,
        toggleAdActive
    }
})
