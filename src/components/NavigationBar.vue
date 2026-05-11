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
  Download,
  Store
} from 'lucide-vue-next'
import { usePwaInstall } from '@/composables/usePwaInstall'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { canInstall, installApp } = usePwaInstall()

const navRoot = ref<HTMLElement | null>(null)
const showMobileMenu = ref(false)
const appVersion = import.meta.env.APP_VERSION

watch(() => route.path, () => {
  closeMenus()
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
  const isOwnProviderLanding = route.name === 'ProviderLanding' && route.params.providerSlug === authStore.provider?.slug

  if (hasProvider && hasCustomer) {
    if (route.path === '/' || route.path.startsWith('/provider') || isOwnProviderLanding) return 'Provider'
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

const roleBadgeClass = computed(() => {
  if (userRole.value === 'Provider') return 'role-pill--provider'
  if (userRole.value === 'Customer') return 'role-pill--customer'
  return 'role-pill--default'
})

function closeMenus() {
  showMobileMenu.value = false
  navRoot.value?.querySelectorAll('details[open]').forEach(menu => {
    menu.removeAttribute('open')
  })
}

function navigateToProviderLogin() {
  closeMenus()
  router.push('/login?redirect=/provider')
}

function navigateToDashboard() {
  closeMenus()
  router.push('/provider/dashboard')
}

function navigateToMiniSite() {
  closeMenus()
  router.push({ path: `/${authStore.provider!.slug}`, query: { menu: '1' } })
}

function navigateToProfile() {
  closeMenus()
  if (userRole.value === 'Provider') {
    router.push('/provider/profile')
  } else {
    router.push('/profile')
  }
}

function switchToCustomer() {
  closeMenus()
  router.push('/my-bookings')
}

function switchToProvider() {
  closeMenus()
  router.push('/provider/dashboard')
}

function navigateToSubscription() {
  closeMenus()
  router.push('/provider/subscription')
}

async function handleLogout() {
  closeMenus()
  await authStore.signOut()
  router.push('/')
}

function navigateToMyBookings() {
  closeMenus()
  router.push('/my-bookings')
}

function navigateToSuperAdmin() {
  closeMenus()
  router.push('/super-admin/dashboard')
}

function changeLanguage(lang: string) {
  settingsStore.setLanguage(lang)
  closeMenus()
}

async function handleInstallApp() {
  closeMenus()
  await installApp()
}
</script>

<template>
  <header ref="navRoot" class="app-nav">
    <div class="app-nav__shell">
      <div class="app-nav__bar">
        <button class="brand-mark" type="button" @click="router.push('/'); closeMenus()">
          <span>Agendaly</span>
          <small>System test alpha {{ appVersion }}</small>
        </button>

        <div class="desktop-nav">
          <details class="nav-menu">
            <summary class="nav-command nav-command--compact">
              <span class="language-flag">{{ currentLanguageFlag }}</span>
              <ChevronDown />
            </summary>
            <div class="nav-menu__content nav-menu__content--small">
              <button
                v-for="lang in languages"
                :key="lang.code"
                class="menu-item"
                type="button"
                @click="changeLanguage(lang.code)"
              >
                <span>{{ lang.flag }}</span>
                {{ lang.label }}
              </button>
            </div>
          </details>

          <button v-if="canInstall" class="nav-command" type="button" @click="handleInstallApp">
            <Download />
            {{ $t('nav.install_app') }}
          </button>

          <details v-if="authStore.isAuthenticated" class="nav-menu nav-menu--account">
            <summary class="account-trigger">
              <span class="avatar-shell">
                <img v-if="userLogo" :src="userLogo" :alt="userName">
                <span v-else>{{ userInitials }}</span>
              </span>
              <span class="account-copy">
                <strong>{{ userName }}</strong>
                <span v-if="userRole" class="role-pill" :class="roleBadgeClass">
                  {{ $t('roles.' + userRole.toLowerCase()) }}
                </span>
              </span>
              <ChevronDown />
            </summary>

            <div class="nav-menu__content nav-menu__content--account">
              <div class="account-summary">
                <strong>{{ userName }}</strong>
                <span>{{ authStore.user?.email }}</span>
              </div>

              <button v-if="authStore.isSuperAdmin" class="menu-item menu-item--admin" type="button" @click="navigateToSuperAdmin">
                <LayoutDashboard />
                Super Admin
              </button>

              <div class="menu-divider" />

              <template v-if="userRole === 'Provider'">
                <button class="menu-item" type="button" @click="navigateToDashboard">
                  <LayoutDashboard />
                  {{ $t('nav.dashboard') }}
                </button>
                <button class="menu-item" type="button" @click="navigateToMiniSite">
                  <Store />
                  {{ $t('nav.my_mini_site') }}
                </button>
                <button class="menu-item" type="button" @click="navigateToProfile">
                  <User />
                  {{ $t('nav.business_profile') }}
                </button>
                <button class="menu-item" type="button" @click="navigateToSubscription">
                  <CreditCard />
                  {{ $t('nav.subscription') }}
                </button>

                <template v-if="authStore.customer">
                  <div class="menu-divider" />
                  <button class="menu-item menu-item--customer" type="button" @click="switchToCustomer">
                    <User />
                    {{ $t('nav.switch_to_customer') }}
                  </button>
                </template>
              </template>

              <template v-else-if="userRole === 'Customer'">
                <button class="menu-item" type="button" @click="navigateToMyBookings">
                  <CalendarDays />
                  {{ $t('nav.my_bookings') }}
                </button>
                <button class="menu-item" type="button" @click="navigateToProfile">
                  <User />
                  {{ $t('nav.profile') }}
                </button>

                <template v-if="authStore.provider">
                  <div class="menu-divider" />
                  <button class="menu-item menu-item--provider" type="button" @click="switchToProvider">
                    <Briefcase />
                    {{ $t('nav.switch_to_provider') }}
                  </button>
                </template>
              </template>

              <div class="menu-divider" />
              <button class="menu-item menu-item--danger" type="button" @click="handleLogout">
                <LogOut />
                {{ $t('nav.logout') }}
              </button>
            </div>
          </details>

          <button v-else class="nav-command" type="button" @click="navigateToProviderLogin">
            {{ $t('nav.provider_login') }}
          </button>
        </div>

        <button class="mobile-toggle" type="button" @click="showMobileMenu = !showMobileMenu">
          <Menu v-if="!showMobileMenu" />
          <X v-else />
        </button>
      </div>
    </div>

    <div v-if="showMobileMenu" class="mobile-menu">
      <div v-if="authStore.isAuthenticated" class="mobile-account">
        <span class="avatar-shell">
          <img v-if="userLogo" :src="userLogo" :alt="userName">
          <span v-else>{{ userInitials }}</span>
        </span>
        <div>
          <strong>{{ userName }}</strong>
          <span>{{ authStore.user?.email }}</span>
          <span v-if="userRole" class="role-pill" :class="roleBadgeClass">
            {{ $t('roles.' + userRole.toLowerCase()) }}
          </span>
        </div>
      </div>

      <div class="mobile-language">
        <p>Language</p>
        <div>
          <button
            v-for="lang in languages"
            :key="lang.code"
            class="language-option"
            :class="{ 'is-active': settingsStore.language === lang.code }"
            type="button"
            @click="changeLanguage(lang.code)"
          >
            <span>{{ lang.flag }}</span>
            {{ lang.code.toUpperCase() }}
          </button>
        </div>
      </div>

      <nav class="mobile-nav">
        <button v-if="canInstall" class="mobile-nav__item" type="button" @click="handleInstallApp">
          <Download />
          {{ $t('nav.install_app') }}
        </button>

        <template v-if="authStore.isAuthenticated">
          <template v-if="userRole === 'Provider'">
            <button class="mobile-nav__item" type="button" @click="navigateToDashboard">
              <LayoutDashboard />
              {{ $t('nav.dashboard') }}
            </button>
            <button class="mobile-nav__item" type="button" @click="navigateToMiniSite">
              <Store />
              {{ $t('nav.my_mini_site') }}
            </button>
            <button class="mobile-nav__item" type="button" @click="navigateToProfile">
              <User />
              {{ $t('nav.business_profile') }}
            </button>
            <button class="mobile-nav__item" type="button" @click="navigateToSubscription">
              <CreditCard />
              {{ $t('nav.subscription') }}
            </button>
            <button v-if="authStore.customer" class="mobile-nav__item mobile-nav__item--customer" type="button" @click="switchToCustomer">
              <User />
              {{ $t('nav.switch_to_customer') }}
            </button>
          </template>

          <template v-else-if="userRole === 'Customer'">
            <button class="mobile-nav__item" type="button" @click="navigateToMyBookings">
              <CalendarDays />
              {{ $t('nav.my_bookings') }}
            </button>
            <button class="mobile-nav__item" type="button" @click="navigateToProfile">
              <User />
              {{ $t('nav.profile') }}
            </button>
            <button v-if="authStore.provider" class="mobile-nav__item mobile-nav__item--provider" type="button" @click="switchToProvider">
              <Briefcase />
              {{ $t('nav.switch_to_provider') }}
            </button>
          </template>

          <button class="mobile-nav__item mobile-nav__item--danger" type="button" @click="handleLogout">
            <LogOut />
            {{ $t('nav.logout') }}
          </button>
        </template>

        <button v-else class="mobile-nav__item" type="button" @click="navigateToProviderLogin">
          <User />
          {{ $t('nav.provider_login') }}
        </button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
@reference "../style.css";

.app-nav {
  @apply sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 text-gray-950 backdrop-blur;
}

.app-nav__shell {
  @apply mx-auto max-w-7xl px-4 sm:px-6 lg:px-8;
}

.app-nav__bar {
  @apply flex h-16 items-center justify-between;
}

.brand-mark {
  @apply flex cursor-pointer items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2;
}

.brand-mark span {
  @apply text-2xl font-bold text-primary-600;
}

.brand-mark small {
  @apply text-xs text-gray-500;
}

.desktop-nav {
  @apply hidden items-center gap-3 md:flex;
}

.nav-command,
.account-trigger,
.mobile-toggle {
  @apply inline-flex items-center justify-center gap-2 rounded-md bg-transparent px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2;
}

.nav-command {
  @apply h-10;
}

.desktop-nav .nav-command,
.desktop-nav .account-trigger {
  @apply border border-gray-200 bg-white;
}

.nav-command--compact {
  @apply px-2;
}

.nav-command svg,
.account-trigger svg,
.mobile-toggle svg,
.menu-item svg,
.mobile-nav__item svg {
  @apply h-4 w-4 shrink-0;
}

.language-flag {
  @apply text-xl leading-none;
}

.nav-menu {
  @apply relative;
}

.nav-menu summary {
  @apply list-none;
}

.nav-menu summary::-webkit-details-marker {
  @apply hidden;
}

.nav-menu__content {
  @apply absolute right-0 top-[calc(100%+8px)] z-50 grid min-w-56 gap-1 rounded-xl border border-gray-200 bg-white p-2 text-sm shadow-lg;
}

.nav-menu__content--small {
  @apply min-w-40;
}

.account-trigger {
  @apply h-12 px-2;
}

.avatar-shell {
  @apply inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-xs font-bold text-white;
}

.avatar-shell img {
  @apply h-full w-full object-cover;
}

.account-copy {
  @apply flex max-w-40 flex-col items-start text-left;
}

.account-copy strong {
  @apply max-w-full truncate text-sm font-medium leading-none;
}

.role-pill {
  @apply mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium;
}

.role-pill--provider {
  @apply bg-purple-100 text-purple-800;
}

.role-pill--customer {
  @apply bg-blue-100 text-blue-800;
}

.role-pill--both,
.role-pill--default {
  @apply bg-green-100 text-green-800;
}

.account-summary {
  @apply grid gap-1 px-2 py-2;
}

.account-summary strong {
  @apply truncate text-sm font-semibold;
}

.account-summary span {
  @apply truncate text-xs text-gray-500;
}

.menu-item {
  @apply flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-300;
}

.menu-item span {
  @apply text-lg leading-none;
}

.menu-item--admin {
  @apply font-semibold text-indigo-600;
}

.menu-item--customer {
  @apply font-medium text-blue-600 hover:text-blue-700;
}

.menu-item--provider {
  @apply font-medium text-purple-600 hover:text-purple-700;
}

.menu-item--danger {
  @apply text-red-600 hover:bg-red-50 hover:text-red-700;
}

.menu-divider {
  @apply my-1 h-px bg-gray-100;
}

.mobile-toggle {
  @apply h-10 w-10 p-0 md:hidden;
}

.mobile-toggle svg {
  @apply h-6 w-6;
}

.mobile-menu {
  @apply border-t border-gray-200 bg-white px-4 py-4 md:hidden;
}

.mobile-account {
  @apply mb-4 flex items-center gap-4 border-b border-gray-100 pb-4;
}

.mobile-account > div {
  @apply grid gap-1;
}

.mobile-account strong {
  @apply text-sm font-medium;
}

.mobile-account span {
  @apply text-xs text-gray-500;
}

.mobile-language {
  @apply border-b border-gray-100 pb-4;
}

.mobile-language p {
  @apply mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500;
}

.mobile-language > div {
  @apply flex gap-2;
}

.language-option {
  @apply inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300;
}

.language-option.is-active {
  @apply border-primary-500 bg-primary-50 text-primary-700;
}

.mobile-nav {
  @apply mt-4 flex flex-col gap-2;
}

.mobile-nav__item {
  @apply inline-flex h-12 items-center justify-start gap-2 rounded-md px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-300;
}

.mobile-nav__item svg {
  @apply h-5 w-5;
}

.mobile-nav__item--customer {
  @apply text-blue-600 hover:bg-blue-50 hover:text-blue-700;
}

.mobile-nav__item--provider {
  @apply text-purple-600 hover:bg-purple-50 hover:text-purple-700;
}

.mobile-nav__item--danger {
  @apply text-red-600 hover:bg-red-50 hover:text-red-700;
}
</style>
