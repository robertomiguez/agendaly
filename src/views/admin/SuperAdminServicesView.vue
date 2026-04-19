<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useSuperAdminStore } from '../../stores/useSuperAdminStore'
import { 
  Search, 
  MoreVertical, 
  EyeOff, 
  Eye,
  Settings,
  Building,
  Tag,
  Loader2,
  AlertCircle,
  PackageX
} from 'lucide-vue-next'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const adminStore = useSuperAdminStore()
const searchQuery = ref('')
const selectedService = ref<string | null>(null)
const deactivationReason = ref('')
const showModal = ref(false)

onMounted(() => {
  adminStore.fetchServices()
})

const filteredServices = computed(() => {
  if (!searchQuery.value) return adminStore.services
  const q = searchQuery.value.toLowerCase()
  return adminStore.services.filter(s => 
    s.name.toLowerCase().includes(q) || 
    s.providers?.business_name?.toLowerCase().includes(q)
  )
})

async function openDeactivate(serviceId: string) {
  selectedService.value = serviceId
  showModal.value = true
}

async function handleConfirm() {
  if (!selectedService.value) return
  try {
    await adminStore.toggleServiceActive(selectedService.value, false, deactivationReason.value)
    showModal.value = false
    deactivationReason.value = ''
    selectedService.value = null
  } catch (e) {
    console.error(e)
  }
}

async function handleActivate(serviceId: string) {
  try {
    await adminStore.toggleServiceActive(serviceId, true)
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900">Platform Services</h1>
      <div class="relative w-full md:w-72">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search services..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="adminStore.loading" class="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <Loader2 class="h-10 w-10 text-indigo-500 animate-spin mb-4" />
      <p class="text-slate-500 font-medium">Fetching platform services...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="adminStore.error" class="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-4">
      <div class="p-2 bg-rose-100 text-rose-600 rounded-lg">
        <AlertCircle class="h-6 w-6" />
      </div>
      <div>
        <h3 class="font-bold text-rose-900">Failed to load services</h3>
        <p class="text-sm text-rose-700 mt-1">{{ adminStore.error }}</p>
        <Button 
          variant="outline" 
          size="sm" 
          class="mt-4 border-rose-200 text-rose-700 hover:bg-rose-100"
          @click="adminStore.fetchServices()"
        >
          Try Again
        </Button>
      </div>
    </div>

    <!-- Services Table -->
    <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div v-if="filteredServices.length > 0" class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Service</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Provider</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="service in filteredServices" :key="service.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <div class="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center mr-3">
                    <Settings class="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-900">{{ service.name }}</div>
                    <div class="text-xs text-slate-400">{{ service.duration }} min</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center text-sm text-slate-600">
                  <Building class="h-3.5 w-3.5 mr-2 opacity-50" />
                  {{ service.providers?.business_name || 'Individual' }}
                </div>
              </td>
              <td class="px-6 py-4 font-medium text-slate-900">
                ${{ service.price }}
              </td>
              <td class="px-6 py-4">
                <span 
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    service.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  ]"
                >
                  {{ service.active ? 'Active' : 'Hidden' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="h-8 w-8 text-slate-400">
                      <MoreVertical class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      v-if="service.active"
                      @click="openDeactivate(service.id)"
                      class="cursor-pointer text-rose-600"
                    >
                      <EyeOff class="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      v-else
                      @click="handleActivate(service.id)"
                      class="cursor-pointer text-emerald-600"
                    >
                      <Eye class="mr-2 h-4 w-4" />
                      Activate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-else class="py-24 text-center">
        <div class="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-50 text-slate-300 mb-4">
          <PackageX class="h-8 w-8" />
        </div>
        <h3 class="text-lg font-bold text-slate-900">No services found</h3>
        <p class="text-slate-500 max-w-xs mx-auto mt-1">
          {{ searchQuery ? 'No services match your search criteria.' : 'There are no services registered on the platform yet.' }}
        </p>
        <Button v-if="searchQuery" variant="link" class="mt-2 text-indigo-600" @click="searchQuery = ''">
          Clear Search
        </Button>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
       <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
          <h3 class="text-lg font-bold text-slate-900 mb-2">Deactivate Service</h3>
          <p class="text-sm text-slate-500 mb-4">Reason for administrative deactivation:</p>
          <textarea 
            v-model="deactivationReason"
            class="w-full p-3 border border-slate-200 rounded-lg text-sm mb-4 h-24 outline-none focus:ring-2 focus:ring-rose-500"
          ></textarea>
          <div class="flex gap-2">
             <Button variant="outline" class="flex-1" @click="showModal = false">Cancel</Button>
             <Button class="flex-1 bg-rose-600 text-white hover:bg-rose-700" @click="handleConfirm">Deactivate</Button>
          </div>
       </div>
    </div>
  </div>
</template>
