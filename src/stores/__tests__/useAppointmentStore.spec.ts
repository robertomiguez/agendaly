import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppointmentStore } from '../useAppointmentStore'
import { format } from 'date-fns'

// Mock Supabase with hoisting
const mocks = vi.hoisted(() => {
    return {
        from: vi.fn(),
    }
})

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: mocks.from
    }
}))

const createChain = (data: any, error: any = null) => {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data, error })
    }
    return chain
}

describe('useAppointmentStore Conflict Checks', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        vi.clearAllMocks()
    })

    it('checkServiceUpdateConflicts returns empty array if no future appointments', async () => {
        // Mock fetchFutureAppointments response
        const chain = createChain([])
        mocks.from.mockReturnValue(chain)

        const store = useAppointmentStore()
        const conflicts = await store.checkServiceUpdateConflicts('service-1', 60, 0, 0)
        
        expect(conflicts).toEqual([])
    })

    it('checkServiceUpdateConflicts detects conflict when duration increased', async () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const baseTime = '10:00:00'
        
        // 1. fetchFutureAppointments response (The appointment we want to update)
        const myAppointment = {
            id: 'apt-1',
            staff_id: 'staff-1',
            appointment_date: today,
            start_time: baseTime,
            status: 'confirmed'
        }

        // 2. Day appointments query response (Simulate another appointment right after)
        // Original duration 30m (10:00 - 10:30). modified to 60m (10:00 - 11:00).
        // Next appointment starts at 10:45.
        const dayAppointments = [
            {
                ...myAppointment,
                service: { duration: 30, buffer_before: 0, buffer_after: 0 }
            },
            {
                id: 'apt-2',
                staff_id: 'staff-1',
                appointment_date: today,
                start_time: '10:45:00', // Conflict!
                status: 'confirmed',
                service: { duration: 30, buffer_before: 0, buffer_after: 0 }
            }
        ]

        // Mock implementation to return different data based on the call
        // We can check the arguments to 'from' or 'select' but mostly the sequence matters
        
        // First call is fetchFutureAppointments "select"
        // Second call is get day appointments "select"
        
        const chain1 = createChain([myAppointment]) // Future appointments
        const chain2 = createChain(dayAppointments) // Day appointments checks

        mocks.from
            .mockReturnValueOnce(chain1)
            .mockReturnValueOnce(chain2)

        const store = useAppointmentStore()
        // Try to update service to 60 minutes
        const conflicts = await store.checkServiceUpdateConflicts('service-1', 60, 0, 0)

        expect(conflicts.length).toBe(1)
        expect(conflicts[0].id).toBe('apt-1')
    })
    
    it('checkServiceUpdateConflicts detects conflict when buffer increased', async () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const baseTime = '10:00:00'
        
        // 1. Future appointment
        const myAppointment = {
            id: 'apt-1',
            staff_id: 'staff-1',
            appointment_date: today,
            start_time: baseTime,
            status: 'confirmed'
        }

        // 2. Day appointments
        // Original: 10:00 - 10:30. 
        // Update: Duration 30, Buffer After 30 => Ends visually at 11:00.
        // Next appointment at 10:45. Conflict!
        const dayAppointments = [
            {
                ...myAppointment,
                service: { duration: 30, buffer_before: 0, buffer_after: 0 }
            },
            {
                id: 'apt-2', // The conflicting one
                staff_id: 'staff-1',
                appointment_date: today,
                start_time: '10:45:00',
                status: 'confirmed',
                service: { duration: 30, buffer_before: 0, buffer_after: 0 }
            }
        ]

        const chain1 = createChain([myAppointment])
        const chain2 = createChain(dayAppointments)
        
        mocks.from
            .mockReturnValueOnce(chain1)
            .mockReturnValueOnce(chain2)

        const store = useAppointmentStore()
        // Update buffer_after to 30 mins
        const conflicts = await store.checkServiceUpdateConflicts('service-1', 30, 0, 30)

        expect(conflicts.length).toBe(1)
        expect(conflicts[0].id).toBe('apt-1')
    })

    it('checkServiceUpdateConflicts returns empty if no overlap', async () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        
        const myAppointment = {
            id: 'apt-1',
            staff_id: 'staff-1',
            appointment_date: today,
            start_time: '10:00:00',
            status: 'confirmed'
        }

        const dayAppointments = [
            {
                ...myAppointment,
                service: { duration: 30, buffer_before: 0, buffer_after: 0 }
            },
            {
                id: 'apt-2',
                staff_id: 'staff-1',
                appointment_date: today,
                start_time: '12:00:00', // Far enough away
                status: 'confirmed',
                service: { duration: 30, buffer_before: 0, buffer_after: 0 }
            }
        ]

        const chain1 = createChain([myAppointment])
        const chain2 = createChain(dayAppointments)
        
        mocks.from
            .mockReturnValueOnce(chain1)
            .mockReturnValueOnce(chain2)

        const store = useAppointmentStore()
        const conflicts = await store.checkServiceUpdateConflicts('service-1', 60, 0, 0) // 10:00 - 11:00

        expect(conflicts).toEqual([])
    })

    it('blocks only slots overlapping a recurring timed block', async () => {
        const serviceChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: {
                    id: 'service-1',
                    duration: 30,
                    buffer_before: 0,
                    buffer_after: 0,
                },
                error: null,
            }),
        }
        const availabilityChain = createChain([
            {
                staff_id: 'staff-1',
                day_of_week: 2,
                start_time: '10:00:00',
                end_time: '15:00:00',
                is_available: true,
            },
        ])
        const blockedDatesChain = createChain([
            {
                id: 'block-1',
                staff_id: 'staff-1',
                start_date: '2099-05-12',
                end_date: '2099-05-12',
                start_time: '12:00:00',
                end_time: '13:30:00',
                recurrence_rule: 'DTSTART:20990512T120000\nRRULE:FREQ=DAILY',
            },
        ])
        const exceptionsChain = createChain([])
        const appointmentsChain = createChain([])

        mocks.from
            .mockReturnValueOnce(serviceChain)
            .mockReturnValueOnce(availabilityChain)
            .mockReturnValueOnce(blockedDatesChain)
            .mockReturnValueOnce(exceptionsChain)
            .mockReturnValueOnce(appointmentsChain)

        const store = useAppointmentStore()
        const slots = await store.getAvailableSlots(
            'service-1',
            'staff-1',
            new Date(2099, 4, 12),
        )

        expect(slots.find((slot) => slot.time === '11:30')?.available).toBe(true)
        expect(slots.find((slot) => slot.time === '12:00')?.available).toBe(false)
        expect(slots.find((slot) => slot.time === '12:30')?.available).toBe(false)
        expect(slots.find((slot) => slot.time === '13:00')?.available).toBe(false)
        expect(slots.find((slot) => slot.time === '13:30')?.available).toBe(true)
    })

    it('does not block slots for a cancelled recurring occurrence', async () => {
        const serviceChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: {
                    id: 'service-1',
                    duration: 30,
                    buffer_before: 0,
                    buffer_after: 0,
                },
                error: null,
            }),
        }
        const availabilityChain = createChain([
            {
                staff_id: 'staff-1',
                day_of_week: 2,
                start_time: '10:00:00',
                end_time: '15:00:00',
                is_available: true,
            },
        ])
        const blockedDatesChain = createChain([
            {
                id: 'block-1',
                staff_id: 'staff-1',
                start_date: '2099-05-12',
                end_date: '2099-05-12',
                start_time: '12:00:00',
                end_time: '13:30:00',
                recurrence_rule: 'DTSTART:20990512T120000\nRRULE:FREQ=DAILY',
            },
        ])
        const exceptionsChain = createChain([
            {
                blocked_date_id: 'block-1',
                exception_date: '2099-05-12',
                type: 'cancelled',
            },
        ])
        const appointmentsChain = createChain([])

        mocks.from
            .mockReturnValueOnce(serviceChain)
            .mockReturnValueOnce(availabilityChain)
            .mockReturnValueOnce(blockedDatesChain)
            .mockReturnValueOnce(exceptionsChain)
            .mockReturnValueOnce(appointmentsChain)

        const store = useAppointmentStore()
        const slots = await store.getAvailableSlots(
            'service-1',
            'staff-1',
            new Date(2099, 4, 12),
        )

        expect(slots.find((slot) => slot.time === '12:00')?.available).toBe(true)
        expect(slots.find((slot) => slot.time === '12:30')?.available).toBe(true)
        expect(slots.find((slot) => slot.time === '13:00')?.available).toBe(true)
    })
})
