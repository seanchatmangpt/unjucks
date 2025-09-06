<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
          <p v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
        </div>
        <UDropdown :items="chartActions">
          <UButton variant="ghost" size="sm" square>
            <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4" />
          </UButton>
        </UDropdown>
      </div>
    </template>

    <div class="h-64">
      <!-- Line Chart -->
      <div v-if="type === 'line'" class="h-full flex items-end justify-between space-x-1">
        <div
          v-for="(point, index) in data"
          :key="index"
          class="flex-1 flex flex-col items-center"
        >
          <div 
            class="w-full bg-primary-500 rounded-t"
            :style="{ height: `${(point.value / maxValue) * 100}%` }"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {{ point.label }}
          </span>
        </div>
      </div>

      <!-- Area Chart -->
      <div v-else-if="type === 'area'" class="h-full relative">
        <svg class="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" :stop-color="primaryColor" stop-opacity="0.3"/>
              <stop offset="100%" :stop-color="primaryColor" stop-opacity="0"/>
            </linearGradient>
          </defs>
          
          <!-- Area Path -->
          <path
            :d="areaPath"
            fill="url(#areaGradient)"
            stroke="none"
          />
          
          <!-- Line Path -->
          <path
            :d="linePath"
            fill="none"
            :stroke="primaryColor"
            stroke-width="2"
          />
          
          <!-- Data Points -->
          <circle
            v-for="(point, index) in data"
            :key="index"
            :cx="(index / (data.length - 1)) * 400"
            :cy="200 - (point.value / maxValue) * 200"
            r="3"
            :fill="primaryColor"
          />
        </svg>
        
        <!-- X-axis labels -->
        <div class="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span v-for="point in data" :key="point.label">{{ point.label }}</span>
        </div>
      </div>

      <!-- Bar Chart -->
      <div v-else-if="type === 'bar'" class="h-full flex items-end justify-between space-x-2">
        <div
          v-for="(point, index) in data"
          :key="index"
          class="flex-1 flex flex-col items-center"
        >
          <div
            class="w-full bg-primary-500 rounded-t transition-all duration-300 hover:bg-primary-600"
            :style="{ height: `${(point.value / maxValue) * 100}%` }"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {{ point.label }}
          </span>
        </div>
      </div>

      <!-- Donut Chart -->
      <div v-else-if="type === 'donut'" class="h-full flex items-center justify-center">
        <div class="relative w-32 h-32">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              stroke-width="8"
              class="text-gray-200 dark:text-gray-700"
            />
            <circle
              v-for="(segment, index) in donutSegments"
              :key="index"
              cx="50"
              cy="50"
              r="40"
              fill="none"
              :stroke="segment.color"
              stroke-width="8"
              :stroke-dasharray="`${segment.circumference} 251.2`"
              :stroke-dashoffset="segment.offset"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ data.reduce((sum, point) => sum + point.value, 0) }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Total</div>
            </div>
          </div>
        </div>
        
        <!-- Legend -->
        <div class="ml-8 space-y-2">
          <div
            v-for="(point, index) in data"
            :key="point.label"
            class="flex items-center space-x-2"
          >
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: getSegmentColor(index) }"
            />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ point.label }}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ point.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface ChartData {
  label: string
  value: number
}

interface Props {
  title: string
  subtitle?: string
  type: 'line' | 'area' | 'bar' | 'donut'
  data: ChartData[]
}

const props = defineProps<Props>()

const primaryColor = '#3B82F6'

const maxValue = computed(() => Math.max(...props.data.map(d => d.value)))

const linePath = computed(() => {
  if (props.data.length === 0) return ''
  
  const points = props.data.map((point, index) => {
    const x = (index / (props.data.length - 1)) * 400
    const y = 200 - (point.value / maxValue.value) * 200
    return `${x},${y}`
  })
  
  return `M ${points.join(' L ')}`
})

const areaPath = computed(() => {
  if (props.data.length === 0) return ''
  
  const points = props.data.map((point, index) => {
    const x = (index / (props.data.length - 1)) * 400
    const y = 200 - (point.value / maxValue.value) * 200
    return `${x},${y}`
  })
  
  return `M 0,200 L ${points.join(' L ')} L 400,200 Z`
})

const donutSegments = computed(() => {
  if (props.type !== 'donut') return []
  
  const total = props.data.reduce((sum, point) => sum + point.value, 0)
  const circumference = 2 * Math.PI * 40 // radius = 40
  let currentOffset = 0
  
  return props.data.map((point, index) => {
    const percentage = point.value / total
    const segmentCircumference = percentage * circumference
    const offset = -currentOffset
    
    currentOffset += segmentCircumference
    
    return {
      circumference: segmentCircumference,
      offset,
      color: getSegmentColor(index)
    }
  })
})

const getSegmentColor = (index: number): string => {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // emerald  
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#F97316'  // orange
  ]
  return colors[index % colors.length]
}

const chartActions = [
  [{
    label: 'Download as PNG',
    icon: 'i-heroicons-photo',
    click: () => console.log('Download PNG')
  }],
  [{
    label: 'Export Data',
    icon: 'i-heroicons-document-arrow-down',
    click: () => console.log('Export data')
  }]
]
</script>