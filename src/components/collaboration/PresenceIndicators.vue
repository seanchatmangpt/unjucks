<template>
  <div v-if="participants.length > 0" class="flex items-center space-x-2">
    <!-- Active Participants -->
    <div class="flex -space-x-2">
      <div
        v-for="participant in visibleParticipants"
        :key="participant.userId"
        class="relative group"
      >
        <UAvatar
          :src="participant.user.avatar"
          :alt="participant.user.name"
          :size="size"
          class="border-2 border-white dark:border-gray-800 transition-transform group-hover:scale-110"
        />
        
        <!-- Activity Indicator -->
        <div
          :class="[
            'absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800',
            participant.isActive ? 'bg-green-400' : 'bg-gray-300'
          ]"
        />
        
        <!-- Cursor Indicator -->
        <div
          v-if="participant.cursor && showCursors"
          class="absolute -top-1 -left-1 w-2 h-2 rounded-full"
          :style="{ backgroundColor: getUserColor(participant.userId) }"
        />

        <!-- Tooltip -->
        <UTooltip
          :text="`${participant.user.name} ${participant.isActive ? '(Active)' : '(Idle)'}`"
          :popper="{ placement: 'top' }"
        />
      </div>
      
      <!-- Overflow Indicator -->
      <div
        v-if="participants.length > maxVisible"
        :class="[
          'flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium text-xs',
          size === 'xs' ? 'w-6 h-6' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
        ]"
      >
        +{{ participants.length - maxVisible }}
      </div>
    </div>

    <!-- Live Activity Indicator -->
    <div v-if="showLiveIndicator && hasActiveParticipants" class="flex items-center space-x-1">
      <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      <span class="text-xs text-gray-500 dark:text-gray-400">Live</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CollaborationParticipant } from '~/types'

interface Props {
  participants: CollaborationParticipant[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
  maxVisible?: number
  showCursors?: boolean
  showLiveIndicator?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  maxVisible: 5,
  showCursors: true,
  showLiveIndicator: true
})

const visibleParticipants = computed(() => {
  return props.participants
    .slice(0, props.maxVisible)
    .sort((a, b) => {
      // Sort active participants first
      if (a.isActive && !b.isActive) return -1
      if (!a.isActive && b.isActive) return 1
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    })
})

const hasActiveParticipants = computed(() => {
  return props.participants.some(p => p.isActive)
})

const getUserColor = (userId: string): string => {
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
  
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return colors[Math.abs(hash) % colors.length]
}
</script>