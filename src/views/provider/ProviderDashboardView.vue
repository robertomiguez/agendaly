<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Plus,
  Settings,
  Users
} from 'lucide-vue-next'
import LoadingSpinner from '../../components/common/LoadingSpinner.vue'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useProviderStore } from '../../stores/useProviderStore'

const authStore = useAuthStore()
const providerStore = useProviderStore()
const settingsStore = useSettingsStore()
const router = useRouter()

onMounted(async () => {
  if (!authStore.provider) {
    router.push('/booking')
    return
  }

  await providerStore.fetchDashboardStats(authStore.provider.id)
})

const hasStaff = computed(() => providerStore.stats.totalStaff > 0)
const providerName = computed(() => authStore.provider?.business_name || 'Provider')

function formatCurrency(amount: number) {
  return settingsStore.formatPrice(amount, providerStore.stats.revenueCurrency, { zeroAsFree: false })
}

function goToServices() {
  if (!hasStaff.value) return
  router.push('/provider/services')
}

function goToStaff() {
  router.push('/provider/staff')
}

function goToAddresses() {
  router.push('/provider/addresses')
}

function goToCalendar() {
  if (!hasStaff.value) return
  router.push('/provider/calendar')
}

function goToAvailability() {
  if (!hasStaff.value) return
  router.push('/provider/availability')
}

function goToRevenueReport() {
  router.push('/provider/revenue-report')
}

function goToProfile() {
  router.push('/provider/profile')
}

const dashboardStats = computed(() => [
  {
    key: 'appointments',
    label: 'dashboard.stats.today_appointments',
    value: providerStore.stats.todayAppointments,
    hint: null,
    icon: Calendar,
    tone: 'amber',
    disabled: !hasStaff.value,
    action: goToCalendar
  },
  {
    key: 'revenue',
    label: 'dashboard.stats.week_revenue',
    value: formatCurrency(providerStore.stats.weekRevenue),
    hint: 'dashboard.stats.revenue_projected_hint',
    icon: DollarSign,
    tone: 'green',
    disabled: false,
    action: goToRevenueReport
  },
  {
    key: 'services',
    label: 'dashboard.stats.active_services',
    value: providerStore.stats.activeServices,
    hint: null,
    icon: Briefcase,
    tone: 'blue',
    disabled: !hasStaff.value,
    action: goToServices
  },
  {
    key: 'staff',
    label: 'dashboard.stats.staff_members',
    value: providerStore.stats.totalStaff,
    hint: null,
    icon: Users,
    tone: 'violet',
    disabled: false,
    action: goToStaff
  }
])

const quickActions = computed(() => [
  {
    key: 'locations',
    title: 'dashboard.quick_actions.locations_title',
    description: 'dashboard.quick_actions.locations_desc',
    icon: MapPin,
    tone: 'amber',
    disabled: false,
    action: goToAddresses
  },
  {
    key: 'staff',
    title: 'dashboard.quick_actions.staff_title',
    description: 'dashboard.quick_actions.staff_desc',
    icon: Users,
    tone: 'violet',
    disabled: false,
    action: goToStaff
  },
  {
    key: 'services',
    title: 'dashboard.quick_actions.services_title',
    description: 'dashboard.quick_actions.services_desc',
    icon: Plus,
    tone: 'amber',
    disabled: !hasStaff.value,
    action: goToServices
  },
  {
    key: 'availability',
    title: 'dashboard.quick_actions.availability_title',
    description: 'dashboard.quick_actions.availability_desc',
    icon: Clock,
    tone: 'blue',
    disabled: !hasStaff.value,
    action: goToAvailability
  },
  {
    key: 'calendar',
    title: 'dashboard.quick_actions.calendar_title',
    description: 'dashboard.quick_actions.calendar_desc',
    icon: Calendar,
    tone: 'green',
    disabled: !hasStaff.value,
    action: goToCalendar
  }
])
</script>

<template>
  <div class="provider-dashboard">
    <header class="dashboard-header">
      <div class="dashboard-shell header-layout">
        <div class="header-copy">
          <p class="dashboard-kicker">{{ $t('nav.business_dashboard') }}</p>
          <h1>{{ $t('dashboard.title') }}</h1>
          <p>{{ $t('dashboard.welcome_back', { name: providerName }) }}</p>
        </div>

        <div class="header-actions">
          <button class="icon-command" type="button" aria-label="Notifications">
            <Bell />
          </button>
          <button class="icon-command" type="button" aria-label="Business settings" @click="goToProfile">
            <Settings />
          </button>
        </div>
      </div>
    </header>

    <main class="dashboard-shell dashboard-main">
      <LoadingSpinner v-if="providerStore.loading" :text="$t('dashboard.loading')" />

      <template v-else>
        <section class="metrics-grid" aria-label="Business summary">
          <button
            v-for="stat in dashboardStats"
            :key="stat.key"
            class="metric-card"
            :class="[`tone-${stat.tone}`, { 'is-disabled': stat.disabled }]"
            type="button"
            :disabled="stat.disabled"
            @click="stat.action"
          >
            <span class="metric-icon">
              <component :is="stat.icon" />
            </span>
            <span class="metric-body">
              <span class="metric-label">{{ $t(stat.label) }}</span>
              <strong>{{ stat.value }}</strong>
              <span v-if="stat.hint" class="metric-hint">{{ $t(stat.hint) }}</span>
            </span>
          </button>
        </section>

        <section v-if="providerStore.isPending" class="pending-panel">
          <AlertTriangle />
          <div>
            <h2>{{ $t('dashboard.status.pending_title') }}</h2>
            <p>{{ $t('dashboard.status.pending_desc') }}</p>
          </div>
        </section>

        <div class="dashboard-columns">
          <section class="action-panel">
            <div class="section-heading">
              <p>{{ $t('dashboard.quick_actions.title') }}</p>
              <h2>{{ $t('landing.flow_title') }}</h2>
            </div>

            <div class="action-list">
              <button
                v-for="item in quickActions"
                :key="item.key"
                class="action-row"
                :class="[`tone-${item.tone}`, { 'is-disabled': item.disabled }]"
                type="button"
                :disabled="item.disabled"
                @click="item.action"
              >
                <span class="action-icon">
                  <component :is="item.icon" />
                </span>
                <span class="action-copy">
                  <strong>{{ $t(item.title) }}</strong>
                  <span>{{ $t(item.description) }}</span>
                </span>
              </button>
            </div>
          </section>

          <section class="today-panel">
            <div class="section-heading">
              <p>{{ $t('dashboard.upcoming.title') }}</p>
              <h2>{{ $t('calendar.today') }}</h2>
            </div>

            <div v-if="providerStore.stats.todayAppointments === 0" class="empty-today">
              <Calendar />
              <p>{{ $t('dashboard.upcoming.no_appointments') }}</p>
              <button v-if="hasStaff" class="text-command" type="button" @click="goToCalendar">
                {{ $t('dashboard.upcoming.view_full_calendar') }}
              </button>
            </div>

            <div v-else class="today-summary">
              <div class="today-count">
                <strong>{{ providerStore.stats.todayAppointments }}</strong>
                <span>{{ $t('dashboard.upcoming.appointments_count', { count: providerStore.stats.todayAppointments }) }}</span>
              </div>
              <button v-if="hasStaff" class="text-command" type="button" @click="goToCalendar">
                {{ $t('dashboard.upcoming.view_details') }}
              </button>
            </div>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.provider-dashboard {
  @apply min-h-screen bg-gray-50 text-gray-950;
}

.dashboard-shell {
  @apply mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8;
}

.dashboard-header {
  @apply border-b border-gray-200 bg-white;
}

.header-layout {
  @apply flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:justify-between;
}

.header-copy {
  @apply max-w-3xl;
}

.dashboard-kicker {
  @apply text-xs font-semibold uppercase tracking-wide text-primary-700;
}

.header-copy h1 {
  @apply mt-2 text-2xl font-bold leading-tight text-gray-950 sm:text-3xl;
}

.header-copy p:last-child {
  @apply mt-2 text-sm text-gray-600 sm:text-base;
}

.header-actions {
  @apply flex items-center gap-2;
}

.icon-command {
  @apply inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2;
}

.icon-command svg {
  @apply h-5 w-5;
}

.dashboard-main {
  @apply py-6 sm:py-8;
}

.metrics-grid {
  @apply grid gap-3 sm:grid-cols-2 lg:grid-cols-4;
}

.metric-card {
  @apply flex min-h-36 w-full items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:hover:translate-y-0 disabled:hover:shadow-sm;
}

.metric-card.is-disabled {
  @apply cursor-not-allowed opacity-60;
}

.metric-icon,
.action-icon {
  @apply inline-flex shrink-0 items-center justify-center rounded-lg;
}

.metric-icon {
  @apply h-10 w-10;
}

.metric-icon svg,
.action-icon svg {
  @apply h-5 w-5;
}

.metric-body {
  @apply flex min-w-0 flex-col;
}

.metric-label {
  @apply text-sm font-medium text-gray-600;
}

.metric-body strong {
  @apply mt-2 text-3xl font-bold leading-none text-gray-950;
}

.metric-hint {
  @apply mt-2 text-xs leading-snug text-gray-500;
}

.tone-amber .metric-icon,
.tone-amber .action-icon {
  @apply bg-primary-100 text-primary-700;
}

.tone-green .metric-icon,
.tone-green .action-icon {
  @apply bg-green-100 text-green-700;
}

.tone-blue .metric-icon,
.tone-blue .action-icon {
  @apply bg-blue-100 text-blue-700;
}

.tone-violet .metric-icon,
.tone-violet .action-icon {
  @apply bg-purple-100 text-purple-700;
}

.pending-panel {
  @apply mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900;
}

.pending-panel svg {
  @apply mt-0.5 h-5 w-5 shrink-0 text-amber-600;
}

.pending-panel h2 {
  @apply text-sm font-semibold;
}

.pending-panel p {
  @apply mt-1 text-sm leading-6 text-amber-800;
}

.dashboard-columns {
  @apply mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)];
}

.action-panel,
.today-panel {
  @apply rounded-xl border border-gray-200 bg-white p-5 shadow-sm;
}

.section-heading {
  @apply mb-4;
}

.section-heading p {
  @apply text-xs font-semibold uppercase tracking-wide text-gray-500;
}

.section-heading h2 {
  @apply mt-1 text-lg font-semibold leading-tight text-gray-950;
}

.action-list {
  @apply grid gap-3 md:grid-cols-2;
}

.action-row {
  @apply flex min-h-24 items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:hover:border-gray-200 disabled:hover:bg-white;
}

.action-row.is-disabled {
  @apply cursor-not-allowed opacity-55;
}

.action-icon {
  @apply h-11 w-11;
}

.action-copy {
  @apply flex min-w-0 flex-col;
}

.action-copy strong {
  @apply text-sm font-semibold text-gray-950;
}

.action-copy span {
  @apply mt-1 text-sm leading-5 text-gray-600;
}

.empty-today {
  @apply flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center;
}

.empty-today svg {
  @apply h-12 w-12 text-gray-400;
}

.empty-today p {
  @apply mt-4 text-sm text-gray-600;
}

.today-summary {
  @apply flex min-h-64 flex-col justify-between rounded-lg border border-gray-200 bg-gray-50 p-5;
}

.today-count {
  @apply flex flex-col;
}

.today-count strong {
  @apply text-5xl font-bold leading-none text-gray-950;
}

.today-count span {
  @apply mt-3 text-sm leading-6 text-gray-600;
}

.text-command {
  @apply mt-5 inline-flex w-fit items-center rounded-md text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2;
}
</style>
