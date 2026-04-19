import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canAddStaff, canAddService, canAddLocation } from '../subscriptionService'
import { supabase } from '@/lib/supabase'

// helpers
// const mockData = (data: any) => ({ data, error: null })
// const mockError = (error: any) => ({ data: null, error })
// const mockCount = (count: number) => ({ count, error: null })

// Chainable mock setup
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockInvoke = vi.fn()

const mockFrom = vi.fn()

// Build the chain
mockFrom.mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate
})

mockSelect.mockReturnValue({
  eq: mockEq,
  order: mockOrder,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
  single: mockSingle
})

mockEq.mockReturnValue({
  eq: mockEq, // Chain multiple eqs
  order: mockOrder,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
  single: mockSingle
})

mockOrder.mockReturnValue({
  limit: mockLimit,
  maybeSingle: mockMaybeSingle
})

mockLimit.mockReturnValue({
  maybeSingle: mockMaybeSingle
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    },
    from: vi.fn()
  }
}))

describe('subscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke)
    vi.mocked(supabase.from).mockImplementation(mockFrom)
    
    // Default return values for base chain
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockOrder.mockReturnThis()
    mockLimit.mockReturnThis()
  })

  describe('Limit Checks', () => {
    const providerId = 'provider-123'
    
    const mockPlan = (maxStaff: number | null, maxServices: number | null, maxLocations: number | null) => ({
      id: 'sub-1',
      plan: {
        id: 'plan-1',
        display_name: 'Test Plan',
        max_staff: maxStaff,
        max_services: maxServices,
        max_locations: maxLocations
      }
    })

    const setupSubscription = (subscription: any) => {
      // Mock getProviderSubscription chain
      // supabase.from('subscriptions').select(...).eq(...).order(...).limit(1).maybeSingle()
      
      // We need to intercept the chain specifically for table calls if possible,
      // or just make sure `maybeSingle` returns what we want based on the *previous* calls.
      // But standard mocks are shared. We can use `mockImplementationOnce`.
      
      // Since `getProviderSubscription` is called first in all these functions, we can mock the first chain.
      // However, `canAddX` then calls `from('staff')` etc.
      
      // Strategy: Use checks on `mockFrom` arguments to return specific chain instances or just reuse the global chain
      // and queue up return values on the terminal methods (maybeSingle, select promise resolution).
      
      // Issue: `canAddX` calls `await getProviderSubscription` which awaits `maybeSingle()`.
      // Then it calls `await supabase.from(...).select(...)` which awaits the select/thenable.
      
      // Let's refine the mock to handle table names
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        const chain: any = {
           select: vi.fn().mockImplementation((...args) => {
             // If generic select, return chain.
             // If select with count: 'exact', we need to return the count object structure which behaves like a promise
             if (args[1] && args[1].count) {
                return {
                    eq: vi.fn().mockReturnThis(),
                    then: (resolve: any) => resolve({ count: (chain.countValue ?? 0), error: null })
                }
             }
             return chain
           }),
           eq: vi.fn().mockReturnThis(),
           order: vi.fn().mockReturnThis(),
           limit: vi.fn().mockReturnThis(),
           maybeSingle: vi.fn().mockResolvedValue({ data: subscription, error: null }),
           single: vi.fn().mockResolvedValue({ data: subscription, error: null })
        }
        
        // Store intended count on variable
        chain.countValue = (tableCounts as any)[table] ?? 0
        
        return chain
      })
    }
    
    let tableCounts: Record<string, number> = {}

    beforeEach(() => {
        tableCounts = { staff: 0, services: 0, provider_addresses: 0 }
    })

    describe('canAddStaff', () => {
        it('allows if max_staff is null (unlimited)', async () => {
            setupSubscription(mockPlan(null, 5, 1))
            const result = await canAddStaff(providerId)
            expect(result.allowed).toBe(true)
        })

        it('allows if count < max_staff', async () => {
            setupSubscription(mockPlan(5, 5, 1))
            tableCounts['staff'] = 4
            const result = await canAddStaff(providerId)
            expect(result.allowed).toBe(true)
        })

        it('disallows if count >= max_staff', async () => {
             setupSubscription(mockPlan(5, 5, 1))
             tableCounts['staff'] = 5
             const result = await canAddStaff(providerId)
             expect(result.allowed).toBe(false)
             expect(result.message).toContain('Upgrade')
        })
        
        it('disallows if no subscription', async () => {
            setupSubscription(null)
            const result = await canAddStaff(providerId)
            expect(result.allowed).toBe(false)
            expect(result.message).toContain('No active subscription')
        })
    })

    describe('canAddService', () => {
         it('allows if max_services is null', async () => {
            setupSubscription(mockPlan(1, null, 1))
            const result = await canAddService(providerId)
            expect(result.allowed).toBe(true)
        })

        it('allows if count < max_services', async () => {
            setupSubscription(mockPlan(1, 10, 1))
            tableCounts['services'] = 9
            const result = await canAddService(providerId)
            expect(result.allowed).toBe(true)
        })

        it('disallows if count >= max_services', async () => {
            setupSubscription(mockPlan(1, 10, 1))
            tableCounts['services'] = 10
            const result = await canAddService(providerId)
            expect(result.allowed).toBe(false)
        })
    })
    
     describe('canAddLocation', () => {
         it('allows if max_locations is null', async () => {
            setupSubscription(mockPlan(1, 1, null))
            const result = await canAddLocation(providerId)
            expect(result.allowed).toBe(true)
        })

        it('allows if count < max_locations', async () => {
            setupSubscription(mockPlan(1, 1, 3))
            tableCounts['provider_addresses'] = 2
            const result = await canAddLocation(providerId)
            expect(result.allowed).toBe(true)
        })

        it('disallows if count >= max_locations', async () => {
            setupSubscription(mockPlan(1, 1, 3))
            tableCounts['provider_addresses'] = 3
            const result = await canAddLocation(providerId)
            expect(result.allowed).toBe(false)
        })
    })

  })
})

