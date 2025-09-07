import { defineStore } from 'pinia'

export const useTestStore = defineStore('test', () => {
  // State
  const counter = ref(0)
  const isWorking = ref(true)
  const messages = ref<string[]>([])
  
  // Getters
  const doubleCounter = computed(() => counter.value * 2)
  const messageCount = computed(() => messages.value.length)
  
  // Actions
  function increment() {
    counter.value++
    addMessage(`Counter incremented to ${counter.value}`)
  }
  
  function decrement() {
    counter.value--
    addMessage(`Counter decremented to ${counter.value}`)
  }
  
  function reset() {
    counter.value = 0
    messages.value = []
    addMessage('Store reset')
  }
  
  function addMessage(message: string) {
    messages.value.push(`[${new Date().toLocaleTimeString()}] ${message}`)
    
    // Keep only last 10 messages
    if (messages.value.length > 10) {
      messages.value = messages.value.slice(-10)
    }
  }
  
  // Initialize
  addMessage('Test store initialized')
  
  return {
    counter,
    isWorking,
    messages,
    doubleCounter,
    messageCount,
    increment,
    decrement,
    reset,
    addMessage
  }
})