import { describe, it, expect, vi, beforeEach } from 'vitest'
import { previewPlanChange } from '../subscriptionService'
import { supabase } from '@/lib/supabase'

// Simple mock factories
const mockReturn = (data: any) => ({ data, error: null })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

describe('subscriptionService - previewPlanChange Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks downgrade if staff limit exceeded', async () => {
    const subId = 'sub-1'
    const newPlanId = 'plan-new'
    const providerId = 'prov-1'

    // Mock data
    const currentSub = {
        id: subId,
        provider_id: providerId,
        plan: { id: 'plan-old', prices: { usd: 50 } }, 
        prices: { usd: 50 },
        currency: 'usd',
        status: 'active'
    }

    const newPlan = {
        id: newPlanId,
        display_name: 'Solo',
        max_staff: 1,      // LIMIT: 1
        max_services: 10,
        max_locations: 1,
        prices: { usd: 20 }
    }

    // Mock implementation
    const mockFrom = vi.fn()
    vi.mocked(supabase.from).mockImplementation(mockFrom)

    mockFrom.mockImplementation((table: string) => {
        const chain: any = {
            select: vi.fn(),
            eq: vi.fn(),
            single: vi.fn(),
            maybeSingle: vi.fn()
        }
        
        chain.select.mockImplementation((_columns: string, options: any) => {
             // 1. If it's a count query
             if (options && options.count) {
                 return {
                     eq: vi.fn().mockReturnThis(),
                     then: (resolve: any) => {
                         let count = 0
                         // Simulate usage
                         if (table === 'staff') count = 2 // EXCEEDS LIMIT of 1
                         if (table === 'services') count = 2
                         if (table === 'provider_addresses') count = 1
                         
                         resolve({ count, error: null })
                     }
                 }
             }
             // 2. Normal select
             return chain
        })

        chain.eq.mockReturnThis()

        // 3. Data return
        if (table === 'subscriptions') {
            chain.single.mockResolvedValue(mockReturn(currentSub))
        } else if (table === 'plans') {
            chain.single.mockResolvedValue(mockReturn(newPlan))
        }

        return chain
    })

    const result = await previewPlanChange(subId, newPlanId)

    expect(result.canChange).toBe(false)
    expect(result.isUpgrade).toBe(false)
    expect(result.message).toContain('active staff members')
    expect(result.message).toContain('deactivate')
  })

  it('blocks downgrade if service limit exceeded', async () => {
    const subId = 'sub-1'
    const newPlanId = 'plan-new'
    
    // Mock data
    const currentSub = {
        id: subId,
        provider_id: 'prov-1',
        plan: { id: 'plan-old', prices: { usd: 50 } },
        prices: { usd: 50 },
        currency: 'usd',
        status: 'active'
    }

    const newPlan = {
        id: newPlanId,
        display_name: 'Solo',
        max_staff: 10,
        max_services: 2, // LIMIT: 2
        max_locations: 1,
        prices: { usd: 20 }
    }

    const mockFrom = vi.fn()
    vi.mocked(supabase.from).mockImplementation(mockFrom)

    mockFrom.mockImplementation((table) => {
        const chain: any = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
        chain.select.mockImplementation((_cols: any, opts: any) => {
             if (opts && opts.count) {
                 return {
                     eq: vi.fn().mockReturnThis(),
                     then: (resolve: any) => {
                         let count = 0
                         if (table === 'staff') count = 0
                         if (table === 'services') count = 5 // EXCEEDS LIMIT of 2
                         resolve({ count, error: null })
                     }
                 }
             }
             return chain
        })
        chain.eq.mockReturnThis()
        
        if (table === 'subscriptions') chain.single.mockResolvedValue(mockReturn(currentSub))
        if (table === 'plans') chain.single.mockResolvedValue(mockReturn(newPlan))
        
        return chain
    })

    const result = await previewPlanChange(subId, newPlanId)
    
    expect(result.canChange).toBe(false)
    expect(result.message).toContain('active services')
  })

  it('allows change if limits met', async () => {
    const subId = 'sub-1'
    const newPlanId = 'plan-new'
    
    const currentSub = {
        id: subId,
        provider_id: 'prov-1',
        plan: { id: 'plan-old', prices: { usd: 50 } },
        prices: { usd: 50 },
        currency: 'usd',
        status: 'active'
    }

    const newPlan = {
        id: newPlanId,
        display_name: 'Solo',
        max_staff: 5,
        max_services: 5,
        max_locations: 5,
        prices: { usd: 20 }
    }

    const mockFrom = vi.fn()
    vi.mocked(supabase.from).mockImplementation(mockFrom)

    mockFrom.mockImplementation((table) => {
        const chain: any = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
        chain.select.mockImplementation((_cols: any, opts: any) => {
             if (opts && opts.count) {
                 return {
                     eq: vi.fn().mockReturnThis(),
                     then: (resolve: any) => resolve({ count: 1, error: null }) // All counts 1
                 }
             }
             return chain
        })
        chain.eq.mockReturnThis()
        
        if (table === 'subscriptions') chain.single.mockResolvedValue(mockReturn(currentSub))
        if (table === 'plans') chain.single.mockResolvedValue(mockReturn(newPlan))
        
        return chain
    })

    const result = await previewPlanChange(subId, newPlanId)
    
    expect(result.canChange).toBe(true)
    // Downgrade properties
    expect(result.isDowngrade).toBe(true)
    expect(result.message).toContain('Will take effect on')
  })
})
