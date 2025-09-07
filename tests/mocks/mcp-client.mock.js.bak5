/**
 * Mock MCP Client for testing MCP tool integrations
 * Provides realistic mock responses and call tracking
 */

/**
 * @typedef {Object} MCPCall
 * @property {string} toolName
 * @property {any} params
 * @property {any} result
 * @property {Date} timestamp
 * @property {boolean} called
 */

/**
 * @typedef {Object} MCPResponse
 * @property {boolean} success
 * @property {any} data
 * @property {string} error
 * @property {any} metadata
 */

export class MockMCPClient {
  constructor() {
    /** @type {Map<string, MCPCall[]>} */
    this.calls = new Map();
    /** @type {Map<string, MCPResponse>} */
    this.responses = new Map();
    /** @type {boolean} */
    this.available = false;
  }

  async initialize() {
    this.available = true;
    this.setupDefaultResponses();
  }

  /**
   * @param {boolean} available
   */
  setAvailable(available) {
    this.available = available;
  }

  /**
   * @returns {boolean}
   */
  isAvailable() {
    return this.available;
  }

  reset() {
    this.calls.clear();
    this.responses.clear();
    this.setupDefaultResponses();
  }

  /**
   * @param {string} toolName
   * @param {MCPResponse} response
   */
  mockResponse(toolName, response) {
    this.responses.set(toolName, response);
  }

  setupDefaultResponses() {
    // Swarm initialization responses
    this.mockResponse('swarm_init', {
      success: true,
      data: {
        swarmId: 'swarm-001',
        topology: 'mesh',
        agents: 5,
        status: 'initialized',
        created: new Date().toISOString()
      }
    });

    this.mockResponse('agent_spawn', {
      success: true,
      data: {
        agentId: `agent-${Date.now()}`,
        type: 'coder',
        status: 'active',
        capabilities: ['code-generation', 'testing', 'review'],
        spawned: new Date().toISOString()
      }
    });

    this.mockResponse('task_orchestrate', {
      success: true,
      data: {
        taskId: `task-${Date.now()}`,
        strategy: 'parallel',
        agentsAssigned: 3,
        estimatedDuration: '5 minutes',
        status: 'running'
      }
    });

    this.mockResponse('swarm_status', {
      success: true,
      data: {
        swarmId: 'swarm-001',
        status: 'active',
        agents: [
          { id: 'agent-001', type: 'coder', status: 'active', load: 0.6 },
          { id: 'agent-002', type: 'tester', status: 'active', load: 0.4 },
          { id: 'agent-003', type: 'reviewer', status: 'idle', load: 0.0 }
        ],
        metrics: {
          totalTasks: 15,
          completedTasks: 12,
          averageResponseTime: '2.3s',
          efficiency: 0.85
        }
      }
    });

    // Semantic validation responses
    this.mockResponse('semantic_validate', {
      success: true,
      data: {
        valid: true,
        format: 'turtle',
        triples: 156,
        classes: 8,
        properties: 12,
        warnings: [],
        errors: [],
        shaclResults: {
          conforms: true,
          validationReport: []
        }
      }
    });

    this.mockResponse('template_generate', {
      success: true,
      data: {
        templateId: `template-${Date.now()}`,
        filesGenerated: [
          'src/models/user.js',
          'src/models/user.test.js',
          'src/models/user.spec.js'
        ],
        semanticAnnotations: true,
        rdfCompatible: true
      }
    });

    this.mockResponse('ai_generate', {
      success: true,
      data: {
        enhanced: true,
        model: 'claude-3-sonnet',
        tokensUsed: 1250,
        generatedFiles: [
          'src/components/user-profile.jsx',
          'src/hooks/use-user.js',
          'src/types/user.types.js'
        ],
        aiFeatures: ['type-inference', 'best-practices', 'optimization']
      }
    });

    this.mockResponse('batch_process', {
      success: true,
      data: {
        batchId: `batch-${Date.now()}`,
        totalTemplates: 3,
        processedTemplates: 3,
        parallelExecution: true,
        executionTime: '1.8s',
        results: [
          { template: 'component.njk', status: 'success', files: ['component.js'] },
          { template: 'service.njk', status: 'success', files: ['service.js'] },
          { template: 'model.njk', status: 'success', files: ['model.js'] }
        ]
      }
    });

    this.mockResponse('swarm_restore', {
      success: true,
      data: {
        swarmId: 'imported-swarm-001',
        agentsRestored: 2,
        configurationApplied: true,
        status: 'active',
        restoredAt: new Date().toISOString()
      }
    });

    // Memory storage response
    this.mockResponse('memory_store', {
      success: true,
      data: {
        key: 'swarm/bdd/setup',
        namespace: 'unjucks-testing',
        stored: true,
        size: 432,
        timestamp: new Date().toISOString()
      }
    });

    // Error response for invalid RDF
    this.mockResponse('semantic_validate_error', {
      success: false,
      error: 'RDF syntax error',
      data: {
        valid: false,
        errors: [
          {
            line: 5,
            column: 25,
            message: 'Expected "." but found ";;"',
            severity: 'error'
          },
          {
            line: 7,
            column: 1,
            message: 'Missing rdf:type declaration',
            severity: 'warning'
          }
        ],
        warnings: [
          {
            line: 3,
            message: 'Missing namespace prefix declaration',
            severity: 'warning'
          }
        ]
      }
    });
  }

  /**
   * @param {string} toolName
   * @param {any} params
   * @returns {Promise<MCPResponse>}
   */
  async callTool(toolName, params = {}) {
    if (!this.available) {
      throw new Error('MCP tools are not available');
    }

    // Record the call
    const call = {
      toolName,
      params: { ...params },
      timestamp: new Date(),
      called: true
    };

    // Handle special cases for dynamic responses
    if (toolName === 'agent_spawn' && params.type) {
      const response = this.responses.get(toolName);
      if (response && response.success) {
        response.data = {
          ...response.data,
          agentId: `${params.type}-${Date.now()}`,
          type: params.type
        };
      }
      call.result = response ? response.data : null;
    } else if (toolName === 'semantic_validate' && params.file && params.file.includes('invalid')) {
      // Return error response for invalid files
      const errorResponse = this.responses.get('semantic_validate_error');
      call.result = errorResponse ? errorResponse.data : null;
      this.recordCall(toolName, call);
      return errorResponse || { success: false, error: 'Validation failed' };
    } else {
      const response = this.responses.get(toolName);
      call.result = response ? response.data : null;
    }

    this.recordCall(toolName, call);

    return this.responses.get(toolName) || { 
      success: false, 
      error: `No mock response defined for ${toolName}` 
    };
  }

  /**
   * @param {string} toolName
   * @param {MCPCall} call
   */
  recordCall(toolName, call) {
    if (!this.calls.has(toolName)) {
      this.calls.set(toolName, []);
    }
    this.calls.get(toolName).push(call);
  }

  /**
   * @param {string} toolName
   * @returns {MCPCall | undefined}
   */
  getLastCall(toolName) {
    const calls = this.calls.get(toolName);
    return calls && calls.length > 0 ? calls[calls.length - 1] : undefined;
  }

  /**
   * @param {string} toolName
   * @returns {MCPCall[]}
   */
  getAllCalls(toolName) {
    return this.calls.get(toolName) || [];
  }

  /**
   * @param {string} toolName
   * @returns {number}
   */
  getCallCount(toolName) {
    return this.calls.get(toolName)?.length || 0;
  }

  /**
   * @param {string} toolName
   * @returns {boolean}
   */
  hasBeenCalled(toolName) {
    return this.getCallCount(toolName) > 0;
  }

  /**
   * @returns {Map<string, MCPCall[]>}
   */
  getCallHistory() {
    return new Map(this.calls);
  }

  /**
   * Utility methods for test assertions
   * @param {string} toolName
   * @param {Partial<any>} expectedParams
   * @returns {boolean}
   */
  verifyCallMade(toolName, expectedParams) {
    const call = this.getLastCall(toolName);
    if (!call) return false;

    if (expectedParams) {
      return Object.keys(expectedParams).every(key => 
        call.params[key] === expectedParams[key]
      );
    }

    return true;
  }

  /**
   * @param {string[]} expectedSequence
   * @returns {boolean}
   */
  verifyCallSequence(expectedSequence) {
    /** @type {Array<{toolName: string, timestamp: Date}>} */
    const allCalls = [];
    
    for (const [toolName, calls] of this.calls.entries()) {
      calls.forEach(call => {
        allCalls.push({ toolName, timestamp: call.timestamp });
      });
    }

    // Sort by timestamp
    allCalls.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const actualSequence = allCalls.map(call => call.toolName);
    
    return expectedSequence.every((tool, index) => 
      actualSequence[index] === tool
    );
  }

  /**
   * Helper method for generating realistic agent IDs
   * @param {string} type
   * @returns {string}
   */
  generateAgentId(type) {
    return `${type}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method for generating realistic task IDs
   * @returns {string}
   */
  generateTaskId() {
    return `task-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method for generating realistic swarm IDs
   * @returns {string}
   */
  generateSwarmId() {
    return `swarm-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance for testing
export const mockMCPClient = new MockMCPClient();