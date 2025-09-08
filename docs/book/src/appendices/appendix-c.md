# Appendix C: Troubleshooting Common Issues

## Overview

This appendix provides solutions to common issues encountered during spec-driven development with AI tools, organized by category and severity.

## AI Tool Configuration Issues

### API Key and Authentication Problems

#### Issue: "Authentication failed" or "Invalid API key"

**Symptoms:**
- API requests failing with 401/403 errors
- AI tools not responding or throwing authentication errors
- Rate limiting errors

**Solutions:**

1. **Verify API Key Format:**
```bash
# Check if API key is properly formatted
echo $CLAUDE_API_KEY | grep -E '^sk-[a-zA-Z0-9]{40,}$'

# For OpenAI
echo $OPENAI_API_KEY | grep -E '^sk-[a-zA-Z0-9-]{48,}$'
```

2. **Environment Variable Setup:**
```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export CLAUDE_API_KEY="your-actual-api-key-here"
export OPENAI_API_KEY="your-openai-key-here"

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

3. **Verify Key Permissions:**
```bash
# Test API key functionality
curl -H "Authorization: Bearer $CLAUDE_API_KEY" \
     https://api.anthropic.com/v1/health
```

#### Issue: Rate limiting and quota exceeded

**Solutions:**

1. **Configure Rate Limiting:**
```javascript
// rate-limit.config.js
module.exports = {
  rateLimiting: {
    requests: 50,
    window: '1m',
    retryAfter: 60000,
    exponentialBackoff: true
  }
};
```

2. **Implement Request Queuing:**
```typescript
class RequestQueue {
  private queue: Request[] = [];
  private processing = false;
  
  async addRequest(request: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...request, resolve, reject });
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      try {
        const response = await this.executeRequest(request);
        request.resolve(response);
      } catch (error) {
        request.reject(error);
      }
      
      // Wait between requests to respect rate limits
      await this.delay(1200); // 50 requests per minute
    }
    this.processing = false;
  }
}
```

## Multi-Agent Coordination Issues

### Agent Communication Failures

#### Issue: Agents not communicating or coordinating properly

**Symptoms:**
- Agents working on duplicate tasks
- Inconsistent results between agents
- Agent handoff failures
- Communication timeouts

**Solutions:**

1. **Check Agent Configuration:**
```bash
# Verify swarm status
npx claude-flow swarm status --detailed

# Check agent connectivity
npx claude-flow agent ping --all

# Validate coordination topology
npx claude-flow topology validate
```

2. **Reset Agent Coordination:**
```bash
# Stop all agents
npx claude-flow swarm stop

# Clear shared memory
npx claude-flow memory clear --confirm

# Reinitialize swarm
npx claude-flow swarm init --topology mesh --max-agents 6
```

3. **Debug Communication Issues:**
```typescript
// Enable detailed logging
const debugConfig = {
  logging: {
    level: 'debug',
    categories: ['agent-communication', 'coordination', 'memory']
  },
  
  debugging: {
    traceMessages: true,
    logHandoffs: true,
    memoryOperations: true
  }
};
```

### Memory Synchronization Problems

#### Issue: Shared memory corruption or synchronization failures

**Solutions:**

1. **Memory Diagnostic:**
```bash
# Check memory status
npx claude-flow memory status

# Validate memory integrity
npx claude-flow memory validate --repair

# Backup and restore memory
npx claude-flow memory backup --output ./memory-backup.json
npx claude-flow memory restore --input ./memory-backup.json
```

2. **Configure Memory Synchronization:**
```javascript
// memory-sync.config.js
module.exports = {
  sync: {
    interval: 5000,
    conflictResolution: 'timestamp',
    validation: true,
    compression: true
  },
  
  persistence: {
    enabled: true,
    format: 'json',
    location: './memory-store'
  }
};
```

## Template and Code Generation Issues

### Template Processing Failures

#### Issue: Templates not rendering or generating incorrect output

**Symptoms:**
- Template variables not being substituted
- Conditional logic not working
- File generation failures
- Path resolution errors

**Solutions:**

1. **Template Validation:**
```bash
# Validate template syntax
unjucks validate ./templates --verbose

# Test template with sample data
unjucks test ./templates/component.njk --data '{"name": "TestComponent"}'

# Debug template processing
unjucks generate component --name TestComponent --dry-run --debug
```

2. **Fix Common Template Issues:**
```yaml
# Common template problems and fixes

# Problem: Variables not rendering
# Fix: Check variable naming and context
---
to: src/{{ kebabCase name }}/index.ts  # Correct
# Not: src/{{ name }}/index.ts        # May have spacing issues

# Problem: Conditional generation not working  
# Fix: Proper skipIf syntax
skipIf: "{{ name === 'skip' }}"         # Correct
# Not: skipIf: {{ name === 'skip' }}    # Missing quotes

# Problem: File paths with spaces
# Fix: Use proper escaping
to: "src/{{ pascalCase name }}/{{ kebabCase name }}.component.ts"
```

3. **Context Data Issues:**
```typescript
// Debug context data
const debugContext = {
  ...originalContext,
  _debug: {
    templatePath: template.path,
    variables: Object.keys(originalContext),
    timestamp: new Date().toISOString()
  }
};

// Log context for debugging
console.log('Template Context:', JSON.stringify(debugContext, null, 2));
```

### File System Operation Failures

#### Issue: File creation, modification, or injection failures

**Solutions:**

1. **Permission Issues:**
```bash
# Check file permissions
ls -la src/components/

# Fix permission issues
chmod 755 src/
chmod 644 src/**/*

# Run with proper permissions
sudo unjucks generate component --name UserProfile
```

2. **Path Resolution Problems:**
```javascript
// path-resolver.js
const path = require('path');

function resolveTemplatePath(templatePath, context) {
  try {
    // Resolve relative paths
    const resolved = path.resolve(process.cwd(), templatePath);
    
    // Validate path exists
    if (!fs.existsSync(path.dirname(resolved))) {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
    }
    
    return resolved;
  } catch (error) {
    console.error('Path resolution failed:', error);
    throw error;
  }
}
```

## Performance Issues

### Slow AI Response Times

#### Issue: AI tools responding slowly or timing out

**Solutions:**

1. **Optimize Request Configuration:**
```javascript
// performance.config.js
module.exports = {
  ai: {
    timeout: 30000,        // 30 seconds
    maxTokens: 2000,       // Reduce for faster responses
    temperature: 0.7,      // Lower for more deterministic results
    streaming: true        // Enable streaming responses
  },
  
  caching: {
    enabled: true,
    ttl: 3600,             // 1 hour cache
    maxSize: '100MB'
  }
};
```

2. **Implement Request Batching:**
```typescript
class RequestBatcher {
  private batch: Request[] = [];
  private timeout: NodeJS.Timeout | null = null;
  
  addRequest(request: Request) {
    this.batch.push(request);
    
    if (this.timeout) clearTimeout(this.timeout);
    
    this.timeout = setTimeout(() => {
      this.processBatch();
    }, 100); // Batch requests for 100ms
  }
  
  private async processBatch() {
    if (this.batch.length === 0) return;
    
    const requests = [...this.batch];
    this.batch = [];
    
    // Process requests in parallel
    const results = await Promise.all(
      requests.map(request => this.processRequest(request))
    );
    
    return results;
  }
}
```

### Memory Usage Issues

#### Issue: High memory consumption or memory leaks

**Solutions:**

1. **Memory Monitoring:**
```javascript
// memory-monitor.js
function monitorMemory() {
  const usage = process.memoryUsage();
  
  console.log('Memory Usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB'
  });
  
  // Alert if memory usage is high
  if (usage.heapUsed > 512 * 1024 * 1024) { // 512MB
    console.warn('High memory usage detected');
    if (global.gc) {
      global.gc();
    }
  }
}

// Monitor every 30 seconds
setInterval(monitorMemory, 30000);
```

2. **Memory Optimization:**
```typescript
// Implement proper cleanup
class ResourceManager {
  private resources: Map<string, any> = new Map();
  
  add(id: string, resource: any) {
    this.resources.set(id, resource);
  }
  
  cleanup() {
    for (const [id, resource] of this.resources) {
      if (resource.cleanup) {
        resource.cleanup();
      }
    }
    this.resources.clear();
  }
}

// Use WeakMap for automatic garbage collection
const cache = new WeakMap();
```

## Quality and Validation Issues

### Code Quality Problems

#### Issue: AI-generated code not meeting quality standards

**Solutions:**

1. **Configure Quality Gates:**
```javascript
// quality-gates.config.js
module.exports = {
  gates: [
    {
      name: 'syntax-validation',
      enabled: true,
      blocking: true
    },
    {
      name: 'security-scan',
      enabled: true,
      blocking: true,
      rules: ['no-hardcoded-secrets', 'no-sql-injection']
    },
    {
      name: 'complexity-check',
      enabled: true,
      blocking: false,
      threshold: 10
    }
  ]
};
```

2. **Implement Validation Pipeline:**
```typescript
class ValidationPipeline {
  private validators: Validator[] = [];
  
  addValidator(validator: Validator) {
    this.validators.push(validator);
  }
  
  async validate(code: string): Promise<ValidationResult> {
    const results = [];
    
    for (const validator of this.validators) {
      try {
        const result = await validator.validate(code);
        results.push(result);
        
        if (!result.passed && validator.blocking) {
          throw new Error(`Validation failed: ${result.message}`);
        }
      } catch (error) {
        console.error(`Validator ${validator.name} failed:`, error);
        if (validator.blocking) {
          throw error;
        }
      }
    }
    
    return {
      passed: results.every(r => r.passed),
      results
    };
  }
}
```

## Deployment and Integration Issues

### CI/CD Pipeline Failures

#### Issue: Automated builds or deployments failing

**Solutions:**

1. **Debug GitHub Actions:**
```yaml
# .github/workflows/debug.yml
name: Debug Build

on:
  workflow_dispatch:  # Manual trigger

jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Debug Environment
        run: |
          echo "Node version: $(node --version)"
          echo "NPM version: $(npm --version)"
          echo "Environment variables:"
          env | grep -E '(NODE|NPM|AI_)' | sort
      
      - name: Debug Dependencies
        run: |
          npm list --depth=0
          npx claude-flow version
      
      - name: Debug Tests
        run: |
          npm test -- --verbose
```

2. **Environment Consistency:**
```dockerfile
# Dockerfile.debug
FROM node:18-alpine

# Install debugging tools
RUN apk add --no-cache curl jq

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

## Emergency Recovery Procedures

### Project State Corruption

#### Issue: Project in inconsistent or corrupted state

**Recovery Steps:**

1. **Create Emergency Backup:**
```bash
# Backup current state
tar -czf emergency-backup-$(date +%Y%m%d-%H%M%S).tar.gz \    
    --exclude=node_modules \    
    --exclude=.git \    
    .
```

2. **Reset to Known Good State:**
```bash
# Reset git to last known good commit
git log --oneline -n 10  # Find good commit
git reset --hard <good-commit-hash>

# Clean up generated files
npm run clean
rm -rf node_modules
npm install

# Rebuild project
npm run build
npm test
```

3. **Validate Recovery:**
```bash
# Run comprehensive validation
npx claude-flow sparc validate --strict
npx claude-flow sparc health-check

# Test critical functionality
npm run test:integration
npm run test:e2e
```

### Data Loss Prevention

#### Automated Backup Strategy:
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="./backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Backup project files
cp -r src tests docs "$BACKUP_DIR/"

# Backup configuration
cp *.config.* *.json *.yaml "$BACKUP_DIR/" 2>/dev/null || true

# Backup AI memory and cache
npx claude-flow memory backup --output "$BACKUP_DIR/memory.json"

# Create archive
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "Backup created: $BACKUP_DIR.tar.gz"
```

This troubleshooting guide provides comprehensive solutions for common issues in AI-assisted development workflows, helping teams quickly identify and resolve problems to maintain productivity.