<template>
  <div id="app">
    <NuxtWelcome />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// This is the root component of the Nuxt 4 application
useHead({
  titleTemplate: '%s - Test Nuxt App',
  meta: [
    { name: 'description', content: 'Test Nuxt 4 application for validation' }
  ]
})
</script>

<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>