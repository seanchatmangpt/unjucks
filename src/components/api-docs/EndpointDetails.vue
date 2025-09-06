<template>
  <div class="p-4 space-y-6">
    <!-- Parameters -->
    <div v-if="endpoint.parameters.length > 0">
      <h4 class="font-medium text-gray-900 dark:text-white mb-3">Parameters</h4>
      <div class="space-y-3">
        <div
          v-for="param in endpoint.parameters"
          :key="param.name"
          class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center space-x-2">
              <code class="text-sm font-mono text-primary-600 dark:text-primary-400">
                {{ param.name }}
              </code>
              <UBadge
                :color="param.in === 'path' ? 'blue' : param.in === 'query' ? 'green' : 'gray'"
                variant="outline"
                size="xs"
              >
                {{ param.in }}
              </UBadge>
              <UBadge v-if="param.required" color="red" variant="subtle" size="xs">
                Required
              </UBadge>
            </div>
            <UBadge color="gray" variant="outline" size="xs">
              {{ param.type }}
            </UBadge>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {{ param.description }}
          </p>
          <div v-if="param.example" class="text-xs">
            <span class="text-gray-500 dark:text-gray-500">Example:</span>
            <code class="ml-2 text-gray-700 dark:text-gray-300">{{ param.example }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Request Body Schema -->
    <div v-if="hasRequestBody">
      <h4 class="font-medium text-gray-900 dark:text-white mb-3">Request Body</h4>
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <UBadge color="blue" variant="subtle" size="sm">application/json</UBadge>
            <UBadge color="gray" variant="outline" size="xs">Required</UBadge>
          </div>
          <pre class="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">{{ getRequestBodyExample() }}</pre>
        </div>
      </div>
    </div>

    <!-- Responses -->
    <div>
      <h4 class="font-medium text-gray-900 dark:text-white mb-3">Responses</h4>
      <div class="space-y-3">
        <div
          v-for="response in endpoint.responses"
          :key="response.status"
          class="border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center space-x-2">
              <UBadge
                :color="response.status >= 200 && response.status < 300 ? 'green' : 'red'"
                variant="solid"
              >
                {{ response.status }}
              </UBadge>
              <span class="font-medium text-gray-900 dark:text-white">
                {{ response.description }}
              </span>
            </div>
            <UButton
              variant="ghost"
              size="xs"
              @click="toggleResponseExample(response.status)"
            >
              <UIcon
                :name="expandedResponses.includes(response.status) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-4 h-4"
              />
            </UButton>
          </div>
          
          <div
            v-if="expandedResponses.includes(response.status)"
            class="p-3 bg-gray-50 dark:bg-gray-800"
          >
            <h5 class="font-medium text-gray-900 dark:text-white mb-2">Example Response</h5>
            <pre class="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">{{ formatJson(response.example) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Code Examples -->
    <div v-if="endpoint.examples.length > 0">
      <h4 class="font-medium text-gray-900 dark:text-white mb-3">Code Examples</h4>
      <UTabs :items="codeExampleTabs" class="w-full">
        <template #item="{ item }">
          <div class="p-3 bg-gray-900 rounded-lg">
            <pre class="text-sm text-gray-100 overflow-x-auto"><code>{{ generateCodeExample(item.key) }}</code></pre>
          </div>
        </template>
      </UTabs>
    </div>

    <!-- Try It Button -->
    <div class="flex justify-end">
      <UButton @click="$emit('try-endpoint', endpoint)">
        <UIcon name="i-heroicons-play" class="w-4 h-4 mr-1" />
        Try It Out
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '~/types'

interface Props {
  endpoint: ApiEndpoint
  authType: string
  apiKey: string
  baseUrl: string
}

const props = defineProps<Props>()

defineEmits<{
  'try-endpoint': [endpoint: ApiEndpoint]
}>()

const expandedResponses = ref<number[]>([])

const codeExampleTabs = [
  { key: 'javascript', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
  { key: 'curl', label: 'cURL' },
  { key: 'php', label: 'PHP' }
]

const hasRequestBody = computed(() => {
  return ['POST', 'PUT', 'PATCH'].includes(props.endpoint.method)
})

const getRequestBodyExample = (): string => {
  const bodyParam = props.endpoint.parameters.find(p => p.in === 'body')
  if (bodyParam?.example) {
    return JSON.stringify(bodyParam.example, null, 2)
  }
  return '{}'
}

const toggleResponseExample = (status: number) => {
  const index = expandedResponses.value.indexOf(status)
  if (index > -1) {
    expandedResponses.value.splice(index, 1)
  } else {
    expandedResponses.value.push(status)
  }
}

const formatJson = (data: any): string => {
  try {
    return JSON.stringify(data, null, 2)
  } catch (error) {
    return String(data)
  }
}

const generateCodeExample = (language: string): string => {
  const { endpoint, authType, apiKey, baseUrl } = props
  const url = `${baseUrl}${endpoint.path}`
  
  const authHeader = authType === 'bearer' && apiKey 
    ? `Bearer ${apiKey}` 
    : ''

  switch (language) {
    case 'javascript':
      return `fetch('${url}', {
  method: '${endpoint.method}',
  headers: {
    'Content-Type': 'application/json',${authHeader ? `\n    'Authorization': '${authHeader}',` : ''}
  },${hasRequestBody.value ? `\n  body: JSON.stringify(${getRequestBodyExample()})` : ''}
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`

    case 'python':
      return `import requests

url = '${url}'
headers = {
    'Content-Type': 'application/json',${authHeader ? `\n    'Authorization': '${authHeader}',` : ''}
}
${hasRequestBody.value ? `data = ${getRequestBodyExample()}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=data)` : `response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)`}
print(response.json())`

    case 'curl':
      let curlCommand = `curl -X ${endpoint.method} '${url}' \\
  -H 'Content-Type: application/json'`
      
      if (authHeader) {
        curlCommand += ` \\\n  -H 'Authorization: ${authHeader}'`
      }
      
      if (hasRequestBody.value) {
        curlCommand += ` \\\n  -d '${getRequestBodyExample().replace(/\n\s*/g, ' ')}'`
      }
      
      return curlCommand

    case 'php':
      return `<?php
$url = '${url}';
$headers = [
    'Content-Type: application/json',${authHeader ? `\n    'Authorization: ${authHeader}',` : ''}
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${endpoint.method}');
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
${hasRequestBody.value ? `curl_setopt($ch, CURLOPT_POSTFIELDS, '${getRequestBodyExample().replace(/\n\s*/g, ' ')}');` : ''}

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`

    default:
      return 'Code example not available for this language.'
  }
}
</script>