import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore'

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior(_to, _from, savedPosition) {
        if (savedPosition) {
            return savedPosition
        } else {
            return { top: 0 }
        }
    },
    routes: [
        {
            path: '/',
            name: 'Landing',
            component: () => import('../views/LandingView.vue')
        },
        {
            path: '/terms',
            name: 'TermsOfService',
            component: () => import('../views/TermsOfServiceView.vue')
        },
        {
            path: '/privacy',
            name: 'PrivacyPolicy',
            component: () => import('../views/PrivacyPolicyView.vue')
        },
        {
            path: '/for-business',
            name: 'ForBusiness',
            component: () => import('../views/ForBusinessView.vue')
        },
        {
            path: '/login',
            name: 'Login',
            component: () => import('../views/LoginView.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/auth/callback',
            name: 'AuthCallback',
            component: () => import('../views/AuthCallbackView.vue')
        },
        {
            path: '/booking',
            name: 'Booking',
            component: () => import('../views/BookingView.vue')
        },
        {
            path: '/profile',
            name: 'Profile',
            component: () => import('../views/ProfileCustomerView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/my-bookings',
            name: 'CustomerBookings',
            component: () => import('../views/CustomerBookingsView.vue'),
            meta: { requiresAuth: true }
        },
        // Provider routes
        {
            path: '/provider',
            redirect: '/provider/dashboard'
        },
        {
            path: '/provider/profile',
            name: 'ProviderProfile',
            component: () => import('../views/provider/ProfileProviderView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/provider/revenue-report',
            name: 'RevenueReport',
            component: () => import('../views/provider/RevenueReportView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/pricing',
            name: 'ProviderPricing',
            component: () => import('../views/provider/PricingView.vue'),
            meta: { requiresAuth: true }
        },

        {
            path: '/provider/subscription',
            name: 'ProviderSubscription',
            component: () => import('../views/provider/ProviderSubscriptionView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/dashboard',
            name: 'ProviderDashboard',
            component: () => import('../views/provider/ProviderDashboardView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/services',
            name: 'ProviderServices',
            component: () => import('../views/provider/ProviderServicesView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/staff',
            name: 'ProviderStaff',
            component: () => import('../views/provider/ProviderStaffView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/addresses',
            name: 'ProviderAddresses',
            component: () => import('../views/provider/ProviderAddressesView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/availability',
            name: 'ProviderAvailability',
            component: () => import('../views/provider/ProviderAvailabilityView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/provider/calendar',
            name: 'ProviderCalendar',
            component: () => import('../views/provider/ProviderCalendarView.vue'),
            meta: { requiresAuth: true, requiresProvider: true }
        },
        {
            path: '/admin',
            name: 'AdminLogin',
            component: () => import('../views/admin/AdminLoginView.vue'),
            meta: { requiresGuest: true }
        },
        // Super Admin routes
        {
            path: '/super-admin',
            component: () => import('../components/layouts/SuperAdminLayout.vue'),
            meta: { requiresAuth: true, requiresSuperAdmin: true },
            children: [
                {
                    path: '',
                    redirect: '/super-admin/dashboard'
                },
                {
                    path: 'dashboard',
                    name: 'SuperAdminDashboard',
                    component: () => import('../views/admin/SuperAdminDashboardView.vue')
                },
                {
                    path: 'providers',
                    name: 'SuperAdminProviders',
                    component: () => import('../views/admin/SuperAdminProvidersView.vue')
                },
                {
                    path: 'services',
                    name: 'SuperAdminServices',
                    component: () => import('../views/admin/SuperAdminServicesView.vue')
                },
                {
                    path: 'staff',
                    name: 'SuperAdminStaff',
                    component: () => import('../views/admin/SuperAdminStaffView.vue')
                },
                {
                    path: 'locals',
                    name: 'SuperAdminLocals',
                    component: () => import('../views/admin/SuperAdminLocalsView.vue')
                },
                {
                    path: 'ads',
                    name: 'SuperAdminAds',
                    component: () => import('../views/admin/SuperAdminAdsView.vue')
                }
            ]
        },
        {
            path: '/deactivated',
            name: 'Deactivated',
            component: () => import('../views/DeactivatedAccountView.vue'),
            meta: { requiresAuth: true }
        }
    ]
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()
    
    // Ensure auth is initialized before routing
    if (!authStore.isReady) {
        // You might want to wait for it, or rely on App.vue's loading state.
        // If we await here, it guarantees the guards have correct state.
        // Since main.ts calls initialize, this should be quick if already in progress.
        await authStore.initialize()
    }

    const role = authStore.userRole

    // Login page - redirect if already authenticated based on role
    if (to.meta.requiresGuest && authStore.isAuthenticated) {
        if (authStore.isSuperAdmin) {
            return next('/super-admin/dashboard')
        }
        if (role === 'provider') {
            return next('/provider/dashboard')
        }
        return next('/booking')
    }

    // Protected routes - require authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return next({
            path: '/login',
            query: { redirect: to.fullPath }
        })
    }

    // Provider routes - only for providers
    if (to.meta.requiresProvider) {
        if (!authStore.isAuthenticated) {
            return next({
                path: '/login',
                query: { redirect: to.fullPath }
            })
        }

        // Ensure provider profile is loaded
        if (!authStore.provider) {
            await authStore.fetchProviderProfile()
        }

        // If no provider profile exists after fetching, redirect to login with provider context
        if (!authStore.provider) {
            return next({
                path: '/login',
                query: { redirect: '/provider' }
            })
        }
    }

    // Profile completion check (only for customers, not providers)
    if (authStore.isAuthenticated && !authStore.provider && !authStore.isSuperAdmin && to.path !== '/profile' && to.path !== '/provider/profile') {
        // Check if profile is incomplete
        if (authStore.profile && (!authStore.profile.name || !authStore.profile.phone)) {
            // Skip for auth callback, admin routes, provider routes, or booking route (they handle their own flow)
            if (to.path === '/auth/callback' || to.path.startsWith('/admin') || to.path.startsWith('/provider') || to.path.startsWith('/super-admin') || to.path === '/booking') {
                return next()
            }
            return next({ path: '/profile', query: { redirect: to.fullPath } })
        }
    }

    // Super Admin check - block non-admins from admin routes
    if (to.meta.requiresSuperAdmin && !authStore.isSuperAdmin) {
        // If they just tried to log in through the admin portal, boot them out entirely
        if (to.path.startsWith('/super-admin') && (_from.path === '/admin' || _from.path === '/auth/callback')) {
            await authStore.signOut()
            return next('/admin?error=not_admin')
        }
        return next('/')
    }

    // Super Admin containment - admins can ONLY access admin routes
    if (authStore.isAuthenticated && authStore.isSuperAdmin) {
        const isAdminRoute = to.path.startsWith('/super-admin') || to.path.startsWith('/admin') || to.path === '/auth/callback'
        if (!isAdminRoute) {
            return next('/super-admin/dashboard')
        }
    }

    // Deactivated Account Check (for providers)
    if (authStore.provider && !authStore.provider.active && to.path !== '/deactivated') {
        // Only block if trying to access provider dashboard
        if (to.path.startsWith('/provider')) {
            return next('/deactivated')
        }
    }

    next()
})

export default router
