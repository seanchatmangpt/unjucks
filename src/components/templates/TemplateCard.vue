<template>
  <UCard 
    :class="[
      'h-full transition-all duration-200 hover:shadow-lg cursor-pointer group',
      viewMode === 'list' ? 'flex-row p-6' : ''
    ]"
    @click="$emit('select', template)"
  >
    <div :class="viewMode === 'list' ? 'flex items-center space-x-6 w-full' : ''">
      <!-- Template Icon/Preview -->
      <div :class="[
        'flex items-center justify-center rounded-lg',
        viewMode === 'list' ? 'w-16 h-16 flex-shrink-0' : 'w-12 h-12 mb-4',
        getLanguageColor(template.language)
      ]">
        <UIcon :name="getLanguageIcon(template.language)" class="w-6 h-6 text-white" />
      </div>

      <div :class="viewMode === 'list' ? 'flex-1' : ''">
        <!-- Header -->
        <div :class="viewMode === 'list' ? 'flex items-start justify-between' : 'mb-4'">
          <div :class="viewMode === 'list' ? 'flex-1' : ''">
            <div class="flex items-center space-x-2 mb-2">
              <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {{ template.name }}
              </h3>
              <UBadge v-if="featured" color="amber" variant="solid" size="xs">
                Featured
              </UBadge>
            </div>
            
            <p :class="[
              'text-gray-600 dark:text-gray-400 text-sm',
              viewMode === 'list' ? 'mb-2' : 'mb-4 line-clamp-2'
            ]">
              {{ template.description }}
            </p>

            <!-- Metadata -->
            <div :class="[
              'flex items-center text-xs text-gray-500 dark:text-gray-400',
              viewMode === 'list' ? 'space-x-6' : 'space-x-4'
            ]">
              <div class="flex items-center space-x-1">
                <UIcon name="i-heroicons-arrow-down-tray" class="w-3 h-3" />
                <span>{{ formatDownloads(template.downloads) }}</span>
              </div>
              <div class="flex items-center space-x-1">
                <UIcon name="i-heroicons-star" class="w-3 h-3" />
                <span>{{ template.rating.toFixed(1) }}</span>
              </div>
              <div class="flex items-center space-x-1">
                <UIcon name="i-heroicons-clock" class="w-3 h-3" />
                <span>{{ formatTimestamp(template.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div :class="[
            'flex items-center space-x-2',
            viewMode === 'list' ? 'flex-shrink-0' : 'mt-4 justify-between'
          ]">
            <div v-if="viewMode === 'grid'" class="flex items-center space-x-2">
              <UBadge :color="getCategoryColor(template.category)" variant="subtle" size="xs">
                {{ template.category }}
              </UBadge>
              <UBadge color="gray" variant="subtle" size="xs">
                {{ template.language }}
              </UBadge>
            </div>

            <div class="flex items-center space-x-1">
              <UButton
                variant="ghost"
                size="xs"
                square
                @click.stop="$emit('favorite', template)"
              >
                <UIcon name="i-heroicons-heart" class="w-4 h-4" />
              </UButton>

              <UButton
                variant="ghost"
                size="xs"
                square
                @click.stop="shareTemplate"
              >
                <UIcon name="i-heroicons-share" class="w-4 h-4" />
              </UButton>

              <UDropdown :items="templateActions" @click.stop="">
                <UButton variant="ghost" size="xs" square>
                  <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4" />
                </UButton>
              </UDropdown>
            </div>
          </div>
        </div>

        <!-- Tags (List view only) -->
        <div v-if="viewMode === 'list'" class="flex items-center space-x-2 mt-3">
          <UBadge :color="getCategoryColor(template.category)" variant="subtle" size="xs">
            {{ template.category }}
          </UBadge>
          <UBadge color="gray" variant="subtle" size="xs">
            {{ template.language }}
          </UBadge>
          <div v-for="tag in template.tags.slice(0, 3)" :key="tag">
            <UBadge color="gray" variant="outline" size="xs">
              {{ tag }}
            </UBadge>
          </div>
          <span v-if="template.tags.length > 3" class="text-xs text-gray-400">
            +{{ template.tags.length - 3 }} more
          </span>
        </div>

        <!-- Tags (Grid view) -->
        <div v-if="viewMode === 'grid'" class="flex flex-wrap gap-1 mt-2">
          <UBadge
            v-for="tag in template.tags.slice(0, 2)"
            :key="tag"
            color="gray"
            variant="outline"
            size="xs"
          >
            {{ tag }}
          </UBadge>
          <span v-if="template.tags.length > 2" class="text-xs text-gray-400">
            +{{ template.tags.length - 2 }}
          </span>
        </div>
      </div>

      <!-- Use Button (List view) -->
      <div v-if="viewMode === 'list'" class="flex-shrink-0">
        <UButton
          size="sm"
          @click.stop="$emit('use', template)"
        >
          Use Template
        </UButton>
      </div>
    </div>

    <!-- Use Button (Grid view) -->
    <template v-if="viewMode === 'grid'" #footer>
      <UButton
        block
        size="sm"
        @click.stop="$emit('use', template)"
      >
        Use Template
      </UButton>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { Template } from '~/types'

interface Props {
  template: Template
  featured?: boolean
  viewMode?: 'grid' | 'list'
}

const props = withDefaults(defineProps<Props>(), {
  featured: false,
  viewMode: 'grid'
})

defineEmits<{
  select: [template: Template]
  favorite: [template: Template]
  use: [template: Template]
}>()

const templateActions = computed(() => [
  [{
    label: 'View Details',
    icon: 'i-heroicons-eye',
    click: () => $emit('select', props.template)
  }, {
    label: 'Use Template',
    icon: 'i-heroicons-play',
    click: () => $emit('use', props.template)
  }],
  [{
    label: 'Copy Link',
    icon: 'i-heroicons-link',
    click: () => copyTemplateLink()
  }, {
    label: 'Report Issue',
    icon: 'i-heroicons-flag',
    click: () => reportTemplate()
  }]
])

const getLanguageIcon = (language: string): string => {
  const icons: Record<string, string> = {
    'TypeScript': 'i-simple-icons-typescript',
    'JavaScript': 'i-simple-icons-javascript',
    'Python': 'i-simple-icons-python',
    'Go': 'i-simple-icons-go',
    'Rust': 'i-simple-icons-rust',
    'Java': 'i-simple-icons-java',
    'Vue': 'i-simple-icons-vuedotjs',
    'React': 'i-simple-icons-react',
    'Angular': 'i-simple-icons-angular'
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
    'React': 'bg-sky-500',
    'Angular': 'bg-red-600'
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

const formatDownloads = (downloads: number): string => {
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}k`
  }
  return downloads.toString()
}

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(timestamp).getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

const shareTemplate = async () => {
  try {
    await navigator.share({
      title: props.template.name,
      text: props.template.description,
      url: `${window.location.origin}/templates/${props.template.id}`
    })
  } catch (error) {
    // Fallback to clipboard
    await copyTemplateLink()
  }
}

const copyTemplateLink = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/templates/${props.template.id}`)
    useToast().add({
      title: 'Link copied',
      description: 'Template link has been copied to clipboard',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Failed to copy link',
      description: 'Please try again',
      color: 'red'
    })
  }
}

const reportTemplate = () => {
  navigateTo(`/templates/${props.template.id}/report`)
}
</script>