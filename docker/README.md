# Docker Testing Environment for Unjucks

## Overview

This directory contains a comprehensive Docker-based testing orchestration system for the Unjucks project. The environment provides isolated, reproducible testing with multiple database containers, service dependencies, network isolation, and comprehensive health checks.

## Architecture

### Network Isolation
- **testing-frontend** (172.20.0.0/24): Frontend application testing
- **testing-backend** (172.21.0.0/24): Backend service testing
- **testing-database** (172.22.0.0/24): Internal database network (isolated)
- **testing-monitoring** (172.23.0.0/24): Monitoring and observability

### Database Containers
- **PostgreSQL 15**: Primary test database with pg_stat_statements
- **Redis 7**: Caching and session storage testing
- **MongoDB 6**: Document database testing
- **Elasticsearch 8.8**: Search functionality testing

### Testing Services
- **Unit Tests**: Isolated unit testing with 4 parallel workers
- **Integration Tests**: Database integration testing
- **End-to-End Tests**: Full application workflow testing
- **Performance Tests**: Load and stress testing with autocannon
- **Security Scanner**: Vulnerability and compliance scanning

### Monitoring & Observability
- **Health Monitor**: Continuous service health monitoring
- **Test Collector**: Aggregates results from all test services
- **Metrics Collection**: Performance and usage metrics

## File Structure

```
docker/
├── docker-compose.testing.yml     # Main orchestration file
├── .env.testing                   # Environment configuration
├── database/
│   ├── init/
│   │   └── 01-init-test-db.sql   # PostgreSQL initialization
│   ├── test-fixtures/             # Test data fixtures
│   └── mongo-init/
│       └── 01-init-test-db.js    # MongoDB initialization
├── redis/
│   └── redis-test.conf           # Redis test configuration
└── scripts/
    ├── health-monitor.sh         # Health monitoring script
    ├── collect-test-results.sh   # Test result aggregation
    ├── performance-tests.sh      # Performance testing suite
    ├── security-scan.sh          # Security scanning suite
    └── validate-testing-environment.sh  # Environment validation
```

## Services Configuration

### Database Services

#### PostgreSQL (postgres-test)
- **Image**: postgres:15-alpine
- **Port**: 5433 (external), 5432 (internal)
- **Database**: unjucks_test
- **User**: test_user / test_password
- **Features**: pg_stat_statements, performance monitoring
- **Health Check**: pg_isready with 30s startup period

#### Redis (redis-test)
- **Image**: redis:7-alpine
- **Port**: 6380 (external), 6379 (internal)
- **Memory Limit**: 128MB with LRU eviction
- **Password**: test_redis_password
- **Health Check**: Redis PING command

#### MongoDB (mongodb-test)
- **Image**: mongo:6-focal
- **Port**: 27018 (external), 27017 (internal)
- **Admin User**: test_admin / test_admin_password
- **Database**: unjucks_test
- **Health Check**: mongosh ping command

#### Elasticsearch (elasticsearch-test)
- **Image**: elasticsearch:8.8.0
- **Port**: 9201 (external), 9200 (internal)
- **Mode**: Single-node for testing
- **Security**: Disabled for testing environment
- **Health Check**: Cluster health API

### Application Services

#### Main Application (app-test)
- **Build**: From Dockerfile.testing
- **Port**: 3001 (external), 3000 (internal)
- **Environment**: Full test configuration
- **Dependencies**: All database services
- **Volumes**: Source code, test results, coverage reports

#### Unit Tests (unit-tests)
- **Parallel Execution**: 4 workers
- **Pattern**: `**/*.test.js`
- **Coverage**: Enabled with 80% threshold
- **Network**: Backend only

#### Integration Tests (integration-tests)
- **Database Reset**: Enabled per test
- **Pattern**: `**/*.integration.test.js`
- **Dependencies**: All databases
- **Network**: Backend + Database

#### E2E Tests (e2e-tests)
- **Browser**: Chromium (headless)
- **Pattern**: `**/*.e2e.test.js`
- **Screenshots**: On failure
- **Dependencies**: Main application

#### Performance Tests (performance-tests)
- **Duration**: 60 seconds
- **Concurrent Users**: 50
- **Tools**: autocannon, loadtest, clinic
- **Metrics**: Latency, throughput, memory

#### Security Scanner (security-scanner)
- **Scans**: Dependencies, static code, web vulnerabilities
- **Tools**: npm audit, snyk, eslint-security
- **Reports**: JSON + HTML formats

### Monitoring Services

#### Health Monitor (health-monitor)
- **Check Interval**: 30 seconds
- **Alert Threshold**: 3 consecutive failures
- **Coverage**: All services
- **Output**: JSON health reports

#### Test Collector (test-collector)
- **Aggregation**: All test results
- **Formats**: JSON summary + HTML report
- **Archive**: Compressed test artifacts
- **Retention**: Configurable cleanup

## Resource Limits

| Service | Memory | CPU |
|---------|--------|-----|
| PostgreSQL | 512MB | 0.5 |
| Redis | 256MB | 0.25 |
| MongoDB | 512MB | 0.5 |
| Elasticsearch | 1GB | 0.5 |
| App Test | 1GB | 1.0 |
| Unit Tests | 512MB | 0.5 |
| Integration Tests | 768MB | 0.75 |
| E2E Tests | 1GB | 1.0 |
| Performance Tests | 512MB | 0.5 |

## Usage

### Basic Commands

```bash
# Start all services
docker compose -f docker/docker-compose.testing.yml up -d

# Start specific service
docker compose -f docker/docker-compose.testing.yml up -d postgres-test

# View logs
docker compose -f docker/docker-compose.testing.yml logs -f app-test

# Stop all services
docker compose -f docker/docker-compose.testing.yml down

# Cleanup volumes
docker compose -f docker/docker-compose.testing.yml down --volumes
```

### Environment Validation

```bash
# Validate environment
./docker/scripts/validate-testing-environment.sh

# Check health status
docker compose -f docker/docker-compose.testing.yml ps
```

### Running Tests

```bash
# Run all tests
docker compose -f docker/docker-compose.testing.yml up unit-tests integration-tests e2e-tests

# Run specific test type
docker compose -f docker/docker-compose.testing.yml run --rm unit-tests

# Run performance tests
docker compose -f docker/docker-compose.testing.yml run --rm performance-tests

# Run security scan
docker compose -f docker/docker-compose.testing.yml run --rm security-scanner
```

### Collecting Results

```bash
# Collect test results
docker compose -f docker/docker-compose.testing.yml run --rm test-collector

# View aggregated results
docker compose -f docker/docker-compose.testing.yml exec test-collector ls /test-results/aggregated/
```

## Health Checks

All services include comprehensive health checks:

- **Startup Grace Period**: 30-60 seconds
- **Check Interval**: 10-30 seconds
- **Retry Attempts**: 3-5 times
- **Timeout**: 3-10 seconds

### Health Check Endpoints

| Service | Health Check |
|---------|--------------|
| PostgreSQL | `pg_isready -U test_user -d unjucks_test` |
| Redis | `redis-cli ping` |
| MongoDB | `mongosh --eval "db.adminCommand('ping')"` |
| Elasticsearch | `curl -f http://localhost:9200/_cluster/health` |
| Application | `curl -f http://localhost:3000/health` |

## Security Features

### Network Security
- Database network is internal-only (no external access)
- Service isolation through custom networks
- Principle of least privilege for connections

### Container Security
- Non-root users for all services
- Read-only volumes where possible
- Resource limits to prevent DoS
- Security scanning with multiple tools

### Secrets Management
- Test-only credentials (not production)
- Environment variable isolation
- Secure credential passing

## Monitoring & Alerting

### Health Monitoring
- Continuous health checks for all services
- Configurable alert thresholds
- JSON health reports with timestamps
- Service dependency monitoring

### Performance Monitoring
- Resource usage tracking
- Response time measurements
- Throughput monitoring
- Memory leak detection

### Log Management
- JSON structured logging
- Log rotation (10MB max, 3 files)
- Centralized log collection
- Debug trace capabilities

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check for port conflicts
   netstat -tuln | grep -E ":(5433|6380|27018|9201|3001)"
   ```

2. **Memory Issues**
   ```bash
   # Check available memory
   free -h
   docker system df
   ```

3. **Network Issues**
   ```bash
   # Check Docker networks
   docker network ls
   docker network inspect unjucks_testing-database
   ```

4. **Volume Issues**
   ```bash
   # Check volumes
   docker volume ls
   docker volume inspect unjucks_postgres_test_data
   ```

### Debug Mode

Enable debug logging:
```bash
# Set debug environment
export DEBUG=unjucks:*
export LOG_LEVEL=debug

# Run with verbose output
docker compose -f docker/docker-compose.testing.yml up --verbose
```

### Container Inspection

```bash
# Check container status
docker compose -f docker/docker-compose.testing.yml ps

# Inspect specific container
docker inspect unjucks-postgres-test

# Execute commands in container
docker compose -f docker/docker-compose.testing.yml exec postgres-test bash
```

## Performance Optimization

### Resource Tuning
- Adjust memory limits based on available system resources
- Configure parallel test workers based on CPU cores
- Optimize database connections and pooling

### Network Optimization
- Use internal networks for service communication
- Minimize external port exposure
- Configure connection keep-alive

### Storage Optimization
- Use local volumes for performance
- Configure appropriate file system for databases
- Regular cleanup of test artifacts

## Maintenance

### Regular Tasks
- Update base images monthly
- Review and update resource limits
- Clean up old test results
- Update security scanning tools

### Backup Strategy
- Database schemas and test data
- Configuration files
- Test artifacts (if needed)

### Updates
- Test environment updates should be validated
- Maintain compatibility with main application
- Document breaking changes

## Contributing

When modifying the testing environment:

1. Update this documentation
2. Run validation script
3. Test all service dependencies
4. Verify resource limits
5. Update health checks if needed

## Support

For issues with the testing environment:
1. Check the troubleshooting section
2. Review container logs
3. Validate environment configuration
4. Check resource availability