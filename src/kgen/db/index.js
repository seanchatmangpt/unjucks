/**
 * Database Manager
 * Handles PostgreSQL, MongoDB, Neo4j, and Elasticsearch connections
 */

import { Pool } from 'pg';
import consola from 'consola';
import { EventEmitter } from 'events';

export class DatabaseManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.connections = new Map();
    this.status = 'uninitialized';
    this.healthCheckInterval = null;
  }

  /**
   * Initialize database connections
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Initialize PostgreSQL (primary database)
      if (this.config.postgres) {
        await this.initializePostgreSQL();
      }
      
      // Initialize optional databases
      await this.initializeOptionalDatabases();
      
      // Setup health monitoring
      this.setupHealthMonitoring();
      
      this.status = 'ready';
      consola.success('✅ Database Manager initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Database Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection
   */
  async initializePostgreSQL() {
    const pgConfig = {
      host: this.config.postgres.host,
      port: this.config.postgres.port,
      database: this.config.postgres.database,
      user: this.config.postgres.username,
      password: this.config.postgres.password,
      ssl: this.config.postgres.ssl,
      ...this.config.postgres.pool
    };

    const pool = new Pool(pgConfig);
    
    // Test connection
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version()');
      client.release();
      
      consola.success(`✅ PostgreSQL connected: ${result.rows[0].current_time}`);
      
      this.connections.set('postgres', {
        type: 'postgres',
        pool,
        config: pgConfig,
        status: 'connected'
      });
      
      // Setup connection error handling
      pool.on('error', (error) => {
        consola.error('PostgreSQL pool error:', error);
        this.emit('connection-error', { type: 'postgres', error });
      });
      
      // Setup tables if needed
      await this.setupPostgreSQLTables();
      
    } catch (error) {
      consola.error('❌ PostgreSQL connection failed:', error);
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  /**
   * Setup PostgreSQL tables
   */
  async setupPostgreSQLTables() {
    const pool = this.connections.get('postgres').pool;
    
    const tables = [
      // RDF triples table
      `CREATE TABLE IF NOT EXISTS rdf_triples (
        id BIGSERIAL PRIMARY KEY,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        object_type VARCHAR(20) NOT NULL DEFAULT 'literal',
        object_datatype TEXT,
        object_language VARCHAR(10),
        graph_name TEXT DEFAULT 'default',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(subject, predicate, object, graph_name)
      )`,
      
      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_rdf_subject ON rdf_triples(subject)`,
      `CREATE INDEX IF NOT EXISTS idx_rdf_predicate ON rdf_triples(predicate)`,
      `CREATE INDEX IF NOT EXISTS idx_rdf_object ON rdf_triples(object)`,
      `CREATE INDEX IF NOT EXISTS idx_rdf_graph ON rdf_triples(graph_name)`,
      `CREATE INDEX IF NOT EXISTS idx_rdf_spo ON rdf_triples(subject, predicate, object)`,
      
      // Namespaces table
      `CREATE TABLE IF NOT EXISTS namespaces (
        id SERIAL PRIMARY KEY,
        prefix VARCHAR(50) NOT NULL UNIQUE,
        uri TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      // SHACL shapes table
      `CREATE TABLE IF NOT EXISTS shacl_shapes (
        id SERIAL PRIMARY KEY,
        shape_id TEXT NOT NULL UNIQUE,
        shape_data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      
      // Validation results table
      `CREATE TABLE IF NOT EXISTS validation_results (
        id BIGSERIAL PRIMARY KEY,
        data_hash VARCHAR(64) NOT NULL,
        shape_id TEXT NOT NULL,
        conforms BOOLEAN NOT NULL,
        violations JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        INDEX(data_hash, shape_id)
      )`,
      
      // Query cache table
      `CREATE TABLE IF NOT EXISTS query_cache (
        id BIGSERIAL PRIMARY KEY,
        query_hash VARCHAR(64) NOT NULL UNIQUE,
        query_text TEXT NOT NULL,
        result_data JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at)`,
      
      // System metrics table
      `CREATE TABLE IF NOT EXISTS system_metrics (
        id BIGSERIAL PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC NOT NULL,
        metric_labels JSONB,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON system_metrics(metric_name, recorded_at)`
    ];

    try {
      for (const sql of tables) {
        await pool.query(sql);
      }
      consola.success('✅ PostgreSQL tables setup complete');
    } catch (error) {
      consola.error('❌ PostgreSQL table setup failed:', error);
      throw error;
    }
  }

  /**
   * Initialize optional databases
   */
  async initializeOptionalDatabases() {
    // MongoDB
    if (this.config.mongodb?.enabled) {
      await this.initializeMongoDB();
    }
    
    // Neo4j
    if (this.config.neo4j?.enabled) {
      await this.initializeNeo4j();
    }
    
    // Elasticsearch
    if (this.config.elasticsearch?.enabled) {
      await this.initializeElasticsearch();
    }
  }

  /**
   * Initialize MongoDB
   */
  async initializeMongoDB() {
    try {
      const { MongoClient } = await import('mongodb');
      
      const client = new MongoClient(this.config.mongodb.uri, this.config.mongodb.options);
      await client.connect();
      
      // Test connection
      await client.db().admin().ping();
      
      this.connections.set('mongodb', {
        type: 'mongodb',
        client,
        db: client.db(),
        status: 'connected'
      });
      
      consola.success('✅ MongoDB connected');
    } catch (error) {
      consola.warn('⚠️ MongoDB connection failed:', error.message);
      // Don't fail initialization for optional databases
    }
  }

  /**
   * Initialize Neo4j
   */
  async initializeNeo4j() {
    try {
      const neo4j = await import('neo4j-driver');
      
      const driver = neo4j.default.driver(
        this.config.neo4j.uri,
        neo4j.default.auth.basic(this.config.neo4j.username, this.config.neo4j.password)
      );
      
      // Test connection
      const session = driver.session();
      await session.run('RETURN 1');
      await session.close();
      
      this.connections.set('neo4j', {
        type: 'neo4j',
        driver,
        status: 'connected'
      });
      
      consola.success('✅ Neo4j connected');
    } catch (error) {
      consola.warn('⚠️ Neo4j connection failed:', error.message);
      // Don't fail initialization for optional databases
    }
  }

  /**
   * Initialize Elasticsearch
   */
  async initializeElasticsearch() {
    try {
      const { Client } = await import('@elastic/elasticsearch');
      
      const client = new Client({
        node: this.config.elasticsearch.node,
        maxRetries: this.config.elasticsearch.maxRetries,
        requestTimeout: this.config.elasticsearch.requestTimeout
      });
      
      // Test connection
      await client.ping();
      
      this.connections.set('elasticsearch', {
        type: 'elasticsearch',
        client,
        status: 'connected'
      });
      
      consola.success('✅ Elasticsearch connected');
    } catch (error) {
      consola.warn('⚠️ Elasticsearch connection failed:', error.message);
      // Don't fail initialization for optional databases
    }
  }

  /**
   * Setup health monitoring
   */
  setupHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health checks on all connections
   */
  async performHealthChecks() {
    for (const [name, connection] of this.connections) {
      try {
        await this.healthCheckConnection(name, connection);
      } catch (error) {
        consola.warn(`Health check failed for ${name}:`, error.message);
        connection.status = 'unhealthy';
        this.emit('connection-unhealthy', { name, error });
      }
    }
  }

  /**
   * Health check individual connection
   */
  async healthCheckConnection(name, connection) {
    switch (connection.type) {
      case 'postgres':
        const client = await connection.pool.connect();
        await client.query('SELECT 1');
        client.release();
        break;
        
      case 'mongodb':
        await connection.client.db().admin().ping();
        break;
        
      case 'neo4j':
        const session = connection.driver.session();
        await session.run('RETURN 1');
        await session.close();
        break;
        
      case 'elasticsearch':
        await connection.client.ping();
        break;
    }
    
    connection.status = 'healthy';
  }

  /**
   * Get connection by name
   */
  getConnection(name) {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new Error(`Database connection '${name}' not found`);
    }
    if (connection.status !== 'connected' && connection.status !== 'healthy') {
      throw new Error(`Database connection '${name}' is not available (status: ${connection.status})`);
    }
    return connection;
  }

  /**
   * Execute PostgreSQL query
   */
  async queryPostgreSQL(sql, params = []) {
    const connection = this.getConnection('postgres');
    const client = await connection.pool.connect();
    
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Store RDF triple in PostgreSQL
   */
  async storeTriple(subject, predicate, object, options = {}) {
    const {
      graph = 'default',
      objectType = 'literal',
      objectDatatype = null,
      objectLanguage = null
    } = options;

    const sql = `
      INSERT INTO rdf_triples (subject, predicate, object, object_type, object_datatype, object_language, graph_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (subject, predicate, object, graph_name) DO UPDATE SET
        updated_at = NOW()
      RETURNING id
    `;

    const params = [subject, predicate, object, objectType, objectDatatype, objectLanguage, graph];
    const result = await this.queryPostgreSQL(sql, params);
    
    return result.rows[0]?.id;
  }

  /**
   * Query RDF triples from PostgreSQL
   */
  async queryTriples(pattern = {}) {
    const { subject, predicate, object, graph } = pattern;
    
    let sql = 'SELECT * FROM rdf_triples WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (subject) {
      sql += ` AND subject = $${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }

    if (predicate) {
      sql += ` AND predicate = $${paramIndex}`;
      params.push(predicate);
      paramIndex++;
    }

    if (object) {
      sql += ` AND object = $${paramIndex}`;
      params.push(object);
      paramIndex++;
    }

    if (graph) {
      sql += ` AND graph_name = $${paramIndex}`;
      params.push(graph);
      paramIndex++;
    }

    sql += ' ORDER BY id LIMIT 10000';

    const result = await this.queryPostgreSQL(sql, params);
    return result.rows;
  }

  /**
   * Store namespace
   */
  async storeNamespace(prefix, uri) {
    const sql = `
      INSERT INTO namespaces (prefix, uri)
      VALUES ($1, $2)
      ON CONFLICT (prefix) DO UPDATE SET
        uri = EXCLUDED.uri
      RETURNING id
    `;

    const result = await this.queryPostgreSQL(sql, [prefix, uri]);
    return result.rows[0]?.id;
  }

  /**
   * Get all namespaces
   */
  async getNamespaces() {
    const sql = 'SELECT prefix, uri FROM namespaces ORDER BY prefix';
    const result = await this.queryPostgreSQL(sql);
    
    const namespaces = {};
    for (const row of result.rows) {
      namespaces[row.prefix] = row.uri;
    }
    
    return namespaces;
  }

  /**
   * Store SHACL shape
   */
  async storeShape(shapeId, shapeData) {
    const sql = `
      INSERT INTO shacl_shapes (shape_id, shape_data)
      VALUES ($1, $2)
      ON CONFLICT (shape_id) DO UPDATE SET
        shape_data = EXCLUDED.shape_data,
        updated_at = NOW()
      RETURNING id
    `;

    const result = await this.queryPostgreSQL(sql, [shapeId, JSON.stringify(shapeData)]);
    return result.rows[0]?.id;
  }

  /**
   * Get SHACL shape
   */
  async getShape(shapeId) {
    const sql = 'SELECT shape_data FROM shacl_shapes WHERE shape_id = $1';
    const result = await this.queryPostgreSQL(sql, [shapeId]);
    
    return result.rows[0]?.shape_data;
  }

  /**
   * Cache query result
   */
  async cacheQuery(queryHash, queryText, resultData, ttlSeconds = 3600) {
    const expiresAt = new Date(this.getDeterministicTimestamp() + ttlSeconds * 1000);
    
    const sql = `
      INSERT INTO query_cache (query_hash, query_text, result_data, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (query_hash) DO UPDATE SET
        result_data = EXCLUDED.result_data,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    `;

    await this.queryPostgreSQL(sql, [queryHash, queryText, JSON.stringify(resultData), expiresAt]);
  }

  /**
   * Get cached query result
   */
  async getCachedQuery(queryHash) {
    const sql = `
      SELECT result_data FROM query_cache 
      WHERE query_hash = $1 AND expires_at > NOW()
    `;
    
    const result = await this.queryPostgreSQL(sql, [queryHash]);
    return result.rows[0]?.result_data;
  }

  /**
   * Store system metric
   */
  async storeMetric(name, value, labels = {}) {
    const sql = `
      INSERT INTO system_metrics (metric_name, metric_value, metric_labels)
      VALUES ($1, $2, $3)
    `;

    await this.queryPostgreSQL(sql, [name, value, JSON.stringify(labels)]);
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const stats = {
      connections: {},
      postgres: {}
    };

    // Connection statuses
    for (const [name, connection] of this.connections) {
      stats.connections[name] = {
        type: connection.type,
        status: connection.status
      };
    }

    // PostgreSQL specific stats
    if (this.connections.has('postgres')) {
      try {
        const triplesResult = await this.queryPostgreSQL('SELECT COUNT(*) as count FROM rdf_triples');
        const namespacesResult = await this.queryPostgreSQL('SELECT COUNT(*) as count FROM namespaces');
        const shapesResult = await this.queryPostgreSQL('SELECT COUNT(*) as count FROM shacl_shapes');
        
        stats.postgres = {
          triples: parseInt(triplesResult.rows[0].count),
          namespaces: parseInt(namespacesResult.rows[0].count),
          shapes: parseInt(shapesResult.rows[0].count)
        };
      } catch (error) {
        stats.postgres.error = error.message;
      }
    }

    return stats;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, connection] of this.connections) {
      try {
        await this.healthCheckConnection(name, connection);
        results[name] = { status: 'healthy' };
      } catch (error) {
        results[name] = { status: 'unhealthy', error: error.message };
      }
    }
    
    return {
      status: Object.values(results).every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
      connections: results
    };
  }

  /**
   * Shutdown database connections
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Close all connections
    for (const [name, connection] of this.connections) {
      try {
        switch (connection.type) {
          case 'postgres':
            await connection.pool.end();
            break;
            
          case 'mongodb':
            await connection.client.close();
            break;
            
          case 'neo4j':
            await connection.driver.close();
            break;
            
          case 'elasticsearch':
            // Elasticsearch client doesn't need explicit closing
            break;
        }
        
        consola.info(`🛑 ${name} connection closed`);
      } catch (error) {
        consola.error(`Error closing ${name} connection:`, error);
      }
    }
    
    this.connections.clear();
    this.removeAllListeners();
    this.status = 'shutdown';
    
    consola.info('🛑 Database Manager shutdown complete');
  }
}