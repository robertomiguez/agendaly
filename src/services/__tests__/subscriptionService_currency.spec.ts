import { describe, it, expect, vi, beforeEach } from 'vitest'
import { previewPlanChange } from '../subscriptionService'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        order: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle: vi.fn() }))
        }))
      })),
      update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }
}))

describe('subscriptionService Currency Support', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calculates proration using CAD price when currency is CAD', async () => {
        const mockCurrentSub = {
            id: 'sub_123',
            plan: {
                id: 'plan_solo',
                name: 'solo',
                prices: { usd: 10 }
            },
            currency: 'cad', // user is in CAD
            locked_price: 13, // CAD price
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days left
        }

        const mockNewPlan = {
            id: 'plan_store',
            name: 'store',
            prices: {
                usd: 20,
                cad: 26, // Fixed CAD price
                eur: 18
            }
        }

        // Mock fetches
        const selectMock = supabase.from('subscriptions').select
        const singleMock = vi.fn().mockResolvedValue({ data: mockCurrentSub, error: null })
        // @ts-ignore
        selectMock.mockImplementation(() => ({
            eq: () => ({ single: singleMock })
        }))

        // Mock getPlan calls
        // We need to mock supabase.from('plans').select... logic inside getPlan
        // Since getPlan is not exported/mocked directly here, we have to mock the supabase call it makes
        // But wait, `previewPlanChange` calls `getPlan`. 
        // We can mock the responses based on the ID passed to `eq`.

        // @ts-ignore
        supabase.from = (table: string) => {
            if (table === 'subscriptions') {
                return {
                    select: () => ({
                        eq: () => ({ single: singleMock })
                    })
                }
            }
            if (table === 'plans') {
                return {
                    select: () => ({
                        eq: (_col: string, val: string) => ({
                            single: async () => {
                                if (val === 'plan_store') return { data: mockNewPlan, error: null }
                                return { data: null, error: 'Not found' }
                            }
                        })
                    })
                }
            }
            return {}
        }

        const result = await previewPlanChange('sub_123', 'plan_store')

        // Expected CAD calculation:
        // Old Price (CAD): 13
        // New Price (CAD): 26
        // Days remaining: ~15
        // Differential ~ 13 for half month ~ 6.50
        
        expect(result.isUpgrade).toBe(true)
        expect(result.netCharge).toBeGreaterThan(0)
        
        // Exact calculation validation might be tricky due to Date.now(), but let's check it used 26 not 20
        // If it used 20 (USD), charge would be based on 20 vs 13? Or 20 vs 10?
        // If logic was wrong and used USD:
        // Old Price: 13 (locked) or 10 (plan base). 
        // New Price: 20.
        // Difference 7 or 10.
        // Correct Logic (CAD):
        // Old Price: 13.
        // New Price: 26.
        // Difference 13.
        
        // So netCharge should be roughly half of 13 = 6.5
        // If it was half of 7 = 3.5.
        
        expect(result.netCharge).toBeCloseTo(6.5, 0) 
    })
})
