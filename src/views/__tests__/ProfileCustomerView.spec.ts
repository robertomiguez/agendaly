import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import ProfileCustomerView from '../ProfileCustomerView.vue'

const push = vi.fn()
const route = reactive<{ query: Record<string, string | undefined> }>({ query: {} })

const authStore = reactive({
  profile: {
    name: '',
    phone: ''
  },
  error: null as string | null,
  updateProfile: vi.fn(async (profile: { name: string; phone: string }) => {
    authStore.profile.name = profile.name
    authStore.profile.phone = profile.phone
  })
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => route
}))

vi.mock('../../stores/useAuthStore', () => ({
  useAuthStore: () => authStore
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('../../composables/useNotifications', () => ({
  useNotifications: () => ({
    successMessage: null,
    errorMessage: null,
    showSuccess: vi.fn(),
    showError: vi.fn(),
    clearMessages: vi.fn()
  })
}))

vi.mock('../../components/common/BackButton.vue', () => ({
  default: { template: '<button type="button"><slot /></button>' }
}))

vi.mock('../../components/common/SubmitButton.vue', () => ({
  default: { template: '<button type="submit">Submit</button>' }
}))

function mountProfile() {
  return mount(ProfileCustomerView, {
    global: {
      mocks: {
        $t: (key: string) => key
      }
    }
  })
}

describe('ProfileCustomerView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    push.mockClear()
    authStore.updateProfile.mockClear()
    authStore.profile.name = ''
    authStore.profile.phone = ''
    route.query = {}
  })

  it('redirects customer profile saves to my bookings by default', async () => {
    const wrapper = mountProfile()

    await wrapper.find('input[type="text"]').setValue('Jane Doe')
    await wrapper.find('input[type="tel"]').setValue('(555) 123-4567')
    await wrapper.find('form').trigger('submit.prevent')
    await nextTick()
    vi.runAllTimers()

    expect(authStore.updateProfile).toHaveBeenCalledWith({
      name: 'Jane Doe',
      phone: '(555) 123-4567'
    })
    expect(push).toHaveBeenCalledWith('/my-bookings')
  })

  it('preserves booking-flow continuation after profile completion', async () => {
    route.query = { redirect: '/booking' }
    const wrapper = mountProfile()

    await wrapper.find('input[type="text"]').setValue('Jane Doe')
    await wrapper.find('input[type="tel"]').setValue('(555) 123-4567')
    await wrapper.find('form').trigger('submit.prevent')
    await nextTick()
    vi.runAllTimers()

    expect(push).toHaveBeenCalledWith('/booking')
  })
})
