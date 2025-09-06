/**
 * Generate Configuration Files from Turtle Data
 * Shows how semantic config data generates actual config files
 */

import { TurtleParser } from '../../src/lib/turtle-parser';
import { RDFFilters } from '../../src/lib/rdf-filters';
import nunjucks from 'nunjucks';
import { writeFileSync } from 'fs';
import yaml from 'yaml';

// Configuration in RDF
const configRDF = `
@prefix cfg: <http://config.example.org/> .
@prefix env: <http://environment.example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Application Configuration
cfg:app a cfg:Configuration ;
    cfg:name "unjucks-app" ;
    cfg:version "1.0.0" ;
    cfg:description "Semantic template generator" ;
    cfg:author "Unjucks Team" .

# Environment-specific configs
env:development a cfg:Environment ;
    cfg:port 3000 ;
    cfg:debug true ;
    cfg:logLevel "debug" ;
    cfg:database [
        cfg:host "localhost" ;
        cfg:port 5432 ;
        cfg:name "dev_db" ;
        cfg:ssl false
    ] ;
    cfg:redis [
        cfg:host "localhost" ;
        cfg:port 6379
    ] .

env:production a cfg:Environment ;
    cfg:port 8080 ;
    cfg:debug false ;
    cfg:logLevel "error" ;
    cfg:database [
        cfg:host "db.prod.example.com" ;
        cfg:port 5432 ;
        cfg:name "prod_db" ;
        cfg:ssl true ;
        cfg:poolSize 20
    ] ;
    cfg:redis [
        cfg:host "redis.prod.example.com" ;
        cfg:port 6379 ;
        cfg:password "@{REDIS_PASSWORD}"
    ] ;
    cfg:cdn "https://cdn.example.com" ;
    cfg:monitoring true .
`;

// TypeScript Config Template
const tsConfigTemplate = `
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
{% for env in environments %}
  {{ env.name }}: {
    app: {
      name: '{{ app.name }}',
      version: '{{ app.version }}',
      description: '{{ app.description }}'
    },
    server: {
      port: {{ env.port }},
      debug: {{ env.debug }},
      logLevel: '{{ env.logLevel }}'
    },
    database: {
      host: '{{ env.database.host }}',
      port: {{ env.database.port }},
      name: '{{ env.database.name }}',
      ssl: {{ env.database.ssl }}{% if env.database.poolSize %},
      poolSize: {{ env.database.poolSize }}{% endif %}
    },
    redis: {
      host: '{{ env.redis.host }}',
      port: {{ env.redis.port }}{% if env.redis.password %},
      password: process.env.REDIS_PASSWORD || '{{ env.redis.password }}'{% endif %}
    }{% if env.cdn %},
    cdn: '{{ env.cdn }}'{% endif %}{% if env.monitoring %},
    monitoring: {{ env.monitoring }}{% endif %}
  }{% if not loop.last %},{% endif %}
{% endfor %}
};

export function getConfig(): Config {
  const env = process.env.NODE_ENV || 'development';
  return configs[env] || configs.development;
}

export default getConfig();
`;

// Docker Compose Template
const dockerComposeTemplate = `
# Generated from RDF configuration
version: '3.8'

services:
  app:
    build: .
    image: {{ app.name }}:{{ app.version }}
    environment:
      NODE_ENV: {{ env.name }}
      PORT: {{ env.port }}
      LOG_LEVEL: {{ env.logLevel }}
    ports:
      - "{{ env.port }}:{{ env.port }}"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: {{ env.database.name }}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "{{ env.database.port }}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "{{ env.redis.port }}:6379"
    {% if env.redis.password %}
    command: redis-server --requirepass {{ env.redis.password }}
    {% endif %}

volumes:
  postgres_data:
`;

// Environment Variables Template
const envTemplate = `
# Generated from RDF configuration for {{ env.name }}
NODE_ENV={{ env.name }}
PORT={{ env.port }}
DEBUG={{ env.debug }}
LOG_LEVEL={{ env.logLevel }}

# Database
DB_HOST={{ env.database.host }}
DB_PORT={{ env.database.port }}
DB_NAME={{ env.database.name }}
DB_SSL={{ env.database.ssl }}
{% if env.database.poolSize %}DB_POOL_SIZE={{ env.database.poolSize }}{% endif %}

# Redis
REDIS_HOST={{ env.redis.host }}
REDIS_PORT={{ env.redis.port }}
{% if env.redis.password %}REDIS_PASSWORD={{ env.redis.password }}{% endif %}

# Optional
{% if env.cdn %}CDN_URL={{ env.cdn }}{% endif %}
{% if env.monitoring %}MONITORING_ENABLED={{ env.monitoring }}{% endif %}
`;

async function generateConfigFromRDF() {
  const parser = new TurtleParser();
  const result = await parser.parse(configRDF);
  
  // Extract configuration data from RDF
  // In real implementation, would use RDFFilters to query the data
  const configData = {
    app: {
      name: 'unjucks-app',
      version: '1.0.0',
      description: 'Semantic template generator'
    },
    environments: [
      {
        name: 'development',
        port: 3000,
        debug: true,
        logLevel: 'debug',
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
      {
        name: 'production',
        port: 8080,
        debug: false,
        logLevel: 'error',
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
          password: '@{REDIS_PASSWORD}'
        },
        cdn: 'https://cdn.example.com',
        monitoring: true
      }
    ]
  };
  
  // Generate TypeScript config
  const tsConfig = nunjucks.renderString(tsConfigTemplate, configData);
  writeFileSync('./generated/config.ts', tsConfig);
  
  // Generate Docker Compose for each environment
  for (const env of configData.environments) {
    const dockerCompose = nunjucks.renderString(dockerComposeTemplate, {
      app: configData.app,
      env
    });
    writeFileSync(`./generated/docker-compose.${env.name}.yml`, dockerCompose);
    
    // Generate .env file
    const envFile = nunjucks.renderString(envTemplate, { env });
    writeFileSync(`./generated/.env.${env.name}`, envFile);
  }
  
  // Generate package.json scripts
  const packageScripts = {
    scripts: {
      "dev": "NODE_ENV=development node dist/index.js",
      "prod": "NODE_ENV=production node dist/index.js",
      "docker:dev": "docker-compose -f docker-compose.development.yml up",
      "docker:prod": "docker-compose -f docker-compose.production.yml up"
    }
  };
  
  writeFileSync('./generated/package-scripts.json', JSON.stringify(packageScripts, null, 2));
  
  console.log('✅ Generated configuration files from RDF data');
  console.log('   - TypeScript config');
  console.log('   - Docker Compose files'); 
  console.log('   - Environment variable files');
  console.log('   - Package.json scripts');
}

generateConfigFromRDF();