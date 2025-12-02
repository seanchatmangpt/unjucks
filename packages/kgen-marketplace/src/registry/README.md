# Registry Abstraction Layer

A comprehensive registry abstraction layer that provides a unified interface for multiple package registry backends including NPM, OCI/Docker, Git repositories, and IPFS.

## 🌟 Features

- **Multi-Backend Support**: NPM, OCI/Docker, Git, IPFS registries
- **Unified API**: Consistent interface across all registry types
- **Intelligent Caching**: TTL-based caching with offline support
- **Authentication Management**: Secure credential storage and token refresh
- **Health Monitoring**: Real-time registry health checking
- **Discovery Protocol**: Automatic registry detection and capability negotiation
- **Fallback Strategy**: Configurable priority-based routing with fallbacks
- **Performance Optimization**: Parallel operations and smart retry logic

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Registry Manager                         │
├─────────────────────────────────────────────────────────────┤
│  Configuration  │  Authentication  │  Cache  │  Discovery  │
├─────────────────┼──────────────────┼─────────┼─────────────┤
│   NPM Registry  │   OCI Registry   │   Git   │    IPFS     │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Registry Manager** (`registry-manager.js`)
   - Main orchestration class
   - Unified API for all operations
   - Strategy-based routing

2. **Registry Interface** (`registry-interface.js`)
   - Abstract base class
   - Common error types
   - Validation and retry logic

3. **Backend Implementations**
   - **NPM Registry** (`backends/npm-registry.js`)
   - **OCI Registry** (`backends/oci-registry.js`)
   - **Git Registry** (`backends/git-registry.js`)
   - **IPFS Registry** (`backends/ipfs-registry.js`)

4. **Supporting Systems**
   - **Configuration** (`config/registry-config.js`)
   - **Authentication** (`auth/registry-auth.js`)
   - **Caching** (`cache/registry-cache.js`)
   - **Discovery** (`discovery/registry-discovery.js`)

## 🚀 Quick Start

```javascript
import { RegistryManager } from '@kgen/marketplace/registry';

// Initialize registry manager
const registryManager = new RegistryManager({
  cache: {
    enabled: true,
    directory: '.kgen/registry-cache'
  }
});

await registryManager.initialize();

// Publish a package
const result = await registryManager.publish({
  name: 'my-package',
  version: '1.0.0',
  description: 'My awesome package',
  content: packageContent
});

// Search for packages
const packages = await registryManager.search('awesome tool');

// Download a package
const content = await registryManager.downloadPackage('my-package', '1.0.0');
```

## 📋 Configuration

### Registry Configuration

Configure multiple registries with priority and fallback strategies:

```javascript
// Load configuration
await registryManager.config.load();

// Add custom registry
registryManager.config.setRegistry('my-npm', {
  type: 'npm',
  name: 'my-npm',
  baseUrl: 'https://npm.mycompany.com',
  enabled: true,
  priority: 1,
  auth: {
    type: 'token',
    tokenEnv: 'MY_NPM_TOKEN'
  }
});

// Configure strategies
registryManager.config.setStrategy('publish', {
  primary: 'my-npm',
  fallbacks: ['npm', 'github'],
  requireConfirmation: true
});

registryManager.config.setStrategy('search', {
  aggregated: true,
  registries: ['my-npm', 'npm'],
  mergeResults: true,
  maxResults: 50
});
```

### Cache Configuration

```javascript
const cache = new RegistryCache({
  directory: '.kgen/registry-cache',
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: {
    packageInfo: 60 * 60 * 1000,    // 1 hour
    searchResults: 30 * 60 * 1000,  // 30 minutes
    packageContent: 24 * 60 * 60 * 1000 // 24 hours
  },
  cleanupInterval: 60 * 60 * 1000    // 1 hour
});
```

## 🔐 Authentication

### Storing Credentials

```javascript
const auth = new RegistryAuth();
await auth.initialize();

// Store NPM token
await auth.storeCredentials('npm', {
  type: 'token',
  token: 'npm_xxxxxxxxxxxx'
});

// Store Docker credentials
await auth.storeCredentials('docker', {
  type: 'credentials',
  username: 'myuser',
  password: 'mypassword'
});

// Store GitHub token
await auth.storeCredentials('github', {
  type: 'token',
  token: 'ghp_xxxxxxxxxxxx'
});
```

### Environment Variables

The system automatically loads credentials from environment variables:

```bash
# NPM
export NPM_TOKEN=npm_xxxxxxxxxxxx

# Docker
export DOCKER_USERNAME=myuser
export DOCKER_PASSWORD=mypassword

# GitHub
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# IPFS
export IPFS_PINNING_KEY=ipfs_xxxxxxxxxxxx
```

## 🔍 Registry Discovery

Automatically discover available registries:

```javascript
const discovery = new RegistryDiscovery();

// Discover from multiple sources
const discovered = await discovery.discoverRegistries({
  sources: ['wellknown', 'environment', 'network'],
  verifyHealth: true,
  getCapabilities: true
});

// Add discovered registries
for (const registry of discovered) {
  await registryManager.addRegistry(registry.name, {
    type: registry.type,
    baseUrl: registry.baseUrl,
    enabled: false // Don't enable automatically
  });
}
```

## 📊 Monitoring & Health

```javascript
// Check registry health
const health = await registryManager.getRegistryHealth();
console.log('NPM Registry:', health.npm.healthy ? '✅' : '❌');

// Get statistics
const stats = registryManager.getStats();
console.log('Success rate:', Math.round(stats.successRate * 100) + '%');
console.log('Cache hit rate:', Math.round(stats.hitRate * 100) + '%');

// Monitor operations
registryManager.on('published', ({ package, results }) => {
  console.log(`Published ${package} to ${results} registries`);
});

registryManager.on('downloaded', ({ name, version, registry, size }) => {
  console.log(`Downloaded ${name}@${version} from ${registry} (${size} bytes)`);
});
```

## 🧪 Backend Implementations

### NPM Registry

```javascript
import { NpmRegistry } from '@kgen/marketplace/registry/backends/npm-registry';

const npm = new NpmRegistry({
  baseUrl: 'https://registry.npmjs.org',
  authToken: process.env.NPM_TOKEN,
  scope: '@myorg'
});

await npm.initialize();
```

**Features:**
- Full NPM API support
- Scoped packages
- Authentication with tokens
- Integrity verification
- Search and metadata

### OCI/Docker Registry

```javascript
import { OciRegistry } from '@kgen/marketplace/registry/backends/oci-registry';

const docker = new OciRegistry({
  baseUrl: 'https://registry-1.docker.io',
  username: process.env.DOCKER_USERNAME,
  password: process.env.DOCKER_PASSWORD,
  namespace: 'library'
});
```

**Features:**
- Docker Registry API v2
- OCI Distribution Specification
- Multi-layer support
- Content-addressable storage
- Authentication

### Git Registry

```javascript
import { GitRegistry } from '@kgen/marketplace/registry/backends/git-registry';

const github = new GitRegistry({
  baseUrl: 'https://github.com',
  accessToken: process.env.GITHUB_TOKEN,
  organization: 'myorg',
  branch: 'main'
});
```

**Features:**
- GitHub/GitLab support
- Tag-based versioning
- Release management
- SSH and token auth
- Branch and tag support

### IPFS Registry

```javascript
import { IpfsRegistry } from '@kgen/marketplace/registry/backends/ipfs-registry';

const ipfs = new IpfsRegistry({
  baseUrl: 'http://127.0.0.1:5001',
  gatewayUrl: 'https://ipfs.io/ipfs',
  pinningService: 'pinata',
  pinningApiKey: process.env.IPFS_PINNING_KEY
});
```

**Features:**
- Decentralized storage
- Content addressing
- Pinning services
- Offline access
- Immutable content

## 🔧 Error Handling

The system provides comprehensive error handling with specific error types:

```javascript
import { 
  RegistryError, 
  RegistryNotFoundError, 
  RegistryAuthError, 
  RegistryNetworkError 
} from '@kgen/marketplace/registry';

try {
  await registryManager.downloadPackage('nonexistent-package');
} catch (error) {
  if (error instanceof RegistryNotFoundError) {
    console.log('Package not found in any registry');
  } else if (error instanceof RegistryAuthError) {
    console.log('Authentication failed');
  } else if (error instanceof RegistryNetworkError) {
    console.log('Network error occurred');
  }
}
```

## 🎯 Performance Optimization

- **Parallel Operations**: Download from multiple registries simultaneously
- **Intelligent Caching**: Multi-level caching with TTL
- **Connection Pooling**: Reuse HTTP connections
- **Retry Logic**: Exponential backoff with circuit breaker
- **Compression**: Support for gzip and deflate
- **Streaming**: Large file support with streaming

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/registry/registry-manager.test.js
npm test -- tests/registry/backends/npm-registry.test.js
npm test -- tests/registry/cache/registry-cache.test.js

# Run with coverage
npm run test:coverage
```

## 📚 Examples

See the `examples/` directory for complete usage examples:

- **registry-demo.js**: Complete demonstration of all features
- **basic-usage.js**: Simple publish/search/download workflow
- **multi-registry.js**: Advanced multi-registry configuration
- **caching-demo.js**: Cache performance demonstration

## 🔒 Security

- **Encrypted Credential Storage**: AES-256-GCM encryption
- **Token Refresh**: Automatic token renewal
- **Integrity Verification**: Content hash validation
- **Secure Defaults**: HTTPS-only, certificate validation
- **Audit Logging**: Complete operation audit trail

## 📈 Metrics & Analytics

Track registry usage and performance:

```javascript
// Get detailed statistics
const analytics = await registryManager.getAnalytics();

console.log('Registry Usage:', analytics.usage);
console.log('Performance Metrics:', analytics.performance);
console.log('Error Rates:', analytics.errors);
console.log('Cache Efficiency:', analytics.cache);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details