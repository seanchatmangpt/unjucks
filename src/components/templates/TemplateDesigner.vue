<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Template Designer</h2>
        <p class="text-gray-600 dark:text-gray-400">Create and edit templates with our visual editor</p>
      </div>
      <div class="flex items-center space-x-2">
        <UButton
          variant="outline"
          @click="showPreview = !showPreview"
        >
          <UIcon :name="showPreview ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4 mr-1" />
          {{ showPreview ? 'Hide Preview' : 'Show Preview' }}
        </UButton>
        <UButton
          variant="outline"
          @click="saveTemplate"
          :loading="saving"
          :disabled="!canSave"
        >
          <UIcon name="i-heroicons-document-arrow-down" class="w-4 h-4 mr-1" />
          Save Template
        </UButton>
        <UButton
          @click="publishTemplate"
          :loading="publishing"
          :disabled="!template.name || !template.description"
        >
          <UIcon name="i-heroicons-rocket-launch" class="w-4 h-4 mr-1" />
          Publish
        </UButton>
      </div>
    </div>

    <!-- Template Settings -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Template Information</h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <UFormGroup label="Template Name" name="name" required>
            <UInput
              v-model="template.name"
              placeholder="React Component"
              :disabled="editing"
            />
          </UFormGroup>

          <UFormGroup label="Description" name="description" required>
            <UTextarea
              v-model="template.description"
              placeholder="A modern React component with TypeScript support..."
              :rows="3"
            />
          </UFormGroup>

          <UFormGroup label="Category" name="category" required>
            <USelect
              v-model="template.category"
              :options="categoryOptions"
              placeholder="Select category"
            />
          </UFormGroup>
        </div>

        <div class="space-y-4">
          <UFormGroup label="Language" name="language" required>
            <USelect
              v-model="template.language"
              :options="languageOptions"
              placeholder="Select language"
            />
          </UFormGroup>

          <UFormGroup label="Framework" name="framework">
            <USelect
              v-model="template.framework"
              :options="frameworkOptions"
              placeholder="Select framework (optional)"
            />
          </UFormGroup>

          <UFormGroup label="Tags" name="tags">
            <div class="space-y-2">
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="tag in template.tags"
                  :key="tag"
                  color="primary"
                  variant="outline"
                  size="sm"
                  class="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900"
                  @click="removeTag(tag)"
                >
                  {{ tag }}
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1" />
                </UBadge>
              </div>
              <div class="flex items-center space-x-2">
                <UInput
                  v-model="newTag"
                  placeholder="Add tag..."
                  size="sm"
                  @keydown.enter.prevent="addTag"
                />
                <UButton size="sm" @click="addTag" :disabled="!newTag.trim()">
                  Add
                </UButton>
              </div>
            </div>
          </UFormGroup>
        </div>
      </div>
    </UCard>

    <!-- Main Editor -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Variables Panel -->
      <div class="lg:col-span-3">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Variables</h3>
              <UButton
                size="sm"
                @click="addVariable"
              >
                <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                Add
              </UButton>
            </div>
          </template>

          <div class="space-y-4">
            <div
              v-for="(variable, index) in template.variables"
              :key="index"
              class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2"
            >
              <div class="flex items-center justify-between">
                <UInput
                  v-model="variable.name"
                  placeholder="Variable name"
                  size="sm"
                />
                <UButton
                  variant="ghost"
                  size="sm"
                  square
                  @click="removeVariable(index)"
                >
                  <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                </UButton>
              </div>

              <USelect
                v-model="variable.type"
                :options="variableTypes"
                size="sm"
                placeholder="Type"
              />

              <UInput
                v-model="variable.description"
                placeholder="Description"
                size="sm"
              />

              <div class="flex items-center space-x-2">
                <UCheckbox v-model="variable.required" size="sm">
                  Required
                </UCheckbox>
              </div>

              <UInput
                v-model="variable.default"
                placeholder="Default value"
                size="sm"
              />
            </div>

            <div v-if="template.variables.length === 0" class="text-center py-4 text-gray-500 dark:text-gray-400">
              No variables defined
            </div>
          </div>
        </UCard>
      </div>

      <!-- File Editor -->
      <div :class="showPreview ? 'lg:col-span-5' : 'lg:col-span-9'">
        <UCard class="h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Files</h3>
                <UButton
                  size="sm"
                  @click="addFile"
                >
                  <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                  Add File
                </UButton>
              </div>
              <div class="flex items-center space-x-2">
                <UCheckbox v-model="autoPreview" size="sm">
                  Auto Preview
                </UCheckbox>
              </div>
            </div>
          </template>

          <!-- File Tabs -->
          <div class="border-b border-gray-200 dark:border-gray-700">
            <div class="flex space-x-1 overflow-x-auto">
              <button
                v-for="(file, index) in template.files"
                :key="index"
                :class="[
                  'flex items-center space-x-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  selectedFileIndex === index
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                ]"
                @click="selectedFileIndex = index"
              >
                <UIcon :name="getFileIcon(file.path)" class="w-4 h-4" />
                <span>{{ file.path || `File ${index + 1}` }}</span>
                <UButton
                  variant="ghost"
                  size="xs"
                  square
                  @click.stop="removeFile(index)"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </UButton>
              </button>
            </div>
          </div>

          <!-- File Editor -->
          <div v-if="selectedFile" class="p-4 space-y-4">
            <!-- File Path -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormGroup label="File Path" name="path" required>
                <UInput
                  v-model="selectedFile.path"
                  placeholder="components/{{ componentName | pascalCase }}.tsx"
                />
              </UFormGroup>

              <UFormGroup label="File Type" name="type">
                <USelect
                  v-model="selectedFile.type"
                  :options="fileTypes"
                />
              </UFormGroup>
            </div>

            <!-- Code Editor -->
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Content
              </label>
              <div class="relative">
                <UTextarea
                  v-model="selectedFile.content"
                  :rows="20"
                  class="font-mono text-sm"
                  placeholder="Enter your template content here..."
                />
                
                <!-- Editor Toolbar -->
                <div class="absolute top-2 right-2 flex items-center space-x-1">
                  <UButton
                    variant="ghost"
                    size="xs"
                    @click="insertVariable"
                  >
                    <UIcon name="i-heroicons-code-bracket" class="w-3 h-3" />
                  </UButton>
                  <UButton
                    variant="ghost"
                    size="xs"
                    @click="formatContent"
                  >
                    <UIcon name="i-heroicons-sparkles" class="w-3 h-3" />
                  </UButton>
                  <UDropdown :items="snippetActions">
                    <UButton variant="ghost" size="xs">
                      <UIcon name="i-heroicons-bookmark" class="w-3 h-3" />
                    </UButton>
                  </UDropdown>
                </div>
              </div>
            </div>

            <!-- Syntax Highlighting and Validation -->
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-2">
                  <UIcon
                    :name="syntaxValid ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
                    :class="syntaxValid ? 'text-green-500' : 'text-red-500'"
                    class="w-4 h-4"
                  />
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {{ syntaxValid ? 'Valid syntax' : 'Syntax errors detected' }}
                  </span>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <UButton
                  variant="outline"
                  size="sm"
                  @click="validateTemplate"
                >
                  Validate
                </UButton>
                <UButton
                  variant="outline"
                  size="sm"
                  @click="testTemplate"
                >
                  Test
                </UButton>
              </div>
            </div>
          </div>

          <div v-else class="p-8 text-center text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-document-plus" class="w-12 h-12 mx-auto mb-2" />
            <p>No files in template</p>
            <UButton class="mt-2" @click="addFile">
              Add Your First File
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Preview Panel -->
      <div v-if="showPreview" class="lg:col-span-4">
        <UCard class="h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
              <div class="flex items-center space-x-2">
                <UButton
                  variant="outline"
                  size="sm"
                  @click="updatePreview"
                  :loading="generatingPreview"
                >
                  <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
                  Refresh
                </UButton>
              </div>
            </div>
          </template>

          <!-- Preview Variables -->
          <div class="p-4 space-y-4">
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">Test Variables</h4>
              <div class="space-y-2">
                <div
                  v-for="variable in template.variables"
                  :key="variable.name"
                  class="flex items-center space-x-2"
                >
                  <label class="text-sm w-24 text-gray-600 dark:text-gray-400">
                    {{ variable.name }}:
                  </label>
                  <UInput
                    v-model="previewVariables[variable.name]"
                    :placeholder="variable.default || `Enter ${variable.name}...`"
                    size="sm"
                    class="flex-1"
                    @input="debouncedPreviewUpdate"
                  />
                </div>
              </div>
            </div>

            <!-- Generated Preview -->
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white mb-2">Generated Output</h4>
              <div class="space-y-2">
                <div
                  v-for="(preview, index) in generatedPreview"
                  :key="index"
                  class="border border-gray-200 dark:border-gray-700 rounded"
                >
                  <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center space-x-2">
                      <UIcon :name="getFileIcon(preview.path)" class="w-4 h-4" />
                      <code class="text-sm">{{ preview.path }}</code>
                    </div>
                  </div>
                  <div class="p-3 max-h-40 overflow-y-auto">
                    <pre class="text-xs text-gray-700 dark:text-gray-300"><code>{{ preview.content }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Variable Insertion Modal -->
    <UModal v-model="showVariableModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Insert Variable</h3>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div
              v-for="variable in template.variables"
              :key="variable.name"
              class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              @click="insertVariableAtCursor(variable.name)"
            >
              <div class="font-medium text-gray-900 dark:text-white">{{ variable.name }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">{{ variable.type }}</div>
              <div class="text-xs text-gray-400 mt-1">{{ variable.description }}</div>
            </div>
          </div>

          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">Filters</h4>
            <div class="grid grid-cols-2 gap-2">
              <UButton
                v-for="filter in commonFilters"
                :key="filter"
                variant="outline"
                size="xs"
                @click="insertFilter(filter)"
              >
                | {{ filter }}
              </UButton>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton @click="showVariableModal = false">
              Close
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Test Results Modal -->
    <UModal v-model="showTestModal" :ui="{ width: 'max-w-4xl' }">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Template Test Results</h3>
        </template>

        <div class="space-y-4">
          <div v-if="testResults.success" class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div class="flex items-center space-x-2">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-600 dark:text-green-400" />
              <span class="font-medium text-green-900 dark:text-green-400">Template validation passed</span>
            </div>
            <p class="text-sm text-green-700 dark:text-green-300 mt-1">
              Generated {{ testResults.files?.length || 0 }} files successfully
            </p>
          </div>

          <div v-else class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div class="flex items-center space-x-2">
              <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 text-red-600 dark:text-red-400" />
              <span class="font-medium text-red-900 dark:text-red-400">Template validation failed</span>
            </div>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">
              {{ testResults.error }}
            </p>
          </div>

          <div v-if="testResults.files">
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">Generated Files</h4>
            <div class="space-y-2">
              <div
                v-for="file in testResults.files"
                :key="file.path"
                class="border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <code class="text-sm">{{ file.path }}</code>
                </div>
                <div class="p-3 max-h-60 overflow-y-auto">
                  <pre class="text-sm text-gray-700 dark:text-gray-300"><code>{{ file.content }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton @click="showTestModal = false">
              Close
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Template, TemplateFile, TemplateVariable } from '~/types'

const { $fetch } = useNuxtApp()
const route = useRoute()

const editing = computed(() => !!route.params.id)
const saving = ref(false)
const publishing = ref(false)
const generatingPreview = ref(false)
const showPreview = ref(true)
const autoPreview = ref(true)
const showVariableModal = ref(false)
const showTestModal = ref(false)
const syntaxValid = ref(true)

const selectedFileIndex = ref(0)
const newTag = ref('')

const template = reactive<Partial<Template>>({
  name: '',
  description: '',
  category: '',
  language: '',
  framework: '',
  tags: [],
  files: [],
  variables: [],
  isPublic: false
})

const previewVariables = ref<Record<string, string>>({})
const generatedPreview = ref<Array<{ path: string; content: string }>>([])

const testResults = ref<{
  success: boolean
  error?: string
  files?: Array<{ path: string; content: string }>
}>({ success: false })

const categoryOptions = [
  'Frontend',
  'Backend',
  'Full Stack',
  'Mobile',
  'Desktop',
  'CLI',
  'Documentation',
  'Testing',
  'DevOps'
]

const languageOptions = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C#',
  'PHP',
  'Ruby',
  'Kotlin',
  'Swift'
]

const frameworkOptions = computed(() => {
  const frameworks: Record<string, string[]> = {
    'TypeScript': ['React', 'Vue', 'Angular', 'Node.js', 'Next.js', 'Nuxt'],
    'JavaScript': ['React', 'Vue', 'Angular', 'Node.js', 'Express', 'Svelte'],
    'Python': ['Django', 'Flask', 'FastAPI', 'Streamlit'],
    'Go': ['Gin', 'Echo', 'Fiber'],
    'Rust': ['Actix', 'Warp', 'Rocket'],
    'Java': ['Spring Boot', 'Quarkus'],
    'C#': ['.NET', 'ASP.NET Core'],
    'PHP': ['Laravel', 'Symfony', 'CodeIgniter']
  }
  
  return frameworks[template.language] || []
})

const variableTypes = [
  'string',
  'number',
  'boolean',
  'array',
  'object'
]

const fileTypes = [
  'template',
  'config',
  'asset'
]

const commonFilters = [
  'camelCase',
  'pascalCase',
  'kebabCase',
  'snakeCase',
  'upper',
  'lower',
  'pluralize',
  'singularize'
]

const snippetActions = [
  [{
    label: 'React Component',
    click: () => insertSnippet('react-component')
  }, {
    label: 'Vue Component',
    click: () => insertSnippet('vue-component')
  }],
  [{
    label: 'API Route',
    click: () => insertSnippet('api-route')
  }, {
    label: 'Test File',
    click: () => insertSnippet('test-file')
  }]
]

const selectedFile = computed(() => {
  return template.files?.[selectedFileIndex.value] || null
})

const canSave = computed(() => {
  return template.name && template.description && template.files && template.files.length > 0
})

const addVariable = () => {
  if (!template.variables) template.variables = []
  template.variables.push({
    name: '',
    type: 'string',
    description: '',
    required: false,
    default: '',
    validation: ''
  })
}

const removeVariable = (index: number) => {
  template.variables?.splice(index, 1)
}

const addFile = () => {
  if (!template.files) template.files = []
  template.files.push({
    path: '',
    content: '',
    type: 'template'
  })
  selectedFileIndex.value = template.files.length - 1
}

const removeFile = (index: number) => {
  template.files?.splice(index, 1)
  if (selectedFileIndex.value >= (template.files?.length || 0)) {
    selectedFileIndex.value = Math.max(0, (template.files?.length || 0) - 1)
  }
}

const addTag = () => {
  if (newTag.value.trim() && !template.tags?.includes(newTag.value.trim())) {
    if (!template.tags) template.tags = []
    template.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (tag: string) => {
  const index = template.tags?.indexOf(tag)
  if (index !== undefined && index > -1) {
    template.tags?.splice(index, 1)
  }
}

const insertVariable = () => {
  showVariableModal.value = true
}

const insertVariableAtCursor = (variableName: string) => {
  const variable = `{{ ${variableName} }}`
  // Insert at cursor position in selected file content
  if (selectedFile.value) {
    selectedFile.value.content += variable
  }
  showVariableModal.value = false
  
  if (autoPreview.value) {
    debouncedPreviewUpdate()
  }
}

const insertFilter = (filter: string) => {
  const filterText = ` | ${filter}`
  if (selectedFile.value) {
    selectedFile.value.content += filterText
  }
  showVariableModal.value = false
}

const insertSnippet = (snippetType: string) => {
  const snippets: Record<string, string> = {
    'react-component': `import React from 'react';

interface {{ componentName | pascalCase }}Props {
  // Define props here
}

export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = (props) => {
  return (
    <div className="{{ componentName | kebabCase }}">
      <h1>{{ componentName | titleCase }}</h1>
    </div>
  );
};

export default {{ componentName | pascalCase }};`,

    'vue-component': `<template>
  <div class="{{ componentName | kebabCase }}">
    <h1>{{ '{{' }} title {{ '}}' }}</h1>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '{{ componentName | titleCase }}'
})
</script>

<style scoped>
.{{ componentName | kebabCase }} {
  /* Component styles */
}
</style>`,

    'api-route': `{% if language === 'TypeScript' %}
import { Request, Response } from 'express';

export const {{ routeName | camelCase }} = async (req: Request, res: Response) => {
  try {
    // Implementation here
    res.json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
{% endif %}`,

    'test-file': `{% if language === 'TypeScript' %}
import { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('should render correctly', () => {
    // Test implementation
  });
});
{% endif %}`
  }

  if (selectedFile.value && snippets[snippetType]) {
    selectedFile.value.content = snippets[snippetType]
    
    if (autoPreview.value) {
      debouncedPreviewUpdate()
    }
  }
}

const formatContent = () => {
  if (selectedFile.value) {
    // Basic formatting - in real app would use proper formatter
    selectedFile.value.content = selectedFile.value.content
      .replace(/\s+$/gm, '') // Remove trailing whitespace
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
  }
}

const validateTemplate = async () => {
  try {
    const validation = await $fetch('/api/templates/validate', {
      method: 'POST',
      body: template
    })
    
    syntaxValid.value = validation.valid
    
    if (validation.valid) {
      useToast().add({
        title: 'Template valid',
        description: 'Template syntax and structure are correct',
        color: 'green'
      })
    } else {
      useToast().add({
        title: 'Validation failed',
        description: validation.errors.join(', '),
        color: 'red'
      })
    }
  } catch (error) {
    syntaxValid.value = false
    useToast().add({
      title: 'Validation error',
      description: 'Failed to validate template',
      color: 'red'
    })
  }
}

const testTemplate = async () => {
  try {
    const result = await $fetch('/api/templates/test', {
      method: 'POST',
      body: {
        template,
        variables: previewVariables.value
      }
    })
    
    testResults.value = result
    showTestModal.value = true
  } catch (error: any) {
    testResults.value = {
      success: false,
      error: error.data?.message || 'Test failed'
    }
    showTestModal.value = true
  }
}

const updatePreview = async () => {
  if (!template.files?.length) {
    generatedPreview.value = []
    return
  }
  
  generatingPreview.value = true
  try {
    const result = await $fetch('/api/templates/preview', {
      method: 'POST',
      body: {
        template,
        variables: previewVariables.value
      }
    })
    
    generatedPreview.value = result.files || []
  } catch (error) {
    console.error('Preview generation failed:', error)
    generatedPreview.value = []
  } finally {
    generatingPreview.value = false
  }
}

const saveTemplate = async () => {
  saving.value = true
  try {
    const method = editing.value ? 'PUT' : 'POST'
    const url = editing.value ? `/api/templates/${route.params.id}` : '/api/templates'
    
    const result = await $fetch(url, {
      method,
      body: template
    })
    
    useToast().add({
      title: 'Template saved',
      description: 'Template has been saved successfully',
      color: 'green'
    })
    
    if (!editing.value) {
      await navigateTo(`/templates/designer/${result.id}`)
    }
  } catch (error) {
    useToast().add({
      title: 'Save failed',
      description: 'Failed to save template',
      color: 'red'
    })
  } finally {
    saving.value = false
  }
}

const publishTemplate = async () => {
  publishing.value = true
  try {
    await $fetch(`/api/templates/${route.params.id}/publish`, {
      method: 'POST'
    })
    
    useToast().add({
      title: 'Template published',
      description: 'Template is now available in the marketplace',
      color: 'green'
    })
    
    template.isPublic = true
  } catch (error) {
    useToast().add({
      title: 'Publish failed',
      description: 'Failed to publish template',
      color: 'red'
    })
  } finally {
    publishing.value = false
  }
}

const getFileIcon = (path: string): string => {
  if (!path) return 'i-heroicons-document'
  
  const extension = path.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    'ts': 'i-simple-icons-typescript',
    'tsx': 'i-simple-icons-react',
    'js': 'i-simple-icons-javascript',
    'jsx': 'i-simple-icons-react',
    'vue': 'i-simple-icons-vuedotjs',
    'py': 'i-simple-icons-python',
    'go': 'i-simple-icons-go',
    'rs': 'i-simple-icons-rust',
    'java': 'i-simple-icons-java',
    'php': 'i-simple-icons-php',
    'rb': 'i-simple-icons-ruby',
    'html': 'i-heroicons-code-bracket',
    'css': 'i-heroicons-paint-brush',
    'json': 'i-heroicons-code-bracket',
    'yml': 'i-heroicons-document-text',
    'yaml': 'i-heroicons-document-text',
    'md': 'i-heroicons-document-text'
  }
  
  return icons[extension || ''] || 'i-heroicons-document'
}

// Debounced preview update
const debouncedPreviewUpdate = debounce(() => {
  if (autoPreview.value) {
    updatePreview()
  }
}, 1000)

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }) as T
}

// Initialize preview variables when template variables change
watch(() => template.variables, (newVariables) => {
  if (newVariables) {
    newVariables.forEach(variable => {
      if (!(variable.name in previewVariables.value)) {
        previewVariables.value[variable.name] = variable.default || ''
      }
    })
  }
}, { deep: true })

// Load existing template if editing
onMounted(async () => {
  if (editing.value && route.params.id) {
    try {
      const existingTemplate = await $fetch(`/api/templates/${route.params.id}`)
      Object.assign(template, existingTemplate)
      
      // Initialize preview variables
      existingTemplate.variables.forEach((variable: TemplateVariable) => {
        previewVariables.value[variable.name] = variable.default || ''
      })
      
      updatePreview()
    } catch (error) {
      console.error('Failed to load template:', error)
      useToast().add({
        title: 'Load failed',
        description: 'Failed to load template for editing',
        color: 'red'
      })
    }
  } else {
    // Add initial file for new templates
    addFile()
  }
})

// Auto-update preview when variables change
watch(previewVariables, () => {
  if (autoPreview.value) {
    debouncedPreviewUpdate()
  }
}, { deep: true })
</script>