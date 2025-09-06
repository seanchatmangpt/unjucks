<template>
  <div v-if="node" class="space-y-1">
    <div class="flex items-start space-x-1">
      <span class="text-blue-600 dark:text-blue-400">&lt;{{ node.tagName.toLowerCase() }}</span>
      
      <!-- Attributes -->
      <template v-if="attributes.length > 0">
        <span
          v-for="attr in attributes"
          :key="attr.name"
          class="text-green-600 dark:text-green-400"
        >
          {{ attr.name }}="<span class="text-orange-600 dark:text-orange-400">{{ attr.value }}</span>"
        </span>
      </template>
      
      <span v-if="hasChildren || textContent" class="text-blue-600 dark:text-blue-400">&gt;</span>
      <span v-else class="text-blue-600 dark:text-blue-400">/&gt;</span>
    </div>

    <!-- Text Content -->
    <div v-if="textContent && !hasChildren" class="ml-4 text-gray-900 dark:text-white">
      {{ textContent }}
    </div>

    <!-- Child Elements -->
    <div v-if="hasChildren" class="ml-4">
      <XmlNode
        v-for="(child, index) in children"
        :key="index"
        :node="child"
      />
      
      <!-- Text nodes -->
      <div
        v-if="textContent"
        class="text-gray-900 dark:text-white whitespace-pre-line"
      >
        {{ textContent }}
      </div>
    </div>

    <!-- Closing tag -->
    <div v-if="hasChildren || textContent" class="flex items-start space-x-1">
      <span class="text-blue-600 dark:text-blue-400">&lt;/{{ node.tagName.toLowerCase() }}&gt;</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  node: Element | null
}

const props = defineProps<Props>()

const attributes = computed(() => {
  if (!props.node) return []
  
  const attrs = []
  for (let i = 0; i < props.node.attributes.length; i++) {
    const attr = props.node.attributes[i]
    attrs.push({
      name: attr.name,
      value: attr.value
    })
  }
  return attrs
})

const children = computed(() => {
  if (!props.node) return []
  
  const childElements = []
  for (let i = 0; i < props.node.children.length; i++) {
    childElements.push(props.node.children[i])
  }
  return childElements
})

const hasChildren = computed(() => {
  return props.node && props.node.children.length > 0
})

const textContent = computed(() => {
  if (!props.node) return ''
  
  let text = ''
  for (let i = 0; i < props.node.childNodes.length; i++) {
    const child = props.node.childNodes[i]
    if (child.nodeType === Node.TEXT_NODE) {
      const content = child.textContent?.trim() || ''
      if (content) {
        text += content + '\n'
      }
    }
  }
  return text.trim()
})
</script>