<script setup lang="ts">
{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  interview?: InterviewSession
  simulator?: AISimulator
  {% if apiIntegration %}apiEndpoint?: string{% endif %}
  {% if componentDescription %}// {{ componentDescription }}{% endif %}
}

const props = withDefaults(defineProps<{{ componentName | pascalCase }}Props>(), {
  {% if apiIntegration %}apiEndpoint: '/api/interviews'{% endif %}
})
{% endif %}

{% if withEmits %}
interface {{ componentName | pascalCase }}Emits {
  start: [interview: InterviewSession]
  complete: [result: InterviewResult]
  feedback: [feedback: AIFeedback]
  error: [error: Error]
}

const emit = defineEmits<{{ componentName | pascalCase }}Emits>()
{% endif %}

// Reactive state
const isSimulating = ref(false)
const currentQuestion = ref<InterviewQuestion | null>(null)
const userResponse = ref('')
const sessionResults = ref<InterviewResult[]>([])

{% if apiIntegration %}
// API integration
const { $fetch } = useNuxtApp()

const startInterview = async () => {
  try {
    isSimulating.value = true
    const session = await $fetch<InterviewSession>(props.apiEndpoint, {
      method: 'POST',
      body: { type: 'simulation' }
    })
    {% if withEmits %}emit('start', session){% endif %}
  } catch (error) {
    {% if withEmits %}emit('error', error as Error){% endif %}
    console.error('Failed to start interview:', error)
  }
}

const submitResponse = async (response: string) => {
  try {
    const result = await $fetch<AIFeedback>(`${props.apiEndpoint}/feedback`, {
      method: 'POST', 
      body: { response, questionId: currentQuestion.value?.id }
    })
    {% if withEmits %}emit('feedback', result){% endif %}
  } catch (error) {
    {% if withEmits %}emit('error', error as Error){% endif %}
    console.error('Failed to submit response:', error)
  }
}
{% else %}
// Local simulation methods
const startInterview = () => {
  isSimulating.value = true
  {% if withEmits %}emit('start', { id: Date.now(), type: 'mock' }){% endif %}
}

const submitResponse = (response: string) => {
  // Process response locally
  {% if withEmits %}emit('feedback', { score: 85, suggestions: ['Good answer!'] }){% endif %}
}
{% endif %}

// Computed properties
const simulationStatus = computed(() => {
  return isSimulating.value ? 'active' : 'idle'
})

// Lifecycle hooks
onMounted(() => {
  console.log('{{ componentName | pascalCase }} mounted')
})

// TypeScript interfaces (would typically be in separate types file)
interface InterviewSession {
  id: number
  type: string
  questions?: InterviewQuestion[]
}

interface InterviewQuestion {
  id: number
  text: string
  difficulty: 'easy' | 'medium' | 'hard'
}

interface InterviewResult {
  score: number
  feedback: string[]
  suggestions: string[]
}

interface AISimulator {
  model: string
  temperature: number
}

interface AIFeedback {
  score: number
  suggestions: string[]
  strengths?: string[]
  improvements?: string[]
}
</script>

<template>
  <div class="{{ componentName | kebabCase }}">
    <div class="simulation-header">
      <h2 class="text-2xl font-bold">
        {{ componentName | titleCase }}
      </h2>
      <p class="text-gray-600">
        {% if componentDescription %}{{ componentDescription }}{% else %}AI-powered interview simulation{% endif %}
      </p>
    </div>

    <div class="simulation-content">
      <div v-if="!isSimulating" class="simulation-start">
        <UButton
          @click="startInterview"
          color="primary"
          size="lg"
        >
          Start Interview Simulation
        </UButton>
      </div>

      <div v-else class="simulation-active">
        <div class="question-panel">
          <h3 class="text-lg font-semibold mb-4">
            Interview Question
          </h3>
          <div v-if="currentQuestion" class="question-content">
            <p class="text-gray-800 mb-4">
              {{ currentQuestion.text }}
            </p>
            <UBadge :label="currentQuestion.difficulty" />
          </div>
        </div>

        <div class="response-panel">
          <UTextarea
            v-model="userResponse"
            placeholder="Type your response here..."
            :rows="6"
            class="mb-4"
          />
          <div class="response-actions">
            <UButton
              @click="submitResponse(userResponse)"
              :disabled="!userResponse.trim()"
            >
              Submit Response
            </UButton>
            <UButton
              variant="ghost"
              color="gray"
              @click="isSimulating = false"
            >
              End Session
            </UButton>
          </div>
        </div>
      </div>

      <div v-if="sessionResults.length" class="results-panel">
        <h3 class="text-lg font-semibold mb-4">
          Session Results
        </h3>
        <div class="results-grid">
          <div
            v-for="result in sessionResults"
            :key="result.score"
            class="result-card p-4 border rounded-lg"
          >
            <div class="score-display">
              <span class="text-2xl font-bold">{{ result.score }}</span>
              <span class="text-gray-500">/100</span>
            </div>
            <ul class="feedback-list mt-2">
              <li
                v-for="feedback in result.feedback"
                :key="feedback"
                class="text-sm text-gray-700"
              >
                {{ feedback }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.{{ componentName | kebabCase }} {
  @apply max-w-4xl mx-auto p-6;
}

.simulation-header {
  @apply text-center mb-8;
}

.simulation-content {
  @apply space-y-6;
}

.simulation-start {
  @apply text-center;
}

.simulation-active {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
}

.question-panel,
.response-panel {
  @apply bg-white p-6 rounded-lg border shadow-sm;
}

.response-actions {
  @apply flex gap-2 justify-end;
}

.results-panel {
  @apply mt-8;
}

.results-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.result-card {
  @apply bg-gray-50;
}

.score-display {
  @apply text-center;
}

.feedback-list {
  @apply list-disc list-inside space-y-1;
}
</style>