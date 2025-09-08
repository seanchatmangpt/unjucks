# Appendix B: AI Tool Configuration Guide

## Overview

This appendix provides comprehensive guidance for configuring and optimizing AI tools for spec-driven development workflows. It covers setup, configuration, and best practices for various AI development environments.

## Claude Configuration

### API Setup

```javascript
// claude.config.js
module.exports = {
  apiKey: process.env.CLAUDE_API_KEY,
  model: 'claude-3-sonnet-20240229',
  maxTokens: 4000,
  temperature: 0.7,
  
  // Request configuration
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  
  // Development-specific settings
  development: {
    streaming: true,
    verbose: true,
    caching: true
  },
  
  // Production settings
  production: {
    streaming: false,
    verbose: false,
    caching: true,
    rateLimiting: {
      requests: 100,
      period: '1m'
    }
  }
};
```

### Environment Variables

```bash
# Required
CLAUDE_API_KEY=your-claude-api-key

# Optional configuration
CLAUDE_MODEL=claude-3-sonnet-20240229
CLAUDE_MAX_TOKENS=4000
CLAUDE_TEMPERATURE=0.7
CLAUDE_TIMEOUT=30000
CLAUDE_MAX_RETRIES=3

# Development settings
CLAUDE_DEBUG=true
CLAUDE_VERBOSE=true
CLAUDE_CACHE_ENABLED=true
```

### Multi-Agent Configuration

```typescript
// claude-flow.config.ts
import { ClaudeFlowConfig } from 'claude-flow';

const config: ClaudeFlowConfig = {
  swarm: {
    topology: 'mesh',
    maxAgents: 8,
    coordinationTimeout: 120000,
    memorySharing: true
  },
  
  agents: {
    researcher: {
      model: 'claude-3-sonnet',
      temperature: 0.5,
      capabilities: ['analysis', 'documentation', 'research']
    },
    coder: {
      model: 'claude-3-sonnet', 
      temperature: 0.3,
      capabilities: ['implementation', 'debugging', 'optimization']
    },
    tester: {
      model: 'claude-3-haiku',
      temperature: 0.2,
      capabilities: ['testing', 'validation', 'quality-assurance']
    }
  },
  
  coordination: {
    messageQueue: 'memory',
    persistence: true,
    sessionTimeout: 3600000
  }
};

export default config;
```

## GitHub Copilot Configuration

### VS Code Settings

```json
{
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "plaintext": false,
    "markdown": true
  },
  
  "github.copilot.editor.enableAutoCompletions": true,
  "github.copilot.editor.enableCodeActions": true,
  
  "github.copilot.advanced": {
    "secret_key": "auto",
    "length": 500,
    "temperature": 0.1,
    "top_p": 1,
    "listCount": 10,
    "inlineSuggestCount": 3
  },
  
  "github.copilot.chat.localeOverride": "en",
  "github.copilot.chat.welcomeMessage": "never"
}
```

### JetBrains IDEs Configuration

```kotlin
// .idea/copilot.xml
<application>
  <component name="GitHubCopilotSettings">
    <option name="enableAutoTrigger" value="true" />
    <option name="enableTabCompletion" value="true" />
    <option name="maxSuggestions" value="5" />
    <option name="enableLogging" value="true" />
  </component>
</application>
```

## AI Development Environment Setup

### VS Code Extensions

```json
{
  "recommendations": [
    "github.copilot",
    "github.copilot-chat", 
    "ms-vscode.vscode-ai",
    "claude-ai.claude-code",
    "openai.openai-api",
    "ruv.claude-flow"
  ]
}
```

### Development Container Configuration

```dockerfile
# .devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:18

# Install AI development tools
RUN npm install -g \
    claude-flow@latest \
    @ai-tools/cli \
    @openai/api

# Configure environment
ENV NODE_ENV=development
ENV AI_DEVELOPMENT_MODE=true

# Copy configuration files
COPY .devcontainer/ai-config.json /workspace/.ai-config.json
COPY .devcontainer/claude-flow.config.js /workspace/claude-flow.config.js

# Set up development workspace
WORKDIR /workspace
```

```json
{
  "name": "AI-Assisted Development",
  "dockerFile": "Dockerfile",
  "context": "..",
  
  "customizations": {
    "vscode": {
      "extensions": [
        "github.copilot",
        "claude-ai.claude-code",
        "ruv.claude-flow"
      ],
      "settings": {
        "terminal.integrated.defaultProfile.linux": "bash",
        "ai.development.mode": true
      }
    }
  },
  
  "forwardPorts": [3000, 8080],
  "postCreateCommand": "npm install && npx claude-flow init",
  
  "remoteEnv": {
    "CLAUDE_API_KEY": "${localEnv:CLAUDE_API_KEY}",
    "OPENAI_API_KEY": "${localEnv:OPENAI_API_KEY}"
  }
}
```

## Optimization Settings

### Performance Tuning

```javascript
// performance.config.js
module.exports = {
  caching: {
    enabled: true,
    provider: 'redis', // 'memory' | 'redis' | 'filesystem'
    ttl: 3600, // 1 hour
    maxSize: '100MB'
  },
  
  rateLimiting: {
    enabled: true,
    requests: 100,
    window: '1m',
    strategy: 'sliding-window'
  },
  
  concurrent: {
    maxConcurrentRequests: 5,
    queueSize: 50,
    timeout: 30000
  },
  
  optimization: {
    batchRequests: true,
    compressRequests: true,
    streamingResponses: true
  }
};
```

### Memory Management

```typescript
// memory.config.ts
export const memoryConfig = {
  // Agent memory settings
  agentMemory: {
    maxSize: '512MB',
    evictionPolicy: 'lru',
    persistToDisk: true,
    compressionEnabled: true
  },
  
  // Shared memory settings
  sharedMemory: {
    maxSize: '1GB',
    syncInterval: 5000,
    conflictResolution: 'last-write-wins'
  },
  
  // Garbage collection
  gc: {
    interval: 60000,
    aggressiveness: 'moderate',
    memoryThreshold: 0.8
  }
};
```

## Security Configuration

### API Key Management

```javascript
// security.config.js
module.exports = {
  apiKeys: {
    encryption: true,
    rotation: {
      enabled: true,
      interval: '30d'
    },
    validation: {
      format: true,
      expiry: true
    }
  },
  
  requests: {
    sanitization: true,
    validation: true,
    logging: {
      enabled: true,
      level: 'info',
      sanitizeSecrets: true
    }
  },
  
  responses: {
    filtering: true,
    sanitization: true,
    contentValidation: true
  }
};
```

### Network Security

```yaml
# network-security.yml
network:
  tls:
    enabled: true
    version: "1.3"
    ciphers: ["TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"]
  
  proxy:
    enabled: false
    url: ""
    auth:
      username: ""
      password: ""
  
  firewall:
    allowedDomains:
      - "api.anthropic.com"
      - "api.openai.com" 
      - "api.github.com"
    blockedIPs: []
  
  monitoring:
    enabled: true
    alertThreshold: 100
    logLevel: "warn"
```

## Quality Assurance Configuration

### Code Quality Settings

```json
{
  "quality": {
    "codeGeneration": {
      "style": "airbnb",
      "formatting": "prettier",
      "linting": "eslint",
      "typeChecking": "typescript"
    },
    
    "validation": {
      "syntaxChecking": true,
      "semanticValidation": true,
      "securityScanning": true,
      "performanceAnalysis": true
    },
    
    "testing": {
      "framework": "jest",
      "coverage": {
        "minimum": 80,
        "target": 95
      },
      "types": ["unit", "integration", "e2e"]
    }
  }
}
```

### Validation Rules

```javascript
// validation-rules.js
module.exports = {
  codeGeneration: [
    {
      rule: 'no-hardcoded-secrets',
      severity: 'error',
      description: 'Generated code must not contain hardcoded secrets'
    },
    {
      rule: 'proper-error-handling',
      severity: 'warning', 
      description: 'Generated code should include proper error handling'
    },
    {
      rule: 'type-safety',
      severity: 'error',
      description: 'Generated TypeScript code must be type-safe'
    }
  ],
  
  testing: [
    {
      rule: 'test-coverage',
      threshold: 0.8,
      severity: 'error'
    },
    {
      rule: 'test-quality',
      metrics: ['assertions', 'edge-cases', 'mocking'],
      severity: 'warning'
    }
  ]
};
```

## Monitoring and Observability

### Metrics Collection

```typescript
// metrics.config.ts
export const metricsConfig = {
  collection: {
    enabled: true,
    interval: 30000,
    batchSize: 100
  },
  
  metrics: {
    performance: {
      responseTime: true,
      throughput: true,
      errorRate: true,
      resourceUsage: true
    },
    
    usage: {
      requestCount: true,
      userSessions: true,
      featureUsage: true,
      agentActivity: true
    },
    
    quality: {
      codeQuality: true,
      testCoverage: true,
      bugRate: true,
      userSatisfaction: true
    }
  },
  
  storage: {
    provider: 'prometheus',
    retention: '30d',
    aggregation: 'daily'
  }
};
```

### Alerting Configuration

```yaml
# alerts.yml
alerts:
  performance:
    - name: high_response_time
      condition: response_time > 5000
      severity: warning
      notification: slack
      
    - name: error_rate_spike
      condition: error_rate > 0.05
      severity: critical
      notification: [email, slack, pagerduty]
  
  quality:
    - name: low_code_quality
      condition: quality_score < 0.8
      severity: warning
      notification: slack
      
    - name: test_coverage_drop
      condition: coverage < 0.85
      severity: warning
      notification: github_comment
  
  usage:
    - name: api_quota_exceeded
      condition: daily_requests > quota * 0.9
      severity: warning
      notification: email
```

## Troubleshooting Configuration

### Debug Settings

```javascript
// debug.config.js
module.exports = {
  logging: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: 'json',
    destination: './logs/app.log',
    rotation: {
      enabled: true,
      maxSize: '100MB',
      maxFiles: 10
    }
  },
  
  debugging: {
    enableSourceMaps: true,
    preserveStackTraces: true,
    detailedErrors: true,
    requestTracking: true
  },
  
  profiling: {
    enabled: process.env.PROFILING === 'true',
    interval: 60000,
    memorySnapshots: true,
    cpuProfiling: true
  }
};
```

### Diagnostic Tools

```bash
#!/bin/bash
# diagnostic.sh

echo "AI Tool Diagnostics"
echo "=================="

# Check environment variables
echo "Environment Variables:"
env | grep -E "(CLAUDE|OPENAI|AI_)" | sort

# Check network connectivity
echo "\nNetwork Connectivity:"
curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/health
curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models

# Check configuration files
echo "\nConfiguration Files:"
ls -la *.config.*

# Check installed packages
echo "\nInstalled AI Packages:"
npm list | grep -E "(claude|openai|ai-)"

# Check system resources
echo "\nSystem Resources:"
df -h
free -h

# Generate diagnostic report
echo "\nGenerating diagnostic report..."
npx claude-flow diagnose --output diagnostic-report.json
```

This configuration guide provides comprehensive setup instructions for optimizing AI tools in spec-driven development environments, ensuring optimal performance, security, and reliability.