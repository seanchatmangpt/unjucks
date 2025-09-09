# Reusable GitHub Workflows

This directory contains reusable workflow components designed to eliminate duplicate setup code across GitHub workflows. Each component is modular and accepts inputs for customization.

## Available Components

### 1. setup.yml - Common Setup Steps
**Purpose**: Handles checkout, Node.js setup, PNPM installation, and caching.

**Usage**:
```yaml
jobs:
  my-job:
    uses: ./.github/workflows/reusable/setup.yml
    with:
      node-version: '20'
      pnpm-version: '9.12.0'
      fetch-depth: 0
```

**Inputs**:
- `node-version` (default: '18') - Node.js version
- `pnpm-version` (default: '9.12.0') - PNPM version
- `cache-dependency-path` (default: 'package-lock.json') - Path to lock file
- `install-command` (default: 'pnpm install --frozen-lockfile') - Install command
- `fetch-depth` (default: 1) - Git fetch depth
- `enable-corepack` (default: true) - Enable corepack
- `working-directory` (default: '.') - Working directory

### 2. test.yml - Reusable Testing Workflow
**Purpose**: Runs tests with matrix support, coverage collection, and result uploading.

**Usage**:
```yaml
jobs:
  test:
    uses: ./.github/workflows/reusable/test.yml
    with:
      test-matrix: '["18", "20", "22"]'
      enable-matrix: true
      enable-coverage: true
      coverage-threshold: '85'
      additional-test-commands: '["npm run test:e2e", "npm run test:integration"]'
```

**Inputs**:
- `node-version` (default: '18') - Node.js version for single-version testing
- `pnpm-version` (default: '9.12.0') - PNPM version
- `test-command` (default: 'npm test') - Main test command
- `test-matrix` (default: '["18", "20", "22"]') - Node versions for matrix testing
- `enable-matrix` (default: true) - Enable matrix testing
- `enable-coverage` (default: true) - Enable coverage collection
- `coverage-threshold` (default: '80') - Minimum coverage percentage
- `test-timeout` (default: 10) - Test timeout in minutes
- `additional-test-commands` (default: '[]') - Additional test commands (JSON array)
- `upload-results` (default: true) - Upload test results as artifacts

### 3. build.yml - Reusable Build Workflow
**Purpose**: Builds the project with linting, type checking, and artifact uploading.

**Usage**:
```yaml
jobs:
  build:
    uses: ./.github/workflows/reusable/build.yml
    with:
      build-command: 'npm run build:prod'
      enable-typecheck: true
      enable-security-scan: true
      pre-build-commands: '["npm run clean", "npm run generate-types"]'
      additional-build-paths: '["build", "bin", "types"]'
```

**Inputs**:
- `node-version` (default: '18') - Node.js version
- `pnpm-version` (default: '9.12.0') - PNPM version
- `build-command` (default: 'npm run build') - Build command
- `lint-command` (default: 'npm run lint') - Lint command
- `typecheck-command` (default: 'npm run typecheck') - Type check command
- `enable-lint` (default: true) - Enable linting
- `enable-typecheck` (default: true) - Enable type checking
- `enable-security-scan` (default: true) - Enable security scanning
- `build-output-path` (default: 'dist') - Build output directory
- `additional-build-paths` (default: '["build", "bin"]') - Additional artifact paths
- `pre-build-commands` (default: '[]') - Commands before build (JSON array)
- `post-build-commands` (default: '[]') - Commands after build (JSON array)
- `build-timeout` (default: 15) - Build timeout in minutes

**Outputs**:
- `build-success` - Whether build succeeded
- `artifact-name` - Name of uploaded build artifact

### 4. publish.yml - Reusable NPM Publishing Workflow
**Purpose**: Publishes packages to NPM with validation, provenance, and GitHub releases.

**Usage**:
```yaml
jobs:
  publish:
    uses: ./.github/workflows/reusable/publish.yml
    with:
      dry-run: false
      enable-provenance: true
      create-github-release: true
      pre-publish-commands: '["npm run build", "npm run test"]'
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs**:
- `node-version` (default: '18') - Node.js version
- `pnpm-version` (default: '9.12.0') - PNPM version
- `registry-url` (default: 'https://registry.npmjs.org') - NPM registry
- `publish-command` (default: 'npm publish') - Publish command
- `package-path` (default: '.') - Package directory path
- `dry-run` (default: false) - Perform dry run only
- `enable-provenance` (default: true) - Enable package provenance
- `create-github-release` (default: true) - Create GitHub release
- `pre-publish-commands` (default: '[]') - Commands before publish (JSON array)
- `post-publish-commands` (default: '[]') - Commands after publish (JSON array)
- `publish-timeout` (default: 10) - Publish timeout in minutes

**Secrets**:
- `NPM_TOKEN` (required) - NPM authentication token
- `GITHUB_TOKEN` (optional) - GitHub token for releases

**Outputs**:
- `published` - Whether package was published
- `version` - Published package version
- `package-name` - Published package name

## Complete Workflow Example

Here's an example of how to use all components together in a main workflow:

```yaml
name: Complete CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Run tests with matrix support
  test:
    uses: ./.github/workflows/reusable/test.yml
    with:
      test-matrix: '["18", "20", "22"]'
      enable-coverage: true
      coverage-threshold: '85'
      additional-test-commands: '["npm run test:integration", "npm run test:e2e"]'

  # Build the project
  build:
    needs: test
    uses: ./.github/workflows/reusable/build.yml
    with:
      enable-typecheck: true
      enable-security-scan: true
      pre-build-commands: '["npm run clean"]'
      post-build-commands: '["npm run validate:build"]'

  # Publish on main branch
  publish:
    needs: [test, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    uses: ./.github/workflows/reusable/publish.yml
    with:
      enable-provenance: true
      create-github-release: true
      pre-publish-commands: '["npm run build", "npm run package:validate"]'
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Advanced Usage Patterns

### Conditional Matrix Testing
```yaml
test:
  uses: ./.github/workflows/reusable/test.yml
  with:
    # Full matrix on main, single version on PRs
    enable-matrix: ${{ github.ref == 'refs/heads/main' }}
    test-matrix: '["18", "20", "22"]'
    node-version: '20'  # Used when matrix is disabled
```

### Environment-Specific Builds
```yaml
build-dev:
  uses: ./.github/workflows/reusable/build.yml
  with:
    build-command: 'npm run build:dev'
    enable-security-scan: false

build-prod:
  uses: ./.github/workflows/reusable/build.yml
  with:
    build-command: 'npm run build:prod'
    enable-security-scan: true
    pre-build-commands: '["npm run clean", "npm run optimize"]'
```

### Staged Publishing
```yaml
publish-staging:
  uses: ./.github/workflows/reusable/publish.yml
  with:
    registry-url: 'https://npm.staging.company.com'
    dry-run: false
    create-github-release: false

publish-production:
  needs: publish-staging
  uses: ./.github/workflows/reusable/publish.yml
  with:
    create-github-release: true
    enable-provenance: true
```

## Benefits

1. **Code Reuse**: Eliminates duplicate setup code across workflows
2. **Consistency**: Ensures consistent environment setup and processes
3. **Maintainability**: Single place to update common workflow logic
4. **Flexibility**: Extensive input customization for different use cases
5. **Best Practices**: Built-in security scanning, caching, and error handling
6. **Observability**: Comprehensive logging and artifact uploads

## Migration Guide

To migrate existing workflows to use these reusable components:

1. **Identify Common Patterns**: Look for repeated checkout/setup/install steps
2. **Replace with Reusable Calls**: Use `uses: ./.github/workflows/reusable/setup.yml`
3. **Customize with Inputs**: Pass required configuration via `with:` block
4. **Test Incrementally**: Migrate one workflow at a time
5. **Update Documentation**: Ensure team knows about new patterns

## Troubleshooting

### Common Issues

1. **Path Resolution**: Ensure paths are relative to repository root
2. **Input Types**: Use correct types (string, boolean, number) for inputs
3. **JSON Arrays**: Use proper JSON format for array inputs: `'["item1", "item2"]'`
4. **Secrets**: Remember to pass required secrets to reusable workflows
5. **Permissions**: Ensure calling workflows have necessary permissions

### Debug Tips

1. Enable debug logging: Set `ACTIONS_STEP_DEBUG=true` in repository secrets
2. Check input validation in reusable workflow logs
3. Verify artifact uploads in Actions tab
4. Use workflow summaries for quick status overview