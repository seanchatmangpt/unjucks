import { defineCommand } from 'citty'
import consola from 'consola'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { RealSparqlCliAdapter } from '../../../../../src/kgen/cli/real-sparql-adapter.js'

export default defineCommand({
  meta: {
    name: 'sparql',
    description: 'Execute SPARQL queries and graph indexing operations'
  },
  args: {
    graph: {
      type: 'string',
      description: 'Path to RDF graph file (Turtle, N-Triples, etc.)',
      alias: 'g'
    },
    query: {
      type: 'string',
      description: 'SPARQL query string to execute',
      alias: 'q'
    },
    queryFile: {
      type: 'string',
      description: 'Path to file containing SPARQL query',
      alias: 'f'
    },
    format: {
      type: 'string',
      description: 'Output format (json, csv, table, turtle)',
      alias: 'o',
      default: 'json'
    },
    index: {
      type: 'boolean',
      description: 'Build graph index mapping subjects to artifacts',
      alias: 'i'
    },
    outputDir: {
      type: 'string',
      description: 'Output directory for index files',
      alias: 'd',
      default: '.kgen/index'
    },
    templateQueries: {
      type: 'string',
      description: 'Execute template analysis queries for given template URI',
      alias: 't'
    },
    artifactDeps: {
      type: 'string',
      description: 'Resolve dependencies for comma-separated artifact URIs',
      alias: 'a'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logging',
      alias: 'v'
    },
    timeout: {
      type: 'number',
      description: 'Query timeout in milliseconds',
      default: 30000
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of query results',
      default: 10000
    },
    ask: {
      type: 'string',
      description: 'Execute ASK query (returns boolean)',
    },
    construct: {
      type: 'string',
      description: 'Execute CONSTRUCT query (returns RDF)',
    },
    describe: {
      type: 'string',
      description: 'Execute DESCRIBE query for given URI',
    }
  },
  async run({ args }) {
    const logger = consola.withTag('query:sparql')
    
    try {
      // Validate required arguments
      if (!args.graph) {
        throw new Error('Graph file path is required (--graph/-g)')
      }
      
      if (!existsSync(args.graph)) {
        throw new Error(`Graph file not found: ${args.graph}`)
      }
      
      // Initialize SPARQL adapter
      const adapter = new RealSparqlCliAdapter({
        outputFormat: args.format,
        enableVerbose: args.verbose,
        indexOutputDir: args.outputDir,
        queryTimeout: args.timeout,
        maxResults: args.maxResults
      })
      
      await adapter.initialize()
      
      // Load the graph
      const loadResult = await adapter.loadGraph(args.graph)
      
      if (args.verbose) {
        logger.info(`Loaded graph with ${loadResult.tripleCount} triples`)
      }
      
      let result = {
        success: true,
        data: {
          operation: 'sparql',
          graph: args.graph,
          timestamp: this.getDeterministicDate().toISOString()
        }
      }
      
      // Handle different operations
      if (args.index) {
        // Build graph index
        const indexResult = await adapter.executeGraphIndex(args.graph)
        result.data.operation = 'index'
        result.data.index = indexResult
        
        if (args.verbose) {
          logger.success(`Graph index built with ${indexResult.statistics.subjects} subjects`)
        }
      } else if (args.templateQueries) {
        // Execute template queries
        const templateResult = await adapter.executeTemplateQueries(args.templateQueries)
        result.data.operation = 'template-queries'
        result.data.templateUri = args.templateQueries
        result.data.results = templateResult
        
        if (args.verbose) {
          logger.success(`Template queries executed for ${args.templateQueries}`)
        }
      } else if (args.artifactDeps) {
        // Resolve artifact dependencies
        const artifactUris = args.artifactDeps.split(',').map(uri => uri.trim())
        const depsResult = await adapter.executeArtifactDependencies(artifactUris)
        result.data.operation = 'artifact-dependencies'
        result.data.artifacts = artifactUris
        result.data.dependencies = depsResult
        
        if (args.verbose) {
          logger.success(`Dependencies resolved for ${artifactUris.length} artifacts`)
        }
      } else {
        // Execute query
        let query = args.query
        
        // Load query from file if specified
        if (args.queryFile) {
          if (!existsSync(args.queryFile)) {
            throw new Error(`Query file not found: ${args.queryFile}`)
          }
          query = await readFile(args.queryFile, 'utf8')
        }
        
        // Handle different query types
        if (args.ask) {
          query = args.ask
          result.data.queryType = 'ASK'
        } else if (args.construct) {
          query = args.construct
          result.data.queryType = 'CONSTRUCT'
        } else if (args.describe) {
          query = `DESCRIBE <${args.describe}>`
          result.data.queryType = 'DESCRIBE'
        } else if (!query) {
          // Default query to show all triples (limited)
          query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 100'
        }
        
        const queryResult = await adapter.executeQuery(query, {
          format: args.format,
          limit: args.maxResults
        })
        
        result.data.query = query.length > 100 ? query.substring(0, 100) + '...' : query
        result.data.results = queryResult
        result.data.resultCount = queryResult.metadata?.resultCount || 0
        
        if (args.verbose) {
          logger.success(`Query executed, ${result.data.resultCount} results`)
        }
      }
      
      // Output results based on format
      if (args.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else if (args.format === 'csv' && result.data.results?.results?.results?.bindings) {
        // Simple CSV output
        const bindings = result.data.results.results.results.bindings
        if (bindings.length > 0) {
          const headers = Object.keys(bindings[0])
          console.log(headers.join(','))
          
          for (const binding of bindings) {
            const row = headers.map(header => binding[header]?.value || '')
            console.log(row.join(','))
          }
        }
      } else {
        console.log(JSON.stringify(result, null, 2))
      }
      
    } catch (error) {
      logger.error('SPARQL operation failed:', error)
      
      const errorResult = {
        success: false,
        error: {
          message: error.message,
          stack: args.verbose ? error.stack : undefined
        },
        timestamp: this.getDeterministicDate().toISOString()
      }
      
      console.log(JSON.stringify(errorResult, null, 2))
      process.exit(1)
    }
  }
})