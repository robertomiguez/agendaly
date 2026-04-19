<script setup lang="ts">
import { onMounted } from 'vue'
import { useSuperAdminStore } from '../../stores/useSuperAdminStore'
import { 
  Briefcase, 
  Settings, 
  Users, 
  Calendar,
  ArrowUpRight,
  TrendingUp,
  Activity
} from 'lucide-vue-next'

const adminStore = useSuperAdminStore()

onMounted(() => {
  adminStore.fetchStats()
})
</script>

<template>
  <div class="space-y-8">
    <!-- Welcome Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Platform Overview</h1>
        <p class="text-slate-500 mt-1">Real-time statistics and growth metrics for Agendaly.</p>
      </div>
      <div class="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
        <Activity class="h-4 w-4 text-emerald-500" />
        System Status: <span class="text-emerald-600">Operational</span>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Briefcase class="h-6 w-6" />
          </div>
          <div class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp class="h-3 w-3" /> +12%
          </div>
        </div>
        <div class="text-3xl font-bold text-slate-900">{{ adminStore.stats?.totalProviders || 0 }}</div>
        <div class="text-sm font-medium text-slate-500 mt-1">Total Providers</div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Settings class="h-6 w-6" />
          </div>
          <div class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp class="h-3 w-3" /> +5%
          </div>
        </div>
        <div class="text-3xl font-bold text-slate-900">{{ adminStore.stats?.totalServices || 0 }}</div>
        <div class="text-sm font-medium text-slate-500 mt-1">Total Services</div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-rose-50 rounded-xl text-rose-600">
            <Users class="h-6 w-6" />
          </div>
          <div class="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full flex items-center gap-1">
             Stale
          </div>
        </div>
        <div class="text-3xl font-bold text-slate-900">{{ adminStore.stats?.totalStaff || 0 }}</div>
        <div class="text-sm font-medium text-slate-500 mt-1">Total Staff</div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Calendar class="h-6 w-6" />
          </div>
          <div class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp class="h-3 w-3" /> +18%
          </div>
        </div>
        <div class="text-3xl font-bold text-slate-900">{{ adminStore.stats?.totalAppointments || 0 }}</div>
        <div class="text-sm font-medium text-slate-500 mt-1">Total Appointments</div>
      </div>
    </div>

    <!-- Quick Actions / Charts Placeholder -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
       <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-8">
          <h3 class="text-lg font-bold text-slate-900 mb-6 flex items-center justify-between">
            Recent Activity
            <button class="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
              View All <ArrowUpRight class="h-4 w-4" />
            </button>
          </h3>
          <div class="flex flex-col items-center justify-center py-12 text-slate-400">
            <Activity class="h-12 w-12 mb-4 opacity-20" />
            <p>Recent activity feed will appear here as the platform grows.</p>
          </div>
       </div>

       <div class="bg-indigo-900 rounded-2xl p-8 text-white">
          <h3 class="text-lg font-bold mb-4">Admin Resources</h3>
          <div class="space-y-4">
             <div class="p-4 bg-indigo-800 rounded-xl border border-indigo-700 hover:bg-indigo-750 cursor-pointer transition-colors">
                <p class="font-bold">System Maintenance</p>
                <p class="text-sm text-indigo-300">Schedule next maintenance window.</p>
             </div>
             <div class="p-4 bg-indigo-800 rounded-xl border border-indigo-700 hover:bg-indigo-750 cursor-pointer transition-colors">
                <p class="font-bold">Support Queue</p>
                <p class="text-sm text-indigo-300">You have 0 pending support tickets.</p>
             </div>
             <div class="p-4 bg-indigo-800 rounded-xl border border-indigo-700 hover:bg-indigo-750 cursor-pointer transition-colors">
                <p class="font-bold">Backup Status</p>
                <p class="text-sm text-indigo-300">Last backup: 4 hours ago.</p>
             </div>
          </div>
       </div>
    </div>
  </div>
</template>
