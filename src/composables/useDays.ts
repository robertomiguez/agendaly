import { computed } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { RRule } from 'rrule'

export function useDays() {
  const settingsStore = useSettingsStore()

  const daysOfWeek = computed(() => {
    const locale = settingsStore.language || 'en'
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    
    return Array.from({ length: 7 }, (_, i) => {
      // 2024-01-07 is a Sunday
      const date = new Date(2024, 0, 7 + i)
      return {
        value: i,
        label: formatter.format(date)
      }
    })
  })

  const daysOfWeekShort = computed(() => {
    const locale = settingsStore.language || 'en'
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2024, 0, 7 + i)
      return {
        value: i,
        label: formatter.format(date).replace('.', '') // Remove trailing dots in some locales
      }
    })
  })

  const rruleDays = [
    RRule.SU,
    RRule.MO,
    RRule.TU,
    RRule.WE,
    RRule.TH,
    RRule.FR,
    RRule.SA
  ]

  return {
    daysOfWeek,
    daysOfWeekShort,
    rruleDays
  }
}

