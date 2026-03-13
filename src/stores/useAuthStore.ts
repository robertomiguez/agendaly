import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { Customer, Provider, UserRole } from '../types'

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const session = ref<Session | null>(null)
    const customer = ref<Customer | null>(null)
    const provider = ref<Provider | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isReady = ref(false)
    let _ensureProfilePromise: Promise<void> | null = null

    const isAuthenticated = computed(() => !!user.value)

    // Compute user role based on provider and staff status
    const userRole = computed<UserRole>(() => {
        if (!user.value) return 'customer'

        // Check if user has a provider profile
        if (provider.value) {
            return 'provider'
        }

        // Default to customer
        return 'customer'
    })

    const isProvider = computed(() => userRole.value === 'provider')
    const isAdmin = computed(() => userRole.value === 'admin')

    async function initialize() {
        loading.value = true
        try {
            // Get current session
            const { data: { session: currentSession } } = await supabase.auth.getSession()

            if (currentSession) {
                session.value = currentSession
                user.value = currentSession.user
                
                // IMPORTANT: Fetch provider profile FIRST to establish context
                await fetchProviderProfile()
                // Only fetch/create customer profile if not a provider (or if it's a dual account)
                await fetchCustomerProfile()
            }

            // Listen for auth changes
            supabase.auth.onAuthStateChange(async (_event, newSession) => {
                // If we have a user, set loading to true while we fetch profiles
                if (newSession?.user) {
                    loading.value = true
                }

                session.value = newSession
                user.value = newSession?.user ?? null

                if (newSession?.user) {
                    try {
                        // IMPORTANT: Fetch provider profile FIRST to establish context
                        await fetchProviderProfile()
                        
                        // Wait for provider check to complete before checking customer
                        await fetchCustomerProfile()
                    } finally {
                        loading.value = false
                    }
                } else {
                    customer.value = null
                    provider.value = null
                    loading.value = false
                }
            })
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to initialize auth'
            console.error('Error initializing auth:', e)
        } finally {
            loading.value = false
            isReady.value = true
        }
    }

    async function fetchCustomerProfile() {
        if (!user.value) return

        try {
            // First try to find by auth_user_id
            const { data, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('auth_user_id', user.value.id)
                .maybeSingle()

            if (fetchError) {
                throw fetchError
            }

            if (data) {
                customer.value = data
                return
            }

            // If no profile found by ID, check if we can claim one by email
            // This happens when a user previously signed up with OTP/Email and now signs in with Google
            if (user.value.email) {
                await ensureCustomerProfile()
            } else {
                 customer.value = null
            }

        } catch (e) {
            console.error('Error fetching customer profile:', e)
        }
    }

    async function ensureCustomerProfile(initialData?: { name?: string; phone?: string }) {
        // Deduplication: if already running, share the same promise
        if (_ensureProfilePromise) {
            return _ensureProfilePromise
        }

        _ensureProfilePromise = _doEnsureCustomerProfile(initialData)
        try {
            await _ensureProfilePromise
        } finally {
            _ensureProfilePromise = null
        }
    }

    async function _doEnsureCustomerProfile(initialData?: { name?: string; phone?: string }) {
        if (!user.value?.email) return

        // GUARD: If this user is ALREADY identified as a provider, do NOT create a customer profile automatically.
        if (provider.value) {
            return
        }

        // GUARD: Check URL for provider context (redirects, paths) to prevent creation during provider signup
        // This handles the case where provider.value is not yet set (e.g. first login) but the INTENT is provider
        const isProviderFlow = 
            window.location.search.includes('redirect=%2Fprovider') || 
            window.location.search.includes('redirect=/provider') || 
            window.location.pathname.startsWith('/provider')
            
        if (isProviderFlow) {
            return
        }

        try {
            // Check for existing customer with same email but different/no auth_user_id
            // This handles the case where a user previously signed up with OTP and now signs in with Google
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('*')
                .eq('email', user.value.email)
                .maybeSingle()
            
            if (existingCustomer) {
                // Claim this profile by linking it to the current auth user
                const { data: updatedCustomer, error: updateError } = await supabase
                    .from('customers')
                    .update({ 
                        auth_user_id: user.value.id,
                        avatar_url: existingCustomer.avatar_url || user.value.user_metadata?.avatar_url || user.value.user_metadata?.picture
                    })
                    .eq('id', existingCustomer.id)
                    .select()
                    .single()
                
                if (updateError) throw updateError
                customer.value = updatedCustomer
            } else {
                // No profile found by email or auth_user_id — create a new one
                // createCustomerProfile has its own guard against duplicates
                await createCustomerProfile(initialData)
            }

        } catch (e) {
            console.error('Error ensuring customer profile:', e)
        }
    }

    async function createCustomerProfile(initialData?: { name?: string; phone?: string }) {
        if (!user.value) return

        try {
            // Check if profile already exists for this auth user
            const { data: existing } = await supabase
                .from('customers')
                .select('*')
                .eq('auth_user_id', user.value.id)
                .maybeSingle()

            if (existing) {
                customer.value = existing
                return
            }

            // No existing profile — create one
            const { data, error: insertError } = await supabase
                .from('customers')
                .insert({
                    auth_user_id: user.value.id,
                    email: user.value.email!,
                    name: initialData?.name || user.value.user_metadata?.name || user.value.user_metadata?.full_name,
                    phone: initialData?.phone,
                    avatar_url: user.value.user_metadata?.avatar_url || user.value.user_metadata?.picture
                })
                .select()
                .single()

            if (insertError) {
                // Handle race condition: another call created the profile between our check and insert
                if (insertError.code === '23505') {
                    const { data: raceExisting } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('auth_user_id', user.value.id)
                        .maybeSingle()
                    if (raceExisting) customer.value = raceExisting
                    return
                }
                throw insertError
            }

            customer.value = data
        } catch (e) {
            console.error('Error creating customer profile:', e)
        }
    }

    async function fetchProviderProfile() {
        if (!user.value) {
            return
        }

        try {
            // First try to find by auth_user_id
            const { data, error: fetchError } = await supabase
                .from('providers')
                .select('*')
                .eq('auth_user_id', user.value.id)
                .maybeSingle()

            if (fetchError) {
                throw fetchError
            }

            if (data) {
                provider.value = data
                return
            }

            // If no profile found by ID, check if we can claim one by email
            // This happens when a user previously signed up with OTP/Email and now signs in with Google
            if (user.value.email) {
                const { data: existingProvider } = await supabase
                    .from('providers')
                    .select('*')
                    .eq('email', user.value.email)
                    .maybeSingle()

                if (existingProvider) {
                    // Claim this provider profile by updating auth_user_id
                    const { data: updatedProvider, error: updateError } = await supabase
                        .from('providers')
                        .update({ auth_user_id: user.value.id })
                        .eq('id', existingProvider.id)
                        .select()
                        .single()

                    if (updateError) {
                        console.error('[AuthStore] Error updating provider auth_user_id:', updateError)
                        throw updateError
                    }
                    provider.value = updatedProvider
                } else {
                    provider.value = null
                }
            } else {
                provider.value = null
            }
        } catch (e) {
            console.error('Error fetching provider profile:', e)
            provider.value = null
        }
    }

    async function sendOtpCode(email: string) {
        loading.value = true
        error.value = null
        try {
            const { error: signInError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true
                }
            })

            if (signInError) throw signInError

            // Success - OTP sent
            return { success: true }
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to send verification code'
            console.error('Error sending OTP:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function signInWithOAuth(redirectTo?: string) {
        loading.value = true
        error.value = null
        try {
            // Build callback URL with optional redirect parameter
            let callbackUrl = `${window.location.origin}/auth/callback`
            if (redirectTo) {
                callbackUrl += `?redirect=${encodeURIComponent(redirectTo)}`
            }

            const { error: signInError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: callbackUrl,
                }
            })

            if (signInError) throw signInError
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to sign in with Google'
            console.error('Error signing in with Google:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function verifyOtpCode(email: string, token: string) {
        loading.value = true
        error.value = null
        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'email'
            })

            if (verifyError) throw verifyError

            if (data.user) {
                user.value = data.user
                session.value = data.session
                // Fetch provider first to establish context
                await fetchProviderProfile()
                await fetchCustomerProfile()
            }

            return { success: true }
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Invalid verification code'
            console.error('Error verifying OTP:', e)
            throw e
        } finally {
            loading.value = false
        }
    }
    async function signOut() {
        loading.value = true
        error.value = null
        try {
            const { error: signOutError } = await supabase.auth.signOut()
            if (signOutError) throw signOutError

            user.value = null
            session.value = null
            customer.value = null
            provider.value = null
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to sign out'
            console.error('Error signing out:', e)
            throw e
        } finally {
            loading.value = false
        }
    }
    async function updateProfile(updates: Partial<Customer>) {
        if (!customer.value) return

        loading.value = true
        error.value = null
        try {
            const { data, error: updateError } = await supabase
                .from('customers')
                .update(updates)
                .eq('id', customer.value.id)
                .select()
                .single()

            if (updateError) throw updateError
            customer.value = data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to update profile'
            console.error('Error updating profile:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    return {
        user,
        session,
        customer,
        provider,
        loading,
        error,
        isAuthenticated,
        userRole,
        isProvider,
        isAdmin,
        initialize,
        sendOtpCode,
        verifyOtpCode,
        signOut,
        updateProfile,
        fetchCustomerProfile,
        fetchProviderProfile,
        createCustomerProfile,
        ensureCustomerProfile,
        isReady,
        signInWithOAuth
    }
})
