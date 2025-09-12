/**
 * Mock MCP Client Implementation
 * 
 * Provides comprehensive mock implementation for testing MCP integration
 * without requiring actual MCP server connections. Supports all MCP tools
 * and simulates realistic response patterns.
 */

import { EventEmitter } from 'events';
import { createMCPResponse, createMCPError, createTextToolResult, createJSONToolResult } from '../../src/mcp/utils.js';
import { MCPErrorCode, TOOL_SCHEMAS } from '../../src/mcp/types.js';

/**
 * Mock MCP Client for testing purposes
 */
export class MockMCPClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      latency: options.latency || 100,
      errorRate: options.errorRate || 0,
      debug: options.debug || false,
      ...options
    };
    
    this.connected = false;
    this.requestHistory = [];
    this.responseHistory = [];
    this.nextRequestId = 1;
    
    // Mock server state
    this.mockState = {
      generators: [
        {
          name: 'component',
          description: 'React component generator',
          templates: [
            { name: 'basic', description: 'Basic functional component' },
            { name: 'class', description: 'Class-based component' },
            { name: 'hook', description: 'Custom hook component' }
          ]
        },
        {
          name: 'api',
          description: 'API generator',
          templates: [
            { name: 'rest', description: 'REST API endpoints' },
            { name: 'graphql', description: 'GraphQL schema and resolvers' }
          ]
        },
        {
          name: 'docs',
          description: 'Documentation generator',
          templates: [
            { name: 'api', description: 'API documentation' },
            { name: 'readme', description: 'README file' }
          ]
        }
      ],
      lastGeneratedFiles: [],
      injectHistory: []
    };
  }

  /**
   * Connect to mock MCP server
   */
  async connect() {
    if (this.connected) {
      return { success: true, message: 'Already connected' };
    }

    // Simulate connection delay
    await this.simulateLatency();

    // Simulate occasional connection failures
    if (this.shouldSimulateError()) {
      const error = new Error('Connection failed: Server not available');
      this.emit('error', error);
      throw error;
    }

    this.connected = true;
    this.emit('connected');
    
    if (this.options.debug) {
      console.log('[MockMCPClient] Connected to mock MCP server');
    }

    return { success: true, message: 'Connected to mock MCP server' };
  }

  /**
   * Disconnect from mock MCP server
   */
  async disconnect() {
    if (!this.connected) {
      return { success: true, message: 'Already disconnected' };
    }

    this.connected = false;
    this.requestHistory = [];
    this.responseHistory = [];
    this.emit('disconnected');
    
    if (this.options.debug) {
      console.log('[MockMCPClient] Disconnected from mock MCP server');
    }

    return { success: true, message: 'Disconnected from mock MCP server' };
  }

  /**
   * Send MCP request to mock server
   */
  async request(method, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const requestId = this.nextRequestId++;
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    this.requestHistory.push({ ...request, timestamp: this.getDeterministicDate() });

    if (this.options.debug) {
      console.log('[MockMCPClient] Sending request:', method, params);
    }

    // Simulate network latency
    await this.simulateLatency();

    // Simulate occasional errors
    if (this.shouldSimulateError()) {
      const error = createMCPError(requestId, MCPErrorCode.ServerError, 'Mock server error');
      this.responseHistory.push({ ...error, timestamp: this.getDeterministicDate() });
      return error;
    }

    let response;

    try {
      switch (method) {
        case 'initialize':
          response = createMCPResponse(requestId, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false }
            },
            serverInfo: {
              name: 'mock-unjucks-mcp-server',
              version: '1.0.0'
            }
          });
          break;

        case 'tools/list':
          response = createMCPResponse(requestId, {
            tools: Object.keys(TOOL_SCHEMAS).map(name => ({
              name,
              description: this.getToolDescription(name),
              inputSchema: TOOL_SCHEMAS[name]
            }))
          });
          break;

        case 'tools/call':
          const toolResult = await this.callTool(params.name, params.arguments || {});
          response = createMCPResponse(requestId, toolResult);
          break;

        default:
          response = createMCPError(requestId, MCPErrorCode.MethodNotFound, `Method ${method} not found`);
      }
    } catch (error) {
      response = createMCPError(requestId, MCPErrorCode.InternalError, error.message);
    }

    this.responseHistory.push({ ...response, timestamp: this.getDeterministicDate() });

    if (this.options.debug) {
      console.log('[MockMCPClient] Received response:', response);
    }

    return response;
  }

  /**
   * Call specific tool with parameters
   */
  async callTool(toolName, args = {}) {
    switch (toolName) {
      case 'unjucks_list':
        return this.mockUnjucksList(args);
      case 'unjucks_generate':
        return this.mockUnjucksGenerate(args);
      case 'unjucks_help':
        return this.mockUnjucksHelp(args);
      case 'unjucks_dry_run':
        return this.mockUnjucksDryRun(args);
      case 'unjucks_inject':
        return this.mockUnjucksInject(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Mock implementation of unjucks_list
   */
  async mockUnjucksList(args) {
    await this.simulateLatency();

    const { generator, detailed = false } = args;
    let generators = [...this.mockState.generators];

    // Filter by specific generator if requested
    if (generator) {
      generators = generators.filter(g => g.name === generator);
    }

    // Add detailed information if requested
    if (detailed) {
      generators = generators.map(gen => ({
        ...gen,
        templateCount: gen.templates.length,
        lastModified: this.getDeterministicDate().toISOString(),
        variables: gen.templates.map(t => ({
          template: t.name,
          variables: this.getTemplateVariables(gen.name, t.name)
        }))
      }));
    }

    return createJSONToolResult({
      generators,
      totalCount: generators.length,
      timestamp: this.getDeterministicDate().toISOString()
    }, {
      operation: 'list',
      detailed,
      generator: generator || 'all'
    });
  }

  /**
   * Mock implementation of unjucks_generate
   */
  async mockUnjucksGenerate(args) {
    await this.simulateLatency(200); // Generation takes longer

    const { generator, template, dest, variables = {}, force = false, dry = false } = args;

    if (!generator || !template || !dest) {
      throw new Error('Missing required parameters: generator, template, dest');
    }

    // Find generator and template
    const gen = this.mockState.generators.find(g => g.name === generator);
    if (!gen) {
      throw new Error(`Generator '${generator}' not found`);
    }

    const tmpl = gen.templates.find(t => t.name === template);
    if (!tmpl) {
      throw new Error(`Template '${template}' not found in generator '${generator}'`);
    }

    // Generate mock files
    const files = this.generateMockFiles(generator, template, dest, variables);
    
    if (!dry) {
      this.mockState.lastGeneratedFiles = files;
    }

    const summary = {
      created: dry ? 0 : files.filter(f => f.action === 'created').length,
      updated: dry ? 0 : files.filter(f => f.action === 'updated').length,
      skipped: files.filter(f => f.action === 'skipped').length,
      total: files.length
    };

    return createJSONToolResult({
      files: files.map(f => ({ path: f.path, action: f.action })),
      summary,
      generator,
      template,
      variables,
      dry,
      force,
      timestamp: this.getDeterministicDate().toISOString()
    }, {
      operation: 'generate',
      duration: this.options.latency + 100,
      filesGenerated: summary.total
    });
  }

  /**
   * Mock implementation of unjucks_help
   */
  async mockUnjucksHelp(args) {
    await this.simulateLatency();

    const { generator, template } = args;

    if (!generator || !template) {
      throw new Error('Missing required parameters: generator, template');
    }

    const gen = this.mockState.generators.find(g => g.name === generator);
    if (!gen) {
      throw new Error(`Generator '${generator}' not found`);
    }

    const tmpl = gen.templates.find(t => t.name === template);
    if (!tmpl) {
      throw new Error(`Template '${template}' not found in generator '${generator}'`);
    }

    const variables = this.getTemplateVariables(generator, template);
    const helpText = this.generateHelpText(generator, template, tmpl.description, variables);

    return createTextToolResult(helpText, {
      operation: 'help',
      generator,
      template,
      variableCount: variables.length
    });
  }

  /**
   * Mock implementation of unjucks_dry_run
   */
  async mockUnjucksDryRun(args) {
    await this.simulateLatency(150);

    const { generator, template, dest, variables = {} } = args;

    if (!generator || !template || !dest) {
      throw new Error('Missing required parameters: generator, template, dest');
    }

    // Generate same files as generate but with preview content
    const files = this.generateMockFiles(generator, template, dest, variables, true);

    return createJSONToolResult({
      files: files.map(f => ({
        path: f.path,
        content: f.content,
        action: f.action,
        size: f.content.length
      })),
      preview: true,
      generator,
      template,
      variables,
      timestamp: this.getDeterministicDate().toISOString()
    }, {
      operation: 'dry_run',
      filesPreviewedCount: files.length
    });
  }

  /**
   * Mock implementation of unjucks_inject
   */
  async mockUnjucksInject(args) {
    await this.simulateLatency();

    const { 
      file, 
      content, 
      before, 
      after, 
      append = false, 
      prepend = false, 
      lineAt, 
      force = false, 
      dry = false 
    } = args;

    if (!file || !content) {
      throw new Error('Missing required parameters: file, content');
    }

    // Mock injection operation
    const injectionResult = {
      file,
      content,
      linesAdded: content.split('\n').length,
      action: 'injected',
      position: before ? 'before' : after ? 'after' : append ? 'append' : prepend ? 'prepend' : lineAt ? 'line' : 'unknown',
      success: true,
      dry
    };

    if (!dry) {
      this.mockState.injectHistory.push({
        ...injectionResult,
        timestamp: this.getDeterministicDate().toISOString()
      });
    }

    return createJSONToolResult(injectionResult, {
      operation: 'inject',
      fileModified: !dry,
      injectionType: injectionResult.position
    });
  }

  /**
   * Get tool description for mock responses
   */
  getToolDescription(toolName) {
    const descriptions = {
      unjucks_list: 'List available generators and templates',
      unjucks_generate: 'Generate files from templates',
      unjucks_help: 'Get help information for a specific generator and template',
      unjucks_dry_run: 'Preview file generation without creating files',
      unjucks_inject: 'Inject content into existing files'
    };
    return descriptions[toolName] || `${toolName} tool`;
  }

  /**
   * Get template variables for mock responses
   */
  getTemplateVariables(generator, template) {
    const variablesByTemplate = {
      'component/basic': [
        { name: 'name', type: 'string', description: 'Component name', required: true },
        { name: 'description', type: 'string', description: 'Component description', defaultValue: '' },
        { name: 'withProps', type: 'boolean', description: 'Include props interface', defaultValue: false }
      ],
      'component/class': [
        { name: 'name', type: 'string', description: 'Component name', required: true },
        { name: 'withState', type: 'boolean', description: 'Include state', defaultValue: true },
        { name: 'extends', type: 'string', description: 'Base class to extend', defaultValue: 'Component' }
      ],
      'api/rest': [
        { name: 'entityName', type: 'string', description: 'Entity name', required: true },
        { name: 'withAuth', type: 'boolean', description: 'Include authentication', defaultValue: true },
        { name: 'version', type: 'string', description: 'API version', defaultValue: 'v1' }
      ],
      'docs/api': [
        { name: 'title', type: 'string', description: 'Documentation title', required: true },
        { name: 'version', type: 'string', description: 'API version', required: true },
        { name: 'baseUrl', type: 'string', description: 'Base URL', defaultValue: 'http://localhost:3000' }
      ]
    };

    const key = `${generator}/${template}`;
    return variablesByTemplate[key] || [
      { name: 'name', type: 'string', description: 'Name', required: true }
    ];
  }

  /**
   * Generate mock files for templates
   */
  generateMockFiles(generator, template, dest, variables, includeContent = false) {
    const files = [];
    const name = variables.name || 'Generated';

    switch (`${generator}/${template}`) {
      case 'component/basic':
        files.push({
          path: `${dest}/${this.toPascalCase(name)}.jsx`,
          action: 'created',
          content: includeContent ? this.generateComponentContent(name, 'functional') : ''
        });
        if (variables.withProps) {
          files.push({
            path: `${dest}/${this.toPascalCase(name)}.types.js`,
            action: 'created',
            content: includeContent ? this.generateTypeContent(name) : ''
          });
        }
        break;

      case 'component/class':
        files.push({
          path: `${dest}/${this.toPascalCase(name)}.jsx`,
          action: 'created',
          content: includeContent ? this.generateComponentContent(name, 'class', variables.withState) : ''
        });
        break;

      case 'api/rest':
        files.push({
          path: `${dest}/${this.toKebabCase(variables.entityName || 'entity')}.controller.js`,
          action: 'created',
          content: includeContent ? this.generateControllerContent(variables.entityName || 'entity') : ''
        });
        files.push({
          path: `${dest}/${this.toKebabCase(variables.entityName || 'entity')}.routes.js`,
          action: 'created',
          content: includeContent ? this.generateRoutesContent(variables.entityName || 'entity') : ''
        });
        break;

      case 'docs/api':
        files.push({
          path: `${dest}/api-docs.md`,
          action: 'created',
          content: includeContent ? this.generateApiDocsContent(variables) : ''
        });
        break;

      default:
        files.push({
          path: `${dest}/${this.toKebabCase(name)}.generated.js`,
          action: 'created',
          content: includeContent ? `// Generated file for ${name}\nexport default '${name}';\n` : ''
        });
    }

    return files;
  }

  /**
   * Generate help text for templates
   */
  generateHelpText(generator, template, description, variables) {
    let help = `# ${generator}/${template}\n\n`;
    help += `${description}\n\n`;
    help += `## Variables\n\n`;
    
    for (const variable of variables) {
      help += `- **${variable.name}** (${variable.type})`;
      if (variable.required) help += ' *required*';
      help += `: ${variable.description}`;
      if (variable.defaultValue !== undefined) {
        help += ` (default: ${JSON.stringify(variable.defaultValue)})`;
      }
      help += '\n';
    }

    help += `\n## Usage\n\n`;
    help += `\`\`\`bash\n`;
    help += `unjucks generate ${generator} ${template} --dest ./output`;
    
    const requiredVars = variables.filter(v => v.required);
    for (const variable of requiredVars) {
      help += ` --${variable.name} "value"`;
    }
    
    help += `\n\`\`\`\n`;

    return help;
  }

  /**
   * Generate mock component content
   */
  generateComponentContent(name, type = 'functional', withState = false) {
    const pascalName = this.toPascalCase(name);
    const kebabName = this.toKebabCase(name);

    if (type === 'class') {
      return `import React${withState ? ', { Component }' : ''} from 'react';

export class ${pascalName} extends ${withState ? 'Component' : 'React.Component'} {${withState ? `
  constructor(props) {
    super(props);
    this.state = {
      // Add state properties here
    };
  }` : ''}

  render() {
    return (
      <div className="${kebabName}">
        <h1>${name}</h1>
      </div>
    );
  }
}

export default ${pascalName};
`;
    } else {
      return `import React from 'react';

export const ${pascalName} = ({ children, ...props }) => {
  return (
    <div className="${kebabName}" {...props}>
      <h1>${name}</h1>
      {children}
    </div>
  );
};

export default ${pascalName};
`;
    }
  }

  /**
   * Generate mock type content
   */
  generateTypeContent(name) {
    const pascalName = this.toPascalCase(name);
    
    return `/**
 * @typedef {Object} ${pascalName}Props
 * @property {React.ReactNode} [children] - Child components
 * @property {string} [className] - Additional CSS classes
 */

export default {};
`;
  }

  /**
   * Generate mock controller content
   */
  generateControllerContent(entityName) {
    const pascalName = this.toPascalCase(entityName);
    
    return `export class ${pascalName}Controller {
  async getAll(req, res) {
    // Implementation here
    res.json({ message: 'Get all ${entityName}s' });
  }

  async getById(req, res) {
    const { id } = req.params;
    res.json({ message: \`Get ${entityName} \${id}\` });
  }

  async create(req, res) {
    // Implementation here
    res.status(201).json({ message: 'Create ${entityName}' });
  }

  async update(req, res) {
    const { id } = req.params;
    res.json({ message: \`Update ${entityName} \${id}\` });
  }

  async delete(req, res) {
    const { id } = req.params;
    res.status(204).send();
  }
}
`;
  }

  /**
   * Generate mock routes content
   */
  generateRoutesContent(entityName) {
    const kebabName = this.toKebabCase(entityName);
    const pascalName = this.toPascalCase(entityName);
    
    return `import { Router } from 'express';
import { ${pascalName}Controller } from './${kebabName}.controller.js';

const router = Router();
const controller = new ${pascalName}Controller();

router.get('/', controller.getAll.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post('/', controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
`;
  }

  /**
   * Generate mock API docs content
   */
  generateApiDocsContent(variables) {
    const { title = 'API Documentation', version = '1.0.0', baseUrl = 'http://localhost:3000' } = variables;
    
    return `# ${title}

Version: ${version}  
Base URL: ${baseUrl}

## Overview

This API provides endpoints for managing resources.

## Authentication

All endpoints require authentication via Bearer token:

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Endpoints

### GET /api/resource
Get all resources

### GET /api/resource/:id
Get resource by ID

### POST /api/resource
Create new resource

### PUT /api/resource/:id
Update resource

### DELETE /api/resource/:id
Delete resource

## Error Responses

All errors follow the format:

\`\`\`json
{
  "error": {
    "code": 400,
    "message": "Error description"
  }
}
\`\`\`
`;
  }

  /**
   * Simulate network latency
   */
  async simulateLatency(customLatency) {
    const delay = customLatency || this.options.latency;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Determine if an error should be simulated
   */
  shouldSimulateError() {
    return Math.random() < this.options.errorRate;
  }

  /**
   * Utility: Convert to PascalCase
   */
  toPascalCase(str) {
    return str.replace(/(?:^|[-_\s])([a-z])/g, (_, char) => char.toUpperCase());
  }

  /**
   * Utility: Convert to kebab-case
   */
  toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      connected: this.connected,
      requestCount: this.requestHistory.length,
      responseCount: this.responseHistory.length,
      errorRate: this.options.errorRate,
      latency: this.options.latency,
      lastRequest: this.requestHistory[this.requestHistory.length - 1],
      lastResponse: this.responseHistory[this.responseHistory.length - 1],
      generatedFiles: this.mockState.lastGeneratedFiles.length,
      injectionHistory: this.mockState.injectHistory.length
    };
  }

  /**
   * Reset client state
   */
  reset() {
    this.requestHistory = [];
    this.responseHistory = [];
    this.mockState.lastGeneratedFiles = [];
    this.mockState.injectHistory = [];
    this.nextRequestId = 1;
  }

  /**
   * Update mock configuration
   */
  updateConfig(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * Create mock MCP client with default configuration
 */
export function createMockMCPClient(options = {}) {
  return new MockMCPClient(options);
}

/**
 * Factory for creating different types of mock clients
 */
export const MockClientFactory = {
  /**
   * Create a fast, reliable client for basic testing
   */
  reliable: () => new MockMCPClient({
    latency: 10,
    errorRate: 0,
    debug: false
  }),

  /**
   * Create a realistic client that simulates real network conditions
   */
  realistic: () => new MockMCPClient({
    latency: 150,
    errorRate: 0.05,
    debug: false
  }),

  /**
   * Create an unreliable client for error testing
   */
  unreliable: () => new MockMCPClient({
    latency: 500,
    errorRate: 0.3,
    debug: true
  }),

  /**
   * Create a slow client for performance testing
   */
  slow: () => new MockMCPClient({
    latency: 1000,
    errorRate: 0,
    debug: false
  })
};

export default MockMCPClient;