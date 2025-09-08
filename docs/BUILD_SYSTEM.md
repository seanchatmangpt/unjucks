# Unjucks Build System Documentation

## Overview

The Unjucks build system provides comprehensive validation, testing, and publishing preparation for the package. Since Unjucks is now pure JavaScript (no TypeScript compilation needed), the build system focuses on validation, testing, and ensuring the package is properly configured for distribution.

## Build System Components

### 1. Build System (`scripts/build-system.js`)

The core build validation system that ensures the package is properly structured and functional.

#### Features:
- **File Existence Validation**: Ensures all required files are present
- **Permission Validation**: Makes binaries executable (`chmod +x`)
- **Package.json Validation**: Validates required fields and configuration
- **Dependency Validation**: Checks if dependencies are properly installed
- **Template Structure Validation**: Verifies template directory structure
- **Cross-platform Compatibility**: Works on Unix, macOS, and Windows

#### Usage:
```bash
# Run full validation
node scripts/build-system.js

# Or via npm script
npm run build:validate
```

### 2. Smoke Tests (`scripts/smoke-tests.js`)

Quick functional tests that verify core CLI functionality without heavy operations.

#### Test Categories:
- **CLI Basic Functions**: Help, version, command availability
- **Entry Points**: Both binary and direct CLI entry points
- **Error Handling**: Invalid command handling
- **Command Discovery**: Template and generator listing

#### Usage:
```bash
# Run smoke tests
node scripts/smoke-tests.js

# Or via npm script
npm run test:smoke
```

### 3. Pre-Publish Validation (`scripts/pre-publish.js`)

Comprehensive validation before npm publishing that combines build validation, smoke tests, and publishing prerequisites.

#### Pre-Publish Checks:
- **Git Status**: Warns about uncommitted changes
- **Build Validation**: Runs full build system validation
- **Smoke Tests**: Ensures CLI functionality works
- **npm Authentication**: Verifies npm login status
- **Registry Check**: Confirms publishing registry
- **Package Size**: Monitors package size for efficiency
- **Security**: Checks for sensitive files in package

#### Usage:
```bash
# Run pre-publish checks
node scripts/pre-publish.js

# Or via npm script (runs automatically before publish)
npm run prepublishOnly
```

## Package.json Integration

The build system is integrated into package.json scripts:

```json
{
  "scripts": {
    "build": "chmod +x bin/unjucks.cjs && node scripts/build-system.js",
    "build:validate": "node scripts/build-system.js",
    "test:smoke": "node scripts/smoke-tests.js", 
    "prepublishOnly": "node scripts/pre-publish.js",
    "publish:safe": "npm run prepublishOnly && npm publish"
  }
}
```

## Build Process Flow

### 1. Development Build
```bash
npm run build
```
- Makes binaries executable
- Runs basic validation
- Quick and safe for development

### 2. Full Validation
```bash
npm run build:validate
```
- Complete file structure validation
- Package.json verification
- Dependency checking
- Template structure validation

### 3. Smoke Testing
```bash
npm run test:smoke
```
- CLI functionality tests
- Entry point verification
- Error handling validation
- Quick functional verification

### 4. Pre-Publish (Automatic)
```bash
npm publish  # Automatically runs prepublishOnly
```
- Git status check
- Full build validation
- Complete smoke test suite
- npm authentication verification
- Package size and security checks

## File Structure Validation

The build system validates these critical files:

### Required Files:
- `package.json` - Package configuration
- `src/cli/index.js` - Main CLI entry point  
- `bin/unjucks.cjs` - Binary executable
- `README.md` - Documentation
- `LICENSE` - License file

### Required Permissions:
- `bin/unjucks.cjs` - Must be executable (`755`)
- `src/cli/index.js` - Must be executable (`755`)

### Package.json Requirements:
- `name`, `version`, `description` - Basic package info
- `main` - Points to CLI entry point
- `bin` - Binary configuration
- `exports` - Module export configuration
- `files` - Files to include in package
- `engines.node` - Node.js version requirement

## Error Handling

The build system provides detailed error reporting:

### Error Types:
- **Fatal Errors**: Stop the build process (missing files, invalid package.json)
- **Warnings**: Non-blocking issues (missing templates, git status)
- **Test Failures**: Functional issues (CLI not working, commands failing)

### Error Output:
```bash
[BUILD] ❌ Missing required file: bin/unjucks.cjs
[BUILD] ❌ Package.json validation failed: Missing required field 'bin'
[BUILD] ✅ All validations passed! Package is ready for publishing.
```

## Cross-Platform Compatibility

The build system works across platforms:

### Unix/macOS:
- Uses standard `chmod` for permissions
- Standard shell command execution
- Full feature support

### Windows:
- Graceful permission handling
- Windows-compatible path resolution
- Cross-platform command execution

## Customization

### Adding Custom Validations:

```javascript
// In scripts/build-system.js
async runCustomValidation() {
  // Your custom validation logic
  this.log('Running custom validation...', 'info');
  // Return true/false for success/failure
}

// Add to validation array
const validations = [
  // ... existing validations
  () => this.runCustomValidation()
];
```

### Adding Custom Smoke Tests:

```javascript
// In scripts/smoke-tests.js
this.addTest(
  'Custom Test Name',
  'node bin/unjucks.cjs your-command',
  (output) => ({
    passed: output && /expected-pattern/i.test(output),
    error: 'Custom error message'
  })
);
```

## Troubleshooting

### Common Issues:

1. **Permission Denied**: Build system automatically fixes executable permissions
2. **Missing Dependencies**: Run `npm install` before building
3. **Git Warnings**: Commit changes or use `--allow-dirty` flag
4. **npm Authentication**: Run `npm login` before publishing

### Debug Mode:

Set environment variable for detailed output:
```bash
DEBUG=unjucks:build npm run build:validate
```

## Performance

### Build Times:
- Basic build: < 1 second
- Full validation: < 5 seconds  
- Smoke tests: < 10 seconds
- Pre-publish: < 15 seconds

### Optimization:
- Parallel test execution where possible
- Cached dependency checks
- Early failure detection
- Minimal file I/O operations

## Security

### Security Checks:
- No hardcoded secrets in package files
- Sensitive file pattern detection
- Safe command execution with timeouts
- Registry verification for publishing

### Best Practices:
- Never commit sensitive files to the package
- Use `.npmignore` to exclude development files
- Verify registry before publishing
- Check package contents before publishing

## CI/CD Integration

### GitHub Actions Example:
```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:validate
      - run: npm run test:smoke
```

### Publishing Workflow:
```yaml
name: Publish
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
      - run: npm run prepublishOnly
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This build system ensures that Unjucks packages are consistently validated, tested, and ready for distribution across all environments.