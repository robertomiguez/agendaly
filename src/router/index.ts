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
            path: '/provider/checkout/success',
            name: 'CheckoutSuccess',
            component: () => import('../views/provider/CheckoutSuccessView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/provider/checkout/cancel',
            name: 'CheckoutCancel',
            component: () => import('../views/provider/CheckoutCancelView.vue'),
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
        // Admin routes
        {
            path: '/admin',
            name: 'Admin',
            redirect: '/admin/calendar'
        },
        {
            path: '/admin/calendar',
            name: 'Calendar',
            component: () => import('../views/CalendarView.vue')
        },
        {
            path: '/admin/services',
            name: 'Services',
            component: () => import('../views/ServicesView.vue')
        },
        {
            path: '/admin/availability',
            name: 'Availability',
            component: () => import('../views/AvailabilityView.vue')
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
    if (authStore.isAuthenticated && !authStore.provider && to.path !== '/profile' && to.path !== '/provider/profile') {
        // Check if customer profile is incomplete
        if (authStore.customer && (!authStore.customer.name || !authStore.customer.phone)) {
            // Skip for admin routes, provider routes, or booking route (booking handles its own flow)
            if (to.path.startsWith('/admin') || to.path.startsWith('/provider') || to.path === '/booking') {
                return next()
            }
            return next({ path: '/profile', query: { redirect: to.fullPath } })
        }
    }

    next()
})

export default router
