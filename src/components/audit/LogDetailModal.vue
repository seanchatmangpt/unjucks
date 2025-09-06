<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div :class="[
            'flex items-center justify-center w-10 h-10 rounded-full',
            getActionColor(log.action)
          ]">
            <UIcon :name="getActionIcon(log.action)" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Audit Log Details
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ formatTimestamp(log.timestamp) }}
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
      <!-- Event Summary -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Event ID</label>
            <div class="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <code class="text-sm text-gray-800 dark:text-gray-200">{{ log.id }}</code>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
            <div class="mt-1 flex items-center space-x-2">
              <UBadge :color="getActionBadgeColor(log.action)" variant="subtle" class="capitalize">
                {{ log.action.replace('_', ' ') }}
              </UBadge>
              <span class="text-sm text-gray-600 dark:text-gray-400">on {{ log.resource }}</span>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Timestamp</label>
            <div class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ formatFullTimestamp(log.timestamp) }}
            </div>
          </div>

          <div v-if="log.resourceId">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Resource ID</label>
            <div class="mt-1 flex items-center space-x-2">
              <code class="text-sm text-gray-800 dark:text-gray-200">{{ log.resourceId }}</code>
              <UButton
                variant="ghost"
                size="xs"
                @click="navigateToResource"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3" />
              </UButton>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">User</label>
            <div class="mt-1">
              <div v-if="log.user" class="flex items-center space-x-3">
                <UAvatar
                  :src="log.user.avatar"
                  :alt="log.user.name"
                  size="sm"
                />
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ log.user.name }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ log.user.email }}
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center space-x-2">
                <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">System Action</span>
              </div>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Source IP</label>
            <div class="mt-1 flex items-center space-x-2">
              <code class="text-sm text-gray-800 dark:text-gray-200">{{ log.ipAddress }}</code>
              <div class="flex items-center space-x-1">
                <div :class="[
                  'w-2 h-2 rounded-full',
                  getLocationColor(log.ipAddress)
                ]" />
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ getLocationInfo(log.ipAddress) }}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">User Agent</label>
            <div class="mt-1">
              <div class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <UIcon :name="getBrowserIcon(log.userAgent)" class="w-4 h-4" />
                <span>{{ getBrowserInfo(log.userAgent) }}</span>
              </div>
              <details class="mt-1">
                <summary class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  Show full user agent
                </summary>
                <div class="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs break-all">
                  {{ log.userAgent }}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      <!-- Event Metadata -->
      <div v-if="hasMetadata">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Event Metadata
        </label>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <JsonViewer :data="log.metadata" />
        </div>
      </div>

      <!-- Related Events -->
      <div v-if="relatedEvents.length > 0">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
          Related Events
        </label>
        <div class="space-y-2">
          <div
            v-for="event in relatedEvents"
            :key="event.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div class="flex items-center space-x-3">
              <div :class="[
                'flex items-center justify-center w-6 h-6 rounded-full',
                getActionColor(event.action)
              ]">
                <UIcon :name="getActionIcon(event.action)" class="w-3 h-3" />
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ event.action.replace('_', ' ') }}
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  {{ formatRelativeTime(event.timestamp) }}
                </div>
              </div>
            </div>
            <UButton
              variant="ghost"
              size="xs"
              @click="viewRelatedEvent(event)"
            >
              View
            </UButton>
          </div>
        </div>
      </div>

      <!-- Security Analysis -->
      <div v-if="isSecurityEvent">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
          Security Analysis
        </label>
        <UAlert
          :color="securityAnalysis.level"
          :title="securityAnalysis.title"
          :description="securityAnalysis.description"
        >
          <template v-if="securityAnalysis.recommendations.length > 0" #actions>
            <UButton
              :color="securityAnalysis.level"
              variant="outline"
              size="xs"
              @click="showRecommendations = !showRecommendations"
            >
              {{ showRecommendations ? 'Hide' : 'Show' }} Recommendations
            </UButton>
          </template>
        </UAlert>

        <div v-if="showRecommendations" class="mt-3 space-y-2">
          <div
            v-for="(recommendation, index) in securityAnalysis.recommendations"
            :key="index"
            class="flex items-start space-x-2 text-sm"
          >
            <UIcon name="i-heroicons-light-bulb" class="w-4 h-4 text-yellow-500 mt-0.5" />
            <span class="text-gray-700 dark:text-gray-300">{{ recommendation }}</span>
          </div>
        </div>
      </div>

      <!-- Impact Assessment -->
      <div v-if="impactLevel !== 'low'">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Impact Assessment
        </label>
        <div class="flex items-center space-x-3">
          <UBadge
            :color="impactLevel === 'high' ? 'red' : impactLevel === 'medium' ? 'orange' : 'green'"
            variant="subtle"
            class="capitalize"
          >
            {{ impactLevel }} Impact
          </UBadge>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ getImpactDescription() }}
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between">
        <div class="flex space-x-2">
          <UButton
            variant="outline"
            size="sm"
            @click="exportEvent"
          >
            <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
            Export
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            @click="copyEventId"
          >
            <UIcon name="i-heroicons-clipboard" class="w-4 h-4 mr-1" />
            Copy ID
          </UButton>
        </div>
        <UButton @click="$emit('close')">
          Close
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { AuditLog } from '~/types'
import JsonViewer from './JsonViewer.vue'

interface Props {
  log: AuditLog
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

const showRecommendations = ref(false)
const relatedEvents = ref<AuditLog[]>([])

const hasMetadata = computed(() => {
  return Object.keys(props.log.metadata || {}).length > 0
})

const isSecurityEvent = computed(() => {
  const securityActions = ['login', 'logout', 'failed_login', 'password_reset', 'permission_change']
  return securityActions.includes(props.log.action) || 
         props.log.metadata?.security || 
         props.log.metadata?.suspicious
})

const impactLevel = computed(() => {
  if (props.log.action === 'delete' && props.log.resource === 'Organization') return 'high'
  if (props.log.action === 'delete' && ['Template', 'User'].includes(props.log.resource)) return 'medium'
  if (props.log.action === 'create' && props.log.resource === 'User') return 'medium'
  return 'low'
})

const securityAnalysis = computed(() => {
  const analysis = {
    level: 'green' as const,
    title: 'Normal Activity',
    description: 'This event appears to be normal user activity.',
    recommendations: [] as string[]
  }

  if (props.log.action === 'failed_login') {
    analysis.level = 'yellow'
    analysis.title = 'Failed Login Attempt'
    analysis.description = 'Multiple failed login attempts may indicate a brute force attack.'
    analysis.recommendations = [
      'Monitor IP address for repeated failed attempts',
      'Consider implementing account lockout policies',
      'Review password strength requirements'
    ]
  } else if (props.log.action === 'login' && isUnusualTime(props.log.timestamp)) {
    analysis.level = 'yellow'
    analysis.title = 'Unusual Login Time'
    analysis.description = 'Login occurred outside normal business hours.'
    analysis.recommendations = [
      'Verify the login was legitimate',
      'Check if user has approval for off-hours access'
    ]
  } else if (props.log.action === 'delete' && props.log.resource === 'Organization') {
    analysis.level = 'red'
    analysis.title = 'High-Impact Deletion'
    analysis.description = 'Organization deletion is a critical action that affects all users.'
    analysis.recommendations = [
      'Verify this action was authorized',
      'Check if proper approval process was followed',
      'Consider backup and recovery procedures'
    ]
  }

  return analysis
})

const getActionIcon = (action: string): string => {
  const icons: Record<string, string> = {
    'create': 'i-heroicons-plus-circle',
    'update': 'i-heroicons-pencil-square',
    'delete': 'i-heroicons-trash',
    'login': 'i-heroicons-arrow-right-on-rectangle',
    'logout': 'i-heroicons-arrow-left-on-rectangle',
    'failed_login': 'i-heroicons-shield-exclamation',
    'generate': 'i-heroicons-code-bracket',
    'download': 'i-heroicons-arrow-down-tray',
    'upload': 'i-heroicons-arrow-up-tray'
  }
  return icons[action] || 'i-heroicons-information-circle'
}

const getActionColor = (action: string): string => {
  const colors: Record<string, string> = {
    'create': 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    'update': 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    'delete': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    'login': 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
    'logout': 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
    'failed_login': 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    'generate': 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400'
  }
  return colors[action] || 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
}

const getActionBadgeColor = (action: string): string => {
  const colors: Record<string, string> = {
    'create': 'green',
    'update': 'blue',
    'delete': 'red',
    'login': 'emerald',
    'logout': 'gray',
    'failed_login': 'red',
    'generate': 'purple'
  }
  return colors[action] || 'gray'
}

const getBrowserIcon = (userAgent: string): string => {
  if (userAgent.includes('Chrome')) return 'i-simple-icons-googlechrome'
  if (userAgent.includes('Firefox')) return 'i-simple-icons-firefox'
  if (userAgent.includes('Safari')) return 'i-simple-icons-safari'
  if (userAgent.includes('Edge')) return 'i-simple-icons-microsoftedge'
  return 'i-heroicons-globe-alt'
}

const getBrowserInfo = (userAgent: string): string => {
  const browser = userAgent.includes('Chrome') ? 'Chrome' :
                 userAgent.includes('Firefox') ? 'Firefox' :
                 userAgent.includes('Safari') ? 'Safari' :
                 userAgent.includes('Edge') ? 'Edge' : 'Unknown'
  
  const os = userAgent.includes('Windows') ? 'Windows' :
            userAgent.includes('Mac') ? 'macOS' :
            userAgent.includes('Linux') ? 'Linux' :
            userAgent.includes('Android') ? 'Android' :
            userAgent.includes('iOS') ? 'iOS' : 'Unknown'
  
  return `${browser} on ${os}`
}

const getLocationColor = (ipAddress: string): string => {
  // Simple IP classification - in real app, would use geolocation service
  if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return 'bg-green-400' // Internal/Safe
  }
  return 'bg-blue-400' // External
}

const getLocationInfo = (ipAddress: string): string => {
  if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return 'Internal Network'
  }
  return 'External Network'
}

const formatTimestamp = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

const formatFullTimestamp = (timestamp: Date): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}

const formatRelativeTime = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  
  return new Date(timestamp).toLocaleDateString()
}

const isUnusualTime = (timestamp: Date): boolean => {
  const hour = new Date(timestamp).getHours()
  return hour < 6 || hour > 22 // Outside 6 AM - 10 PM
}

const getImpactDescription = (): string => {
  if (impactLevel.value === 'high') {
    return 'This action may have significant impact on system operations or multiple users.'
  }
  if (impactLevel.value === 'medium') {
    return 'This action may affect some users or system functionality.'
  }
  return 'This action has minimal impact on system operations.'
}

const navigateToResource = () => {
  if (props.log.resourceId) {
    const path = `/${props.log.resource.toLowerCase()}s/${props.log.resourceId}`
    navigateTo(path)
  }
}

const viewRelatedEvent = (event: AuditLog) => {
  // Emit event to parent to show another log detail
  console.log('View related event:', event.id)
}

const exportEvent = async () => {
  try {
    const data = JSON.stringify(props.log, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${props.log.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    useToast().add({
      title: 'Export failed',
      description: 'Failed to export audit log',
      color: 'red'
    })
  }
}

const copyEventId = async () => {
  try {
    await navigator.clipboard.writeText(props.log.id)
    useToast().add({
      title: 'Copied',
      description: 'Event ID copied to clipboard',
      color: 'green'
    })
  } catch (error) {
    useToast().add({
      title: 'Copy failed',
      description: 'Failed to copy event ID',
      color: 'red'
    })
  }
}

// Load related events
onMounted(async () => {
  try {
    const data = await $fetch(`/api/audit-logs/${props.log.id}/related`)
    relatedEvents.value = data.events
  } catch (error) {
    console.error('Failed to load related events:', error)
  }
})
</script>