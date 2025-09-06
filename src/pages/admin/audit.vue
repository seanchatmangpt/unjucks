<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AuditLogViewer />
    </div>
  </div>
</template>

<script setup lang="ts">
import AuditLogViewer from '~/components/audit/AuditLogViewer.vue'

definePageMeta({
  layout: 'default',
  middleware: 'admin'
})
</script>