import { Pool } from 'pg';
import { createClient } from 'redis';
import { env } from './environment.js';

/**
 * @typedef {Object} DatabaseConfig
 * @property {import('pg').PoolConfig} postgres
 * @property {Object} redis
 * @property {string} redis.url
 * @property {number} redis.maxRetriesPerRequest
 * @property {number} redis.retryDelayOnFailover
 * @property {boolean} redis.lazyConnect
 */

/** @type {DatabaseConfig} */
export const databaseConfig = {
  postgres: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL_ENABLED ? { rejectUnauthorized: false } : false,
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT,
    statement_timeout: env.DB_STATEMENT_TIMEOUT,
    query_timeout: env.DB_QUERY_TIMEOUT,
    application_name: 'unjucks-enterprise',
  },
  redis: {
    url: env.REDIS_URL,
    maxRetriesPerRequest: env.REDIS_MAX_RETRIES,
    retryDelayOnFailover: env.REDIS_RETRY_DELAY,
    lazyConnect: true,
  },
};

/**
 * @typedef {Object} ConnectionMetrics
 * @property {number} pgActiveConnections
 * @property {number} pgIdleConnections
 * @property {boolean} redisConnected
 * @property {Date} lastHealthCheck
 */

// Connection pools with monitoring
export class DatabaseManager {
  constructor() {
    /** @type {Pool} */
    this.pgPool = new Pool(databaseConfig.postgres);
    
    /** @type {ReturnType<typeof createClient>} */
    this.redisClient = createClient(databaseConfig.redis);
    
    /** @type {ConnectionMetrics} */
    this.connectionMetrics = {
      pgActiveConnections: 0,
      pgIdleConnections: 0,
      redisConnected: false,
      lastHealthCheck: this.getDeterministicDate(),
    };
    
    this.setupMonitoring();
    this.setupHealthChecks();
  }

  /**
   * Set up connection monitoring
   */
  setupMonitoring() {
    this.pgPool.on('connect', () => {
      this.connectionMetrics.pgActiveConnections++;
    });

    this.pgPool.on('remove', () => {
      this.connectionMetrics.pgActiveConnections--;
    });

    this.pgPool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });

    this.redisClient.on('connect', () => {
      this.connectionMetrics.redisConnected = true;
    });

    this.redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
      this.connectionMetrics.redisConnected = false;
    });
  }

  /**
   * Set up periodic health checks
   */
  setupHealthChecks() {
    setInterval(async () => {
      try {
        // PostgreSQL health check
        await this.pgPool.query('SELECT 1');
        
        // Redis health check
        await this.redisClient.ping();
        
        this.connectionMetrics.lastHealthCheck = this.getDeterministicDate();
        this.connectionMetrics.pgIdleConnections = this.pgPool.idleCount;
      } catch (error) {
        console.error('Database health check failed:', error);
      }
    }, env.DB_HEALTH_CHECK_INTERVAL);
  }

  /**
   * Initialize database connections
   */
  async initialize() {
    try {
      await this.redisClient.connect();
      await this.pgPool.query('SELECT 1'); // Test connection
      console.log('Database connections established successfully');
    } catch (error) {
      console.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  /**
   * Get PostgreSQL pool
   * @returns {Pool}
   */
  get postgres() {
    return this.pgPool;
  }

  /**
   * Get Redis client
   * @returns {ReturnType<typeof createClient>}
   */
  get redis() {
    return this.redisClient;
  }

  /**
   * Get connection metrics
   * @returns {ConnectionMetrics}
   */
  get metrics() {
    return this.connectionMetrics;
  }

  /**
   * Close all database connections
   */
  async close() {
    await Promise.all([
      this.pgPool.end(),
      this.redisClient.quit(),
    ]);
  }
}

export const dbManager = new DatabaseManager();