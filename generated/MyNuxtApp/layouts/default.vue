<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation Header -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <!-- Logo -->
            <NuxtLink to="/" class="flex items-center">
              <span class="text-xl font-bold text-blue-600">MyNuxtApp</span>
            </NuxtLink>
            
            <!-- Main Navigation -->
            <div class="hidden md:flex ml-10 space-x-8">
              <NuxtLink 
                to="/" 
                class="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                :class="{ 'text-blue-600': $route.path === '/' }"
              >
                Home
              </NuxtLink>
              <NuxtLink 
                to="/users" 
                class="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                :class="{ 'text-blue-600': $route.path === '/users' }"
              >
                Users
              </NuxtLink>
              <NuxtLink 
                to="/dashboard" 
                class="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                :class="{ 'text-blue-600': $route.path === '/dashboard' }"
              >
                Dashboard
              </NuxtLink>
            </div>
          </div>
          
          <!-- User Menu -->
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-500">
              Nuxt {{ nuxtVersion }}
            </span>
            <button 
              class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              @click="toggleTheme"
            >
              {{ isDark ? '☀️' : '🌙' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Mobile menu button -->
      <div class="md:hidden">
        <button 
          @click="mobileMenuOpen = !mobileMenuOpen"
          class="block px-4 py-2 text-gray-900 hover:text-blue-600"
        >
          Menu
        </button>
      </div>
      
      <!-- Mobile Navigation -->
      <div v-if="mobileMenuOpen" class="md:hidden">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
          <NuxtLink 
            to="/" 
            class="block px-3 py-2 text-base font-medium text-gray-900 hover:text-blue-600"
            @click="mobileMenuOpen = false"
          >
            Home
          </NuxtLink>
          <NuxtLink 
            to="/users" 
            class="block px-3 py-2 text-base font-medium text-gray-900 hover:text-blue-600"
            @click="mobileMenuOpen = false"
          >
            Users
          </NuxtLink>
          <NuxtLink 
            to="/dashboard" 
            class="block px-3 py-2 text-base font-medium text-gray-900 hover:text-blue-600"
            @click="mobileMenuOpen = false"
          >
            Dashboard
          </NuxtLink>
        </div>
      </div>
    </nav>
    
    <!-- Main Content -->
    <main class="flex-1">
      <slot />
    </main>
    
    <!-- Footer -->
    <footer class="bg-white border-t mt-12">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <p class="text-gray-500 text-sm">
            © 2024 MyNuxtApp. Built with Nuxt 4 & Unjucks.
          </p>
          <div class="flex space-x-4 text-sm text-gray-500">
            <span>Generated: {{ new Date().toLocaleDateString() }}</span>
            <span>|</span>
            <span>{{ $route.path }}</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
// Layout state
const mobileMenuOpen = ref(false)
const isDark = ref(false)
const nuxtVersion = '4.0'

// Theme toggle
const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

// Close mobile menu on route change
watch(() => useRoute().path, () => {
  mobileMenuOpen.value = false
})

// Meta tags for layout
useHead({
  titleTemplate: '%s - MyNuxtApp',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<style scoped>
/* Custom scrollbar */
:deep(.custom-scrollbar) {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

:deep(.custom-scrollbar::-webkit-scrollbar) {
  width: 6px;
}

:deep(.custom-scrollbar::-webkit-scrollbar-track) {
  background: #f7fafc;
}

:deep(.custom-scrollbar::-webkit-scrollbar-thumb) {
  background: #cbd5e0;
  border-radius: 3px;
}

:deep(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
  background: #a0aec0;
}
</style>