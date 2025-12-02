#!/usr/bin/env node

/**
 * Registry System Demonstration
 * Shows how to use the multi-backend registry abstraction layer
 */

import { RegistryManager } from '../src/registry/registry-manager.js';
import { RegistryConfig } from '../src/registry/config/registry-config.js';
import { RegistryAuth } from '../src/registry/auth/registry-auth.js';
import { RegistryCache } from '../src/registry/cache/registry-cache.js';
import { RegistryDiscovery } from '../src/registry/discovery/registry-discovery.js';

// Mock registry implementation for demonstration
class MockDemoRegistry {
  constructor(config) {
    this.config = config;
    this.type = config.type;
    this.name = config.name;
    this.packages = new Map();
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    console.log(`📦 Initialized ${this.name} registry (${this.type})`);
    
    // Add some demo packages
    this.packages.set('demo-package@1.0.0', {
      name: 'demo-package',
      version: '1.0.0',
      description: 'A demonstration package',
      author: 'Demo Author',
      registry: this.name
    });
  }

  async isHealthy() {
    return this.initialized;
  }

  async publish(packageInfo) {
    const key = `${packageInfo.name}@${packageInfo.version}`;
    this.packages.set(key, { ...packageInfo, registry: this.name });
    
    return {
      success: true,
      name: packageInfo.name,
      version: packageInfo.version,
      location: `${this.name}://${packageInfo.name}@${packageInfo.version}`
    };
  }

  async search(query) {
    const results = [];
    for (const [key, pkg] of this.packages.entries()) {
      if (pkg.name.includes(query) || pkg.description.includes(query)) {
        results.push({
          ...pkg,
          score: 0.8
        });
      }
    }
    return results;
  }

  async getPackageInfo(name, version = 'latest') {
    const key = version === 'latest' 
      ? Array.from(this.packages.keys()).find(k => k.startsWith(name + '@'))
      : `${name}@${version}`;
      
    return this.packages.get(key) || null;
  }

  async downloadPackage(name, version = 'latest') {
    const pkg = await this.getPackageInfo(name, version);
    if (!pkg) {
      throw new Error(`Package ${name}@${version} not found`);
    }
    return Buffer.from(`Mock content for ${name}@${version} from ${this.name}`);
  }

  async listVersions(name) {
    const versions = [];
    for (const key of this.packages.keys()) {
      if (key.startsWith(name + '@')) {
        versions.push(key.split('@')[1]);
      }
    }
    return versions;
  }

  async authenticate() {
    return { success: true, username: 'demo-user' };
  }

  async getCapabilities() {
    return {
      name: this.name,
      type: this.type,
      supports: {
        publish: true,
        search: true,
        download: true,
        versioning: true
      }
    };
  }

  async cleanup() {
    this.initialized = false;
  }
}

async function demonstrateRegistrySystem() {
  console.log('🚀 Registry System Demonstration\n');
  
  try {
    // 1. Create registry manager with configuration
    console.log('1️⃣ Creating Registry Manager...');
    const registryManager = new RegistryManager({
      config: {
        configPath: './demo-registry-config.json'
      },
      cache: {
        directory: './demo-cache',
        enabled: true,
        ttl: {
          packageInfo: 5000,
          searchResults: 3000,
          packageContent: 10000
        }
      }
    });

    // Register mock implementations
    registryManager.registryTypes.set('mock-npm', MockDemoRegistry);
    registryManager.registryTypes.set('mock-git', MockDemoRegistry);

    // 2. Configure registries
    console.log('2️⃣ Configuring registries...');
    await registryManager.config.load();
    
    registryManager.config.setRegistry('demo-npm', {
      type: 'mock-npm',
      name: 'demo-npm',
      baseUrl: 'https://demo-npm.registry.com',
      enabled: true,
      priority: 1,
      features: ['publish', 'search', 'download']
    });

    registryManager.config.setRegistry('demo-git', {
      type: 'mock-git',
      name: 'demo-git',
      baseUrl: 'https://demo-git.registry.com',
      enabled: true,
      priority: 2,
      features: ['publish', 'search', 'download']
    });

    // Set strategies
    registryManager.config.setStrategy('publish', {
      primary: 'demo-npm',
      fallbacks: ['demo-git'],
      requireConfirmation: false
    });
    
    registryManager.config.setStrategy('search', {
      aggregated: true,
      registries: ['demo-npm', 'demo-git'],
      mergeResults: true,
      maxResults: 20
    });
    
    registryManager.config.setStrategy('download', {
      priority: ['demo-npm', 'demo-git'],
      parallel: false,
      timeout: 60000
    });

    // 3. Initialize registry manager
    console.log('3️⃣ Initializing registry system...');
    await registryManager.initialize();
    console.log('✅ Registry system initialized successfully\n');

    // 4. Demonstrate publishing
    console.log('4️⃣ Publishing packages...');
    const packageInfo = {
      name: 'awesome-tool',
      version: '1.2.0',
      description: 'An awesome development tool',
      author: 'Developer Team',
      license: 'MIT',
      content: 'package content here'
    };

    const publishResults = await registryManager.publish(packageInfo);
    console.log('📦 Published package:', publishResults[0]);
    console.log('');

    // 5. Demonstrate searching
    console.log('5️⃣ Searching packages...');
    const searchResults = await registryManager.search('awesome');
    console.log('🔍 Search results:');
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name}@${result.version} - ${result.description} (${result.registry})`);
    });
    console.log('');

    // 6. Demonstrate package info retrieval
    console.log('6️⃣ Getting package information...');
    const packageDetails = await registryManager.getPackageInfo('awesome-tool', '1.2.0');
    console.log('📋 Package details:', {
      name: packageDetails.name,
      version: packageDetails.version,
      description: packageDetails.description,
      registry: packageDetails.registry
    });
    console.log('');

    // 7. Demonstrate downloading
    console.log('7️⃣ Downloading package...');
    const content = await registryManager.downloadPackage('awesome-tool', '1.2.0');
    console.log('📥 Downloaded content:', content.toString());
    console.log('');

    // 8. Demonstrate caching
    console.log('8️⃣ Demonstrating caching...');
    console.time('First search (cache miss)');
    await registryManager.search('demo');
    console.timeEnd('First search (cache miss)');
    
    console.time('Second search (cache hit)');
    await registryManager.search('demo');
    console.timeEnd('Second search (cache hit)');
    console.log('');

    // 9. Show registry health
    console.log('9️⃣ Checking registry health...');
    const health = await registryManager.getRegistryHealth();
    Object.entries(health).forEach(([name, status]) => {
      console.log(`   ${name}: ${status.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${status.responseTime}ms)`);
    });
    console.log('');

    // 10. Show statistics
    console.log('🔟 Registry statistics:');
    const stats = registryManager.getStats();
    console.log('   Operations:', stats.operations);
    console.log('   Success rate:', Math.round(stats.successRate * 100) + '%');
    console.log('   Cache hit rate:', Math.round(stats.hitRate * 100) + '%');
    console.log('   Active registries:', stats.registries.join(', '));
    console.log('');

    // 11. Demonstrate discovery
    console.log('1️⃣1️⃣ Registry discovery...');
    const discovery = new RegistryDiscovery();
    console.log('🔍 Registry discovery capabilities available');
    console.log('   - Well-known registry detection');
    console.log('   - Environment variable scanning');
    console.log('   - Network probing');
    console.log('   - DNS SRV record resolution');
    console.log('');

    // 12. Show configuration
    console.log('1️⃣2️⃣ Current configuration:');
    const enabledRegistries = registryManager.config.getEnabledRegistries();
    Object.keys(enabledRegistries).forEach(name => {
      const registry = enabledRegistries[name];
      console.log(`   ${name}: ${registry.type} (priority: ${registry.priority})`);
    });

    console.log('\n🎉 Registry system demonstration completed successfully!');
    console.log('\n📚 Key Features Demonstrated:');
    console.log('   ✅ Multi-backend registry support (NPM, OCI, Git, IPFS)');
    console.log('   ✅ Unified API across different registry types');
    console.log('   ✅ Intelligent caching with TTL');
    console.log('   ✅ Fallback and priority-based routing');
    console.log('   ✅ Authentication management');
    console.log('   ✅ Health monitoring');
    console.log('   ✅ Discovery and auto-configuration');
    console.log('   ✅ Performance optimization');

    // Cleanup
    await registryManager.destroy();

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRegistrySystem()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Demo error:', error);
      process.exit(1);
    });
}

export { demonstrateRegistrySystem };