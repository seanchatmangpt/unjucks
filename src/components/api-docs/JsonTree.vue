<template>
  <div class="font-mono text-sm">
    <JsonNode
      :data="data"
      :path="''"
      :expanded="expanded"
      @toggle="$emit('toggle-node', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import JsonNode from './JsonNode.vue'

interface Props {
  data: any
  expanded: Set<string>
}

defineProps<Props>()

defineEmits<{
  'toggle-node': [path: string]
}>()
</script>