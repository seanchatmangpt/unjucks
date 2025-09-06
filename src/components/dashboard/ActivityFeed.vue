<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        <UButton variant="ghost" size="sm" to="/audit">
          View All
          <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 ml-1" />
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <div
        v-for="activity in activities"
        :key="activity.id"
        class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div :class="[
          'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
          getActivityColor(activity.action)
        ]">
          <UIcon :name="getActivityIcon(activity.action)" class="w-4 h-4" />
        </div>
        
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-900 dark:text-white">
            <span class="font-medium">{{ activity.user?.name || 'System' }}</span>
            {{ getActivityDescription(activity) }}
          </p>
          <div class="flex items-center space-x-2 mt-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatTimestamp(activity.timestamp) }}
            </p>
            <span class="text-gray-300 dark:text-gray-600">•</span>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ activity.resource }}
            </p>
          </div>
        </div>
        
        <UDropdown :items="getActivityActions(activity)">
          <UButton variant="ghost" size="xs" square>
            <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4" />
          </UButton>
        </UDropdown>
      </div>
    </div>

    <template v-if="activities.length === 0">
      <div class="text-center py-8">
        <UIcon name="i-heroicons-clock" class="w-12 h-12 text-gray-400 mx-auto mb-2" />
        <p class="text-gray-500 dark:text-gray-400">No recent activity</p>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { AuditLog } from '~/types'

interface Props {
  activities: AuditLog[]
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  limit: 10
})

const getActivityIcon = (action: string): string => {
  const iconMap: Record<string, string> = {
    'create': 'i-heroicons-plus-circle',
    'update': 'i-heroicons-pencil-square',
    'delete': 'i-heroicons-trash',
    'login': 'i-heroicons-arrow-right-on-rectangle',
    'logout': 'i-heroicons-arrow-left-on-rectangle',
    'generate': 'i-heroicons-code-bracket',
    'download': 'i-heroicons-arrow-down-tray',
    'upload': 'i-heroicons-arrow-up-tray',
    'invite': 'i-heroicons-user-plus',
    'remove': 'i-heroicons-user-minus'
  }
  return iconMap[action] || 'i-heroicons-information-circle'
}

const getActivityColor = (action: string): string => {
  const colorMap: Record<string, string> = {
    'create': 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    'update': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    'delete': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    'login': 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
    'logout': 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
    'generate': 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    'download': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400',
    'upload': 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
    'invite': 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400',
    'remove': 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400'
  }
  return colorMap[action] || 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
}

const getActivityDescription = (activity: AuditLog): string => {
  const descriptions: Record<string, string> = {
    'create': 'created a new',
    'update': 'updated',
    'delete': 'deleted',
    'login': 'signed in',
    'logout': 'signed out',
    'generate': 'generated code using',
    'download': 'downloaded',
    'upload': 'uploaded',
    'invite': 'invited a user to',
    'remove': 'removed a user from'
  }
  
  const description = descriptions[activity.action] || activity.action
  if (activity.action === 'login' || activity.action === 'logout') {
    return description
  }
  
  return `${description} ${activity.resource.toLowerCase()}`
}

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return new Date(timestamp).toLocaleDateString()
}

const getActivityActions = (activity: AuditLog) => [
  [{
    label: 'View Details',
    icon: 'i-heroicons-eye',
    click: () => navigateTo(`/audit/${activity.id}`)
  }],
  [{
    label: 'View Resource',
    icon: 'i-heroicons-arrow-top-right-on-square',
    disabled: !activity.resourceId,
    click: () => {
      if (activity.resourceId) {
        navigateTo(`/${activity.resource.toLowerCase()}/${activity.resourceId}`)
      }
    }
  }]
]
</script>