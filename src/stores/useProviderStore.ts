import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { Provider } from '../types'
import * as providerService from '../services/providerService'

export const useProviderStore = defineStore('provider', () => {
    const provider = ref<Provider | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Dashboard stats
    const stats = ref({
        todayAppointments: 0,
        weekAppointments: 0,
        monthAppointments: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        revenueCurrency: '',
        activeLocations: 0,
        activeServices: 0,
        totalStaff: 0
    })

    const isApproved = computed(() => provider.value?.status === 'approved')
    const isPending = computed(() => provider.value?.status === 'pending')

    async function fetchProvider(authUserId: string) {
        loading.value = true
        error.value = null
        try {
            const { data, error: fetchError } = await supabase
                .from('providers')
                .select('*')
                .eq('auth_user_id', authUserId)
                .single()

            if (fetchError) throw fetchError
            provider.value = data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch provider'
            console.error('Error fetching provider:', e)
        } finally {
            loading.value = false
        }
    }

    async function fetchDashboardStats(providerId: string) {
        if (!providerId) return

        loading.value = true
        try {
            const statsData = await providerService.fetchDashboardStats(providerId)
            stats.value = statsData
        } catch (e) {
            console.error('Error fetching dashboard stats:', e)
        } finally {
            loading.value = false
        }
    }

    async function updateProvider(providerId: string, updates: Partial<Provider>) {
        loading.value = true
        error.value = null
        try {
            const { data, error: updateError } = await supabase
                .from('providers')
                .update(updates)
                .eq('id', providerId)
                .select()
                .single()

            if (updateError) throw updateError
            provider.value = data
            return data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to update provider'
            console.error('Error updating provider:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    return {
        provider,
        loading,
        error,
        stats,
        isApproved,
        isPending,
        fetchProvider,
        fetchDashboardStats,
        updateProvider
    }
})
