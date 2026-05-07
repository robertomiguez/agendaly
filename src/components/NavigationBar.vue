<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { 
  Briefcase, 
  LayoutDashboard, 
  CalendarDays, 
  User, 
  LogOut, 
  Menu, 
  X,
  ChevronDown,
  CreditCard,
  Download
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { usePwaInstall } from '@/composables/usePwaInstall'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { canInstall, installApp } = usePwaInstall()

const showMobileMenu = ref(false)
const appVersion = import.meta.env.APP_VERSION

watch(() => route.path, () => {
  showMobileMenu.value = false
})

const languages = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'pt', flag: '🇧🇷', label: 'Português' }
]

const currentLanguageFlag = computed(() => {
  return languages.find(l => l.code === settingsStore.language)?.flag || '🇺🇸'
})

const userRole = computed(() => {
  if (authStore.isSuperAdmin) return 'Admin'

  const hasProvider = authStore.provider !== null
  const hasCustomer = authStore.customer !== null

  if (hasProvider && hasCustomer) {
    if (route.path.startsWith('/provider')) return 'Provider'
    return 'Customer'
  }

  if (hasProvider) return 'Provider'
  if (hasCustomer) return 'Customer'
  
  return null
})

const userName = computed(() => {
  if (authStore.superAdmin) return authStore.profile?.name || 'Super Admin'
  if (authStore.provider && userRole.value === 'Provider') return authStore.provider.business_name
  if (authStore.profile) return authStore.profile.name || 'Customer'
  if (authStore.provider) return authStore.provider.business_name
  return authStore.user?.email || 'User'
})

const userInitials = computed(() => {
  const name = userName.value
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const userLogo = computed(() => {
  if (authStore.provider && userRole.value === 'Provider') return authStore.provider.logo_url
  if (authStore.profile) return authStore.profile.avatar_url
  return null
})

const ROLE_COLORS = {
  Provider: 'bg-purple-100 text-purple-800',
  Customer: 'bg-blue-100 text-blue-800',
  Both: 'bg-green-100 text-green-800',
  Default: 'bg-green-100 text-gray-800'
} as const

const roleBadgeColor = computed(() => {
  return ROLE_COLORS[userRole.value as keyof typeof ROLE_COLORS] || ROLE_COLORS.Default
})

function navigateToForBusiness() {
  showMobileMenu.value = false
  if (authStore.provider) {
    router.push('/provider/dashboard')
  } else {
    router.push('/for-business')
  }
}

function navigateToLogin() {
  showMobileMenu.value = false
  router.push('/login')
}

function navigateToDashboard() {
  showMobileMenu.value = false
  router.push('/provider/dashboard')
}

function navigateToProfile() {
  showMobileMenu.value = false
  if (userRole.value === 'Provider') {
    router.push('/provider/profile')
  } else {
    router.push('/profile')
  }
}

function switchToCustomer() {
  showMobileMenu.value = false
  router.push('/')
}

function switchToProvider() {
  showMobileMenu.value = false
  router.push('/provider/dashboard')
}

function navigateToSubscription() {
  showMobileMenu.value = false
  router.push('/provider/subscription')
}

async function handleLogout() {
  showMobileMenu.value = false
  await authStore.signOut()
  router.push('/')
}

function navigateToMyBookings() {
  showMobileMenu.value = false
  router.push('/my-bookings')
}

function navigateToSuperAdmin() {
  showMobileMenu.value = false
  router.push('/super-admin/dashboard')
}

function changeLanguage(lang: string) {
  settingsStore.setLanguage(lang)
  showMobileMenu.value = false
}

async function handleInstallApp() {
  showMobileMenu.value = false
  await installApp()
}
</script>

<template>
  <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center">
          <a class="flex items-center space-x-2 cursor-pointer" @click="router.push('/'); showMobileMenu = false">
            <span class="font-bold text-2xl text-primary-600 inline-block">Agendaly</span>
            <span class="text-xs text-muted-foreground ml-1">System test alpha {{ appVersion }}</span>
          </a>
        </div>

        <!-- Desktop Nav -->
        <div class="hidden md:flex items-center gap-4">
          <!-- Language Switcher -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" class="flex items-center gap-1 h-10 px-3">
                <span class="text-xl">{{ currentLanguageFlag }}</span>
                <ChevronDown class="w-4 h-4 text-muted-foreground opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                v-for="lang in languages" 
                :key="lang.code" 
                @click="changeLanguage(lang.code)"
                class="cursor-pointer"
              >
                <span class="mr-2 text-lg">{{ lang.flag }}</span>
                {{ lang.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- For Business -->
          <Button variant="ghost" @click="navigateToForBusiness" class="flex items-center gap-2">
            <Briefcase class="h-4 w-4" />
            {{ $t('nav.for_business') }}
          </Button>

          <Button v-if="canInstall" variant="ghost" @click="handleInstallApp" class="flex items-center gap-2">
            <Download class="h-4 w-4" />
            {{ $t('nav.install_app') }}
          </Button>

          <!-- User Menu -->
          <div v-if="authStore.isAuthenticated">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" class="flex items-center gap-2 h-12 px-2 hover:bg-gray-100 rounded-lg">
                  <Avatar class="h-8 w-8">
                    <AvatarImage v-if="userLogo" :src="userLogo" :alt="userName" />
                    <AvatarFallback :class="!userLogo ? 'bg-primary-600 text-white' : ''">{{ userInitials }}</AvatarFallback>
                  </Avatar>
                  <div class="flex flex-col items-start text-left mr-1">
                    <span class="text-sm font-medium leading-none">{{ userName }}</span>
                    <span v-if="userRole" :class="['text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1', roleBadgeColor]">
                      {{ $t('roles.' + userRole.toLowerCase()) }}
                    </span>
                  </div>
                  <ChevronDown class="h-4 w-4 text-muted-foreground opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent class="w-56" align="end">
                <DropdownMenuLabel class="font-normal">
                  <div class="flex flex-col space-y-1">
                    <p class="text-sm font-medium leading-none">{{ userName }}</p>
                    <p class="text-xs leading-none text-muted-foreground">
                      {{ authStore.user?.email }}
                    </p>
                    <DropdownMenuItem v-if="authStore.isSuperAdmin" @click="navigateToSuperAdmin" class="cursor-pointer font-bold text-indigo-600">
                      <LayoutDashboard class="mr-2 h-4 w-4" />
                      Super Admin
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <!-- Provider Context -->
                <template v-if="userRole === 'Provider'">
                  <DropdownMenuItem @click="navigateToDashboard" class="cursor-pointer">
                    <LayoutDashboard class="mr-2 h-4 w-4" />
                    {{ $t('nav.dashboard') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="navigateToProfile" class="cursor-pointer">
                    <User class="mr-2 h-4 w-4" />
                    {{ $t('nav.business_profile') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="navigateToSubscription" class="cursor-pointer">
                    <CreditCard class="mr-2 h-4 w-4" />
                    {{ $t('nav.subscription') }}
                  </DropdownMenuItem>
                  
                  <template v-if="authStore.customer">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem @click="switchToCustomer" class="cursor-pointer font-medium text-blue-600 focus:text-blue-700">
                      <User class="mr-2 h-4 w-4" />
                      Switch to Customer
                    </DropdownMenuItem>
                  </template>
                </template>

                <!-- Customer Context -->
                <template v-else-if="userRole === 'Customer'">
                  <DropdownMenuItem @click="navigateToMyBookings" class="cursor-pointer">
                    <CalendarDays class="mr-2 h-4 w-4" />
                    {{ $t('nav.my_bookings') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="navigateToProfile" class="cursor-pointer">
                    <User class="mr-2 h-4 w-4" />
                    {{ $t('nav.profile') }}
                  </DropdownMenuItem>
                  
                  <template v-if="authStore.provider">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem @click="switchToProvider" class="cursor-pointer font-medium text-purple-600 focus:text-purple-700">
                      <Briefcase class="mr-2 h-4 w-4" />
                      Switch to Business Dashboard
                    </DropdownMenuItem>
                  </template>
                </template>

                <DropdownMenuSeparator />
                <DropdownMenuItem @click="handleLogout" class="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut class="mr-2 h-4 w-4" />
                  {{ $t('nav.logout') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <!-- Login Button -->
          <Button v-else @click="navigateToLogin">
            {{ $t('nav.login') }}
          </Button>
        </div>
        
        <!-- Mobile Menu Toggle -->
        <Button variant="ghost" class="md:hidden" size="icon" @click="showMobileMenu = !showMobileMenu">
          <Menu v-if="!showMobileMenu" class="h-6 w-6" />
          <X v-else class="h-6 w-6" />
        </Button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-if="showMobileMenu" class="md:hidden border-t px-4 py-4 space-y-4 bg-background">
      <div v-if="authStore.isAuthenticated" class="flex items-center space-x-4 mb-4 pb-4 border-b border-gray-100">
        <Avatar>
          <AvatarImage v-if="userLogo" :src="userLogo" />
          <AvatarFallback :class="!userLogo ? 'bg-primary-600 text-white' : ''">{{ userInitials }}</AvatarFallback>
        </Avatar>
        <div>
           <p class="text-sm font-medium">{{ userName }}</p>
           <p class="text-xs text-muted-foreground">{{ authStore.user?.email }}</p>
           <span v-if="userRole" :class="['inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1', roleBadgeColor]">
             {{ $t('roles.' + userRole.toLowerCase()) }}
           </span>
        </div>
      </div>

      <!-- Mobile Language Switcher -->
      <div class="pb-4 border-b border-gray-100">
        <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Language</p>
        <div class="flex gap-2">
          <Button
            v-for="lang in languages"
            :key="lang.code"
            @click="changeLanguage(lang.code)"
            variant="outline"
            size="sm"
            class="flex-1"
            :class="{ 'bg-primary-50 border-primary-500 text-primary-700': settingsStore.language === lang.code }"
          >
            <span class="mr-1">{{ lang.flag }}</span>
            {{ lang.code.toUpperCase() }}
          </Button>
        </div>
      </div>

      <nav class="flex flex-col space-y-2">
        <Button variant="ghost" class="justify-start h-12" @click="navigateToForBusiness">
           <Briefcase class="mr-2 h-5 w-5" />
           {{ $t('nav.for_business') }}
        </Button>

        <Button v-if="canInstall" variant="ghost" class="justify-start h-12" @click="handleInstallApp">
          <Download class="mr-2 h-5 w-5" />
          {{ $t('nav.install_app') }}
        </Button>
        
        <template v-if="authStore.isAuthenticated">
          <!-- Provider Context -->
          <template v-if="userRole === 'Provider'">
            <Button variant="ghost" class="justify-start h-12" @click="navigateToDashboard">
              <LayoutDashboard class="mr-2 h-5 w-5" />
               {{ $t('nav.dashboard') }}
            </Button>
            <Button variant="ghost" class="justify-start h-12" @click="navigateToProfile">
              <User class="mr-2 h-5 w-5" />
              {{ $t('nav.business_profile') }}
            </Button>
            <Button variant="ghost" class="justify-start h-12" @click="navigateToSubscription">
              <CreditCard class="mr-2 h-5 w-5" />
              {{ $t('nav.subscription') }}
            </Button>
            
            <Button v-if="authStore.customer" variant="ghost" class="justify-start h-12 font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50" @click="switchToCustomer">
              <User class="mr-2 h-5 w-5" />
              Switch to Customer
            </Button>
          </template>

          <!-- Customer Context -->
          <template v-else-if="userRole === 'Customer'">
            <Button variant="ghost" class="justify-start h-12" @click="navigateToMyBookings">
              <CalendarDays class="mr-2 h-5 w-5" />
              {{ $t('nav.my_bookings') }}
            </Button>
            <Button variant="ghost" class="justify-start h-12" @click="navigateToProfile">
              <User class="mr-2 h-5 w-5" />
              {{ $t('nav.profile') }}
            </Button>
            
            <Button v-if="authStore.provider" variant="ghost" class="justify-start h-12 font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50" @click="switchToProvider">
              <Briefcase class="mr-2 h-5 w-5" />
              Switch to Business Dashboard
            </Button>
          </template>

           <Button 
            variant="ghost" 
            class="justify-start h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
            @click="handleLogout"
          >
            <LogOut class="mr-2 h-5 w-5" />
            {{ $t('nav.logout') }}
          </Button>
        </template>
        
        <Button v-else class="w-full" @click="navigateToLogin">
          {{ $t('nav.login') }}
        </Button>
      </nav>
    </div>
  </header>
</template>
