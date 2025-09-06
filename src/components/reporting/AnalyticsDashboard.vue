<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h2>
        <p class="text-gray-600 dark:text-gray-400">Track performance and usage across your organization</p>
      </div>
      <div class="flex items-center space-x-2">
        <USelect
          v-model="timeRange"
          :options="timeRangeOptions"
          class="w-40"
        />
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-down-tray"
          @click="exportData"
        >
          Export
        </UButton>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Revenue"
        :value="metrics.totalRevenue"
        unit="$"
        :change="metrics.revenueChange"
        change-type="increase"
        :trend="metrics.revenueTrend"
        icon="i-heroicons-currency-dollar"
      />
      <MetricCard
        title="Active Users"
        :value="metrics.activeUsers"
        :change="metrics.usersChange"
        change-type="increase"
        :trend="metrics.usersTrend"
        icon="i-heroicons-users"
      />
      <MetricCard
        title="Templates Created"
        :value="metrics.templatesCreated"
        :change="metrics.templatesChange"
        change-type="increase"
        :trend="metrics.templatesTrend"
        icon="i-heroicons-document-text"
      />
      <MetricCard
        title="Code Generations"
        :value="metrics.codeGenerations"
        :change="metrics.generationsChange"
        change-type="increase"
        :trend="metrics.generationsTrend"
        icon="i-heroicons-code-bracket"
      />
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Usage Over Time -->
      <ChartWidget
        title="Usage Over Time"
        subtitle="Daily active users and generations"
        type="area"
        :data="usageOverTime"
      />

      <!-- Template Categories -->
      <ChartWidget
        title="Popular Template Categories"
        subtitle="Distribution by category"
        type="donut"
        :data="templateCategories"
      />
    </div>

    <!-- Detailed Analytics -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Top Templates -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Top Templates</h3>
        </template>
        
        <div class="space-y-4">
          <div
            v-for="(template, index) in topTemplates"
            :key="template.id"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <div class="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-xs font-bold">
                {{ index + 1 }}
              </div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ template.category }}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-medium text-gray-900 dark:text-white">{{ template.downloads }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">downloads</p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- User Activity -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">User Activity</h3>
        </template>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600 dark:text-gray-400">New Users</span>
            <span class="font-medium text-gray-900 dark:text-white">+{{ userActivity.newUsers }}</span>
          </div>
          <UProgress :value="(userActivity.newUsers / userActivity.totalUsers) * 100" color="green" />
          
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600 dark:text-gray-400">Active Users</span>
            <span class="font-medium text-gray-900 dark:text-white">{{ userActivity.activeUsers }}</span>
          </div>
          <UProgress :value="(userActivity.activeUsers / userActivity.totalUsers) * 100" color="blue" />
          
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600 dark:text-gray-400">Churned Users</span>
            <span class="font-medium text-gray-900 dark:text-white">-{{ userActivity.churnedUsers }}</span>
          </div>
          <UProgress :value="(userActivity.churnedUsers / userActivity.totalUsers) * 100" color="red" />
        </div>
      </UCard>

      <!-- Performance Metrics -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>
        </template>
        
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600 dark:text-gray-400">Average Response Time</span>
              <span class="text-gray-900 dark:text-white">{{ performance.avgResponseTime }}ms</span>
            </div>
            <UProgress 
              :value="(performance.avgResponseTime / 1000) * 100" 
              :color="performance.avgResponseTime < 200 ? 'green' : performance.avgResponseTime < 500 ? 'yellow' : 'red'"
            />
          </div>
          
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600 dark:text-gray-400">Success Rate</span>
              <span class="text-gray-900 dark:text-white">{{ performance.successRate }}%</span>
            </div>
            <UProgress :value="performance.successRate" color="green" />
          </div>
          
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600 dark:text-gray-400">Error Rate</span>
              <span class="text-gray-900 dark:text-white">{{ performance.errorRate }}%</span>
            </div>
            <UProgress :value="performance.errorRate" color="red" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Usage Patterns -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Peak Hours -->
      <ChartWidget
        title="Usage by Hour"
        subtitle="Peak usage times"
        type="bar"
        :data="usageByHour"
      />

      <!-- Geographic Distribution -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Geographic Distribution</h3>
        </template>
        
        <div class="space-y-3">
          <div
            v-for="location in geographicData"
            :key="location.country"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <div class="text-lg">{{ location.flag }}</div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ location.country }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ location.percentage }}% of users</p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-medium text-gray-900 dark:text-white">{{ location.users }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">users</p>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Conversion Funnel -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Conversion Funnel</h3>
      </template>
      
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div
          v-for="(stage, index) in conversionFunnel"
          :key="stage.name"
          class="text-center"
        >
          <div class="relative">
            <!-- Funnel Stage -->
            <div
              :class="[
                'mx-auto rounded-lg p-6 mb-4',
                index === 0 ? 'bg-blue-500' : 
                index === 1 ? 'bg-green-500' :
                index === 2 ? 'bg-yellow-500' :
                index === 3 ? 'bg-orange-500' : 'bg-red-500'
              ]"
              :style="{ width: `${100 - (index * 15)}%` }"
            >
              <div class="text-white">
                <p class="text-2xl font-bold">{{ stage.count }}</p>
                <p class="text-sm opacity-90">{{ stage.percentage }}%</p>
              </div>
            </div>
            
            <!-- Conversion Rate Arrow -->
            <div v-if="index < conversionFunnel.length - 1" class="absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2">
              <UIcon name="i-heroicons-chevron-right" class="w-6 h-6 text-gray-400" />
            </div>
          </div>
          
          <h4 class="font-medium text-gray-900 dark:text-white">{{ stage.name }}</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ stage.description }}</p>
        </div>
      </div>
    </UCard>

    <!-- Real-time Activity -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Real-time Activity</h3>
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span class="text-sm text-gray-500 dark:text-gray-400">Live</span>
          </div>
        </div>
      </template>
      
      <div class="space-y-3 max-h-64 overflow-y-auto">
        <div
          v-for="activity in realtimeActivity"
          :key="activity.id"
          class="flex items-center space-x-3 text-sm"
        >
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800">
            <UIcon :name="getActivityIcon(activity.type)" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div class="flex-1">
            <p class="text-gray-900 dark:text-white">{{ activity.description }}</p>
            <p class="text-gray-500 dark:text-gray-400 text-xs">{{ activity.user }} • {{ formatTimestamp(activity.timestamp) }}</p>
          </div>
          <div class="text-gray-500 dark:text-gray-400 text-xs">
            {{ activity.location }}
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import MetricCard from '~/components/dashboard/MetricCard.vue'
import ChartWidget from '~/components/dashboard/ChartWidget.vue'

const { $fetch } = useNuxtApp()

const timeRange = ref('30d')
const loading = ref(true)

const timeRangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 12 months', value: '12m' }
]

const metrics = ref({
  totalRevenue: 45678,
  revenueChange: 12,
  revenueTrend: [40000, 41000, 42500, 44000, 45678],
  activeUsers: 1234,
  usersChange: 8,
  usersTrend: [1150, 1180, 1200, 1220, 1234],
  templatesCreated: 89,
  templatesChange: 15,
  templatesTrend: [75, 78, 82, 85, 89],
  codeGenerations: 5678,
  generationsChange: 23,
  generationsTrend: [4500, 4800, 5100, 5400, 5678]
})

const usageOverTime = ref([
  { label: 'Week 1', value: 1150 },
  { label: 'Week 2', value: 1180 },
  { label: 'Week 3', value: 1200 },
  { label: 'Week 4', value: 1234 }
])

const templateCategories = ref([
  { label: 'Frontend', value: 45 },
  { label: 'Backend', value: 30 },
  { label: 'Full Stack', value: 15 },
  { label: 'Mobile', value: 10 }
])

const topTemplates = ref([
  { id: '1', name: 'React Component', category: 'Frontend', downloads: 1234 },
  { id: '2', name: 'Node.js API', category: 'Backend', downloads: 987 },
  { id: '3', name: 'Vue Component', category: 'Frontend', downloads: 765 },
  { id: '4', name: 'Express Server', category: 'Backend', downloads: 543 },
  { id: '5', name: 'Next.js App', category: 'Full Stack', downloads: 321 }
])

const userActivity = ref({
  totalUsers: 1234,
  newUsers: 89,
  activeUsers: 987,
  churnedUsers: 12
})

const performance = ref({
  avgResponseTime: 245,
  successRate: 99.2,
  errorRate: 0.8
})

const usageByHour = ref([
  { label: '00:00', value: 45 },
  { label: '06:00', value: 23 },
  { label: '12:00', value: 89 },
  { label: '18:00', value: 67 }
])

const geographicData = ref([
  { country: 'United States', flag: '🇺🇸', users: 567, percentage: 46 },
  { country: 'United Kingdom', flag: '🇬🇧', users: 234, percentage: 19 },
  { country: 'Germany', flag: '🇩🇪', users: 189, percentage: 15 },
  { country: 'Canada', flag: '🇨🇦', users: 123, percentage: 10 },
  { country: 'Others', flag: '🌍', users: 121, percentage: 10 }
])

const conversionFunnel = ref([
  {
    name: 'Visitors',
    description: 'Website visitors',
    count: 10000,
    percentage: 100
  },
  {
    name: 'Sign Ups',
    description: 'Account registrations',
    count: 2500,
    percentage: 25
  },
  {
    name: 'Active Users',
    description: 'Created at least one template',
    count: 1250,
    percentage: 12.5
  },
  {
    name: 'Generated Code',
    description: 'Used code generation',
    count: 750,
    percentage: 7.5
  },
  {
    name: 'Paid Users',
    description: 'Upgraded to paid plan',
    count: 125,
    percentage: 1.25
  }
])

const realtimeActivity = ref([
  {
    id: '1',
    type: 'generation',
    description: 'Generated React component',
    user: 'alice@example.com',
    location: 'San Francisco, CA',
    timestamp: new Date(Date.now() - 1000 * 30)
  },
  {
    id: '2',
    type: 'template',
    description: 'Created new template',
    user: 'bob@example.com', 
    location: 'London, UK',
    timestamp: new Date(Date.now() - 1000 * 60)
  },
  {
    id: '3',
    type: 'signup',
    description: 'New user registered',
    user: 'carol@example.com',
    location: 'Berlin, DE',
    timestamp: new Date(Date.now() - 1000 * 90)
  }
])

const getActivityIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'generation': 'i-heroicons-code-bracket',
    'template': 'i-heroicons-document-text',
    'signup': 'i-heroicons-user-plus',
    'download': 'i-heroicons-arrow-down-tray'
  }
  return icons[type] || 'i-heroicons-information-circle'
}

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  
  return new Date(timestamp).toLocaleDateString()
}

const exportData = async () => {
  try {
    const data = await $fetch('/api/analytics/export', {
      method: 'POST',
      body: { timeRange: timeRange.value }
    })
    
    // Create and download CSV
    const csv = convertToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${timeRange.value}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    useToast().add({
      title: 'Export completed',
      description: 'Analytics data has been exported to CSV',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Export failed',
      description: 'Failed to export analytics data',
      color: 'red'
    })
  }
}

const convertToCSV = (data: any): string => {
  // Simple CSV conversion - would need to be more sophisticated in practice
  const headers = Object.keys(data[0] || {})
  const rows = data.map((row: any) => headers.map(header => row[header]).join(','))
  return [headers.join(','), ...rows].join('\n')
}

// Load analytics data
onMounted(async () => {
  try {
    const data = await $fetch(`/api/analytics?timeRange=${timeRange.value}`)
    if (data) {
      Object.assign(metrics.value, data.metrics)
      usageOverTime.value = data.usageOverTime
      templateCategories.value = data.templateCategories
      topTemplates.value = data.topTemplates
      userActivity.value = data.userActivity
      performance.value = data.performance
      geographicData.value = data.geographicData
    }
  } catch (error) {
    console.error('Failed to load analytics data:', error)
  } finally {
    loading.value = false
  }
})

// Watch time range changes
watch(timeRange, async (newRange) => {
  loading.value = true
  try {
    const data = await $fetch(`/api/analytics?timeRange=${newRange}`)
    if (data) {
      Object.assign(metrics.value, data.metrics)
      usageOverTime.value = data.usageOverTime
      templateCategories.value = data.templateCategories
    }
  } catch (error) {
    console.error('Failed to reload analytics data:', error)
  } finally {
    loading.value = false
  }
})
</script>