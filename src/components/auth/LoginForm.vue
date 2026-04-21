<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PinInput,
  PinInputGroup,
  PinInputSlot,
} from '@/components/ui/pin-input'
import { Mail, ArrowLeft, RefreshCw } from 'lucide-vue-next'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const props = defineProps<{
  redirect?: string
  embedded?: boolean
  onBeforeOAuthRedirect?: () => void
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
useI18n()

const email = ref('')
const otpValue = ref<string[]>([])
const codeSent = ref(false)

watch(otpValue, (newVal) => {
  if (newVal.length === 6 && newVal.every(v => v !== '')) {
    verifyCode()
  }
})

async function sendCode() {
  if (!email.value) return
  
  // Persist the redirect intent for OTP flow so that
  // ensureProfileAndCustomer can detect provider/admin context
  const redirectIntent = route.query.redirect as string || props.redirect
  if (redirectIntent) {
    localStorage.setItem('authRedirect', redirectIntent)
  } else {
    localStorage.removeItem('authRedirect')
  }
  
  try {
    await authStore.sendOtpCode(email.value)
    codeSent.value = true
  } catch (error) {
    console.error('Failed to send code:', error)
  }
}

async function verifyCode() {
  const code = otpValue.value.join('')
  if (!email.value || code.length !== 6) return
  
  try {
    await authStore.verifyOtpCode(email.value, code)
    
    // Clear authRedirect after successful OTP verify
    // (it was consumed by ensureProfileAndCustomer during verifyOtpCode)
    localStorage.removeItem('authRedirect')
    
    if (props.redirect) {
         router.push(props.redirect)
    } else {
        emit('success')
    }
  } catch (error) {
    console.error('Verification failed:', error)
    otpValue.value = []
  }
}

function goBack() {
  codeSent.value = false
  otpValue.value = []
}

function handleGoogleSignIn() {
  // Call the callback to save state before OAuth redirect
  if (props.onBeforeOAuthRedirect) {
    props.onBeforeOAuthRedirect()
  }
  
  // Get redirect from route query or props
  // Only redirect to /booking if we have a booking callback (i.e., we're in the booking flow)
  // The presence of onBeforeOAuthRedirect indicates we're in the booking flow, not just `embedded`
  const isInBookingFlow = !!props.onBeforeOAuthRedirect
  const redirect = isInBookingFlow ? '/booking' : (route.query.redirect as string || props.redirect)
  authStore.signInWithOAuth(redirect)
}
</script>

<template>
  <div :class="embedded ? 'w-full' : 'max-w-md w-full'">
    <Alert v-if="authStore.error" variant="destructive" class="mb-6">
      <AlertDescription>{{ authStore.error }}</AlertDescription>
    </Alert>

    <div v-if="!codeSent" class="grid gap-6">
      <div class="grid gap-4">
        <Button variant="outline" type="button" :disabled="authStore.loading" @click="handleGoogleSignIn">
          <svg class="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
          </svg>
          {{ $t('auth.continue_with_google') }}
        </Button>
      </div>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">
            {{ $t('auth.or_continue_with') }}
          </span>
        </div>
      </div>

      <form @submit.prevent="sendCode">
        <div class="grid gap-4">
          <div class="grid gap-2">
            <Label for="email">{{ $t('auth.email') }}</Label>
            <div class="relative">
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="name@example.com"
                required
                :disabled="authStore.loading"
                class="bg-background pr-10"
              />
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                <Mail class="h-4 w-4" />
              </div>
            </div>
          </div>
          
          <Button type="submit" :disabled="authStore.loading || !email">
            <LoadingSpinner v-if="authStore.loading" inline size="sm" class="mr-2" color="text-white" />
            {{ authStore.loading ? $t('common.sending') : $t('auth.send_code') }}
          </Button>
        </div>
      </form>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">
            {{ $t('auth.verification_email_notice') }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="grid gap-6">
      <div class="flex flex-col space-y-2 text-center">
        <h2 class="text-2xl font-semibold tracking-tight">{{ $t('auth.enter_code') }}</h2>
        <p class="text-sm text-muted-foreground" v-html="$t('auth.code_sent_to', { email: `<span class='font-medium text-foreground'>${email}</span>` })"></p>
      </div>

      <div class="flex justify-center py-4">
        <PinInput
          v-model="otpValue"
          placeholder="○"
          class="flex gap-2 items-center justify-center"
          :disabled="authStore.loading"
          :otp="true"
        >
          <PinInputGroup class="gap-2">
            <PinInputSlot
              v-for="n in 6"
              :key="n"
              :index="n - 1"
              class="w-10 h-12 text-lg border rounded-md text-center focus:ring-2 focus:ring-primary-500"
            />
          </PinInputGroup>
        </PinInput>
      </div>

      <Button 
        @click="verifyCode" 
        :disabled="authStore.loading || otpValue.length !== 6 || otpValue.some(v => v === '')"
        class="w-full"
      >
        <LoadingSpinner v-if="authStore.loading" inline size="sm" class="mr-2" color="text-white" />
        {{ authStore.loading ? $t('common.verifying') : $t('auth.verify_code') }}
      </Button>

      <div class="flex flex-col space-y-4">
        <Button variant="outline" @click="sendCode" :disabled="authStore.loading">
          <RefreshCw class="mr-2 h-4 w-4" />
          {{ $t('auth.resend_code') }}
        </Button>
        
        <Button variant="ghost" @click="goBack" class="text-sm text-muted-foreground">
          <ArrowLeft class="mr-2 h-4 w-4" />
          {{ $t('auth.change_email') }}
        </Button>
      </div>
    </div>
  </div>
</template>
