// @ts-nocheck
interface WebSocketMessage {
  type: string
  payload: any
  timestamp: Date
}

interface WebSocketOptions {
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export const useWebSocket = (url: string, options: WebSocketOptions = {}) => {
  const {
    reconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options

  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref<string | null>(null)
  const reconnectAttempts = ref(0)

  const messageHandlers = new Map<string, (payload: any) => void>()
  const messageQueue = ref<WebSocketMessage[]>([])

  const connect = () => {
    if (socket.value?.readyState === WebSocket.OPEN) return

    isConnecting.value = true
    error.value = null

    try {
      socket.value = new WebSocket(url)

      socket.value.onopen = () => {
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts.value = 0
        
        // Send queued messages
        while (messageQueue.value.length > 0) {
          const message = messageQueue.value.shift()
          if (message) {
            socket.value?.send(JSON.stringify(message))
          }
        }
      }

      socket.value.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          const handler = messageHandlers.get(message.type)
          if (handler) {
            handler(message.payload)
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      socket.value.onclose = () => {
        isConnected.value = false
        isConnecting.value = false

        if (reconnect && reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          setTimeout(connect, reconnectInterval)
        }
      }

      socket.value.onerror = (event) => {
        error.value = 'WebSocket connection failed'
        isConnecting.value = false
      }
    } catch (err) {
      error.value = 'Failed to create WebSocket connection'
      isConnecting.value = false
    }
  }

  const disconnect = () => {
    if (socket.value) {
      socket.value.close()
      socket.value = null
    }
    isConnected.value = false
    isConnecting.value = false
  }

  const send = (type: string, payload: any) => {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date()
    }

    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(message))
    } else {
      messageQueue.value.push(message)
    }
  }

  const on = (type: string, handler: (payload: any) => void) => {
    messageHandlers.set(type, handler)
  }

  const off = (type: string) => {
    messageHandlers.delete(type)
  }

  // Auto-connect on mount
  onMounted(connect)
  
  // Cleanup on unmount
  onUnmounted(disconnect)

  return {
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    error: readonly(error),
    connect,
    disconnect,
    send,
    on,
    off
  }
}