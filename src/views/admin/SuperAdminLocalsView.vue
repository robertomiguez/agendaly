<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useSuperAdminStore } from '../../stores/useSuperAdminStore'
import { 
  Search, 
  MapPin,
  Building,

  EyeOff,
  Eye,
  MoreVertical,
  Loader2,
  AlertCircle,
  MapPinOff
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
const selectedLocal = ref<string | null>(null)
const deactivationReason = ref('')
const showModal = ref(false)

onMounted(() => {
  adminStore.fetchLocals()
})

const filteredLocals = computed(() => {
  if (!searchQuery.value) return adminStore.locals
  const q = searchQuery.value.toLowerCase()
  return adminStore.locals.filter(l => 
    l.street_address?.toLowerCase().includes(q) || 
    l.providers?.business_name?.toLowerCase().includes(q)
  )
})

async function openDeactivate(localId: string) {
  selectedLocal.value = localId
  showModal.value = true
}

async function handleConfirm() {
  if (!selectedLocal.value) return
  try {
    await adminStore.toggleLocalActive(selectedLocal.value, false, deactivationReason.value)
    showModal.value = false
    deactivationReason.value = ''
    selectedLocal.value = null
  } catch (e) {
    console.error(e)
  }
}

async function handleActivate(localId: string) {
  try {
    await adminStore.toggleLocalActive(localId, true)
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900">Registered Addresses</h1>
      <div class="relative w-full md:w-72">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search addresses..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="adminStore.loading" class="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <Loader2 class="h-10 w-10 text-indigo-500 animate-spin mb-4" />
      <p class="text-slate-500 font-medium">Fetching platform locations...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="adminStore.error" class="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-4">
      <div class="p-2 bg-rose-100 text-rose-600 rounded-lg">
        <AlertCircle class="h-6 w-6" />
      </div>
      <div>
        <h3 class="font-bold text-rose-900">Failed to load locations</h3>
        <p class="text-sm text-rose-700 mt-1">{{ adminStore.error }}</p>
        <Button 
          variant="outline" 
          size="sm" 
          class="mt-4 border-rose-200 text-rose-700 hover:bg-rose-100"
          @click="adminStore.fetchLocals()"
        >
          Try Again
        </Button>
      </div>
    </div>

    <!-- Locals Table -->
    <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Desktop Table -->
      <div v-if="filteredLocals.length > 0" class="hidden md:block overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Address</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Provider</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="local in filteredLocals" :key="local.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center">
                  <div class="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mr-3 overflow-hidden">
                    <img v-if="local.photo_url" :src="local.photo_url" class="h-full w-full object-cover" />
                    <MapPin v-else class="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-900">{{ local.street_address }}</div>
                    <div class="text-xs text-slate-400">{{ local.street_address_2 || 'No additional info' }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center text-sm text-slate-600">
                  <Building class="h-3.5 w-3.5 mr-2 opacity-50" />
                   {{ local.providers?.business_name }}
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm text-slate-600">
                  {{ local.city }}, {{ local.state || local.country }}
                </div>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', local.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700']">
                  {{ local.active ? 'Active' : 'Deactivated' }}
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
                      v-if="local.active"
                      @click="openDeactivate(local.id)"
                      class="cursor-pointer text-rose-600"
                    >
                      <EyeOff class="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      v-else
                      @click="handleActivate(local.id)"
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

      <!-- Mobile Card Layout -->
      <div v-if="filteredLocals.length > 0" class="md:hidden divide-y divide-slate-100">
        <div v-for="local in filteredLocals" :key="local.id" class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center min-w-0">
              <div class="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mr-3 shrink-0 overflow-hidden">
                <img v-if="local.photo_url" :src="local.photo_url" class="h-full w-full object-cover" />
                <MapPin v-else class="h-5 w-5 text-slate-400" />
              </div>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 truncate">{{ local.street_address }}</div>
                <div class="flex items-center text-xs text-slate-500 mt-0.5">
                  <Building class="h-3 w-3 mr-1 shrink-0 opacity-50" />
                  <span class="truncate">{{ local.providers?.business_name }}</span>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-8 w-8 text-slate-400 shrink-0">
                  <MoreVertical class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  v-if="local.active"
                  @click="openDeactivate(local.id)"
                  class="cursor-pointer text-rose-600"
                >
                  <EyeOff class="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
                <DropdownMenuItem 
                  v-else
                  @click="handleActivate(local.id)"
                  class="cursor-pointer text-emerald-600"
                >
                  <Eye class="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div class="flex items-center justify-between mt-3">
            <span class="text-xs text-slate-500">{{ local.city }}, {{ local.state || local.country }}</span>
            <span :class="['px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', local.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700']">
              {{ local.active ? 'Active' : 'Deactivated' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="py-24 text-center">
        <div class="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-50 text-slate-300 mb-4">
          <MapPinOff class="h-8 w-8" />
        </div>
        <h3 class="text-lg font-bold text-slate-900">No locations found</h3>
        <p class="text-slate-500 max-w-xs mx-auto mt-1">
          {{ searchQuery ? 'No locations match your search criteria.' : 'There are no service locations registered on the platform yet.' }}
        </p>
        <Button v-if="searchQuery" variant="link" class="mt-2 text-indigo-600" @click="searchQuery = ''">
          Clear Search
        </Button>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
       <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
          <h3 class="text-lg font-bold text-slate-900 mb-2">Deactivate Local</h3>
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
