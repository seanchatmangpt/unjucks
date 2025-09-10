# Integration Specifications

## 7. System Integration

### 7.1 File System Integration

#### 7.1.1 Core File Operations
**Contract**: All file operations must be atomic and handle errors gracefully

**Implementation Points**:
- **fs-extra** library for enhanced file system operations
- Atomic file writes to prevent corruption
- Directory traversal with permission checks
- Path validation and sanitization
- Backup creation for destructive operations

**File Operations Interface**:
```typescript
interface FileSystemOperations {
  writeFile(path: string, content: string, options?: WriteOptions): Promise<InjectionResult>
  readFile(path: string): Promise<string>
  ensureDir(path: string): Promise<void>
  pathExists(path: string): Promise<boolean>
  stat(path: string): Promise<Stats>
  copy(source: string, dest: string): Promise<void>
}

interface WriteOptions {
  force?: boolean
  dry?: boolean
  backup?: boolean
  chmod?: string | number
}
```

#### 7.1.2 Permission Handling
- **chmod** support for Unix-style permissions
- Octal and string format permission modes
- Cross-platform permission normalization
- Security validation of permission changes

#### 7.1.3 Directory Operations
- Recursive directory scanning (`scanDirectory`)
- Template directory structure discovery
- Generator path resolution
- Safe directory creation with parent directories

### 7.2 Template System Integration

#### 7.2.1 Nunjucks Template Engine
**Contract**: Full Nunjucks template compatibility with enhanced features

**Integration Points**:
- Template rendering with variable substitution
- Custom filter registration
- Template inheritance support
- Macro and extension system
- Error handling with line number reporting

**Template Interface**:
```typescript
interface TemplateEngine {
  render(template: string, variables: Record<string, any>): string
  renderFile(templatePath: string, variables: Record<string, any>): Promise<string>
  addFilter(name: string, filter: Function): void
  addGlobal(name: string, value: any): void
}
```

#### 7.2.2 Frontmatter Integration
**Contract**: YAML frontmatter processing with validation

**Frontmatter Schema**:
```yaml
---
to: "{{ destination }}"
inject: true | false
before: "marker text"
after: "marker text" 
append: "content"
prepend: "content"
lineAt: number
skipIf: "condition"
chmod: "755" | 0o755
sh: "command to execute"
---
```

### 7.3 CLI Framework Integration

#### 7.3.1 Citty Command Framework
**Contract**: Modern CLI with type safety and extensibility

**Integration Points**:
- **citty** library for command definition
- Argument parsing and validation
- Help system generation
- Dynamic command creation
- Error handling and user feedback

**Command Interface**:
```typescript
interface CommandDefinition {
  meta: {
    name: string
    description: string
    version?: string
  }
  args: Record<string, ArgumentDefinition>
  run: (context: CommandContext) => Promise<void>
}
```

#### 7.3.2 Interactive Prompts
**Contract**: User-friendly prompts with validation

**Integration Points**:
- **inquirer** library for interactive prompts
- Generator selection prompts
- Template selection prompts
- Variable collection prompts
- Confirmation dialogs

### 7.4 Package Manager Integration

#### 7.4.1 Multi-Package Manager Support
**Contract**: Detect and work with npm, yarn, and pnpm

**Detection Logic**:
```javascript
// Package manager detection
if (fs.existsSync('yarn.lock')) return 'yarn'
if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm'
if (fs.existsSync('package-lock.json')) return 'npm'
return 'npm' // default
```

**Integration Points**:
- Lock file detection
- Package.json manipulation
- Dependency installation commands
- Script execution
- Registry configuration

#### 7.4.2 Package.json Integration
**Contract**: Safe package.json updates without corruption

**Operations**:
- Dependency addition/removal
- Script creation and updates
- Metadata updates
- Version management
- Field preservation

### 7.5 Version Control Integration

#### 7.5.1 Git Integration
**Contract**: Git-aware file operations

**Integration Points**:
- .gitignore file handling
- Git repository detection
- Branch awareness
- Staging area integration
- Commit message generation

**Git Operations**:
```typescript
interface GitIntegration {
  isGitRepo(path: string): boolean
  getIgnorePatterns(path: string): string[]
  shouldIgnoreFile(filePath: string): boolean
  stageFile(filePath: string): Promise<void>
}
```

#### 7.5.2 Repository Structure Awareness
- Monorepo detection and handling
- Workspace configuration
- Submodule support
- Branch-specific templates

### 7.6 Security Integration

#### 7.6.1 Input Validation
**Contract**: All user inputs must be validated and sanitized

**Validation Points**:
- Path traversal prevention
- Command injection protection
- Template variable sanitization
- File permission validation
- Execution context isolation

**Security Interface**:
```typescript
interface SecurityValidator {
  validatePath(path: string): ValidationResult
  sanitizeInput(input: string): string
  validateCommand(command: string): boolean
  checkPermissions(filePath: string, operation: string): boolean
}
```

#### 7.6.2 Execution Security
- Safe command execution with allowlists
- Environment variable isolation
- Process sandboxing
- Timeout enforcement
- Resource limiting

### 7.7 Build System Integration

#### 7.7.1 Build Tool Support
**Contract**: Integration with modern build tools

**Supported Build Systems**:
- **Vite** - Modern frontend tooling
- **webpack** - Module bundling
- **esbuild** - Fast JavaScript bundler
- **Rollup** - Library bundling
- **TypeScript** - Type checking and compilation

**Build Integration Points**:
- Configuration file generation
- Plugin system integration
- Asset pipeline integration
- Development server configuration
- Production optimization

#### 7.7.2 Testing Framework Integration
**Contract**: Test generation and execution support

**Supported Frameworks**:
- **Vitest** - Modern testing framework
- **Jest** - JavaScript testing framework
- **Cucumber** - BDD testing
- **Playwright** - End-to-end testing

### 7.8 Editor Integration

#### 7.8.1 VS Code Integration
**Contract**: Enhanced developer experience in VS Code

**Integration Features**:
- Template syntax highlighting
- Snippet generation
- IntelliSense support
- Workspace configuration
- Task runner integration

**VS Code Extensions**:
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

#### 7.8.2 IntelliJ/WebStorm Support
**Contract**: Professional IDE integration

**Features**:
- Template file associations
- Live templates
- Code completion
- Refactoring support
- Project structure awareness

### 7.9 CI/CD Integration

#### 7.9.1 GitHub Actions Integration
**Contract**: Seamless CI/CD pipeline integration

**Workflow Features**:
- Automated testing
- Security scanning
- Performance monitoring
- Release automation
- Multi-environment deployment

**Action Interface**:
```yaml
name: Unjucks CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
```

#### 7.9.2 Docker Integration
**Contract**: Containerized deployment support

**Docker Features**:
- Multi-stage builds
- Development containers
- Production optimization
- Security hardening
- Health checks

### 7.10 API Integration Points

#### 7.10.1 REST API Integration
**Contract**: RESTful API for programmatic usage

**API Endpoints**:
```typescript
interface UnjucksAPI {
  GET /generators: Generator[]
  GET /generators/:name: Generator
  POST /generate: GenerateRequest -> GenerateResponse
  GET /templates/:generator: Template[]
  POST /validate: ValidateRequest -> ValidationResult
}
```

#### 7.10.2 Plugin System Integration
**Contract**: Extensible plugin architecture

**Plugin Interface**:
```typescript
interface UnjucksPlugin {
  name: string
  version: string
  init(api: UnjucksAPI): Promise<void>
  hooks?: {
    beforeGenerate?: (context: GenerateContext) => Promise<void>
    afterGenerate?: (result: GenerateResult) => Promise<void>
  }
}
```

### 7.11 Monitoring Integration

#### 7.11.1 Performance Monitoring
**Contract**: Real-time performance tracking

**Metrics Collected**:
- Template rendering time
- File I/O operations
- Memory usage
- Error rates
- User interactions

#### 7.11.2 Error Tracking
**Contract**: Comprehensive error reporting

**Error Categories**:
- Template syntax errors
- File system errors
- Permission errors
- Network errors
- User input errors

### 7.12 Configuration Integration

#### 7.12.1 Configuration System
**Contract**: Flexible configuration management

**Configuration Sources**:
- `unjucks.config.ts` - Main configuration
- `package.json` - Project settings
- Environment variables - Runtime config
- CLI arguments - Override settings

**Configuration Schema**:
```typescript
interface UnjucksConfig {
  templatesDir: string
  outputDir: string
  generators: GeneratorConfig[]
  plugins: PluginConfig[]
  security: SecurityConfig
  performance: PerformanceConfig
}
```

#### 7.12.2 Environment Management
**Contract**: Multi-environment configuration support

**Environment Types**:
- Development - Local development
- Testing - Automated testing
- Staging - Pre-production testing
- Production - Live environment

### 7.13 Integration Contracts Summary

#### 7.13.1 Core Contracts
1. **Atomicity** - All operations must be atomic
2. **Idempotency** - Operations can be safely repeated
3. **Validation** - All inputs must be validated
4. **Error Handling** - Graceful error recovery
5. **Security** - All operations must be secure

#### 7.13.2 Integration Points Matrix

| System | Read | Write | Execute | Monitor |
|--------|------|-------|---------|---------|
| File System | ✓ | ✓ | - | ✓ |
| Git | ✓ | - | ✓ | ✓ |
| Package Managers | ✓ | ✓ | ✓ | ✓ |
| Build Tools | ✓ | ✓ | ✓ | ✓ |
| Editors | ✓ | - | - | ✓ |
| CI/CD | ✓ | ✓ | ✓ | ✓ |
| APIs | ✓ | ✓ | ✓ | ✓ |

#### 7.13.3 Quality Assurance
- **Integration Testing** - All integrations must have tests
- **Compatibility Testing** - Cross-platform validation
- **Performance Testing** - Integration performance benchmarks
- **Security Testing** - Integration security validation
- **Documentation** - All integrations must be documented

#### 7.13.4 Future Integration Points
- **Cloud Platforms** - AWS, Azure, GCP integration
- **Database Systems** - ORM and query builder integration
- **Message Queues** - Redis, RabbitMQ integration
- **Monitoring Tools** - Datadog, New Relic integration
- **Authentication** - OAuth, SAML, JWT integration