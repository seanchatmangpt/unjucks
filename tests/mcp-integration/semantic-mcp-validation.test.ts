/**
 * Semantic MCP Tool Validation Tests
 * Tests RDF/Turtle integration with MCP tools for semantic operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { McpRequest, McpResponse, McpServerProcess } from '../types/mcp-protocol'

// Mock semantic MCP server interface for testing
class SemanticMcpServer {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test', ENABLE_SEMANTIC: 'true' }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('Semantic engine initialized') || output.includes('RDF support enabled')) {
          this.setupResponseHandler()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        if (error.includes('error')) {
          reject(new Error(`Semantic MCP server error: ${error}`))
        }
      })

      this.process.on('error', (error) => {
        reject(new Error(`Failed to spawn semantic MCP server: ${error.message}`))
      })

      setTimeout(() => {
        reject(new Error('Semantic MCP server startup timeout'))
      }, 15000)
    })
  }

  private setupResponseHandler(): void {
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
            console.warn('Failed to parse semantic MCP response:', line)
          }
        }
      }
    })
  }

  async send(request: McpRequest): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Semantic MCP server not available'))
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
          reject(new Error(`Semantic MCP request timeout for message ${id}`))
        }
      }, 10000)
    })
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
        }, 2000)
      })
    }
  }
}

describe('Semantic MCP Tool Validation', () => {
  let semanticServer: SemanticMcpServer
  let testDataDir: string

  beforeAll(async () => {
    testDataDir = join(process.cwd(), 'tests', 'fixtures', 'semantic-test-data')
    await mkdir(testDataDir, { recursive: true })

    // Create test RDF/Turtle files
    await createSemanticTestData(testDataDir)

    semanticServer = new SemanticMcpServer()
    await semanticServer.start()
  })

  afterAll(async () => {
    if (semanticServer) {
      await semanticServer.close()
    }
    await rm(testDataDir, { recursive: true, force: true })
  })

  describe('RDF Data Loading and Validation', () => {
    it('should load RDF data via MCP semantic tools', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_load_rdf',
          arguments: {
            source: join(testDataDir, 'person.ttl'),
            format: 'turtle',
            validate: true
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.success).toBe(true)
      expect(result.triples).toBeGreaterThan(0)
      expect(result.validation).toBeDefined()
      expect(result.validation.valid).toBe(true)
    })

    it('should validate RDF schema compliance', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_validate_schema',
          arguments: {
            dataFile: join(testDataDir, 'person.ttl'),
            schemaFile: join(testDataDir, 'person-schema.ttl'),
            validationType: 'shacl'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should execute SPARQL queries via MCP', async () => {
      const sparqlQuery = `
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?name ?email
        WHERE {
          ?person foaf:name ?name .
          ?person foaf:mbox ?email .
        }
      `

      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_sparql_query',
          arguments: {
            dataSource: join(testDataDir, 'person.ttl'),
            query: sparqlQuery,
            format: 'json'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.results.bindings).toBeDefined()
      expect(Array.isArray(result.results.bindings)).toBe(true)
    })

    it('should transform RDF to template variables', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_rdf_to_variables',
          arguments: {
            rdfFile: join(testDataDir, 'person.ttl'),
            mapping: {
              'foaf:name': 'personName',
              'foaf:mbox': 'email',
              'foaf:knows': 'connections'
            }
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.variables).toBeDefined()
      expect(result.variables.personName).toBeDefined()
      expect(result.variables.email).toBeDefined()
    })
  })

  describe('Semantic Template Generation', () => {
    it('should generate templates from RDF ontologies', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_generate_templates',
          arguments: {
            ontologyFile: join(testDataDir, 'organization-ontology.ttl'),
            templateType: 'class-based',
            outputFormat: 'nunjucks'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.templates).toBeDefined()
      expect(Array.isArray(result.templates)).toBe(true)
      expect(result.templates.length).toBeGreaterThan(0)
    })

    it('should validate semantic template consistency', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_validate_templates',
          arguments: {
            templateDir: join(testDataDir, 'templates'),
            ontologyFile: join(testDataDir, 'organization-ontology.ttl'),
            checkConsistency: true
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.consistent).toBe(true)
      expect(result.inconsistencies).toHaveLength(0)
    })
  })

  describe('Semantic Workflow Integration', () => {
    it('should orchestrate semantic-aware swarms', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_swarm_orchestrate',
          arguments: {
            ontologyContext: join(testDataDir, 'domain-ontology.ttl'),
            task: 'Generate API documentation from semantic model',
            agents: ['semantic-analyst', 'api-generator', 'doc-writer'],
            reasoning: 'owl'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.swarm).toBeDefined()
      expect(result.semanticContext).toBeDefined()
      expect(result.reasoning.enabled).toBe(true)
    })

    it('should perform semantic reasoning in workflows', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_reasoning_workflow',
          arguments: {
            knowledge: join(testDataDir, 'knowledge-base.ttl'),
            rules: join(testDataDir, 'business-rules.ttl'),
            inferenceEngine: 'pellet',
            outputFormat: 'turtle'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.inferences).toBeDefined()
      expect(result.newTriples).toBeGreaterThan(0)
      expect(result.consistency).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed RDF gracefully', async () => {
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_load_rdf',
          arguments: {
            source: join(testDataDir, 'malformed.ttl'),
            format: 'turtle',
            validate: true,
            strict: false
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should validate large RDF datasets efficiently', async () => {
      const startTime = Date.now()
      
      const response = await semanticServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'semantic_validate_large_dataset',
          arguments: {
            source: join(testDataDir, 'large-dataset.ttl'),
            streaming: true,
            batchSize: 10000,
            validationLevel: 'basic'
          }
        }
      })

      const duration = Date.now() - startTime
      
      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(duration).toBeLessThan(30000) // Should complete in under 30 seconds
      
      const result = JSON.parse(response.result.content[0].text)
      expect(result.processed).toBeGreaterThan(100000) // Large dataset
      expect(result.streaming).toBe(true)
    })

    it('should handle concurrent semantic operations', async () => {
      const operations = [
        semanticServer.send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'semantic_sparql_query',
            arguments: {
              dataSource: join(testDataDir, 'person.ttl'),
              query: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10'
            }
          }
        }),
        semanticServer.send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'semantic_validate_schema',
            arguments: {
              dataFile: join(testDataDir, 'organization.ttl'),
              schemaFile: join(testDataDir, 'org-schema.ttl')
            }
          }
        }),
        semanticServer.send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'semantic_rdf_to_variables',
            arguments: {
              rdfFile: join(testDataDir, 'project.ttl'),
              mapping: { 'dc:title': 'projectName' }
            }
          }
        })
      ]

      const responses = await Promise.all(operations)
      
      for (const response of responses) {
        expect(response.error).toBeUndefined()
        expect(response.result).toBeDefined()
      }
    })
  })
})

/**
 * Helper function to create semantic test data
 */
async function createSemanticTestData(dir: string): Promise<void> {
  // Person.ttl - Basic FOAF data
  const personTtl = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<http://example.com/person/john> rdf:type foaf:Person ;
    foaf:name "John Doe" ;
    foaf:mbox <mailto:john.doe@example.com> ;
    foaf:knows <http://example.com/person/jane> .

<http://example.com/person/jane> rdf:type foaf:Person ;
    foaf:name "Jane Smith" ;
    foaf:mbox <mailto:jane.smith@example.com> .
  `

  // Person schema (SHACL)
  const personSchema = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://example.com/shapes/PersonShape> a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path foaf:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path foaf:mbox ;
        sh:nodeKind sh:IRI ;
        sh:minCount 1 ;
    ] .
  `

  // Organization ontology
  const organizationOntology = `
@prefix org: <http://www.w3.org/ns/org#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

org:Organization a owl:Class ;
    rdfs:label "Organization" ;
    rdfs:comment "A formal organization" .

org:OrganizationalUnit a owl:Class ;
    rdfs:subClassOf org:Organization ;
    rdfs:label "Organizational Unit" .

org:Person a owl:Class ;
    rdfs:label "Person" ;
    owl:equivalentClass foaf:Person .

org:memberOf a owl:ObjectProperty ;
    rdfs:domain org:Person ;
    rdfs:range org:Organization .
  `

  // Malformed TTL for error testing
  const malformedTtl = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<http://example.com/broken> rdf:type foaf:Person
    foaf:name "Missing semicolon" // This is malformed
    foaf:mbox <mailto:broken@example.com>
  `

  // Write test files
  await writeFile(join(dir, 'person.ttl'), personTtl)
  await writeFile(join(dir, 'person-schema.ttl'), personSchema)
  await writeFile(join(dir, 'organization-ontology.ttl'), organizationOntology)
  await writeFile(join(dir, 'malformed.ttl'), malformedTtl)

  // Create large dataset for performance testing
  const largeDatasetParts = ['@prefix ex: <http://example.com/> .']
  for (let i = 0; i < 100000; i++) {
    largeDatasetParts.push(`ex:entity${i} ex:hasValue ${i} .`)
  }
  await writeFile(join(dir, 'large-dataset.ttl'), largeDatasetParts.join('\n'))
}