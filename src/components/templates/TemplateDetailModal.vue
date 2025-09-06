<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div :class="[
            'w-12 h-12 rounded-lg flex items-center justify-center',
            getLanguageColor(template.language)
          ]">
            <UIcon :name="getLanguageIcon(template.language)" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ template.name }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              by {{ template.author.name }} • {{ formatTimestamp(template.createdAt) }}
            </p>
          </div>
        </div>
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

    <div class="space-y-6">
      <!-- Stats and Actions -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
          <div class="flex items-center space-x-1">
            <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
            <span>{{ template.downloads.toLocaleString() }} downloads</span>
          </div>
          <div class="flex items-center space-x-1">
            <UIcon name="i-heroicons-star" class="w-4 h-4" />
            <span>{{ template.rating.toFixed(1) }} ({{ template.reviews.length }} reviews)</span>
          </div>
          <div class="flex items-center space-x-1">
            <UIcon name="i-heroicons-eye" class="w-4 h-4" />
            <span>{{ template.isPublic ? 'Public' : 'Private' }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <UButton
            variant="outline"
            size="sm"
            @click="$emit('favorite', template)"
          >
            <UIcon name="i-heroicons-heart" class="w-4 h-4 mr-1" />
            Favorite
          </UButton>
          <UButton
            size="sm"
            @click="$emit('use', template)"
          >
            <UIcon name="i-heroicons-play" class="w-4 h-4 mr-1" />
            Use Template
          </UButton>
        </div>
      </div>

      <!-- Description -->
      <div>
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">Description</h4>
        <p class="text-gray-700 dark:text-gray-300">{{ template.description }}</p>
      </div>

      <!-- Tags and Categories -->
      <div>
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">Tags</h4>
        <div class="flex flex-wrap gap-2">
          <UBadge :color="getCategoryColor(template.category)" variant="subtle">
            {{ template.category }}
          </UBadge>
          <UBadge color="gray" variant="subtle">
            {{ template.language }}
          </UBadge>
          <UBadge v-if="template.framework" color="blue" variant="subtle">
            {{ template.framework }}
          </UBadge>
          <UBadge
            v-for="tag in template.tags"
            :key="tag"
            color="gray"
            variant="outline"
            size="sm"
          >
            {{ tag }}
          </UBadge>
        </div>
      </div>

      <!-- Template Variables -->
      <div v-if="template.variables.length > 0">
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">Template Variables</h4>
        <div class="space-y-3">
          <div
            v-for="variable in template.variables"
            :key="variable.name"
            class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center space-x-2">
                <code class="text-sm font-mono text-primary-600 dark:text-primary-400">
                  {{ variable.name }}
                </code>
                <UBadge color="gray" variant="outline" size="xs">
                  {{ variable.type }}
                </UBadge>
                <UBadge v-if="variable.required" color="red" variant="subtle" size="xs">
                  Required
                </UBadge>
              </div>
              <span v-if="variable.default" class="text-xs text-gray-500 dark:text-gray-400">
                Default: {{ variable.default }}
              </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ variable.description }}</p>
          </div>
        </div>
      </div>

      <!-- File Structure -->
      <div v-if="template.files.length > 0">
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">Files Generated</h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div class="space-y-1">
            <div
              v-for="file in template.files"
              :key="file.path"
              class="flex items-center space-x-2 text-sm"
            >
              <UIcon
                :name="getFileIcon(file.path)"
                :class="getFileIconColor(file.path)"
                class="w-4 h-4"
              />
              <code class="text-gray-700 dark:text-gray-300">{{ file.path }}</code>
              <UBadge color="gray" variant="outline" size="xs">
                {{ file.type }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- Reviews -->
      <div v-if="template.reviews.length > 0">
        <h4 class="font-medium text-gray-900 dark:text-white mb-2">
          Reviews ({{ template.reviews.length }})
        </h4>
        <div class="space-y-4 max-h-64 overflow-y-auto">
          <div
            v-for="review in template.reviews.slice(0, 3)"
            :key="review.id"
            class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2">
                <span class="font-medium text-gray-900 dark:text-white text-sm">
                  Anonymous User
                </span>
                <div class="flex items-center">
                  <UIcon
                    v-for="i in 5"
                    :key="i"
                    name="i-heroicons-star"
                    :class="[
                      'w-3 h-3',
                      i <= review.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
                    ]"
                  />
                </div>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatTimestamp(review.createdAt) }}
              </span>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ review.comment }}</p>
          </div>
        </div>
        <UButton
          v-if="template.reviews.length > 3"
          variant="ghost"
          size="sm"
          class="mt-2"
        >
          View all {{ template.reviews.length }} reviews
        </UButton>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <UButton variant="outline" @click="$emit('close')">
          Close
        </UButton>
        <UButton @click="$emit('use', template)">
          Use This Template
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { Template } from '~/types'

interface Props {
  template: Template
}

defineProps<Props>()

defineEmits<{
  close: []
  use: [template: Template]
  favorite: [template: Template]
}>()

const getLanguageIcon = (language: string): string => {
  const icons: Record<string, string> = {
    'TypeScript': 'i-simple-icons-typescript',
    'JavaScript': 'i-simple-icons-javascript',
    'Python': 'i-simple-icons-python',
    'Go': 'i-simple-icons-go',
    'Rust': 'i-simple-icons-rust',
    'Java': 'i-simple-icons-java',
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
    'Java': 'bg-red-500',
    'Vue': 'bg-emerald-500',
    'React': 'bg-sky-500'
  }
  return colors[language] || 'bg-gray-500'
}

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'Frontend': 'blue',
    'Backend': 'green',
    'Full Stack': 'purple',
    'Mobile': 'orange',
    'Desktop': 'gray',
    'CLI': 'indigo',
    'Documentation': 'amber',
    'Testing': 'emerald',
    'DevOps': 'red'
  }
  return colors[category] || 'gray'
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
    'go': 'i-simple-icons-go',
    'rs': 'i-simple-icons-rust',
    'java': 'i-simple-icons-java',
    'json': 'i-heroicons-code-bracket',
    'yaml': 'i-heroicons-document-text',
    'yml': 'i-heroicons-document-text',
    'md': 'i-heroicons-document-text',
    'html': 'i-heroicons-code-bracket',
    'css': 'i-heroicons-paint-brush',
    'scss': 'i-heroicons-paint-brush'
  }
  
  return icons[extension || ''] || 'i-heroicons-document'
}

const getFileIconColor = (path: string): string => {
  const extension = path.split('.').pop()?.toLowerCase()
  
  const colors: Record<string, string> = {
    'ts': 'text-blue-500',
    'js': 'text-yellow-500',
    'vue': 'text-green-500',
    'jsx': 'text-blue-400',
    'tsx': 'text-blue-400',
    'py': 'text-green-600',
    'go': 'text-cyan-500',
    'rs': 'text-orange-500',
    'java': 'text-red-500',
    'json': 'text-gray-600',
    'yaml': 'text-purple-500',
    'yml': 'text-purple-500',
    'md': 'text-gray-700',
    'html': 'text-orange-500',
    'css': 'text-blue-600',
    'scss': 'text-pink-500'
  }
  
  return colors[extension || ''] || 'text-gray-500'
}

const formatTimestamp = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>