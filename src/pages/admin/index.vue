<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Administration</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your organization, users, and system settings
        </p>
      </div>

      <!-- Admin Navigation -->
      <div class="mb-8">
        <nav class="flex space-x-8">
          <NuxtLink
            v-for="tab in adminTabs"
            :key="tab.id"
            :to="tab.to"
            class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
            :class="isActiveTab(tab.id) ? 
              'border-primary-500 text-primary-600 dark:text-primary-400' : 
              'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
          >
            <UIcon :name="tab.icon" class="w-4 h-4 mr-2 inline" />
            {{ tab.name }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Users"
          :value="adminMetrics.totalUsers"
          :change="8"
          change-type="increase"
          icon="i-heroicons-users"
        />
        <MetricCard
          title="Active Sessions"
          :value="adminMetrics.activeSessions"
          :change="12"
          change-type="increase"
          icon="i-heroicons-signal"
        />
        <MetricCard
          title="Storage Used"
          :value="adminMetrics.storageUsed"
          unit="GB"
          :change="5"
          change-type="increase"
          icon="i-heroicons-cloud"
        />
        <MetricCard
          title="API Calls Today"
          :value="adminMetrics.apiCallsToday"
          unit="K"
          :change="15"
          change-type="increase"
          icon="i-heroicons-chart-bar"
        />
      </div>

      <!-- Main Content Area -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- System Status -->
        <div class="lg:col-span-2">
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">System Status</h3>
            </template>

            <div class="space-y-4">
              <!-- Service Status -->
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white mb-3">Services</h4>
                <div class="space-y-2">
                  <div
                    v-for="service in systemStatus.services"
                    :key="service.name"
                    class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <div class="flex items-center space-x-3">
                      <div :class="[
                        'w-3 h-3 rounded-full',
                        service.status === 'healthy' ? 'bg-green-400' : 
                        service.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
                      ]" />
                      <span class="font-medium text-gray-900 dark:text-white">{{ service.name }}</span>
                    </div>
                    <div class="text-right">
                      <p class="text-sm text-gray-600 dark:text-gray-400">{{ service.uptime }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-500">{{ service.responseTime }}ms</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Resource Usage -->
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white mb-3">Resource Usage</h4>
                <div class="space-y-3">
                  <div
                    v-for="resource in systemStatus.resources"
                    :key="resource.name"
                  >
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-600 dark:text-gray-400">{{ resource.name }}</span>
                      <span class="text-gray-900 dark:text-white">{{ resource.usage }}%</span>
                    </div>
                    <UProgress :value="resource.usage" :color="getUsageColor(resource.usage)" />
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Quick Actions -->
        <div>
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
            </template>

            <div class="space-y-3">
              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                to="/admin/users"
                icon="i-heroicons-users"
              >
                Manage Users
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                to="/admin/organization"
                icon="i-heroicons-building-office"
              >
                Organization Settings
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                to="/admin/templates"
                icon="i-heroicons-document-text"
              >
                Template Management
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                to="/admin/audit"
                icon="i-heroicons-shield-check"
              >
                Audit Logs
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                to="/admin/analytics"
                icon="i-heroicons-chart-pie"
              >
                Analytics
              </UButton>

              <UButton
                variant="outline"
                size="sm"
                class="w-full justify-start"
                to="/admin/billing"
                icon="i-heroicons-credit-card"
              >
                Billing & Usage
              </UButton>
            </div>
          </UCard>

          <!-- Recent Admin Activity -->
          <div class="mt-6">
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Admin Activity</h3>
              </template>

              <div class="space-y-3">
                <div
                  v-for="activity in recentAdminActivity"
                  :key="activity.id"
                  class="flex items-start space-x-3 text-sm"
                >
                  <div :class="[
                    'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                    getActivityColor(activity.type)
                  ]" />
                  <div class="flex-1">
                    <p class="text-gray-900 dark:text-white">{{ activity.description }}</p>
                    <p class="text-gray-500 dark:text-gray-400 text-xs">
                      {{ formatTimestamp(activity.timestamp) }}
                    </p>
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>

      <!-- System Alerts -->
      <div v-if="systemAlerts.length > 0" class="mt-6">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">System Alerts</h3>
          </template>

          <div class="space-y-3">
            <UAlert
              v-for="alert in systemAlerts"
              :key="alert.id"
              :color="alert.severity"
              :title="alert.title"
              :description="alert.message"
              :actions="[{
                label: 'Dismiss',
                click: () => dismissAlert(alert.id)
              }]"
            />
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MetricCard from '~/components/dashboard/MetricCard.vue'

definePageMeta({
  layout: 'default',
  middleware: 'admin'
})

const route = useRoute()
const { $fetch } = useNuxtApp()

const adminTabs = [
  { id: 'overview', name: 'Overview', to: '/admin', icon: 'i-heroicons-home' },
  { id: 'users', name: 'Users', to: '/admin/users', icon: 'i-heroicons-users' },
  { id: 'organization', name: 'Organization', to: '/admin/organization', icon: 'i-heroicons-building-office' },
  { id: 'templates', name: 'Templates', to: '/admin/templates', icon: 'i-heroicons-document-text' },
  { id: 'analytics', name: 'Analytics', to: '/admin/analytics', icon: 'i-heroicons-chart-pie' },
  { id: 'audit', name: 'Audit', to: '/admin/audit', icon: 'i-heroicons-shield-check' },
  { id: 'billing', name: 'Billing', to: '/admin/billing', icon: 'i-heroicons-credit-card' }
]

const adminMetrics = ref({
  totalUsers: 156,
  activeSessions: 23,
  storageUsed: 47,
  apiCallsToday: 12
})

const systemStatus = ref({
  services: [
    { name: 'Web Server', status: 'healthy', uptime: '99.9%', responseTime: 45 },
    { name: 'Database', status: 'healthy', uptime: '99.8%', responseTime: 23 },
    { name: 'Template Engine', status: 'healthy', uptime: '99.9%', responseTime: 67 },
    { name: 'File Storage', status: 'warning', uptime: '98.5%', responseTime: 156 }
  ],
  resources: [
    { name: 'CPU Usage', usage: 34 },
    { name: 'Memory Usage', usage: 67 },
    { name: 'Disk Usage', usage: 23 },
    { name: 'Network I/O', usage: 45 }
  ]
})

const recentAdminActivity = ref([
  {
    id: '1',
    type: 'user',
    description: 'New user registered: alice@example.com',
    timestamp: new Date(Date.now() - 1000 * 60 * 5)
  },
  {
    id: '2',
    type: 'template',
    description: 'Template "React Component" was published',
    timestamp: new Date(Date.now() - 1000 * 60 * 15)
  },
  {
    id: '3',
    type: 'system',
    description: 'Database backup completed successfully',
    timestamp: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    id: '4',
    type: 'security',
    description: 'Failed login attempt detected',
    timestamp: new Date(Date.now() - 1000 * 60 * 45)
  }
])

const systemAlerts = ref([
  {
    id: '1',
    title: 'High Memory Usage',
    message: 'Memory usage is approaching 80% capacity. Consider upgrading your plan.',
    severity: 'warning' as const
  },
  {
    id: '2',
    title: 'Certificate Expiring',
    message: 'SSL certificate expires in 30 days. Renewal required.',
    severity: 'orange' as const
  }
])

const isActiveTab = (tabId: string): boolean => {
  if (tabId === 'overview') {
    return route.path === '/admin'
  }
  return route.path.startsWith(`/admin/${tabId}`)
}

const getUsageColor = (usage: number): string => {
  if (usage >= 80) return 'red'
  if (usage >= 60) return 'orange'
  return 'primary'
}

const getActivityColor = (type: string): string => {
  const colors: Record<string, string> = {
    'user': 'bg-blue-400',
    'template': 'bg-green-400',
    'system': 'bg-gray-400',
    'security': 'bg-red-400'
  }
  return colors[type] || 'bg-gray-400'
}

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  
  return new Date(timestamp).toLocaleDateString()
}

const dismissAlert = (alertId: string) => {
  systemAlerts.value = systemAlerts.value.filter(alert => alert.id !== alertId)
}

// Load admin data on mount
onMounted(async () => {
  try {
    const data = await $fetch('/api/admin/dashboard')
    if (data) {
      adminMetrics.value = data.metrics
      systemStatus.value = data.systemStatus
      recentAdminActivity.value = data.recentActivity
      systemAlerts.value = data.alerts
    }
  } catch (error) {
    console.error('Failed to load admin dashboard data:', error)
  }
})
</script>