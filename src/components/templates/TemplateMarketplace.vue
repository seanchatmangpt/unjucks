<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Template Marketplace</h2>
        <p class="text-gray-600 dark:text-gray-400">Discover and use templates created by the community</p>
      </div>
      <UButton icon="i-heroicons-plus" to="/templates/create">
        Create Template
      </UButton>
    </div>

    <!-- Filters and Search -->
    <UCard>
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
        <div class="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <UInput
            v-model="searchQuery"
            placeholder="Search templates..."
            icon="i-heroicons-magnifying-glass"
            class="w-full sm:w-64"
          />
          <USelect
            v-model="selectedCategory"
            :options="categories"
            placeholder="All Categories"
            class="w-full sm:w-40"
          />
          <USelect
            v-model="selectedLanguage"
            :options="languages"
            placeholder="All Languages"
            class="w-full sm:w-40"
          />
        </div>
        
        <div class="flex items-center space-x-2">
          <USelect
            v-model="sortBy"
            :options="sortOptions"
            class="w-32"
          />
          <UButton
            :icon="viewMode === 'grid' ? 'i-heroicons-list-bullet' : 'i-heroicons-squares-2x2'"
            variant="outline"
            size="sm"
            @click="toggleViewMode"
          />
        </div>
      </div>
    </UCard>

    <!-- Featured Templates -->
    <div v-if="featuredTemplates.length > 0 && !searchQuery">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Featured Templates</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <TemplateCard
          v-for="template in featuredTemplates"
          :key="template.id"
          :template="template"
          featured
          @select="selectTemplate"
        />
      </div>
    </div>

    <!-- Templates Grid/List -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ searchQuery ? `Search Results (${filteredTemplates.length})` : 'All Templates' }}
        </h3>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          Showing {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, filteredTemplates.length) }} 
          of {{ filteredTemplates.length }} templates
        </div>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <USkeleton
          v-for="i in pageSize"
          :key="i"
          class="h-64 w-full"
        />
      </div>

      <div
        v-else-if="paginatedTemplates.length > 0"
        :class="[
          'grid gap-6',
          viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
            : 'grid-cols-1'
        ]"
      >
        <TemplateCard
          v-for="template in paginatedTemplates"
          :key="template.id"
          :template="template"
          :view-mode="viewMode"
          @select="selectTemplate"
          @favorite="toggleFavorite"
          @use="useTemplate"
        />
      </div>

      <div v-else class="text-center py-12">
        <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates found</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          Try adjusting your search criteria or create a new template.
        </p>
        <UButton to="/templates/create">
          Create Template
        </UButton>
      </div>

      <!-- Pagination -->
      <div v-if="paginatedTemplates.length > 0" class="flex justify-center mt-8">
        <UPagination
          v-model="currentPage"
          :page-count="pageSize"
          :total="filteredTemplates.length"
        />
      </div>
    </div>

    <!-- Template Detail Modal -->
    <UModal v-model="showTemplateDetail" :ui="{ width: 'max-w-4xl' }">
      <TemplateDetailModal
        v-if="selectedTemplate"
        :template="selectedTemplate"
        @close="showTemplateDetail = false"
        @use="useTemplate"
        @favorite="toggleFavorite"
      />
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Template } from '~/types'
import TemplateCard from './TemplateCard.vue'
import TemplateDetailModal from './TemplateDetailModal.vue'

const { $fetch } = useNuxtApp()

const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedLanguage = ref('')
const sortBy = ref('popular')
const viewMode = ref<'grid' | 'list'>('grid')
const currentPage = ref(1)
const pageSize = ref(12)
const showTemplateDetail = ref(false)

const templates = ref<Template[]>([])
const featuredTemplates = ref<Template[]>([])
const selectedTemplate = ref<Template | null>(null)

const categories = ref([
  'All Categories',
  'Frontend',
  'Backend',
  'Full Stack',
  'Mobile',
  'Desktop',
  'CLI',
  'Documentation',
  'Testing',
  'DevOps'
])

const languages = ref([
  'All Languages',
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C#',
  'PHP',
  'Ruby'
])

const sortOptions = [
  { label: 'Most Popular', value: 'popular' },
  { label: 'Newest', value: 'newest' },
  { label: 'Most Downloaded', value: 'downloads' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Recently Updated', value: 'updated' }
]

const filteredTemplates = computed(() => {
  let filtered = templates.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(template =>
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  // Category filter
  if (selectedCategory.value && selectedCategory.value !== 'All Categories') {
    filtered = filtered.filter(template => template.category === selectedCategory.value)
  }

  // Language filter
  if (selectedLanguage.value && selectedLanguage.value !== 'All Languages') {
    filtered = filtered.filter(template => template.language === selectedLanguage.value)
  }

  // Sort
  switch (sortBy.value) {
    case 'popular':
      filtered.sort((a, b) => (b.downloads + b.rating * 100) - (a.downloads + a.rating * 100))
      break
    case 'newest':
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      break
    case 'downloads':
      filtered.sort((a, b) => b.downloads - a.downloads)
      break
    case 'rating':
      filtered.sort((a, b) => b.rating - a.rating)
      break
    case 'updated':
      filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      break
  }

  return filtered
})

const paginatedTemplates = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTemplates.value.slice(start, end)
})

const fetchTemplates = async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/templates/marketplace')
    templates.value = data.templates
    featuredTemplates.value = data.featured
  } catch (error) {
    console.error('Failed to fetch templates:', error)
  } finally {
    loading.value = false
  }
}

const selectTemplate = (template: Template) => {
  selectedTemplate.value = template
  showTemplateDetail.value = true
}

const useTemplate = (template: Template) => {
  navigateTo(`/templates/${template.id}/generate`)
}

const toggleFavorite = async (template: Template) => {
  try {
    await $fetch(`/api/templates/${template.id}/favorite`, {
      method: 'POST'
    })
    
    useToast().add({
      title: 'Template favorited',
      description: `${template.name} has been added to your favorites`,
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Failed to favorite template',
      description: 'Please try again later',
      color: 'red'
    })
  }
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
}

// Watch for filter changes to reset pagination
watch([searchQuery, selectedCategory, selectedLanguage, sortBy], () => {
  currentPage.value = 1
})

onMounted(() => {
  fetchTemplates()
})
</script>