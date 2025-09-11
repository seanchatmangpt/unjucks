/**
 * Configuration Usage Examples
 * Demonstrates how to use the environment-aware configuration system
 */

import { 
  getConfig, 
  getConfigWithEnv, 
  mergeConfig, 
  parseDatabaseUrl 
} from '../generated/config.js';

// Example 1: Basic configuration loading
console.log('=== Basic Configuration ===');
const basicConfig = getConfig();
console.log('App name:', basicConfig.app.name);
console.log('Server port:', basicConfig.server.port);
console.log('KGEN encryption key length:', basicConfig.kgen.encryptionKey.length);

// Example 2: Environment-specific configuration
console.log('\n=== Environment-Specific Configuration ===');
const prodConfig = getConfigWithEnv('production');
console.log('Production KGEN hash algorithm:', prodConfig.kgen.hashAlgorithm);
console.log('Production cache TTL:', prodConfig.kgen.cacheTtl);

// Example 3: Custom configuration merging
console.log('\n=== Custom Configuration Merging ===');
const customConfig = mergeConfig({
  server: { port: 4000 },
  kgen: { 
    encryptionKey: 'custom-encryption-key-32-characters-long!',
    cacheTtl: 1800 
  }
});
console.log('Custom server port:', customConfig.server.port);
console.log('Custom cache TTL:', customConfig.kgen.cacheTtl);

// Example 4: Database URL parsing
console.log('\n=== Database URL Parsing ===');
const dbUrl = 'postgresql://user:password@db-host:5432/mydb?sslmode=require';
const dbConfig = parseDatabaseUrl(dbUrl);
console.log('Parsed database config:', dbConfig);

// Example 5: Environment variable usage
console.log('\n=== Environment Variables ===');
console.log('Set the following environment variables for customization:');
console.log('- KGEN_ENCRYPTION_KEY: Your encryption key (min 32 chars)');
console.log('- KGEN_CACHE_TTL: Cache time-to-live in seconds');
console.log('- DATABASE_URL: Full database connection string');
console.log('- REDIS_URL: Full Redis connection string');

export { basicConfig, prodConfig, customConfig, dbConfig };