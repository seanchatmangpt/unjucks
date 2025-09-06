<template>
  <div class="font-mono text-sm">
    <XmlNode :node="data" />
  </div>
</template>

<script setup lang="ts">
import XmlNode from './XmlNode.vue'

interface Props {
  data: Element | null
}

defineProps<Props>()
</script>