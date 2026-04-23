<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/useAuthStore'
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Briefcase, 
  MapPin, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  ChevronRight
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isSidebarOpen = ref(false)

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/super-admin/dashboard' },
  { name: 'Providers', icon: Briefcase, path: '/super-admin/providers' },
  { name: 'Services', icon: Settings, path: '/super-admin/services' },
  { name: 'Staff', icon: Users, path: '/super-admin/staff' },
  { name: 'Locals', icon: MapPin, path: '/super-admin/locals' }
]

const currentRouteName = computed(() => {
  const item = menuItems.find(i => i.path === route.path)
  return item ? item.name : 'Super Admin'
})

async function handleLogout() {
  await authStore.signOut()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex">
    <!-- Sidebar -->
    <aside 
      :class="[
        'bg-slate-900 text-slate-300 w-64 fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out transform',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <div class="h-full flex flex-col">
        <!-- Sidebar Header -->
        <div class="h-16 flex items-center justify-between px-6 bg-slate-950">
          <div class="flex items-center">
            <ShieldCheck class="h-8 w-8 text-indigo-400 shrink-0" />
            <span class="ml-3 font-bold text-xl text-white tracking-tight">Agendaly <span class="text-indigo-400">Admin</span></span>
          </div>
          <button @click="isSidebarOpen = false" class="p-1 text-slate-400 hover:text-white lg:hidden">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 py-6 space-y-1">
          <router-link 
            v-for="item in menuItems" 
            :key="item.path" 
            :to="item.path"
            @click="isSidebarOpen = false"
            class="group flex items-center px-6 py-3 text-sm font-medium transition-colors"
            :class="[
              route.path === item.path 
                ? 'bg-slate-800 text-white border-r-4 border-indigo-500' 
                : 'hover:bg-slate-800 hover:text-white'
            ]"
          >
            <component :is="item.icon" class="h-5 w-5 shrink-0" :class="route.path === item.path ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'" />
            <span class="ml-3">{{ item.name }}</span>
          </router-link>
        </nav>

        <!-- Sidebar Footer -->
        <div class="p-4 border-t border-slate-800">
          <button 
            @click="handleLogout"
            class="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut class="h-5 w-5 shrink-0" />
            <span class="ml-3">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- Backdrop overlay (mobile only) -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="isSidebarOpen = false"
    />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Topbar -->
      <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
        <div class="flex items-center">
          <button @click="isSidebarOpen = !isSidebarOpen" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden text-indigo-400">
            <Menu v-if="!isSidebarOpen" class="h-6 w-6" />
            <X v-else class="h-6 w-6" />
          </button>
          <div class="ml-4 flex items-center text-sm text-slate-500 font-medium">
            <span>Admin</span>
            <ChevronRight class="h-4 w-4 mx-2 text-slate-300" />
            <span class="text-slate-900">{{ currentRouteName }}</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="hidden md:flex flex-col text-right">
            <span class="text-sm font-semibold text-slate-900">{{ authStore.superAdmin?.profile?.name || 'Super Admin' }}</span>
            <span class="text-xs text-slate-500">{{ authStore.superAdmin?.profile?.email }}</span>
          </div>
          <div class="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
            {{ (authStore.superAdmin?.profile?.name?.[0] || 'S').toUpperCase() }}
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-8">
        <div class="max-w-7xl mx-auto">
          <router-view></router-view>
        </div>
      </main>
    </div>
  </div>
</template>
