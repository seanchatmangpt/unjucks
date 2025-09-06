# MCP Tool Definitions for Unjucks

## Complete Tool Schema Definitions

### 1. unjucks_list

```typescript
const UNJUCKS_LIST_SCHEMA = {
  type: "object",
  properties: {
    generator: {
      type: "string",
      description: "Filter by specific generator name",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    format: {
      type: "string",
      enum: ["simple", "detailed", "json"],
      default: "simple",
      description: "Output format for the list"
    },
    showHidden: {
      type: "boolean",
      default: false,
      description: "Include hidden generators (prefixed with .)"
    }
  },
  additionalProperties: false
};

const UNJUCKS_LIST_TOOL = {
  name: "unjucks_list",
  description: "List available generators and templates in the project",
  inputSchema: UNJUCKS_LIST_SCHEMA
};
```

### 2. unjucks_generate

```typescript
const UNJUCKS_GENERATE_SCHEMA = {
  type: "object",
  properties: {
    generator: {
      type: "string",
      description: "Name of the generator to use",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    template: {
      type: "string", 
      description: "Name of the template within the generator",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    dest: {
      type: "string",
      default: ".",
      description: "Destination directory for generated files"
    },
    variables: {
      type: "object",
      description: "Template variables as key-value pairs",
      additionalProperties: true
    },
    force: {
      type: "boolean",
      default: false,
      description: "Overwrite existing files without prompting"
    },
    dry: {
      type: "boolean", 
      default: false,
      description: "Show what would be generated without creating files"
    }
  },
  required: ["generator", "template"],
  additionalProperties: false
};

const UNJUCKS_GENERATE_TOOL = {
  name: "unjucks_generate",
  description: "Generate files from a template with specified variables",
  inputSchema: UNJUCKS_GENERATE_SCHEMA
};
```

### 3. unjucks_help

```typescript
const UNJUCKS_HELP_SCHEMA = {
  type: "object",
  properties: {
    generator: {
      type: "string",
      description: "Name of the generator",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    template: {
      type: "string",
      description: "Name of the template",
      pattern: "^[a-zA-Z0-9_-]+$"
    }
  },
  required: ["generator", "template"],
  additionalProperties: false
};

const UNJUCKS_HELP_TOOL = {
  name: "unjucks_help", 
  description: "Get help information about template variables and usage",
  inputSchema: UNJUCKS_HELP_SCHEMA
};
```

### 4. unjucks_dry_run

```typescript
const UNJUCKS_DRY_RUN_SCHEMA = {
  type: "object",
  properties: {
    generator: {
      type: "string",
      description: "Name of the generator to use",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    template: {
      type: "string",
      description: "Name of the template within the generator", 
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    dest: {
      type: "string",
      default: ".",
      description: "Destination directory for generated files"
    },
    variables: {
      type: "object",
      description: "Template variables as key-value pairs",
      additionalProperties: true
    },
    showContent: {
      type: "boolean",
      default: false,
      description: "Include file content in preview"
    },
    showDiff: {
      type: "boolean", 
      default: false,
      description: "Show diffs for existing files"
    }
  },
  required: ["generator", "template"],
  additionalProperties: false
};

const UNJUCKS_DRY_RUN_TOOL = {
  name: "unjucks_dry_run",
  description: "Preview what would be generated without creating files",
  inputSchema: UNJUCKS_DRY_RUN_SCHEMA
};
```

### 5. unjucks_inject

```typescript
const UNJUCKS_INJECT_SCHEMA = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "Path to the file to inject content into"
    },
    content: {
      type: "string",
      description: "Content to inject into the file"
    },
    mode: {
      type: "string", 
      enum: ["inject", "append", "prepend", "lineAt"],
      default: "inject",
      description: "Injection mode"
    },
    target: {
      type: "string",
      description: "Target string for inject mode (inject before/after this)"
    },
    lineNumber: {
      type: "integer",
      minimum: 1,
      description: "Line number for lineAt mode (1-based)"
    },
    backup: {
      type: "boolean",
      default: true,
      description: "Create backup before modification"
    },
    force: {
      type: "boolean",
      default: false, 
      description: "Force injection even if content already exists"
    }
  },
  required: ["filePath", "content"],
  additionalProperties: false
};

const UNJUCKS_INJECT_TOOL = {
  name: "unjucks_inject",
  description: "Inject content into existing files at specified locations",
  inputSchema: UNJUCKS_INJECT_SCHEMA
};
```

## Complete Tool Registry

```typescript
export const MCP_TOOLS = [
  UNJUCKS_LIST_TOOL,
  UNJUCKS_GENERATE_TOOL, 
  UNJUCKS_HELP_TOOL,
  UNJUCKS_DRY_RUN_TOOL,
  UNJUCKS_INJECT_TOOL
];

export const MCP_SCHEMAS = {
  unjucks_list: UNJUCKS_LIST_SCHEMA,
  unjucks_generate: UNJUCKS_GENERATE_SCHEMA,
  unjucks_help: UNJUCKS_HELP_SCHEMA,
  unjucks_dry_run: UNJUCKS_DRY_RUN_SCHEMA,
  unjucks_inject: UNJUCKS_INJECT_SCHEMA
};
```

## Integration Points

### 1. Generator Class Integration

```typescript
// Existing Generator class extensions needed
export class Generator {
  // ... existing methods ...

  async listForMCP(options?: { generator?: string; showHidden?: boolean }) {
    const generators = await this.listGenerators();
    
    if (options?.generator) {
      return generators.filter(g => g.name === options.generator);
    }
    
    if (!options?.showHidden) {
      return generators.filter(g => !g.name.startsWith('.'));
    }
    
    return generators;
  }

  async generateForMCP(params: MCPGenerateParams): Promise<MCPGenerateResult> {
    const result = await this.generate(params);
    
    return {
      success: true,
      files: result.files.map(f => ({
        path: f.path,
        action: f.injectionResult?.success ? "created" : "skipped",
        content: params.dry ? f.content : undefined
      }))
    };
  }

  async getHelpForMCP(generator: string, template: string): Promise<MCPHelpResult> {
    const { variables } = await this.scanTemplateForVariables(generator, template);
    
    // Create argument parser for positional detection
    const parser = new ArgumentParser({ templateVariables: variables });
    const positional = parser.extractPositionalParameters();
    
    return {
      variables: variables.map(v => ({
        name: v.name,
        type: v.type,
        description: v.description || `Variable: ${v.name}`,
        required: v.required,
        defaultValue: v.defaultValue,
        isPositional: positional.some(p => p.name === v.name)
      })),
      examples: parser.generateUsageExamples(generator, template, positional),
      frontmatterOptions: [
        'to: custom/path.ext',
        'inject: true',
        'append: true', 
        'prepend: true',
        'lineAt: 42',
        'skipIf: condition',
        'chmod: 755',
        'sh: command'
      ]
    };
  }
}
```

### 2. FileInjector Integration

```typescript
// FileInjector extensions for MCP
export class FileInjector {
  // ... existing methods ...

  async injectForMCP(params: MCPInjectParams): Promise<MCPInjectResult> {
    const frontmatter: FrontmatterConfig = {};
    
    switch (params.mode) {
      case "append":
        frontmatter.append = true;
        break;
      case "prepend": 
        frontmatter.prepend = true;
        break;
      case "lineAt":
        frontmatter.lineAt = params.lineNumber;
        break;
      case "inject":
      default:
        frontmatter.inject = true;
        if (params.target) {
          frontmatter.after = params.target;
        }
        break;
    }

    const result = await this.processFile(
      params.filePath,
      params.content,
      frontmatter,
      {
        force: params.force || false,
        dry: false,
        backup: params.backup !== false
      }
    );

    return {
      success: result.success,
      action: result.skipped ? "skipped" : 
              result.success ? "injected" : "failed",
      message: result.message,
      backupPath: params.backup ? result.message.includes('backup') ? 
                  params.filePath + '.bak' : undefined : undefined
    };
  }
}
```

## Type Definitions

```typescript
// MCP-specific types
export interface MCPGenerateParams {
  generator: string;
  template: string; 
  dest?: string;
  variables?: Record<string, any>;
  force?: boolean;
  dry?: boolean;
}

export interface MCPGenerateResult {
  success: boolean;
  files: {
    path: string;
    action: "created" | "updated" | "skipped" | "injected";
    content?: string;
  }[];
  errors?: string[];
}

export interface MCPHelpResult {
  variables: {
    name: string;
    type: "string" | "boolean" | "number";
    description: string;
    required: boolean; 
    defaultValue?: any;
    isPositional?: boolean;
  }[];
  examples: string[];
  frontmatterOptions: string[];
}

export interface MCPInjectParams {
  filePath: string;
  content: string;
  mode: "inject" | "append" | "prepend" | "lineAt";
  target?: string;
  lineNumber?: number;
  backup?: boolean;
  force?: boolean;
}

export interface MCPInjectResult {
  success: boolean;
  action: "injected" | "skipped" | "failed";
  message: string;
  backupPath?: string;
}
```

## Validation Rules

### Security Validation
- File paths must not contain path traversal sequences (`../`)
- File paths must not access system directories
- Content size must not exceed 10MB
- Maximum 100 files per generation

### Input Validation  
- Generator/template names: alphanumeric, hyphens, underscores only
- Variable names: valid JavaScript identifiers
- Line numbers: positive integers
- File paths: valid OS paths

### Business Logic Validation
- Generator must exist before template lookup
- Template must exist in specified generator
- Required variables must be provided
- Injection targets must exist in target files

## Error Response Format

```typescript
interface MCPErrorResponse {
  content: [{
    type: "text";
    text: string;
  }];
  isError: true;
  _meta?: {
    errorType: "validation" | "security" | "template" | "filesystem";
    errorCode: string;
    details?: Record<string, any>;
  };
}
```

## Performance Considerations

### Caching Strategy
- Template scan results: 5 minutes TTL
- Generator lists: 1 minute TTL  
- File system checks: 30 seconds TTL

### Resource Limits
- Max concurrent operations: 10
- Operation timeout: 30 seconds
- Max template depth: 10 levels
- Max file size: 100MB

### Optimization Opportunities
- Batch file existence checks
- Parallel template scanning
- Incremental generator discovery
- Smart cache invalidation

This specification provides a complete foundation for implementing the MCP server integration with Unjucks.