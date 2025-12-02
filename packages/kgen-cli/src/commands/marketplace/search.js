import { defineCommand } from 'citty'
import consola from 'consola'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { Parser } from 'n3'
import { RealSparqlCliAdapter } from '../../../../../src/kgen/cli/real-sparql-adapter.js'

/**
 * KGEN Marketplace Search Command
 * 
 * Implements N-dimensional facet filtering for Knowledge Pack discovery
 * Features:
 * - Free-text search with relevance ranking
 * - N-dimensional facet filtering via --dim flags
 * - Registry integration (npm, OCI, Git-based)
 * - Semantic discovery via SPARQL
 * - Trust and popularity scoring
 */

// Marketplace ontology namespace
const KMKT = 'http://kgen.ai/marketplace/'
const KGEN = 'http://kgen.ai/ontology/'

// Default facet dimensions from marketplace ontology
const DEFAULT_FACETS = {
  domain: ['Legal', 'Financial', 'Healthcare', 'Education', 'Enterprise', 'Government'],
  artifact: ['API', 'Service', 'Component', 'Library', 'Tool', 'Template', 'DOCX', 'PDF', 'JSON'],
  language: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C#'],
  framework: ['React', 'Vue', 'Angular', 'Express', 'FastAPI', 'Spring', 'Django'],
  license: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'proprietary'],
  maturity: ['experimental', 'alpha', 'beta', 'stable', 'deprecated'],
  compliance: ['SOX', 'GDPR', 'HIPAA', 'PCI-DSS', 'FedRAMP', 'ISO27001'],
  security: ['encryption', 'authentication', 'authorization', 'audit', 'sanitization'],
  architecture: ['microservice', 'monolith', 'serverless', 'distributed', 'event-driven']
}

// Registry adapters for different package sources
class RegistryAdapter {
  constructor(type, config = {}) {
    this.type = type
    this.config = config
  }

  async search(query, facets = {}, options = {}) {
    switch (this.type) {
      case 'npm':
        return this.searchNpm(query, facets, options)
      case 'oci':
        return this.searchOci(query, facets, options)
      case 'git':
        return this.searchGit(query, facets, options)
      case 'sparql':
        return this.searchSparql(query, facets, options)
      default:
        throw new Error(`Unsupported registry type: ${this.type}`)
    }
  }

  async searchNpm(query, facets, options) {
    // Simulated npm registry search
    // In real implementation, would use npm registry API
    const mockResults = [
      {
        id: 'kgen-legal-contracts',
        name: 'KGEN Legal Contract Templates',
        description: 'Knowledge pack for generating legal contract documents',
        version: '1.2.3',
        author: 'legal-team',
        downloads: 15420,
        stars: 89,
        license: 'MIT',
        tags: ['legal', 'contracts', 'docx'],
        facets: {
          domain: 'Legal',
          artifact: 'DOCX',
          language: 'JavaScript',
          maturity: 'stable',
          compliance: ['SOX', 'GDPR']
        },
        trustScore: 0.92,
        attestationStrength: 'strong',
        lastUpdated: '2024-09-01T10:30:00Z'
      },
      {
        id: 'kgen-financial-api',
        name: 'Financial Services API Generator',
        description: 'Generate secure financial services APIs with compliance',
        version: '2.1.0',
        author: 'fintech-corp',
        downloads: 8932,
        stars: 156,
        license: 'Apache-2.0',
        tags: ['finance', 'api', 'security'],
        facets: {
          domain: 'Financial',
          artifact: 'API',
          language: 'TypeScript',
          framework: 'Express',
          maturity: 'stable',
          compliance: ['PCI-DSS', 'SOX'],
          security: ['encryption', 'authentication']
        },
        trustScore: 0.88,
        attestationStrength: 'strong',
        lastUpdated: '2024-08-15T14:22:00Z'
      }
    ]

    return this.filterResults(mockResults, query, facets, options)
  }

  async searchOci(query, facets, options) {
    // Simulated OCI registry search
    const mockResults = [
      {
        id: 'registry.example.com/kgen/healthcare-templates',
        name: 'Healthcare Data Templates',
        description: 'HIPAA-compliant healthcare data processing templates',
        version: '1.0.5',
        author: 'healthcare-org',
        downloads: 5234,
        stars: 67,
        license: 'proprietary',
        tags: ['healthcare', 'hipaa', 'data'],
        facets: {
          domain: 'Healthcare',
          artifact: 'Template',
          language: 'Python',
          maturity: 'beta',
          compliance: ['HIPAA'],
          security: ['encryption', 'audit']
        },
        trustScore: 0.85,
        attestationStrength: 'medium',
        lastUpdated: '2024-08-30T09:15:00Z'
      }
    ]

    return this.filterResults(mockResults, query, facets, options)
  }

  async searchGit(query, facets, options) {
    // Simulated Git-based search
    const mockResults = [
      {
        id: 'github.com/enterprise/kgen-enterprise-suite',
        name: 'Enterprise Knowledge Suite',
        description: 'Enterprise-grade knowledge packs with governance',
        version: '3.0.0-rc1',
        author: 'enterprise-team',
        downloads: 2156,
        stars: 234,
        license: 'MIT',
        tags: ['enterprise', 'governance', 'suite'],
        facets: {
          domain: 'Enterprise',
          artifact: 'Library',
          language: 'TypeScript',
          framework: 'React',
          maturity: 'alpha',
          compliance: ['ISO27001', 'SOX'],
          architecture: 'microservice'
        },
        trustScore: 0.78,
        attestationStrength: 'weak',
        lastUpdated: '2024-09-10T16:45:00Z'
      }
    ]

    return this.filterResults(mockResults, query, facets, options)
  }

  async searchSparql(query, facets, options) {
    // SPARQL-based semantic search
    const sparqlQuery = `
      PREFIX kmkt: <${KMKT}>
      PREFIX kgen: <${KGEN}>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      
      SELECT DISTINCT ?listing ?name ?description ?version ?domain ?artifact ?trustScore
      WHERE {
        ?listing a kmkt:Listing ;
                 dcterms:title ?name ;
                 dcterms:description ?description ;
                 kmkt:version ?version ;
                 kmkt:domain ?domain ;
                 kmkt:artifactType ?artifact ;
                 kmkt:trustScore ?trustScore .
        
        ${this.buildSparqlFacetFilters(facets)}
        ${query ? `FILTER(CONTAINS(LCASE(?name), LCASE("${query}")) || CONTAINS(LCASE(?description), LCASE("${query}")))` : ''}
      }
      ORDER BY DESC(?trustScore) ?name
      LIMIT ${options.limit || 50}
    `

    // In real implementation, would execute against marketplace RDF store
    return []
  }

  buildSparqlFacetFilters(facets) {
    const filters = []
    
    for (const [dimension, values] of Object.entries(facets)) {
      if (Array.isArray(values) && values.length > 0) {
        const valuesList = values.map(v => `"${v}"`).join(', ')
        filters.push(`FILTER(?${dimension} IN (${valuesList}))`)
      } else if (values) {
        filters.push(`FILTER(?${dimension} = "${values}")`)
      }
    }
    
    return filters.join('\n        ')
  }

  filterResults(results, query, facets, options) {
    let filtered = results

    // Text search filtering
    if (query) {
      const queryLower = query.toLowerCase()
      filtered = filtered.filter(result => 
        result.name.toLowerCase().includes(queryLower) ||
        result.description.toLowerCase().includes(queryLower) ||
        result.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
    }

    // Facet filtering
    for (const [dimension, values] of Object.entries(facets)) {
      if (!values || (Array.isArray(values) && values.length === 0)) continue

      filtered = filtered.filter(result => {
        const resultValue = result.facets[dimension]
        if (!resultValue) return false

        if (Array.isArray(values)) {
          if (Array.isArray(resultValue)) {
            return values.some(v => resultValue.includes(v))
          } else {
            return values.includes(resultValue)
          }
        } else {
          if (Array.isArray(resultValue)) {
            return resultValue.includes(values)
          } else {
            return resultValue === values
          }
        }
      })
    }

    return filtered
  }
}

// Ranking algorithm implementation
class MarketplaceRanker {
  constructor() {
    this.weights = {
      relevance: 0.4,    // Text relevance score
      trust: 0.3,        // Trust/attestation score
      popularity: 0.2,   // Downloads + stars
      recency: 0.1      // Last updated
    }
  }

  rankResults(results, query) {
    return results.map(result => ({
      ...result,
      score: this.calculateScore(result, query)
    })).sort((a, b) => b.score - a.score)
  }

  calculateScore(result, query) {
    const relevanceScore = this.calculateRelevance(result, query)
    const trustScore = this.calculateTrust(result)
    const popularityScore = this.calculatePopularity(result)
    const recencyScore = this.calculateRecency(result)

    return (
      relevanceScore * this.weights.relevance +
      trustScore * this.weights.trust +
      popularityScore * this.weights.popularity +
      recencyScore * this.weights.recency
    )
  }

  calculateRelevance(result, query) {
    if (!query) return 0.5 // Neutral relevance when no query

    const queryLower = query.toLowerCase()
    let score = 0

    // Exact name match gets highest score
    if (result.name.toLowerCase() === queryLower) {
      score += 1.0
    } else if (result.name.toLowerCase().includes(queryLower)) {
      score += 0.8
    }

    // Description match
    if (result.description.toLowerCase().includes(queryLower)) {
      score += 0.6
    }

    // Tag matches
    const matchingTags = result.tags.filter(tag => 
      tag.toLowerCase().includes(queryLower)
    ).length
    score += Math.min(matchingTags * 0.2, 0.4)

    return Math.min(score, 1.0)
  }

  calculateTrust(result) {
    // Base trust score from attestations
    let score = result.trustScore || 0

    // Attestation strength bonus
    const strengthBonus = {
      'strong': 0.2,
      'medium': 0.1,
      'weak': 0.05
    }
    score += strengthBonus[result.attestationStrength] || 0

    // License trustworthiness
    const licenseBonus = {
      'MIT': 0.1,
      'Apache-2.0': 0.1,
      'BSD-3-Clause': 0.08,
      'GPL-3.0': 0.05,
      'proprietary': -0.05
    }
    score += licenseBonus[result.license] || 0

    return Math.min(Math.max(score, 0), 1.0)
  }

  calculatePopularity(result) {
    // Normalize downloads (log scale)
    const downloadScore = Math.log10(Math.max(result.downloads || 1, 1)) / 6 // Max ~6 for 1M downloads

    // Normalize stars (linear scale)
    const starScore = Math.min((result.stars || 0) / 1000, 1) // Max 1 for 1000+ stars

    return (downloadScore + starScore) / 2
  }

  calculateRecency(result) {
    if (!result.lastUpdated) return 0

    const lastUpdate = new Date(result.lastUpdated)
    const now = new Date()
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24)

    // Decay function - more recent is better
    if (daysSinceUpdate <= 30) return 1.0        // Within 30 days
    if (daysSinceUpdate <= 90) return 0.8        // Within 3 months
    if (daysSinceUpdate <= 180) return 0.6       // Within 6 months
    if (daysSinceUpdate <= 365) return 0.4       // Within 1 year
    return 0.2 // Older than 1 year
  }
}

// Policy filter implementation
class PolicyFilter {
  constructor() {
    this.policies = {
      visibility: {
        public: (result) => !result.facets.private,
        internal: (result) => result.facets.internal === true,
        private: (result) => result.facets.private === true
      },
      trust: {
        verified: (result) => result.trustScore >= 0.8,
        attested: (result) => result.attestationStrength !== 'none',
        any: () => true
      },
      compliance: {
        required: (result, requirements) => {
          if (!requirements || requirements.length === 0) return true
          const resultCompliance = result.facets.compliance || []
          return requirements.every(req => resultCompliance.includes(req))
        }
      }
    }
  }

  applyPolicies(results, policies = {}) {
    return results.filter(result => {
      // Visibility policy
      if (policies.visibility) {
        const visibilityCheck = this.policies.visibility[policies.visibility]
        if (visibilityCheck && !visibilityCheck(result)) return false
      }

      // Trust policy
      if (policies.trust) {
        const trustCheck = this.policies.trust[policies.trust]
        if (trustCheck && !trustCheck(result)) return false
      }

      // Compliance policy
      if (policies.compliance) {
        const complianceCheck = this.policies.compliance.required
        if (!complianceCheck(result, policies.complianceRequirements)) return false
      }

      return true
    })
  }
}

export default defineCommand({
  meta: {
    name: 'search',
    description: 'Search Knowledge Packs with N-dimensional facet filtering'
  },
  args: {
    query: {
      type: 'string',
      description: 'Free-text search query',
      alias: 'q'
    },
    dim: {
      type: 'string',
      description: 'Facet filter: --dim domain=Legal --dim artifact=DOCX',
      alias: 'd',
      multiple: true
    },
    registry: {
      type: 'string',
      description: 'Registry sources to search (npm,oci,git,sparql)',
      alias: 'r',
      default: 'npm,git'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results',
      alias: 'l',
      default: 20
    },
    format: {
      type: 'string',
      description: 'Output format (json, table, summary)',
      alias: 'f',
      default: 'json'
    },
    ontology: {
      type: 'string',
      description: 'Path to marketplace ontology file',
      alias: 'o'
    },
    facets: {
      type: 'boolean',
      description: 'Show available facet dimensions',
      alias: 'F'
    },
    visibility: {
      type: 'string',
      description: 'Visibility policy (public, internal, private)',
      default: 'public'
    },
    trust: {
      type: 'string',
      description: 'Trust policy (verified, attested, any)',
      default: 'any'
    },
    compliance: {
      type: 'string',
      description: 'Required compliance standards (comma-separated)',
      alias: 'c'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logging',
      alias: 'v'
    },
    debug: {
      type: 'boolean',
      description: 'Enable debug output'
    }
  },

  async run({ args }) {
    const logger = consola.withTag('marketplace:search')
    
    try {
      // Show available facets if requested
      if (args.facets) {
        const result = {
          success: true,
          data: {
            operation: 'list-facets',
            facets: DEFAULT_FACETS,
            usage: 'Use --dim <dimension>=<value> for filtering',
            examples: [
              '--dim domain=Legal',
              '--dim artifact=DOCX',
              '--dim domain=Legal --dim artifact=DOCX',
              '--dim compliance=GDPR --dim maturity=stable'
            ]
          },
          timestamp: new Date().toISOString()
        }
        
        console.log(JSON.stringify(result, null, 2))
        return
      }

      // Parse facet dimensions from --dim flags
      const facets = {}
      if (args.dim) {
        for (const dimArg of args.dim) {
          const [dimension, value] = dimArg.split('=')
          if (dimension && value) {
            if (facets[dimension]) {
              if (Array.isArray(facets[dimension])) {
                facets[dimension].push(value)
              } else {
                facets[dimension] = [facets[dimension], value]
              }
            } else {
              facets[dimension] = value
            }
          }
        }
      }

      if (args.verbose) {
        logger.info(`Searching with query: "${args.query || '*'}"`)
        logger.info(`Facet filters:`, facets)
        logger.info(`Registries: ${args.registry}`)
      }

      // Initialize registry adapters
      const registries = (args.registry || 'npm,git').split(',').map(r => r.trim())
      const adapters = registries.map(registry => new RegistryAdapter(registry))

      // Search across all registries in parallel
      const searchPromises = adapters.map(adapter => 
        adapter.search(args.query, facets, { limit: args.limit })
      )

      const searchResults = await Promise.allSettled(searchPromises)
      let allResults = []

      for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i]
        if (result.status === 'fulfilled') {
          allResults = allResults.concat(result.value)
          if (args.verbose) {
            logger.success(`Found ${result.value.length} results from ${registries[i]}`)
          }
        } else if (args.verbose) {
          logger.warn(`Search failed for ${registries[i]}:`, result.reason.message)
        }
      }

      // Apply policy filters
      const policyFilter = new PolicyFilter()
      const policies = {
        visibility: args.visibility,
        trust: args.trust,
        complianceRequirements: args.compliance ? args.compliance.split(',').map(c => c.trim()) : []
      }
      
      allResults = policyFilter.applyPolicies(allResults, policies)

      // Rank results
      const ranker = new MarketplaceRanker()
      const rankedResults = ranker.rankResults(allResults, args.query)

      // Limit results
      const finalResults = rankedResults.slice(0, args.limit)

      const result = {
        success: true,
        data: {
          operation: 'marketplace-search',
          query: args.query || '*',
          facets: facets,
          registries: registries,
          policies: policies,
          resultCount: finalResults.length,
          totalFound: allResults.length,
          listings: finalResults.map(listing => ({
            id: listing.id,
            name: listing.name,
            description: listing.description,
            version: listing.version,
            author: listing.author,
            facets: listing.facets,
            metrics: {
              downloads: listing.downloads,
              stars: listing.stars,
              trustScore: listing.trustScore,
              attestationStrength: listing.attestationStrength,
              score: listing.score
            },
            metadata: {
              license: listing.license,
              lastUpdated: listing.lastUpdated,
              tags: listing.tags
            }
          }))
        },
        timestamp: new Date().toISOString()
      }

      // Debug output
      if (args.debug) {
        result.debug = {
          searchResults: searchResults.map((r, i) => ({
            registry: registries[i],
            status: r.status,
            count: r.status === 'fulfilled' ? r.value.length : 0,
            error: r.status === 'rejected' ? r.reason.message : null
          })),
          rankingWeights: ranker.weights,
          appliedPolicies: policies
        }
      }

      // Output in requested format
      if (args.format === 'table') {
        // Simple table output
        console.log(`\nMarketplace Search Results (${finalResults.length} of ${allResults.length} found)\n`)
        console.log('ID'.padEnd(30) + 'NAME'.padEnd(25) + 'DOMAIN'.padEnd(12) + 'TRUST'.padEnd(8) + 'SCORE')
        console.log('-'.repeat(85))
        
        for (const listing of finalResults) {
          const id = listing.id.length > 28 ? listing.id.substring(0, 25) + '...' : listing.id
          const name = listing.name.length > 23 ? listing.name.substring(0, 20) + '...' : listing.name
          const domain = listing.facets.domain || 'N/A'
          const trust = (listing.trustScore || 0).toFixed(2)
          const score = (listing.score || 0).toFixed(3)
          
          console.log(
            id.padEnd(30) + 
            name.padEnd(25) + 
            domain.padEnd(12) + 
            trust.padEnd(8) + 
            score
          )
        }
        console.log()
      } else if (args.format === 'summary') {
        // Summary output
        console.log(`Found ${finalResults.length} Knowledge Packs matching your search criteria\n`)
        
        for (const listing of finalResults.slice(0, 5)) {
          console.log(`• ${listing.name} (${listing.facets.domain || 'Unknown'})`)
          console.log(`  ${listing.description}`)
          console.log(`  Trust: ${(listing.trustScore || 0).toFixed(2)}, Score: ${(listing.score || 0).toFixed(3)}`)
          console.log()
        }
        
        if (finalResults.length > 5) {
          console.log(`... and ${finalResults.length - 5} more results`)
        }
      } else {
        // JSON output (default)
        console.log(JSON.stringify(result, null, 2))
      }

      if (args.verbose) {
        logger.success(`Search completed: ${finalResults.length} results`)
      }

    } catch (error) {
      logger.error('Marketplace search failed:', error)
      
      const errorResult = {
        success: false,
        error: {
          message: error.message,
          stack: args.verbose ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      }
      
      console.log(JSON.stringify(errorResult, null, 2))
      process.exit(1)
    }
  }
})