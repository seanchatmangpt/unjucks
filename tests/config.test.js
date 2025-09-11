/**
 * Configuration Tests
 * Validates environment variable loading and configuration merging
 */

const { 
  getConfig, 
  getConfigForEnvironment, 
  getConfigWithEnv,
  mergeConfig, 
  validateConfig,
  loadFromEnvironment,
  parseDatabaseUrl,
  parseRedisUrl
} = require('../generated/config.js');

describe('Configuration System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Loading', () => {
    test('should load KGEN environment variables', () => {
      process.env.KGEN_ENV = 'test';
      process.env.KGEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
      process.env.KGEN_HASH_ALGORITHM = 'sha512';
      process.env.KGEN_CACHE_TTL = '1800';
      process.env.KGEN_MAX_CACHE_SIZE = '2000';
      process.env.KGEN_LOG_LEVEL = 'info';

      const envConfig = loadFromEnvironment();

      expect(envConfig.kgen.env).toBe('test');
      expect(envConfig.kgen.encryptionKey).toBe('test-encryption-key-32-characters-long');
      expect(envConfig.kgen.hashAlgorithm).toBe('sha512');
      expect(envConfig.kgen.cacheTtl).toBe(1800);
      expect(envConfig.kgen.maxCacheSize).toBe(2000);
      expect(envConfig.kgen.logLevel).toBe('info');
    });

    test('should provide defaults when environment variables are not set', () => {
      const envConfig = loadFromEnvironment();

      expect(envConfig.kgen.env).toBe('development');
      expect(envConfig.kgen.encryptionKey).toBe('development-key-32-characters-long!!');
      expect(envConfig.kgen.hashAlgorithm).toBe('sha256');
      expect(envConfig.kgen.cacheTtl).toBe(3600);
      expect(envConfig.kgen.maxCacheSize).toBe(1000);
      expect(envConfig.kgen.logLevel).toBe('debug');
    });

    test('should parse database URL correctly', () => {
      const dbUrl = 'postgresql://user:pass@localhost:5432/mydb?sslmode=require';
      const parsed = parseDatabaseUrl(dbUrl);

      expect(parsed.host).toBe('localhost');
      expect(parsed.port).toBe(5432);
      expect(parsed.name).toBe('mydb');
      expect(parsed.user).toBe('user');
      expect(parsed.password).toBe('pass');
      expect(parsed.ssl).toBe(true);
    });

    test('should parse Redis URL correctly', () => {
      const redisUrl = 'redis://user:pass@redis-host:6380';
      const parsed = parseRedisUrl(redisUrl);

      expect(parsed.host).toBe('redis-host');
      expect(parsed.port).toBe(6380);
      expect(parsed.password).toBe('pass');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', () => {
      const validConfig = {
        app: {
          name: 'test-app',
          version: '1.0.0',
          description: 'Test application'
        },
        server: {
          port: 3000,
          debug: true,
          logLevel: 'debug'
        },
        database: {
          host: 'localhost',
          port: 5432,
          name: 'testdb',
          ssl: false
        },
        redis: {
          host: 'localhost',
          port: 6379
        },
        kgen: {
          env: 'test',
          encryptionKey: 'test-encryption-key-32-characters-long',
          hashAlgorithm: 'sha256',
          cacheTtl: 3600,
          maxCacheSize: 1000,
          logLevel: 'debug'
        }
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    test('should throw error for invalid KGEN encryption key', () => {
      const invalidConfig = {
        app: { name: 'test', version: '1.0.0', description: 'test' },
        server: { port: 3000, debug: true, logLevel: 'debug' },
        database: { host: 'localhost', port: 5432, name: 'test', ssl: false },
        redis: { host: 'localhost', port: 6379 },
        kgen: {
          env: 'test',
          encryptionKey: 'short', // Too short
          hashAlgorithm: 'sha256',
          cacheTtl: 3600,
          maxCacheSize: 1000,
          logLevel: 'debug'
        }
      };

      expect(() => validateConfig(invalidConfig))
        .toThrow('kgen.encryptionKey must be at least 32 characters long');
    });

    test('should throw error for invalid KGEN environment', () => {
      const invalidConfig = {
        app: { name: 'test', version: '1.0.0', description: 'test' },
        server: { port: 3000, debug: true, logLevel: 'debug' },
        database: { host: 'localhost', port: 5432, name: 'test', ssl: false },
        redis: { host: 'localhost', port: 6379 },
        kgen: {
          env: 'invalid', // Invalid environment
          encryptionKey: 'test-encryption-key-32-characters-long',
          hashAlgorithm: 'sha256',
          cacheTtl: 3600,
          maxCacheSize: 1000,
          logLevel: 'debug'
        }
      };

      expect(() => validateConfig(invalidConfig))
        .toThrow('kgen.env must be one of: development, production, test');
    });
  });

  describe('Configuration Merging', () => {
    test('should merge environment variables with base configuration', () => {
      process.env.KGEN_ENCRYPTION_KEY = 'env-specific-key-32-characters-long!!';
      process.env.PORT = '4000';
      process.env.DB_HOST = 'env-db-host';

      const merged = getConfigWithEnv('development');

      expect(merged.kgen.encryptionKey).toBe('env-specific-key-32-characters-long!!');
      expect(merged.server.port).toBe(4000);
      expect(merged.database.host).toBe('env-db-host');
    });

    test('should prioritize custom config over environment and base', () => {
      process.env.KGEN_ENCRYPTION_KEY = 'env-key-32-characters-long!!!!!!!!!!!';
      
      const customConfig = {
        kgen: {
          encryptionKey: 'custom-key-32-characters-long!!!!!!!!!!'
        }
      };

      const merged = mergeConfig(customConfig, 'development');

      expect(merged.kgen.encryptionKey).toBe('custom-key-32-characters-long!!!!!!!!!!');
    });
  });

  describe('Environment-Specific Configurations', () => {
    test('should load development configuration', () => {
      const config = getConfigForEnvironment('development');

      expect(config.kgen.env).toBe('development');
      expect(config.kgen.logLevel).toBe('debug');
      expect(config.server.debug).toBe(true);
    });

    test('should load production configuration', () => {
      const config = getConfigForEnvironment('production');

      expect(config.kgen.env).toBe('production');
      expect(config.kgen.logLevel).toBe('error');
      expect(config.kgen.hashAlgorithm).toBe('sha512');
      expect(config.server.debug).toBe(false);
    });

    test('should load test configuration', () => {
      const config = getConfigForEnvironment('test');

      expect(config.kgen.env).toBe('test');
      expect(config.kgen.logLevel).toBe('warn');
      expect(config.kgen.cacheTtl).toBe(300);
      expect(config.server.port).toBe(3001);
    });
  });
});