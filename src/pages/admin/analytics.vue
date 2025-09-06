<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p class="text-gray-600 dark:text-gray-400">
              Comprehensive insights into your organization's development activity
            </p>
          </div>
          <div class="flex items-center space-x-4">
            <USelectMenu
              v-model="selectedTimeRange"
              :options="timeRangeOptions"
              value-attribute="value"
              option-attribute="label"
            />
            <UButton
              icon="i-heroicons-arrow-down-tray"
              variant="outline"
              @click="exportData"
            >
              Export
            </UButton>
          </div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Code Generations"
          :value="analytics.totalGenerations"
          :change="analytics.generationsChange"
          change-type="increase"
          :trend="analytics.generationsTrend"
          icon="i-heroicons-code-bracket"
        />
        <MetricCard
          title="Active Templates"
          :value="analytics.activeTemplates"
          :change="analytics.templatesChange"
          change-type="increase"
          :trend="analytics.templatesTrend"
          icon="i-heroicons-document-text"
        />
        <MetricCard
          title="Development Teams"
          :value="analytics.activeTeams"
          :change="analytics.teamsChange"
          change-type="increase"
          :trend="analytics.teamsTrend"
          icon="i-heroicons-users"
        />
        <MetricCard
          title="Time Saved"
          :value="analytics.timeSaved"
          :change="analytics.timeSavedChange"
          change-type="increase"
          :trend="analytics.timeSavedTrend"
          icon="i-heroicons-clock"
          unit="hrs"
        />
      </div>

      <!-- Main Analytics Dashboard -->
      <AnalyticsDashboard />

      <!-- Detailed Analytics Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <!-- Template Usage Analytics -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Template Usage</h3>
              <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-top-right-on-square" />
            </div>
          </template>

          <div class="space-y-4">
            <div
              v-for="template in templateUsage"
              :key="template.id"
              class="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                  <UIcon :name="getLanguageIcon(template.language)" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ template.category }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ template.usageCount }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">generations</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- User Activity Analytics -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">User Activity</h3>
              <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-top-right-on-square" />
            </div>
          </template>

          <div class="space-y-4">
            <div
              v-for="user in userActivity"
              :key="user.id"
              class="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div class="flex items-center space-x-3">
                <UAvatar :src="user.avatar" :alt="user.name" size="sm" />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ user.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.role }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ user.generationsCount }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">this period</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Performance Metrics -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Performance Metrics</h3>
              <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-top-right-on-square" />
            </div>
          </template>

          <div class="space-y-6">
            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">Average Generation Time</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ performanceMetrics.avgGenerationTime }}ms</span>
              </div>
              <UProgress :value="(1000 - performanceMetrics.avgGenerationTime) / 10" color="green" />
            </div>

            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">Success Rate</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ performanceMetrics.successRate }}%</span>
              </div>
              <UProgress :value="performanceMetrics.successRate" color="green" />
            </div>

            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">API Response Time</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ performanceMetrics.apiResponseTime }}ms</span>
              </div>
              <UProgress :value="(200 - performanceMetrics.apiResponseTime) / 2" color="blue" />
            </div>

            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">Template Validation Rate</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ performanceMetrics.validationRate }}%</span>
              </div>
              <UProgress :value="performanceMetrics.validationRate" color="primary" />
            </div>
          </div>
        </UCard>

        <!-- Error Analytics -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Error Analysis</h3>
              <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-top-right-on-square" />
            </div>
          </template>

          <div class="space-y-4">
            <div
              v-for="error in errorAnalysis"
              :key="error.type"
              class="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div class="flex items-center space-x-3">
                <div :class="[
                  'w-3 h-3 rounded-full',
                  getSeverityColor(error.severity)
                ]" />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ error.type }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ error.description }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ error.count }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">occurrences</p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MetricCard from '~/components/dashboard/MetricCard.vue'
import AnalyticsDashboard from '~/components/reporting/AnalyticsDashboard.vue'

definePageMeta({
  layout: 'default',
  middleware: 'admin'
})

const selectedTimeRange = ref('7d')

const timeRangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 12 months', value: '12m' }
]

const analytics = ref({
  totalGenerations: 45234,
  generationsChange: 12,
  generationsTrend: [120, 135, 142, 158, 165, 178, 192],
  activeTemplates: 1247,
  templatesChange: 8,
  templatesTrend: [45, 52, 48, 61, 67, 73, 82],
  activeTeams: 68,
  teamsChange: 5,
  teamsTrend: [12, 15, 18, 16, 20, 23, 25],
  timeSaved: 2840,
  timeSavedChange: 23,
  timeSavedTrend: [200, 220, 245, 280, 320, 360, 410]
})

const templateUsage = ref([
  { id: '1', name: 'React Component', category: 'Frontend', language: 'TypeScript', usageCount: 2341 },
  { id: '2', name: 'Node.js API', category: 'Backend', language: 'JavaScript', usageCount: 1987 },
  { id: '3', name: 'Vue 3 Composition', category: 'Frontend', language: 'Vue', usageCount: 1654 },
  { id: '4', name: 'Python FastAPI', category: 'Backend', language: 'Python', usageCount: 1423 },
  { id: '5', name: 'Next.js Page', category: 'Frontend', language: 'TypeScript', usageCount: 1156 }
])

const userActivity = ref([
  { id: '1', name: 'Alice Johnson', role: 'Senior Developer', avatar: null, generationsCount: 234 },
  { id: '2', name: 'Bob Smith', role: 'Tech Lead', avatar: null, generationsCount: 189 },
  { id: '3', name: 'Carol Davis', role: 'Full Stack Developer', avatar: null, generationsCount: 167 },
  { id: '4', name: 'David Wilson', role: 'Frontend Developer', avatar: null, generationsCount: 145 },
  { id: '5', name: 'Eva Martinez', role: 'Backend Developer', avatar: null, generationsCount: 132 }
])

const performanceMetrics = ref({
  avgGenerationTime: 350,
  successRate: 98.7,
  apiResponseTime: 45,
  validationRate: 94.2
})

const errorAnalysis = ref([
  { 
    type: 'Template Validation Error', 
    description: 'Invalid template syntax or structure',
    severity: 'high',
    count: 23 
  },
  { 
    type: 'Variable Resolution Error', 
    description: 'Missing or invalid template variables',
    severity: 'medium',
    count: 67 
  },
  { 
    type: 'File System Error', 
    description: 'Issues with file creation or permissions',
    severity: 'high',
    count: 12 
  },
  { 
    type: 'Network Timeout', 
    description: 'Request timeouts during generation',
    severity: 'low',
    count: 8 
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

const getSeverityColor = (severity: string): string => {
  const colors: Record<string, string> = {
    'high': 'bg-red-400',
    'medium': 'bg-yellow-400',
    'low': 'bg-blue-400'
  }
  return colors[severity] || 'bg-gray-400'
}

const exportData = async () => {
  // Implementation for exporting analytics data
  const toast = useToast()
  toast.add({
    title: 'Export Started',
    description: 'Your analytics data is being prepared for download.',
    color: 'green'
  })
}

// Load analytics data
onMounted(async () => {
  try {
    const { $fetch } = useNuxtApp()
    const data = await $fetch(`/api/admin/analytics?range=${selectedTimeRange.value}`)
    if (data) {
      analytics.value = data.analytics
      templateUsage.value = data.templateUsage
      userActivity.value = data.userActivity
      performanceMetrics.value = data.performanceMetrics
      errorAnalysis.value = data.errorAnalysis
    }
  } catch (error) {
    console.error('Failed to load analytics data:', error)
  }
})

// Watch time range changes
watch(selectedTimeRange, async (newRange) => {
  try {
    const { $fetch } = useNuxtApp()
    const data = await $fetch(`/api/admin/analytics?range=${newRange}`)
    if (data) {
      analytics.value = data.analytics
      templateUsage.value = data.templateUsage
      userActivity.value = data.userActivity
      performanceMetrics.value = data.performanceMetrics
      errorAnalysis.value = data.errorAnalysis
    }
  } catch (error) {
    console.error('Failed to load analytics data:', error)
  }
})
</script>