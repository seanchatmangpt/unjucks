<template>
  <div class="absolute inset-0 pointer-events-none z-50">
    <!-- Remote Cursors -->
    <div
      v-for="participant in participantsWithCursors"
      :key="participant.userId"
      :style="{
        left: `${participant.cursor.column * 8}px`,
        top: `${participant.cursor.line * 20}px`
      }"
      class="absolute transition-all duration-150"
    >
      <!-- Cursor Line -->
      <div
        class="w-0.5 h-5 rounded-sm"
        :style="{ backgroundColor: getUserColor(participant.userId) }"
      />
      
      <!-- User Label -->
      <div
        class="absolute -top-6 left-0 px-2 py-1 text-xs text-white rounded shadow-lg whitespace-nowrap"
        :style="{ backgroundColor: getUserColor(participant.userId) }"
      >
        {{ participant.user.name }}
      </div>
    </div>

    <!-- Text Selections -->
    <div
      v-for="participant in participantsWithSelections"
      :key="`selection-${participant.userId}`"
      class="absolute"
      :style="{
        left: `${participant.selection.start.column * 8}px`,
        top: `${participant.selection.start.line * 20}px`,
        width: `${(participant.selection.end.column - participant.selection.start.column) * 8}px`,
        height: `${(participant.selection.end.line - participant.selection.start.line + 1) * 20}px`
      }"
    >
      <div
        class="w-full h-full rounded opacity-25"
        :style="{ backgroundColor: getUserColor(participant.userId) }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CollaborationParticipant } from '~/types'

interface Props {
  participants: CollaborationParticipant[]
}

const props = defineProps<Props>()

const participantsWithCursors = computed(() => {
  return props.participants.filter(p => p.cursor && p.isActive)
})

const participantsWithSelections = computed(() => {
  return props.participants.filter(p => p.selection && p.isActive)
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