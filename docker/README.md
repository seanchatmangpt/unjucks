# Unjucks Docker Cleanroom Testing Environment

## 🐳 Fortune 5 Containerization Standards

This directory contains a comprehensive Docker-based cleanroom testing environment that meets Fortune 5 enterprise containerization standards. The environment provides isolated, reproducible, and secure testing infrastructure for the Unjucks project.

## 🏗️ Architecture Overview

### Multi-Stage Docker Build
- **Stage 1**: Security scanner and base image validation
- **Stage 2**: Node.js runtime with security hardening
- **Stage 3**: Dependencies installation with caching
- **Stage 4**: Application code building and validation
- **Stage 5**: Testing environment configuration
- **Stage 6**: Production-ready security scanning

### Container Security Features
- ✅ Non-root user execution (UID: 10001)
- ✅ Security-hardened base image (Chainguard Wolfi)
- ✅ Seccomp security profiles
- ✅ Resource limits and constraints
- ✅ Read-only filesystem options
- ✅ Network isolation
- ✅ Secrets management
- ✅ Security scanning integration

## 📂 Directory Structure

```
docker/
├── Dockerfile                    # Multi-stage production Dockerfile
├── docker-compose.yml           # Main orchestration configuration
├── docker-compose.override.yml  # Development overrides
├── README.md                    # This documentation
├── security/
│   └── seccomp.json            # Seccomp security profile
├── secrets/
│   └── test.env                # Test environment secrets
├── monitoring/
│   └── prometheus.yml          # Performance monitoring config
├── logging/
│   └── logstash.conf           # Log aggregation configuration
├── sql/
│   └── init.sql                # Database initialization
└── scripts/
    ├── test-runner.sh          # Comprehensive test execution
    └── container-validator.sh  # Security and compliance validation
```

## 🚀 Quick Start

### 1. Build and Start the Environment

```bash
# Build all containers
docker-compose build

# Start the full testing environment
docker-compose up -d

# Start with specific profiles
docker-compose --profile integration up -d
docker-compose --profile monitoring up -d
```

### 2. Run Tests

```bash
# Run all tests
docker-compose exec unjucks-test /app/docker/scripts/test-runner.sh

# Run specific test suites
docker-compose exec unjucks-test /app/docker/scripts/test-runner.sh smoke
docker-compose exec unjucks-test /app/docker/scripts/test-runner.sh unit
docker-compose exec unjucks-test /app/docker/scripts/test-runner.sh integration
docker-compose exec unjucks-test /app/docker/scripts/test-runner.sh e2e
docker-compose exec unjucks-test /app/docker/scripts/test-runner.sh security
```

### 3. Validate Container Security

```bash
# Run security validation
docker-compose exec unjucks-test /app/docker/scripts/container-validator.sh

# Check validation results
docker-compose exec unjucks-test cat /app/test-results/container-validation.json
```

## 🔧 Configuration Profiles

### Available Profiles

- **Default**: Core testing container
- **`integration`**: Includes database and Redis
- **`monitoring`**: Adds Prometheus and monitoring
- **`security`**: Enables security scanning
- **`logging`**: Activates log aggregation
- **`dev-tools`**: Development utilities

### Profile Usage

```bash
# Multiple profiles
docker-compose --profile integration --profile monitoring up -d

# All profiles
docker-compose --profile integration --profile monitoring --profile security --profile logging up -d
```

## 🛡️ Security Features

### Container Hardening
- **Non-root execution**: All processes run as unjucks user (UID: 10001)
- **Capability dropping**: Minimal Linux capabilities
- **Seccomp filtering**: Restricted system calls
- **No new privileges**: Prevents privilege escalation
- **Resource limits**: CPU, memory, and PID constraints

### Secrets Management
```bash
# Create external secrets
echo "secret_value" | docker secret create unjucks_ci_token -

# Secrets are mounted at /run/secrets/ in containers
```

### Network Security
- **Isolated networks**: Separate testing and monitoring networks
- **No external access**: Internal network communication only
- **Port binding**: Restricted to localhost (127.0.0.1)

## 📊 Monitoring and Observability

### Prometheus Metrics
- Access Prometheus UI: http://localhost:9090
- Container metrics via cAdvisor
- Application performance metrics
- Resource utilization tracking

### Log Aggregation
- Structured JSON logging
- Security event tracking
- Performance metrics logging
- Test execution logs

### Health Checks
- Container health monitoring
- Application readiness checks
- Database connectivity validation
- Service availability tracking

## 🧪 Test Execution

### Test Categories

1. **Smoke Tests**: Basic functionality validation
2. **Unit Tests**: Component-level testing with coverage
3. **Integration Tests**: Database and service integration
4. **E2E Tests**: Full workflow validation
5. **Performance Tests**: Resource usage and timing
6. **Security Tests**: Vulnerability scanning and validation

### Test Results

Results are stored in `/app/test-results/`:
- `test-summary-report.json` - Comprehensive test report
- `container-validation.json` - Security validation results
- `smoke-tests.json` - Basic functionality tests
- `security-scan.json` - Vulnerability scan results

### Coverage Reports

Coverage data is in `/app/coverage/`:
- HTML reports for browser viewing
- JSON summaries for CI/CD integration
- Text reports for quick analysis

## 🔍 Development and Debugging

### Development Mode

```bash
# Use override configuration for development
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# Interactive debugging
docker-compose exec unjucks-test /bin/bash

# Watch mode for automatic test runs
docker-compose --profile watcher up -d
```

### Debugging Features
- Source code hot-reloading
- Node.js debug port (9229) exposed
- Development server on port 3000
- Increased resource limits
- Verbose logging enabled

### Development Tools
```bash
# Start development tools container
docker-compose --profile dev-tools up -d unjucks-dev-tools

# Access development shell
docker-compose exec unjucks-dev-tools /bin/bash
```

## 📈 Performance Optimization

### Resource Allocation
- **CPU**: 2.0 cores limit, 1.0 reserved
- **Memory**: 4GB limit, 2GB reserved
- **PIDs**: 1000 process limit
- **Disk**: tmpfs for temporary data

### Caching Strategy
- Multi-stage build caching
- Dependency layer optimization
- Shared volumes for development
- Build artifact caching

### Optimization Tips
1. Use `.dockerignore` to exclude unnecessary files
2. Leverage multi-stage builds for smaller images
3. Pin dependency versions for reproducibility
4. Use tmpfs for ephemeral data
5. Configure health checks appropriately

## 🚨 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs unjucks-test

# Verify permissions
docker-compose exec unjucks-test ls -la /app/

# Check resource usage
docker stats
```

#### Tests Failing
```bash
# Run validation first
docker-compose exec unjucks-test /app/docker/scripts/container-validator.sh

# Check application binary
docker-compose exec unjucks-test /app/bin/unjucks.cjs --version

# Verify dependencies
docker-compose exec unjucks-test pnpm list
```

#### Database Connection Issues
```bash
# Check PostgreSQL health
docker-compose exec unjucks-postgres pg_isready -U unjucks_test

# Test connection
docker-compose exec unjucks-test psql -h unjucks-postgres -U unjucks_test -d unjucks_test -c "SELECT version();"
```

#### Memory Issues
```bash
# Check memory usage
docker-compose exec unjucks-test free -h

# Monitor container resources
docker stats unjucks-cleanroom-test

# Adjust memory limits in docker-compose.yml
```

### Log Analysis
```bash
# View aggregated logs
docker-compose logs -f unjucks-test

# Check specific log files
docker-compose exec unjucks-test tail -f /app/logs/test-runner.log

# Security logs
docker-compose exec unjucks-test cat /app/logs/container-validation.log
```

## 🔧 Maintenance

### Regular Tasks

#### Security Updates
```bash
# Rebuild with latest security updates
docker-compose build --no-cache --pull

# Run security scans
docker-compose --profile security up -d unjucks-security-scan
```

#### Cleanup
```bash
# Remove old containers and volumes
docker-compose down -v --remove-orphans

# Clean up images
docker image prune -f

# Full cleanup
docker system prune -a --volumes
```

#### Backup and Restore
```bash
# Backup test data
docker run --rm -v unjucks-test-data:/data -v $(pwd):/backup alpine tar czf /backup/test-data-backup.tar.gz -C /data .

# Restore test data
docker run --rm -v unjucks-test-data:/data -v $(pwd):/backup alpine tar xzf /backup/test-data-backup.tar.gz -C /data
```

## 🎯 Best Practices

### Security
1. Regularly update base images
2. Scan for vulnerabilities
3. Use secrets for sensitive data
4. Minimize container privileges
5. Monitor security logs

### Performance
1. Use multi-stage builds
2. Optimize layer caching
3. Set appropriate resource limits
4. Monitor resource usage
5. Use tmpfs for temporary data

### Reliability
1. Implement health checks
2. Use proper restart policies
3. Monitor container logs
4. Test disaster recovery
5. Automate validation

### Compliance
1. Document security measures
2. Maintain audit trails
3. Regular compliance validation
4. Track configuration changes
5. Implement access controls

## 📚 Additional Resources

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Container Security Guidelines](https://kubernetes.io/docs/concepts/security/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Node.js in Docker](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

**Note**: This cleanroom testing environment is designed for enterprise-grade testing and meets Fortune 5 containerization standards. For production deployments, additional security and compliance measures may be required based on your organization's specific requirements.