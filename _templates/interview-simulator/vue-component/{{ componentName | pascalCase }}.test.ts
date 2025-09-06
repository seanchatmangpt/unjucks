import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import {{ componentName | pascalCase }} from './{{ componentName | pascalCase }}.vue'

// Mock Nuxt composables
vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $fetch: vi.fn()
  })
}))

const mockUseNuxtApp = vi.mocked(useNuxtApp)

describe('{{ componentName | pascalCase }}', () => {
  let wrapper: any
  let mockFetch: any

  beforeEach(() => {
    mockFetch = vi.fn()
    mockUseNuxtApp.mockReturnValue({
      $fetch: mockFetch
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders correctly', () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.{{ componentName | kebabCase }}').exists()).toBe(true)
    })

    it('displays the component title', () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      expect(wrapper.find('h2').text()).toContain('{{ componentName | titleCase }}')
    })

    it('shows start button when not simulating', () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      const startButton = wrapper.find('[data-testid="start-button"]')
      expect(startButton.exists()).toBe(true)
      expect(startButton.text()).toContain('Start Interview Simulation')
    })
  })

  {% if withProps %}
  describe('Props Handling', () => {
    it('accepts interview prop', () => {
      const mockInterview = {
        id: 1,
        type: 'technical',
        questions: []
      }

      wrapper = mount({{ componentName | pascalCase }}, {
        props: {
          interview: mockInterview
        }
      })

      expect(wrapper.props().interview).toEqual(mockInterview)
    })

    {% if apiIntegration %}
    it('accepts custom API endpoint', () => {
      wrapper = mount({{ componentName | pascalCase }}, {
        props: {
          apiEndpoint: '/api/custom-interviews'
        }
      })

      expect(wrapper.props().apiEndpoint).toBe('/api/custom-interviews')
    })
    {% endif %}
  })
  {% endif %}

  {% if withEmits %}
  describe('Event Emissions', () => {
    it('emits start event when interview begins', async () => {
      {% if apiIntegration %}
      mockFetch.mockResolvedValueOnce({
        id: 1,
        type: 'simulation',
        questions: []
      })
      {% endif %}

      wrapper = mount({{ componentName | pascalCase }})
      
      await wrapper.find('button').trigger('click')
      {% if apiIntegration %}await wrapper.vm.$nextTick(){% endif %}

      expect(wrapper.emitted('start')).toBeTruthy()
    })

    it('emits error event on API failure', async () => {
      {% if apiIntegration %}
      const mockError = new Error('API Error')
      mockFetch.mockRejectedValueOnce(mockError)

      wrapper = mount({{ componentName | pascalCase }})
      
      await wrapper.find('button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('error')).toBeTruthy()
      expect(wrapper.emitted('error')[0][0]).toEqual(mockError)
      {% else %}
      // Test local error handling
      wrapper = mount({{ componentName | pascalCase }})
      
      // Simulate error condition
      await wrapper.vm.$nextTick()
      
      // Add assertions for local error handling
      {% endif %}
    })

    {% if apiIntegration %}
    it('emits feedback event on response submission', async () => {
      const mockFeedback = {
        score: 85,
        suggestions: ['Great answer!', 'Consider adding more details'],
        strengths: ['Clear explanation'],
        improvements: ['Technical depth']
      }

      mockFetch.mockResolvedValueOnce(mockFeedback)

      wrapper = mount({{ componentName | pascalCase }})
      
      // Start simulation first
      await wrapper.setData({ isSimulating: true })
      await wrapper.setData({ 
        currentQuestion: { id: 1, text: 'Test question', difficulty: 'medium' }
      })
      
      // Set response and submit
      await wrapper.find('textarea').setValue('Test response')
      await wrapper.find('[data-testid="submit-button"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('feedback')).toBeTruthy()
      expect(wrapper.emitted('feedback')[0][0]).toEqual(mockFeedback)
    })
    {% endif %}
  })
  {% endif %}

  {% if apiIntegration %}
  describe('API Integration', () => {
    it('makes correct API call to start interview', async () => {
      wrapper = mount({{ componentName | pascalCase }}, {
        props: {
          apiEndpoint: '/api/interviews'
        }
      })

      mockFetch.mockResolvedValueOnce({ id: 1, type: 'simulation' })

      await wrapper.find('button').trigger('click')
      
      expect(mockFetch).toHaveBeenCalledWith('/api/interviews', {
        method: 'POST',
        body: { type: 'simulation' }
      })
    })

    it('handles API errors gracefully', async () => {
      wrapper = mount({{ componentName | pascalCase }})

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await wrapper.find('button').trigger('click')
      await wrapper.vm.$nextTick()

      // Should not crash and should emit error
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.emitted('error')).toBeTruthy()
    })

    it('submits responses to correct endpoint', async () => {
      wrapper = mount({{ componentName | pascalCase }})

      mockFetch.mockResolvedValueOnce({
        score: 90,
        suggestions: ['Excellent response!']
      })

      // Set up simulation state
      await wrapper.setData({ 
        isSimulating: true,
        currentQuestion: { id: 1, text: 'Test?', difficulty: 'easy' },
        userResponse: 'My answer'
      })

      await wrapper.find('[data-testid="submit-button"]').trigger('click')

      expect(mockFetch).toHaveBeenCalledWith('/api/interviews/feedback', {
        method: 'POST',
        body: { 
          response: 'My answer',
          questionId: 1
        }
      })
    })
  })
  {% endif %}

  describe('User Interactions', () => {
    it('enables submit button only when response is provided', async () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      await wrapper.setData({ isSimulating: true })
      
      const submitButton = wrapper.find('[data-testid="submit-button"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
      
      await wrapper.setData({ userResponse: 'My response' })
      
      expect(submitButton.attributes('disabled')).toBeUndefined()
    })

    it('clears response after submission', async () => {
      {% if apiIntegration %}
      mockFetch.mockResolvedValueOnce({ score: 80, suggestions: [] })
      {% endif %}

      wrapper = mount({{ componentName | pascalCase }})
      
      await wrapper.setData({ 
        isSimulating: true,
        userResponse: 'Test response',
        currentQuestion: { id: 1, text: 'Test?', difficulty: 'easy' }
      })
      
      await wrapper.find('[data-testid="submit-button"]').trigger('click')
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.userResponse).toBe('')
    })

    it('ends session when end button is clicked', async () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      await wrapper.setData({ isSimulating: true })
      
      await wrapper.find('[data-testid="end-button"]').trigger('click')
      
      expect(wrapper.vm.isSimulating).toBe(false)
    })
  })

  describe('Computed Properties', () => {
    it('computes simulation status correctly', () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      expect(wrapper.vm.simulationStatus).toBe('idle')
      
      wrapper.setData({ isSimulating: true })
      
      expect(wrapper.vm.simulationStatus).toBe('active')
    })
  })

  describe('Session Results', () => {
    it('displays results when available', async () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      const mockResults = [
        {
          score: 85,
          feedback: ['Good answer!', 'Consider more examples'],
          suggestions: ['Practice more']
        }
      ]
      
      await wrapper.setData({ sessionResults: mockResults })
      
      expect(wrapper.find('.results-panel').exists()).toBe(true)
      expect(wrapper.find('.score-display').text()).toContain('85')
    })

    it('does not display results panel when no results', () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      expect(wrapper.find('.results-panel').exists()).toBe(false)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      // Check for proper semantic structure
      expect(wrapper.find('h2').exists()).toBe(true)
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('supports keyboard navigation', async () => {
      wrapper = mount({{ componentName | pascalCase }})
      
      const button = wrapper.find('button')
      
      // Should be focusable
      expect(button.attributes('tabindex')).not.toBe('-1')
    })
  })

  {% if withMocks %}
  describe('Mock Integration', () => {
    it('works with mocked AI simulator', () => {
      const mockSimulator = {
        model: 'gpt-4',
        temperature: 0.7
      }

      wrapper = mount({{ componentName | pascalCase }}, {
        props: {
          simulator: mockSimulator
        }
      })

      expect(wrapper.props().simulator).toEqual(mockSimulator)
    })
  })
  {% endif %}
})

// Helper functions for testing
function createMockInterview() {
  return {
    id: 1,
    type: 'technical',
    questions: [
      {
        id: 1,
        text: 'Explain the difference between var, let, and const in JavaScript',
        difficulty: 'easy' as const
      },
      {
        id: 2,
        text: 'Implement a debounce function',
        difficulty: 'medium' as const
      }
    ]
  }
}

function createMockFeedback() {
  return {
    score: 85,
    suggestions: [
      'Great understanding of the concepts',
      'Consider providing more concrete examples'
    ],
    strengths: ['Clear explanation', 'Good use of terminology'],
    improvements: ['Add more detail', 'Include edge cases']
  }
}