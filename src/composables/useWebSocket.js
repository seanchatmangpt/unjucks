/**
 * @typedef {Object} WebSocketMessage
 * @property {string} type - Message type
 * @property {any} data - Message data
 * @property {string} [id] - Message ID
 * @property {number} [timestamp] - Message timestamp
 */

/**
 * @typedef {Object} WebSocketOptions
 * @property {number} [reconnectDelay=3000] - Reconnection delay in ms
 * @property {number} [maxReconnectAttempts=5] - Maximum reconnection attempts
 * @property {boolean} [autoReconnect=true] - Enable automatic reconnection
 * @property {string[]} [protocols] - WebSocket protocols
 */

/**
 * WebSocket composable
 * @param {string} url - WebSocket URL
 * @param {WebSocketOptions} [options={}] - WebSocket options
 * @returns {Object} WebSocket methods and state
 */
export const useWebSocket = (url, options = {}) => {
  const {
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    autoReconnect = true,
    protocols = []
  } = options

  /** @type {import('vue').Ref<WebSocket | null>} */
  const socket = ref(null)
  /** @type {import('vue').Ref<'connecting' | 'open' | 'closing' | 'closed'>} */
  const status = ref('closed')
  /** @type {import('vue').Ref<number>} */
  const reconnectAttempts = ref(0)
  /** @type {import('vue').Ref<WebSocketMessage[]>} */
  const messageHistory = ref([])
  /** @type {import('vue').Ref<string | null>} */
  const lastError = ref(null)

  /** @type {Map<string, Function[]>} */
  const eventListeners = new Map()

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  const on = (event, callback) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, [])
    }
    eventListeners.get(event)?.push(callback)
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  const off = (event, callback) => {
    const listeners = eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  const emit = (event, data) => {
    const listeners = eventListeners.get(event) || []
    listeners.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in WebSocket event listener for ${event}:`, error)
      }
    })
  }

  /**
   * Connect to WebSocket
   */
  const connect = () => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      status.value = 'connecting'
      lastError.value = null

      socket.value = new WebSocket(url, protocols)

      socket.value.onopen = (event) => {
        status.value = 'open'
        reconnectAttempts.value = 0
        emit('open', event)
        console.log(`WebSocket connected to ${url}`)
      }

      socket.value.onclose = (event) => {
        status.value = 'closed'
        emit('close', event)
        console.log(`WebSocket disconnected from ${url}`)

        // Auto-reconnect if enabled and not a clean close
        if (autoReconnect && !event.wasClean && reconnectAttempts.value < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.value++
            console.log(`Attempting to reconnect (${reconnectAttempts.value}/${maxReconnectAttempts})`)
            connect()
          }, reconnectDelay)
        }
      }

      socket.value.onerror = (error) => {
        lastError.value = 'WebSocket connection error'
        emit('error', error)
        console.error('WebSocket error:', error)
      }

      socket.value.onmessage = (event) => {
        try {
          /** @type {WebSocketMessage} */
          const message = JSON.parse(event.data)
          message.timestamp = Date.now()
          
          messageHistory.value.push(message)
          
          // Keep only last 100 messages
          if (messageHistory.value.length > 100) {
            messageHistory.value = messageHistory.value.slice(-100)
          }

          emit('message', message)
          
          // Emit specific message type events
          if (message.type) {
            emit(message.type, message.data)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          emit('parse-error', { error, rawData: event.data })
        }
      }
    } catch (error) {
      lastError.value = 'Failed to create WebSocket connection'
      console.error('Error creating WebSocket:', error)
    }
  }

  /**
   * Disconnect from WebSocket
   * @param {number} [code=1000] - Close code
   * @param {string} [reason=''] - Close reason
   */
  const disconnect = (code = 1000, reason = '') => {
    if (socket.value) {
      status.value = 'closing'
      socket.value.close(code, reason)
    }
  }

  /**
   * Send message through WebSocket
   * @param {WebSocketMessage | string | Object} message - Message to send
   * @returns {boolean} Whether message was sent successfully
   */
  const send = (message) => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      try {
        let messageToSend

        if (typeof message === 'string') {
          messageToSend = message
        } else if (typeof message === 'object') {
          // Add timestamp and ID if not provided
          const messageObj = {
            timestamp: Date.now(),
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...message
          }
          messageToSend = JSON.stringify(messageObj)
        } else {
          messageToSend = String(message)
        }

        socket.value.send(messageToSend)
        emit('sent', messageToSend)
        return true
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
        lastError.value = 'Failed to send message'
        return false
      }
    } else {
      console.warn('WebSocket is not connected')
      lastError.value = 'WebSocket is not connected'
      return false
    }
  }

  /**
   * Send typed message
   * @param {string} type - Message type
   * @param {any} data - Message data
   * @returns {boolean} Whether message was sent successfully
   */
  const sendMessage = (type, data) => {
    return send({ type, data })
  }

  /**
   * Clear message history
   */
  const clearHistory = () => {
    messageHistory.value = []
  }

  /**
   * Get connection state
   * @returns {boolean} Whether WebSocket is connected
   */
  const isConnected = computed(() => status.value === 'open')

  /**
   * Get connection state
   * @returns {boolean} Whether WebSocket is connecting
   */
  const isConnecting = computed(() => status.value === 'connecting')

  /**
   * Ping server
   * @returns {Promise<boolean>} Whether ping was successful
   */
  const ping = async () => {
    if (!isConnected.value) {
      return false
    }

    return new Promise((resolve) => {
      const pingId = `ping_${Date.now()}`
      
      const onPong = (data) => {
        if (data?.id === pingId) {
          off('pong', onPong)
          resolve(true)
        }
      }

      on('pong', onPong)
      
      send({ type: 'ping', id: pingId })

      // Timeout after 5 seconds
      setTimeout(() => {
        off('pong', onPong)
        resolve(false)
      }, 5000)
    })
  }

  // Auto-connect if URL is provided
  if (url) {
    connect()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
    eventListeners.clear()
  })

  return {
    socket: readonly(socket),
    status: readonly(status),
    messageHistory: readonly(messageHistory),
    lastError: readonly(lastError),
    reconnectAttempts: readonly(reconnectAttempts),
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send,
    sendMessage,
    clearHistory,
    ping,
    on,
    off
  }
}