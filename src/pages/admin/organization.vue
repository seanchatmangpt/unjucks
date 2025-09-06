<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Organization Settings</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your organization configuration and security settings
        </p>
      </div>

      <OrganizationSettings />
    </div>
  </div>
</template>

<script setup lang="ts">
import OrganizationSettings from '~/components/admin/OrganizationSettings.vue'

definePageMeta({
  layout: 'default',
  middleware: 'admin'
})
</script>