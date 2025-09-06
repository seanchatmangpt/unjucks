# File Operations Architecture

The six essential file operations that power Unjucks code generation and modification capabilities.

## The Six Operations

Unjucks provides six core file operations controlled through frontmatter configuration:

1. **write** - Create new files (default)
2. **inject** - Insert content into existing files
3. **append** - Add content to end of files
4. **prepend** - Add content to beginning of files
5. **lineAt** - Insert content at specific line numbers
6. **skipIf** - Conditional operation control

## Operation Modes

### 1. Write (Default)
Creates new files or overwrites existing ones.

```yaml
---
to: "src/components/{{ name | pascalCase }}.tsx"
# write is the default mode
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return <div>{{ name }}</div>;
};
```

**Behavior**:
- Creates parent directories if they don't exist
- Overwrites existing files (use `--force` flag)
- Atomic operations (temp file → rename)
- Preserves file permissions

### 2. Inject
Inserts content into existing files at specific markers.

```yaml
---
to: "src/index.ts"
inject: true
before: "// COMPONENT_IMPORTS"
---
export { {{ name | pascalCase }} } from './components/{{ name | pascalCase }}';
```

**Injection Markers**:
```typescript
// Target file: src/index.ts
// COMPONENT_IMPORTS
import { Button } from './components/Button';  // ← Injected here
import { Modal } from './components/Modal';    // ← Previous injection

// Component exports
export { Button, Modal };
```

**Advanced Injection**:
```yaml
---
inject: true
after: "// END_IMPORTS"
before: "// START_COMPONENTS" 
strategy: "append"  # append | prepend | replace
preserveFormatting: true
deduplicateImports: true
---
```

### 3. Append
Adds content to the end of existing files.

```yaml
---
to: "package.json"
append: true
---
,
"{{ packageName }}": "^{{ version }}"
```

**JSON Handling Example**:
```yaml
---
to: "tsconfig.json"
append: true
jsonPath: "compilerOptions.paths"
---
{
  "{{ alias }}/*": ["{{ srcPath }}/*"]
}
```

### 4. Prepend
Adds content to the beginning of existing files.

```yaml
---
to: "src/types.ts"
prepend: true
---
// Auto-generated type for {{ name }}
export interface {{ name | pascalCase }} {
  id: string;
  name: string;
}

```

**Preserving Headers**:
```yaml
---
prepend: true
preserveHeader: true  # Keep existing file header comments
insertAfterLine: 3    # Insert after line 3
---
```

### 5. LineAt
Inserts content at specific line numbers.

```yaml
---
to: "src/config.ts"
lineAt: 15
---
  {{ configKey }}: '{{ configValue }}',
```

**Multiple Line Insertions**:
```yaml
---
lineAt: [10, 25, 40]  # Insert at multiple lines
strategy: "distributed"  # How to handle multiple insertions
---
```

### 6. SkipIf
Conditional operation control - skips the entire operation if condition is true.

```yaml
---
to: "{{ name }}.test.ts"
skipIf: "{{ !withTests }}"
---
import { {{ name | pascalCase }} } from './{{ name }}';

describe('{{ name | pascalCase }}', () => {
  it('should render correctly', () => {
    // Test implementation
  });
});
```

**Complex Conditions**:
```yaml
---
skipIf: "{{ !withTests || environment === 'production' || skipTests }}"
---
```

## Smart Injection System

### Injection Strategies

#### Content-Aware Injection
```typescript
interface InjectionStrategy {
  mode: 'smart' | 'exact' | 'regex';
  target: string | RegExp;
  strategy: 'append' | 'prepend' | 'replace' | 'merge';
  preserveFormatting: boolean;
  deduplicateContent: boolean;
}
```

#### Smart Import Detection
```yaml
---
inject: true
mode: "smart"
target: "imports"  # Auto-detect import section
addImports: true
deduplicateImports: true
---
import { {{ componentName }} } from './components/{{ componentName }}';
```

#### Smart Export Detection
```yaml
---
inject: true
mode: "smart"
target: "exports"  # Auto-detect export section  
strategy: "merge"
---
export { {{ componentName }} };
```

## File System Safety

### Atomic Operations
All file operations are atomic to prevent partial writes:

```typescript
class AtomicFileWriter {
  async write(filePath: string, content: string): Promise<void> {
    const tempFile = `${filePath}.tmp.${Date.now()}`;
    
    try {
      await fs.writeFile(tempFile, content);
      await fs.rename(tempFile, filePath);  // Atomic rename
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {}); // Cleanup
      throw error;
    }
  }
}
```

### Backup and Recovery
```yaml
---
to: "important-config.json"
createBackup: true      # Create .bak file before modification
backupSuffix: ".bak"    # Custom backup suffix
maxBackups: 5           # Keep maximum 5 backups
---
```

### Conflict Resolution
```yaml
---
to: "src/components/Button.tsx"
onConflict: "prompt"    # prompt | skip | overwrite | merge
mergeStrategy: "smart"  # For merge conflicts
---
```

## Performance Optimizations

### Batch Operations
```typescript
// Batch file operations for performance
class BatchFileProcessor {
  private operations: FileOperation[] = [];
  
  queue(operation: FileOperation): void {
    this.operations.push(operation);
  }
  
  async execute(): Promise<void> {
    // Group operations by type
    const grouped = this.groupByType(this.operations);
    
    // Execute in optimal order (reads first, then writes)
    await this.executeReads(grouped.reads);
    await this.executeWrites(grouped.writes);
    await this.executeInjections(grouped.injections);
  }
}
```

### Incremental Updates
```typescript
// Only update files that have changed
class IncrementalFileWriter {
  async writeIfChanged(filePath: string, content: string): Promise<boolean> {
    const currentContent = await this.readFile(filePath).catch(() => '');
    const contentHash = this.hash(content);
    const currentHash = this.hash(currentContent);
    
    if (contentHash !== currentHash) {
      await this.write(filePath, content);
      return true; // File was updated
    }
    
    return false; // File unchanged
  }
}
```

## Error Handling

### File Operation Errors
```typescript
export class FileOperationError extends Error {
  constructor(
    public operation: FileOperation,
    public filePath: string,
    message: string,
    public cause?: Error
  ) {
    super(`${operation} failed on ${filePath}: ${message}`);
  }
}

// Error handling with recovery
try {
  await fileWriter.inject(filePath, content, marker);
} catch (error) {
  if (error instanceof MarkerNotFoundError) {
    // Offer to create marker
    const shouldCreateMarker = await prompt.confirm('Create injection marker?');
    if (shouldCreateMarker) {
      await fileWriter.append(filePath, `\n${marker}\n`);
      await fileWriter.inject(filePath, content, marker);
    }
  }
}
```

### Validation and Safety Checks
```typescript
class FileOperationValidator {
  async validateOperation(operation: FileOperation): Promise<ValidationResult> {
    const checks = [];
    
    // Check file permissions
    if (!(await this.canWrite(operation.filePath))) {
      checks.push('File is not writable');
    }
    
    // Check disk space
    if (!(await this.hasSufficientSpace(operation.contentSize))) {
      checks.push('Insufficient disk space');
    }
    
    // Check path traversal
    if (this.hasPathTraversal(operation.filePath)) {
      checks.push('Path traversal detected');
    }
    
    return {
      valid: checks.length === 0,
      errors: checks
    };
  }
}
```

## Advanced Features

### Template-Driven File Structure
```yaml
---
# Create multiple files with directory structure
outputs:
  - path: "src/components/{{ name }}/index.ts"
    content: "main"
  - path: "src/components/{{ name }}/{{ name }}.tsx"  
    content: "component"
  - path: "src/components/{{ name }}/{{ name }}.test.tsx"
    content: "test"
    skipIf: "{{ !withTests }}"
  - path: "src/components/{{ name }}/{{ name }}.stories.tsx"
    content: "stories"
    skipIf: "{{ !withStorybook }}"
---
```

### Dynamic Path Generation
```yaml
---
to: >
  {%- if type === 'page' -%}
  src/pages/{{ name | kebabCase }}.tsx
  {%- elif type === 'component' -%}
  src/components/{{ name | pascalCase }}/index.tsx
  {%- else -%}
  src/utils/{{ name | camelCase }}.ts
  {%- endif -%}
---
```

### Custom File Operations
```typescript
// Extend with custom operations
export class CustomFileOperations extends FileOperations {
  async merge(filePath: string, content: string, strategy: MergeStrategy): Promise<void> {
    const existing = await this.readFile(filePath);
    const merged = await this.mergeContent(existing, content, strategy);
    await this.write(filePath, merged);
  }
  
  async patch(filePath: string, patches: Patch[]): Promise<void> {
    let content = await this.readFile(filePath);
    
    for (const patch of patches) {
      content = this.applyPatch(content, patch);
    }
    
    await this.write(filePath, content);
  }
}
```

## Integration with Template Engine

### Frontmatter Processing Pipeline
```typescript
// Frontmatter → File Operation mapping
class FrontmatterProcessor {
  process(frontmatter: FrontmatterConfig): FileOperation {
    const operation: FileOperation = {
      type: this.determineOperationType(frontmatter),
      filePath: this.renderPath(frontmatter.to),
      content: frontmatter.content,
      options: this.extractOptions(frontmatter)
    };
    
    return operation;
  }
  
  private determineOperationType(fm: FrontmatterConfig): OperationType {
    if (fm.inject) return 'inject';
    if (fm.append) return 'append';
    if (fm.prepend) return 'prepend';
    if (fm.lineAt) return 'lineAt';
    return 'write'; // default
  }
}
```

---

*These six file operations provide the foundation for all code generation and modification tasks in Unjucks. They can be combined and configured through frontmatter to handle complex file manipulation scenarios.*