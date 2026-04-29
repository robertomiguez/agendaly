import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LandingView from '../LandingView.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { supabase } from '@/lib/supabase'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({ data: [] })),
                    data: []
                })),
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: [] }))
                    }))
                }))
            }))
        })),
        rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }
}))

// Mock images
vi.mock('@/assets/images/hero_background_manicure_1765115664380.png', () => ({ default: '/img/manicure.png' }))
vi.mock('@/assets/images/hero_barber_service_1765116285430.png', () => ({ default: '/img/barber.png' }))
vi.mock('@/assets/images/hero_massage_service_1765116300777.png', () => ({ default: '/img/massage.png' }))
vi.mock('@/assets/images/hero_spa_service_1765116318055.png', () => ({ default: '/img/spa.png' }))

// Mock common components to avoid rendering issues
vi.mock('@/components/SearchBar.vue', () => ({ default: { template: '<div>Search Bar</div>' } }))
vi.mock('@/components/CategoryPills.vue', () => ({ default: { template: '<div>Category Pills</div>' } }))
vi.mock('@/components/ProviderCard.vue', () => ({ default: { template: '<div>Provider Card</div>' } }))
vi.mock('@/services/geo', () => ({
    detectCountryCode: vi.fn(() => Promise.resolve('BR'))
}))

// Mock useLocation
import { ref } from 'vue'
vi.mock('@/composables/useLocation', () => ({
    useLocation: () => ({
        location: ref('Test City, TC'),
        city: ref('Test City'),
        latitude: ref(null),
        longitude: ref(null),
        isPreciseLocation: ref(false)
    })
}))

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key
    })
}))

describe('LandingView', () => {
    const router = createRouter({
        history: createWebHistory(),
        routes: [{ path: '/', component: LandingView }]
    })

    beforeEach(() => {
        vi.clearAllMocks()
        setActivePinia(createPinia())
    })

    it('renders correctly', async () => {
        setActivePinia(createPinia())
        const wrapper = mount(LandingView, {
            global: {
                plugins: [router],
                stubs: {
                    SearchBar: true,
                    CategoryPills: true,
                    ProviderCard: true
                },
                mocks: {
                    $t: (key: string) => key
                }
            }
        })
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(wrapper.exists()).toBe(true)
        expect(supabase.rpc).toHaveBeenCalledWith('discover_providers', expect.objectContaining({
            p_country_code: 'BR'
        }))
    })

    it('has hero images loaded correctly', async () => {
        setActivePinia(createPinia())
        const wrapper = mount(LandingView, {
            global: {
                plugins: [router],
                stubs: {
                    SearchBar: true,
                    CategoryPills: true,
                    ProviderCard: true
                },
                mocks: {
                    $t: (key: string) => key
                }
            }
        })

        // Check if the hero section exists
        const heroSection = wrapper.find('.bg-cover')
        expect(heroSection.exists()).toBe(true)

        // Check if background image is set
        // We check the component state because happy-dom might strip complex style strings
        const vm = wrapper.vm as any
        expect(vm.currentHero.image).toBe('/img/manicure.png')
    })
})
