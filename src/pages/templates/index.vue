<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TemplateMarketplace />
    </div>
  </div>
</template>

<script setup lang="ts">
import TemplateMarketplace from '~/components/templates/TemplateMarketplace.vue'

definePageMeta({
  layout: 'default'
})
</script>