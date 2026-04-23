import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { Customer, Provider, UserRole, SuperAdmin, Profile } from '../types'

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const session = ref<Session | null>(null)
    const profile = ref<Profile | null>(null)
    const customer = ref<Customer | null>(null)
    const provider = ref<Provider | null>(null)
    const superAdmin = ref<SuperAdmin | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isReady = ref(false)
    let _ensureProfilePromise: Promise<void> | null = null
    let _initPromise: Promise<void> | null = null
    let _loadingTimeout: ReturnType<typeof setTimeout> | null = null

    function startLoadingSafety() {
        clearLoadingSafety()
        _loadingTimeout = setTimeout(() => {
            if (loading.value) {
                console.warn('[AuthStore] Loading safety timeout — force-resetting loading state')
                loading.value = false
            }
        }, 10000)
    }

    function clearLoadingSafety() {
        if (_loadingTimeout) {
            clearTimeout(_loadingTimeout)
            _loadingTimeout = null
        }
    }

    const isAuthenticated = computed(() => !!user.value)

    const userRole = computed<UserRole>(() => {
        if (!user.value) return 'customer'
        if (provider.value) return 'provider'
        return 'customer'
    })

    const isProvider = computed(() => userRole.value === 'provider')
    const isSuperAdmin = computed(() => !!superAdmin.value)
    const isAdmin = computed(() => userRole.value === 'admin')

    async function initialize() {
        if (_initPromise) return _initPromise
        _initPromise = _performInitialize()
        return _initPromise
    }

    async function _performInitialize() {
        loading.value = true
        startLoadingSafety()
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession()

            if (currentSession) {
                session.value = currentSession
                user.value = currentSession.user
                
                await fetchCoreData()
            }

            supabase.auth.onAuthStateChange(async (event, newSession) => {
                session.value = newSession
                user.value = newSession?.user ?? null

                if (event === 'TOKEN_REFRESHED') {
                    return
                }

                if (newSession?.user) {
                    loading.value = true
                    startLoadingSafety()
                    try {
                        await fetchCoreData()
                    } finally {
                        clearLoadingSafety()
                        loading.value = false
                    }

                    if (user.value) {
                        supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
                            if (freshSession) {
                                session.value = freshSession
                                user.value = freshSession.user
                            } else if (session.value) {
                                resetAll()
                            }
                        }).catch((e) => {
                            console.error('[AuthStore] Error refreshing session on visibility change:', e)
                        })
                    }
                }
            })

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    if (loading.value) {
                        console.warn('[AuthStore] Resetting stuck loading state on tab focus')
                        clearLoadingSafety()
                        loading.value = false
                    }

                    if (user.value) {
                        supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
                            if (freshSession) {
                                session.value = freshSession
                                user.value = freshSession.user
                            } else if (session.value) {
                                session.value = null
                                user.value = null
                                profile.value = null
                                customer.value = null
                                provider.value = null
                                superAdmin.value = null
                            }
                        }).catch((e) => {
                            console.error('[AuthStore] Error refreshing session on visibility change:', e)
                        })
                    }
                }
            })
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to initialize auth'
            console.error('Error initializing auth:', e)
        } finally {
            clearLoadingSafety()
            loading.value = false
            isReady.value = true
        }
    }

    async function fetchCoreData() {
        const requestId = ++_coreRequestId

        await fetchProfile()
        if (requestId !== _coreRequestId) return

        if (profile.value) {
            await fetchSuperAdminProfile()
            if (requestId !== _coreRequestId) return

            await fetchProviderProfile()
            if (requestId !== _coreRequestId) return

            await fetchCustomerProfile()
        } else if (user.value) {
            // Edge case: logged in but no profile. Let's ensure one exists based on email.
            if (user.value.email) {
                await ensureProfileAndCustomer()
                if (requestId !== _coreRequestId) return

                // After creating the profile, fetch all role records
                if (profile.value) {
                    await fetchSuperAdminProfile()
                    if (requestId !== _coreRequestId) return

                    await fetchProviderProfile()
                    if (requestId !== _coreRequestId) return

                    await fetchCustomerProfile()
                }
            }
        }
    }

    async function fetchProfile() {
        if (!user.value) return
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('auth_user_id', user.value.id)
                .maybeSingle()

            if (fetchError) throw fetchError
            profile.value = data
        } catch (e) {
            console.error('Error fetching profile:', e)
        }
    }

    async function fetchCustomerProfile() {
        if (!profile.value) return
        try {
            const { data, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('profile_id', profile.value.id)
                .maybeSingle()

            if (fetchError) throw fetchError
            if (data) {
                customer.value = data
            }
        } catch (e) {
            console.error('Error fetching customer profile:', e)
        }
    }

    async function fetchSuperAdminProfile() {
        if (!profile.value) return
        try {
            const { data, error: fetchError } = await supabase
                .from('super_admins')
                .select('*')
                .eq('profile_id', profile.value.id)
                .maybeSingle()

            if (fetchError) throw fetchError
            superAdmin.value = data || null
        } catch (e) {
            console.error('Error fetching super admin profile:', e)
            superAdmin.value = null
        }
    }

    async function fetchProviderProfile() {
        if (!profile.value) return
        try {
            const { data, error: fetchError } = await supabase
                .from('providers')
                .select('*')
                .eq('profile_id', profile.value.id)
                .maybeSingle()

            if (fetchError) throw fetchError
            if (data) {
                provider.value = data
            } else {
                provider.value = null
            }
        } catch (e) {
            console.error('Error fetching provider profile:', e)
            provider.value = null
        }
    }

    async function ensureProfileAndCustomer(initialData?: { name?: string; phone?: string }) {
        if (_ensureProfilePromise) return _ensureProfilePromise

        _ensureProfilePromise = _doEnsureProfileAndCustomer(initialData)
        try {
            await _ensureProfilePromise
        } finally {
            _ensureProfilePromise = null
        }
    }

    async function _doEnsureProfileAndCustomer(initialData?: { name?: string; phone?: string }) {
        if (!user.value?.email) return
        if (superAdmin.value) return

        const storedRedirect = localStorage.getItem('authRedirect') || ''

        const isProviderFlow = 
            window.location.search.includes('redirect=%2Fprovider') || 
            window.location.search.includes('redirect=/provider') || 
            window.location.pathname.startsWith('/provider') ||
            storedRedirect === '/provider' ||
            storedRedirect.startsWith('/provider/')

        const isAdminFlow =
            window.location.pathname.startsWith('/admin') ||
            window.location.pathname.startsWith('/super-admin') ||
            window.location.search.includes('redirect=%2Fsuper-admin') ||
            window.location.search.includes('redirect=/super-admin') ||
            storedRedirect.startsWith('/super-admin')

        try {
            // Ensure profile exists
            if (!profile.value) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        auth_user_id: user.value.id,
                        email: user.value.email,
                        name: initialData?.name || user.value.user_metadata?.name || user.value.user_metadata?.full_name,
                        phone: initialData?.phone,
                        avatar_url: user.value.user_metadata?.avatar_url || user.value.user_metadata?.picture
                    }, { onConflict: 'auth_user_id' })
                    .select()
                    .single()
                    
                if (profileError) throw profileError
                profile.value = profileData
            }

            // Ensure customer exists ONLY if not provider/admin flow
            if (!isProviderFlow && !isAdminFlow) {
                if (profile.value && !customer.value) {
                    const { data: customerData, error: customerError } = await supabase
                        .from('customers')
                        .upsert({ profile_id: profile.value.id }, { onConflict: 'profile_id' })
                        .select()
                        .single()

                    if (customerError && customerError.code !== '23505') throw customerError
                    if (customerData) customer.value = customerData
                }
            }

        } catch (e) {
            console.error('Error ensuring profile and customer:', e)
        }
    }

    async function sendOtpCode(email: string) {
        loading.value = true
        error.value = null
        try {
            const { error: signInError } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true }
            })
            if (signInError) throw signInError
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
            let callbackUrl = `${window.location.origin}/auth/callback`
            if (redirectTo) {
                callbackUrl += `?redirect=${encodeURIComponent(redirectTo)}`
                localStorage.setItem('authRedirect', redirectTo)
            } else {
                localStorage.removeItem('authRedirect')
            }

            const { error: signInError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: callbackUrl }
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
                await fetchCoreData()
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

            resetAll()
            localStorage.removeItem('authRedirect')
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to sign out'
            console.error('Error signing out:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function updateProfile(updates: Partial<Profile>) {
        if (!profile.value) return

        loading.value = true
        error.value = null
        try {
            const { data, error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', profile.value.id)
                .select()
                .single()

            if (updateError) throw updateError
            profile.value = data
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
        profile,
        customer,
        provider,
        superAdmin,
        loading,
        error,
        isReady,
        isAuthenticated,
        userRole,
        isProvider,
        isAdmin,
        isSuperAdmin,
        initialize,
        sendOtpCode,
        verifyOtpCode,
        signInWithOAuth,
        signOut,
        updateProfile,
        fetchProfile,
        fetchCustomerProfile,
        fetchProviderProfile,
        fetchSuperAdminProfile,
        ensureProfileAndCustomer
    }
})
