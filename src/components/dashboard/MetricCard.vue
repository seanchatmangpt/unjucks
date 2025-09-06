<template>
  <UCard class="h-full">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div :class="[
          'flex items-center justify-center w-10 h-10 rounded-lg',
          iconClass
        ]">
          <UIcon :name="icon" class="w-5 h-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ title }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ formatValue(value) }}{{ unit }}
          </p>
        </div>
      </div>
      
      <div v-if="change !== undefined" class="text-right">
        <div :class="[
          'flex items-center space-x-1 text-sm font-medium',
          changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        ]">
          <UIcon 
            :name="changeType === 'increase' ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'" 
            class="w-4 h-4" 
          />
          <span>{{ Math.abs(change) }}%</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">vs last month</p>
      </div>
    </div>
    
    <div v-if="trend && trend.length > 0" class="mt-4">
      <div class="h-16 flex items-end space-x-1">
        <div
          v-for="(point, index) in trend"
          :key="index"
          class="flex-1 bg-primary-500 bg-opacity-20 rounded-sm"
          :style="{ height: `${(point / Math.max(...trend)) * 100}%` }"
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  title: string
  value: number
  change?: number
  changeType?: 'increase' | 'decrease'
  trend?: number[]
  unit?: string
  icon: string
  iconClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconClass: 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
})

const formatValue = (value: number): string => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toLocaleString()
}
</script>