<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
    
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-medium text-gray-500">Total Users</h3>
        <p class="text-3xl font-bold text-blue-600">{{ stats.totalUsers }}</p>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-medium text-gray-500">Active Sessions</h3>
        <p class="text-3xl font-bold text-green-600">{{ stats.activeSessions }}</p>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-medium text-gray-500">API Calls</h3>
        <p class="text-3xl font-bold text-purple-600">{{ stats.apiCalls }}</p>
      </div>
    </div>
    
    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-4">Recent Activity</h3>
        <div class="space-y-3">
          <div 
            v-for="activity in recentActivity" 
            :key="activity.id"
            class="flex items-center justify-between py-2 border-b border-gray-100"
          >
            <span class="text-gray-800">{{ activity.action }}</span>
            <span class="text-sm text-gray-500">{{ activity.time }}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h3 class="text-lg font-semibold mb-4">System Status</h3>
        <div class="space-y-4">
          <div 
            v-for="service in systemStatus" 
            :key="service.name"
            class="flex items-center justify-between"
          >
            <span class="text-gray-800">{{ service.name }}</span>
            <span 
              :class="{
                'text-green-600': service.status === 'healthy',
                'text-yellow-600': service.status === 'warning',
                'text-red-600': service.status === 'error'
              }"
              class="font-semibold"
            >
              {{ service.status }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Real-time Updates -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h3 class="text-lg font-semibold mb-4">Real-time Updates</h3>
      <p class="text-gray-600 mb-4">Last updated: {{ lastUpdate }}</p>
      <button 
        @click="refreshData" 
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        :disabled="isRefreshing"
      >
        {{ isRefreshing ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>
  </div>
</template>

<script setup>
// Page metadata
useHead({
  title: 'Dashboard - MyNuxtApp',
  meta: [
    { name: 'description', content: 'Application dashboard and analytics' }
  ]
})

// Reactive state
const stats = reactive({
  totalUsers: 1247,
  activeSessions: 89,
  apiCalls: 45210
})

const recentActivity = ref([
  { id: 1, action: 'User login', time: '2 minutes ago' },
  { id: 2, action: 'API call made', time: '5 minutes ago' },
  { id: 3, action: 'Data updated', time: '10 minutes ago' },
  { id: 4, action: 'New user registered', time: '15 minutes ago' }
])

const systemStatus = ref([
  { name: 'Database', status: 'healthy' },
  { name: 'API Server', status: 'healthy' },
  { name: 'Cache', status: 'warning' },
  { name: 'File Storage', status: 'healthy' }
])

const lastUpdate = ref(new Date().toLocaleTimeString())
const isRefreshing = ref(false)

// Methods
const refreshData = async () => {
  isRefreshing.value = true
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Update stats with random values
  stats.totalUsers = Math.floor(Math.random() * 1000) + 1000
  stats.activeSessions = Math.floor(Math.random() * 100) + 50
  stats.apiCalls = Math.floor(Math.random() * 50000) + 40000
  
  lastUpdate.value = new Date().toLocaleTimeString()
  isRefreshing.value = false
}

// Auto-refresh every 30 seconds
onMounted(() => {
  const interval = setInterval(() => {
    lastUpdate.value = new Date().toLocaleTimeString()
  }, 30000)
  
  onBeforeUnmount(() => {
    clearInterval(interval)
  })
})
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>