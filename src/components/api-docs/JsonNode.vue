<template>
  <div>
    <div
      v-if="hasChildren"
      class="flex items-start space-x-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1"
      @click="$emit('toggle', path)"
    >
      <UIcon
        :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        class="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0"
      />
      <span class="text-gray-600 dark:text-gray-400">{{ displayKey }}</span>
      <span class="text-gray-500 dark:text-gray-500">{{ typeInfo }}</span>
    </div>
    
    <div
      v-else
      class="flex items-start space-x-1 px-1"
    >
      <span class="w-3 flex-shrink-0"></span>
      <span class="text-gray-600 dark:text-gray-400">{{ displayKey }}</span>
      <span class="text-gray-900 dark:text-white">{{ displayValue }}</span>
    </div>

    <div v-if="hasChildren && isExpanded" class="ml-4 border-l border-gray-200 dark:border-gray-700 pl-2">
      <template v-if="isArray">
        <JsonNode
          v-for="(item, index) in data"
          :key="index"
          :data="item"
          :path="`${path}[${index}]`"
          :display-key="`[${index}]`"
          :expanded="expanded"
          @toggle="$emit('toggle', $event)"
        />
      </template>
      <template v-else>
        <JsonNode
          v-for="(value, key) in data"
          :key="key"
          :data="value"
          :path="path ? `${path}.${key}` : String(key)"
          :display-key="String(key)"
          :expanded="expanded"
          @toggle="$emit('toggle', $event)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: any
  path: string
  displayKey?: string
  expanded: Set<string>
}

const props = withDefaults(defineProps<Props>(), {
  displayKey: ''
})

defineEmits<{
  toggle: [path: string]
}>()

const isArray = computed(() => Array.isArray(props.data))
const isObject = computed(() => props.data && typeof props.data === 'object' && !isArray.value)
const hasChildren = computed(() => isArray.value || isObject.value)
const isExpanded = computed(() => props.expanded.has(props.path))

const typeInfo = computed(() => {
  if (isArray.value) {
    return `Array(${props.data.length})`
  }
  if (isObject.value) {
    const keys = Object.keys(props.data)
    return `Object{${keys.length}}`
  }
  return ''
})

const displayValue = computed(() => {
  if (props.data === null) return 'null'
  if (props.data === undefined) return 'undefined'
  if (typeof props.data === 'boolean') return props.data.toString()
  if (typeof props.data === 'number') return props.data.toString()
  if (typeof props.data === 'string') {
    const truncated = props.data.length > 50 ? props.data.substring(0, 47) + '...' : props.data
    return `"${truncated}"`
  }
  return String(props.data)
})
</script>