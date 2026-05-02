import { ref, computed, watch, onUnmounted } from 'vue'
import { useServiceStore } from '@/stores/useServiceStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useAppointmentStore } from '@/stores/useAppointmentStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { supabase } from '@/lib/supabase'
import { addDays, format, startOfDay } from 'date-fns'
import type { TimeSlot, Provider, ProviderAddress } from '@/types'
import { useI18n } from 'vue-i18n'

export function useBookingFlow(initialProviderId?: string, initialStaffId?: string) {
  const serviceStore = useServiceStore()
  const staffStore = useStaffStore()
  const appointmentStore = useAppointmentStore()
  const authStore = useAuthStore()
  const settingsStore = useSettingsStore()
  const { locale } = useI18n()

  // State
  const currentStep = ref(1)
  const selectedProviderId = ref<string | null>(initialProviderId || null)
  const selectedServiceId = ref<string>('')
  const selectedStaffId = ref<string>(initialStaffId || '')
  const selectedAddressId = ref<string>('')
  const staffAddresses = ref<ProviderAddress[]>([])
  const selectedDate = ref<Date>(new Date())
  const selectedTime = ref<string>('')
  const availableSlots = ref<TimeSlot[]>([])
  const loadingSlots = ref(false)
  const loadingDates = ref(false)
  const isSubmitting = ref(false)
  const notes = ref('')
  const providerInfo = ref<Provider | null>(null)
  const bookingConfirmed = ref(false)
  const showLogin = ref(false)
  const confirmedAppointmentId = ref<string>('')
  const confirmedDate = ref<Date | null>(null)
  const confirmedTime = ref<string>('')
  const rangeAppointments = ref<any[]>([])
  let realtimeChannel: any = null

  // Pending booking state key for OAuth flow
  const PENDING_BOOKING_KEY = 'pendingBookingState'
  const restoredFromPending = ref(false)
  let isRestoringState = false  // Flag to prevent watchers from clearing restored values

  // Computed
  const filteredServices = computed(() => {
    if (!selectedProviderId.value) return serviceStore.services
    let services = serviceStore.services.filter(s => s.provider_id === selectedProviderId.value)
    if (selectedStaffId.value) {
      services = services.filter(service => {
        if (!service.staff || service.staff.length === 0) return true
        return service.staff.some(s => s.id === selectedStaffId.value)
      })
    }
    return services
  })

  const selectedService = computed(() => 
    filteredServices.value.find(s => s.id === selectedServiceId.value)
  )

  const selectedStaff = computed(() => 
    staffStore.staff.find(s => s.id === selectedStaffId.value)
  )

  const selectedAddressObject = computed(() => {
    if (selectedAddressId.value && staffAddresses.value.length > 0) {
      return staffAddresses.value.find(a => a.id === selectedAddressId.value)
    }
    if (providerInfo.value?.provider_addresses?.length) {
      return providerInfo.value.provider_addresses[0]
    }
    return null
  })

  const availableDates = computed(() => {
    const dates = []
    const today = startOfDay(new Date())
    for (let i = 0; i < 60; i++) {
      dates.push(addDays(today, i))
    }
    return dates
  })

  const dayStatusMap = computed(() => {
    if (!selectedService.value || !selectedStaffId.value) return {}
    const map: Record<string, 'Available' | 'Busy' | 'Unavailable'> = {}
    
    availableDates.value.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayOfWeek = date.getDay()
      const schedule = staffStore.availability.find(a => a.day_of_week === dayOfWeek)
      
      if (!schedule || !schedule.is_available) {
        map[dateStr] = 'Unavailable'
        return
      }

      const isBlocked = staffStore.blockedDates.some(block => 
        dateStr >= block.start_date && dateStr <= block.end_date
      )
      
      if (isBlocked) {
        map[dateStr] = 'Unavailable'
        return
      }

      const dayAppointments = rangeAppointments.value.filter(a => 
        a.appointment_date === dateStr
      )

      try {
        const isAvailable = appointmentStore.checkAvailability(
          selectedService.value,
          [schedule],
          dayAppointments,
          date
        )
        map[dateStr] = isAvailable ? 'Available' : 'Busy'
      } catch {
        map[dateStr] = 'Available'
      }
    })
    
    return map
  })

  // Functions
  async function fetchProviderInfo(providerId: string) {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*, provider_addresses(*)')
        .eq('id', providerId)
        .single()
      
      if (error) throw error
      providerInfo.value = data
    } catch (error) {
      console.error('Error fetching provider:', error)
    }
  }

  async function loadAvailableSlots() {
    if (!selectedServiceId.value || !selectedStaffId.value || !selectedDate.value) return
    
    loadingSlots.value = true
    try {
      const dayOfWeek = selectedDate.value.getDay()
      const schedule = staffStore.availability.find(a => a.day_of_week === dayOfWeek)

      if (!schedule || !schedule.is_available) {
        availableSlots.value = []
        return
      }

      const dateStr = format(selectedDate.value, 'yyyy-MM-dd')
      const isBlocked = staffStore.blockedDates.some(block => 
        dateStr >= block.start_date && dateStr <= block.end_date
      )

      if (isBlocked) {
        availableSlots.value = []
        return
      }

      const dayAppointments = rangeAppointments.value.filter(a => 
        a.appointment_date === dateStr
      )

      availableSlots.value = appointmentStore.generateSlots(
        selectedService.value,
        [schedule],
        dayAppointments,
        selectedDate.value
      )
      
      // Only clear time if not restoring from OAuth
      if (!isRestoringState) {
        selectedTime.value = ''
      }
    } catch (e) {
      console.error('Error loading slots:', e)
      availableSlots.value = []
    } finally {
      loadingSlots.value = false
    }
  }

  function selectService(serviceId: string) {
    selectedServiceId.value = serviceId
  }

  async function confirmService() {
    const service = serviceStore.services.find(s => s.id === selectedServiceId.value)
    
    if (selectedStaffId.value) {
      const isStaffValid = !service?.staff?.length || service.staff.some(s => s.id === selectedStaffId.value)
      if (isStaffValid) {
        await selectStaff(selectedStaffId.value)
        confirmStaff()
        return
      }
    }
    
    if (service?.staff && service.staff.length === 1 && service.staff[0]) {
      await selectStaff(service.staff[0].id)
      confirmStaff()
    } else {
      selectedStaffId.value = ''
      currentStep.value = 2
    }
  }

  async function selectStaff(staffId: string) {
    selectedStaffId.value = staffId
    staffAddresses.value = await staffStore.fetchStaffAddresses(staffId)
  }

  function confirmStaff() {
    if (staffAddresses.value.length === 1 && staffAddresses.value[0]) {
      selectedAddressId.value = staffAddresses.value[0].id
      currentStep.value = 3 
    } else if (staffAddresses.value.length > 1) {
      currentStep.value = 2.5
    } else {
      currentStep.value = 3
    }
  }

  function selectBranch(addressId: string) {
    selectedAddressId.value = addressId
  }

  function confirmLocation() {
    if (selectedAddressId.value) {
      currentStep.value = 3
    }
  }

  function selectDateTime() {
    if (selectedTime.value) {
      currentStep.value = 4
    }
  }

  function goBack() {
    if (currentStep.value === 3) {
      const service = serviceStore.services.find(s => s.id === selectedServiceId.value)
      if (service?.staff && service.staff.length === 1) {
        currentStep.value = 1
      } else {
        currentStep.value = 2
      }
    } else if (currentStep.value === 4) {
      if (showLogin.value) {
        showLogin.value = false
      } else {
        currentStep.value = 3
      }
    } else if (currentStep.value === 2.5) {
      currentStep.value = 2
    } else if (currentStep.value > 1) {
      currentStep.value--
    }
  }

  function isDateAvailable(date: Date): boolean {
    return getDateStatus(date) === 'Available'
  }

  function getDateStatus(date: Date): 'Available' | 'Busy' | 'Unavailable' {
    const dateStr = format(date, 'yyyy-MM-dd')
    return dayStatusMap.value[dateStr] || 'Unavailable'
  }

  function getMapUrl(address: ProviderAddress): string {
    const query = [
      address.street_address,
      address.city,
      address.state,
      address.postal_code
    ].filter(Boolean).join(', ')
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
  }

  function getDirectionsUrl(address: ProviderAddress): string {
    const destination = [
      address.street_address,
      address.city,
      address.state,
      address.postal_code
    ].filter(Boolean).join(', ')
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
  }

  function formatDateDisplay(date: Date) {
    return date.toLocaleDateString(settingsStore.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  function formatAddress(provider: Provider | null): string {
    if (selectedAddressId.value && staffAddresses.value.length > 0) {
      const selectedAddr = staffAddresses.value.find(a => a.id === selectedAddressId.value)
      if (selectedAddr) {
        return [
          selectedAddr.label,
          selectedAddr.street_address,
          selectedAddr.city,
          selectedAddr.state,
          selectedAddr.postal_code
        ].filter(p => p).join(', ')
      }
    }

    if (!provider?.provider_addresses?.length) return 'No address provided'
    const addr = provider.provider_addresses[0]
    if (!addr) return 'No address provided'
    
    return [
      addr.label,
      addr.street_address,
      addr.city,
      addr.state,
      addr.postal_code
    ].filter(p => p).join(', ')
  }

  async function submitBooking(errorCallback: (msg: string) => void, t: (key: string) => string) {
    if (!selectedService.value) {
      errorCallback('Missing selected service')
      return false
    }
    if (!selectedStaffId.value) {
      errorCallback('Missing selected staff')
      return false
    }
    if (!selectedDate.value) {
      errorCallback('Missing selected date')
      return false
    }
    if (!selectedTime.value) {
      errorCallback('Missing selected time')
      return false
    }

    if (!providerInfo.value && selectedService.value?.provider_id) {
      await fetchProviderInfo(selectedService.value.provider_id)
    }

    if (!authStore.isAuthenticated) {
      showLogin.value = true
      return false
    }

    if (!authStore.customer) {
      errorCallback('Please log in to book an appointment')
      return false
    }

    isSubmitting.value = true
    try {
      const timeParts = selectedTime.value.split(':')
      const hours = parseInt(timeParts[0]!)
      const minutes = parseInt(timeParts[1]!)
      
      const startMinutes = hours * 60 + minutes
      const endMinutes = startMinutes + selectedService.value.duration
      const endHours = Math.floor(endMinutes / 60)
      const endMins = endMinutes % 60
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`

      const appointment = await appointmentStore.createAppointment({
        service_id: selectedServiceId.value,
        staff_id: selectedStaffId.value,
        address_id: selectedAddressId.value || undefined,
        customer_id: authStore.customer.id,
        appointment_date: format(selectedDate.value, 'yyyy-MM-dd'),
        start_time: selectedTime.value,
        end_time: endTime,
        status: 'confirmed',
        booked_price: selectedService.value.price,
        notes: notes.value || undefined
      })

      if (appointment) {
        confirmedAppointmentId.value = appointment.id
        confirmedDate.value = selectedDate.value
        confirmedTime.value = selectedTime.value
        bookingConfirmed.value = true

        // Send confirmation email
        if (providerInfo.value && authStore.customer?.profile?.email) {
          try {
            await supabase.functions.invoke('send-booking-confirmation', {
              body: {
                booking: { ...appointment, service: selectedService.value },
                customer: { name: authStore.profile?.name, email: authStore.profile?.email },
                provider: providerInfo.value,
                staff: selectedStaff.value,
                locale: locale.value,
                selectedAddress: selectedAddressObject.value
              }
            })
          } catch (emailError) {
            console.error('Error sending confirmation emails:', emailError)
          }
        }
        return true
      }
      return false
    } catch (e: any) {
      console.error('Error creating appointment:', e)
      if (e.code === '23P01' || e.message?.includes('no_overlapping_appointments')) {
        errorCallback(t('booking.slot_taken_error'))
        await loadAvailableSlots()
      } else if (e.message === 'BOOKING_LIMIT_REACHED') {
        errorCallback(t('booking.limit_reached'))
      } else {
        errorCallback(e.message || t('booking.booking_failed'))
      }
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  // Pending booking state persistence for OAuth flow
  function saveBookingState() {
    const state = {
      providerId: selectedProviderId.value,
      serviceId: selectedServiceId.value,
      staffId: selectedStaffId.value,
      addressId: selectedAddressId.value,
      date: selectedDate.value?.toISOString(),
      time: selectedTime.value,
      notes: notes.value,
      step: currentStep.value,
      timestamp: Date.now()
    }
    localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(state))
  }

  function restoreBookingState(): boolean {
    try {
      const saved = localStorage.getItem(PENDING_BOOKING_KEY)
      if (!saved) return false

      const state = JSON.parse(saved)
      
      // Check if state is stale (older than 30 minutes)
      if (Date.now() - state.timestamp > 30 * 60 * 1000) {
        clearPendingBookingState()
        return false
      }

      // Set flag to prevent watchers from clearing values during restore
      isRestoringState = true
      
      if (state.providerId !== undefined && state.providerId !== null) {
        selectedProviderId.value = state.providerId
      }
      if (state.serviceId !== undefined && state.serviceId !== null) {
        selectedServiceId.value = state.serviceId
      }
      if (state.staffId !== undefined && state.staffId !== null) {
        selectedStaffId.value = state.staffId
      }
      if (state.addressId !== undefined && state.addressId !== null) {
        selectedAddressId.value = state.addressId
      }
      if (state.date !== undefined) { // Ensure date is properly parsed
        const restoredDate = new Date(state.date)
        if (!isNaN(restoredDate.getTime())) {
          selectedDate.value = restoredDate
          selectedTime.value = state.time
        }
        notes.value = state.notes || ''
        
        currentStep.value = 4 // Go to confirm step
        restoredFromPending.value = true
        showLogin.value = false
        
        // We do NOT clear the flag here. We rely on the caller to call finishRestoringState()
        // once all async setup guarantees are met, to prevent watchers wiping the time.
        
        localStorage.removeItem(PENDING_BOOKING_KEY)
        return true
      }
    } catch (e) {
      console.error('Failed to restore booking state:', e)
    }
    
    isRestoringState = false
    return false
  }

  function finishRestoringState() {
    isRestoringState = false
  }

  function clearPendingBookingState() {
    localStorage.removeItem(PENDING_BOOKING_KEY)
  }

  function resetBooking() {
    bookingConfirmed.value = false
    currentStep.value = 1
    selectedServiceId.value = ''
    selectedStaffId.value = ''
    selectedDate.value = new Date()
    selectedTime.value = ''
    notes.value = ''
    showLogin.value = false
  }

  // Watchers
  watch([selectedServiceId, selectedStaffId, selectedDate], async ([serviceId, staffId, date]) => {
    // Skip if we're restoring state from OAuth
    if (isRestoringState) {
      return
    }
    if (serviceId && staffId && date) {
      await loadAvailableSlots()
    }
  }, { deep: true })

  watch(selectedStaffId, async (newId) => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    if (newId) {
      // Skip clearing time if we're restoring state from OAuth
      if (!isRestoringState) {
        selectedTime.value = ''
        availableSlots.value = []
      }
      
      const today = new Date()
      const endDate = addDays(today, 60)
      
      loadingDates.value = true
      try {
        await Promise.all([
          staffStore.fetchAvailability(newId),
          staffStore.fetchBlockedDates(newId),
        ])

        const fetchAppointments = async () => {
          rangeAppointments.value = await appointmentStore.fetchStaffAppointments(
            newId, 
            format(today, 'yyyy-MM-dd'), 
            format(endDate, 'yyyy-MM-dd')
          )
        }
        await fetchAppointments()

        realtimeChannel = supabase
          .channel(`public:appointments:staff_id=eq.${newId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'appointments',
              filter: `staff_id=eq.${newId}`
            },
            async () => {
              await fetchAppointments()
              if (selectedDate.value) {
                await loadAvailableSlots()
              }
            }
          )
          .subscribe()
        
        if (!isDateAvailable(selectedDate.value)) {
          const nextAvailable = availableDates.value.find(d => isDateAvailable(d))
          if (nextAvailable) {
            selectedDate.value = nextAvailable
          }
        } else {
          // If date didn't change (so no watcher trigger), we still need to reload slots
          // with the newly fetched data
          await loadAvailableSlots()
        }
      } finally {
        loadingDates.value = false
      }
    }
  })

  // Cleanup
  onUnmounted(() => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
    }
  })

  return {
    // State
    currentStep,
    selectedProviderId,
    selectedServiceId,
    selectedStaffId,
    selectedAddressId,
    staffAddresses,
    selectedDate,
    selectedTime,
    availableSlots,
    loadingSlots,
    loadingDates,
    isSubmitting,
    notes,
    providerInfo,
    bookingConfirmed,
    showLogin,
    confirmedAppointmentId,
    confirmedDate,
    confirmedTime,
    restoredFromPending,
    // Computed
    filteredServices,
    selectedService,
    selectedStaff,
    selectedAddressObject,
    availableDates,
    dayStatusMap,
    // Functions
    fetchProviderInfo,
    loadAvailableSlots,
    selectService,
    confirmService,
    selectStaff,
    confirmStaff,
    selectBranch,
    confirmLocation,
    selectDateTime,
    goBack,
    isDateAvailable,
    getDateStatus,
    getMapUrl,
    getDirectionsUrl,
    formatDateDisplay,
    formatAddress,
    submitBooking,
    resetBooking,
    saveBookingState,
    restoreBookingState,
    finishRestoringState,
    clearPendingBookingState
  }
}
