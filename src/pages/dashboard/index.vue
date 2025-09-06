<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p class="text-gray-600 dark:text-gray-400">
              Welcome back, {{ user?.name }}
            </p>
          </div>
          <div class="flex items-center space-x-4">
            <UButton 
              icon="i-heroicons-plus"
              to="/templates/create"
            >
              Create Template
            </UButton>
            <UButton
              variant="outline"
              icon="i-heroicons-code-bracket"
              to="/templates/generate"
            >
              Generate Code
            </UButton>
          </div>
        </div>
      </div>

      <!-- Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Templates"
          :value="metrics.totalTemplates"
          :change="12"
          change-type="increase"
          :trend="[45, 52, 48, 61, 67, 73, 82]"
          icon="i-heroicons-document-text"
        />
        <MetricCard
          title="Code Generations"
          :value="metrics.codeGenerations"
          :change="8"
          change-type="increase"
          :trend="[12, 19, 25, 31, 28, 35, 42]"
          icon="i-heroicons-code-bracket"
        />
        <MetricCard
          title="Active Users"
          :value="metrics.activeUsers"
          :change="5"
          change-type="increase"
          :trend="[8, 12, 15, 18, 16, 20, 23]"
          icon="i-heroicons-users"
        />
        <MetricCard
          title="API Requests"
          :value="metrics.apiRequests"
          :change="23"
          change-type="increase"
          :trend="[120, 135, 142, 158, 165, 178, 192]"
          icon="i-heroicons-signal"
          unit="K"
        />
      </div>

      <!-- Charts and Activity -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- Usage Chart -->
        <div class="lg:col-span-2">
          <ChartWidget
            title="Template Usage"
            subtitle="Last 30 days"
            type="area"
            :data="usageChartData"
          />
        </div>

        <!-- Activity Feed -->
        <div>
          <ActivityFeed :activities="recentActivity" :limit="8" />
        </div>
      </div>

      <!-- Popular Templates and Recent Generations -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Popular Templates -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Popular Templates</h3>
              <UButton variant="ghost" size="sm" to="/templates">
                View All
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 ml-1" />
              </UButton>
            </div>
          </template>

          <div class="space-y-4">
            <div
              v-for="template in popularTemplates"
              :key="template.id"
              class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
              @click="navigateTo(`/templates/${template.id}`)"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                  <UIcon 
                    :name="getLanguageIcon(template.language)" 
                    class="w-5 h-5 text-primary-600 dark:text-primary-400" 
                  />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ template.category }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ template.downloads }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">downloads</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Recent Code Generations -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Generations</h3>
              <UButton variant="ghost" size="sm" to="/generations">
                View All
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 ml-1" />
              </UButton>
            </div>
          </template>

          <div class="space-y-4">
            <div
              v-for="generation in recentGenerations"
              :key="generation.id"
              class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
              @click="navigateTo(`/generations/${generation.id}`)"
            >
              <div class="flex items-center space-x-3">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  getStatusColor(generation.status)
                ]">
                  <UIcon :name="getStatusIcon(generation.status)" class="w-4 h-4" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ generation.template.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ formatTimestamp(generation.createdAt) }}
                  </p>
                </div>
              </div>
              <UBadge 
                :color="getBadgeColor(generation.status)"
                variant="subtle"
                class="capitalize"
              >
                {{ generation.status }}
              </UBadge>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Quick Actions -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <UButton
            variant="outline"
            class="h-24 flex flex-col items-center justify-center space-y-2"
            to="/templates/create"
          >
            <UIcon name="i-heroicons-plus-circle" class="w-8 h-8" />
            <span>Create Template</span>
          </UButton>

          <UButton
            variant="outline"
            class="h-24 flex flex-col items-center justify-center space-y-2"
            to="/templates/marketplace"
          >
            <UIcon name="i-heroicons-shopping-bag" class="w-8 h-8" />
            <span>Browse Marketplace</span>
          </UButton>

          <UButton
            variant="outline"
            class="h-24 flex flex-col items-center justify-center space-y-2"
            to="/docs"
          >
            <UIcon name="i-heroicons-book-open" class="w-8 h-8" />
            <span>API Documentation</span>
          </UButton>

          <UButton
            variant="outline"
            class="h-24 flex flex-col items-center justify-center space-y-2"
            to="/admin"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-8 h-8" />
            <span>Settings</span>
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import MetricCard from '~/components/dashboard/MetricCard.vue'
import ChartWidget from '~/components/dashboard/ChartWidget.vue'
import ActivityFeed from '~/components/dashboard/ActivityFeed.vue'

definePageMeta({
  layout: 'default'
})

const { user } = useAuth()
const { $fetch } = useNuxtApp()

const metrics = ref({
  totalTemplates: 1247,
  codeGenerations: 8932,
  activeUsers: 342,
  apiRequests: 156
})

const usageChartData = ref([
  { label: 'Jan 1', value: 45 },
  { label: 'Jan 8', value: 52 },
  { label: 'Jan 15', value: 48 },
  { label: 'Jan 22', value: 61 },
  { label: 'Jan 29', value: 67 },
  { label: 'Feb 5', value: 73 },
  { label: 'Feb 12', value: 82 }
])

const recentActivity = ref([
  {
    id: '1',
    userId: 'user1',
    user: { name: 'Alice Johnson', avatar: null },
    action: 'create',
    resource: 'Template',
    resourceId: 'template1',
    metadata: {},
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    organizationId: 'org1'
  },
  {
    id: '2',
    userId: 'user2',
    user: { name: 'Bob Smith', avatar: null },
    action: 'generate',
    resource: 'Code',
    resourceId: 'gen1',
    metadata: {},
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    organizationId: 'org1'
  },
  {
    id: '3',
    userId: 'user3',
    user: { name: 'Carol Davis', avatar: null },
    action: 'download',
    resource: 'Template',
    resourceId: 'template2',
    metadata: {},
    ipAddress: '192.168.1.3',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    organizationId: 'org1'
  }
])

const popularTemplates = ref([
  {
    id: '1',
    name: 'React Component',
    category: 'Frontend',
    language: 'TypeScript',
    downloads: 1234
  },
  {
    id: '2',
    name: 'Node.js API',
    category: 'Backend',
    language: 'JavaScript',
    downloads: 987
  },
  {
    id: '3',
    name: 'Vue 3 Composition',
    category: 'Frontend',
    language: 'Vue',
    downloads: 765
  },
  {
    id: '4',
    name: 'Python FastAPI',
    category: 'Backend',
    language: 'Python',
    downloads: 543
  }
])

const recentGenerations = ref([
  {
    id: '1',
    template: { name: 'React Component' },
    status: 'completed',
    createdAt: new Date(Date.now() - 1000 * 60 * 10)
  },
  {
    id: '2',
    template: { name: 'Node.js API' },
    status: 'generating',
    createdAt: new Date(Date.now() - 1000 * 60 * 5)
  },
  {
    id: '3',
    template: { name: 'Vue Component' },
    status: 'completed',
    createdAt: new Date(Date.now() - 1000 * 60 * 20)
  },
  {
    id: '4',
    template: { name: 'Python Script' },
    status: 'failed',
    createdAt: new Date(Date.now() - 1000 * 60 * 30)
  }
])

const getLanguageIcon = (language: string): string => {
  const icons: Record<string, string> = {
    'TypeScript': 'i-simple-icons-typescript',
    'JavaScript': 'i-simple-icons-javascript',
    'Vue': 'i-simple-icons-vuedotjs',
    'React': 'i-simple-icons-react',
    'Python': 'i-simple-icons-python',
    'Go': 'i-simple-icons-go',
    'Rust': 'i-simple-icons-rust'
  }
  return icons[language] || 'i-heroicons-code-bracket'
}

const getStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    'completed': 'i-heroicons-check',
    'generating': 'i-heroicons-arrow-path',
    'failed': 'i-heroicons-x-mark',
    'pending': 'i-heroicons-clock'
  }
  return icons[status] || 'i-heroicons-clock'
}

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'completed': 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    'generating': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    'failed': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    'pending': 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
  }
  return colors[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
}

const getBadgeColor = (status: string): string => {
  const colors: Record<string, string> = {
    'completed': 'green',
    'generating': 'blue',
    'failed': 'red',
    'pending': 'gray'
  }
  return colors[status] || 'gray'
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

// Load dashboard data on mount
onMounted(async () => {
  try {
    const data = await $fetch('/api/dashboard')
    if (data) {
      metrics.value = data.metrics
      usageChartData.value = data.usageChart
      recentActivity.value = data.recentActivity
      popularTemplates.value = data.popularTemplates
      recentGenerations.value = data.recentGenerations
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
})
</script>