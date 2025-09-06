import { Pool, PoolConfig } from 'pg';
import { createClient } from 'redis';
import { env } from './environment.js';

export interface DatabaseConfig {
  postgres: PoolConfig;
  redis: {
    url: string;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    lazyConnect: boolean;
  };
}

export const databaseConfig: DatabaseConfig = {
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

// Connection pools with monitoring
export class DatabaseManager {
  private pgPool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private connectionMetrics = {
    pgActiveConnections: 0,
    pgIdleConnections: 0,
    redisConnected: false,
    lastHealthCheck: new Date(),
  };

  constructor() {
    this.pgPool = new Pool(databaseConfig.postgres);
    this.redisClient = createClient(databaseConfig.redis);
    
    this.setupMonitoring();
    this.setupHealthChecks();
  }

  private setupMonitoring() {
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

  private setupHealthChecks() {
    setInterval(async () => {
      try {
        // PostgreSQL health check
        const pgResult = await this.pgPool.query('SELECT 1');
        
        // Redis health check
        await this.redisClient.ping();
        
        this.connectionMetrics.lastHealthCheck = new Date();
        this.connectionMetrics.pgIdleConnections = this.pgPool.idleCount;
      } catch (error) {
        console.error('Database health check failed:', error);
      }
    }, env.DB_HEALTH_CHECK_INTERVAL);
  }

  async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
      await this.pgPool.query('SELECT 1'); // Test connection
      console.log('Database connections established successfully');
    } catch (error) {
      console.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  get postgres(): Pool {
    return this.pgPool;
  }

  get redis(): ReturnType<typeof createClient> {
    return this.redisClient;
  }

  get metrics() {
    return this.connectionMetrics;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.pgPool.end(),
      this.redisClient.quit(),
    ]);
  }
}

export const dbManager = new DatabaseManager();