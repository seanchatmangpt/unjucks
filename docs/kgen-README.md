# KGEN - Knowledge Graph Engine

A production-ready Knowledge Graph Engine built for enterprise applications, featuring RDF processing, SHACL validation, RESTful APIs, and comprehensive monitoring.

## Architecture Overview

KGEN follows a modular, event-driven architecture designed for scalability, reliability, and maintainability:

```
┌─────────────────────────────────────────────────────────────┐
│                    KGEN Engine Core                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   RDF       │  │   Validation │  │   API Server    │    │
│  │ Processor   │  │    Engine    │  │  (Express.js)   │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
│         │                 │                    │           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │  Database   │  │    Cache     │  │   Security      │    │
│  │  Manager    │  │   Manager    │  │   Manager       │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
│         │                 │                    │           │
│  ┌─────────────────────────────────────────────────────────┤
│  │              Monitoring System                          │
│  │        (Metrics, Logging, Health Checks)               │
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

## Core Features

### 🔍 RDF Processing
- **N3.js Integration**: Full support for Turtle, N-Triples, RDF/XML, JSON-LD
- **SPARQL Querying**: SELECT, CONSTRUCT, ASK, DESCRIBE operations
- **Namespace Management**: Automatic prefix resolution and management
- **Graph Operations**: Multi-graph support with named graphs

### 🛡️ Validation Engine
- **SHACL Validation**: W3C SHACL specification compliance
- **Custom Rules**: Extensible validation rule system
- **Data Quality Checks**: Graph size, URI format, datatype consistency
- **Caching**: Intelligent validator caching for performance

### 🌐 RESTful API
- **OpenAPI/Swagger**: Comprehensive API documentation
- **Rate Limiting**: Configurable request throttling
- **Security Headers**: CORS, Helmet, security best practices
- **Input Validation**: Request sanitization and validation

### 🔐 Enterprise Security
- **JWT Authentication**: Secure token-based authentication
- **API Key Support**: Optional API key authentication
- **Role-Based Authorization**: Granular permission system
- **SPARQL Security**: Query pattern analysis and blocking

### 📊 Monitoring & Observability
- **Prometheus Metrics**: Comprehensive performance metrics
- **Winston Logging**: Structured logging with rotation
- **Health Checks**: Real-time system health monitoring
- **Performance Tracking**: Request timing and resource usage

### 💾 Storage & Caching
- **PostgreSQL**: Primary data store with RDF table schema
- **Redis Cache**: Query result caching with compression
- **Memory Cache**: Multi-tier caching strategy
- **Optional Databases**: MongoDB, Neo4j, Elasticsearch support

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+ (optional but recommended)

### Installation

```bash
# Clone and install dependencies
git clone <repository>
cd unjucks
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database credentials

# Initialize and start KGEN
npm run kgen:start
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t kgen .
docker run -p 3000:3000 kgen
```

## Configuration

### Environment Variables

```bash
# Server Configuration
KGEN_PORT=3000
KGEN_HOST=0.0.0.0

# Database Configuration
KGEN_PG_HOST=localhost
KGEN_PG_PORT=5432
KGEN_PG_DATABASE=kgen
KGEN_PG_USERNAME=kgen
KGEN_PG_PASSWORD=your_password

# Redis Configuration
KGEN_REDIS_HOST=localhost
KGEN_REDIS_PORT=6379
KGEN_REDIS_PASSWORD=your_redis_password

# Security Configuration
KGEN_JWT_SECRET=your-super-secure-jwt-secret-key
KGEN_JWT_EXPIRES_IN=24h

# Monitoring Configuration
KGEN_LOG_LEVEL=info
KGEN_METRICS_ENABLED=true
```

### Configuration File

The main configuration is in `src/kgen/config/default.js` with environment-specific overrides.

## API Usage

### Start the Engine

```javascript
import { createKGenEngine } from './src/kgen/index.js';

const engine = createKGenEngine({
  api: { port: 3000 },
  database: { /* db config */ },
  monitoring: { /* monitoring config */ }
});

await engine.initialize();
await engine.startAPI();
```

### REST API Endpoints

#### RDF Operations

```bash
# Parse RDF data
POST /api/rdf/parse
Content-Type: application/json
{
  "data": "@prefix ex: <http://example.org/> . ex:subject ex:predicate \"object\" .",
  "format": "turtle",
  "addToStore": true
}

# Serialize RDF data
GET /api/rdf/serialize?format=turtle

# Get store statistics
GET /api/rdf/stats
```

#### SPARQL Queries

```bash
# Execute SPARQL query
POST /api/sparql/query
Content-Type: application/json
{
  "query": "SELECT * WHERE { ?s ?p ?o } LIMIT 10",
  "maxResults": 100,
  "cache": true
}

# GET query for simple cases
GET /api/sparql/query?query=SELECT%20*%20WHERE%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D%20LIMIT%2010
```

#### Validation

```bash
# SHACL validation
POST /api/validate/shacl
Content-Type: application/json
{
  "data": "RDF data to validate",
  "shapes": "SHACL shapes",
  "dataFormat": "turtle",
  "shapesFormat": "turtle"
}
```

#### System Management

```bash
# System status
GET /api/system/status

# Health check
GET /api/system/health-check

# Metrics (Prometheus format)
GET /metrics
```

## Programming Interface

### Direct Engine Usage

```javascript
import { createKGenEngine } from './src/kgen/index.js';

const engine = createKGenEngine();
await engine.initialize();

// Process RDF data
const result = await engine.processRDF(turtleData, { format: 'turtle' });

// Execute SPARQL query
const queryResult = await engine.query('SELECT * WHERE { ?s ?p ?o } LIMIT 10');

// Validate with SHACL
const validation = await engine.validateRDF(data, shapes);

// Get system status
const status = engine.getStatus();
```

### Subsystem Access

```javascript
// Access individual subsystems
const rdf = engine.getSubsystem('rdf');
const cache = engine.getSubsystem('cache');
const security = engine.getSubsystem('security');
const monitoring = engine.getSubsystem('monitoring');

// Use subsystem directly
const parseResult = await rdf.parseRDF(data, 'turtle');
const cached = await cache.get('query:12345');
const token = security.generateToken({ userId: 'user123' });
const metrics = await monitoring.getMetrics();
```

## Performance & Scalability

### Caching Strategy
- **L1 Cache**: In-memory LRU cache for hot data
- **L2 Cache**: Redis for shared cache across instances
- **Query Cache**: SPARQL query result caching
- **Validator Cache**: Compiled SHACL shapes caching

### Database Optimization
- **Connection Pooling**: Configurable PostgreSQL connection pools
- **Indexed Queries**: Optimized RDF triple storage schema
- **Batch Operations**: Efficient bulk data operations

### Monitoring & Alerts
- **Custom Metrics**: Application-specific performance metrics
- **Threshold Alerts**: Configurable performance thresholds
- **Health Checks**: Automated system health monitoring

## Security Features

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with configurable expiry
- **API Keys**: Optional API key authentication for services
- **Role-Based Access**: Granular permission system
- **Session Management**: Secure session handling with blacklisting

### Input Validation & Sanitization
- **Request Validation**: Comprehensive input validation
- **SPARQL Security**: Query pattern analysis and injection prevention
- **Rate Limiting**: Configurable rate limiting per endpoint
- **Security Headers**: CORS, CSRF, XSS protection

### Data Protection
- **Password Hashing**: Bcrypt with configurable rounds
- **Secrets Management**: Environment-based secret configuration
- **Audit Logging**: Security event logging and monitoring

## Deployment

### Production Checklist

- [ ] Configure production database
- [ ] Setup Redis cluster
- [ ] Configure JWT secrets
- [ ] Enable HTTPS/TLS
- [ ] Setup monitoring alerts
- [ ] Configure log aggregation
- [ ] Setup backup strategy
- [ ] Configure firewall rules

### Docker Deployment

```dockerfile
# Multi-stage production build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "kgen:start"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kgen
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kgen
  template:
    metadata:
      labels:
        app: kgen
    spec:
      containers:
      - name: kgen
        image: kgen:latest
        ports:
        - containerPort: 3000
        env:
        - name: KGEN_PG_HOST
          value: "postgresql-service"
        - name: KGEN_REDIS_HOST
          value: "redis-service"
```

## Monitoring & Observability

### Prometheus Metrics

Key metrics exported:
- `kgen_http_requests_total`: HTTP request count
- `kgen_http_request_duration_seconds`: Request duration histogram
- `kgen_rdf_triples_processed_total`: RDF triples processed
- `kgen_sparql_queries_total`: SPARQL queries executed
- `kgen_auth_attempts_total`: Authentication attempts
- `kgen_system_memory_usage_bytes`: Memory usage

### Health Checks

- **Liveness**: `/health` - Basic service health
- **Readiness**: `/api/system/health-check` - Detailed subsystem health
- **Metrics**: `/metrics` - Prometheus metrics endpoint

### Logging

Structured JSON logging with:
- Request/response logging
- Error tracking with stack traces
- Security event logging
- Performance monitoring
- Audit trail logging

## Development

### Project Structure

```
src/kgen/
├── index.js              # Main engine orchestrator
├── config/
│   └── default.js        # Configuration management
├── rdf/
│   └── index.js          # RDF processing (N3.js)
├── api/
│   └── server.js         # Express.js API server
├── db/
│   └── index.js          # Database management
├── cache/
│   └── index.js          # Redis/memory caching
├── security/
│   └── index.js          # Authentication/authorization
├── monitoring/
│   └── index.js          # Metrics/logging
└── validation/
    └── index.js          # SHACL validation
```

### Adding Custom Features

1. **Custom Validation Rules**:
```javascript
const engine = createKGenEngine();
const validation = engine.getSubsystem('validation');

validation.addCustomRule('my-rule', {
  name: 'My Custom Rule',
  description: 'Custom validation logic',
  execute: async (dataGraph, options) => {
    // Your validation logic
    return { passed: true, violations: [] };
  }
});
```

2. **Custom API Endpoints**:
```javascript
const api = engine.getSubsystem('api');
api.app.get('/api/custom', (req, res) => {
  res.json({ message: 'Custom endpoint' });
});
```

3. **Custom Metrics**:
```javascript
const monitoring = engine.getSubsystem('monitoring');
monitoring.incrementCounter('custom_operations_total');
monitoring.recordHistogram('custom_operation_duration', 0.5);
```

## Testing

```bash
# Run KGEN-specific tests
npm run kgen:test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL service status
   - Verify connection credentials
   - Check network connectivity

2. **Redis Connection Issues**
   - Verify Redis service availability
   - Check authentication credentials
   - Review network configuration

3. **High Memory Usage**
   - Monitor cache sizes
   - Adjust memory cache limits
   - Review query complexity

4. **Slow SPARQL Queries**
   - Enable query caching
   - Optimize graph structure
   - Add database indexes

### Debug Mode

```bash
# Enable debug logging
KGEN_LOG_LEVEL=debug npm run kgen:start

# Enable development features
NODE_ENV=development npm run kgen:dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: [API Documentation](http://localhost:3000/api-docs)
- **Issues**: [GitHub Issues](https://github.com/your-org/kgen/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/kgen/discussions)

---

Built with ❤️ for the Semantic Web community