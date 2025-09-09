# Local GitHub Actions Testing with Act

This document explains how to test GitHub Actions workflows locally using [act](https://github.com/nektos/act).

## Prerequisites

### Install act

**macOS (Homebrew):**
```bash
brew install act
```

**Linux:**
```bash
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Windows (Chocolatey):**
```bash
choco install act-cli
```

### Install Docker

Act requires Docker to run the workflow containers:
- [Docker Desktop](https://docs.docker.com/get-docker/)

## Configuration

The project includes a `.actrc` file with optimized settings for local testing.

## Available Workflows

### 1. Continuous Integration
**File:** `.github/workflows/act-ci.yml`

**Test locally:**
```bash
# Run full CI pipeline
act push

# Run specific job
act push -j test
act push -j cross-platform
act push -j integration
act push -j lint

# Test with specific Node version
act push --input NODE_VERSION=18
```

### 2. Security Scanning
**File:** `.github/workflows/act-security.yml`

**Test locally:**
```bash
# Run security scans
act push -W .github/workflows/act-security.yml

# Run specific security job
act push -W .github/workflows/act-security.yml -j security-audit
act push -W .github/workflows/act-security.yml -j dependency-security
act push -W .github/workflows/act-security.yml -j secret-scan
```

### 3. Performance Benchmarks
**File:** `.github/workflows/act-performance.yml`

**Test locally:**
```bash
# Run performance tests
act push -W .github/workflows/act-performance.yml

# Run specific benchmark
act push -W .github/workflows/act-performance.yml -j cli-performance
act push -W .github/workflows/act-performance.yml -j memory-profiling

# Run with specific benchmark type
act push -W .github/workflows/act-performance.yml --input benchmark_type=cli
```

### 4. Build Validation
**File:** `.github/workflows/act-build-validation.yml`

**Test locally:**
```bash
# Run build validation
act push -W .github/workflows/act-build-validation.yml

# Test specific validation
act push -W .github/workflows/act-build-validation.yml -j build-validation
act push -W .github/workflows/act-build-validation.yml -j dependency-validation
```

## Common Act Commands

### List Available Jobs
```bash
# List all jobs in all workflows
act -l

# List jobs in specific workflow
act -l -W .github/workflows/act-ci.yml
```

### Dry Run (Check without execution)
```bash
# Dry run CI workflow
act push -n

# Dry run specific workflow
act push -W .github/workflows/act-security.yml -n
```

### Debug Mode
```bash
# Run with verbose output
act push -v

# Run with debug output
act push -v --debug
```

### Event Types
```bash
# Test push event (default)
act push

# Test pull request event
act pull_request

# Test workflow dispatch
act workflow_dispatch

# Test scheduled event
act schedule
```

### Platform Selection
```bash
# Use specific platform
act push -P ubuntu-latest=catthehacker/ubuntu:act-latest

# Use different container
act push -P ubuntu-latest=ubuntu:22.04
```

## Environment Variables and Secrets

### Set Environment Variables
```bash
# Single environment variable
act push --env NODE_ENV=test

# Multiple environment variables
act push --env NODE_ENV=test --env DEBUG=true

# From file
act push --env-file .env.local
```

### Set Secrets
```bash
# Single secret
act push --secret NPM_TOKEN=your_token_here

# From file
act push --secret-file .secrets
```

### Create `.secrets` file (gitignored):
```
NPM_TOKEN=your_npm_token
GITHUB_TOKEN=your_github_token
```

## Matrix Testing

To test matrix builds locally:

```bash
# Test specific matrix combination
act push -j cross-platform --matrix os:ubuntu-latest --matrix node-version:20

# Test all matrix combinations (will run sequentially)
act push -j cross-platform
```

## Troubleshooting

### Common Issues

1. **Container won't start:**
   ```bash
   # Pull latest containers
   docker pull catthehacker/ubuntu:act-latest
   
   # Clear act cache
   act --rm
   ```

2. **Permission issues:**
   ```bash
   # Run with sudo (Linux)
   sudo act push
   
   # Fix Docker permissions (Linux)
   sudo usermod -aG docker $USER
   ```

3. **Out of space:**
   ```bash
   # Clean Docker
   docker system prune -a
   
   # Clean act containers
   act --rm
   ```

4. **Network issues:**
   ```bash
   # Use host network
   act push --network host
   ```

### Performance Optimization

1. **Reuse containers:**
   ```bash
   act push --reuse
   ```

2. **Use faster containers:**
   ```bash
   act push -P ubuntu-latest=catthehacker/ubuntu:act-latest-small
   ```

3. **Skip specific steps:**
   ```bash
   # Create .actignore file to skip certain actions
   echo "actions/upload-artifact@v4" > .actignore
   ```

## Workflow-Specific Notes

### CI Workflow
- Tests CLI functionality across Node versions
- Validates package structure
- Runs integration tests

### Security Workflow
- Performs npm audit
- Scans for secrets in code
- Checks license compliance
- **Note:** CodeQL analysis may not work in act

### Performance Workflow
- Benchmarks CLI startup time
- Measures memory usage
- Tests template rendering performance
- **Note:** Some benchmarking tools may not be available in containers

### Build Validation
- Tests cross-platform builds
- Validates dependency installation
- Checks executable permissions
- **Note:** Windows testing simulated on Linux containers

## Integration with Development

### Pre-commit Testing
```bash
# Test before committing
act push -j lint -j test

# Quick validation
act push -j build-validation --reuse
```

### Pre-push Testing
```bash
# Full test suite
act push
```

### Branch Testing
```bash
# Test pull request workflow
act pull_request
```

## Limitations

When using act locally, be aware of these limitations:

1. **Platform simulation:** Windows and macOS jobs run on Linux containers
2. **Missing services:** Some GitHub-hosted services may not be available
3. **Action compatibility:** Not all GitHub Actions work perfectly in containers
4. **Performance:** Local execution may be slower than GitHub runners
5. **Artifacts:** Upload/download artifacts work differently

## Best Practices

1. **Use act regularly** during development
2. **Test matrix builds** before pushing
3. **Verify secrets** are properly configured
4. **Clean containers** periodically
5. **Keep workflows simple** for better act compatibility
6. **Use conditional steps** for act vs GitHub differences

## Example Act Usage

```bash
# Daily development workflow
act push -j test --reuse                    # Quick test
act push -j security-audit --reuse          # Security check
act push -W .github/workflows/act-ci.yml    # Full CI

# Before creating PR
act pull_request                            # Test PR workflow

# Before release
act push -W .github/workflows/act-build-validation.yml  # Build validation
```

## Docker Container Management

```bash
# View act containers
docker ps -a | grep act

# Clean up act containers
docker container prune

# View act images
docker images | grep catthehacker

# Update act images
docker pull catthehacker/ubuntu:act-latest
```

This setup ensures that all GitHub Actions can be thoroughly tested locally before pushing to the repository, reducing CI/CD failures and improving development velocity.