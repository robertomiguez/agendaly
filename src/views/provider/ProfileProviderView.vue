<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/useAuthStore'
import ImageUpload from '../../components/ImageUpload.vue'
import { saveProvider } from '../../services/providerService'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useNotifications } from '../../composables/useNotifications'
import { useI18n } from 'vue-i18n'
import { Building, Coins, FileText, User } from 'lucide-vue-next'
import SubmitButton from '@/components/common/SubmitButton.vue'
import BackButton from '@/components/common/BackButton.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

const selectedPlan = computed(() => route.query.plan as string || null)
const currencyOptions = ['USD', 'BRL', 'CAD', 'EUR', 'AUD', 'NZD', 'ZAR']

const form = ref({
  business_name: '',
  description: '',
  logo_url: null as string | null
})

const contactName = ref('')
const contactPhone = ref('')
const providerCurrency = ref(settingsStore.currency || 'USD')
const originalProviderCurrency = ref(providerCurrency.value)

const logoFile = ref<File | null>(null)
const loading = ref(false)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { showSuccess, showError, errorMessage, clearMessages } = useNotifications()

const isEditing = computed(() => !!authStore.provider)
const currencyWillUpdateServices = computed(() => {
  return isEditing.value && providerCurrency.value !== originalProviderCurrency.value
})


// Populate form when data is available
function populateForm() {
  if (authStore.provider) {
    form.value = {
      business_name: authStore.provider.business_name || '',
      description: authStore.provider.description || '',
      logo_url: authStore.provider.logo_url || null
    }
  }
  if (authStore.profile) {
    contactName.value = authStore.profile.name || ''
    contactPhone.value = authStore.profile.phone || ''
  }
}

function getCurrentProviderCurrency() {
  return authStore.provider?.currency || settingsStore.currency || 'USD'
}

function loadProviderCurrency() {
  providerCurrency.value = getCurrentProviderCurrency()
  originalProviderCurrency.value = providerCurrency.value
}

onMounted(() => {
  populateForm()
  loadProviderCurrency()
})

// Watch for store changes (in case of page reload)
watch(
  () => authStore.provider,
  (newProvider) => {
    if (newProvider) {
      populateForm()
      loadProviderCurrency()
    }
  }
)

async function handleSubmit() {
  if (!authStore.user || !authStore.profile) return

  loading.value = true
  clearMessages()
  
  // Validate form
  if (!form.value.business_name || !form.value.business_name.trim()) {
    showError(t('provider_profile.business_name_required'))
    loading.value = false
    return
  }

  if (!contactName.value || !contactName.value.trim()) {
    showError(t('provider_profile.contact_name_required'))
    loading.value = false
    return
  }

  if (!contactPhone.value || !contactPhone.value.trim()) {
    showError(t('provider_profile.contact_phone_required'))
    loading.value = false
    return
  }

  // Capture if we are editing (provider exists) before saving and potentially updating store

  try {
    await saveProvider({
      user: authStore.user,
      profile: authStore.profile,
      provider: authStore.provider,
      form: {
        ...form.value,
        currency: providerCurrency.value
      },
      logoFile: logoFile.value,
      planName: selectedPlan.value
    })

    settingsStore.setCurrency(providerCurrency.value)

    await authStore.updateProfile({
      name: contactName.value,
      phone: contactPhone.value
    })

    showSuccess(isEditing.value
      ? t('provider_profile.save_success_edit')
      : t('provider_profile.save_success_new'))

    await authStore.fetchProviderProfile()

    router.push('/provider/dashboard')
  } catch (e) {
    showError(e instanceof Error ? e.message : t('provider_profile.save_error'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center p-6">
    <div class="w-full max-w-2xl">
      <BackButton v-if="isEditing" to="/provider/dashboard" />
      <section class="profile-panel">
        <header class="profile-panel__header">
          <h1 class="profile-panel__title">{{ isEditing ? $t('provider_profile.title_edit') : $t('provider_profile.title_new') }}</h1>
          <p class="profile-panel__description">
            {{ isEditing ? $t('provider_profile.subtitle_edit') : $t('provider_profile.subtitle_new') }}
          </p>
        </header>

        <div class="profile-panel__body">
          <form @submit.prevent="handleSubmit" id="profile-form" class="space-y-6">
            
            <!-- Business Details -->
            <div class="space-y-4">
              <div class="flex items-center gap-2 mb-4 text-primary-600">
                <Building class="h-5 w-5" />
                <h3 class="font-semibold truncate">{{ $t('provider_profile.business') }}</h3>
              </div>
              
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <label for="business_name" class="profile-label">{{ $t('provider_profile.business_name') }} <span class="text-red-500">*</span></label>
                  <input
                    id="business_name"
                    v-model="form.business_name"
                    required
                    class="profile-input"
                    placeholder="e.g. Elite Cuts"
                  />
                </div>

                <div class="grid gap-2">
                  <ImageUpload
                    v-model="form.logo_url"
                    :label="$t('provider_profile.logo_label')"
                    :help-text="$t('provider_profile.logo_help')"
                    :processing="loading"
                    @change="file => logoFile = file"
                  />
                </div>
              </div>
            </div>

            <!-- Contact Person -->
            <div class="space-y-4 pt-4 border-t border-gray-100">
              <div class="flex items-center gap-2 mb-4 text-primary-600">
                <User class="h-5 w-5" />
                <h3 class="font-semibold truncate">{{ $t('provider_profile.contact_section') }}</h3>
              </div>

              <div class="grid gap-4">
                <div class="grid gap-2">
                  <label for="contact_name" class="profile-label">{{ $t('provider_profile.contact_name') }} <span class="text-red-500">*</span></label>
                  <input
                    id="contact_name"
                    v-model="contactName"
                    required
                    class="profile-input"
                    :placeholder="$t('provider_profile.contact_name_placeholder')"
                  />
                </div>

                <div class="grid gap-2">
                  <label for="contact_phone" class="profile-label">{{ $t('provider_profile.contact_phone') }} <span class="text-red-500">*</span></label>
                  <input
                    id="contact_phone"
                    v-model="contactPhone"
                    type="tel"
                    required
                    class="profile-input"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <!-- Service Settings -->
            <div class="profile-section profile-section--divided">
              <div class="profile-section__heading">
                <Coins class="profile-section__icon" />
                <h3 class="profile-section__title">{{ $t('provider_profile.service_settings') }}</h3>
              </div>

              <div class="profile-currency-row">
                <div class="profile-currency-row__copy">
                  <label for="provider_currency" class="profile-label">{{ $t('provider_profile.currency') }}</label>
                  <p class="profile-help">{{ $t('provider_profile.currency_help') }}</p>
                </div>

                <select
                  id="provider_currency"
                  v-model="providerCurrency"
                  class="profile-input profile-currency-row__select"
                >
                  <option v-for="currency in currencyOptions" :key="currency" :value="currency">
                    {{ currency }}
                  </option>
                </select>
              </div>

              <div v-if="currencyWillUpdateServices" class="profile-notice" role="status">
                {{ $t('provider_profile.currency_change_notice', { currency: providerCurrency }) }}
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-4 pt-4 border-t border-gray-100">
              <div class="flex items-center gap-2 mb-4 text-primary-600">
                <FileText class="h-5 w-5" />
                <h3 class="font-semibold truncate">{{ $t('provider_profile.description') }}</h3>
              </div>

              <div class="grid gap-4">
                <div class="grid gap-2">
                  <label for="description" class="profile-label">{{ $t('provider_profile.description') }}</label>
                  <textarea
                    id="description"
                    v-model="form.description"
                    rows="4"
                    class="profile-textarea"
                    :placeholder="$t('provider_profile.description_placeholder')"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Error Alert -->
            <div v-if="errorMessage" class="profile-error" role="alert">
              <p class="profile-error__title">Error</p>
              <p>{{ errorMessage }}</p>
            </div>

          </form>
        </div>

        <footer class="profile-panel__footer">
          <SubmitButton
            type="button"
            :loading="loading"
            :label="$t('common.save_profile')"
            :loading-label="$t('common.loading')"
            class="profile-submit"
            @click="handleSubmit"
          />
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.profile-panel {
  @apply overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm;
}

.profile-panel__header {
  @apply border-b border-gray-100 px-6 py-5;
}

.profile-panel__title {
  @apply text-2xl font-semibold text-gray-950;
}

.profile-panel__description {
  @apply mt-1 text-sm text-gray-600;
}

.profile-panel__body {
  @apply px-6 py-6;
}

.profile-panel__footer {
  @apply flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-4;
}

.profile-section {
  @apply space-y-4;
}

.profile-section--divided {
  @apply border-t border-gray-100 pt-4;
}

.profile-section__heading {
  @apply mb-4 flex items-center gap-2 text-primary-600;
}

.profile-section__icon {
  @apply h-5 w-5;
}

.profile-section__title {
  @apply truncate font-semibold;
}

.profile-label {
  @apply text-sm font-medium text-gray-800;
}

.profile-help {
  @apply mt-1 text-sm text-gray-500;
}

.profile-input {
  @apply h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200;
}

.profile-currency-row {
  @apply grid gap-3 sm:grid-cols-[1fr_160px] sm:items-start;
}

.profile-currency-row__copy {
  @apply min-w-0;
}

.profile-currency-row__select {
  @apply sm:max-w-40;
}

.profile-notice {
  @apply rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800;
}

.profile-textarea {
  @apply min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200;
}

.profile-error {
  @apply rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.profile-error__title {
  @apply font-semibold;
}

.profile-submit {
  @apply inline-flex min-w-[150px] items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60;
}
</style>
