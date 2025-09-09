# Enterprise Error Handling Standards

## Overview

This document defines the enterprise-grade error handling standards implemented in the Unjucks project. All error handling follows these patterns to ensure consistency, security, and reliability across the entire codebase.

## Error Handling Architecture

### Core Components

1. **ActionableError System** - Base error classes with recovery suggestions
2. **Enterprise Logger** - Structured logging with audit capabilities
3. **Error Recovery System** - Circuit breakers, retry mechanisms, graceful degradation
4. **Enterprise Error Handler** - Unified error processing with full enterprise features

### Error Categories

All errors are categorized into one of these types:

- `CONFIGURATION` - Configuration and environment issues
- `VALIDATION` - Input validation failures
- `NETWORK` - Network connectivity problems
- `FILE_SYSTEM` - File system access issues
- `TEMPLATE` - Template processing errors
- `AUTHENTICATION` - Authentication failures
- `AUTHORIZATION` - Authorization/permission issues
- `RESOURCE` - Resource allocation problems
- `TIMEOUT` - Operation timeout errors

## Implementation Standards

### 1. Error Creation

**✅ DO - Use Actionable Errors:**
```javascript
import { ValidationError, NetworkError } from '../lib/actionable-error.js';

// For validation errors
throw new ValidationError(['Invalid email format'], 'user_registration');

// For network errors  
throw new NetworkError('API_CALL', 'Connection timeout', originalError);
```

**❌ DON'T - Use Generic Errors:**
```javascript
// Avoid generic errors without context
throw new Error('Something went wrong');
throw new Error('Validation failed');
```

### 2. Error Handling

**✅ DO - Use Enterprise Error Handler:**
```javascript
import { handleEnterpriseError } from '../lib/enterprise-error-handler.js';

try {
  await riskyOperation();
} catch (error) {
  const result = await handleEnterpriseError(error, {
    operation: 'template_generation',
    userId: req.userId,
    sessionId: req.sessionId,
    metadata: {
      templatePath: templatePath,
      variables: sanitizedVariables
    }
  });
  
  if (!result.handled) {
    // Handle unrecoverable error
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**❌ DON'T - Use Basic Console Logging:**
```javascript
// Avoid basic console logging
try {
  await operation();
} catch (error) {
  console.error(error); // No context, no recovery, no security
  process.exit(1); // Hostile shutdown
}
```

### 3. Error Recovery

**✅ DO - Implement Circuit Breakers:**
```javascript
import { withErrorRecovery } from '../lib/error-recovery.js';

const result = await withErrorRecovery('external-api', async () => {
  return await callExternalAPI(data);
}, {
  useCircuitBreaker: true,
  useRetry: true,
  useDegradation: true,
  fallback: async (context, error) => {
    // Graceful degradation
    return await useCachedResponse(context);
  }
});
```

**❌ DON'T - Fail Without Recovery:**
```javascript
// Avoid failing without recovery attempts
try {
  return await externalAPI.call(data);
} catch (error) {
  throw error; // No retry, no fallback, no circuit breaker
}
```

### 4. Logging Standards

**✅ DO - Use Enterprise Logger:**
```javascript
import { EnterpriseLogger } from '../lib/enterprise/EnterpriseLogger.js';

const logger = new EnterpriseLogger({
  service: 'template-processor',
  environment: process.env.NODE_ENV,
  auditTrail: true
});

logger.error('Template processing failed', {
  templateId: templateId,
  userId: userId,
  errorCategory: 'TEMPLATE',
  metadata: sanitizedMetadata
});

// For security events
logger.audit('Authentication failure', {
  userId: attemptedUserId,
  ipAddress: req.ip,
  timestamp: new Date().toISOString()
});
```

**❌ DON'T - Log Sensitive Information:**
```javascript
// Avoid logging sensitive data
console.error('Login failed', {
  password: userPassword, // NEVER log passwords
  apiKey: process.env.API_KEY, // NEVER log secrets
  creditCard: paymentInfo.ccNumber // NEVER log PII
});
```

## Security Requirements

### Sensitive Data Protection

All error messages and logs are automatically sanitized to prevent exposure of:

- Passwords and secrets
- API keys and tokens
- Credit card numbers
- Social Security Numbers
- Authorization headers
- Any pattern matching sensitive data regex

### Audit Trail Requirements

The following events must be audited:

1. Authentication failures
2. Authorization violations  
3. Configuration changes
4. File system access errors
5. Network security errors
6. Any error marked with `metadata.audit = true`

### Example Audit Log Entry:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "audit",
  "service": "unjucks",
  "environment": "prod",
  "message": "AUDIT: Authentication failure",
  "metadata": {
    "auditType": "security",
    "compliance": "enterprise",
    "userId": "user123",
    "operation": "login_attempt",
    "ipAddress": "192.168.1.100"
  },
  "hash": "a1b2c3d4e5f6..."
}
```

## Performance Standards

### Error Processing Requirements

- Error handling must complete within 100ms
- Stack trace capture must not exceed 50ms
- Log persistence must be asynchronous
- Memory usage must not exceed 10MB for error contexts

### Circuit Breaker Configuration

```javascript
const circuitBreakerConfig = {
  failureThreshold: 5,     // Open after 5 failures
  successThreshold: 2,     // Close after 2 successes
  timeout: 60000,          // 1 minute timeout
  onStateChange: (state) => {
    logger.info(`Circuit breaker state changed to: ${state.to}`);
  }
};
```

### Retry Configuration

```javascript
const retryConfig = {
  maxRetries: 3,           // Maximum 3 retry attempts
  baseDelay: 1000,         // 1 second base delay
  maxDelay: 30000,         // 30 second maximum delay
  backoffFactor: 2,        // Exponential backoff
  jitter: true             // Add randomization
};
```

## Monitoring and Metrics

### Error Metrics Collection

The system automatically collects:

- Total error count by category
- Recovery success/failure rates
- Circuit breaker trip counts
- Retry attempt statistics
- Sensitive data exposure detection
- Processing time metrics

### Health Check Integration

```javascript
app.get('/health', (req, res) => {
  const metrics = enterpriseErrorHandler.getMetrics();
  const recoveryStats = errorRecovery.getRecoveryStats();
  
  res.json({
    status: 'healthy',
    errors: metrics,
    recovery: recoveryStats,
    timestamp: new Date().toISOString()
  });
});
```

## Migration Guide

### Transforming Legacy Error Handling

Use the error transformation utilities to automatically convert legacy patterns:

```javascript
import { transformErrorHandling } from '../lib/error-transformation-patterns.js';

// Automatically transforms:
// console.error("Error occurred"); process.exit(1);
// 
// Into:
// console.error("Error occurred"); 
// handleError(new ActionableError({...}));
```

### Common Transformation Patterns

1. **Process Exit Elimination:**
   - `process.exit(1)` → `handleError(error)`
   - `console.error(); process.exit(1)` → `handleError(error, { verbose: true })`

2. **Error Enrichment:**
   - `throw new Error(message)` → `throw new ValidationError([message], context)`
   - Generic errors → Categorized actionable errors

3. **Recovery Implementation:**
   - Hard failures → Circuit breaker patterns
   - Single attempts → Retry with exponential backoff
   - No fallbacks → Graceful degradation strategies

## Compliance Checklist

### ✅ Security Compliance
- [ ] No sensitive data in error messages
- [ ] All authentication errors audited
- [ ] Stack traces sanitized in production
- [ ] Error context properly redacted
- [ ] Audit trail integrity verified

### ✅ Performance Compliance  
- [ ] Error handling < 100ms
- [ ] Asynchronous log persistence
- [ ] Memory usage < 10MB per context
- [ ] Circuit breakers configured
- [ ] Retry limits enforced

### ✅ Operational Compliance
- [ ] All errors categorized
- [ ] Recovery strategies implemented
- [ ] Metrics collection active
- [ ] Health checks exposed
- [ ] Documentation updated

## Testing Requirements

### Error Scenario Testing

All error paths must be tested with:

1. **Unit Tests** - Individual error classes and handlers
2. **Integration Tests** - End-to-end error flow testing  
3. **Performance Tests** - Error handling latency verification
4. **Security Tests** - Sensitive data exposure verification
5. **Recovery Tests** - Circuit breaker and retry mechanism validation

### Example Test Structure

```javascript
describe('Enterprise Error Handling', () => {
  it('should sanitize sensitive data in error messages', async () => {
    const error = new Error('Password: secret123 failed validation');
    const result = await handleEnterpriseError(error, {
      operation: 'validation'
    });
    
    expect(result.error.message).not.toContain('secret123');
    expect(result.error.message).toContain('[REDACTED]');
  });
  
  it('should implement circuit breaker for network errors', async () => {
    // Test circuit breaker behavior
  });
  
  it('should audit authentication errors', async () => {
    // Test audit trail creation
  });
});
```

## Conclusion

This enterprise error handling standard ensures:

- **Reliability** through circuit breakers and retry mechanisms
- **Security** through sensitive data protection and audit trails
- **Observability** through comprehensive metrics and logging
- **Maintainability** through consistent patterns and recovery strategies
- **Compliance** through audit trails and structured error categorization

All developers must follow these standards when implementing error handling in the Unjucks project.