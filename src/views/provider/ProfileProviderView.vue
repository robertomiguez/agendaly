<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/useAuthStore'
import ImageUpload from '../../components/ImageUpload.vue'
import { saveProvider } from '../../services/providerService'
import { useNotifications } from '../../composables/useNotifications'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea' // Assuming Textarea component exists or use native
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Building, Phone, FileText } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()

const selectedPlan = computed(() => route.query.plan as string || null)

const form = ref({
  business_name: '',
  description: '',
  phone: '',
  logo_url: null as string | null
})

const logoFile = ref<File | null>(null)
const loading = ref(false)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { showSuccess, showError, errorMessage, clearMessages } = useNotifications()

const isEditing = computed(() => !!authStore.provider)


// Populate form when data is available
function populateForm() {
  if (authStore.provider) {
    form.value = {
      business_name: authStore.provider.business_name || '',
      phone: authStore.provider.phone || '',
      description: authStore.provider.description || '',
      logo_url: authStore.provider.logo_url || null
    }
  }
}

onMounted(() => {
  populateForm()
})

// Watch for store changes (in case of page reload)
watch(
  () => authStore.provider,
  (newProvider) => {
    if (newProvider) {
      populateForm()
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  if (!authStore.user) return

  loading.value = true
  clearMessages()
  
  // Validate form
  if (!form.value.business_name || !form.value.business_name.trim()) {
    showError(t('provider_profile.business_name_required'))
    loading.value = false
    return
  }

  // Capture if we are editing (provider exists) before saving and potentially updating store

  try {
    await saveProvider({
      user: authStore.user,
      provider: authStore.provider,
      form: form.value,
      logoFile: logoFile.value,
      planName: selectedPlan.value
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
      <Card>
        <CardHeader>
          <CardTitle>{{ isEditing ? $t('provider_profile.title_edit') : $t('provider_profile.title_new') }}</CardTitle>
          <CardDescription>
            {{ isEditing ? $t('provider_profile.subtitle_edit') : $t('provider_profile.subtitle_new') }}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form @submit.prevent="handleSubmit" id="profile-form" class="space-y-6">
            
            <!-- Business Details -->
            <div class="space-y-4">
              <div class="flex items-center gap-2 mb-4 text-primary-600">
                <Building class="h-5 w-5" />
                <h3 class="font-semibold">{{ $t('provider_profile.business_name') }}</h3>
              </div>
              
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <Label for="business_name">{{ $t('provider_profile.business_name') }} <span class="text-red-500">*</span></Label>
                  <Input
                    id="business_name"
                    v-model="form.business_name"
                    required
                    placeholder="e.g. Elite Cuts"
                  />
                </div>

                <div class="grid gap-2">
                  <Label>{{ $t('provider_profile.logo_label') }}</Label>
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

            <!-- Contact & Description -->
            <div class="space-y-4 pt-4 border-t border-gray-100">
              <div class="flex items-center gap-2 mb-4 text-primary-600">
                <FileText class="h-5 w-5" />
                <h3 class="font-semibold">{{ $t('provider_profile.description') }} & Contact</h3>
              </div>

              <div class="grid gap-4">
                <div class="grid gap-2">
                  <Label for="description">{{ $t('provider_profile.description') }}</Label>
                  <Textarea
                    id="description"
                    v-model="form.description"
                    rows="4"
                    :placeholder="$t('provider_profile.description_placeholder')"
                  />
                </div>

                <div class="grid gap-2">
                  <Label for="phone">{{ $t('provider_profile.phone_number') }}</Label>
                  <div class="relative">
                    <Phone class="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      v-model="form.phone"
                      type="tel"
                      required
                      class="pl-9"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Error Alert -->
            <Alert v-if="errorMessage" variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{{ errorMessage }}</AlertDescription>
            </Alert>

          </form>
        </CardContent>

        <CardFooter class="flex justify-end">
          <Button 
            @click="handleSubmit" 
            :disabled="loading"
            class="min-w-[150px]"
          >
            <LoadingSpinner v-if="loading" inline size="sm" class="mr-2" color="text-white" />
            {{ loading ? $t('common.loading') : $t('common.save_profile') }}
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
