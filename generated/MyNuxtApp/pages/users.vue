<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Users</h1>
    
    <div class="mb-6">
      <button 
        @click="refreshUsers" 
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Refresh Users
      </button>
    </div>
    
    <div v-if="pending" class="text-center py-4">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-2 text-gray-600">Loading users...</p>
    </div>
    
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded p-4 mb-6">
      <p class="text-red-800">Error loading users: {{ error.message }}</p>
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="user in data" 
        :key="user.id" 
        class="bg-white p-4 rounded-lg shadow-md border"
      >
        <h3 class="text-lg font-semibold text-gray-900">{{ user.name }}</h3>
        <p class="text-gray-600">{{ user.email }}</p>
        <p class="text-sm text-gray-500 mt-2">ID: {{ user.id }}</p>
      </div>
    </div>
    
    <div v-if="!pending && data && data.length === 0" class="text-center py-8">
      <p class="text-gray-600">No users found</p>
    </div>
  </div>
</template>

<script setup>
// Page metadata
useHead({
  title: 'Users - MyNuxtApp',
  meta: [
    { name: 'description', content: 'User management and profiles' }
  ]
})

// Fetch users from API
const { data, pending, error, refresh: refreshUsers } = await useFetch('/api/users', {
  default: () => [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com' }
  ]
})

// Handle user interactions
const selectUser = (user) => {
  navigateTo(`/users/${user.id}`)
}
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>