# Error Handling Specifications

## 8. Error Handling & Recovery

### 8.1 Error Categories

The Unjucks system classifies errors into the following hierarchical categories:

#### 8.1.1 User Input Errors
- **Template Not Found**: Generator or template path does not exist
- **Variable Missing**: Required template variables not provided
- **Invalid Arguments**: Command-line arguments validation failures
- **File Path Errors**: Invalid or inaccessible target paths

#### 8.1.2 Template Syntax Errors
- **Nunjucks Syntax**: Malformed template expressions (`{{ }}`, `{% %}`)
- **Frontmatter Parse**: YAML/JSON frontmatter parsing failures
- **Variable Reference**: Undefined variables in templates
- **Filter Errors**: Invalid or missing Nunjucks filters

#### 8.1.3 File System Errors
- **ENOENT**: File or directory not found
- **EEXIST**: File already exists (conflict detection)
- **EACCES**: Permission denied for read/write operations
- **EMFILE**: Too many open files (resource exhaustion)

#### 8.1.4 Network Errors
- **Connection Timeout**: Remote template repository access
- **DNS Resolution**: Unable to resolve repository URLs
- **Rate Limiting**: API quota exceeded for external services

#### 8.1.5 Configuration Errors
- **Config Parse**: Invalid `unjucks.config.*` files
- **Schema Validation**: Configuration doesn't match expected schema
- **Environment Variables**: Missing or invalid environment settings

#### 8.1.6 System Errors
- **Memory Exhaustion**: Out of memory during template processing
- **Process Timeout**: Template generation exceeds time limits
- **Security Violations**: Template sandbox escape attempts

### 8.2 Error Response Format

All errors follow a consistent JSON structure for programmatic handling:

```json
{
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template 'component/react' not found in generator 'ui'",
    "details": "Searched in: _templates/ui/component/react",
    "suggestion": "Run 'unjucks list ui' to see available templates",
    "severity": "high",
    "category": "user_input",
    "timestamp": "2025-01-09T12:00:00.000Z",
    "context": {
      "command": "generate",
      "generator": "ui",
      "template": "component/react",
      "args": ["UserProfile"]
    },
    "stackTrace": null,
    "recoverable": true
  }
}
```

#### 8.2.1 Error Code Structure

Error codes follow the pattern: `{CATEGORY}_{SPECIFIC_ERROR}_{TYPE}`

Examples:
- `TEMPLATE_NOT_FOUND_ERROR`
- `VALIDATION_MISSING_VARIABLE_ERROR`
- `FILESYSTEM_PERMISSION_DENIED_ERROR`
- `NETWORK_CONNECTION_TIMEOUT_ERROR`

### 8.3 Specific Error Scenarios

#### 8.3.1 Template Not Found

**Detection Criteria:**
- Generator directory exists but template subdirectory missing
- Template files (`.ejs.t`, `.hbs.t`) not found in expected location
- Template path resolution fails across multiple search paths

**Error Response:**
```json
{
  "code": "TEMPLATE_NOT_FOUND_ERROR",
  "message": "Template '{templateName}' not found in generator '{generatorName}'",
  "details": "Searched paths: {searchedPaths}",
  "suggestion": "Use 'unjucks list {generatorName}' to see available templates"
}
```

**Recovery Strategies:**
1. List available templates in the generator
2. Suggest similar template names (fuzzy matching)
3. Offer to create template if generator exists
4. Check common template locations (`_templates`, `node_modules`)

#### 8.3.2 Variable Missing

**Detection Process:**
1. Parse template for variable references (`{{ variable }}`, `<%- variable %>`)
2. Extract required variables from frontmatter `to:` field
3. Compare with provided arguments and prompt responses
4. Identify missing required variables

**Error Response:**
```json
{
  "code": "VALIDATION_MISSING_VARIABLE_ERROR", 
  "message": "Missing required variable: {variableName}",
  "details": "Variable '{variableName}' is referenced in template but not provided",
  "suggestion": "Add --{variableName} argument or respond to prompt"
}
```

**Recovery Strategies:**
1. Interactive prompts for missing variables
2. Default value substitution when available
3. Graceful degradation with placeholder values
4. Template pre-validation to identify all required variables

#### 8.3.3 File Already Exists

**Conflict Detection:**
- Target file exists before generation
- Atomic write operation would overwrite existing content
- Injection target already contains injected content

**Error Response:**
```json
{
  "code": "FILESYSTEM_FILE_EXISTS_ERROR",
  "message": "Target file already exists: {filePath}",
  "details": "Use --force to overwrite or --dry to preview changes", 
  "suggestion": "Consider using inject mode or backup options"
}
```

**Resolution Options:**
1. `--force`: Overwrite existing files
2. `--backup`: Create backup before overwriting
3. `--merge`: Attempt intelligent content merging
4. `--skip`: Skip existing files, continue with others

#### 8.3.4 Permission Denied

**Access Control Validation:**
- Read permissions for template files
- Write permissions for target directories
- Execute permissions for script execution

**Error Response:**
```json
{
  "code": "FILESYSTEM_PERMISSION_DENIED_ERROR",
  "message": "Permission denied accessing: {path}",
  "details": "Current user lacks {permission} permission",
  "suggestion": "Check file permissions or run with appropriate privileges"
}
```

**Recovery Strategies:**
1. Suggest permission fixes (`chmod`, `chown`)
2. Alternative target directory suggestions
3. User elevation prompts (when appropriate)
4. Temporary directory fallback for preview mode

#### 8.3.5 Template Syntax Errors

**Syntax Validation:**
- Nunjucks template parsing errors
- Malformed Handlebars expressions
- YAML frontmatter syntax issues

**Error Response:**
```json
{
  "code": "TEMPLATE_SYNTAX_ERROR",
  "message": "Template syntax error in {templatePath}",
  "details": "Line {lineNumber}: {syntaxError}",
  "suggestion": "Fix template syntax or use --skip-validation flag"
}
```

**Error Recovery:**
1. Syntax highlighting of problematic lines
2. Suggest common fixes for detected patterns
3. Fallback to raw template mode
4. Template validation tools integration

### 8.4 Error Logging

#### 8.4.1 Log Levels

**CRITICAL (Fatal)**
- System crashes, memory exhaustion
- Security policy violations
- Unrecoverable template corruption

**ERROR (High)**
- Template generation failures
- File system access denied
- Network connectivity issues

**WARN (Medium)**
- Missing optional variables
- Deprecated template features
- Performance degradation

**INFO (Low)**
- Successful operations
- Configuration changes
- Template cache updates

**DEBUG (Verbose)**
- Variable resolution details
- Template parsing steps
- File system operations

#### 8.4.2 Log Format

```json
{
  "timestamp": "2025-01-09T12:00:00.000Z",
  "level": "ERROR",
  "message": "Template generation failed",
  "error": {
    "code": "TEMPLATE_NOT_FOUND_ERROR",
    "details": "...",
    "stackTrace": "..."
  },
  "context": {
    "command": "generate",
    "generator": "ui",
    "template": "component",
    "correlationId": "req-123",
    "userId": "user-456"
  },
  "metadata": {
    "duration": 150,
    "memoryUsage": 42.5,
    "templateCacheHit": false
  }
}
```

#### 8.4.3 Debug Mode Output

When `--debug` flag is enabled:

```bash
DEBUG [Template Parser] Parsing template: ui/component/react
DEBUG [Variable Resolver] Found variables: name, type, props
DEBUG [File Generator] Creating: src/components/UserProfile.jsx
ERROR [File Writer] Permission denied: /src/components/
INFO  [Recovery] Suggesting alternative path: ./src/components/
DEBUG [Cleanup] Removing temporary files
```

### 8.5 Error Recovery Mechanisms

#### 8.5.1 Automatic Recovery

**Template Fallbacks:**
1. Try alternative template engines (Nunjucks → Handlebars → EJS)
2. Fallback to simpler template versions
3. Use cached template versions

**Path Resolution:**
1. Search multiple template directories
2. Try case-insensitive matching
3. Search npm package templates
4. Use global template registry

**Variable Resolution:**
1. Use environment variables as fallbacks
2. Apply sensible defaults for common variables
3. Interactive prompts for missing values
4. Skip optional variables gracefully

#### 8.5.2 Manual Recovery Options

**Interactive Mode:**
- Prompt user for corrective actions
- Offer multiple resolution strategies
- Allow operation continuation or cancellation

**Batch Processing:**
- Continue processing other templates on error
- Collect all errors for final report
- Partial success reporting

**Rollback Operations:**
- Atomic operations with rollback capability
- Backup restoration on failure
- Transaction logs for complex operations

#### 8.5.3 Error Reporting

**User-Friendly Messages:**
```bash
❌ Error: Template 'react-component' not found in generator 'ui'

💡 Suggestion: 
   Run 'unjucks list ui' to see available templates
   
   Available templates in 'ui':
   • vue-component
   • angular-component  
   • vanilla-component
   
❓ Did you mean 'vue-component'? (y/N)
```

**Developer Debug Output:**
```bash
ERROR [TemplateEngine] Template resolution failed
  Generator: ui
  Template: react-component  
  Search paths:
    ✗ ./_templates/ui/react-component
    ✗ ./node_modules/@ui/templates/react-component
    ✗ ~/.unjucks/templates/ui/react-component
  
  Stack trace:
    at TemplateEngine.resolve (src/lib/template-engine.js:45)
    at Generator.generate (src/lib/generator.js:123)
```

### 8.6 Error Prevention

#### 8.6.1 Validation Pipeline

**Pre-execution Validation:**
1. Command argument validation
2. File system permission checks
3. Template existence verification
4. Variable requirement analysis

**Template Validation:**
1. Syntax checking before execution
2. Variable reference validation
3. Output path safety verification
4. Content safety scanning

#### 8.6.2 Sandboxing

**Template Security:**
- Restricted file system access
- Limited execution scope
- Resource usage constraints
- Injection attack prevention

**Output Safety:**
- Path traversal prevention
- Overwrite protection
- Backup requirements
- Permission validation

### 8.7 Error Monitoring

#### 8.7.1 Metrics Collection

**Error Rates:**
- Errors per command type
- Error categories distribution
- Recovery success rates
- User error patterns

**Performance Impact:**
- Error handling overhead
- Recovery operation timing
- Resource usage during errors
- Cache invalidation frequency

#### 8.7.2 Alerting

**Critical Errors:**
- Immediate notification for security violations
- System resource exhaustion alerts
- Template corruption detection

**Trend Analysis:**
- Error rate increases
- New error patterns
- Template quality degradation
- User experience impact

### 8.8 Testing Error Scenarios

#### 8.8.1 Error Simulation

**Controlled Error Injection:**
```javascript
describe('Error Handling', () => {
  test('handles missing template gracefully', async () => {
    const result = await generator.generate('nonexistent', 'template');
    expect(result.error.code).toBe('TEMPLATE_NOT_FOUND_ERROR');
    expect(result.error.recoverable).toBe(true);
  });
  
  test('provides helpful suggestions', async () => {
    const result = await generator.generate('ui', 'react-comp');
    expect(result.error.suggestion).toContain('react-component');
  });
});
```

#### 8.8.2 Recovery Testing

**Automatic Recovery Verification:**
- Template fallback mechanisms
- Variable default application
- Path resolution alternatives

**Manual Recovery Flows:**
- Interactive prompt responses
- User choice handling
- Operation continuation logic

### 8.9 Error Documentation

#### 8.9.1 Error Reference

Each error code includes:
- Detailed description
- Common causes
- Resolution steps
- Prevention strategies
- Related error codes

#### 8.9.2 Troubleshooting Guides

**By Category:**
- Template creation issues
- File system problems
- Configuration errors
- Performance problems

**By Use Case:**
- First-time setup
- Team environments
- CI/CD integration
- Enterprise deployment

### 8.10 Implementation Requirements

#### 8.10.1 Error Handler Architecture

```javascript
class ErrorHandler {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'INFO';
    this.recoveryStrategies = new Map();
    this.userInteraction = options.interactive !== false;
  }
  
  async handleError(error, context) {
    // 1. Classify error
    const classification = this.classifyError(error);
    
    // 2. Log appropriately  
    this.logError(error, classification, context);
    
    // 3. Attempt recovery
    const recovery = await this.attemptRecovery(error, context);
    
    // 4. Report to user
    return this.formatUserResponse(error, recovery);
  }
}
```

#### 8.10.2 Integration Points

**CLI Commands:**
- Consistent error handling across all commands
- Uniform error reporting format
- Recovery option presentation

**Template Engines:**
- Error capturing and classification
- Syntax error reporting
- Variable resolution failures

**File System Operations:**
- Permission checking
- Atomic operations
- Rollback capabilities

This error handling specification ensures robust, user-friendly error management throughout the Unjucks system, with clear recovery paths and comprehensive logging for debugging and monitoring.