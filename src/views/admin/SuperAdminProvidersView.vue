<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSuperAdminStore } from '../../stores/useSuperAdminStore'
import { 
  Search, 
  MoreVertical, 
  UserX, 
  UserCheck,
  Calendar,
  Mail,
  Building
} from 'lucide-vue-next'

const adminStore = useSuperAdminStore()
const searchQuery = ref('')
const selectedProvider = ref<string | null>(null)
const deactivationReason = ref('')
const showDeactivationModal = ref(false)

onMounted(() => {
  adminStore.fetchProviders()
})

const filteredProviders = computed(() => {
  if (!searchQuery.value) return adminStore.providers
  const q = searchQuery.value.toLowerCase()
  return adminStore.providers.filter(p => 
    p.business_name.toLowerCase().includes(q) || 
    p.profiles?.email.toLowerCase().includes(q)
  )
})

async function toggleActive(providerId: string, currentActive: boolean) {
  if (currentActive) {
    selectedProvider.value = providerId
    showDeactivationModal.value = true
  } else {
    try {
      await adminStore.toggleProviderActive(providerId, true)
    } catch (e) {
      console.error(e)
    }
  }
}

async function confirmDeactivation() {
  if (!selectedProvider.value) return
  
  try {
    await adminStore.toggleProviderActive(selectedProvider.value, false, deactivationReason.value)
    showDeactivationModal.value = false
    deactivationReason.value = ''
    selectedProvider.value = null
  } catch (e) {
    console.error(e)
  }
}

// Import computed from vue since it's used in filteredProviders but missing from script setup
import { computed } from 'vue'
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900">Manage Providers</h1>
      <div class="relative w-full md:w-72">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search providers..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
        />
      </div>
    </div>

    <!-- Providers Table -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Desktop Table -->
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Business</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="provider in filteredProviders" :key="provider.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <div class="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mr-3 shrink-0">
                    <Building class="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-900">{{ provider.business_name }}</div>
                    <div class="text-xs text-slate-500">{{ provider.id.slice(0, 8) }}...</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-col">
                  <div class="flex items-center text-sm text-slate-600 mb-1">
                    <Mail class="h-3 w-3 mr-1.5 opacity-50" /> {{ provider.profiles?.email }}
                  </div>
                  <div class="text-xs text-slate-400">{{ provider.profiles?.phone || 'No phone' }}</div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span 
                  :class="[
                    'px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset',
                    provider.status === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 
                    provider.status === 'suspended' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                    'bg-slate-50 text-slate-700 ring-slate-600/20'
                  ]"
                >
                  {{ provider.status === 'approved' ? 'Active' : provider.status.toUpperCase() }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-500">
                <div class="flex items-center">
                  <Calendar class="h-4 w-4 mr-2 opacity-50" />
                  {{ new Date(provider.created_at || '').toLocaleDateString() }}
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <details class="relative inline-block text-left">
                  <summary class="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <MoreVertical class="h-4 w-4" />
                  </summary>
                  <div class="absolute right-0 z-20 mt-2 min-w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      @click="toggleActive(provider.id, provider.status === 'approved')"
                      class="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      <template v-if="provider.status === 'approved'">
                        <UserX class="mr-2 h-4 w-4 text-red-500" />
                        <span class="text-red-600">Deactivate</span>
                      </template>
                      <template v-else>
                        <UserCheck class="mr-2 h-4 w-4 text-emerald-500" />
                        <span class="text-emerald-600">Activate</span>
                      </template>
                    </button>
                  </div>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Card Layout -->
      <div class="md:hidden divide-y divide-slate-100">
        <div v-for="provider in filteredProviders" :key="provider.id" class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center min-w-0">
              <div class="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mr-3 shrink-0">
                <Building class="h-5 w-5 text-slate-500" />
              </div>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 truncate">{{ provider.business_name }}</div>
                <div class="flex items-center text-xs text-slate-500 mt-0.5">
                  <Mail class="h-3 w-3 mr-1 shrink-0 opacity-50" />
                  <span class="truncate">{{ provider.profiles?.email }}</span>
                </div>
              </div>
            </div>
            <details class="relative shrink-0 text-left">
              <summary class="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
                  <MoreVertical class="h-4 w-4" />
              </summary>
              <div class="absolute right-0 z-20 mt-2 min-w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  @click="toggleActive(provider.id, provider.status === 'approved')"
                  class="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <template v-if="provider.status === 'approved'">
                    <UserX class="mr-2 h-4 w-4 text-red-500" />
                    <span class="text-red-600">Deactivate</span>
                  </template>
                  <template v-else>
                    <UserCheck class="mr-2 h-4 w-4 text-emerald-500" />
                    <span class="text-emerald-600">Activate</span>
                  </template>
                </button>
              </div>
            </details>
          </div>
          <div class="flex items-center justify-between mt-3">
            <span 
              :class="[
                'px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset',
                provider.status === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 
                provider.status === 'suspended' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                'bg-slate-50 text-slate-700 ring-slate-600/20'
              ]"
            >
              {{ provider.status === 'approved' ? 'Active' : provider.status.toUpperCase() }}
            </span>
            <div class="flex items-center text-xs text-slate-400">
              <Calendar class="h-3.5 w-3.5 mr-1.5 opacity-50" />
              {{ new Date(provider.created_at || '').toLocaleDateString() }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="filteredProviders.length === 0" class="py-20 text-center">
        <Building class="h-12 w-12 text-slate-200 mx-auto mb-4" />
        <p class="text-slate-500">No providers found matching your search.</p>
      </div>
    </div>

    <!-- Deactivation Modal Placeholder (Simplifying for now) -->
    <div v-if="showDeactivationModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
       <div class="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
          <div class="flex items-center gap-3 mb-6">
             <div class="p-2 bg-red-50 text-red-600 rounded-lg">
                <UserX class="h-6 w-6" />
             </div>
             <h2 class="text-xl font-bold text-slate-900">Deactivate Account</h2>
          </div>
          
          <p class="text-slate-600 mb-6">Please provide a reason for deactivating this provider. They will see this message when they log in.</p>
          
          <textarea 
            v-model="deactivationReason"
            class="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none h-32 mb-6"
            placeholder="Reason for deactivation..."
          ></textarea>
          
          <div class="flex gap-3">
             <button class="flex-1 h-12 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" @click="showDeactivationModal = false">Cancel</button>
             <button class="flex-1 h-12 rounded-md bg-red-600 text-white hover:bg-red-700" @click="confirmDeactivation">Deactivate</button>
          </div>
       </div>
    </div>
  </div>
</template>
