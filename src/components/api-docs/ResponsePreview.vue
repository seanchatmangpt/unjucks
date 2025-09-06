<template>
  <div class="space-y-4">
    <!-- Response Status -->
    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-2">
        <div :class="[
          'w-3 h-3 rounded-full',
          response.status >= 200 && response.status < 300 ? 'bg-green-400' :
          response.status >= 300 && response.status < 400 ? 'bg-yellow-400' :
          'bg-red-400'
        ]" />
        <span class="font-medium text-gray-900 dark:text-white">
          {{ response.status }} {{ response.statusText }}
        </span>
      </div>
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{ response.time }}ms
      </span>
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{ formatDataSize(response.data) }}
      </span>
    </div>

    <!-- Data Visualization -->
    <div v-if="isJsonResponse" class="space-y-4">
      <!-- Summary Stats -->
      <div v-if="jsonStats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="text-sm text-gray-500 dark:text-gray-400">Objects</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ jsonStats.objects }}
          </div>
        </div>
        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="text-sm text-gray-500 dark:text-gray-400">Arrays</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ jsonStats.arrays }}
          </div>
        </div>
        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="text-sm text-gray-500 dark:text-gray-400">Properties</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ jsonStats.properties }}
          </div>
        </div>
        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div class="text-sm text-gray-500 dark:text-gray-400">Depth</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ jsonStats.depth }}
          </div>
        </div>
      </div>

      <!-- Interactive JSON Tree -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg">
        <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div class="flex items-center justify-between">
            <h4 class="font-medium text-gray-900 dark:text-white">Response Data</h4>
            <div class="flex items-center space-x-2">
              <UButton
                variant="ghost"
                size="xs"
                @click="expandAll"
              >
                Expand All
              </UButton>
              <UButton
                variant="ghost"
                size="xs"
                @click="collapseAll"
              >
                Collapse All
              </UButton>
              <UButton
                variant="ghost"
                size="xs"
                @click="copyJson"
              >
                <UIcon name="i-heroicons-clipboard" class="w-4 h-4" />
              </UButton>
            </div>
          </div>
        </div>
        <div class="p-3 max-h-96 overflow-auto">
          <JsonTree
            :data="parsedData"
            :expanded="expandedNodes"
            @toggle-node="toggleNode"
          />
        </div>
      </div>
    </div>

    <!-- Image Preview -->
    <div v-else-if="isImageResponse" class="text-center">
      <img
        :src="getImageUrl()"
        alt="Response Image"
        class="max-w-full max-h-96 mx-auto rounded-lg shadow-md"
        @error="imageLoadError = true"
      />
      <div v-if="imageLoadError" class="p-8 text-gray-500 dark:text-gray-400">
        Failed to load image
      </div>
    </div>

    <!-- HTML Preview -->
    <div v-else-if="isHtmlResponse" class="border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h4 class="font-medium text-gray-900 dark:text-white">HTML Preview</h4>
      </div>
      <div class="p-3">
        <iframe
          :srcdoc="response.data"
          class="w-full h-64 border-0"
          sandbox="allow-same-origin"
        />
      </div>
    </div>

    <!-- CSV Preview -->
    <div v-else-if="isCsvResponse" class="border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h4 class="font-medium text-gray-900 dark:text-white">CSV Data</h4>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                v-for="header in csvData.headers"
                :key="header"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="(row, index) in csvData.rows.slice(0, 10)"
              :key="index"
              class="bg-white dark:bg-gray-900"
            >
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
                class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="csvData.rows.length > 10" class="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
          Showing first 10 of {{ csvData.rows.length }} rows
        </div>
      </div>
    </div>

    <!-- XML Preview -->
    <div v-else-if="isXmlResponse" class="border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h4 class="font-medium text-gray-900 dark:text-white">XML Structure</h4>
      </div>
      <div class="p-3 max-h-96 overflow-auto">
        <XmlTree :data="xmlData" />
      </div>
    </div>

    <!-- Text Preview -->
    <div v-else class="border border-gray-200 dark:border-gray-700 rounded-lg">
      <div class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h4 class="font-medium text-gray-900 dark:text-white">Text Content</h4>
      </div>
      <div class="p-3 max-h-96 overflow-auto">
        <pre class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ response.data }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import JsonTree from './JsonTree.vue'
import XmlTree from './XmlTree.vue'

interface Props {
  response: {
    status: number
    statusText: string
    time: number
    headers: Record<string, string>
    data: any
  }
}

const props = defineProps<Props>()

const expandedNodes = ref<Set<string>>(new Set())
const imageLoadError = ref(false)

const isJsonResponse = computed(() => {
  const contentType = props.response.headers['content-type'] || ''
  return contentType.includes('application/json') || 
         (typeof props.response.data === 'object' && props.response.data !== null)
})

const isImageResponse = computed(() => {
  const contentType = props.response.headers['content-type'] || ''
  return contentType.startsWith('image/')
})

const isHtmlResponse = computed(() => {
  const contentType = props.response.headers['content-type'] || ''
  return contentType.includes('text/html')
})

const isCsvResponse = computed(() => {
  const contentType = props.response.headers['content-type'] || ''
  return contentType.includes('text/csv') || 
         contentType.includes('application/csv')
})

const isXmlResponse = computed(() => {
  const contentType = props.response.headers['content-type'] || ''
  return contentType.includes('text/xml') || 
         contentType.includes('application/xml')
})

const parsedData = computed(() => {
  try {
    if (typeof props.response.data === 'string') {
      return JSON.parse(props.response.data)
    }
    return props.response.data
  } catch (error) {
    return props.response.data
  }
})

const jsonStats = computed(() => {
  if (!isJsonResponse.value) return null
  
  const data = parsedData.value
  const stats = {
    objects: 0,
    arrays: 0,
    properties: 0,
    depth: 0
  }
  
  const analyze = (obj: any, depth = 0): void => {
    stats.depth = Math.max(stats.depth, depth)
    
    if (Array.isArray(obj)) {
      stats.arrays++
      obj.forEach(item => analyze(item, depth + 1))
    } else if (obj && typeof obj === 'object') {
      stats.objects++
      Object.keys(obj).forEach(key => {
        stats.properties++
        analyze(obj[key], depth + 1)
      })
    }
  }
  
  analyze(data)
  return stats
})

const csvData = computed(() => {
  if (!isCsvResponse.value) return { headers: [], rows: [] }
  
  const lines = props.response.data.split('\n').filter((line: string) => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  
  const headers = lines[0].split(',').map((header: string) => header.trim().replace(/"/g, ''))
  const rows = lines.slice(1).map((line: string) => 
    line.split(',').map((cell: string) => cell.trim().replace(/"/g, ''))
  )
  
  return { headers, rows }
})

const xmlData = computed(() => {
  if (!isXmlResponse.value) return null
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(props.response.data, 'text/xml')
    return doc.documentElement
  } catch (error) {
    return null
  }
})

const formatDataSize = (data: any): string => {
  const size = new Blob([JSON.stringify(data)]).size
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const getImageUrl = (): string => {
  if (typeof props.response.data === 'string' && props.response.data.startsWith('data:')) {
    return props.response.data
  }
  return URL.createObjectURL(new Blob([props.response.data]))
}

const toggleNode = (path: string) => {
  if (expandedNodes.value.has(path)) {
    expandedNodes.value.delete(path)
  } else {
    expandedNodes.value.add(path)
  }
}

const expandAll = () => {
  const getAllPaths = (obj: any, prefix = ''): string[] => {
    const paths: string[] = []
    
    if (Array.isArray(obj)) {
      paths.push(prefix)
      obj.forEach((item, index) => {
        paths.push(...getAllPaths(item, `${prefix}[${index}]`))
      })
    } else if (obj && typeof obj === 'object') {
      paths.push(prefix)
      Object.keys(obj).forEach(key => {
        const path = prefix ? `${prefix}.${key}` : key
        paths.push(...getAllPaths(obj[key], path))
      })
    }
    
    return paths
  }
  
  const allPaths = getAllPaths(parsedData.value)
  expandedNodes.value = new Set(allPaths)
}

const collapseAll = () => {
  expandedNodes.value.clear()
}

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(parsedData.value, null, 2))
    useToast().add({
      title: 'Copied to clipboard',
      description: 'JSON data has been copied to clipboard',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Copy failed',
      description: 'Failed to copy JSON data',
      color: 'red'
    })
  }
}
</script>