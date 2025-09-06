<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          MCP Swarm Orchestrator
        </h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          End-to-end distributed agent management for enterprise template generation
        </p>
      </div>

      <!-- Swarm Controls -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Swarm Control Center</h2>
            <UBadge v-if="currentSwarm" :color="swarmStatusColor">
              {{ currentSwarm.status }}
            </UBadge>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Initialize Swarm -->
          <div>
            <label class="block text-sm font-medium mb-2">Topology</label>
            <USelectMenu
              v-model="selectedTopology"
              :options="topologyOptions"
              placeholder="Select topology"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Agent Count</label>
            <UInput
              v-model.number="agentCount"
              type="number"
              min="1"
              max="20"
              placeholder="Number of agents"
            />
          </div>

          <div class="flex items-end">
            <UButton
              @click="initializeSwarm"
              :loading="initializing"
              :disabled="!!currentSwarm"
              color="primary"
              block
            >
              Initialize Swarm
            </UButton>
          </div>
        </div>

        <!-- Active Swarm Info -->
        <div v-if="currentSwarm" class="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Swarm ID:</span>
              <p class="font-mono text-xs mt-1">{{ currentSwarm.id }}</p>
            </div>
            <div>
              <span class="text-gray-500">Topology:</span>
              <p class="font-semibold mt-1">{{ currentSwarm.topology }}</p>
            </div>
            <div>
              <span class="text-gray-500">Total Agents:</span>
              <p class="font-semibold mt-1">{{ currentSwarm.agents.length }}</p>
            </div>
            <div>
              <span class="text-gray-500">Active Tasks:</span>
              <p class="font-semibold mt-1">{{ activeTasks }}</p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Swarm Visualization -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Agent Network -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Agent Network</h3>
          </template>
          
          <div class="h-64 relative">
            <svg class="w-full h-full" v-if="currentSwarm">
              <!-- Draw connections -->
              <line
                v-for="connection in visualConnections"
                :key="connection.id"
                :x1="connection.x1"
                :y1="connection.y1"
                :x2="connection.x2"
                :y2="connection.y2"
                stroke="currentColor"
                stroke-width="1"
                class="text-gray-300 dark:text-gray-600"
              />
              
              <!-- Draw agents -->
              <g v-for="agent in visualAgents" :key="agent.id">
                <circle
                  :cx="agent.x"
                  :cy="agent.y"
                  r="20"
                  :fill="getAgentColor(agent)"
                  class="transition-all duration-300"
                />
                <text
                  :x="agent.x"
                  :y="agent.y + 5"
                  text-anchor="middle"
                  class="text-xs font-semibold fill-white"
                >
                  {{ agent.type[0].toUpperCase() }}
                </text>
              </g>
            </svg>
            
            <div v-else class="flex items-center justify-center h-full text-gray-400">
              No swarm initialized
            </div>
          </div>
          
          <!-- Legend -->
          <div class="mt-4 flex flex-wrap gap-3 text-xs">
            <div v-for="type in agentTypes" :key="type" class="flex items-center gap-1">
              <div :class="`w-3 h-3 rounded-full bg-${getTypeColor(type)}-500`"></div>
              <span class="capitalize">{{ type }}</span>
            </div>
          </div>
        </UCard>

        <!-- Task Pipeline -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">E2E Task Pipeline</h3>
          </template>
          
          <div class="space-y-3">
            <div class="flex items-center justify-between mb-4">
              <USelectMenu
                v-model="selectedTaskType"
                :options="taskTypes"
                placeholder="Select task type"
                class="w-48"
              />
              <UButton
                @click="executeE2ETask"
                :loading="executing"
                :disabled="!currentSwarm"
                size="sm"
                color="green"
              >
                Execute Pipeline
              </UButton>
            </div>
            
            <!-- Pipeline stages -->
            <div v-if="pipelineStages.length > 0" class="space-y-2">
              <div
                v-for="(stage, index) in pipelineStages"
                :key="index"
                class="flex items-center gap-3"
              >
                <div class="flex-shrink-0">
                  <UIcon
                    :name="getStageIcon(stage.status)"
                    :class="getStageIconClass(stage.status)"
                    class="w-5 h-5"
                  />
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium">{{ stage.name }}</span>
                    <UBadge :color="getStageColor(stage.status)" variant="subtle">
                      {{ stage.status }}
                    </UBadge>
                  </div>
                  <div v-if="stage.agent" class="text-xs text-gray-500 mt-1">
                    Assigned to: {{ stage.agent }}
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="text-center py-8 text-gray-400">
              No pipeline active
            </div>
          </div>
        </UCard>
      </div>

      <!-- Agent Status Grid -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Agent Status</h3>
            <div class="flex gap-2">
              <UButton
                @click="scaleSwarm('up')"
                :disabled="!currentSwarm"
                size="xs"
                variant="soft"
              >
                Scale Up
              </UButton>
              <UButton
                @click="scaleSwarm('down')"
                :disabled="!currentSwarm || currentSwarm.agents.length <= 1"
                size="xs"
                variant="soft"
                color="orange"
              >
                Scale Down
              </UButton>
              <UButton
                @click="terminateSwarm"
                :disabled="!currentSwarm"
                size="xs"
                variant="soft"
                color="red"
              >
                Terminate
              </UButton>
            </div>
          </div>
        </template>
        
        <div v-if="currentSwarm && currentSwarm.agents.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="agent in currentSwarm.agents"
            :key="agent.id"
            class="p-4 border rounded-lg"
            :class="getAgentCardClass(agent.status)"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="font-semibold text-sm">{{ agent.name }}</span>
              <UBadge :color="getAgentStatusColor(agent.status)" size="xs">
                {{ agent.status }}
              </UBadge>
            </div>
            
            <div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Type: <span class="font-medium">{{ agent.type }}</span></div>
              <div>Tasks: <span class="font-medium">{{ agent.metrics?.tasksCompleted || 0 }}</span></div>
              <div>Success: <span class="font-medium">{{ ((agent.metrics?.successRate || 0) * 100).toFixed(0) }}%</span></div>
            </div>
            
            <div v-if="agent.currentTask" class="mt-2 pt-2 border-t text-xs">
              <span class="text-gray-500">Current:</span>
              <p class="font-medium truncate">{{ agent.currentTask }}</p>
            </div>
          </div>
        </div>
        
        <div v-else class="text-center py-8 text-gray-400">
          No agents in swarm
        </div>
      </UCard>

      <!-- Real-time Logs -->
      <UCard class="mt-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Real-time Logs</h3>
            <UButton @click="clearLogs" size="xs" variant="ghost">
              Clear
            </UButton>
          </div>
        </template>
        
        <div class="h-48 overflow-y-auto font-mono text-xs space-y-1 p-3 bg-gray-900 rounded">
          <div
            v-for="(log, index) in logs"
            :key="index"
            :class="getLogClass(log.type)"
          >
            <span class="text-gray-500">{{ log.timestamp }}</span>
            <span class="ml-2">{{ log.message }}</span>
          </div>
          <div v-if="logs.length === 0" class="text-gray-500">
            Waiting for swarm activity...
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// State
const currentSwarm = ref<any>(null)
const selectedTopology = ref('mesh')
const agentCount = ref(5)
const selectedTaskType = ref('template-generation')
const initializing = ref(false)
const executing = ref(false)
const logs = ref<Array<{ timestamp: string; type: string; message: string }>>([])
const pipelineStages = ref<Array<{ name: string; status: string; agent?: string }>>([])
const visualAgents = ref<any[]>([])
const visualConnections = ref<any[]>([])
const ws = ref<WebSocket | null>(null)

// Options
const topologyOptions = ['hierarchical', 'mesh', 'ring', 'star']
const taskTypes = ['template-generation', 'marketplace-integration', 'enterprise-auth']
const agentTypes = ['researcher', 'architect', 'coder', 'tester', 'reviewer', 'deployer']

// Computed
const activeTasks = computed(() => {
  if (!currentSwarm.value) return 0
  return currentSwarm.value.agents.filter((a: any) => a.status === 'busy').length
})

const swarmStatusColor = computed(() => {
  if (!currentSwarm.value) return 'gray'
  if (activeTasks.value > 0) return 'green'
  return 'blue'
})

// Methods
async function initializeSwarm() {
  initializing.value = true
  addLog('info', `Initializing ${selectedTopology.value} swarm with ${agentCount.value} agents...`)
  
  try {
    const response = await $fetch('/api/mcp/swarm', {
      method: 'POST',
      body: {
        action: 'initialize',
        topology: selectedTopology.value,
        agentCount: agentCount.value
      }
    })
    
    if (response.success) {
      currentSwarm.value = {
        id: response.swarmId,
        topology: response.topology,
        agents: response.agents,
        status: 'active'
      }
      
      visualizeSwarm()
      addLog('success', `Swarm ${response.swarmId} initialized successfully`)
      connectWebSocket(response.swarmId)
    }
  } catch (error) {
    addLog('error', `Failed to initialize swarm: ${error}`)
  } finally {
    initializing.value = false
  }
}

async function executeE2ETask() {
  if (!currentSwarm.value) return
  
  executing.value = true
  addLog('info', `Executing ${selectedTaskType.value} pipeline...`)
  
  // Reset pipeline stages
  pipelineStages.value = getPipelineStages(selectedTaskType.value)
  
  try {
    const response = await $fetch('/api/mcp/swarm', {
      method: 'POST',
      body: {
        action: 'execute',
        swarmId: currentSwarm.value.id,
        task: {
          type: selectedTaskType.value,
          payload: {
            template: 'enterprise-microservice',
            variables: { name: 'UserService' }
          }
        }
      }
    })
    
    if (response.success) {
      addLog('success', 'E2E pipeline completed successfully')
      updatePipelineResults(response.results)
    }
  } catch (error) {
    addLog('error', `Pipeline execution failed: ${error}`)
  } finally {
    executing.value = false
  }
}

async function scaleSwarm(direction: 'up' | 'down') {
  if (!currentSwarm.value) return
  
  const targetCount = direction === 'up' 
    ? currentSwarm.value.agents.length + 1
    : currentSwarm.value.agents.length - 1
  
  addLog('info', `Scaling swarm ${direction} to ${targetCount} agents...`)
  
  try {
    const response = await $fetch('/api/mcp/swarm', {
      method: 'POST',
      body: {
        action: 'scale',
        swarmId: currentSwarm.value.id,
        targetAgents: targetCount
      }
    })
    
    if (response.success) {
      await refreshSwarmStatus()
      addLog('success', `Swarm scaled to ${targetCount} agents`)
    }
  } catch (error) {
    addLog('error', `Failed to scale swarm: ${error}`)
  }
}

async function terminateSwarm() {
  if (!currentSwarm.value) return
  
  addLog('info', 'Terminating swarm...')
  
  try {
    const response = await $fetch('/api/mcp/swarm', {
      method: 'POST',
      body: {
        action: 'terminate',
        swarmId: currentSwarm.value.id
      }
    })
    
    if (response.success) {
      currentSwarm.value = null
      pipelineStages.value = []
      visualAgents.value = []
      visualConnections.value = []
      addLog('success', 'Swarm terminated')
      disconnectWebSocket()
    }
  } catch (error) {
    addLog('error', `Failed to terminate swarm: ${error}`)
  }
}

async function refreshSwarmStatus() {
  if (!currentSwarm.value) return
  
  try {
    const response = await $fetch('/api/mcp/swarm', {
      method: 'POST',
      body: {
        action: 'status',
        swarmId: currentSwarm.value.id
      }
    })
    
    if (response.success) {
      currentSwarm.value.agents = response.agents
      visualizeSwarm()
    }
  } catch (error) {
    console.error('Failed to refresh swarm status:', error)
  }
}

function connectWebSocket(swarmId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/api/mcp/ws`
  
  ws.value = new WebSocket(wsUrl)
  
  ws.value.onopen = () => {
    // Authenticate and join swarm
    ws.value?.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'auth.login',
      params: {
        token: 'demo-token',
        swarmId,
        agentId: 'ui-client'
      }
    }))
  }
  
  ws.value.onmessage = (event) => {
    const message = JSON.parse(event.data)
    handleWebSocketMessage(message)
  }
  
  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
}

function disconnectWebSocket() {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
}

function handleWebSocketMessage(message: any) {
  if (message.method) {
    switch (message.method) {
      case 'agent.status_update':
        updateAgentStatus(message.params)
        break
      case 'task.completed':
        updateTaskStatus(message.params)
        break
      case 'swarm.message':
        addLog('info', `[${message.params.from}] ${message.params.message}`)
        break
    }
  }
}

function updateAgentStatus(params: any) {
  if (!currentSwarm.value) return
  
  const agent = currentSwarm.value.agents.find((a: any) => a.id === params.agentId)
  if (agent) {
    agent.status = params.status
    if (params.currentTask) {
      agent.currentTask = params.currentTask
    }
  }
}

function updateTaskStatus(params: any) {
  const stage = pipelineStages.value.find(s => s.name === params.stageName)
  if (stage) {
    stage.status = params.status
    stage.agent = params.agentName
  }
}

function visualizeSwarm() {
  if (!currentSwarm.value) return
  
  const width = 400
  const height = 256
  const centerX = width / 2
  const centerY = height / 2
  const radius = 80
  
  visualAgents.value = currentSwarm.value.agents.map((agent: any, index: number) => {
    const angle = (index * 2 * Math.PI) / currentSwarm.value.agents.length
    return {
      ...agent,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    }
  })
  
  // Create connections based on topology
  visualConnections.value = []
  if (currentSwarm.value.topology === 'mesh') {
    // Connect all to all
    for (let i = 0; i < visualAgents.value.length; i++) {
      for (let j = i + 1; j < visualAgents.value.length; j++) {
        visualConnections.value.push({
          id: `${i}-${j}`,
          x1: visualAgents.value[i].x,
          y1: visualAgents.value[i].y,
          x2: visualAgents.value[j].x,
          y2: visualAgents.value[j].y
        })
      }
    }
  }
}

function getPipelineStages(taskType: string) {
  const stages: Record<string, any[]> = {
    'template-generation': [
      { name: 'Research', status: 'pending' },
      { name: 'Architecture', status: 'pending' },
      { name: 'Implementation', status: 'pending' },
      { name: 'Testing', status: 'pending' },
      { name: 'Review', status: 'pending' }
    ],
    'marketplace-integration': [
      { name: 'Discovery', status: 'pending' },
      { name: 'Validation', status: 'pending' },
      { name: 'Integration', status: 'pending' },
      { name: 'Deployment', status: 'pending' }
    ],
    'enterprise-auth': [
      { name: 'Security Analysis', status: 'pending' },
      { name: 'Auth Design', status: 'pending' },
      { name: 'Implementation', status: 'pending' },
      { name: 'Security Testing', status: 'pending' }
    ]
  }
  
  return stages[taskType] || []
}

function updatePipelineResults(results: any[]) {
  results.forEach((result, index) => {
    if (pipelineStages.value[index]) {
      pipelineStages.value[index].status = 'completed'
      pipelineStages.value[index].agent = result.agent
    }
  })
}

function addLog(type: string, message: string) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
  logs.value.unshift({ timestamp, type, message })
  if (logs.value.length > 100) {
    logs.value.pop()
  }
}

function clearLogs() {
  logs.value = []
}

// Helper functions for styling
function getAgentColor(agent: any) {
  const colors: Record<string, string> = {
    researcher: '#3B82F6',
    architect: '#8B5CF6',
    coder: '#10B981',
    tester: '#F59E0B',
    reviewer: '#EF4444',
    deployer: '#6B7280'
  }
  return colors[agent.type] || '#6B7280'
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    researcher: 'blue',
    architect: 'purple',
    coder: 'green',
    tester: 'amber',
    reviewer: 'red',
    deployer: 'gray'
  }
  return colors[type] || 'gray'
}

function getAgentStatusColor(status: string) {
  const colors: Record<string, string> = {
    idle: 'gray',
    busy: 'green',
    error: 'red',
    offline: 'orange'
  }
  return colors[status] || 'gray'
}

function getAgentCardClass(status: string) {
  const classes: Record<string, string> = {
    idle: 'border-gray-200 dark:border-gray-700',
    busy: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20',
    error: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
    offline: 'border-orange-300 dark:border-orange-700 opacity-50'
  }
  return classes[status] || ''
}

function getStageIcon(status: string) {
  const icons: Record<string, string> = {
    pending: 'i-heroicons-clock',
    in_progress: 'i-heroicons-arrow-path',
    completed: 'i-heroicons-check-circle',
    failed: 'i-heroicons-x-circle'
  }
  return icons[status] || 'i-heroicons-question-mark-circle'
}

function getStageIconClass(status: string) {
  const classes: Record<string, string> = {
    pending: 'text-gray-400',
    in_progress: 'text-blue-500 animate-spin',
    completed: 'text-green-500',
    failed: 'text-red-500'
  }
  return classes[status] || 'text-gray-400'
}

function getStageColor(status: string) {
  const colors: Record<string, string> = {
    pending: 'gray',
    in_progress: 'blue',
    completed: 'green',
    failed: 'red'
  }
  return colors[status] || 'gray'
}

function getLogClass(type: string) {
  const classes: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400'
  }
  return classes[type] || 'text-gray-400'
}

// Lifecycle
onMounted(() => {
  addLog('info', 'MCP Swarm Orchestrator initialized')
})

onUnmounted(() => {
  disconnectWebSocket()
})
</script>