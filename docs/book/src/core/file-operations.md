# File Operations

File Operations are the execution engine of Unjucks, providing six powerful modes for creating and modifying files. These operations support everything from simple file creation to sophisticated code injection and atomic modifications.

## The Six Core Operations

Unjucks provides six fundamental file operations, each designed for specific use cases in code generation:

1. **write** - Create new files or overwrite existing ones (default)
2. **inject** - Insert content into existing files at specific markers  
3. **append** - Add content to the end of existing files
4. **prepend** - Add content to the beginning of existing files
5. **lineAt** - Insert content at specific line numbers
6. **skipIf** - Conditional operation control

## Operation Modes

### 1. Write Operation (Default)

Creates new files or overwrites existing ones with complete content.

```yaml
---
to: "src/components/{{ name | pascalCase }}.tsx"
# write is the default operation (no explicit declaration needed)
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return <div>{{ name }}</div>;
};
```

**Key Characteristics**:
- Creates parent directories automatically if they don't exist
- Overwrites existing files when using `--force` flag
- Uses atomic operations (write to temp file, then rename)
- Preserves file permissions from previous file or sets defaults
- Supports content validation before writing

**Use Cases**:
- Generating new components, services, or modules
- Creating configuration files
- Building project scaffolding
- Generating documentation files

### 2. Inject Operation

The most sophisticated operation, inserting content into existing files at designated markers.

```yaml
---
to: "src/index.ts"
inject: true
before: "// COMPONENT_IMPORTS"
after: "// END_COMPONENT_IMPORTS"
---
export { {{ name | pascalCase }} } from './components/{{ name | pascalCase }}';
```

**Target File Example**:
```typescript
// src/index.ts
import React from 'react';

// COMPONENT_IMPORTS
export { Button } from './components/Button';     // ← Previous injection
export { Modal } from './components/Modal';      // ← Previous injection  
export { Header } from './components/Header';    // ← New injection here
// END_COMPONENT_IMPORTS

export { theme } from './theme';
```

**Advanced Injection Configuration**:
```yaml
---
inject: true
before: "// IMPORTS_START"
after: "// IMPORTS_END"
strategy: "append"          # append | prepend | replace
preserveIndentation: true   # Match existing indentation
deduplicateContent: true   # Prevent duplicate injections
sortInjections: true       # Sort injected content alphabetically  
---
```

**Injection Strategies**:
- **append** - Add new content after existing injected content
- **prepend** - Add new content before existing injected content  
- **replace** - Replace all content between markers
- **merge** - Intelligent merging for specific content types

**Smart Content Detection**:
```yaml
---
inject: true
mode: "smart"
target: "imports"           # Auto-detect import section
deduplicateImports: true   # Prevent duplicate import statements
sortImports: true          # Alphabetically sort imports
---
import { {{ componentName }} } from './components/{{ componentName }}';
```

### 3. Append Operation

Adds content to the end of existing files.

```yaml
---
to: "package.json"
append: true
jsonPath: "dependencies"    # For JSON files, specify path
---
"{{ packageName }}": "^{{ version }}"
```

**Advanced JSON Manipulation**:
```yaml
---
to: "tsconfig.json"  
append: true
jsonPath: "compilerOptions.paths"
merge: true             # Merge with existing paths
---
{
  "{{ alias }}/*": ["{{ srcPath }}/*"]
}
```

**Text File Appending**:
```yaml
---
to: ".gitignore"
append: true
addNewline: true        # Ensure newline before content
deduplicate: true       # Don't add if already present
---
# Generated files
dist/
*.log
```

### 4. Prepend Operation

Adds content to the beginning of existing files.

```yaml
---
to: "src/types.ts"
prepend: true
preserveShebang: true   # Keep #!/usr/bin/env node if present
preserveHeader: true    # Keep existing license/copyright headers
---
// Auto-generated type definitions for {{ name }}
export interface {{ name | pascalCase }} {
  id: string;
  name: string;
  createdAt: Date;
}
```

**Intelligent Header Detection**:
```yaml
---
prepend: true
insertAfterHeaders: true    # Skip license/copyright headers
insertAfterImports: false   # Insert before imports
preserveDocstrings: true    # Keep module-level docstrings
---
```

### 5. LineAt Operation

Inserts content at specific line numbers with precise control.

```yaml
---
to: "src/config/database.ts"
lineAt: 15               # Insert at line 15
preserveIndentation: true # Match indentation of target line
---
  {{ configKey }}: '{{ configValue }}',
```

**Multiple Line Insertions**:
```yaml
---
lineAt: [10, 25, 40]    # Insert at multiple lines
strategy: "distributed" # How to handle multiple insertions
content:
  10: "// Configuration section"
  25: "// Middleware section"  
  40: "// Route definitions"
---
```

**Relative Line Positioning**:
```yaml
---
lineAt: "after:// DATABASE_CONFIG"  # Insert after matching line
offsetLines: 1                      # Additional line offset
---
```

### 6. SkipIf Operation

Conditional control that skips the entire file operation based on conditions.

```yaml
---
to: "{{ name }}.test.ts"
skipIf: "{{ !withTests || environment === 'production' }}"
---
import { {{ name | pascalCase }} } from './{{ name }}';

describe('{{ name | pascalCase }}', () => {
  it('should work correctly', () => {
    // Test implementation
  });
});
```

**Complex Skip Conditions**:
```yaml
---
skipIf: "{{ !withTests || skipTests || testFramework === 'none' }}"
skipMessage: "Skipping test file (tests disabled)"
---
```

**Skip Condition Examples**:
```yaml
# Skip based on boolean variables
skipIf: "{{ !includeDocumentation }}"

# Skip based on string comparisons
skipIf: "{{ framework !== 'react' }}"

# Skip based on array contents
skipIf: "{{ 'typescript' not in languages }}"

# Complex boolean logic
skipIf: "{{ !withAuth || (authProvider === 'none' and !customAuth) }}"
```

## Advanced File Operations

### Atomic Operations

All file operations are atomic to prevent corruption during generation:

```typescript
class AtomicFileWriter {
  async write(filePath: string, content: string): Promise<void> {
    const tempFile = `${filePath}.tmp.${Date.now()}`;
    
    try {
      // Write to temporary file first
      await fs.writeFile(tempFile, content, { mode: this.getFileMode(filePath) });
      
      // Atomic rename (this is the atomic operation)
      await fs.rename(tempFile, filePath);
      
      // Set file permissions if specified
      if (this.config.chmod) {
        await fs.chmod(filePath, this.config.chmod);
      }
    } catch (error) {
      // Cleanup temporary file on failure
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }
}
```

### Backup and Recovery

Automatic backup creation for safe modifications:

```yaml
---
to: "important-config.json"
createBackup: true          # Create .bak file before modification
backupSuffix: ".backup"     # Custom backup suffix
maxBackups: 5               # Keep maximum 5 backups
timestampBackups: true      # Add timestamp to backup names
---
```

**Backup Strategies**:
- **incremental** - Only backup if file has changed
- **always** - Create backup for every operation
- **never** - Disable backups (default)
- **prompt** - Ask user before creating backups

### Conflict Resolution

Handle conflicting file operations gracefully:

```yaml
---
to: "src/components/Button.tsx"
onConflict: "merge"         # prompt | skip | overwrite | merge
mergeStrategy: "smart"      # For merge conflicts
conflictMarkers: true       # Add <<<< >>>> markers for manual resolution
---
```

**Conflict Resolution Strategies**:
```typescript
interface ConflictResolution {
  strategy: 'prompt' | 'skip' | 'overwrite' | 'merge';
  mergeStrategy?: 'line-by-line' | 'smart' | 'semantic';
  promptMessage?: string;
  autoResolve?: boolean;
}
```

### Content-Aware Operations

Smart operations that understand file types and content structure:

```yaml
---
to: "src/routes.ts"
inject: true
mode: "smart"
contentType: "typescript"    # Enable TypeScript-aware injection
target: "routes"            # Auto-detect route definitions section
sortContent: true           # Sort routes alphabetically
validateSyntax: true        # Validate TypeScript syntax after injection
---
{
  path: '/{{ routePath }}',
  component: {{ componentName | pascalCase }},
  name: '{{ routeName }}'
}
```

**Supported Content Types**:
- **typescript/javascript** - Import management, syntax validation
- **json** - Schema validation, path-based updates
- **yaml** - Structure preservation, validation
- **css/scss** - Rule organization, property sorting
- **markdown** - Section management, TOC updates

## Performance Optimizations

### Batch Operations

Process multiple file operations efficiently:

```typescript
class BatchFileProcessor {
  private operations: FileOperation[] = [];
  
  queue(operation: FileOperation): void {
    this.operations.push(operation);
  }
  
  async execute(): Promise<void> {
    // Group operations by type for optimal processing
    const grouped = this.groupOperations(this.operations);
    
    // Execute in optimal order
    await this.executeReads(grouped.reads);       // Read operations first
    await this.executeWrites(grouped.writes);     // Writes second  
    await this.executeInjections(grouped.injections); // Injections last
    
    // Run post-processing hooks
    await this.runPostProcessingHooks();
  }
  
  private groupOperations(operations: FileOperation[]): GroupedOperations {
    return operations.reduce((groups, op) => {
      groups[op.type].push(op);
      return groups;
    }, { reads: [], writes: [], injections: [] });
  }
}
```

### Incremental Updates

Only modify files that have actually changed:

```typescript
class IncrementalFileWriter {
  async writeIfChanged(filePath: string, content: string): Promise<boolean> {
    const currentContent = await this.readFile(filePath).catch(() => '');
    const contentHash = this.hashContent(content);
    const currentHash = this.hashContent(currentContent);
    
    if (contentHash !== currentHash) {
      await this.atomicWrite(filePath, content);
      return true; // File was updated
    }
    
    return false; // File unchanged, no write performed
  }
  
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

### Parallel Processing

Execute independent file operations in parallel:

```typescript
class ParallelProcessor {
  async executeOperations(operations: FileOperation[]): Promise<void> {
    // Group operations by dependencies
    const independent = operations.filter(op => !op.dependencies?.length);
    const dependent = operations.filter(op => op.dependencies?.length);
    
    // Execute independent operations in parallel
    await Promise.all(independent.map(op => this.executeOperation(op)));
    
    // Execute dependent operations in dependency order
    await this.executeDependent(dependent);
  }
}
```

## Error Handling and Safety

### Comprehensive Error Types

```typescript
export class FileOperationError extends Error {
  constructor(
    public operation: FileOperation,
    public filePath: string,
    message: string,
    public cause?: Error
  ) {
    super(`${operation.type} operation failed on ${filePath}: ${message}`);
    this.name = 'FileOperationError';
  }
}

export class MarkerNotFoundError extends FileOperationError {
  constructor(filePath: string, marker: string) {
    super('inject', filePath, `Injection marker '${marker}' not found`);
  }
}

export class ValidationError extends FileOperationError {
  constructor(filePath: string, validationErrors: string[]) {
    super('validate', filePath, `Validation failed: ${validationErrors.join(', ')}`);
  }
}
```

### Error Recovery

Implement graceful error handling with recovery options:

```typescript
try {
  await fileWriter.inject(filePath, content, { before: marker });
} catch (error) {
  if (error instanceof MarkerNotFoundError) {
    // Offer to create missing injection marker
    const shouldCreateMarker = await prompt.confirm(
      `Injection marker '${marker}' not found. Create it?`
    );
    
    if (shouldCreateMarker) {
      await fileWriter.append(filePath, `\n${marker}\n`);
      await fileWriter.inject(filePath, content, { before: marker });
    }
  } else if (error instanceof PermissionError) {
    // Suggest alternative locations or permission fixes
    const suggestions = await this.suggestAlternatives(filePath);
    throw new UserFriendlyError('Permission denied', suggestions);
  }
}
```

### Pre-Operation Validation

Validate operations before execution:

```typescript
class FileOperationValidator {
  async validateOperation(operation: FileOperation): Promise<ValidationResult> {
    const checks: string[] = [];
    
    // Check file system permissions
    if (!(await this.canWrite(operation.filePath))) {
      checks.push(`No write permission for ${operation.filePath}`);
    }
    
    // Check available disk space
    const requiredSpace = operation.estimatedSize || operation.content.length;
    if (!(await this.hasSufficientSpace(requiredSpace))) {
      checks.push('Insufficient disk space');
    }
    
    // Check for path traversal attacks
    if (this.hasPathTraversal(operation.filePath)) {
      checks.push('Path traversal attempt detected');
    }
    
    // Validate file paths
    if (!this.isValidPath(operation.filePath)) {
      checks.push('Invalid file path');
    }
    
    // Check file locks
    if (await this.isFileLocked(operation.filePath)) {
      checks.push('File is locked by another process');
    }
    
    return {
      valid: checks.length === 0,
      errors: checks,
      suggestions: this.generateSuggestions(checks)
    };
  }
}
```

## Integration with Template System

### Frontmatter to Operation Mapping

The frontmatter processor converts YAML configuration to file operations:

```typescript
class FrontmatterProcessor {
  process(frontmatter: FrontmatterConfig, content: string): FileOperation {
    const operation: FileOperation = {
      type: this.determineOperationType(frontmatter),
      filePath: this.renderFilePath(frontmatter.to),
      content: content,
      options: this.extractOptions(frontmatter),
      validation: this.extractValidation(frontmatter)
    };
    
    return operation;
  }
  
  private determineOperationType(fm: FrontmatterConfig): OperationType {
    if (fm.skipIf && this.evaluateCondition(fm.skipIf)) return 'skip';
    if (fm.inject) return 'inject';
    if (fm.append) return 'append';
    if (fm.prepend) return 'prepend';
    if (fm.lineAt) return 'lineAt';
    return 'write'; // default operation
  }
}
```

### Operation Hooks

Execute custom logic before and after operations:

```yaml
---
to: "src/{{ name }}.ts"
beforeWrite: "validateTypeScript"    # Run validation hook
afterWrite: "formatWithPrettier"     # Run formatting hook
---
```

```typescript
// Hook implementations
export const hooks = {
  validateTypeScript: async (filePath: string, content: string) => {
    const result = await typescript.compile(content, { noEmit: true });
    if (result.diagnostics.length > 0) {
      throw new ValidationError(filePath, result.diagnostics.map(d => d.messageText));
    }
  },
  
  formatWithPrettier: async (filePath: string) => {
    const formatted = await prettier.format(
      await fs.readFile(filePath, 'utf-8'),
      { parser: 'typescript' }
    );
    await fs.writeFile(filePath, formatted);
  }
};
```

## Best Practices

### Operation Selection Guidelines

Choose the appropriate operation for your use case:

- **write** - New files, complete file replacement
- **inject** - Adding imports, exports, registrations
- **append** - Adding items to lists, configuration entries
- **prepend** - Adding headers, top-level imports
- **lineAt** - Precise positioning, configuration updates
- **skipIf** - Conditional generation, environment-specific files

### Safety Recommendations

1. **Always use dry-run mode** when testing new templates
2. **Enable backups** for important files
3. **Use validation hooks** for critical operations
4. **Test with edge cases** including empty files and binary content
5. **Implement proper error handling** for all file operations

### Performance Tips

1. **Batch related operations** to reduce file system calls
2. **Use incremental updates** to avoid unnecessary writes
3. **Cache file stats** to optimize conflict detection
4. **Parallelize independent operations** for better performance

The File Operations system provides a robust foundation for all code generation and modification tasks, offering both power and safety through its comprehensive feature set and careful error handling.