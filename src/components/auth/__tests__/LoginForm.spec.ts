import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginForm from '../LoginForm.vue'
import { useAuthStore } from '@/stores/useAuthStore'

const pushMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithOAuth: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn().mockReturnThis()
    }))
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock
  }),
  useRoute: () => ({
    query: {}
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('distributes pasted OTP digits and verifies automatically', async () => {
    const wrapper = mount(LoginForm, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              auth: {
                loading: false,
                error: null
              }
            }
          })
        ],
        mocks: {
          $t: (key: string, params?: Record<string, string>) => params?.email ? `${key} ${params.email}` : key
        }
      }
    })
    const authStore = useAuthStore()

    await wrapper.find('input[type="email"]').setValue('user@example.com')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const otpInputs = wrapper.findAll('.otp-grid input')
    const firstOtpInput = otpInputs[0]
    expect(firstOtpInput).toBeDefined()

    await firstOtpInput!.trigger('paste', {
      clipboardData: {
        getData: () => '123456'
      }
    })
    await flushPromises()

    expect(otpInputs.map(input => (input.element as HTMLInputElement).value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6'
    ])
    expect(authStore.verifyOtpCode).toHaveBeenCalledWith('user@example.com', '123456')
  })
})
