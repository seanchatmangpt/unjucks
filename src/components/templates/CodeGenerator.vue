<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Code Generator</h2>
        <p class="text-gray-600 dark:text-gray-400">Generate production-ready code from templates</p>
      </div>
      <UButton variant="outline" to="/templates/marketplace">
        Browse Templates
      </UButton>
    </div>

    <!-- Template Selection -->
    <UCard v-if="!selectedTemplate">
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Select a Template</h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="template in recentTemplates"
          :key="template.id"
          class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
          @click="selectTemplate(template)"
        >
          <div class="flex items-center space-x-3 mb-2">
            <div :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center',
              getLanguageColor(template.language)
            ]">
              <UIcon :name="getLanguageIcon(template.language)" class="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white">{{ template.name }}</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ template.category }}</p>
            </div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {{ template.description }}
          </p>
        </div>
      </div>

      <div class="mt-6 text-center">
        <UButton to="/templates/marketplace" variant="outline">
          Browse All Templates
        </UButton>
      </div>
    </UCard>

    <!-- Code Generation Form -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Configuration Panel -->
      <div class="lg:col-span-1 space-y-6">
        <!-- Template Info -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Template</h3>
              <UButton
                variant="ghost"
                size="sm"
                @click="selectedTemplate = null"
              >
                Change
              </UButton>
            </div>
          </template>

          <div class="flex items-center space-x-3">
            <div :class="[
              'w-10 h-10 rounded-lg flex items-center justify-center',
              getLanguageColor(selectedTemplate.language)
            ]">
              <UIcon :name="getLanguageIcon(selectedTemplate.language)" class="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white">{{ selectedTemplate.name }}</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedTemplate.category }}</p>
            </div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {{ selectedTemplate.description }}
          </p>
        </UCard>

        <!-- Generation Settings -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Settings</h3>
          </template>

          <UForm :state="generationConfig" class="space-y-4">
            <UFormGroup label="Output Directory" name="outputDir">
              <UInput
                v-model="generationConfig.outputDir"
                placeholder="./src/components"
                icon="i-heroicons-folder"
              />
            </UFormGroup>

            <UFormGroup label="File Naming" name="fileNaming">
              <USelect
                v-model="generationConfig.fileNaming"
                :options="fileNamingOptions"
              />
            </UFormGroup>

            <div class="space-y-2">
              <UCheckbox v-model="generationConfig.overwriteFiles">
                Overwrite existing files
              </UCheckbox>
              <UCheckbox v-model="generationConfig.createDirectory">
                Create directory if it doesn't exist
              </UCheckbox>
              <UCheckbox v-model="generationConfig.generateTests">
                Generate test files
              </UCheckbox>
              <UCheckbox v-model="generationConfig.generateDocs">
                Generate documentation
              </UCheckbox>
            </div>
          </UForm>
        </UCard>

        <!-- Real-time Collaboration -->
        <UCard v-if="isConnected && presenceIndicators.length > 0">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Collaborators ({{ presenceIndicators.length }})
            </h3>
          </template>

          <div class="space-y-2">
            <div
              v-for="presence in presenceIndicators"
              :key="presence.userId"
              class="flex items-center space-x-3"
            >
              <UAvatar
                :src="presence.user.avatar"
                :alt="presence.user.name"
                size="sm"
              />
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ presence.user.name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ presence.isActive ? 'Active' : 'Idle' }}
                </p>
              </div>
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: presence.color }"
              />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Variable Configuration -->
      <div class="lg:col-span-2 space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Template Variables
              </h3>
              <div class="flex items-center space-x-2">
                <UButton
                  variant="outline"
                  size="sm"
                  @click="resetToDefaults"
                >
                  Reset to Defaults
                </UButton>
                <UButton
                  variant="outline"
                  size="sm"
                  @click="loadPreset"
                >
                  Load Preset
                </UButton>
              </div>
            </div>
          </template>

          <div v-if="selectedTemplate.variables.length > 0" class="space-y-4">
            <div
              v-for="variable in selectedTemplate.variables"
              :key="variable.name"
              class="space-y-2"
            >
              <!-- String Variables -->
              <UFormGroup
                v-if="variable.type === 'string'"
                :label="variable.name"
                :description="variable.description"
                :required="variable.required"
              >
                <UInput
                  v-model="templateVariables[variable.name]"
                  :placeholder="variable.default || `Enter ${variable.name}...`"
                  :disabled="generating"
                />
              </UFormGroup>

              <!-- Number Variables -->
              <UFormGroup
                v-else-if="variable.type === 'number'"
                :label="variable.name"
                :description="variable.description"
                :required="variable.required"
              >
                <UInput
                  v-model.number="templateVariables[variable.name]"
                  type="number"
                  :placeholder="variable.default?.toString() || '0'"
                  :disabled="generating"
                />
              </UFormGroup>

              <!-- Boolean Variables -->
              <UFormGroup
                v-else-if="variable.type === 'boolean'"
                :label="variable.name"
                :description="variable.description"
              >
                <UToggle
                  v-model="templateVariables[variable.name]"
                  :disabled="generating"
                />
              </UFormGroup>

              <!-- Array Variables -->
              <UFormGroup
                v-else-if="variable.type === 'array'"
                :label="variable.name"
                :description="variable.description"
                :required="variable.required"
              >
                <div class="space-y-2">
                  <div
                    v-for="(item, index) in templateVariables[variable.name] || []"
                    :key="index"
                    class="flex items-center space-x-2"
                  >
                    <UInput
                      v-model="templateVariables[variable.name][index]"
                      :placeholder="`${variable.name} item...`"
                      :disabled="generating"
                    />
                    <UButton
                      variant="ghost"
                      size="sm"
                      square
                      @click="removeArrayItem(variable.name, index)"
                      :disabled="generating"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                    </UButton>
                  </div>
                  <UButton
                    variant="outline"
                    size="sm"
                    @click="addArrayItem(variable.name)"
                    :disabled="generating"
                  >
                    <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                    Add {{ variable.name }}
                  </UButton>
                </div>
              </UFormGroup>
            </div>
          </div>

          <div v-else class="text-center py-8">
            <UIcon name="i-heroicons-variable" class="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p class="text-gray-500 dark:text-gray-400">
              This template doesn't require any variables
            </p>
          </div>
        </UCard>

        <!-- Preview -->
        <UCard v-if="previewEnabled">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
              <UButton
                variant="outline"
                size="sm"
                @click="updatePreview"
                :loading="updatingPreview"
              >
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
                Refresh
              </UButton>
            </div>
          </template>

          <UTabs :items="previewTabs" class="w-full">
            <template #item="{ item }">
              <div v-if="item.key === 'files'" class="space-y-4">
                <div
                  v-for="file in generationPreview.files"
                  :key="file.path"
                  class="border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                    <div class="flex items-center space-x-2">
                      <UIcon
                        :name="getFileIcon(file.path)"
                        class="w-4 h-4 text-gray-500"
                      />
                      <code class="text-sm font-mono">{{ file.path }}</code>
                    </div>
                    <UButton
                      variant="ghost"
                      size="xs"
                      @click="copyFileContent(file.content)"
                    >
                      <UIcon name="i-heroicons-clipboard" class="w-3 h-3" />
                    </UButton>
                  </div>
                  <pre class="p-4 text-sm overflow-x-auto bg-gray-900 text-gray-100 rounded-b-lg"><code>{{ file.content }}</code></pre>
                </div>
              </div>
              <div v-else-if="item.key === 'structure'" class="font-mono text-sm">
                <div
                  v-for="file in generationPreview.files"
                  :key="file.path"
                  class="flex items-center space-x-2 py-1"
                >
                  <UIcon
                    :name="getFileIcon(file.path)"
                    class="w-4 h-4 text-gray-500"
                  />
                  <span>{{ file.path }}</span>
                </div>
              </div>
            </template>
          </UTabs>
        </UCard>

        <!-- Generate Button -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <UCheckbox v-model="previewEnabled">
              Enable live preview
            </UCheckbox>
            <UCheckbox v-model="dryRun">
              Dry run (preview only)
            </UCheckbox>
          </div>
          
          <div class="flex items-center space-x-2">
            <UButton
              variant="outline"
              @click="saveAsPreset"
              :disabled="generating"
            >
              Save as Preset
            </UButton>
            <UButton
              size="lg"
              @click="generateCode"
              :loading="generating"
              :disabled="!canGenerate"
            >
              <UIcon name="i-heroicons-play" class="w-5 h-5 mr-2" />
              {{ dryRun ? 'Preview Generation' : 'Generate Code' }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Generation Progress -->
    <UCard v-if="generationProgress.show">
      <template #header>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Generating Code...</h3>
      </template>

      <div class="space-y-4">
        <UProgress :value="generationProgress.percentage" />
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ generationProgress.currentStep }}
        </p>
        <div class="text-xs space-y-1">
          <div
            v-for="step in generationProgress.steps"
            :key="step.name"
            :class="[
              'flex items-center space-x-2',
              step.status === 'completed' ? 'text-green-600' :
              step.status === 'in-progress' ? 'text-blue-600' :
              'text-gray-400'
            ]"
          >
            <UIcon
              :name="step.status === 'completed' ? 'i-heroicons-check' : 
                     step.status === 'in-progress' ? 'i-heroicons-arrow-path' : 
                     'i-heroicons-clock'"
              class="w-3 h-3"
            />
            <span>{{ step.name }}</span>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Generation Results -->
    <UCard v-if="generationResult">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Generation {{ generationResult.success ? 'Complete' : 'Failed' }}
          </h3>
          <UButton
            v-if="generationResult.success"
            variant="outline"
            @click="downloadFiles"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
            Download Files
          </UButton>
        </div>
      </template>

      <UAlert
        v-if="generationResult.success"
        color="green"
        title="Code generated successfully!"
        :description="`Generated ${generationResult.filesCreated} files in ${generationResult.outputPath}`"
      />
      
      <UAlert
        v-else
        color="red"
        title="Generation failed"
        :description="generationResult.error"
      />

      <div v-if="generationResult.files" class="mt-4">
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">Generated Files:</h4>
        <div class="space-y-1">
          <div
            v-for="file in generationResult.files"
            :key="file.path"
            class="flex items-center space-x-2 text-sm"
          >
            <UIcon name="i-heroicons-document" class="w-4 h-4 text-green-500" />
            <code>{{ file.path }}</code>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { Template, CodeGeneration, GeneratedFile } from '~/types'

const { $fetch } = useNuxtApp()
const { isConnected, presenceIndicators } = useRealTime()

const selectedTemplate = ref<Template | null>(null)
const generating = ref(false)
const updatingPreview = ref(false)
const previewEnabled = ref(true)
const dryRun = ref(false)

const templateVariables = ref<Record<string, any>>({})
const generationConfig = ref({
  outputDir: './src',
  fileNaming: 'kebab-case',
  overwriteFiles: false,
  createDirectory: true,
  generateTests: true,
  generateDocs: false
})

const generationProgress = ref({
  show: false,
  percentage: 0,
  currentStep: '',
  steps: [] as Array<{ name: string; status: 'pending' | 'in-progress' | 'completed' }>
})

const generationPreview = ref({
  files: [] as GeneratedFile[]
})

const generationResult = ref<{
  success: boolean
  error?: string
  files?: GeneratedFile[]
  filesCreated?: number
  outputPath?: string
} | null>(null)

const recentTemplates = ref<Template[]>([
  {
    id: '1',
    name: 'React Component',
    description: 'Modern React component with TypeScript and Tailwind CSS',
    category: 'Frontend',
    language: 'TypeScript',
    framework: 'React',
    tags: ['react', 'typescript', 'tailwind'],
    author: { id: '1', name: 'System', email: '', role: { id: '', name: '', permissions: [], organizationId: '' }, organizationId: '', avatar: '', lastActive: new Date(), permissions: [] },
    organizationId: '',
    isPublic: true,
    downloads: 1234,
    rating: 4.8,
    reviews: [],
    files: [],
    variables: [
      { name: 'componentName', type: 'string', description: 'Name of the component', default: 'MyComponent', required: true, validation: '' },
      { name: 'withTests', type: 'boolean', description: 'Generate test files', default: true, required: false, validation: '' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    name: 'Node.js API',
    description: 'RESTful API with Express, TypeScript, and authentication',
    category: 'Backend',
    language: 'TypeScript',
    framework: 'Express',
    tags: ['nodejs', 'express', 'api'],
    author: { id: '1', name: 'System', email: '', role: { id: '', name: '', permissions: [], organizationId: '' }, organizationId: '', avatar: '', lastActive: new Date(), permissions: [] },
    organizationId: '',
    isPublic: true,
    downloads: 987,
    rating: 4.6,
    reviews: [],
    files: [],
    variables: [
      { name: 'apiName', type: 'string', description: 'Name of the API', default: 'MyAPI', required: true, validation: '' },
      { name: 'withAuth', type: 'boolean', description: 'Include authentication', default: true, required: false, validation: '' }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
])

const fileNamingOptions = [
  { label: 'kebab-case', value: 'kebab-case' },
  { label: 'camelCase', value: 'camelCase' },
  { label: 'PascalCase', value: 'PascalCase' },
  { label: 'snake_case', value: 'snake_case' }
]

const previewTabs = [
  { key: 'files', label: 'Generated Files' },
  { key: 'structure', label: 'File Structure' }
]

const canGenerate = computed(() => {
  if (!selectedTemplate.value) return false
  
  // Check required variables
  return selectedTemplate.value.variables
    .filter(v => v.required)
    .every(v => templateVariables.value[v.name])
})

const selectTemplate = (template: Template) => {
  selectedTemplate.value = template
  
  // Initialize variables with defaults
  template.variables.forEach(variable => {
    templateVariables.value[variable.name] = variable.default
  })

  // Join collaboration session
  const sessionId = `template-${template.id}`
  // realtime.joinSession(sessionId)
  
  if (previewEnabled.value) {
    updatePreview()
  }
}

const addArrayItem = (variableName: string) => {
  if (!templateVariables.value[variableName]) {
    templateVariables.value[variableName] = []
  }
  templateVariables.value[variableName].push('')
}

const removeArrayItem = (variableName: string, index: number) => {
  templateVariables.value[variableName].splice(index, 1)
}

const resetToDefaults = () => {
  if (!selectedTemplate.value) return
  
  selectedTemplate.value.variables.forEach(variable => {
    templateVariables.value[variable.name] = variable.default
  })
  
  if (previewEnabled.value) {
    updatePreview()
  }
}

const loadPreset = async () => {
  // Implementation for loading saved presets
  console.log('Load preset functionality')
}

const saveAsPreset = async () => {
  // Implementation for saving current configuration as preset
  console.log('Save preset functionality')
}

const updatePreview = async () => {
  if (!selectedTemplate.value) return
  
  updatingPreview.value = true
  try {
    const result = await $fetch('/api/templates/preview', {
      method: 'POST',
      body: {
        templateId: selectedTemplate.value.id,
        variables: templateVariables.value,
        config: generationConfig.value
      }
    })
    
    generationPreview.value = result
  } catch (error) {
    console.error('Failed to update preview:', error)
  } finally {
    updatingPreview.value = false
  }
}

const generateCode = async () => {
  if (!selectedTemplate.value || generating.value) return
  
  generating.value = true
  generationProgress.value.show = true
  generationResult.value = null
  
  // Initialize progress
  generationProgress.value.steps = [
    { name: 'Validating template variables', status: 'pending' },
    { name: 'Processing template files', status: 'pending' },
    { name: 'Generating code', status: 'pending' },
    { name: 'Writing files', status: 'pending' },
    { name: 'Running post-generation tasks', status: 'pending' }
  ]
  
  try {
    const result = await $fetch('/api/templates/generate', {
      method: 'POST',
      body: {
        templateId: selectedTemplate.value.id,
        variables: templateVariables.value,
        config: {
          ...generationConfig.value,
          dryRun: dryRun.value
        }
      }
    })
    
    generationResult.value = {
      success: true,
      files: result.files,
      filesCreated: result.files?.length || 0,
      outputPath: generationConfig.value.outputDir
    }
  } catch (error: any) {
    generationResult.value = {
      success: false,
      error: error.data?.message || 'Failed to generate code'
    }
  } finally {
    generating.value = false
    generationProgress.value.show = false
  }
}

const downloadFiles = async () => {
  if (!generationResult.value?.files) return
  
  // Create zip file and download
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  
  generationResult.value.files.forEach(file => {
    zip.file(file.path, file.content)
  })
  
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedTemplate.value?.name || 'generated'}-files.zip`
  a.click()
  URL.revokeObjectURL(url)
}

const copyFileContent = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    useToast().add({
      title: 'Content copied',
      description: 'File content has been copied to clipboard',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Failed to copy',
      description: 'Please try again',
      color: 'red'
    })
  }
}

const getLanguageIcon = (language: string): string => {
  const icons: Record<string, string> = {
    'TypeScript': 'i-simple-icons-typescript',
    'JavaScript': 'i-simple-icons-javascript',
    'Python': 'i-simple-icons-python',
    'Go': 'i-simple-icons-go',
    'Rust': 'i-simple-icons-rust',
    'Vue': 'i-simple-icons-vuedotjs',
    'React': 'i-simple-icons-react'
  }
  return icons[language] || 'i-heroicons-code-bracket'
}

const getLanguageColor = (language: string): string => {
  const colors: Record<string, string> = {
    'TypeScript': 'bg-blue-500',
    'JavaScript': 'bg-yellow-500',
    'Python': 'bg-green-500',
    'Go': 'bg-cyan-500',
    'Rust': 'bg-orange-500',
    'Vue': 'bg-emerald-500',
    'React': 'bg-sky-500'
  }
  return colors[language] || 'bg-gray-500'
}

const getFileIcon = (path: string): string => {
  const extension = path.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    'ts': 'i-simple-icons-typescript',
    'js': 'i-simple-icons-javascript',
    'vue': 'i-simple-icons-vuedotjs',
    'jsx': 'i-simple-icons-react',
    'tsx': 'i-simple-icons-react',
    'py': 'i-simple-icons-python',
    'json': 'i-heroicons-code-bracket',
    'md': 'i-heroicons-document-text'
  }
  return icons[extension || ''] || 'i-heroicons-document'
}

// Watch for variable changes to update preview
watch(templateVariables, () => {
  if (previewEnabled.value && selectedTemplate.value) {
    debounce(updatePreview, 500)()
  }
}, { deep: true })

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }) as T
}
</script>