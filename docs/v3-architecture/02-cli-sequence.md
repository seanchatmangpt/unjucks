# CLI Execution Sequence

This document describes the complete execution flow of the Unjucks CLI from user input to file generation, including error handling and interactive modes.

## Main Command Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI Entry Point
    participant Parser as Argument Parser
    participant Discovery as Template Discovery
    participant Engine as Nunjucks Engine
    participant FileSystem as File System
    participant Injector as File Injector
    
    User->>CLI: unjucks component react MyComponent
    CLI->>Parser: Parse Hygen-style args
    Parser->>Parser: Transform to explicit syntax
    Note over Parser: "component react MyComponent" → "generate component react --name=MyComponent"
    Parser->>Discovery: Find generator/template
    Discovery->>Discovery: Scan _templates/component/react/
    Discovery-->>CLI: Return template path & metadata
    
    CLI->>Engine: Load template files
    Engine->>Engine: Parse frontmatter
    Engine->>Engine: Extract variables from {{ }} patterns
    Engine->>Engine: Apply Nunjucks filters & transformations
    Engine-->>CLI: Rendered content & output paths
    
    CLI->>Injector: Process file operations
    Injector->>FileSystem: Validate paths & permissions
    Injector->>FileSystem: Atomic write/inject operations
    FileSystem-->>User: Success feedback with file paths
```

## Interactive Mode Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Discovery
    participant Prompts
    participant Scanner
    participant Engine
    
    User->>CLI: unjucks (no args)
    CLI->>Discovery: List available generators
    Discovery-->>CLI: Generator list
    CLI->>Prompts: Show generator selection
    Prompts-->>User: Interactive menu
    User->>Prompts: Select generator
    
    Prompts->>Discovery: List templates for generator
    Discovery-->>Prompts: Template list
    Prompts-->>User: Template selection menu
    User->>Prompts: Select template
    
    Prompts->>Scanner: Scan template for variables
    Scanner->>Scanner: Parse {{ variable }} patterns
    Scanner-->>Prompts: Variable definitions
    Prompts-->>User: Collect variable values
    User->>Prompts: Provide values
    
    Prompts->>Engine: Generate with collected data
    Engine-->>User: Success/failure result
```

## Error Handling Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Validator
    participant ErrorHandler
    participant Recovery
    
    User->>CLI: unjucks invalid-generator
    CLI->>Validator: Validate generator exists
    Validator-->>CLI: ValidationError: Generator not found
    CLI->>ErrorHandler: Handle validation error
    
    ErrorHandler->>ErrorHandler: Categorize error type
    ErrorHandler->>Recovery: Suggest recovery actions
    Recovery-->>User: Helpful error message + suggestions
    
    Note over Recovery: "Generator 'invalid-generator' not found.<br/>💡 Did you mean 'component'?<br/>💡 Run 'unjucks list' to see available generators"
    
    alt Auto-recovery enabled
        Recovery->>CLI: Attempt fuzzy matching
        CLI->>User: "Did you mean 'component'? (y/n)"
        User->>CLI: y
        CLI->>CLI: Retry with corrected input
    else Manual recovery
        Recovery-->>User: Exit with helpful suggestions
    end
```

## Template Discovery Process

```mermaid
sequenceDiagram
    participant CLI
    participant Scanner as Template Scanner
    participant FS as File System
    participant Cache as Template Cache
    
    CLI->>Scanner: Discover templates for "component/react"
    Scanner->>Cache: Check cache for recent scan
    
    alt Cache hit
        Cache-->>Scanner: Return cached template data
    else Cache miss
        Scanner->>FS: Scan _templates/component/react/
        FS-->>Scanner: Directory contents
        
        loop For each .njk/.hbs file
            Scanner->>FS: Read template file
            FS-->>Scanner: Template content
            Scanner->>Scanner: Parse frontmatter & extract metadata
            Scanner->>Scanner: Scan for {{ variables }}
        end
        
        Scanner->>Cache: Store scan results
        Cache-->>Scanner: Cache confirmation
    end
    
    Scanner-->>CLI: Template metadata + variable definitions
```

## File Injection Pipeline

```mermaid
sequenceDiagram
    participant Engine
    participant Injector
    participant Analyzer as Content Analyzer
    participant Writer as Atomic Writer
    participant Backup as Backup Manager
    
    Engine->>Injector: Process template output
    Note over Engine: frontmatter: { inject: true, to: "src/{{name}}.js", before: "// INSERT_POINT" }
    
    Injector->>Analyzer: Analyze target file
    Analyzer->>Analyzer: Parse injection strategy
    Analyzer->>Analyzer: Locate injection points
    Analyzer-->>Injector: Injection plan
    
    alt File exists
        Injector->>Backup: Create backup copy
        Backup-->>Injector: Backup created
        
        Injector->>Writer: Modify existing file
        Writer->>Writer: Apply injection strategy
        Writer->>Writer: Validate syntax (if applicable)
    else File doesn't exist
        Injector->>Writer: Create new file
        Writer->>Writer: Write complete content
    end
    
    Writer-->>Injector: Write result
    Injector-->>Engine: Final result with file paths
```

## Dry Run Mode

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Engine
    participant Validator
    participant Preview
    
    User->>CLI: unjucks component react Button --dry
    CLI->>Engine: Process with dry-run flag
    Engine->>Engine: Render templates normally
    Engine->>Validator: Validate output paths
    Validator->>Validator: Check file conflicts
    Validator->>Validator: Verify permissions
    
    Engine->>Preview: Generate preview report
    Preview->>Preview: Format file tree
    Preview->>Preview: Show content previews
    Preview->>Preview: Highlight potential conflicts
    
    Preview-->>User: Detailed preview without file writes
    Note over Preview: "📁 Would create:<br/>  + src/components/Button.jsx (new)<br/>  ⚠ src/index.js (would modify)<br/>  ⏭ tests/Button.test.js (exists, use --force)"
```

## Force Mode with Conflicts

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Engine
    participant ConflictHandler
    participant Writer
    
    User->>CLI: unjucks component react Button --force
    CLI->>Engine: Process with force flag
    Engine->>ConflictHandler: Handle existing files
    
    loop For each target file
        ConflictHandler->>ConflictHandler: Check if file exists
        
        alt File exists
            ConflictHandler->>Writer: Overwrite with backup
            Writer->>Writer: Create .bak file
            Writer->>Writer: Write new content
        else File doesn't exist
            ConflictHandler->>Writer: Create new file
        end
    end
    
    Writer-->>User: Summary of changes with backup info
```

## Error Recovery Strategies

### Template Not Found
```mermaid
flowchart TD
    A[Template Not Found] --> B{Fuzzy Match Available?}
    B -->|Yes| C[Suggest Similar Templates]
    B -->|No| D[Show Available Templates]
    C --> E[Auto-correct Option]
    D --> F[List Command Suggestion]
    E --> G[Retry with Correction]
    F --> H[Manual Selection]
```

### Variable Validation Errors
```mermaid
flowchart TD
    A[Variable Error] --> B{Error Type}
    B -->|Missing Required| C[Prompt for Missing Values]
    B -->|Invalid Type| D[Type Conversion/Validation]
    B -->|Invalid Characters| E[Sanitization Suggestions]
    C --> F[Interactive Input]
    D --> G[Smart Type Inference]
    E --> H[Valid Alternatives]
```

### File System Errors
```mermaid
flowchart TD
    A[FS Error] --> B{Error Type}
    B -->|Permission Denied| C[Suggest chmod/sudo]
    B -->|Path Not Exists| D[Create Directory Tree]
    B -->|Disk Full| E[Cleanup Suggestions]
    B -->|File Locked| F[Retry with Delay]
    C --> G[Permission Fix Guide]
    D --> H[Auto-create Parents]
    E --> I[Space Analysis]
    F --> J[Conflict Resolution]
```

## Command Aliases and Shortcuts

The CLI supports multiple input patterns that all resolve to the same execution flow:

| Input | Transformed To | Description |
|-------|---------------|-------------|
| `unjucks component react Button` | `unjucks generate component react --name=Button` | Hygen-style positional |
| `unjucks generate component react` | `unjucks generate component react` | Explicit syntax |
| `unjucks list` | `unjucks list` | Direct command |
| `unjucks --help` | `unjucks --help` | Global help |
| `unjucks` | `unjucks --help` | Default help |

## Performance Optimizations

1. **Template Caching**: Parsed templates are cached to avoid re-parsing
2. **Lazy Loading**: Commands are loaded only when needed
3. **Parallel Processing**: Multiple templates processed concurrently
4. **Smart Validation**: Only validate what's necessary for the operation
5. **Incremental Updates**: Only update changed files in watch mode

## Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | All files generated successfully |
| 1 | General Error | Template parsing failed |
| 2 | Validation Error | Required variables missing |
| 3 | File System Error | Permission denied |
| 4 | Template Not Found | Generator doesn't exist |
| 5 | User Cancellation | Interactive mode cancelled |

This sequence ensures robust, user-friendly CLI operation with comprehensive error handling and recovery mechanisms.