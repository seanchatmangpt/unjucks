<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h2>
        <p class="text-gray-600 dark:text-gray-400">Monitor and track all system activities</p>
      </div>
      <div class="flex items-center space-x-2">
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-down-tray"
          @click="exportLogs"
        >
          Export
        </UButton>
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-path"
          @click="refreshLogs"
          :loading="loading"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <UCard>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <!-- Search -->
        <div class="lg:col-span-2">
          <UInput
            v-model="filters.search"
            placeholder="Search logs..."
            icon="i-heroicons-magnifying-glass"
            @input="debouncedSearch"
          />
        </div>

        <!-- Date Range -->
        <div>
          <UPopover :popper="{ placement: 'bottom-start' }">
            <UButton
              variant="outline"
              class="w-full justify-between"
              :label="dateRangeLabel"
              trailing-icon="i-heroicons-calendar-days"
            />

            <template #panel="{ close }">
              <div class="p-4 space-y-4">
                <div class="grid grid-cols-2 gap-2">
                  <UButton
                    v-for="range in quickDateRanges"
                    :key="range.value"
                    variant="ghost"
                    size="sm"
                    class="justify-start"
                    @click="setDateRange(range.value); close()"
                  >
                    {{ range.label }}
                  </UButton>
                </div>
                
                <div class="border-t pt-4">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-sm font-medium">From</label>
                      <UInput
                        v-model="filters.startDate"
                        type="date"
                        size="sm"
                      />
                    </div>
                    <div>
                      <label class="text-sm font-medium">To</label>
                      <UInput
                        v-model="filters.endDate"
                        type="date"
                        size="sm"
                      />
                    </div>
                  </div>
                  <div class="flex justify-end mt-2">
                    <UButton size="sm" @click="applyDateFilter(); close()">
                      Apply
                    </UButton>
                  </div>
                </div>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- User Filter -->
        <div>
          <USelect
            v-model="filters.userId"
            :options="userOptions"
            placeholder="All Users"
            :loading="loadingUsers"
          />
        </div>

        <!-- Action Filter -->
        <div>
          <USelect
            v-model="filters.action"
            :options="actionOptions"
            placeholder="All Actions"
          />
        </div>

        <!-- Resource Filter -->
        <div>
          <USelect
            v-model="filters.resource"
            :options="resourceOptions"
            placeholder="All Resources"
          />
        </div>
      </div>
    </UCard>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-2">
          <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <UIcon name="i-heroicons-eye" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats.totalEvents }}</p>
          </div>
        </div>
      </div>

      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-2">
          <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Successful</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats.successfulEvents }}</p>
          </div>
        </div>
      </div>

      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-2">
          <div class="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
            <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Failed</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats.failedEvents }}</p>
          </div>
        </div>
      </div>

      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-2">
          <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <UIcon name="i-heroicons-shield-exclamation" class="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Security Events</p>
            <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats.securityEvents }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Audit Log Table -->
    <UCard>
      <div class="overflow-hidden">
        <UTable
          :rows="paginatedLogs"
          :columns="columns"
          :loading="loading"
          :empty-state="{ 
            icon: 'i-heroicons-document-text', 
            label: 'No audit logs found',
            description: 'Try adjusting your filters or date range.' 
          }"
        >
          <template #timestamp-data="{ row }">
            <div class="text-sm">
              <div class="text-gray-900 dark:text-white">
                {{ formatTimestamp(row.timestamp) }}
              </div>
              <div class="text-gray-500 dark:text-gray-400">
                {{ formatDate(row.timestamp) }}
              </div>
            </div>
          </template>

          <template #user-data="{ row }">
            <div class="flex items-center space-x-2">
              <UAvatar
                :src="row.user?.avatar"
                :alt="row.user?.name || 'System'"
                size="xs"
              />
              <div class="text-sm">
                <div class="text-gray-900 dark:text-white">
                  {{ row.user?.name || 'System' }}
                </div>
                <div class="text-gray-500 dark:text-gray-400">
                  {{ row.user?.email || 'system@unjucks.com' }}
                </div>
              </div>
            </div>
          </template>

          <template #action-data="{ row }">
            <div class="flex items-center space-x-2">
              <div :class="[
                'flex items-center justify-center w-8 h-8 rounded-full',
                getActionColor(row.action)
              ]">
                <UIcon :name="getActionIcon(row.action)" class="w-4 h-4" />
              </div>
              <div class="text-sm">
                <div class="font-medium text-gray-900 dark:text-white capitalize">
                  {{ row.action.replace('_', ' ') }}
                </div>
                <div class="text-gray-500 dark:text-gray-400">
                  {{ row.resource }}
                </div>
              </div>
            </div>
          </template>

          <template #details-data="{ row }">
            <div class="text-sm">
              <div class="text-gray-900 dark:text-white">
                {{ getEventDescription(row) }}
              </div>
              <div v-if="row.resourceId" class="text-gray-500 dark:text-gray-400">
                ID: {{ row.resourceId }}
              </div>
            </div>
          </template>

          <template #source-data="{ row }">
            <div class="text-sm space-y-1">
              <div class="flex items-center space-x-2">
                <UIcon name="i-heroicons-globe-alt" class="w-3 h-3 text-gray-400" />
                <code class="text-xs text-gray-600 dark:text-gray-400">{{ row.ipAddress }}</code>
              </div>
              <div class="flex items-center space-x-2">
                <UIcon name="i-heroicons-device-phone-mobile" class="w-3 h-3 text-gray-400" />
                <span class="text-xs text-gray-600 dark:text-gray-400">
                  {{ getBrowserInfo(row.userAgent) }}
                </span>
              </div>
            </div>
          </template>

          <template #actions-data="{ row }">
            <UDropdown :items="getLogActions(row)">
              <UButton variant="ghost" size="sm" square>
                <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4" />
              </UButton>
            </UDropdown>
          </template>
        </UTable>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-700 dark:text-gray-300">Show</span>
            <USelect
              v-model="pageSize"
              :options="[10, 25, 50, 100]"
              size="sm"
              class="w-20"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">per page</span>
          </div>
          
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredLogs.length) }}
            of {{ filteredLogs.length }} results
          </div>
          
          <UPagination
            v-model="currentPage"
            :page-count="pageSize"
            :total="filteredLogs.length"
            :max="7"
          />
        </div>
      </div>
    </UCard>

    <!-- Log Detail Modal -->
    <UModal v-model="showDetailModal" :ui="{ width: 'max-w-4xl' }">
      <LogDetailModal
        v-if="selectedLog"
        :log="selectedLog"
        @close="showDetailModal = false"
      />
    </UModal>

    <!-- Real-time Updates Toggle -->
    <div class="fixed bottom-4 right-4">
      <UButton
        :color="realTimeEnabled ? 'green' : 'gray'"
        size="sm"
        @click="toggleRealTime"
      >
        <div class="flex items-center space-x-2">
          <div :class="[
            'w-2 h-2 rounded-full',
            realTimeEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          ]" />
          <span>{{ realTimeEnabled ? 'Live' : 'Paused' }}</span>
        </div>
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuditLog, User } from '~/types'
import LogDetailModal from './LogDetailModal.vue'

const { $fetch } = useNuxtApp()

const loading = ref(true)
const loadingUsers = ref(false)
const realTimeEnabled = ref(false)
const showDetailModal = ref(false)
const selectedLog = ref<AuditLog | null>(null)

const currentPage = ref(1)
const pageSize = ref(25)

const filters = ref({
  search: '',
  userId: '',
  action: '',
  resource: '',
  startDate: '',
  endDate: '',
  ipAddress: '',
  severity: ''
})

const auditLogs = ref<AuditLog[]>([])
const users = ref<User[]>([])

const columns = [
  { key: 'timestamp', label: 'Time', sortable: true },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action', sortable: true },
  { key: 'details', label: 'Details' },
  { key: 'source', label: 'Source' },
  { key: 'actions', label: 'Actions' }
]

const stats = ref({
  totalEvents: 0,
  successfulEvents: 0,
  failedEvents: 0,
  securityEvents: 0
})

const quickDateRanges = [
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' }
]

const userOptions = computed(() => [
  { label: 'All Users', value: '' },
  ...users.value.map(user => ({
    label: user.name,
    value: user.id
  }))
])

const actionOptions = [
  { label: 'All Actions', value: '' },
  { label: 'Create', value: 'create' },
  { label: 'Update', value: 'update' },
  { label: 'Delete', value: 'delete' },
  { label: 'Login', value: 'login' },
  { label: 'Logout', value: 'logout' },
  { label: 'Generate', value: 'generate' },
  { label: 'Download', value: 'download' },
  { label: 'Upload', value: 'upload' }
]

const resourceOptions = [
  { label: 'All Resources', value: '' },
  { label: 'Template', value: 'template' },
  { label: 'User', value: 'user' },
  { label: 'Organization', value: 'organization' },
  { label: 'Generation', value: 'generation' },
  { label: 'File', value: 'file' }
]

const dateRangeLabel = computed(() => {
  if (filters.value.startDate && filters.value.endDate) {
    return `${formatDate(new Date(filters.value.startDate))} - ${formatDate(new Date(filters.value.endDate))}`
  }
  return 'Select Date Range'
})

const filteredLogs = computed(() => {
  let filtered = auditLogs.value

  // Search filter
  if (filters.value.search) {
    const search = filters.value.search.toLowerCase()
    filtered = filtered.filter(log =>
      log.action.toLowerCase().includes(search) ||
      log.resource.toLowerCase().includes(search) ||
      log.user?.name.toLowerCase().includes(search) ||
      log.user?.email.toLowerCase().includes(search) ||
      log.ipAddress.includes(search) ||
      JSON.stringify(log.metadata).toLowerCase().includes(search)
    )
  }

  // User filter
  if (filters.value.userId) {
    filtered = filtered.filter(log => log.userId === filters.value.userId)
  }

  // Action filter
  if (filters.value.action) {
    filtered = filtered.filter(log => log.action === filters.value.action)
  }

  // Resource filter
  if (filters.value.resource) {
    filtered = filtered.filter(log => log.resource.toLowerCase() === filters.value.resource)
  }

  // Date range filter
  if (filters.value.startDate) {
    const startDate = new Date(filters.value.startDate)
    filtered = filtered.filter(log => new Date(log.timestamp) >= startDate)
  }
  if (filters.value.endDate) {
    const endDate = new Date(filters.value.endDate)
    endDate.setHours(23, 59, 59, 999)
    filtered = filtered.filter(log => new Date(log.timestamp) <= endDate)
  }

  return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredLogs.value.slice(start, end)
})

const fetchLogs = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/audit-logs', {
      query: {
        ...filters.value,
        page: currentPage.value,
        limit: pageSize.value * 3 // Load more data for client-side filtering
      }
    })
    
    auditLogs.value = data.logs
    stats.value = data.stats
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
  } finally {
    loading.value = false
  }
}

const fetchUsers = async () => {
  loadingUsers.value = true
  try {
    const data = await $fetch('/api/users?limit=1000')
    users.value = data.users
  } catch (error) {
    console.error('Failed to fetch users:', error)
  } finally {
    loadingUsers.value = false
  }
}

const refreshLogs = () => {
  fetchLogs()
}

const setDateRange = (range: string) => {
  const now = new Date()
  let startDate = new Date()

  switch (range) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000)
      break
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
  }

  filters.value.startDate = startDate.toISOString().split('T')[0]
  filters.value.endDate = now.toISOString().split('T')[0]
  
  fetchLogs()
}

const applyDateFilter = () => {
  fetchLogs()
}

const exportLogs = async () => {
  try {
    const data = await $fetch('/api/audit-logs/export', {
      method: 'POST',
      body: { ...filters.value, format: 'csv' }
    })
    
    const blob = new Blob([data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    useToast().add({
      title: 'Export completed',
      description: 'Audit logs have been exported successfully',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Export failed',
      description: 'Failed to export audit logs',
      color: 'red'
    })
  }
}

const toggleRealTime = () => {
  realTimeEnabled.value = !realTimeEnabled.value
  
  if (realTimeEnabled.value) {
    // Start real-time updates
    const interval = setInterval(() => {
      if (realTimeEnabled.value) {
        fetchLogs()
      } else {
        clearInterval(interval)
      }
    }, 5000)
  }
}

const getActionIcon = (action: string): string => {
  const icons: Record<string, string> = {
    'create': 'i-heroicons-plus-circle',
    'update': 'i-heroicons-pencil-square',
    'delete': 'i-heroicons-trash',
    'login': 'i-heroicons-arrow-right-on-rectangle',
    'logout': 'i-heroicons-arrow-left-on-rectangle',
    'generate': 'i-heroicons-code-bracket',
    'download': 'i-heroicons-arrow-down-tray',
    'upload': 'i-heroicons-arrow-up-tray',
    'invite': 'i-heroicons-user-plus',
    'remove': 'i-heroicons-user-minus'
  }
  return icons[action] || 'i-heroicons-information-circle'
}

const getActionColor = (action: string): string => {
  const colors: Record<string, string> = {
    'create': 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    'update': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    'delete': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    'login': 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
    'logout': 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
    'generate': 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    'download': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400',
    'upload': 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400'
  }
  return colors[action] || 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
}

const getEventDescription = (log: AuditLog): string => {
  const user = log.user?.name || 'System'
  const resource = log.resource.toLowerCase()
  const action = log.action.toLowerCase()
  
  if (action === 'create') return `${user} created a ${resource}`
  if (action === 'update') return `${user} updated ${resource}`
  if (action === 'delete') return `${user} deleted ${resource}`
  if (action === 'login') return `${user} signed in`
  if (action === 'logout') return `${user} signed out`
  if (action === 'generate') return `${user} generated code using ${resource}`
  
  return `${user} performed ${action} on ${resource}`
}

const getBrowserInfo = (userAgent: string): string => {
  if (userAgent.includes('Chrome')) return 'Chrome'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari')) return 'Safari'
  if (userAgent.includes('Edge')) return 'Edge'
  return 'Unknown'
}

const formatTimestamp = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDate = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getLogActions = (log: AuditLog) => [
  [{
    label: 'View Details',
    icon: 'i-heroicons-eye',
    click: () => {
      selectedLog.value = log
      showDetailModal.value = true
    }
  }],
  [{
    label: 'View User Profile',
    icon: 'i-heroicons-user',
    disabled: !log.user,
    click: () => log.user && navigateTo(`/admin/users/${log.userId}`)
  }, {
    label: 'View Resource',
    icon: 'i-heroicons-arrow-top-right-on-square',
    disabled: !log.resourceId,
    click: () => log.resourceId && navigateTo(`/${log.resource.toLowerCase()}s/${log.resourceId}`)
  }]
]

// Debounced search
const debouncedSearch = debounce(() => {
  currentPage.value = 1
  fetchLogs()
}, 500)

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }) as T
}

// Watch for filter changes
watch([() => filters.value.userId, () => filters.value.action, () => filters.value.resource], () => {
  currentPage.value = 1
  fetchLogs()
})

onMounted(() => {
  fetchLogs()
  fetchUsers()
})
</script>