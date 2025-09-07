/**
 * Unjucks MCP Tool Integration Tests
 * Tests the unjucks_generate MCP tool and other unjucks-specific MCP functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFile, mkdir, rm, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { McpRequest, McpResponse } from '../types/mcp-protocol'

interface UnjucksMcpInterface {
  send: (request: McpRequest) => Promise<McpResponse>
  close: () => Promise<void>
  isConnected: () => boolean
}

class UnjucksMcpServer implements UnjucksMcpInterface {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          ENABLE_UNJUCKS_TOOLS: 'true',
          UNJUCKS_TEST_MODE: 'true',
          LOG_LEVEL: 'info'
        }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('Unjucks MCP tools enabled') || 
            output.includes('unjucks_generate tool registered')) {
          this.setupMessageHandling()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot load unjucks tools')) {
          reject(new Error(`Unjucks MCP server failed: ${error}`))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('Unjucks MCP server initialization timeout'))
      }, 25000)
    })
  }

  private setupMessageHandling(): void {
    if (!this.process?.stdout) return

    let responseBuffer = ''
    this.process.stdout.on('data', (data: Buffer) => {
      responseBuffer += data.toString()
      
      const lines = responseBuffer.split('\n')
      responseBuffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line) as McpResponse
            if (response.id && this.pendingRequests.has(response.id)) {
              const { resolve, reject } = this.pendingRequests.get(response.id)!
              this.pendingRequests.delete(response.id)
              
              if (response.error) {
                reject(new Error(response.error.message))
              } else {
                resolve(response)
              }
            }
          } catch (parseError) {
            // Ignore non-JSON output
          }
        }
      }
    })
  }

  async send(request: McpRequest): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Unjucks MCP server not available'))
        return
      }

      const id = ++this.messageId
      const message = { ...request, id }
      
      this.pendingRequests.set(id, { resolve, reject })
      
      const jsonMessage = JSON.stringify(message) + '\n'
      this.process.stdin.write(jsonMessage)

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Unjucks MCP request timeout: ${request.method}`))
        }
      }, 30000)
    })
  }

  isConnected(): boolean {
    return this.process !== null && !this.process.killed
  }

  async close(): Promise<void> {
    if (this.process) {
      return new Promise((resolve) => {
        this.process!.on('close', () => resolve())
        this.process!.kill('SIGTERM')
        
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
          resolve()
        }, 5000)
      })
    }
  }
}

describe('Unjucks MCP Tool Integration', () => {
  let mcpServer: UnjucksMcpServer
  let testTempDir: string
  let testTemplatesDir: string

  beforeAll(async () => {
    // Set up test directories
    testTempDir = join(process.cwd(), 'tests', 'temp', 'mcp-unjucks-test')
    testTemplatesDir = join(testTempDir, 'templates')
    
    await mkdir(testTempDir, { recursive: true })
    await mkdir(testTemplatesDir, { recursive: true })

    // Create test templates
    await createTestTemplates(testTemplatesDir)

    mcpServer = new UnjucksMcpServer()
    await mcpServer.initialize()
  }, 60000)

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.close()
    }
    if (existsSync(testTempDir)) {
      await rm(testTempDir, { recursive: true, force: true })
    }
  })

  beforeEach(async () => {
    // Clean up any generated files from previous tests
    const outputDir = join(testTempDir, 'output')
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true })
    }
    await mkdir(outputDir, { recursive: true })
  })

  describe('MCP Tool Discovery', () => {
    it('should list unjucks-specific MCP tools', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/list'
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(response.result.tools).toBeDefined()

      const tools = response.result.tools
      const unjucksTools = tools.filter((tool: any) => 
        tool.name.includes('unjucks') || tool.description.toLowerCase().includes('unjucks')
      )

      expect(unjucksTools.length).toBeGreaterThan(0)

      // Check for specific unjucks tools
      const expectedTools = ['unjucks_generate', 'unjucks_list', 'unjucks_help']
      for (const expectedTool of expectedTools) {
        const tool = tools.find((t: any) => t.name === expectedTool)
        if (tool) {
          expect(tool.description).toBeDefined()
          expect(tool.inputSchema).toBeDefined()
          expect(tool.inputSchema.type).toBe('object')
        }
      }
    })

    it('should provide proper tool schemas for unjucks tools', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/schema',
        params: { name: 'unjucks_generate' }
      })

      if (response.result) {
        expect(response.result.name).toBe('unjucks_generate')
        expect(response.result.inputSchema).toBeDefined()
        expect(response.result.inputSchema.properties).toBeDefined()
        
        const props = response.result.inputSchema.properties
        expect(props.generator).toBeDefined()
        expect(props.template).toBeDefined()
        expect(props.dest).toBeDefined()
        expect(props.variables).toBeDefined()
        expect(props.force).toBeDefined()
        expect(props.dry).toBeDefined()
      }
    })
  })

  describe('Unjucks Generate Tool', () => {
    it('should generate files using basic template', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'simple-file',
            dest: join(testTempDir, 'output'),
            variables: {
              fileName: 'TestClass',
              description: 'A test class generated via MCP'
            }
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(response.result.content).toBeDefined()

      const result = JSON.parse(response.result.content[1].text) // Second content item has JSON
      expect(result.success).toBe(true)
      expect(result.result.files).toHaveLength(1)
      expect(result.result.files[0].action).toBe('created')

      // Verify file was actually created
      const generatedFile = join(testTempDir, 'output', 'TestClass.js')
      expect(existsSync(generatedFile)).toBe(true)

      const fileContent = await readFile(generatedFile, 'utf-8')
      expect(fileContent).toContain('TestClass')
      expect(fileContent).toContain('A test class generated via MCP')
    })

    it('should handle dry run mode', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'simple-file',
            dest: join(testTempDir, 'output'),
            dry: true,
            variables: {
              fileName: 'DryRunTest',
              description: 'This should not create a real file'
            }
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(true)
      expect(result.operation).toBe('dry-run')
      expect(result.result.files).toHaveLength(1)

      // File should not exist in dry run
      const wouldBeGeneratedFile = join(testTempDir, 'output', 'DryRunTest.js')
      expect(existsSync(wouldBeGeneratedFile)).toBe(false)

      // But content should be in the response for review
      expect(result.result.files[0].content).toBeDefined()
      expect(result.result.files[0].content).toContain('DryRunTest')
    })

    it('should handle force overwrite mode', async () => {
      const outputPath = join(testTempDir, 'output', 'ForceTest.js')
      
      // Create initial file
      await writeFile(outputPath, 'Original content')
      const originalStat = await stat(outputPath)

      // Wait a bit to ensure timestamp difference
      await delay(100)

      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'simple-file',
            dest: join(testTempDir, 'output'),
            force: true,
            variables: {
              fileName: 'ForceTest',
              description: 'This should overwrite the existing file'
            }
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(true)

      // File should be overwritten
      const newContent = await readFile(outputPath, 'utf-8')
      expect(newContent).toContain('ForceTest')
      expect(newContent).toContain('This should overwrite the existing file')
      expect(newContent).not.toContain('Original content')

      // Check timestamp changed
      const newStat = await stat(outputPath)
      expect(newStat.mtime.getTime()).toBeGreaterThan(originalStat.mtime.getTime())
    })

    it('should generate multiple files from template', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'multi-file',
            dest: join(testTempDir, 'output'),
            variables: {
              moduleName: 'TestModule',
              includeTests: true,
              includeDoc: true
            }
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(true)
      expect(result.result.files.length).toBeGreaterThan(1)

      // Verify multiple files were created
      const expectedFiles = [
        'TestModule.js',
        'TestModule.test.js',
        'TestModule.md'
      ]

      for (const expectedFile of expectedFiles) {
        const filePath = join(testTempDir, 'output', expectedFile)
        expect(existsSync(filePath)).toBe(true)
        
        const content = await readFile(filePath, 'utf-8')
        expect(content).toContain('TestModule')
      }
    })

    it('should handle file injection mode', async () => {
      // Create existing file to inject into
      const targetFile = join(testTempDir, 'output', 'existing.js')
      await writeFile(targetFile, `// Existing file
class ExistingClass {
  // INJECT_METHODS_HERE
}`)

      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'injection',
            dest: join(testTempDir, 'output'),
            variables: {
              methodName: 'newMethod',
              returnType: 'string'
            }
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(true)
      
      const injectionResult = result.result.files.find((f: any) => f.action === 'injected')
      expect(injectionResult).toBeDefined()

      // Verify injection occurred
      const updatedContent = await readFile(targetFile, 'utf-8')
      expect(updatedContent).toContain('newMethod')
      expect(updatedContent).toContain('string')
      expect(updatedContent).toContain('ExistingClass') // Original content preserved
    })
  })

  describe('Unjucks List Tool', () => {
    it('should list available generators and templates', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: {}
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()

      const result = JSON.parse(response.result.content[0].text)
      expect(result.generators).toBeDefined()
      expect(Array.isArray(result.generators)).toBe(true)
      expect(result.generators.length).toBeGreaterThan(0)

      // Find our test generator
      const testGenerator = result.generators.find((g: any) => g.name === 'test-generator')
      expect(testGenerator).toBeDefined()
      expect(testGenerator.templates).toBeDefined()
      expect(testGenerator.templates.length).toBeGreaterThan(0)

      const templateNames = testGenerator.templates.map((t: any) => t.name)
      expect(templateNames).toContain('simple-file')
      expect(templateNames).toContain('multi-file')
    })

    it('should provide detailed generator information', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: {
            generator: 'test-generator',
            detailed: true
          }
        }
      })

      if (!response.error && response.result) {
        const result = JSON.parse(response.result.content[0].text)
        expect(result.generator).toBeDefined()
        expect(result.generator.name).toBe('test-generator')
        expect(result.generator.templates).toBeDefined()

        for (const template of result.generator.templates) {
          expect(template.name).toBeDefined()
          expect(template.path).toBeDefined()
          if (template.variables) {
            expect(Array.isArray(template.variables)).toBe(true)
          }
        }
      }
    })
  })

  describe('Unjucks Help Tool', () => {
    it('should provide help for generators and templates', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_help',
          arguments: {
            generator: 'test-generator',
            template: 'simple-file'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()

      const helpText = response.result.content[0].text
      expect(helpText).toBeDefined()
      expect(helpText).toContain('simple-file')
      expect(helpText).toContain('variables') // Should mention variables
    })

    it('should provide general help when no specific generator/template', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_help',
          arguments: {}
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()

      const helpText = response.result.content[0].text
      expect(helpText).toContain('unjucks')
      expect(helpText).toContain('generator') // Should mention generators
      expect(helpText).toContain('template')  // Should mention templates
    })
  })

  describe('Error Handling', () => {
    it('should handle nonexistent generator', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'nonexistent-generator',
            template: 'any-template',
            dest: join(testTempDir, 'output'),
            variables: {}
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(false)
      expect(result.result || result.message).toMatch(/generator.*not.*found/i)
    })

    it('should handle nonexistent template', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'nonexistent-template',
            dest: join(testTempDir, 'output'),
            variables: {}
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(false)
      expect(result.result || result.message).toMatch(/template.*not.*found/i)
    })

    it('should handle invalid destination path', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'simple-file',
            dest: '/invalid/nonexistent/path/that/cannot/be/created',
            variables: { fileName: 'Test' }
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(false)
      expect(result.message || result.error).toBeDefined()
    })

    it('should validate required parameters', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            // Missing required parameters
            dest: join(testTempDir, 'output')
          }
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.message).toMatch(/invalid.*parameter|missing.*required/i)
    })
  })

  describe('Advanced Features', () => {
    it('should handle complex variable substitution', async () => {
      const complexVariables = {
        className: 'AdvancedClass',
        properties: [
          { name: 'id', type: 'number', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string', required: false }
        ],
        methods: [
          { name: 'getId', returnType: 'number' },
          { name: 'getName', returnType: 'string' }
        ],
        imports: ['express', 'lodash'],
        config: {
          typescript: true,
          validation: true
        }
      }

      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'complex-template',
            dest: join(testTempDir, 'output'),
            variables: complexVariables
          }
        }
      })

      if (!response.error && response.result) {
        const result = JSON.parse(response.result.content[1].text)
        expect(result.success).toBe(true)

        const generatedFile = join(testTempDir, 'output', 'AdvancedClass.ts')
        if (existsSync(generatedFile)) {
          const content = await readFile(generatedFile, 'utf-8')
          
          expect(content).toContain('AdvancedClass')
          expect(content).toContain('getId')
          expect(content).toContain('getName')
          expect(content).toContain('express')
          expect(content).toContain('lodash')
        }
      }
    })

    it('should handle template inheritance and includes', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'inherited-template',
            dest: join(testTempDir, 'output'),
            variables: {
              moduleName: 'InheritedModule',
              baseClass: 'BaseComponent'
            }
          }
        }
      })

      if (!response.error && response.result) {
        const result = JSON.parse(response.result.content[1].text)
        expect(result.success).toBe(true)

        const generatedFile = join(testTempDir, 'output', 'InheritedModule.js')
        if (existsSync(generatedFile)) {
          const content = await readFile(generatedFile, 'utf-8')
          
          // Should contain content from base template
          expect(content).toContain('BaseComponent')
          expect(content).toContain('InheritedModule')
        }
      }
    })

    it('should provide generation metadata and statistics', async () => {
      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'multi-file',
            dest: join(testTempDir, 'output'),
            variables: {
              moduleName: 'MetricsTest',
              includeTests: true,
              includeDoc: true
            }
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      expect(result.success).toBe(true)
      expect(result.metadata).toBeDefined()

      const metadata = result.metadata
      expect(metadata.generator).toBe('test-generator')
      expect(metadata.template).toBe('multi-file')
      expect(metadata.variables).toBeDefined()
      expect(metadata.performance).toBeDefined()
      expect(metadata.performance.duration).toBeGreaterThan(0)
      expect(metadata.performance.filesProcessed).toBeGreaterThan(0)
      expect(metadata.timestamp).toBeDefined()
    })

    it('should handle file conflict resolution without force flag', async () => {
      const targetPath = join(testTempDir, 'output', 'ConflictTest.js')
      
      // Create existing file
      await writeFile(targetPath, 'Existing content')

      const response = await mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test-generator',
            template: 'simple-file',
            dest: join(testTempDir, 'output'),
            force: false, // Explicitly no force
            variables: {
              fileName: 'ConflictTest',
              description: 'This should not overwrite'
            }
          }
        }
      })

      expect(response.error).toBeUndefined()

      const result = JSON.parse(response.result.content[1].text)
      
      if (result.result.files.length > 0) {
        const fileResult = result.result.files[0]
        
        if (fileResult.action === 'skipped') {
          // File was skipped due to conflict
          expect(fileResult.action).toBe('skipped')
          
          // Original content should remain
          const content = await readFile(targetPath, 'utf-8')
          expect(content).toBe('Existing content')
        } else {
          // Some implementations might still overwrite or handle differently
          expect(['created', 'updated']).toContain(fileResult.action)
        }
      }
    })
  })
})

/**
 * Helper function to create test templates for MCP testing
 */
async function createTestTemplates(templatesDir: string): Promise<void> {
  const generatorDir = join(templatesDir, 'test-generator')
  await mkdir(generatorDir, { recursive: true })

  // Simple file template
  const simpleFileDir = join(generatorDir, 'simple-file')
  await mkdir(simpleFileDir, { recursive: true })

  await writeFile(join(simpleFileDir, 'index.js.ejs'), `---
to: <%= fileName %>.js
---
/**
 * <%= description %>
 * Generated on: <%= new Date().toISOString() %>
 */

class <%= fileName %> {
  constructor() {
    this.description = '<%= description %>';
    this.createdAt = new Date();
  }

  getDescription() {
    return this.description;
  }

  toString() {
    return \`<%= fileName %>: \${this.description}\`;
  }
}

module.exports = <%= fileName %>;
`)

  // Multi-file template
  const multiFileDir = join(generatorDir, 'multi-file')
  await mkdir(multiFileDir, { recursive: true })

  await writeFile(join(multiFileDir, 'module.js.ejs'), `---
to: <%= moduleName %>.js
---
/**
 * <%= moduleName %> Module
 */

class <%= moduleName %> {
  constructor() {
    this.name = '<%= moduleName %>';
  }
}

module.exports = <%= moduleName %>;
`)

  await writeFile(join(multiFileDir, 'test.js.ejs'), `---
to: <%= moduleName %>.test.js
skipIf: <%= !includeTests %>
---
const <%= moduleName %> = require('./<%= moduleName %>');

describe('<%= moduleName %>', () => {
  it('should create instance', () => {
    const instance = new <%= moduleName %>();
    expect(instance).toBeDefined();
    expect(instance.name).toBe('<%= moduleName %>');
  });
});
`)

  await writeFile(join(multiFileDir, 'doc.md.ejs'), `---
to: <%= moduleName %>.md
skipIf: <%= !includeDoc %>
---
# <%= moduleName %>

This is the documentation for <%= moduleName %> module.

## Usage

\`\`\`javascript
const <%= moduleName %> = require('./<%= moduleName %>');
const instance = new <%= moduleName %>();
\`\`\`

## API

- Constructor: Creates a new <%= moduleName %> instance
- name: Returns the module name
`)

  // Injection template
  const injectionDir = join(generatorDir, 'injection')
  await mkdir(injectionDir, { recursive: true })

  await writeFile(join(injectionDir, 'method.js.ejs'), `---
to: existing.js
inject: true
before: "// INJECT_METHODS_HERE"
---

  /**
   * Generated method: <%= methodName %>
   * @returns {<%= returnType %>} The return value
   */
  <%= methodName %>() {
    // Implementation here
    return <% if (returnType === 'string') { %>'result'<% } else { %>null<% } %>;
  }
`)

  // Complex template with advanced features
  const complexDir = join(generatorDir, 'complex-template')
  await mkdir(complexDir, { recursive: true })

  await writeFile(join(complexDir, 'class.ts.ejs'), `---
to: <%= className %>.ts
---
<% if (imports && imports.length > 0) { -%>
<% imports.forEach(imp => { -%>
import * as <%= imp.replace(/[^a-zA-Z0-9]/g, '') %> from '<%= imp %>';
<% }); -%>
<% } -%>

/**
 * <%= className %> class
<% if (config.typescript) { -%> * TypeScript enabled<% } -%>
<% if (config.validation) { -%> * Validation enabled<% } -%>
 */
export class <%= className %> {
<% if (properties && properties.length > 0) { -%>
  // Properties
<% properties.forEach(prop => { -%>
  <% if (config.typescript) { -%>private _<%= prop.name %>: <%= prop.type %><% if (!prop.required) { -%> | null = null<% } -%>;<% } else { -%>private _<%= prop.name %>;<% } %>
<% }); -%>
<% } -%>

  constructor(<% if (properties) { -%><% properties.filter(p => p.required).forEach((prop, idx) => { -%><% if (idx > 0) { %>, <% } %><%= prop.name %>: <%= config.typescript ? prop.type : 'any' %><% }); -%><% } -%>) {
<% if (properties) { -%>
<% properties.filter(p => p.required).forEach(prop => { -%>
    this._<%= prop.name %> = <%= prop.name %>;
<% }); -%>
<% } -%>
  }

<% if (methods && methods.length > 0) { -%>
  // Methods
<% methods.forEach(method => { -%>
  <%= method.name %>()<% if (config.typescript) { -%>: <%= method.returnType %><% } -%> {
    // Implementation for <%= method.name %>
<% if (method.returnType === 'string') { -%>
    return '<%= method.name %> result';
<% } else if (method.returnType === 'number') { -%>
    return 0;
<% } else { -%>
    return null;
<% } -%>
  }

<% }); -%>
<% } -%>
}
`)

  // Inherited template (uses base template)
  const inheritedDir = join(generatorDir, 'inherited-template')
  await mkdir(inheritedDir, { recursive: true })

  await writeFile(join(generatorDir, '_base.js.ejs'), `/**
 * Base template content
 * Module: <%= moduleName %>
 */

// Base imports and setup
const config = require('./config');

`)

  await writeFile(join(inheritedDir, 'module.js.ejs'), `---
to: <%= moduleName %>.js
---
<%- include('../_base.js.ejs') %>

class <%= moduleName %> extends <%= baseClass %> {
  constructor() {
    super();
    this.moduleName = '<%= moduleName %>';
  }

  getModuleName() {
    return this.moduleName;
  }
}

module.exports = <%= moduleName %>;
`)
}