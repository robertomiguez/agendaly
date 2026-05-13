import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { addDays, addMinutes, format, parse, parseISO, isAfter, isBefore, startOfDay } from 'date-fns'
import { rrulestr } from 'rrule'
import type { Appointment, TimeSlot } from '../types'

export const useAppointmentStore = defineStore('appointment', () => {
    const appointments = ref<Appointment[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchAppointments(startDate?: string, endDate?: string) {
        loading.value = true
        error.value = null
        try {
            let query = supabase
                .from('appointments')
                .select(`
                    *,
                    customer:customers(id, name, email, phone, avatar_url)
                `)
                .order('appointment_date', { ascending: true })
                .order('start_time', { ascending: true })

            if (startDate) {
                query = query.gte('appointment_date', startDate)
            }
            if (endDate) {
                query = query.lte('appointment_date', endDate)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError
            appointments.value = data || []
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch appointments'
            console.error('Error fetching appointments:', e)
        } finally {
            loading.value = false
        }
    }

    async function fetchCustomerAppointments(customerId: string) {
        loading.value = true
        error.value = null
        try {
            const { data, error: fetchError } = await supabase
                .from('appointments')
                .select(`
                    *,
                    service:services(
                        name, 
                        price, 
                        price_currency,
                        duration,
                        provider:providers(business_name, logo_url, slug)
                    ),
                    staff:staff(name)
                `)
                .eq('customer_id', customerId)
                .order('appointment_date', { ascending: false }) // Newest first
                .order('start_time', { ascending: false })

            if (fetchError) throw fetchError

            // Map the nested provider up to the top level for easier usage in components if desired,
            // or just let the component handle the nesting.
            // Let's keep it clean and return the data structure as returned by Supabase, 
            // but we need to verify if the component expects booking.provider or booking.service.provider.
            appointments.value = data || []
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch customer bookings'
            console.error('Error fetching customer bookings:', e)
        } finally {
            loading.value = false
        }
    }

    async function createAppointment(appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) {
        loading.value = true
        error.value = null
        try {
            // Check for existing upcoming appointments (limit to 3)
            const today = format(new Date(), 'yyyy-MM-dd')
            const { count, error: countError } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('customer_id', appointment.customer_id)
                .gte('appointment_date', today)
                .in('status', ['confirmed', 'pending'])

            if (countError) throw countError
            if (count !== null && count >= 3) {
                throw new Error('BOOKING_LIMIT_REACHED')
            }

            const { data, error: createError } = await supabase
                .from('appointments')
                .insert([appointment])
                .select()
                .single()

            if (createError) throw createError
            if (data) {
                appointments.value.push(data)
            }
            return data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to create appointment'
            console.error('Error creating appointment:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function updateAppointment(id: string, updates: Partial<Appointment>) {
        loading.value = true
        error.value = null
        try {
            const { data, error: updateError } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (updateError) throw updateError
            if (data) {
                const index = appointments.value.findIndex(a => a.id === id)
                if (index !== -1) {
                    appointments.value[index] = data
                }
            }
            return data
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to update appointment'
            console.error('Error updating appointment:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    async function deleteAppointment(id: string) {
        loading.value = true
        error.value = null
        try {
            const { error: deleteError } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id)

            if (deleteError) throw deleteError
            appointments.value = appointments.value.filter(a => a.id !== id)
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to delete appointment'
            console.error('Error deleting appointment:', e)
            throw e
        } finally {
            loading.value = false
        }
    }

    /**
     * THE AVAILABILITY ENGINE - The "brain" of the scheduling system
     * Calculates available time slots for a given service, staff, and date
     */
    async function fetchStaffAppointments(staffId: string, startDate: string, endDate: string) {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('staff_id', staffId)
                .gte('appointment_date', startDate)
                .lte('appointment_date', endDate)
                .in('status', ['confirmed', 'pending'])

            if (error) throw error
            // Explicitly filter to ensure no cancelled appointments are returned
            return (data || []).filter(a => ['confirmed', 'pending'].includes(a.status))
        } catch (e) {
            console.error('Error fetching staff appointments:', e)
            return []
        }
    }

    async function fetchFutureAppointments(id: string, type: 'staff' | 'service' = 'staff') {
        try {
            const today = format(new Date(), 'yyyy-MM-dd')
            let query = supabase
                .from('appointments')
                .select(`
                    id,
                    staff_id,
                    appointment_date,
                    start_time,
                    status,
                    service:services(name)
                `)
                .gte('appointment_date', today)
                .in('status', ['confirmed', 'pending'])

            if (type === 'staff') {
                query = query.eq('staff_id', id)
            } else {
                query = query.eq('service_id', id)
            }

            const { data, error } = await query.order('appointment_date', { ascending: true })

            if (error) throw error
            return data || []
        } catch (e) {
            console.error('Error fetching future appointments:', e)
            return []
        }
    }

    function generateSlots(
        service: any,
        availability: any[],
        existingAppointments: any[],
        date: Date
    ): TimeSlot[] {
        const slots: TimeSlot[] = []
        const cycleDuration = service.duration + service.buffer_after + service.buffer_before
        const minimumBookingTime = addMinutes(new Date(), 120) // 2 hours from now

        for (const avail of availability) {
            const scheduleStart = parse(avail.start_time, 'HH:mm:ss', date)
            const scheduleEnd = parse(avail.end_time, 'HH:mm:ss', date)

            if (cycleDuration <= 0) {
                console.error('[AppointmentStore] Invalid cycle duration detected (<=0). Preventing infinite loop.', service)
                return []
            }

            let currentSlot = scheduleStart
            let safetyCounter = 0
            const MAX_ITERATIONS = 1000 // Failsafe for infinite loops

            while (true) {
                safetyCounter++
                if (safetyCounter > MAX_ITERATIONS) {
                     console.error('[AppointmentStore] Availability loop exceeded max iterations. Breaking to prevent crash.', { service, date })
                     break
                }

                const slotFaceStart = currentSlot
                const slotFaceEnd = addMinutes(slotFaceStart, service.duration)
                const slotTotalEnd = addMinutes(slotFaceEnd, service.buffer_after)

                if (isAfter(slotTotalEnd, scheduleEnd)) {
                    break
                }

                const collisionStart = addMinutes(slotFaceStart, -service.buffer_before)
                const collisionEnd = addMinutes(slotFaceEnd, service.buffer_after)

                let hasConflict = false
                let conflictReason: string | undefined

                // Check against Minimum Booking Time (2 hours notice)
                // This handles both "too soon today" and "past dates"
                if (isBefore(slotFaceStart, minimumBookingTime)) {
                    hasConflict = true
                    conflictReason = 'Too soon'
                }

                if (!hasConflict && existingAppointments) {
                    for (const appt of existingAppointments) {
                        const apptFaceStart = parse(appt.start_time, 'HH:mm:ss', date)
                        const apptFaceEnd = parse(appt.end_time, 'HH:mm:ss', date)

                        // Check overlap
                        if (
                            isBefore(collisionStart, apptFaceEnd) &&
                            isAfter(collisionEnd, apptFaceStart)
                        ) {
                            hasConflict = true
                            conflictReason = 'Already booked'
                            break
                        }
                    }
                }

                slots.push({
                    time: format(slotFaceStart, 'HH:mm'),
                    available: !hasConflict,
                    reason: conflictReason
                })

                currentSlot = addMinutes(currentSlot, cycleDuration)
            }
        }
        return slots
    }

    function blockAppliesToDate(block: any, date: Date, dateStr: string) {
        if (!block.recurrence_rule) {
            return block.start_date <= dateStr && block.end_date >= dateStr
        }

        try {
            const blockStart = parseISO(
                `${block.start_date}T${block.start_time || '00:00:00'}`
            )
            const rule = rrulestr(block.recurrence_rule, { dtstart: blockStart })
            const dayStart = startOfDay(date)
            const dayEnd = addDays(dayStart, 1)

            return rule.between(dayStart, dayEnd, true).length > 0
        } catch (e) {
            console.error('Error checking recurring blocked date:', e)
            return false
        }
    }

    function hasCancelledBlockException(exceptions: any[], blockId: string, dateStr: string) {
        return exceptions.some(
            (exception) =>
                exception.blocked_date_id === blockId &&
                exception.exception_date === dateStr &&
                exception.type === 'cancelled'
        )
    }

    function blocksForSlotConflicts(blockedDates: any[], exceptions: any[], date: Date) {
        const dateStr = format(date, 'yyyy-MM-dd')
        const matchingBlocks = blockedDates.filter(
            (block) =>
                blockAppliesToDate(block, date, dateStr) &&
                !hasCancelledBlockException(exceptions, block.id, dateStr)
        )

        const hasAllDayBlock = matchingBlocks.some(
            (block) => !block.start_time || !block.end_time
        )

        if (hasAllDayBlock) {
            return { blocksWholeDay: true, timedBlocks: [] }
        }

        return {
            blocksWholeDay: false,
            timedBlocks: matchingBlocks.map((block) => ({
                id: block.id,
                start_time: block.start_time,
                end_time: block.end_time,
            })),
        }
    }

    function checkAvailability(
        service: any,
        availability: any[],
        existingAppointments: any[],
        date: Date
    ): boolean {
        const cycleDuration = service.duration + service.buffer_after + service.buffer_before
        const minimumBookingTime = addMinutes(new Date(), 120) // 2 hours from now

        for (const avail of availability) {
            const scheduleStart = parse(avail.start_time, 'HH:mm:ss', date)
            const scheduleEnd = parse(avail.end_time, 'HH:mm:ss', date)

            if (cycleDuration <= 0) {
                 // Zero duration means we can't schedule slots properly, so we assume busy/unavailable to be safe if no fallback exists
                 return false
            }

            let currentSlot = scheduleStart
            let safetyCounter = 0
            const MAX_ITERATIONS = 1000

            while (true) {
                safetyCounter++
                if (safetyCounter > MAX_ITERATIONS) {
                     console.error('[AppointmentStore] Availability check loop exceeded max iterations.', { service, date })
                     break
                }

                const slotFaceStart = currentSlot
                const slotFaceEnd = addMinutes(slotFaceStart, service.duration)
                const slotTotalEnd = addMinutes(slotFaceEnd, service.buffer_after)

                if (isAfter(slotTotalEnd, scheduleEnd)) {
                    break
                }

                const collisionStart = addMinutes(slotFaceStart, -service.buffer_before)
                const collisionEnd = addMinutes(slotFaceEnd, service.buffer_after)

                let hasConflict = false

                // Check Minimum Booking Time
                if (isBefore(slotFaceStart, minimumBookingTime)) {
                    hasConflict = true
                }

                if (!hasConflict && existingAppointments) {
                    for (const appt of existingAppointments) {
                        const apptFaceStart = parse(appt.start_time, 'HH:mm:ss', date)
                        const apptFaceEnd = parse(appt.end_time, 'HH:mm:ss', date)

                        if (
                            isBefore(collisionStart, apptFaceEnd) &&
                            isAfter(collisionEnd, apptFaceStart)
                        ) {
                            hasConflict = true
                            break
                        }
                    }
                }

                if (!hasConflict) {
                    return true // Found one available slot, day is available!
                }

                currentSlot = addMinutes(currentSlot, cycleDuration)
            }
        }
        return false
    }

    async function getAvailableSlots(
        serviceId: string,
        staffId: string,
        date: Date
    ): Promise<TimeSlot[]> {
        try {
            // 1. Get service details
            const { data: service } = await supabase
                .from('services')
                .select('*')
                .eq('id', serviceId)
                .single()

            if (!service) throw new Error('Service not found')

            // 2. Get staff availability
            const dayOfWeek = date.getDay()
            const { data: availability } = await supabase
                .from('availability')
                .select('*')
                .eq('staff_id', staffId)
                .eq('day_of_week', dayOfWeek)
                .eq('is_available', true)

            if (!availability || availability.length === 0) {
                return []
            }

            // 3. Check blocked dates
            const dateStr = format(date, 'yyyy-MM-dd')
            const { data: blockedDates } = await supabase
                .from('blocked_dates')
                .select('*')
                .eq('staff_id', staffId)

            const blockedDateIds = (blockedDates || []).map((block) => block.id)
            let blockedDateExceptions: any[] = []

            if (blockedDateIds.length > 0) {
                const { data: exceptions } = await supabase
                    .from('blocked_date_exceptions')
                    .select('*')
                    .in('blocked_date_id', blockedDateIds)

                blockedDateExceptions = exceptions || []
            }

            const { blocksWholeDay, timedBlocks } = blocksForSlotConflicts(
                blockedDates || [],
                blockedDateExceptions,
                date
            )

            if (blocksWholeDay) {
                return []
            }

            // 4. Get appointments
            const existingAppointments = await fetchStaffAppointments(staffId, dateStr, dateStr)

            // 5. Generate slots using shared logic
            return generateSlots(
                service,
                availability,
                [...existingAppointments, ...timedBlocks],
                date
            )

        } catch (e) {
            console.error('Error calculating available slots:', e)
            throw e
        }
    }

    async function checkConflictsInRange(staffId: string, startDate: string, endDate: string): Promise<boolean> {
        try {
            const { count, error: fetchError } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('staff_id', staffId)
                .gte('appointment_date', startDate)
                .lte('appointment_date', endDate)
                .in('status', ['confirmed', 'pending'])

            if (fetchError) throw fetchError
            return (count || 0) > 0
        } catch (e) {
            console.error('Error checking conflicts in range:', e)
            return false
        }
    }

    async function checkServiceUpdateConflicts(
        serviceId: string,
        newDuration: number,
        newBufferBefore: number,
        newBufferAfter: number
    ): Promise<any[]> {
        try {
            const serviceAppointments = await fetchFutureAppointments(serviceId, 'service')
            if (!serviceAppointments || serviceAppointments.length === 0) return []

            const conflicts: any[] = []
            const grouped = new Map<string, any[]>()

            for (const apt of serviceAppointments) {
                const key = `${apt.staff_id}_${apt.appointment_date}`
                if (!grouped.has(key)) grouped.set(key, [])
                grouped.get(key)!.push(apt)
            }

            for (const [key, aptsToUpdate] of grouped.entries()) {
                const [staffId, dateStr] = key.split('_')
                if (!staffId || !dateStr) continue

                // Fetch day appointments with service details for accurate buffer calculation
                const { data: dayAppointments, error } = await supabase
                    .from('appointments')
                    .select(`
                        *,
                        service:services(duration, buffer_before, buffer_after)
                    `)
                    .eq('staff_id', staffId)
                    .eq('appointment_date', dateStr)
                    .in('status', ['confirmed', 'pending'])
                
                if (error || !dayAppointments) continue

                for (const apt of aptsToUpdate) {
                    const currentStart = parse(apt.start_time, 'HH:mm:ss', new Date())
                    
                    // New range for the appointment being updated
                    const newVisualStart = addMinutes(currentStart, -newBufferBefore)
                    const newServiceEnd = addMinutes(currentStart, newDuration)
                    const newVisualEnd = addMinutes(newServiceEnd, newBufferAfter)

                    for (const other of dayAppointments) {
                        if (other.id === apt.id) continue

                        // Calculate range for the "other" appointment
                        const otherStart = parse(other.start_time, 'HH:mm:ss', new Date())
                        // Use service defaults or 0 if missing (shouldn't happen for valid appts)
                        const otherDuration = other.service?.duration || 30
                        const otherBufferBefore = other.service?.buffer_before || 0
                        const otherBufferAfter = other.service?.buffer_after || 0

                        const otherVisualStart = addMinutes(otherStart, -otherBufferBefore)
                        const otherServiceEnd = addMinutes(otherStart, otherDuration)
                        const otherVisualEnd = addMinutes(otherServiceEnd, otherBufferAfter)

                        // Check overlap
                        if (isBefore(newVisualStart, otherVisualEnd) && isAfter(newVisualEnd, otherVisualStart)) {
                            // Conflict found!
                            conflicts.push(apt) // Push the appointment that causes the issue
                            break // One conflict per appointment is enough to flag it
                        }
                    }
                }
            }
            return conflicts
        } catch (e) {
            console.error('Error checking service update conflicts:', e)
            throw e
        }
    }


    return {
        appointments,
        loading,
        error,
        fetchAppointments,
        createAppointment,
        updateAppointment,
        deleteAppointment,
        getAvailableSlots,
        fetchStaffAppointments,
        fetchFutureAppointments,
        generateSlots,
        checkAvailability,
        fetchCustomerAppointments,
        checkConflictsInRange,
        checkServiceUpdateConflicts
    }
})
