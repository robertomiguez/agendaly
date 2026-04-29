import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { normalizeCountryCode, useCountryDisplayName } from '../useCountryDisplayName'

describe('useCountryDisplayName', () => {
  it('normalizes country codes', () => {
    expect(normalizeCountryCode(' br ')).toBe('BR')
  })

  it('returns a localized country name for a valid code', () => {
    const { getCountryName } = useCountryDisplayName(ref('en'))

    expect(getCountryName('br')).toBe('Brazil')
  })

  it('ignores invalid or unknown country codes', () => {
    const { getCountryName } = useCountryDisplayName(ref('en'))

    expect(getCountryName('x')).toBeNull()
    expect(getCountryName('AA')).toBeNull()
    expect(getCountryName('ZZ')).toBeNull()
  })
})
