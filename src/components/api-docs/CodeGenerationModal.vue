<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-bold text-gray-900 dark:text-white">Generate Code</h3>
        <UButton
          variant="ghost"
          size="sm"
          square
          @click="$emit('close')"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Language Selection -->
      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Programming Language
        </label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            v-for="lang in languages"
            :key="lang.key"
            :class="[
              'p-3 rounded-lg border text-center transition-colors',
              selectedLanguage === lang.key
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
            ]"
            @click="selectedLanguage = lang.key"
          >
            <div class="text-lg mb-1">{{ lang.icon }}</div>
            <div class="text-sm font-medium">{{ lang.name }}</div>
          </button>
        </div>
      </div>

      <!-- Framework Selection (if applicable) -->
      <div v-if="frameworks.length > 0">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Framework/Library
        </label>
        <USelect
          v-model="selectedFramework"
          :options="frameworks"
          placeholder="Select framework (optional)"
        />
      </div>

      <!-- Code Style Options -->
      <div>
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Code Style
        </label>
        <div class="space-y-2">
          <UCheckbox v-model="options.includeComments">
            Include explanatory comments
          </UCheckbox>
          <UCheckbox v-model="options.includeErrorHandling">
            Include error handling
          </UCheckbox>
          <UCheckbox v-model="options.useAsyncAwait" v-if="supportsAsync">
            Use async/await syntax
          </UCheckbox>
          <UCheckbox v-model="options.includeTypes" v-if="supportsTypes">
            Include type annotations
          </UCheckbox>
        </div>
      </div>

      <!-- Generated Code -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Generated Code
          </label>
          <div class="flex items-center space-x-2">
            <UButton
              variant="outline"
              size="sm"
              @click="generateCode"
              :loading="generating"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
              Regenerate
            </UButton>
            <UButton
              variant="outline"
              size="sm"
              @click="copyCode"
            >
              <UIcon name="i-heroicons-clipboard" class="w-4 h-4 mr-1" />
              Copy
            </UButton>
          </div>
        </div>
        
        <div class="relative">
          <pre class="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm max-h-96"><code>{{ generatedCode }}</code></pre>
          
          <!-- Loading overlay -->
          <div
            v-if="generating"
            class="absolute inset-0 bg-gray-900/75 flex items-center justify-center rounded-lg"
          >
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      </div>

      <!-- Download Options -->
      <div class="flex items-center space-x-2">
        <UButton
          variant="outline"
          size="sm"
          @click="downloadCode"
          :disabled="!generatedCode"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
          Download
        </UButton>
        
        <UButton
          variant="outline"
          size="sm"
          @click="saveAsSnippet"
          :disabled="!generatedCode"
        >
          <UIcon name="i-heroicons-bookmark" class="w-4 h-4 mr-1" />
          Save as Snippet
        </UButton>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <UButton variant="outline" @click="$emit('close')">
          Close
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '~/types'

interface Props {
  endpoint: ApiEndpoint
  requestData: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

const selectedLanguage = ref('javascript')
const selectedFramework = ref('')
const generating = ref(false)
const generatedCode = ref('')

const options = ref({
  includeComments: true,
  includeErrorHandling: true,
  useAsyncAwait: true,
  includeTypes: false
})

const languages = [
  { key: 'javascript', name: 'JavaScript', icon: '🟨' },
  { key: 'typescript', name: 'TypeScript', icon: '🔷' },
  { key: 'python', name: 'Python', icon: '🐍' },
  { key: 'php', name: 'PHP', icon: '🐘' },
  { key: 'java', name: 'Java', icon: '☕' },
  { key: 'csharp', name: 'C#', icon: '🔷' },
  { key: 'ruby', name: 'Ruby', icon: '💎' },
  { key: 'go', name: 'Go', icon: '🐹' }
]

const frameworks = computed(() => {
  const frameworkMap: Record<string, Array<{ label: string; value: string }>> = {
    javascript: [
      { label: 'Vanilla JS', value: 'vanilla' },
      { label: 'jQuery', value: 'jquery' },
      { label: 'Axios', value: 'axios' },
      { label: 'Node.js (built-in)', value: 'nodejs' }
    ],
    typescript: [
      { label: 'Vanilla TS', value: 'vanilla' },
      { label: 'Axios', value: 'axios' },
      { label: 'Node.js', value: 'nodejs' }
    ],
    python: [
      { label: 'requests', value: 'requests' },
      { label: 'urllib', value: 'urllib' },
      { label: 'httpx', value: 'httpx' },
      { label: 'aiohttp', value: 'aiohttp' }
    ],
    php: [
      { label: 'cURL', value: 'curl' },
      { label: 'Guzzle', value: 'guzzle' },
      { label: 'file_get_contents', value: 'file_get_contents' }
    ]
  }
  
  return frameworkMap[selectedLanguage.value] || []
})

const supportsAsync = computed(() => {
  return ['javascript', 'typescript', 'python'].includes(selectedLanguage.value)
})

const supportsTypes = computed(() => {
  return ['typescript', 'java', 'csharp'].includes(selectedLanguage.value)
})

const generateCode = async () => {
  generating.value = true
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
    generatedCode.value = generateCodeForLanguage()
  } finally {
    generating.value = false
  }
}

const generateCodeForLanguage = (): string => {
  const { url, method, headers, body } = props.requestData
  
  switch (selectedLanguage.value) {
    case 'javascript':
      return generateJavaScriptCode()
    case 'typescript':
      return generateTypeScriptCode()
    case 'python':
      return generatePythonCode()
    case 'php':
      return generatePHPCode()
    case 'java':
      return generateJavaCode()
    case 'csharp':
      return generateCSharpCode()
    case 'ruby':
      return generateRubyCode()
    case 'go':
      return generateGoCode()
    default:
      return '// Code generation not implemented for this language'
  }
}

const generateJavaScriptCode = (): string => {
  const { url, method, headers, body } = props.requestData
  const { includeComments, includeErrorHandling, useAsyncAwait } = options.value
  
  let code = ''
  
  if (includeComments) {
    code += `// ${props.endpoint.summary}\n`
    code += `// ${props.endpoint.description}\n\n`
  }
  
  if (selectedFramework.value === 'axios') {
    code += `const axios = require('axios');\n\n`
    
    if (useAsyncAwait) {
      code += `async function ${method.toLowerCase()}${props.endpoint.path.split('/').pop() || 'Request'}() {\n`
      if (includeErrorHandling) code += `  try {\n`
      code += `    const response = await axios.${method.toLowerCase()}('${url}', `
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        code += `${body}, `
      }
      code += `{\n      headers: ${JSON.stringify(headers, null, 6)}\n    });\n`
      code += `    return response.data;\n`
      if (includeErrorHandling) {
        code += `  } catch (error) {\n`
        code += `    console.error('Request failed:', error.response?.data || error.message);\n`
        code += `    throw error;\n`
        code += `  }\n`
      }
      code += `}\n`
    }
  } else {
    // Fetch API
    if (useAsyncAwait) {
      code += `async function ${method.toLowerCase()}${props.endpoint.path.split('/').pop() || 'Request'}() {\n`
      if (includeErrorHandling) code += `  try {\n`
      code += `    const response = await fetch('${url}', {\n`
      code += `      method: '${method}',\n`
      code += `      headers: ${JSON.stringify(headers, null, 6)}`
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        code += `,\n      body: ${body}`
      }
      code += `\n    });\n\n`
      if (includeErrorHandling) {
        code += `    if (!response.ok) {\n`
        code += `      throw new Error(\`HTTP error! status: \${response.status}\`);\n`
        code += `    }\n\n`
      }
      code += `    return await response.json();\n`
      if (includeErrorHandling) {
        code += `  } catch (error) {\n`
        code += `    console.error('Request failed:', error);\n`
        code += `    throw error;\n`
        code += `  }\n`
      }
      code += `}\n`
    }
  }
  
  if (includeComments) {
    code += `\n// Usage example:\n`
    code += `// ${method.toLowerCase()}${props.endpoint.path.split('/').pop() || 'Request'}().then(data => console.log(data));`
  }
  
  return code
}

const generateTypeScriptCode = (): string => {
  let code = generateJavaScriptCode()
  
  if (options.value.includeTypes) {
    // Add type annotations
    code = code.replace(/function (\w+)\(\)/g, 'function $1(): Promise<any>')
    
    // Add response type interface
    const interfaceName = `${props.endpoint.path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'Api'}Response`
    code = `interface ${interfaceName} {\n  // Add your response type properties here\n  [key: string]: any;\n}\n\n` + code
    code = code.replace(/Promise<any>/g, `Promise<${interfaceName}>`)
  }
  
  return code
}

const generatePythonCode = (): string => {
  const { url, method, headers, body } = props.requestData
  const { includeComments, includeErrorHandling } = options.value
  
  let code = ''
  
  if (includeComments) {
    code += `"""${props.endpoint.summary}\n${props.endpoint.description}"""\n\n`
  }
  
  if (selectedFramework.value === 'requests' || !selectedFramework.value) {
    code += `import requests\n`
    if (includeErrorHandling) code += `from requests.exceptions import RequestException\n`
    code += `\ndef ${method.toLowerCase()}_${props.endpoint.path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_') || 'request'}():\n`
    
    if (includeErrorHandling) code += `    try:\n        `
    else code += `    `
    
    code += `response = requests.${method.toLowerCase()}(\n`
    code += `            '${url}',\n`
    code += `            headers=${JSON.stringify(headers, null, 12).replace(/"/g, "'")}`
    
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      code += `,\n            json=${body.replace(/"/g, "'")}`
    }
    
    code += `\n        )\n`
    
    if (includeErrorHandling) {
      code += `        response.raise_for_status()\n`
      code += `        return response.json()\n`
      code += `    except RequestException as e:\n`
      code += `        print(f"Request failed: {e}")\n`
      code += `        raise\n`
    } else {
      code += `    return response.json()\n`
    }
  }
  
  if (includeComments) {
    code += `\n# Usage example:\n`
    code += `# result = ${method.toLowerCase()}_${props.endpoint.path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_') || 'request'}()\n`
    code += `# print(result)`
  }
  
  return code
}

const generatePHPCode = (): string => {
  const { url, method, headers, body } = props.requestData
  const { includeComments, includeErrorHandling } = options.value
  
  let code = '<?php\n\n'
  
  if (includeComments) {
    code += `/**\n * ${props.endpoint.summary}\n * ${props.endpoint.description}\n */\n`
  }
  
  code += `function ${method.toLowerCase()}${props.endpoint.path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'Request'}() {\n`
  code += `    $url = '${url}';\n`
  code += `    $headers = [\n`
  
  Object.entries(headers).forEach(([key, value]) => {
    code += `        '${key}: ${value}',\n`
  })
  
  code += `    ];\n\n`
  code += `    $ch = curl_init();\n`
  code += `    curl_setopt($ch, CURLOPT_URL, $url);\n`
  code += `    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`
  code += `    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n`
  code += `    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`
  
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    code += `    curl_setopt($ch, CURLOPT_POSTFIELDS, '${body}');\n`
  }
  
  code += `\n    $response = curl_exec($ch);\n`
  
  if (includeErrorHandling) {
    code += `    \n    if (curl_errno($ch)) {\n`
    code += `        throw new Exception('cURL error: ' . curl_error($ch));\n`
    code += `    }\n`
    code += `    \n    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);\n`
    code += `    if ($httpCode >= 400) {\n`
    code += `        throw new Exception("HTTP error: $httpCode");\n`
    code += `    }\n`
  }
  
  code += `    \n    curl_close($ch);\n`
  code += `    return json_decode($response, true);\n`
  code += `}\n`
  
  if (includeComments) {
    code += `\n// Usage example:\n`
    code += `// $result = ${method.toLowerCase()}${props.endpoint.path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'Request'}();\n`
    code += `// print_r($result);\n`
  }
  
  code += `?>`
  
  return code
}

const generateJavaCode = (): string => {
  return `// Java code generation coming soon...`
}

const generateCSharpCode = (): string => {
  return `// C# code generation coming soon...`
}

const generateRubyCode = (): string => {
  return `# Ruby code generation coming soon...`
}

const generateGoCode = (): string => {
  return `// Go code generation coming soon...`
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    useToast().add({
      title: 'Code copied',
      description: 'Generated code has been copied to clipboard',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Copy failed',
      description: 'Failed to copy code to clipboard',
      color: 'red'
    })
  }
}

const downloadCode = () => {
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    php: 'php',
    java: 'java',
    csharp: 'cs',
    ruby: 'rb',
    go: 'go'
  }
  
  const extension = extensions[selectedLanguage.value] || 'txt'
  const filename = `${props.endpoint.path.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_') || 'api_request'}.${extension}`
  
  const blob = new Blob([generatedCode.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const saveAsSnippet = async () => {
  try {
    await $fetch('/api/snippets', {
      method: 'POST',
      body: {
        name: `${props.endpoint.summary} (${selectedLanguage.value})`,
        language: selectedLanguage.value,
        code: generatedCode.value,
        description: props.endpoint.description,
        tags: ['api', selectedLanguage.value, props.endpoint.method.toLowerCase()]
      }
    })
    
    useToast().add({
      title: 'Snippet saved',
      description: 'Code snippet has been saved to your library',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Save failed',
      description: 'Failed to save code snippet',
      color: 'red'
    })
  }
}

// Generate initial code
onMounted(() => {
  generateCode()
})

// Regenerate code when language or framework changes
watch([selectedLanguage, selectedFramework, options], () => {
  generateCode()
}, { deep: true })
</script>