# Technical Constraints Specification

## 4. Technical Constraints

### 4.1 Technology Stack

#### 4.1.1 Runtime Environment
- **Node.js**: Minimum version 18.x LTS (ESNext target support)
- **Module System**: ESModules only (`"type": "module"`)
- **TypeScript**: Version 5.9.2 with strict mode enabled
- **Package Manager**: pnpm 10.15.0 (locked version)

#### 4.1.2 Core Dependencies
```json
{
  "chalk": "^5.3.0",          // Terminal colors - ESM compatible
  "citty": "^0.1.6",          // CLI framework - minimal footprint
  "confbox": "^0.2.2",        // Config loading with c12 integration
  "fs-extra": "^11.2.0",      // Enhanced filesystem operations
  "inquirer": "^9.2.15",      // Interactive prompts - ESM compatible
  "nunjucks": "^3.2.4",       // Template engine - Jinja2 syntax
  "ora": "^8.0.1",           // Progress indicators - ESM compatible
  "yaml": "^2.4.1"           // YAML parsing - fast and secure
}
```

#### 4.1.3 Build System
- **obuild**: UnJS universal bundler for library distribution
- **Vitest**: Testing framework with BDD support via `@amiceli/vitest-cucumber`
- **ESLint**: Code linting with UnJS configuration (`eslint-config-unjs`)
- **Prettier**: Code formatting with consistent style

### 4.2 Performance Requirements

#### 4.2.1 CLI Response Time
- **Basic commands** (list, help): < 100ms
- **Template discovery**: < 200ms for 1000+ templates
- **Template rendering**: < 500ms for single file
- **Batch generation**: < 1s per 100 files
- **Interactive prompts**: < 50ms input lag

#### 4.2.2 Memory Constraints
- **Base memory usage**: < 50MB at startup
- **Template processing**: < 256MB peak for large projects
- **File watching**: < 32MB additional overhead
- **Concurrent operations**: Linear scaling with O(n) complexity

#### 4.2.3 File System Performance
- **Template scanning**: 10,000+ files/second directory traversal
- **File generation**: Atomic writes with backup/rollback
- **Path resolution**: < 10ms for complex nested structures
- **Permission checking**: < 5ms per file operation

#### 4.2.4 Parallel Execution
- **Test runner**: 3x speed improvement via thread pool
- **Template processing**: CPU core * 0.8 thread utilization
- **I/O operations**: Batched writes with 100ms debounce
- **Memory sharing**: Atomic operations with shared buffers

### 4.3 Compatibility Requirements

#### 4.3.1 Node.js Version Support
```javascript
// Minimum: Node 18.x LTS
"engines": {
  "node": ">=18.0.0"
}

// Target features:
- ES2023 syntax support
- Top-level await
- Import assertions
- Worker threads
- fs.promises API
```

#### 4.3.2 Operating System Support
- **Linux**: All major distributions (Ubuntu 20.04+, CentOS 8+, Alpine)
- **macOS**: 10.15+ (Catalina and newer)
- **Windows**: 10/11 with PowerShell 5.1+ or PowerShell Core 7+
- **Shell Compatibility**: bash, zsh, fish, PowerShell

#### 4.3.3 Terminal Requirements
- **ANSI Colors**: 256-color support preferred, 16-color minimum
- **Unicode Support**: UTF-8 encoding required
- **Terminal Width**: Minimum 80 columns, responsive to terminal resize
- **Interactive Features**: TTY detection with graceful fallback

### 4.4 Security Constraints

#### 4.4.1 Path Traversal Prevention
```javascript
// Mandatory path validation
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9._/-]+$/;
const BLOCKED_PATTERNS = ['../', '..\\', '~/', '/etc/', '/proc/'];

// Implementation constraints:
- All file operations MUST validate paths
- Template variables MUST be sanitized
- Output directories MUST be within project boundaries
```

#### 4.4.2 Template Injection Protection
```javascript
// Nunjucks security configuration
const SECURE_NUNJUCKS_CONFIG = {
  autoescape: true,           // Prevent XSS in generated code
  throwOnUndefined: true,     // Fail fast on undefined variables  
  trimBlocks: true,           // Clean template output
  lstripBlocks: true          // Remove leading whitespace
};

// Blocked template features:
- File system access from templates
- Process execution
- Network requests
- Eval/Function constructors
```

#### 4.4.3 Secure File Operations
- **Atomic Writes**: Temporary file + rename pattern
- **Permission Preservation**: Respect existing file modes
- **Backup Creation**: Optional rollback capability
- **Lock File Prevention**: Avoid concurrent modification conflicts

#### 4.4.4 Input Validation
```typescript
// CLI argument sanitization
interface SecureInput {
  templatePath: string;     // Validated against allow-list
  outputPath: string;       // Within project boundaries
  variables: Record<string, unknown>; // Sanitized primitive values
}

// Validation rules:
- No shell metacharacters in paths
- Variable values limited to primitives
- Template names alphanumeric + hyphens only
```

### 4.5 Integration Requirements

#### 4.5.1 Git Integration
```bash
# Required Git features:
- Repository detection (.git directory)
- Branch name extraction
- Gitignore pattern matching
- Commit hook compatibility
- Submodule support (basic)

# Git version: 2.20+ recommended
```

#### 4.5.2 CI/CD Compatibility
```yaml
# GitHub Actions support:
- Node.js matrix testing (18.x, 20.x, latest)
- Cross-platform builds (Linux, macOS, Windows)
- Artifact generation and caching
- Security scanning integration
- Performance regression detection

# Additional CI systems:
- Jenkins: Declarative pipeline support
- GitLab CI: .gitlab-ci.yml templates
- Azure DevOps: azure-pipelines.yml
- CircleCI: .circleci/config.yml
```

#### 4.5.3 Editor Support
- **VS Code**: IntelliSense for template syntax
- **JetBrains IDEs**: Plugin compatibility
- **Vim/Neovim**: LSP integration via typescript-language-server
- **Emacs**: Tree-sitter grammar support

#### 4.5.4 Package Registry Compatibility
```json
// Distribution formats:
{
  "main": "./dist/index.mjs",       // CommonJS compatibility
  "module": "./dist/index.mjs",     // ESM entry point
  "types": "./dist/index.d.mts",    // TypeScript definitions
  "exports": {
    ".": "./dist/index.mjs",
    "./cli": "./dist/cli.mjs"
  }
}

// Registry support:
- npm (primary)
- yarn (compatibility)
- pnpm (optimized)
- Deno (future consideration)
```

### 4.6 Development Constraints

#### 4.6.1 Code Quality Gates
```javascript
// Coverage thresholds:
{
  global: {
    branches: 75,
    functions: 80, 
    lines: 80,
    statements: 80
  },
  "core-modules": {
    branches: 90,
    functions: 95,
    lines: 95,
    statements: 95
  }
}

// Performance benchmarks:
- CLI startup: < 100ms
- Template processing: < 1s/100 files
- Memory usage: < 256MB peak
```

#### 4.6.2 Testing Requirements
- **Unit Tests**: 80%+ coverage with Vitest
- **BDD Tests**: Cucumber scenarios via vitest-cucumber
- **Integration Tests**: Real file system operations
- **Performance Tests**: Benchmarks with fast-check property testing
- **Security Tests**: Path traversal and injection prevention

#### 4.6.3 Documentation Standards
- **API Documentation**: TypeScript definitions with JSDoc
- **CLI Help**: Citty-generated help text
- **Examples**: Working templates in `_templates/` directory
- **Migration Guides**: Version upgrade documentation

### 4.7 Deployment Constraints

#### 4.7.1 Binary Distribution
```json
// Single executable constraints:
{
  "bin": {
    "unjucks": "./dist/cli.mjs"
  },
  "files": [
    "dist/**/*",
    "!dist/**/*.map",
    "!dist/**/*.test.*"
  ]
}
```

#### 4.7.2 Dependency Bundling
- **External Dependencies**: Minimal runtime dependencies
- **Bundle Size**: < 10MB total package size
- **Tree Shaking**: Dead code elimination via obuild
- **Asset Inlining**: Template schemas and defaults

#### 4.7.3 Version Management
- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **Changelog Generation**: Automated via changelogen
- **Release Automation**: CI/CD pipeline with git tags
- **Backward Compatibility**: One major version support

### 4.8 Non-Negotiable Technical Boundaries

#### 4.8.1 Security Boundaries
- **NO** arbitrary code execution in templates
- **NO** network requests during generation
- **NO** file system access outside project root
- **NO** environment variable leaking in outputs

#### 4.8.2 Performance Boundaries
- **MAXIMUM** 2GB memory usage (hard limit)
- **MAXIMUM** 30-second timeout per operation
- **MAXIMUM** 1,000,000 files per project scan
- **MAXIMUM** 100MB per generated file

#### 4.8.3 Compatibility Boundaries
- **MINIMUM** Node.js 18.x LTS support
- **MAXIMUM** 2-year Node.js version lag
- **BREAKING** changes only in major versions
- **DEPRECATED** feature removal after 6-month notice

---

*This specification defines the technical foundation and constraints for the Unjucks CLI generator. All implementation decisions must respect these boundaries to ensure system reliability, security, and performance.*