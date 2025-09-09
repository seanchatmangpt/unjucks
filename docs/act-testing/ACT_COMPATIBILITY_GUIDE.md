# Act Compatibility Guide for Unjucks

This guide provides comprehensive information about testing GitHub Actions workflows locally using `act`, including limitations, workarounds, and best practices specifically for the Unjucks project.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Workflow Analysis](#workflow-analysis)
4. [Testing Strategies](#testing-strategies)
5. [Known Limitations](#known-limitations)
6. [Workarounds](#workarounds)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# 1. Install act (if not already installed)
brew install act  # macOS
# or follow: https://github.com/nektos/act#installation

# 2. Run quick validation tests
./scripts/act-testing/act-workflow-tester.sh quick

# 3. Test specific workflows
./scripts/act-testing/act-workflow-tester.sh ci --workflow ci.yml

# 4. Run comprehensive test suite
./scripts/act-testing/act-workflow-tester.sh full --verbose
```

## Installation & Setup

### Prerequisites

1. **Docker Desktop** - Act requires Docker to run containers
2. **act CLI** - The GitHub Actions local runner
3. **Node.js 18+** - For running our testing scripts

### Install Act

```bash
# macOS (Homebrew)
brew install act

# Linux (curl install)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (Chocolatey)
choco install act-cli

# Verify installation
act --version
```

### Configuration

The project includes a pre-configured `.actrc` file, but you can customize it:

```bash
# Platform mappings
-P ubuntu-latest=catthehacker/ubuntu:act-latest
-P ubuntu-22.04=catthehacker/ubuntu:act-22.04
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04

# Environment variables
--env CI=true
--env GITHUB_ACTIONS=true

# Performance optimizations
--reuse
--artifact-server-path /tmp/artifacts
```

## Workflow Analysis

### Automatic Analysis

Run our workflow analyzer to get compatibility reports:

```bash
# Analyze all workflows
node scripts/act-testing/workflow-analyzer.js

# View compatibility report
cat docs/act-testing/compatibility-report.json
```

### Manual Analysis

Check workflows for act compatibility:

1. **Supported triggers**: `push`, `pull_request`, `workflow_dispatch`
2. **Limited triggers**: `schedule`, `repository_dispatch`, `release`
3. **Problematic actions**: `github-script`, `deployment`, `pages`

## Testing Strategies

### 1. Syntax Validation (Quick)

Test workflow syntax without execution:

```bash
# Test all workflows
act --dry-run

# Test specific workflow
act --dry-run -W .github/workflows/ci.yml
```

### 2. Individual Job Testing

Test specific jobs within workflows:

```bash
# Test CI lint job
act push -W .github/workflows/ci.yml -j lint

# Test security scan
act push -W .github/workflows/security.yml -j dependency-security
```

### 3. Matrix Build Testing

Test matrix strategies:

```bash
# Test matrix builds
node scripts/act-testing/matrix-tester.js

# Test specific matrix combination
act push -W .github/workflows/cross-platform-ci.yml --matrix node-version:20 --matrix os:ubuntu-latest
```

### 4. Service Container Testing

Test workflows with service containers:

```bash
# Test service containers
node scripts/act-testing/service-container-tester.js

# Test with binding
act push -W .github/workflows/docker-validation.yml --bind
```

## Known Limitations

### 1. GitHub Actions Features Not Supported

| Feature | Status | Workaround |
|---------|--------|------------|
| GitHub API access | ❌ Limited | Mock API calls |
| External webhooks | ❌ Not supported | Use environment flags |
| GitHub Pages | ❌ Not supported | Skip in act |
| Deployment status | ❌ Not supported | Mock deployment |
| Cron schedules | ❌ Not supported | Manual triggers |

### 2. Service Container Limitations

- **Networking**: Different from GitHub Actions
- **Health checks**: May behave differently
- **Port mapping**: Requires `--bind` flag
- **Service discovery**: Limited hostname resolution

### 3. Matrix Build Limitations

- **Parallelism**: Limited compared to GitHub Actions
- **Resource usage**: Constrained by local machine
- **Platform simulation**: Windows/macOS use Linux containers

### 4. Action Compatibility

| Action Type | Compatibility | Notes |
|-------------|---------------|-------|
| `actions/checkout` | ✅ Full | Works perfectly |
| `actions/setup-node` | ✅ Full | Works with caching |
| `actions/upload-artifact` | ⚠️ Partial | Limited functionality |
| `github-script` | ❌ Limited | API access restricted |
| External actions | ⚠️ Varies | Depends on action |

## Workarounds

### 1. Environment-Based Conditionals

Skip problematic steps in act:

```yaml
- name: GitHub-only step
  if: ${{ !env.ACT }}
  uses: actions/github-script@v7
  # This step runs only in GitHub Actions

- name: Act-compatible alternative
  if: ${{ env.ACT }}
  run: echo "Running in act"
```

### 2. Mock External Services

Replace API calls with mocks:

```yaml
- name: API call with fallback
  run: |
    if [ "$ACT" = "true" ]; then
      echo "Mocking API call for local testing"
      echo '{"status": "success"}' > api-response.json
    else
      curl -X POST https://api.example.com/webhook > api-response.json
    fi
```

### 3. Simplified Service Configurations

Use lighter services for act:

```yaml
services:
  postgres:
    image: ${{ env.ACT && 'postgres:13-alpine' || 'postgres:15' }}
    env:
      POSTGRES_PASSWORD: ${{ env.ACT && 'test' || secrets.DB_PASSWORD }}
    ports:
      - 5432:5432
```

### 4. Act-Specific Workflows

Create simplified workflows for local testing:

```yaml
# .github/workflows/act-ci.yml
name: Act CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

## Best Practices

### 1. Workflow Design

- **Keep it simple**: Avoid complex GitHub-specific features
- **Use conditionals**: Add act-specific paths
- **Test incrementally**: Test jobs individually first
- **Mock externals**: Replace external dependencies

### 2. Local Development

- **Start with syntax**: Use `--dry-run` first
- **Test specific jobs**: Focus on critical paths
- **Use verbose mode**: Enable `--verbose` for debugging
- **Clean up regularly**: Remove old containers

### 3. CI/CD Integration

- **Parallel testing**: Test with both act and GitHub Actions
- **Documentation**: Keep act compatibility notes
- **Team training**: Ensure team knows act usage
- **Regular updates**: Keep act version current

### 4. Performance Optimization

```bash
# Use container reuse
act push --reuse

# Limit resource usage
act push --platform ubuntu-latest=catthehacker/ubuntu:act-latest

# Clean up after testing
act --rm
```

## Troubleshooting

### Common Issues

#### 1. "act: command not found"

```bash
# Check installation
which act

# Install if missing
brew install act  # macOS
```

#### 2. "Docker daemon not running"

```bash
# Start Docker Desktop
open -a Docker  # macOS

# Check Docker status
docker info
```

#### 3. "Workflow file not found"

```bash
# Check workflow path
ls .github/workflows/

# Use absolute path
act -W /full/path/to/workflow.yml
```

#### 4. "Service not accessible"

```bash
# Use bind flag
act push --bind

# Check service logs
docker logs <container-id>
```

#### 5. "Matrix job failed"

```bash
# Test specific combination
act push --matrix node-version:20

# Check resource usage
docker stats
```

### Debug Commands

```bash
# List available workflows
act -l

# Dry run for syntax check
act --dry-run

# Verbose output
act --verbose

# Show docker commands
act --verbose 2>&1 | grep docker

# Clean up containers
act --rm
docker system prune -f
```

### Logging and Monitoring

```bash
# Save act output
act push 2>&1 | tee act-output.log

# Monitor resource usage
watch docker stats

# Check network configuration
docker network ls
docker network inspect bridge
```

## Advanced Usage

### Custom Platform Images

```bash
# Use custom images
act -P ubuntu-latest=custom/ubuntu:latest

# Multiple platforms
act -P ubuntu-latest=catthehacker/ubuntu:act-latest \
    -P ubuntu-22.04=catthehacker/ubuntu:act-22.04
```

### Secret Management

```bash
# Use secrets file
echo "SECRET_KEY=value" > .secrets
act -s .secrets

# Environment variables
act --env SECRET_KEY=value
```

### Network Configuration

```bash
# Custom networking
docker network create act-network
act --network act-network

# Bind to host network
act --bind
```

## Integration with Development Workflow

### Pre-commit Testing

```bash
#!/bin/bash
# .githooks/pre-commit
echo "Testing workflows with act..."
./scripts/act-testing/act-workflow-tester.sh quick
```

### VS Code Integration

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Act: Test CI",
      "type": "shell",
      "command": "act",
      "args": ["push", "-W", ".github/workflows/ci.yml"],
      "group": "test"
    }
  ]
}
```

### Makefile Integration

```makefile
.PHONY: act-test act-ci act-clean

act-test:
	./scripts/act-testing/act-workflow-tester.sh quick

act-ci:
	act push -W .github/workflows/ci.yml

act-clean:
	act --rm
	docker system prune -f
```

## Resources

- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Unjucks Testing Scripts](./scripts/act-testing/)

## Contributing

When adding new workflows:

1. Test with act before committing
2. Add act compatibility notes
3. Update this guide if needed
4. Consider act-specific alternatives

## Support

For act-related issues:

1. Check this guide first
2. Run diagnostic scripts
3. Check act GitHub issues
4. Ask in team chat with logs