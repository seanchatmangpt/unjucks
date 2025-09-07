# CLI-Template System Integration

This document describes how the Unjucks CLI integrates with the template system for seamless code generation and file operations.

## Integration Architecture

### Core Integration Points

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Commands  │ -> │  Generator Core  │ -> │ Template Engine │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Variable System │    │   File Injector  │    │  Nunjucks +     │
│ & Validation    │    │   & Operations   │    │  Frontmatter    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Integration Classes

1. **Generator Class** (`/src/lib/generator.ts`)
   - Template discovery and enumeration
   - Variable extraction and processing
   - Generation orchestration

2. **FileInjector Class** (`/src/lib/file-injector.ts`)
   - File modification and injection
   - Backup management
   - Safe file operations

3. **Command Validation** (`/src/lib/command-validation.ts`)
   - Input validation rules
   - Path safety checks
   - Template compatibility

## Template Discovery Process

### 1. Generator Enumeration
```typescript
async listGenerators(): Promise<GeneratorInfo[]> {
  // Scan _templates directory
  // Process each subdirectory as generator
  // Extract metadata from index files
  // Return structured generator information
}
```

**Directory Structure Expected:**
```
_templates/
├── component/           <- Generator
│   ├── react/          <- Template
│   │   ├── component.tsx.njk
│   │   ├── component.test.ts.njk
│   │   └── index.ts.njk
│   └── vue/            <- Template
│       └── component.vue.njk
├── api/                <- Generator
│   └── express/        <- Template
└── workflow/           <- Generator
    └── ci-cd/          <- Template
```

### 2. Template Analysis
For each template, the CLI performs:

1. **File Scanning**: Enumerate all `.njk` files
2. **Frontmatter Extraction**: Parse YAML frontmatter for metadata
3. **Variable Discovery**: Scan template content for `{{ variables }}`
4. **Dependency Analysis**: Check for required tools/frameworks
5. **Output Prediction**: Determine generated file structure

### 3. Variable Processing
```typescript
interface DiscoveredVariable {
  name: string;
  type: 'string' | 'boolean' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  validation?: RegExp | string;
  description?: string;
  choices?: string[];
  conditional?: string; // When to show this variable
}
```

## Command-Template Coordination

### Generate Command Integration

The generate command follows this workflow:

```typescript
async function executeGenerate(args: GenerateArgs) {
  // 1. Resolve generator and template
  const generator = await resolveGenerator(args.generator);
  const template = await resolveTemplate(generator, args.template);
  
  // 2. Discover and validate variables
  const discoveredVars = await discoverTemplateVariables(template);
  const processedVars = await processVariables(discoveredVars, args);
  
  // 3. Validate all inputs
  await validateGenerationRequest({
    generator,
    template,
    variables: processedVars,
    destination: args.dest
  });
  
  // 4. Execute generation
  const result = await generateFiles({
    template,
    variables: processedVars,
    destination: args.dest,
    options: {
      force: args.force,
      dryRun: args.dry,
      backup: args.backup
    }
  });
  
  return result;
}
```

### List Command Integration

The list command provides template discovery:

```typescript
async function executeList(args: ListArgs) {
  if (args.generator) {
    // List templates for specific generator
    const templates = await generator.listTemplates(args.generator);
    return formatTemplateList(templates, args);
  } else {
    // List all generators with template counts
    const generators = await generator.listGenerators();
    return formatGeneratorList(generators, args);
  }
}
```

## Interactive Mode Integration

### Variable Prompting System

```typescript
interface PromptConfig {
  type: 'input' | 'confirm' | 'select' | 'multiselect';
  message: string;
  default?: any;
  choices?: Array<string | {name: string; value: any}>;
  validate?: (value: any) => boolean | string;
  when?: (answers: any) => boolean;
}

async function promptForVariables(
  discoveredVars: DiscoveredVariable[],
  existingAnswers: Record<string, any>
): Promise<Record<string, any>> {
  const prompts = discoveredVars.map(variable => ({
    type: inferPromptType(variable),
    name: variable.name,
    message: variable.description || `Enter ${variable.name}:`,
    default: variable.defaultValue,
    choices: variable.choices,
    validate: createValidator(variable.validation),
    when: variable.conditional ? 
      (answers) => evaluateCondition(variable.conditional!, answers) : 
      undefined
  }));
  
  return await inquirer.prompt(prompts, existingAnswers);
}
```

### Template Preview Integration

Real-time preview during interactive mode:

```typescript
async function generatePreview(
  template: TemplateInfo,
  variables: Record<string, any>,
  maxLines: number = 20
): Promise<string> {
  // Generate files to temporary directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-preview-'));
  
  try {
    // Generate with current variables
    await generateFiles({
      template,
      variables,
      destination: tempDir,
      options: { preview: true }
    });
    
    // Create preview from generated files
    const preview = await createFilePreview(tempDir, maxLines);
    return preview;
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true });
  }
}
```

## File Operations Integration

### Injection Mode Support

Templates can specify injection behavior through frontmatter:

```yaml
---
to: src/routes/<%= name.toLowerCase() %>.js
inject: true
after: "// === ROUTES ==="
skip_if: "router.get('/<%= name.toLowerCase() %>')"
---
// Route for <%= name %>
router.get('/<%= name.toLowerCase() %>', (req, res) => {
  res.json({ message: 'Hello from <%= name %>' });
});
```

**Injection Modes:**
- `inject: true` - Modify existing files instead of creating new ones
- `after: "marker"` - Insert content after specific marker
- `before: "marker"` - Insert content before specific marker
- `at_line: N` - Insert at specific line number
- `skip_if: "pattern"` - Skip injection if pattern exists
- `replace: "pattern"` - Replace content matching pattern

### Safety and Backup Integration

```typescript
interface FileOperationOptions {
  force: boolean;        // Overwrite without confirmation
  backup: boolean;       // Create backup copies
  dryRun: boolean;       // Preview only mode
  skipExisting: boolean; // Skip files that already exist
}

async function performFileOperation(
  operation: FileOperation,
  options: FileOperationOptions
): Promise<OperationResult> {
  if (options.dryRun) {
    return simulateOperation(operation);
  }
  
  if (options.backup && await fs.pathExists(operation.targetPath)) {
    await createBackup(operation.targetPath);
  }
  
  if (!options.force && await fs.pathExists(operation.targetPath)) {
    const shouldOverwrite = await confirmOverwrite(operation.targetPath);
    if (!shouldOverwrite) {
      return { skipped: true, reason: 'User chose not to overwrite' };
    }
  }
  
  return await executeOperation(operation);
}
```

## Error Handling and Recovery

### Template Error Types

```typescript
enum TemplateError {
  TEMPLATE_NOT_FOUND = 'Template or generator not found',
  INVALID_FRONTMATTER = 'Invalid YAML frontmatter in template',
  MISSING_REQUIRED_VARIABLE = 'Required template variable not provided',
  TEMPLATE_SYNTAX_ERROR = 'Nunjucks template syntax error',
  FILE_PERMISSION_ERROR = 'Insufficient permissions for file operation',
  INJECTION_FAILED = 'File injection operation failed'
}
```

### Recovery Strategies

1. **Template Fallbacks**: Use default templates when specific ones fail
2. **Variable Defaults**: Provide sensible defaults for missing variables
3. **Partial Generation**: Complete successful operations, report failures
4. **Rollback Support**: Undo changes when generation fails mid-process

## Performance Optimizations

### Template Caching

```typescript
class TemplateCache {
  private cache = new Map<string, CachedTemplate>();
  
  async getTemplate(templatePath: string): Promise<CachedTemplate> {
    if (this.cache.has(templatePath)) {
      const cached = this.cache.get(templatePath)!;
      
      // Check if template file has been modified
      const stats = await fs.stat(templatePath);
      if (stats.mtime <= cached.lastModified) {
        return cached;
      }
    }
    
    // Load and cache template
    const template = await loadTemplate(templatePath);
    this.cache.set(templatePath, template);
    return template;
  }
}
```

### Batch Operations

For multiple file generation:

```typescript
async function generateBatch(
  requests: GenerationRequest[]
): Promise<GenerationResult[]> {
  // Group by template for efficient processing
  const grouped = groupByTemplate(requests);
  
  const results: GenerationResult[] = [];
  
  for (const [template, batch] of grouped) {
    // Load template once for entire batch
    const compiledTemplate = await compileTemplate(template);
    
    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(request => generateWithCompiledTemplate(compiledTemplate, request))
    );
    
    results.push(...batchResults.map(resolveResult));
  }
  
  return results;
}
```

## Testing Integration

### Template Testing Support

```typescript
// Test templates with mock data
async function testTemplate(
  templatePath: string,
  testData: Record<string, any>
): Promise<TestResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-test-'));
  
  try {
    await generateFiles({
      template: await loadTemplate(templatePath),
      variables: testData,
      destination: tempDir
    });
    
    // Validate generated files
    const validation = await validateGeneratedFiles(tempDir);
    return { success: true, files: validation.files };
    
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await fs.rm(tempDir, { recursive: true });
  }
}
```

This integration architecture ensures seamless coordination between the CLI interface and the underlying template system, providing a powerful and flexible code generation platform.