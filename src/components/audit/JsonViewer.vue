<template>
  <div class="font-mono text-sm">
    <pre class="text-gray-800 dark:text-gray-200">{{ formattedJson }}</pre>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: any
}

const props = defineProps<Props>()

const formattedJson = computed(() => {
  try {
    return JSON.stringify(props.data, null, 2)
  } catch (error) {
    return String(props.data)
  }
})
</script>