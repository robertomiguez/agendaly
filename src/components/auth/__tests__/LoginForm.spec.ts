import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginForm from '../LoginForm.vue'
import { useAuthStore } from '@/stores/useAuthStore'

const pushMock = vi.fn()

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
    await otpInputs[0].trigger('paste', {
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
