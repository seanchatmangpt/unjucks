import { faker } from '@faker-js/faker';

export interface TestConfig {
  templates: {
    directory: string;
    extensions: string[];
    cache: boolean;
  };
  generation: {
    defaultDest: string;
    createDirectories: boolean;
    overwrite: boolean;
  };
  performance: {
    maxFileSize: number;
    timeout: number;
    concurrent: boolean;
  };
  security: {
    allowedPaths: string[];
    sanitizeInput: boolean;
    maxDepth: number;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimit: {
    requests: number;
    window: number;
  };
  auth: {
    type: 'bearer' | 'basic' | 'api-key';
    credentials: Record<string, string>;
  };
}

export class ConfigFactory {
  /**
   * Create test configuration
   */
  static createConfig(overrides: Partial<TestConfig> = {}): TestConfig {
    return {
      templates: {
        directory: overrides.templates?.directory || './_templates',
        extensions: overrides.templates?.extensions || ['.njk', '.ejs'],
        cache: overrides.templates?.cache ?? true
      },
      generation: {
        defaultDest: overrides.generation?.defaultDest || './src',
        createDirectories: overrides.generation?.createDirectories ?? true,
        overwrite: overrides.generation?.overwrite ?? false
      },
      performance: {
        maxFileSize: overrides.performance?.maxFileSize || 10 * 1024 * 1024, // 10MB
        timeout: overrides.performance?.timeout || 30000, // 30 seconds
        concurrent: overrides.performance?.concurrent ?? true
      },
      security: {
        allowedPaths: overrides.security?.allowedPaths || [
          './src',
          './lib',
          './components'
        ],
        sanitizeInput: overrides.security?.sanitizeInput ?? true,
        maxDepth: overrides.security?.maxDepth || 10
      },
      ...overrides
    };
  }

  /**
   * Create database configuration
   */
  static createDatabaseConfig(overrides: Partial<DatabaseConfig> = {}): DatabaseConfig {
    return {
      host: overrides.host || faker.internet.domainName(),
      port: overrides.port || faker.internet.port(),
      database: overrides.database || faker.hacker.noun(),
      username: overrides.username || faker.internet.userName(),
      password: overrides.password || faker.internet.password(),
      ssl: overrides.ssl ?? true,
      maxConnections: overrides.maxConnections || faker.datatype.number({ min: 10, max: 100 }),
      ...overrides
    };
  }

  /**
   * Create API configuration
   */
  static createApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
    const authTypes: Array<'bearer' | 'basic' | 'api-key'> = ['bearer', 'basic', 'api-key'];
    
    return {
      baseUrl: overrides.baseUrl || faker.internet.url(),
      timeout: overrides.timeout || faker.datatype.number({ min: 5000, max: 60000 }),
      retries: overrides.retries || faker.datatype.number({ min: 0, max: 5 }),
      rateLimit: {
        requests: overrides.rateLimit?.requests || faker.datatype.number({ min: 100, max: 10000 }),
        window: overrides.rateLimit?.window || faker.datatype.number({ min: 60, max: 3600 })
      },
      auth: {
        type: overrides.auth?.type || faker.helpers.arrayElement(authTypes),
        credentials: overrides.auth?.credentials || {
          token: faker.string.alphanumeric(64),
          apiKey: faker.string.alphanumeric(32)
        }
      },
      ...overrides
    };
  }

  /**
   * Create environment configurations
   */
  static createEnvironmentConfigs() {
    return {
      development: this.createConfig({
        performance: {
          maxFileSize: 100 * 1024 * 1024, // 100MB for dev
          timeout: 60000, // 60 seconds
          concurrent: false // Easier debugging
        },
        security: {
          allowedPaths: ['./src', './lib', './components', './tests'],
          sanitizeInput: false, // Less strict in dev
          maxDepth: 20
        }
      }),

      production: this.createConfig({
        performance: {
          maxFileSize: 10 * 1024 * 1024, // 10MB limit
          timeout: 15000, // 15 seconds
          concurrent: true
        },
        security: {
          allowedPaths: ['./src', './lib'], // Restricted paths
          sanitizeInput: true,
          maxDepth: 5 // Prevent deep nesting attacks
        }
      }),

      testing: this.createConfig({
        templates: {
          directory: './tests/fixtures/templates',
          extensions: ['.njk', '.ejs', '.test'],
          cache: false // Disable cache for tests
        },
        generation: {
          defaultDest: './test-output',
          createDirectories: true,
          overwrite: true // Always overwrite in tests
        },
        performance: {
          maxFileSize: 1024 * 1024, // 1MB for fast tests
          timeout: 5000, // 5 seconds
          concurrent: true
        }
      }),

      ci: this.createConfig({
        templates: {
          directory: './_templates',
          extensions: ['.njk'],
          cache: true
        },
        performance: {
          maxFileSize: 5 * 1024 * 1024, // 5MB
          timeout: 10000, // 10 seconds
          concurrent: true
        },
        security: {
          allowedPaths: ['./src'],
          sanitizeInput: true,
          maxDepth: 3
        }
      })
    };
  }

  /**
   * Create invalid configurations for error testing
   */
  static createInvalidConfigs() {
    return {
      missingTemplatesDir: this.createConfig({
        templates: {
          directory: '',
          extensions: ['.njk'],
          cache: true
        }
      }),

      invalidTimeout: this.createConfig({
        performance: {
          maxFileSize: 1024,
          timeout: -1, // Invalid negative timeout
          concurrent: true
        }
      }),

      emptyAllowedPaths: this.createConfig({
        security: {
          allowedPaths: [], // No allowed paths
          sanitizeInput: true,
          maxDepth: 5
        }
      }),

      oversizedLimits: this.createConfig({
        performance: {
          maxFileSize: Number.MAX_SAFE_INTEGER,
          timeout: Number.MAX_SAFE_INTEGER,
          concurrent: true
        }
      })
    };
  }

  /**
   * Create performance configurations
   */
  static createPerformanceConfigs() {
    return {
      highThroughput: this.createConfig({
        performance: {
          maxFileSize: 100 * 1024 * 1024, // 100MB
          timeout: 120000, // 2 minutes
          concurrent: true
        },
        templates: {
          directory: './_templates',
          extensions: ['.njk'],
          cache: true // Enable aggressive caching
        }
      }),

      lowLatency: this.createConfig({
        performance: {
          maxFileSize: 1024 * 1024, // 1MB
          timeout: 1000, // 1 second
          concurrent: true
        },
        templates: {
          directory: './_templates',
          extensions: ['.njk'],
          cache: true
        }
      }),

      memoryConstrained: this.createConfig({
        performance: {
          maxFileSize: 512 * 1024, // 512KB
          timeout: 5000,
          concurrent: false // Sequential processing
        },
        templates: {
          directory: './_templates',
          extensions: ['.njk'],
          cache: false // No caching to save memory
        }
      })
    };
  }

  /**
   * Create security configurations
   */
  static createSecurityConfigs() {
    return {
      strict: this.createConfig({
        security: {
          allowedPaths: ['./src'], // Very restricted
          sanitizeInput: true,
          maxDepth: 3
        }
      }),

      relaxed: this.createConfig({
        security: {
          allowedPaths: [
            './src',
            './lib',
            './components',
            './utils',
            './pages',
            './styles'
          ],
          sanitizeInput: false,
          maxDepth: 10
        }
      }),

      paranoid: this.createConfig({
        security: {
          allowedPaths: [], // No paths allowed
          sanitizeInput: true,
          maxDepth: 1
        }
      })
    };
  }

  /**
   * Create multi-tenant configurations
   */
  static createMultiTenantConfigs() {
    const tenantA = faker.string.uuid();
    const tenantB = faker.string.uuid();

    return {
      [tenantA]: this.createConfig({
        templates: {
          directory: `./tenants/${tenantA}/_templates`,
          extensions: ['.njk'],
          cache: true
        },
        security: {
          allowedPaths: [`./tenants/${tenantA}/src`],
          sanitizeInput: true,
          maxDepth: 5
        }
      }),

      [tenantB]: this.createConfig({
        templates: {
          directory: `./tenants/${tenantB}/_templates`,
          extensions: ['.njk'],
          cache: true
        },
        security: {
          allowedPaths: [`./tenants/${tenantB}/src`],
          sanitizeInput: true,
          maxDepth: 5
        }
      }),

      shared: this.createConfig({
        templates: {
          directory: './shared/_templates',
          extensions: ['.njk'],
          cache: true
        },
        security: {
          allowedPaths: ['./shared/src'],
          sanitizeInput: true,
          maxDepth: 3
        }
      })
    };
  }
}

// Convenience exports
export const {
  createConfig,
  createDatabaseConfig,
  createApiConfig,
  createEnvironmentConfigs,
  createInvalidConfigs,
  createPerformanceConfigs,
  createSecurityConfigs,
  createMultiTenantConfigs
} = ConfigFactory;