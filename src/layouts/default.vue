<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Navigation -->
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo and Navigation -->
          <div class="flex items-center space-x-8">
            <NuxtLink to="/dashboard" class="flex items-center space-x-2">
              <UIcon name="i-heroicons-cube-transparent" class="w-8 h-8 text-primary-600" />
              <span class="font-bold text-xl text-gray-900 dark:text-white">Unjucks Enterprise</span>
            </NuxtLink>
            
            <nav class="hidden md:flex space-x-8">
              <NuxtLink
                to="/dashboard"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium"
                active-class="text-primary-600 dark:text-primary-400"
              >
                Dashboard
              </NuxtLink>
              <NuxtLink
                to="/templates"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium"
                active-class="text-primary-600 dark:text-primary-400"
              >
                Templates
              </NuxtLink>
              <NuxtLink
                to="/docs"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium"
                active-class="text-primary-600 dark:text-primary-400"
              >
                API Docs
              </NuxtLink>
              <NuxtLink
                v-if="hasPermission('admin', 'read')"
                to="/admin"
                class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium"
                active-class="text-primary-600 dark:text-primary-400"
              >
                Admin
              </NuxtLink>
            </nav>
          </div>

          <!-- User Menu -->
          <div class="flex items-center space-x-4">
            <!-- Presence Indicators -->
            <div v-if="presenceIndicators.length > 0" class="flex -space-x-2">
              <div
                v-for="presence in presenceIndicators.slice(0, 3)"
                :key="presence.userId"
                class="relative"
              >
                <UAvatar
                  :src="presence.user.avatar"
                  :alt="presence.user.name"
                  size="sm"
                  class="border-2 border-white dark:border-gray-800"
                />
                <div
                  class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                  :style="{ backgroundColor: presence.color }"
                />
              </div>
              <div
                v-if="presenceIndicators.length > 3"
                class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300"
              >
                +{{ presenceIndicators.length - 3 }}
              </div>
            </div>

            <!-- Notifications -->
            <UButton variant="ghost" size="sm" square>
              <UIcon name="i-heroicons-bell" class="w-5 h-5" />
            </UButton>

            <!-- Color Mode Toggle -->
            <ClientOnly>
              <UButton
                :icon="$colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
                variant="ghost"
                size="sm"
                square
                @click="$colorMode.preference = $colorMode.value === 'dark' ? 'light' : 'dark'"
              />
            </ClientOnly>

            <!-- User Dropdown -->
            <UDropdown :items="userMenuItems" mode="click">
              <UButton variant="ghost" class="flex items-center space-x-2">
                <UAvatar :src="user?.avatar" :alt="user?.name" size="sm" />
                <span class="hidden md:block text-sm font-medium">{{ user?.name }}</span>
                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" />
              </UButton>
            </UDropdown>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>

<script setup>
const { user, logout, hasPermission } = useAuth()
const { presenceIndicators } = useRealTime()
const router = useRouter()

const userMenuItems = [
  [{
    label: user.value?.email || 'User',
    slot: 'account',
    disabled: true
  }], 
  [{
    label: 'Profile Settings',
    icon: 'i-heroicons-user-circle',
    click: () => router.push('/profile')
  }, {
    label: 'Organization Settings', 
    icon: 'i-heroicons-building-office',
    click: () => router.push('/admin/organization')
  }],
  [{
    label: 'Sign out',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    click: logout
  }]
]
</script>