const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { SparqlEndpointFetcher } = require('fetch-sparql-endpoint');
const NodeCache = require('node-cache');
const winston = require('winston');

// Configuration
const config = {
  port: process.env.PORT || 3000,
  sparqlEndpoint: process.env.SPARQL_ENDPOINT || 'http://localhost:3030/ds/sparql',
  updateEndpoint: process.env.UPDATE_ENDPOINT || 'http://localhost:3030/ds/update',
  graphStoreEndpoint: process.env.GRAPH_STORE_ENDPOINT || 'http://localhost:3030/ds/data',
  defaultGraphUri: process.env.DEFAULT_GRAPH_URI || 'http://example.org/kg/enterprise',
  apiKey: process.env.API_KEY || 'kg-api-key-123',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  cacheTtl: parseInt(process.env.CACHE_TTL) || 300 // 5 minutes
};

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/app/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/app/logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize cache
const cache = new NodeCache({ stdTTL: config.cacheTtl });

// Initialize SPARQL fetcher
const sparqlFetcher = new SparqlEndpointFetcher();

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info('Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// API Key authentication middleware
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({ 
      error: 'Invalid or missing API key',
      code: 'UNAUTHORIZED'
    });
  }
  
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: this.getDeterministicDate().toISOString(),
    version: '1.0.0',
    services: {
      api: 'running',
      sparql: 'connected',
      cache: 'active'
    }
  });
});

// Knowledge Graph Statistics
app.get('/api/v1/stats', authenticate, async (req, res) => {
  try {
    const cacheKey = 'kg_stats';
    let stats = cache.get(cacheKey);
    
    if (!stats) {
      const query = `
        PREFIX schema: <http://schema.org/>
        PREFIX kg: <${config.defaultGraphUri.replace(/\/$/, '')}/> 
        
        SELECT 
          (COUNT(DISTINCT ?s) AS ?totalSubjects)
          (COUNT(DISTINCT ?p) AS ?totalPredicates) 
          (COUNT(DISTINCT ?o) AS ?totalObjects)
          (COUNT(*) AS ?totalTriples)
        WHERE {
          GRAPH <${config.defaultGraphUri}> {
            ?s ?p ?o .
          }
        }
      `;

      const bindings = await sparqlFetcher.fetchBindings(config.sparqlEndpoint, query);
      const result = bindings[0];
      
      stats = {
        totalTriples: parseInt(result.totalTriples.value),
        totalSubjects: parseInt(result.totalSubjects.value),
        totalPredicates: parseInt(result.totalPredicates.value),
        totalObjects: parseInt(result.totalObjects.value),
        lastUpdated: this.getDeterministicDate().toISOString()
      };
      
      cache.set(cacheKey, stats);
    }
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Statistics query failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      code: 'STATS_ERROR'
    });
  }
});

// Execute SPARQL Query
app.post('/api/v1/query', authenticate, async (req, res) => {
  try {
    const { query, format = 'json' } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query parameter is required and must be a string',
        code: 'INVALID_QUERY'
      });
    }

    // Security: Prevent UPDATE/INSERT/DELETE operations in query endpoint
    const upperQuery = query.toUpperCase();
    if (upperQuery.includes('INSERT') || upperQuery.includes('DELETE') || upperQuery.includes('DROP')) {
      return res.status(403).json({
        error: 'Modification operations not allowed in query endpoint',
        code: 'FORBIDDEN_OPERATION'
      });
    }

    const startTime = this.getDeterministicTimestamp();
    
    let results;
    if (query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().startsWith('ASK')) {
      results = await sparqlFetcher.fetchBindings(config.sparqlEndpoint, query);
    } else if (query.trim().toUpperCase().startsWith('CONSTRUCT') || query.trim().toUpperCase().startsWith('DESCRIBE')) {
      results = await sparqlFetcher.fetchTriples(config.sparqlEndpoint, query);
    } else {
      return res.status(400).json({
        error: 'Unsupported query type',
        code: 'UNSUPPORTED_QUERY'
      });
    }

    const executionTime = this.getDeterministicTimestamp() - startTime;
    
    logger.info('Query executed', {
      executionTime,
      resultCount: Array.isArray(results) ? results.length : 0,
      queryType: query.trim().split(' ')[0].toUpperCase()
    });

    res.json({
      results,
      metadata: {
        executionTime,
        resultCount: Array.isArray(results) ? results.length : 0,
        format,
        timestamp: this.getDeterministicDate().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Query execution failed', { 
      error: error.message,
      query: req.body.query 
    });
    
    res.status(500).json({ 
      error: 'Query execution failed',
      code: 'QUERY_ERROR',
      message: error.message
    });
  }
});

// Entity Search
app.get('/api/v1/entities/search', authenticate, async (req, res) => {
  try {
    const { q, type, limit = 50, offset = 0 } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: 'Search query parameter "q" is required',
        code: 'MISSING_QUERY'
      });
    }

    const typeFilter = type ? `?entity a schema:${type} .` : '';
    
    const query = `
      PREFIX schema: <http://schema.org/>
      PREFIX kg: <${config.defaultGraphUri.replace(/\/$/, '')}/> 
      
      SELECT DISTINCT ?entity ?name ?type ?description
      WHERE {
        GRAPH <${config.defaultGraphUri}> {
          ?entity schema:name ?name ;
                  a ?type .
          ${typeFilter}
          OPTIONAL { ?entity schema:description ?description }
          FILTER(REGEX(?name, "${q}", "i"))
        }
      }
      ORDER BY ?name
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    const results = await sparqlFetcher.fetchBindings(config.sparqlEndpoint, query);
    
    res.json({
      entities: results.map(binding => ({
        uri: binding.entity.value,
        name: binding.name.value,
        type: binding.type.value,
        description: binding.description?.value || null
      })),
      metadata: {
        query: q,
        type: type || null,
        limit: parseInt(limit),
        offset: parseInt(offset),
        resultCount: results.length
      }
    });
    
  } catch (error) {
    logger.error('Entity search failed', { 
      error: error.message,
      query: req.query.q 
    });
    
    res.status(500).json({ 
      error: 'Entity search failed',
      code: 'SEARCH_ERROR',
      message: error.message
    });
  }
});

// Entity Details
app.get('/api/v1/entities/:id', authenticate, async (req, res) => {
  try {
    const entityId = req.params.id;
    const entityUri = entityId.startsWith('http') ? entityId : `${config.defaultGraphUri.replace(/\/$/, '')}/${entityId}`;
    
    const query = `
      PREFIX schema: <http://schema.org/>
      PREFIX kg: <${config.defaultGraphUri.replace(/\/$/, '')}/> 
      
      SELECT ?property ?value
      WHERE {
        GRAPH <${config.defaultGraphUri}> {
          <${entityUri}> ?property ?value .
        }
      }
      ORDER BY ?property
    `;

    const results = await sparqlFetcher.fetchBindings(config.sparqlEndpoint, query);
    
    if (results.length === 0) {
      return res.status(404).json({
        error: 'Entity not found',
        code: 'ENTITY_NOT_FOUND',
        uri: entityUri
      });
    }

    const entity = {
      uri: entityUri,
      properties: results.reduce((props, binding) => {
        const property = binding.property.value;
        const value = binding.value.value;
        
        if (!props[property]) {
          props[property] = [];
        }
        props[property].push(value);
        
        return props;
      }, {})
    };
    
    res.json({ entity });
    
  } catch (error) {
    logger.error('Entity retrieval failed', { 
      error: error.message,
      entityId: req.params.id 
    });
    
    res.status(500).json({ 
      error: 'Entity retrieval failed',
      code: 'ENTITY_ERROR',
      message: error.message
    });
  }
});

// Entity Relationships
app.get('/api/v1/entities/:id/relationships', authenticate, async (req, res) => {
  try {
    const entityId = req.params.id;
    const entityUri = entityId.startsWith('http') ? entityId : `${config.defaultGraphUri.replace(/\/$/, '')}/${entityId}`;
    const { direction = 'both', limit = 100 } = req.query;
    
    let patterns = [];
    
    if (direction === 'outgoing' || direction === 'both') {
      patterns.push(`
        <${entityUri}> ?predicate ?target .
        OPTIONAL { ?target schema:name ?targetName }
        BIND("outgoing" AS ?direction)
      `);
    }
    
    if (direction === 'incoming' || direction === 'both') {
      patterns.push(`
        ?source ?predicate <${entityUri}> .
        OPTIONAL { ?source schema:name ?sourceName }
        BIND("incoming" AS ?direction)
        BIND(?source AS ?target)
        BIND(?sourceName AS ?targetName)
      `);
    }

    const query = `
      PREFIX schema: <http://schema.org/>
      PREFIX kg: <${config.defaultGraphUri.replace(/\/$/, '')}/> 
      
      SELECT DISTINCT ?predicate ?target ?targetName ?direction
      WHERE {
        GRAPH <${config.defaultGraphUri}> {
          {
            ${patterns.join('} UNION {')}
          }
          FILTER(?predicate != a)
        }
      }
      ORDER BY ?direction ?predicate
      LIMIT ${parseInt(limit)}
    `;

    const results = await sparqlFetcher.fetchBindings(config.sparqlEndpoint, query);
    
    const relationships = results.map(binding => ({
      predicate: binding.predicate.value,
      target: {
        uri: binding.target.value,
        name: binding.targetName?.value || null
      },
      direction: binding.direction.value
    }));
    
    res.json({
      entity: entityUri,
      relationships,
      metadata: {
        direction,
        limit: parseInt(limit),
        resultCount: relationships.length
      }
    });
    
  } catch (error) {
    logger.error('Relationship retrieval failed', { 
      error: error.message,
      entityId: req.params.id 
    });
    
    res.status(500).json({ 
      error: 'Relationship retrieval failed',
      code: 'RELATIONSHIP_ERROR',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { 
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Start server
app.listen(config.port, () => {
  logger.info(`Knowledge Graph API server running on port ${config.port}`, {
    sparqlEndpoint: config.sparqlEndpoint,
    defaultGraph: config.defaultGraphUri
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});