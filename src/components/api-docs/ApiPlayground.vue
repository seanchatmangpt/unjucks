<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">API Documentation</h2>
        <p class="text-gray-600 dark:text-gray-400">Interactive API explorer and documentation</p>
      </div>
      <div class="flex items-center space-x-2">
        <USelect
          v-model="selectedVersion"
          :options="apiVersions"
          class="w-32"
        />
        <UButton variant="outline" @click="exportOpenAPI">
          Export OpenAPI
        </UButton>
      </div>
    </div>

    <!-- API Overview -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-1">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">API Overview</h3>
          </template>

          <!-- Base URL -->
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Base URL</label>
              <div class="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                <code class="text-sm text-gray-800 dark:text-gray-200">{{ baseUrl }}</code>
              </div>
            </div>

            <!-- Authentication -->
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Authentication</label>
              <USelect
                v-model="authType"
                :options="authTypes"
                class="mt-1"
              />
            </div>

            <!-- API Key Input -->
            <div v-if="authType === 'bearer'">
              <UFormGroup label="API Key" name="apiKey">
                <UInput
                  v-model="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                />
              </UFormGroup>
            </div>

            <!-- Environment -->
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Environment</label>
              <USelect
                v-model="environment"
                :options="environments"
                class="mt-1"
              />
            </div>
          </div>

          <!-- Endpoint Categories -->
          <div class="mt-6">
            <h4 class="font-medium text-gray-900 dark:text-white mb-3">Endpoints</h4>
            <nav class="space-y-1">
              <button
                v-for="category in endpointCategories"
                :key="category.name"
                :class="[
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  selectedCategory === category.name
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                ]"
                @click="selectedCategory = category.name"
              >
                <div class="flex items-center justify-between">
                  <span>{{ category.name }}</span>
                  <UBadge color="gray" variant="subtle" size="xs">{{ category.count }}</UBadge>
                </div>
              </button>
            </nav>
          </div>
        </UCard>
      </div>

      <!-- Endpoints List -->
      <div class="lg:col-span-3">
        <UCard>
          <div class="space-y-4">
            <div
              v-for="endpoint in filteredEndpoints"
              :key="`${endpoint.method}-${endpoint.path}`"
              :class="[
                'border rounded-lg transition-colors cursor-pointer',
                selectedEndpoint?.path === endpoint.path && selectedEndpoint?.method === endpoint.method
                  ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              ]"
              @click="selectEndpoint(endpoint)"
            >
              <div class="p-4">
                <div class="flex items-start justify-between">
                  <div class="flex items-center space-x-3">
                    <UBadge
                      :color="getMethodColor(endpoint.method)"
                      variant="solid"
                      size="sm"
                      class="font-mono"
                    >
                      {{ endpoint.method }}
                    </UBadge>
                    <div>
                      <h4 class="font-medium text-gray-900 dark:text-white">{{ endpoint.summary }}</h4>
                      <code class="text-sm text-gray-600 dark:text-gray-400">{{ endpoint.path }}</code>
                    </div>
                  </div>
                  <UIcon
                    :name="selectedEndpoint?.path === endpoint.path ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                    class="w-4 h-4 text-gray-400"
                  />
                </div>
                
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">{{ endpoint.description }}</p>
              </div>

              <!-- Expanded Details -->
              <div
                v-if="selectedEndpoint?.path === endpoint.path && selectedEndpoint?.method === endpoint.method"
                class="border-t border-gray-200 dark:border-gray-700"
              >
                <EndpointDetails
                  :endpoint="endpoint"
                  :auth-type="authType"
                  :api-key="apiKey"
                  :base-url="baseUrl"
                  @try-endpoint="tryEndpoint"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Request/Response Panel -->
    <div v-if="showTryIt" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Request -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Request</h3>
            <div class="flex items-center space-x-2">
              <UButton
                size="sm"
                @click="sendRequest"
                :loading="requestLoading"
                :disabled="!canSendRequest"
              >
                <UIcon name="i-heroicons-play" class="w-4 h-4 mr-1" />
                Send Request
              </UButton>
              <UButton variant="outline" size="sm" @click="generateCode">
                <UIcon name="i-heroicons-code-bracket" class="w-4 h-4 mr-1" />
                Generate Code
              </UButton>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <!-- URL -->
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Request URL</label>
            <div class="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
              <code class="text-sm text-gray-800 dark:text-gray-200">{{ requestUrl }}</code>
            </div>
          </div>

          <!-- Headers -->
          <div v-if="requestHeaders.length > 0">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Headers</label>
            <div class="mt-1 space-y-2">
              <div
                v-for="(header, index) in requestHeaders"
                :key="index"
                class="flex items-center space-x-2"
              >
                <UInput
                  v-model="header.key"
                  placeholder="Header name"
                  class="flex-1"
                  size="sm"
                />
                <UInput
                  v-model="header.value"
                  placeholder="Header value"
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  variant="ghost"
                  size="sm"
                  square
                  @click="removeHeader(index)"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                </UButton>
              </div>
              <UButton variant="outline" size="sm" @click="addHeader">
                <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                Add Header
              </UButton>
            </div>
          </div>

          <!-- Body -->
          <div v-if="selectedEndpoint && ['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method)">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Request Body</label>
            <div class="mt-1">
              <UTabs :items="bodyTabs" class="w-full">
                <template #item="{ item }">
                  <div v-if="item.key === 'json'" class="space-y-2">
                    <UTextarea
                      v-model="requestBody.json"
                      placeholder="Enter JSON..."
                      :rows="8"
                      class="font-mono text-sm"
                    />
                    <div class="flex justify-end">
                      <UButton variant="outline" size="xs" @click="formatJson">
                        Format JSON
                      </UButton>
                    </div>
                  </div>
                  <div v-else-if="item.key === 'form'" class="space-y-2">
                    <div
                      v-for="(field, index) in requestBody.form"
                      :key="index"
                      class="flex items-center space-x-2"
                    >
                      <UInput
                        v-model="field.key"
                        placeholder="Field name"
                        class="flex-1"
                        size="sm"
                      />
                      <UInput
                        v-model="field.value"
                        placeholder="Field value"
                        class="flex-1"
                        size="sm"
                      />
                      <UButton
                        variant="ghost"
                        size="sm"
                        square
                        @click="removeFormField(index)"
                      >
                        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                      </UButton>
                    </div>
                    <UButton variant="outline" size="sm" @click="addFormField">
                      <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                      Add Field
                    </UButton>
                  </div>
                </template>
              </UTabs>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Response -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Response</h3>
            <div v-if="response" class="flex items-center space-x-2">
              <UBadge
                :color="response.status >= 200 && response.status < 300 ? 'green' : 'red'"
                variant="solid"
              >
                {{ response.status }} {{ response.statusText }}
              </UBadge>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ response.time }}ms
              </span>
            </div>
          </div>
        </template>

        <div v-if="!response" class="text-center py-12">
          <UIcon name="i-heroicons-play-circle" class="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-500 dark:text-gray-400">Send a request to see the response</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Response Headers -->
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Response Headers</label>
            <div class="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded-md max-h-32 overflow-y-auto">
              <pre class="text-xs text-gray-800 dark:text-gray-200">{{ formatHeaders(response.headers) }}</pre>
            </div>
          </div>

          <!-- Response Body -->
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Response Body</label>
            <div class="mt-1">
              <UTabs :items="responseTabs" class="w-full">
                <template #item="{ item }">
                  <div v-if="item.key === 'pretty'" class="p-3 bg-gray-100 dark:bg-gray-800 rounded-md max-h-96 overflow-auto">
                    <pre class="text-sm text-gray-800 dark:text-gray-200">{{ formatResponseBody() }}</pre>
                  </div>
                  <div v-else-if="item.key === 'raw'" class="p-3 bg-gray-100 dark:bg-gray-800 rounded-md max-h-96 overflow-auto">
                    <pre class="text-sm text-gray-800 dark:text-gray-200">{{ response.data }}</pre>
                  </div>
                  <div v-else-if="item.key === 'preview'" class="p-3">
                    <ResponsePreview :response="response" />
                  </div>
                </template>
              </UTabs>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Code Generation Modal -->
    <UModal v-model="showCodeModal" :ui="{ width: 'max-w-4xl' }">
      <CodeGenerationModal
        v-if="selectedEndpoint"
        :endpoint="selectedEndpoint"
        :request-data="getRequestData()"
        @close="showCodeModal = false"
      />
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '~/types'
import EndpointDetails from './EndpointDetails.vue'
import ResponsePreview from './ResponsePreview.vue'
import CodeGenerationModal from './CodeGenerationModal.vue'

const { $fetch } = useNuxtApp()

const selectedVersion = ref('v1')
const authType = ref('bearer')
const apiKey = ref('')
const environment = ref('production')
const selectedCategory = ref('Templates')
const selectedEndpoint = ref<ApiEndpoint | null>(null)
const showTryIt = ref(false)
const requestLoading = ref(false)
const showCodeModal = ref(false)

const requestHeaders = ref([
  { key: 'Content-Type', value: 'application/json' }
])

const requestBody = ref({
  json: '{}',
  form: [{ key: '', value: '' }]
})

const response = ref<any>(null)

const apiVersions = [
  { label: 'v1', value: 'v1' },
  { label: 'v2 (Beta)', value: 'v2' }
]

const authTypes = [
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'API Key', value: 'apikey' },
  { label: 'None', value: 'none' }
]

const environments = [
  { label: 'Production', value: 'production' },
  { label: 'Staging', value: 'staging' },
  { label: 'Development', value: 'development' }
]

const bodyTabs = [
  { key: 'json', label: 'JSON' },
  { key: 'form', label: 'Form Data' }
]

const responseTabs = [
  { key: 'pretty', label: 'Pretty' },
  { key: 'raw', label: 'Raw' },
  { key: 'preview', label: 'Preview' }
]

const baseUrl = computed(() => {
  const urls = {
    production: 'https://api.unjucks.com',
    staging: 'https://api-staging.unjucks.com',
    development: 'http://localhost:3001'
  }
  return urls[environment.value as keyof typeof urls]
})

const endpointCategories = ref([
  { name: 'Templates', count: 12 },
  { name: 'Code Generation', count: 8 },
  { name: 'Users', count: 6 },
  { name: 'Organizations', count: 4 },
  { name: 'Authentication', count: 3 }
])

const endpoints = ref<ApiEndpoint[]>([
  {
    path: '/api/templates',
    method: 'GET',
    summary: 'List Templates',
    description: 'Retrieve a list of available templates',
    parameters: [
      {
        name: 'category',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Filter by template category',
        example: 'frontend'
      },
      {
        name: 'limit',
        in: 'query',
        type: 'number',
        required: false,
        description: 'Maximum number of templates to return',
        example: 10
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Successful response',
        schema: {},
        example: {
          templates: [
            {
              id: '1',
              name: 'React Component',
              category: 'frontend',
              description: 'A modern React component template'
            }
          ]
        }
      }
    ],
    examples: []
  },
  {
    path: '/api/templates',
    method: 'POST',
    summary: 'Create Template',
    description: 'Create a new code template',
    parameters: [
      {
        name: 'template',
        in: 'body',
        type: 'object',
        required: true,
        description: 'Template data',
        example: {
          name: 'My Template',
          category: 'frontend',
          description: 'A custom template',
          files: []
        }
      }
    ],
    responses: [
      {
        status: 201,
        description: 'Template created successfully',
        schema: {},
        example: {
          id: '123',
          name: 'My Template',
          category: 'frontend'
        }
      }
    ],
    examples: []
  },
  {
    path: '/api/generate',
    method: 'POST',
    summary: 'Generate Code',
    description: 'Generate code from a template',
    parameters: [
      {
        name: 'generation',
        in: 'body',
        type: 'object',
        required: true,
        description: 'Code generation request',
        example: {
          templateId: '123',
          variables: {
            componentName: 'MyComponent',
            withTests: true
          }
        }
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Code generated successfully',
        schema: {},
        example: {
          files: [
            {
              path: 'MyComponent.tsx',
              content: 'import React from "react"...'
            }
          ]
        }
      }
    ],
    examples: []
  }
])

const filteredEndpoints = computed(() => {
  return endpoints.value.filter(endpoint => {
    const categoryMap: Record<string, string[]> = {
      'Templates': ['/api/templates'],
      'Code Generation': ['/api/generate'],
      'Users': ['/api/users'],
      'Organizations': ['/api/organizations'],
      'Authentication': ['/api/auth']
    }
    
    const categoryPaths = categoryMap[selectedCategory.value] || []
    return categoryPaths.some(path => endpoint.path.startsWith(path))
  })
})

const requestUrl = computed(() => {
  if (!selectedEndpoint.value) return ''
  
  let url = `${baseUrl.value}${selectedEndpoint.value.path}`
  
  // Add query parameters
  const queryParams = selectedEndpoint.value.parameters
    .filter(p => p.in === 'query' && p.example)
    .map(p => `${p.name}=${encodeURIComponent(p.example)}`)
  
  if (queryParams.length > 0) {
    url += '?' + queryParams.join('&')
  }
  
  return url
})

const canSendRequest = computed(() => {
  return selectedEndpoint.value && baseUrl.value && 
    (authType.value === 'none' || apiKey.value)
})

const selectEndpoint = (endpoint: ApiEndpoint) => {
  if (selectedEndpoint.value?.path === endpoint.path && 
      selectedEndpoint.value?.method === endpoint.method) {
    selectedEndpoint.value = null
    showTryIt.value = false
  } else {
    selectedEndpoint.value = endpoint
    showTryIt.value = false
    response.value = null
  }
}

const tryEndpoint = (endpoint: ApiEndpoint) => {
  selectedEndpoint.value = endpoint
  showTryIt.value = true
  response.value = null
}

const addHeader = () => {
  requestHeaders.value.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  requestHeaders.value.splice(index, 1)
}

const addFormField = () => {
  requestBody.value.form.push({ key: '', value: '' })
}

const removeFormField = (index: number) => {
  requestBody.value.form.splice(index, 1)
}

const formatJson = () => {
  try {
    const parsed = JSON.parse(requestBody.value.json)
    requestBody.value.json = JSON.stringify(parsed, null, 2)
  } catch (error) {
    useToast().add({
      title: 'Invalid JSON',
      description: 'Please check your JSON syntax',
      color: 'red'
    })
  }
}

const sendRequest = async () => {
  if (!selectedEndpoint.value || !canSendRequest.value) return
  
  requestLoading.value = true
  const startTime = Date.now()
  
  try {
    const headers: Record<string, string> = {}
    
    // Add auth header
    if (authType.value === 'bearer' && apiKey.value) {
      headers['Authorization'] = `Bearer ${apiKey.value}`
    }
    
    // Add custom headers
    requestHeaders.value.forEach(header => {
      if (header.key && header.value) {
        headers[header.key] = header.value
      }
    })
    
    // Prepare body
    let body: any = undefined
    if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.value.method)) {
      if (headers['Content-Type'] === 'application/json') {
        body = JSON.parse(requestBody.value.json)
      } else {
        body = Object.fromEntries(
          requestBody.value.form
            .filter(field => field.key && field.value)
            .map(field => [field.key, field.value])
        )
      }
    }
    
    const result = await $fetch(requestUrl.value, {
      method: selectedEndpoint.value.method as any,
      headers,
      body
    })
    
    response.value = {
      status: 200,
      statusText: 'OK',
      time: Date.now() - startTime,
      headers: {},
      data: result
    }
  } catch (error: any) {
    response.value = {
      status: error.status || 500,
      statusText: error.statusText || 'Error',
      time: Date.now() - startTime,
      headers: error.headers || {},
      data: error.data || error.message
    }
  } finally {
    requestLoading.value = false
  }
}

const generateCode = () => {
  showCodeModal.value = true
}

const getRequestData = () => {
  return {
    url: requestUrl.value,
    method: selectedEndpoint.value?.method || 'GET',
    headers: Object.fromEntries(
      requestHeaders.value
        .filter(h => h.key && h.value)
        .map(h => [h.key, h.value])
    ),
    body: selectedEndpoint.value && ['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.value.method) 
      ? requestBody.value.json 
      : undefined
  }
}

const getMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    'GET': 'green',
    'POST': 'blue',
    'PUT': 'orange',
    'PATCH': 'yellow',
    'DELETE': 'red'
  }
  return colors[method] || 'gray'
}

const formatHeaders = (headers: Record<string, string>): string => {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

const formatResponseBody = (): string => {
  try {
    return JSON.stringify(response.value.data, null, 2)
  } catch (error) {
    return response.value.data?.toString() || ''
  }
}

const exportOpenAPI = async () => {
  try {
    const openApiSpec = await $fetch('/api/docs/openapi')
    const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { 
      type: 'application/json' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openapi-spec.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    useToast().add({
      title: 'Export failed',
      description: 'Failed to export OpenAPI specification',
      color: 'red'
    })
  }
}

// Load API documentation
onMounted(async () => {
  try {
    const docs = await $fetch('/api/docs')
    if (docs) {
      endpoints.value = docs.endpoints
      endpointCategories.value = docs.categories
    }
  } catch (error) {
    console.error('Failed to load API documentation:', error)
  }
})
</script>