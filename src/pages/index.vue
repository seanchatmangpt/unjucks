<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
    <!-- Hero Section -->
    <section class="relative overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div class="text-center">
          <div class="flex items-center justify-center mb-8">
            <UIcon name="i-heroicons-cube-transparent" class="w-16 h-16 text-primary-600 mr-4" />
            <h1 class="text-5xl font-bold text-gray-900 dark:text-white">
              Unjucks Enterprise
            </h1>
          </div>
          
          <p class="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            The next-generation intelligent code generator that revolutionizes scaffolding with AI integration, 
            real-time collaboration, and enterprise-grade security.
          </p>

          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <UButton 
              size="xl" 
              to="/dashboard"
              class="px-8 py-4"
            >
              Get Started
              <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 ml-2" />
            </UButton>
            
            <UButton 
              variant="outline" 
              size="xl" 
              to="/templates"
              class="px-8 py-4"
            >
              Browse Templates
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 ml-2" />
            </UButton>
          </div>

          <!-- Live Demo Stats -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div class="text-center">
              <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ stats.templates }}+</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Templates</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ stats.generations }}K+</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Code Generations</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ stats.developers }}+</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Developers</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ stats.companies }}+</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Companies</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-20 bg-white dark:bg-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Everything you need for modern development
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Powerful features designed for teams that build at scale
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="text-center p-6 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:shadow-lg transition-all duration-200"
          >
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mx-auto mb-4">
              <UIcon :name="feature.icon" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ feature.title }}</h3>
            <p class="text-gray-600 dark:text-gray-400">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Enterprise Features -->
    <section class="py-20 bg-gray-50 dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Built for Enterprise
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Security, scalability, and compliance features that enterprises demand
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Enterprise-grade Security & Compliance
            </h3>
            <div class="space-y-4">
              <div class="flex items-start space-x-3">
                <UIcon name="i-heroicons-shield-check" class="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Multi-tenant Architecture</h4>
                  <p class="text-gray-600 dark:text-gray-400">Complete isolation between organizations with role-based access control</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <UIcon name="i-heroicons-lock-closed" class="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Advanced Security</h4>
                  <p class="text-gray-600 dark:text-gray-400">End-to-end encryption, SSO integration, and comprehensive audit trails</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <UIcon name="i-heroicons-chart-bar-square" class="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Real-time Analytics</h4>
                  <p class="text-gray-600 dark:text-gray-400">Comprehensive reporting and analytics with usage insights</p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-600 dark:text-gray-400">System Health</span>
                <UBadge color="green" variant="subtle">99.9% Uptime</UBadge>
              </div>
              
              <div class="space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">API Performance</span>
                  <span class="font-medium text-gray-900 dark:text-white">45ms avg</span>
                </div>
                <UProgress :value="95" color="green" />
              </div>

              <div class="space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Security Score</span>
                  <span class="font-medium text-gray-900 dark:text-white">A+ Rating</span>
                </div>
                <UProgress :value="98" color="green" />
              </div>

              <div class="space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Compliance</span>
                  <span class="font-medium text-gray-900 dark:text-white">SOC2 Type II</span>
                </div>
                <UProgress :value="100" color="green" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20 bg-primary-600 dark:bg-primary-800">
      <div class="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-white mb-4">
          Ready to accelerate your development?
        </h2>
        <p class="text-xl text-primary-100 mb-8">
          Join thousands of developers using Unjucks Enterprise to build faster and smarter.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <UButton 
            size="xl" 
            color="white" 
            to="/dashboard"
            class="px-8 py-4"
          >
            Start Free Trial
          </UButton>
          <UButton 
            variant="outline" 
            size="xl" 
            color="white"
            to="/docs"
            class="px-8 py-4"
          >
            View Documentation
          </UButton>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const stats = ref({
  templates: 1247,
  generations: 89,
  developers: 5420,
  companies: 180
})

const features = [
  {
    title: 'AI-Powered Generation',
    description: 'Intelligent code generation with context awareness and smart suggestions',
    icon: 'i-heroicons-cpu-chip'
  },
  {
    title: 'Real-time Collaboration',
    description: 'Work together with your team in real-time with presence indicators',
    icon: 'i-heroicons-users'
  },
  {
    title: 'Template Marketplace',
    description: 'Access thousands of pre-built templates or create and share your own',
    icon: 'i-heroicons-shopping-bag'
  },
  {
    title: 'Multi-tenant Architecture',
    description: 'Complete organizational isolation with advanced role-based permissions',
    icon: 'i-heroicons-building-office'
  },
  {
    title: 'Advanced Analytics',
    description: 'Comprehensive reporting and insights into your development workflow',
    icon: 'i-heroicons-chart-bar'
  },
  {
    title: 'API-First Design',
    description: 'Powerful REST API with interactive documentation and code generation',
    icon: 'i-heroicons-code-bracket'
  }
]

// Animate stats on mount
onMounted(() => {
  const animateValue = (start: number, end: number, callback: (value: number) => void) => {
    let current = start
    const increment = Math.ceil((end - start) / 50)
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        current = end
        clearInterval(timer)
      }
      callback(current)
    }, 20)
  }

  animateValue(0, 1247, (value) => { stats.value.templates = value })
  animateValue(0, 89, (value) => { stats.value.generations = value })
  animateValue(0, 5420, (value) => { stats.value.developers = value })
  animateValue(0, 180, (value) => { stats.value.companies = value })
})
</script>

<style scoped>
.bg-grid-pattern {
  background-image: 
    linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>