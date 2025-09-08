/**
 * LaTeX MCP Integration Test Suite
 * Tests LaTeX MCP tools with swarm coordination and semantic web integration
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createLatexMCPIntegration } from '../../src/mcp/latex-server-integration.js';
import { LaTeXGenerateToolHandler, LaTeXCompileToolHandler, LaTeXCitationsToolHandler } from '../../src/mcp/tools/latex-tools.js';
import { LaTeXSwarmCoordinator } from '../../src/mcp/tools/latex-coordination.js';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock MCP Server
class MockMCPServer {
  constructor() {
    this.toolRegistry = [];
    this.handlers = new Map();
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  emit(event, data) {
    const handler = this.handlers.get(event);
    if (handler) return handler(data);
  }
}

describe('LaTeX MCP Integration', () => {
  let mcpServer;
  let latexIntegration;
  let testOutputDir;

  beforeAll(async () => {
    // Setup test environment
    testOutputDir = path.join(__dirname, '../../tmp/latex-tests');
    await fs.ensureDir(testOutputDir);

    // Create mock MCP server
    mcpServer = new MockMCPServer();

    // Create LaTeX MCP integration
    latexIntegration = await createLatexMCPIntegration(mcpServer, {
      enableSwarmCoordination: true,
      enableSemanticWeb: true,
      enableAIAssistance: true,
      debugMode: true
    });
  });

  afterAll(async () => {
    // Cleanup
    if (latexIntegration) {
      await latexIntegration.shutdown();
    }
    
    // Remove test files
    await fs.remove(testOutputDir);
  });

  describe('Tool Registration', () => {
    it('should register LaTeX tools with MCP server', () => {
      expect(mcpServer.toolRegistry).toBeDefined();
      expect(mcpServer.toolRegistry.length).toBeGreaterThan(0);
      
      const toolNames = mcpServer.toolRegistry.map(tool => tool.name);
      expect(toolNames).toContain('latex_generate');
      expect(toolNames).toContain('latex_compile');
      expect(toolNames).toContain('latex_format');
      expect(toolNames).toContain('latex_citations');
      expect(toolNames).toContain('latex_validate');
    });

    it('should have proper tool definitions', () => {
      const generateTool = mcpServer.toolRegistry.find(tool => tool.name === 'latex_generate');
      
      expect(generateTool).toBeDefined();
      expect(generateTool.description).toContain('LaTeX documents');
      expect(generateTool.inputSchema).toBeDefined();
      expect(generateTool.inputSchema.properties.documentType).toBeDefined();
      expect(generateTool.inputSchema.properties.title).toBeDefined();
      expect(generateTool.inputSchema.required).toContain('documentType');
      expect(generateTool.inputSchema.required).toContain('title');
    });
  });

  describe('Swarm Coordination', () => {
    it('should initialize swarm coordinator', () => {
      expect(latexIntegration.swarmCoordinator).toBeDefined();
      expect(latexIntegration.swarmCoordinator.isInitialized).toBe(true);
    });

    it('should have LaTeX-specific agents registered', () => {
      const status = latexIntegration.swarmCoordinator.getSwarmStatus();
      
      expect(status.agents).toBeDefined();
      expect(status.agents.length).toBeGreaterThan(0);
      
      const agentIds = status.agents.map(agent => agent.id);
      expect(agentIds).toContain('latex-document-architect');
      expect(agentIds).toContain('latex-content-generator');
      expect(agentIds).toContain('latex-bibliography-manager');
      expect(agentIds).toContain('latex-compiler-optimizer');
      expect(agentIds).toContain('latex-quality-validator');
      expect(agentIds).toContain('latex-semantic-enhancer');
    });
  });

  describe('LaTeX Generation Tool', () => {
    it('should generate article document', async () => {
      const params = {
        documentType: 'article',
        title: 'Test Article',
        author: 'Test Author',
        content: {
          abstract: 'This is a test abstract for the article.',
          sections: [
            {
              title: 'Introduction',
              content: 'This is the introduction section.'
            },
            {
              title: 'Methodology', 
              content: 'This describes the research methodology.'
            }
          ]
        },
        dest: testOutputDir,
        options: {
          bibliography: true,
          math: true,
          figures: true
        },
        dry: true
      };

      const handler = new LaTeXGenerateToolHandler();
      const result = await handler.execute(params);

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('LaTeX generation');
    });

    it('should handle thesis document generation', async () => {
      const params = {
        documentType: 'thesis',
        title: 'Test Thesis: Advanced Research in Computer Science',
        author: 'Test Graduate Student',
        degree: 'Master of Science',
        department: 'Computer Science',
        university: 'Test University',
        content: {
          abstract: 'This thesis presents advanced research in computer science.',
          chapters: [
            {
              title: 'Literature Review',
              content: 'Review of relevant literature.'
            },
            {
              title: 'Methodology',
              content: 'Research methodology and approach.'
            }
          ]
        },
        dest: testOutputDir,
        semanticDomain: 'academic',
        aiAssistance: {
          contentGeneration: true,
          structureOptimization: true
        },
        dry: true
      };

      const handler = new LaTeXGenerateToolHandler();
      const result = await handler.execute(params);

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result._meta).toBeDefined();
      expect(result._meta.documentType).toBe('thesis');
      expect(result._meta.semanticDomain).toBe('academic');
    });
  });

  describe('Citation Management Tool', () => {
    it('should search and format citations', async () => {
      const params = {
        query: 'machine learning neural networks',
        domain: 'computer-science',
        sources: ['arxiv', 'semantic-scholar'],
        maxResults: 5,
        format: 'bibtex',
        aiFiltering: {
          relevanceScoring: true,
          duplicateDetection: true
        }
      };

      const handler = new LaTeXCitationsToolHandler();
      const result = await handler.execute(params);

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('citations');
      expect(result._meta).toBeDefined();
      expect(result._meta.query).toBe(params.query);
    });

    it('should handle different citation formats', async () => {
      const params = {
        query: 'quantum computing',
        format: 'json',
        maxResults: 3
      };

      const handler = new LaTeXCitationsToolHandler();
      const result = await handler.execute(params);

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      
      // Should return JSON format
      const content = result.content[0].text;
      expect(() => JSON.parse(content.split('\n').slice(1).join('\n'))).not.toThrow();
    });
  });

  describe('Compilation Tool', () => {
    it('should handle compilation parameters', async () => {
      // Create a minimal test LaTeX file
      const testTexFile = path.join(testOutputDir, 'test.tex');
      const testContent = `\\documentclass{article}
\\begin{document}
\\title{Test Document}
\\author{Test Author}
\\maketitle
\\section{Introduction}
This is a test document.
\\end{document}`;

      await fs.writeFile(testTexFile, testContent);

      const params = {
        source: testTexFile,
        engine: 'pdflatex',
        passes: 1,
        cleanup: true,
        outputDir: testOutputDir
      };

      const handler = new LaTeXCompileToolHandler();
      const result = await handler.execute(params);

      expect(result).toBeDefined();
      // Note: Actual compilation might fail without LaTeX installed,
      // but we can test parameter handling
      expect(result.content).toBeDefined();
    });
  });

  describe('Integration Status', () => {
    it('should provide comprehensive status information', () => {
      const status = latexIntegration.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.swarmCoordination.enabled).toBe(true);
      expect(status.swarmCoordination.coordinator).toBeDefined();
      expect(status.tools.count).toBeGreaterThan(0);
      expect(status.config.enableSemanticWeb).toBe(true);
      expect(status.config.enableAIAssistance).toBe(true);
    });
  });

  describe('Swarm Coordination Workflows', () => {
    it('should execute document generation workflow', async () => {
      const params = {
        documentType: 'article',
        title: 'Swarm-Generated Article',
        author: 'AI Assistant',
        semanticDomain: 'technical',
        content: {
          abstract: 'Abstract generated with swarm coordination.',
          sections: [
            { title: 'Background', content: 'Background content.' },
            { title: 'Approach', content: 'Technical approach.' }
          ]
        },
        aiAssistance: {
          contentGeneration: true,
          structureOptimization: true
        }
      };

      // Mock swarm coordinator methods for testing
      vi.spyOn(latexIntegration.swarmCoordinator, 'orchestrateDocumentGeneration')
        .mockResolvedValue({
          success: true,
          taskId: 'test-task-123',
          results: {
            architecture: { structure: 'optimized' },
            content: { enhanced: true },
            bibliography: { processed: true },
            optimized: { compilation: 'ready' }
          },
          validation: { score: 0.95 },
          agentsUsed: 5
        });

      const result = await latexIntegration.executeGenerateWithSwarm(params);

      expect(result).toBeDefined();
      expect(result._meta.swarmCoordination).toBeDefined();
      expect(result._meta.swarmCoordination.taskId).toBe('test-task-123');
      expect(result._meta.swarmCoordination.agentsUsed).toBe(5);
    });

    it('should handle content enhancement workflow', async () => {
      const params = {
        source: 'test-document.tex',
        style: 'academic',
        aiEnhancements: {
          structureAnalysis: true,
          consistencyCheck: true,
          bestPractices: true
        }
      };

      // Mock content enhancement
      vi.spyOn(latexIntegration.swarmCoordinator, 'orchestrateContentEnhancement')
        .mockResolvedValue({
          success: true,
          taskId: 'enhancement-task-456',
          results: {
            'semantic-analysis': { coherence: 0.9 },
            'enhanced-content': { improved: true }
          }
        });

      const result = await latexIntegration.executeFormatWithSwarm(params);

      expect(result).toBeDefined();
    });
  });

  describe('Memory Storage', () => {
    it('should store MCP definitions in memory', async () => {
      const definitions = await latexIntegration.storeMCPDefinitions();

      expect(definitions).toBeDefined();
      expect(definitions.version).toBe('1.0.0');
      expect(definitions.namespace).toBe('latex-mcp');
      expect(definitions.tools).toBeDefined();
      expect(definitions.tools.length).toBeGreaterThan(0);
      expect(definitions.swarmCoordination.enabled).toBe(true);
      expect(definitions.semanticWeb.enabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const invalidParams = {
        documentType: 'invalid-type',
        // Missing required title parameter
      };

      const request = {
        params: {
          name: 'latex_generate',
          arguments: invalidParams
        }
      };

      const result = await latexIntegration.handleToolCall(request);

      expect(result).toBeDefined();
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('failed');
    });

    it('should handle swarm coordination failures', async () => {
      // Mock a swarm failure
      vi.spyOn(latexIntegration.swarmCoordinator, 'orchestrateDocumentGeneration')
        .mockRejectedValue(new Error('Swarm coordination failed'));

      const params = {
        documentType: 'article',
        title: 'Test Article',
        aiAssistance: { contentGeneration: true }
      };

      await expect(latexIntegration.executeGenerateWithSwarm(params))
        .rejects.toThrow('Swarm coordination failed');
    });
  });
});

describe('LaTeX Swarm Coordinator', () => {
  let coordinator;

  beforeAll(async () => {
    coordinator = new LaTeXSwarmCoordinator({
      debugMode: true
    });
    await coordinator.initialize();
  });

  afterAll(async () => {
    if (coordinator) {
      await coordinator.shutdown();
    }
  });

  it('should initialize with LaTeX agents', () => {
    expect(coordinator.isInitialized).toBe(true);
    expect(coordinator.latexAgents.size).toBeGreaterThan(0);
  });

  it('should provide workflow patterns', async () => {
    const status = coordinator.getSwarmStatus();
    
    expect(status.agents).toBeDefined();
    expect(status.agents.length).toBe(6); // 6 specialized LaTeX agents
    
    const architectAgent = status.agents.find(agent => agent.id === 'latex-document-architect');
    expect(architectAgent).toBeDefined();
    expect(architectAgent.expertise).toContain('document-structure');
  });

  it('should assign tasks to appropriate agents', async () => {
    const task = await coordinator.assignAgentTask('latex-content-generator', {
      action: 'generate-content',
      documentType: 'article',
      semanticDomain: 'academic'
    });

    expect(task).toBeDefined();
    expect(task.agentId).toBe('latex-content-generator');
    expect(task.params.action).toBe('generate-content');
    expect(task.status).toBe('assigned');
  });
});