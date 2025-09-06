<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TemplateDesigner />
    </div>
  </div>
</template>

<script setup lang="ts">
import TemplateDesigner from '~/components/templates/TemplateDesigner.vue'

definePageMeta({
  layout: 'default'
})
</script>