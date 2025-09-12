/**
 * @typedef {Object} CollaborationParticipant
 * @property {string} userId - User ID
 * @property {Object} user - User object
 * @property {boolean} isActive - Whether user is active
 * @property {{line: number, column: number}} [cursor] - Cursor position
 * @property {{start: {line: number, column: number}, end: {line: number, column: number}}} [selection] - Text selection
 */

/**
 * @typedef {Object} CollaborationSession
 * @property {string} id - Session ID
 * @property {string} templateId - Template ID
 * @property {CollaborationParticipant[]} participants - Session participants
 * @property {Date} createdAt - Creation date
 * @property {Date} lastActivity - Last activity date
 */

/**
 * Real-time collaboration composable
 * @returns {Object} Real-time collaboration methods and state
 */
export const useRealTime = () => {
  const config = useRuntimeConfig()
  const { user } = useAuth()
  
  const { 
    isConnected, 
    send, 
    on, 
    off 
  } = useWebSocket(config.public.wsUrl)

  /** @type {import('vue').Ref<CollaborationParticipant[]>} */
  const activeUsers = ref([])
  /** @type {import('vue').Ref<CollaborationSession | null>} */
  const currentSession = ref(null)

  /**
   * Join collaboration session
   * @param {string} sessionId - Session ID to join
   */
  const joinSession = (sessionId) => {
    if (!user.value) return

    send('join_session', {
      sessionId,
      userId: user.value.id,
      user: user.value
    })

    currentSession.value = {
      id: sessionId,
      templateId: '',
      participants: [],
      createdAt: this.getDeterministicDate(),
      lastActivity: this.getDeterministicDate()
    }
  }

  /**
   * Leave current collaboration session
   */
  const leaveSession = () => {
    if (!currentSession.value) return

    send('leave_session', {
      sessionId: currentSession.value.id,
      userId: user.value?.id
    })

    currentSession.value = null
    activeUsers.value = []
  }

  /**
   * Update cursor position
   * @param {number} line - Line number
   * @param {number} column - Column number
   */
  const updateCursor = (line, column) => {
    if (!currentSession.value || !user.value) return

    send('cursor_update', {
      sessionId: currentSession.value.id,
      userId: user.value.id,
      cursor: { line, column }
    })
  }

  /**
   * Update text selection
   * @param {{line: number, column: number}} start - Selection start
   * @param {{line: number, column: number}} end - Selection end
   */
  const updateSelection = (start, end) => {
    if (!currentSession.value || !user.value) return

    send('selection_update', {
      sessionId: currentSession.value.id,
      userId: user.value.id,
      selection: { start, end }
    })
  }

  /**
   * Send text change event
   * @param {any} changes - Text changes
   */
  const sendTextChange = (changes) => {
    if (!currentSession.value || !user.value) return

    send('text_change', {
      sessionId: currentSession.value.id,
      userId: user.value.id,
      changes
    })
  }

  // Event handlers
  on('user_joined', (data) => {
    const existingIndex = activeUsers.value.findIndex(u => u.userId === data.userId)
    if (existingIndex >= 0) {
      activeUsers.value[existingIndex] = data
    } else {
      activeUsers.value.push(data)
    }
  })

  on('user_left', (data) => {
    activeUsers.value = activeUsers.value.filter(u => u.userId !== data.userId)
  })

  on('cursor_updated', (data) => {
    const user = activeUsers.value.find(u => u.userId === data.userId)
    if (user) {
      user.cursor = data.cursor
    }
  })

  on('selection_updated', (data) => {
    const user = activeUsers.value.find(u => u.userId === data.userId)
    if (user) {
      user.selection = data.selection
    }
  })

  /**
   * Get presence indicators for UI
   */
  const presenceIndicators = computed(() => {
    return activeUsers.value.map(participant => ({
      userId: participant.userId,
      user: participant.user,
      isActive: participant.isActive,
      cursor: participant.cursor,
      selection: participant.selection,
      color: getUserColor(participant.userId)
    }))
  })

  /**
   * Get consistent color for user
   * @param {string} userId - User ID
   * @returns {string} User color
   */
  const getUserColor = (userId) => {
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

  onUnmounted(() => {
    leaveSession()
    off('user_joined')
    off('user_left')
    off('cursor_updated')
    off('selection_updated')
  })

  return {
    isConnected,
    activeUsers: readonly(activeUsers),
    currentSession: readonly(currentSession),
    presenceIndicators: readonly(presenceIndicators),
    joinSession,
    leaveSession,
    updateCursor,
    updateSelection,
    sendTextChange,
    getUserColor
  }
}