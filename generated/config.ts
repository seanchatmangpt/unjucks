
/**
 * Application Configuration
 * Generated from RDF configuration data
 */

export interface Config {
  app: {
    name: string;
    version: string;
    description: string;
  };
  server: {
    port: number;
    debug: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  database: {
    host: string;
    port: number;
    name: string;
    ssl: boolean;
    poolSize?: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  cdn?: string;
  monitoring?: boolean;
}

const configs: Record<string, Config> = {

  development: {
    app: {
      name: 'unjucks-app',
      version: '1.0.0',
      description: 'Semantic template generator'
    },
    server: {
      port: 3000,
      debug: true,
      logLevel: 'debug'
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'dev_db',
      ssl: false
    },
    redis: {
      host: 'localhost',
      port: 6379
    }
  },

  production: {
    app: {
      name: 'unjucks-app',
      version: '1.0.0',
      description: 'Semantic template generator'
    },
    server: {
      port: 8080,
      debug: false,
      logLevel: 'error'
    },
    database: {
      host: 'db.prod.example.com',
      port: 5432,
      name: 'prod_db',
      ssl: true,
      poolSize: 20
    },
    redis: {
      host: 'redis.prod.example.com',
      port: 6379,
      password: process.env.REDIS_PASSWORD || '@{REDIS_PASSWORD}'
    },
    cdn: 'https://cdn.example.com',
    monitoring: true
  }

};

export function getConfig(): Config {
  const env = process.env.NODE_ENV || 'development';
  return configs[env] || configs.development;
}

export default getConfig();
