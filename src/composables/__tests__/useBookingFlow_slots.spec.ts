
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookingFlow } from '../useBookingFlow'
import { useStaffStore } from '../../stores/useStaffStore'
import { useAppointmentStore } from '../../stores/useAppointmentStore'
import { useServiceStore } from '../../stores/useServiceStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { format } from 'date-fns'

function nextWeekday(dayOfWeek: number) {
  const date = new Date()
  const daysUntil = (dayOfWeek - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + daysUntil)
  date.setHours(0, 0, 0, 0)
  return date
}

// Mocks
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  }),
  createI18n: () => ({
      global: {
          locale: { value: 'en' }
      }
  })
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}))

describe('useBookingFlow Slots', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    // Mock Auth Store (Fixes "No user logged in" issues if any)
    const authStore = useAuthStore()
    authStore.user = { id: 'user1', email: 'test@example.com' } as any
    authStore.customer = { id: 'cust1', name: 'Test Customer' } as any
  })

  it('loads slots correctly after staff selection', async () => {
    const staffStore = useStaffStore()
    const appointmentStore = useAppointmentStore()
    const serviceStore = useServiceStore()

    // Setup Mock Data
    const serviceId = 'srv1'
    const staffId = 'staff1'
    const today = new Date()

    serviceStore.services = [
      { id: serviceId, name: 'Service A', duration: 60, price: 100, provider_id: 'p1', active: true, buffer_before: 0, buffer_after: 0 } as any
    ]

    staffStore.staff = [
      { id: staffId, name: 'Staff A', email: 'test@example.com', role: 'staff', active: true, provider_id: 'p1' } as any
    ]

    // Mock Availability: Available today 9-17
    const dayOfWeek = today.getDay()
    staffStore.availability = [
      { id: 'avail1', day_of_week: dayOfWeek, is_available: true, start_time: '09:00', end_time: '17:00', staff_id: staffId } as any
    ]
    staffStore.blockedDates = []
    
    // Mock fetch functions
    staffStore.fetchAvailability = vi.fn().mockResolvedValue(staffStore.availability)
    staffStore.fetchBlockedDates = vi.fn().mockResolvedValue([])
    staffStore.fetchStaffAddresses = vi.fn().mockResolvedValue([])

    // Mock Appointments as empty
    appointmentStore.fetchStaffAppointments = vi.fn().mockResolvedValue([])

    // Mock generateSlots
    appointmentStore.generateSlots = vi.fn().mockReturnValue([
        { time: '09:00', available: true },
        { time: '10:00', available: true }
    ])
    appointmentStore.checkAvailability = vi.fn().mockReturnValue(true)

    // Init composable
    const { 
        selectedServiceId, 
        selectedStaffId, 
        availableSlots
        // selectedDate
    } = useBookingFlow()

    // Set Service
    selectedServiceId.value = serviceId
    
    // Set Staff (This triggers the watcher chain)
    // We await check because watcher is async
    // const watcherPromise = new Promise(resolve => setTimeout(resolve, 0)) // tick
    await new Promise(resolve => setTimeout(resolve, 0))
    selectedStaffId.value = staffId
    
    // Wait for watchers to fire and complete
    await new Promise(resolve => setTimeout(resolve, 100)) 

    // Expect fetchAvailability to be called
    expect(staffStore.fetchAvailability).toHaveBeenCalledWith(staffId)

    // Expect slots to be loaded
    // Before fix: This might fail because loadAvailableSlots ran before fetchAvailability completed
    // After fix: It should pass
    expect(availableSlots.value.length).toBeGreaterThan(0)
    expect(availableSlots.value[0]?.time).toBe('09:00')
    
    // Verify reload happened
    expect(appointmentStore.generateSlots).toHaveBeenCalled()
  })

  it('keeps a partially blocked day available and applies the block to slots', async () => {
    const staffStore = useStaffStore()
    const appointmentStore = useAppointmentStore()
    const serviceStore = useServiceStore()

    const serviceId = 'srv1'
    const staffId = 'staff1'
    const friday = nextWeekday(5)
    const fridayStr = format(friday, 'yyyy-MM-dd')

    serviceStore.services = [
      { id: serviceId, name: 'Service A', duration: 30, price: 100, provider_id: 'p1', active: true, buffer_before: 0, buffer_after: 0 } as any
    ]
    staffStore.staff = [
      { id: staffId, name: 'Juan', role: 'staff', active: true, provider_id: 'p1' } as any
    ]
    staffStore.availability = [
      { id: 'avail1', day_of_week: friday.getDay(), is_available: true, start_time: '09:00:00', end_time: '17:00:00', staff_id: staffId } as any
    ]
    staffStore.blockedDates = [
      {
        id: 'block-friday',
        staff_id: staffId,
        start_date: fridayStr,
        end_date: fridayStr,
        start_time: '09:00:00',
        end_time: '13:35:00'
      } as any
    ]
    appointmentStore.checkAvailability = vi.fn().mockReturnValue(true)
    appointmentStore.generateSlots = vi.fn().mockReturnValue([
      { time: '13:30', available: false, reason: 'Already booked' },
      { time: '14:00', available: true }
    ])

    const booking = useBookingFlow(undefined, staffId)
    booking.selectedServiceId.value = serviceId
    booking.selectedDate.value = friday

    expect(booking.getDateStatus(friday)).toBe('Available')

    await booking.loadAvailableSlots()

    expect(appointmentStore.generateSlots).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          id: 'block-friday',
          start_time: '09:00:00',
          end_time: '13:35:00'
        })
      ]),
      friday
    )
    expect(booking.availableSlots.value).toEqual([
      { time: '13:30', available: false, reason: 'Already booked' },
      { time: '14:00', available: true }
    ])
  })

  it('marks a whole-day blocked day unavailable', () => {
    const staffStore = useStaffStore()
    const serviceStore = useServiceStore()

    const serviceId = 'srv1'
    const staffId = 'staff1'
    const thursday = nextWeekday(4)
    const thursdayStr = format(thursday, 'yyyy-MM-dd')

    serviceStore.services = [
      { id: serviceId, name: 'Service A', duration: 30, price: 100, provider_id: 'p1', active: true, buffer_before: 0, buffer_after: 0 } as any
    ]
    staffStore.availability = [
      { id: 'avail1', day_of_week: thursday.getDay(), is_available: true, start_time: '09:00:00', end_time: '17:00:00', staff_id: staffId } as any
    ]
    staffStore.blockedDates = [
      {
        id: 'block-thursday',
        staff_id: staffId,
        start_date: thursdayStr,
        end_date: thursdayStr
      } as any
    ]

    const booking = useBookingFlow(undefined, staffId)
    booking.selectedServiceId.value = serviceId

    expect(booking.getDateStatus(thursday)).toBe('Unavailable')
  })
})
