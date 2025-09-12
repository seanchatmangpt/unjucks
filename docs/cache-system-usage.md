# KGEN Content-Addressed Cache System

The KGEN cache system provides high-performance, content-addressed caching with advanced features including compression, integrity verification, and intelligent garbage collection.

## Features

- **Content-addressed storage** - Deterministic hashing eliminates duplicate data
- **Multi-layer caching** - Memory, disk, and template-specific cache layers
- **Compression support** - Automatic compression for large content with configurable levels
- **Integrity verification** - Cryptographic verification of cached content
- **Intelligent garbage collection** - Multiple strategies including LRU, size-based, and access-based
- **Performance optimizations** - Write-behind caching, batch operations, and parallel collection
- **Template caching** - Specialized caching for Nunjucks/Jinja2 templates

## CLI Usage

### List Cache Contents

```bash
# List all cache entries
kgen cache ls

# List with details
kgen cache ls --details --limit 100

# Sort by size (largest first)  
kgen cache ls --sort size --order desc

# Filter by hash prefix
kgen cache ls --filter abc123
```

### Show Cache Statistics

```bash
# Show cache statistics and health
kgen cache show --stats

# Show specific cache entry
kgen cache show --key 1a2b3c4d5e...

# Show entry content preview
kgen cache show --key 1a2b3c4d5e... --content

# List recent entries
kgen cache show --entries --limit 20
```

### Garbage Collection

```bash
# Automatic strategy selection
kgen cache gc

# Memory pressure cleanup
kgen cache gc --strategy memory

# Remove expired entries only
kgen cache gc --strategy expired

# Aggressive cleanup (50% removal)
kgen cache gc --strategy aggressive

# Dry run (preview without removing)
kgen cache gc --strategy auto --dry

# With analysis
kgen cache gc --analyze --strategy auto
```

### Cache Purge

```bash
# Clear entire cache
kgen cache purge --force

# Remove old entries
kgen cache purge --older-than 7d

# Remove by content type
kgen cache purge --content-type template
```

## Programmatic Usage

### Basic Operations

```javascript
import { ContentAddressedCache } from '@kgen/core/cache';

// Initialize cache
const cache = new ContentAddressedCache({
  cacheDir: './cache',
  enableCompression: true,
  enableIntegrity: true,
  maxCacheSize: '1GB',
  maxEntries: 10000
});

await cache.initialize();

// Store content
const key = await cache.store('Hello, World!', {
  type: 'text',
  source: 'user-input'
});

// Retrieve content
const content = await cache.retrieve(key);

// Check existence
const exists = await cache.has(key);

// Remove entry
await cache.remove(key);
```

### Template Caching

```javascript
// Store template with context-aware key
const templateKey = await cache.store(templateContent, {
  type: 'template',
  templatePath: './templates/user-profile.njk'
}, {
  isTemplate: true,
  templatePath: './templates/user-profile.njk'
});

// Retrieve template (with automatic validation)
const template = await cache.getTemplate('./templates/user-profile.njk', {
  variables: { userId: 123 }
});
```

### Advanced Configuration

```javascript
const cache = new ContentAddressedCache({
  // Core settings
  cacheDir: './cache',
  hashAlgorithm: 'sha256',
  maxCacheSize: '1GB',
  maxEntries: 10000,
  
  // Performance options
  enableCompression: true,
  compressionLevel: 6,
  writeBehind: true,
  batchWrites: true,
  
  // TTL settings
  defaultTTL: 86400000, // 24 hours
  cleanupInterval: 3600000, // 1 hour
  
  // Template cache options
  templateCacheOptions: {
    maxSize: 100,
    ttl: 300000, // 5 minutes
    compressionThreshold: 1024
  }
});
```

## Garbage Collection Strategies

### Available Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `auto` | Automatic strategy selection based on pressure analysis | Default, general purpose |
| `aggressive` | Remove 50% of entries across all layers | Critical memory/disk pressure |
| `memory` | Focus on memory cache cleanup | High memory usage |
| `disk` | Focus on disk cache cleanup | Low disk space |
| `templates` | Clean template cache | Template-heavy applications |
| `expired` | Remove only expired entries | Regular maintenance |
| `lru` | Least recently used eviction | Access-pattern optimization |
| `size` | Remove largest entries first | Storage optimization |
| `access` | Remove rarely accessed entries | Performance optimization |

### Garbage Collection Configuration

```javascript
import { GarbageCollector, GCStrategy } from '@kgen/core/cache';

const gc = new GarbageCollector(cache, {
  // Collection thresholds
  memoryThreshold: 0.85,     // 85% memory usage
  diskThreshold: 0.80,       // 80% disk usage
  aggressiveThreshold: 0.90, // 90% triggers aggressive
  
  // Collection targets
  memoryTargetReduction: 0.30, // Remove 30% from memory
  diskTargetReduction: 0.25,   // Remove 25% from disk
  
  // Performance settings
  enableParallelCollection: true,
  maxCollectionTime: 30000, // 30 seconds max
  
  // Content type priorities
  contentTypePriorities: {
    'template': 2,    // Lower priority (keep longer)
    'rdf-store': 3,   // Medium priority  
    'json': 4,        // Higher priority (remove sooner)
    'text': 5         // Highest priority
  }
});

// Manual collection
const result = await gc.collect(GCStrategy.AUTO);
console.log(`Collected ${result.total_collected} items, freed ${result.bytes_freed} bytes`);

// Analyze cache pressure
const analysis = await gc.analyzePressure();
console.log(`Memory pressure: ${analysis.pressure.memory.level * 100}%`);
```

## Performance Optimization

### Configuration for High Performance

```javascript
const highPerfCache = new ContentAddressedCache({
  // Enable all performance features
  enableCompression: true,
  compressionLevel: 1,        // Fastest compression
  writeBehind: true,         // Asynchronous disk writes
  batchWrites: true,         // Batch disk operations
  enableIntegrity: false,    // Disable for max speed
  
  // Optimized limits
  maxCacheSize: '2GB',
  maxEntries: 50000,
  
  // Fast cleanup
  cleanupInterval: 300000,   // 5 minutes
  
  // Aggressive template caching
  templateCacheOptions: {
    maxSize: 500,
    ttl: 600000,            // 10 minutes
    compressionThreshold: 512
  }
});
```

### Monitoring Performance

```javascript
// Get detailed statistics
const stats = cache.getStatistics();

console.log(`Hit rate: ${(stats.hit_rate * 100).toFixed(1)}%`);
console.log(`Template hit rate: ${(stats.template_hit_rate * 100).toFixed(1)}%`);
console.log(`Memory pressure: ${(stats.health.memory_pressure * 100).toFixed(1)}%`);
console.log(`Average bytes per read: ${stats.operations.bytes_per_read}`);

// Monitor garbage collection
const gcStats = gc.getStatistics();
console.log(`GC runs: ${gcStats.total_collections}`);
console.log(`GC efficiency: ${(gcStats.cache_efficiency.overall_score * 100).toFixed(1)}%`);
console.log(`Items collected: ${gcStats.total_items_collected}`);
```

## Best Practices

### 1. Choose Appropriate TTL Values

```javascript
// Short-lived development data
await cache.store(devData, { ttl: 300000 }); // 5 minutes

// User session data  
await cache.store(sessionData, { ttl: 1800000 }); // 30 minutes

// Template compilation results
await cache.store(compiledTemplate, { ttl: 86400000 }); // 24 hours
```

### 2. Use Context-Aware Keys

```javascript
// Include relevant context in cache decisions
const context = {
  userId: 123,
  theme: 'dark',
  locale: 'en-US',
  version: '1.2.0'
};

const key = cache.generateContentKey(content, context);
```

### 3. Monitor and Tune Performance

```javascript
// Regular performance monitoring
setInterval(async () => {
  const stats = cache.getStatistics();
  
  if (stats.hit_rate < 0.8) {
    console.warn('Low cache hit rate, consider adjusting TTL');
  }
  
  if (stats.health.memory_pressure > 0.9) {
    await gc.collect('memory');
  }
}, 60000); // Check every minute
```

### 4. Handle Cache Failures Gracefully

```javascript
async function getCachedData(key, generator) {
  try {
    // Try cache first
    let content = await cache.retrieve(key);
    
    if (!content && typeof generator === 'function') {
      // Generate and cache on miss
      content = await generator();
      if (content) {
        await cache.store(content, { generated: true });
      }
    }
    
    return content;
    
  } catch (error) {
    console.warn('Cache operation failed, falling back to generator:', error);
    return typeof generator === 'function' ? await generator() : null;
  }
}
```

## Configuration Examples

### Development Configuration

```javascript
const devCache = new ContentAddressedCache({
  cacheDir: './dev-cache',
  enableCompression: false,    // Faster for development
  enableIntegrity: true,       // Catch issues early
  defaultTTL: 300000,         // 5 minutes (fast iteration)
  maxEntries: 1000,           // Small for development
  cleanupInterval: 60000      // 1 minute cleanup
});
```

### Production Configuration

```javascript
const prodCache = new ContentAddressedCache({
  cacheDir: '/var/cache/kgen',
  enableCompression: true,
  compressionLevel: 6,
  enableIntegrity: true,
  writeBehind: true,
  batchWrites: true,
  maxCacheSize: '10GB',
  maxEntries: 100000,
  defaultTTL: 86400000,       // 24 hours
  cleanupInterval: 3600000,   // 1 hour
  
  templateCacheOptions: {
    maxSize: 1000,
    ttl: 1800000,             // 30 minutes
    compressionThreshold: 2048
  }
});
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory pressure
   kgen cache show --stats
   
   # Run memory cleanup
   kgen cache gc --strategy memory
   ```

2. **Low Hit Rate**  
   ```bash
   # Analyze cache effectiveness
   kgen cache show --stats --entries
   
   # Check for cache fragmentation
   kgen cache ls --sort accessed --order asc
   ```

3. **Disk Space Issues**
   ```bash
   # Clean up disk cache
   kgen cache gc --strategy disk
   
   # Remove old entries
   kgen cache purge --older-than 7d
   ```

4. **Performance Issues**
   ```bash
   # Analyze GC performance
   kgen cache gc --analyze
   
   # Check system health
   kgen cache show --stats
   ```

For more information, see the [KGEN Cache System API Documentation](./api/cache.md).