/**
 * LaTeX MCP Server Integration
 * Integrates LaTeX tools with existing MCP server architecture
 */

import { LATEX_TOOL_DEFINITIONS, LATEX_TOOL_HANDLERS } from './tools/latex-tools.js';
import { LaTeXSwarmCoordinator } from './tools/latex-coordination.js';

/**
 * LaTeX MCP Server Integration Class
 */
export class LaTeXMCPIntegration {
  constructor(mcpServer, config = {}) {
    this.mcpServer = mcpServer;
    this.config = {
      enableSwarmCoordination: true,
      enableSemanticWeb: true,
      enableAIAssistance: true,
      debugMode: process.env.DEBUG_LATEX_MCP === 'true',
      ...config
    };
    
    this.swarmCoordinator = null;
    this.toolHandlers = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize LaTeX MCP integration
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize swarm coordinator if enabled
      if (this.config.enableSwarmCoordination) {
        this.swarmCoordinator = new LaTeXSwarmCoordinator({
          enableSemanticRouting: this.config.enableSemanticWeb,
          enableAIAssistance: this.config.enableAIAssistance,
          debugMode: this.config.debugMode
        });
        
        await this.swarmCoordinator.initialize();
      }

      // Register LaTeX tools with MCP server
      await this.registerLatexTools();

      // Setup tool handlers
      this.setupToolHandlers();

      this.isInitialized = true;

      if (this.config.debugMode) {
        console.log('[LaTeX MCP] Integration initialized successfully');
      }

    } catch (error) {
      console.error('[LaTeX MCP] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Register LaTeX tools with the MCP server
   */
  async registerLatexTools() {
    // Add LaTeX tool definitions to server's tool registry
    const existingTools = this.mcpServer.toolRegistry || [];
    const latexTools = LATEX_TOOL_DEFINITIONS;

    // Merge LaTeX tools with existing tools
    this.mcpServer.toolRegistry = [...existingTools, ...latexTools];

    if (this.config.debugMode) {
      console.log(`[LaTeX MCP] Registered ${latexTools.length} LaTeX tools`);
      latexTools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    }
  }

  /**
   * Setup tool handlers for LaTeX operations
   */
  setupToolHandlers() {
    // Create instances of tool handlers
    Object.entries(LATEX_TOOL_HANDLERS).forEach(([toolName, HandlerClass]) => {
      const handler = new HandlerClass();
      
      // Inject swarm coordinator if available
      if (this.swarmCoordinator && handler.setSwarmCoordinator) {
        handler.setSwarmCoordinator(this.swarmCoordinator);
      }
      
      this.toolHandlers.set(toolName, handler);
    });

    // Register enhanced handlers with MCP server
    this.mcpServer.on('tool-call', this.handleToolCall.bind(this));
  }

  /**
   * Handle LaTeX tool calls with swarm coordination
   */
  async handleToolCall(request) {
    const { name: toolName, arguments: params } = request.params;

    // Check if this is a LaTeX tool
    if (!this.toolHandlers.has(toolName)) {
      return; // Let other handlers process non-LaTeX tools
    }

    try {
      const handler = this.toolHandlers.get(toolName);
      
      // Enhance with swarm coordination if available
      if (this.swarmCoordinator && this.shouldUseSwarmCoordination(toolName, params)) {
        return await this.executeWithSwarmCoordination(toolName, params);
      }

      // Execute without swarm coordination
      return await handler.execute(params);

    } catch (error) {
      console.error(`[LaTeX MCP] Tool execution failed for ${toolName}:`, error);
      return {
        content: [{
          type: "text",
          text: `LaTeX tool execution failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Determine if tool should use swarm coordination
   */
  shouldUseSwarmCoordination(toolName, params) {
    // Use swarm coordination for complex operations
    const swarmEnabledTools = ['latex_generate', 'latex_format', 'latex_validate'];
    
    // Or when AI assistance is requested
    const hasAIAssistance = params.aiAssistance && Object.values(params.aiAssistance).some(v => v);
    
    // Or for semantic enhancement
    const hasSemanticFeatures = params.semanticDomain || params.aiEnhancements;

    return swarmEnabledTools.includes(toolName) || hasAIAssistance || hasSemanticFeatures;
  }

  /**
   * Execute LaTeX tool with swarm coordination
   */
  async executeWithSwarmCoordination(toolName, params) {
    try {
      switch (toolName) {
        case 'latex_generate':
          return await this.executeGenerateWithSwarm(params);
        
        case 'latex_format':
          return await this.executeFormatWithSwarm(params);
        
        case 'latex_validate':
          return await this.executeValidateWithSwarm(params);
        
        default:
          // Fallback to regular execution
          const handler = this.toolHandlers.get(toolName);
          return await handler.execute(params);
      }
    } catch (error) {
      console.error(`[LaTeX MCP] Swarm execution failed for ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Execute document generation with swarm coordination
   */
  async executeGenerateWithSwarm(params) {
    const swarmResult = await this.swarmCoordinator.orchestrateDocumentGeneration(params);
    
    if (swarmResult.success) {
      // Execute actual generation using the enhanced parameters from swarm
      const enhancedParams = {
        ...params,
        ...swarmResult.results.optimized,
        swarmEnhanced: true
      };

      const handler = this.toolHandlers.get('latex_generate');
      const result = await handler.execute(enhancedParams);

      // Enhance result with swarm metadata
      return {
        ...result,
        _meta: {
          ...result._meta,
          swarmCoordination: {
            taskId: swarmResult.taskId,
            agentsUsed: swarmResult.agentsUsed,
            validation: swarmResult.validation
          }
        }
      };
    } else {
      throw new Error(`Swarm coordination failed: ${swarmResult.error}`);
    }
  }

  /**
   * Execute formatting with swarm coordination
   */
  async executeFormatWithSwarm(params) {
    const enhancementResult = await this.swarmCoordinator.orchestrateContentEnhancement({
      source: params.source,
      semanticDomain: params.style === 'academic' ? 'academic' : 'technical',
      enhancements: Object.keys(params.aiEnhancements || {}).filter(
        key => params.aiEnhancements[key]
      )
    });

    if (enhancementResult.success) {
      // Apply enhancements to formatting parameters
      const enhancedParams = {
        ...params,
        ...enhancementResult.results['enhanced-content'],
        swarmEnhanced: true
      };

      const handler = this.toolHandlers.get('latex_format');
      return await handler.execute(enhancedParams);
    } else {
      throw new Error(`Content enhancement failed: ${enhancementResult.error}`);
    }
  }

  /**
   * Execute validation with swarm coordination
   */
  async executeValidateWithSwarm(params) {
    // Use swarm for comprehensive validation
    const handler = this.toolHandlers.get('latex_validate');
    const basicResult = await handler.execute(params);

    // Enhance with swarm analysis if validation found issues
    if (basicResult._meta?.hasIssues) {
      const troubleshootResult = await this.swarmCoordinator.troubleshootCompilation({
        source: params.source,
        errors: basicResult._meta.errors || [],
        warnings: basicResult._meta.warnings || []
      });

      return {
        ...basicResult,
        content: [
          ...basicResult.content,
          {
            type: "text",
            text: `\n\nSwarm Analysis:\n${JSON.stringify(troubleshootResult.analysis, null, 2)}\n\nRecommended Actions:\n${troubleshootResult.recommendedActions?.map(a => `- ${a.description}`).join('\n') || 'No specific actions recommended'}`
          }
        ],
        _meta: {
          ...basicResult._meta,
          swarmAnalysis: troubleshootResult.analysis,
          recommendedActions: troubleshootResult.recommendedActions
        }
      };
    }

    return basicResult;
  }

  /**
   * Store LaTeX MCP definitions in memory for swarm coordination
   */
  async storeMCPDefinitions() {
    if (!this.swarmCoordinator) return;

    const mcpDefinitions = {
      version: '1.0.0',
      namespace: 'latex-mcp',
      tools: LATEX_TOOL_DEFINITIONS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        capabilities: this.extractToolCapabilities(tool),
        swarmIntegration: {
          enabled: this.shouldUseSwarmCoordination(tool.name, {}),
          agents: this.getRequiredAgents(tool.name),
          coordinationPatterns: this.getCoordinationPatterns(tool.name)
        }
      })),
      swarmCoordination: {
        enabled: this.config.enableSwarmCoordination,
        agents: Array.from(this.swarmCoordinator.latexAgents.values()).map(agent => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          expertise: agent.expertise,
          capabilities: agent.capabilities
        })),
        workflows: [
          'latex-document-generation',
          'latex-content-enhancement', 
          'latex-compilation-debug'
        ]
      },
      semanticWeb: {
        enabled: this.config.enableSemanticWeb,
        citationSources: ['arxiv', 'semantic-scholar', 'crossref', 'pubmed'],
        ontologySupport: ['dublin_core', 'schema_org', 'fhir', 'fibo']
      },
      timestamp: this.getDeterministicDate().toISOString()
    };

    // Store in swarm memory
    await this.swarmCoordinator.semanticCoordinator.storeMemory('latex-mcp-definitions', mcpDefinitions);

    if (this.config.debugMode) {
      console.log('[LaTeX MCP] Definitions stored in swarm memory');
    }

    return mcpDefinitions;
  }

  /**
   * Extract tool capabilities from definition
   */
  extractToolCapabilities(tool) {
    const capabilities = [];
    
    if (tool.inputSchema.properties.aiAssistance) {
      capabilities.push('ai-assistance');
    }
    
    if (tool.inputSchema.properties.semanticDomain) {
      capabilities.push('semantic-analysis');
    }
    
    if (tool.name.includes('citations')) {
      capabilities.push('semantic-web-integration');
    }
    
    if (tool.name.includes('compile')) {
      capabilities.push('compilation-processing');
    }
    
    return capabilities;
  }

  /**
   * Get required agents for tool execution
   */
  getRequiredAgents(toolName) {
    const agentMap = {
      'latex_generate': ['latex-document-architect', 'latex-content-generator', 'latex-bibliography-manager'],
      'latex_compile': ['latex-compiler-optimizer'],
      'latex_format': ['latex-semantic-enhancer', 'latex-content-generator'],
      'latex_citations': ['latex-bibliography-manager', 'latex-semantic-enhancer'],
      'latex_validate': ['latex-quality-validator', 'latex-compiler-optimizer']
    };
    
    return agentMap[toolName] || [];
  }

  /**
   * Get coordination patterns for tool execution
   */
  getCoordinationPatterns(toolName) {
    const patternMap = {
      'latex_generate': 'pipeline',
      'latex_compile': 'sequential',
      'latex_format': 'collaborative',
      'latex_citations': 'parallel',
      'latex_validate': 'problem-solving'
    };
    
    return patternMap[toolName] || 'sequential';
  }

  /**
   * Get integration status and metrics
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      swarmCoordination: {
        enabled: this.config.enableSwarmCoordination,
        coordinator: this.swarmCoordinator ? this.swarmCoordinator.getSwarmStatus() : null
      },
      tools: {
        registered: Array.from(this.toolHandlers.keys()),
        count: this.toolHandlers.size
      },
      config: {
        enableSemanticWeb: this.config.enableSemanticWeb,
        enableAIAssistance: this.config.enableAIAssistance,
        debugMode: this.config.debugMode
      }
    };
  }

  /**
   * Cleanup and shutdown integration
   */
  async shutdown() {
    this.isInitialized = false;
    
    if (this.swarmCoordinator) {
      await this.swarmCoordinator.shutdown();
    }
    
    this.toolHandlers.clear();
    
    if (this.config.debugMode) {
      console.log('[LaTeX MCP] Integration shutdown completed');
    }
  }
}

/**
 * Factory function to create and initialize LaTeX MCP integration
 */
export async function createLatexMCPIntegration(mcpServer, config) {
  const integration = new LaTeXMCPIntegration(mcpServer, config);
  await integration.initialize();
  return integration;
}