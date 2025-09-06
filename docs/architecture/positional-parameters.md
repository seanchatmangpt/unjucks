# Positional Parameters CLI Architecture

## Overview

This document defines the complete architecture for enhanced positional parameter parsing in Unjucks, achieving full Hygen parity while providing superior capabilities. The system supports mixed positional and flag-based arguments with intelligent precedence handling.

## Core Architecture

### 1. Argument Parsing Precedence

The system follows a strict precedence order:

```
1. Positional Arguments (highest priority)
2. Flag-based Arguments  
3. Interactive Prompts
4. Template Configuration Defaults
5. System Defaults (lowest priority)
```

### 2. PositionalParser Core Class

```typescript
interface PositionalParserConfig {
  strict: boolean;              // Strict positional mode vs flexible
  maxPositionals: number;       // Maximum positional arguments allowed
  allowMixed: boolean;          // Allow mixing positional and flags
  autoPrompt: boolean;          // Auto-prompt for missing required args
  validationMode: 'eager' | 'lazy'; // When to validate arguments
}

interface ParsedArguments {
  positionals: string[];
  flags: Record<string, any>;
  variables: Record<string, any>;
  metadata: {
    source: 'positional' | 'flag' | 'interactive' | 'config' | 'default';
    precedence: number;
    isValid: boolean;
    errors: string[];
  };
}
```

### 3. Command Structure Enhancement

#### Standard Unjucks Commands
```bash
# Current format (maintained for backward compatibility)
unjucks generate [generator] [template] --var=value --force --dry

# Enhanced positional format
unjucks generate component Button --name=MyButton --type=primary
unjucks generate api UserController --entity=User --methods=CRUD
```

#### Hygen-Compatible Format
```bash
# Full Hygen parity
unjucks component new --name Button --type primary
unjucks api new --name UserController --entity User
```

### 4. Template Variable Mapping

The system automatically maps positional arguments to template variables using multiple strategies:

#### Strategy 1: Position-based Mapping
```typescript
interface PositionMapping {
  position: number;
  variableName: string;
  required: boolean;
  type: 'string' | 'boolean' | 'number';
  validator?: (value: string) => boolean;
}
```

#### Strategy 2: Template Metadata Mapping
Templates can define positional mappings in frontmatter:
```yaml
---
to: src/{{ name | kebabCase }}.ts
positionals:
  - name: "name"
    position: 0
    required: true
    type: "string"
  - name: "type" 
    position: 1
    required: false
    type: "string"
    default: "component"
---
```

#### Strategy 3: Intelligent Inference
The system infers variable mappings based on:
- Variable usage frequency in templates
- Naming conventions (name, type, path, etc.)
- Template structure analysis
- User usage patterns (learning system)

## Implementation Architecture

### Core Components

```typescript
// Main parser class
export class PositionalParser {
  private config: PositionalParserConfig;
  private templateScanner: TemplateScanner;
  private validator: ArgumentValidator;
  private compatibilityLayer: BackwardCompatibility;
  
  constructor(config: PositionalParserConfig);
  
  parse(args: string[], context: ParseContext): ParsedArguments;
  parseHygenStyle(args: string[]): ParsedArguments;
  parseUnjucksStyle(args: string[]): ParsedArguments;
  validateArguments(parsed: ParsedArguments): ValidationResult;
  transformToVariables(parsed: ParsedArguments): Record<string, any>;
}

// Context for parsing operations
interface ParseContext {
  generator?: string;
  template?: string;
  templatePath?: string;
  variables: TemplateVariable[];
  isHygenMode: boolean;
  strictMode: boolean;
}
```

### Advanced Features

#### 1. Dynamic CLI Generation
```typescript
interface DynamicCliGenerator {
  generateCliDefinition(
    generator: string, 
    template: string
  ): CittyCommandDefinition;
  
  updateCliArguments(
    existing: CittyCommandDefinition,
    variables: TemplateVariable[]
  ): CittyCommandDefinition;
  
  createPositionalMappings(
    variables: TemplateVariable[]
  ): PositionMapping[];
}
```

#### 2. Smart Argument Resolution
```typescript
interface ArgumentResolver {
  resolveFromPositional(args: string[], mappings: PositionMapping[]): Record<string, any>;
  resolveFromFlags(args: Record<string, any>): Record<string, any>;
  resolveFromInteractive(missing: TemplateVariable[]): Promise<Record<string, any>>;
  resolveFromDefaults(variables: TemplateVariable[]): Record<string, any>;
  
  mergeWithPrecedence(
    positional: Record<string, any>,
    flags: Record<string, any>, 
    interactive: Record<string, any>,
    defaults: Record<string, any>
  ): Record<string, any>;
}
```

## Performance Optimizations

### 1. Lazy Parsing
- Parse arguments only when needed
- Cache parsed results per command session
- Defer expensive validation until required

### 2. Template Scanning Optimization
- Cache template variable analysis
- Incremental scanning for changed templates
- Parallel scanning for multiple templates

### 3. Argument Validation Pipeline
```typescript
interface ValidationPipeline {
  stages: ValidationStage[];
  
  addStage(stage: ValidationStage): void;
  validate(args: ParsedArguments): ValidationResult;
  validateAsync(args: ParsedArguments): Promise<ValidationResult>;
}

interface ValidationStage {
  name: string;
  validate(args: ParsedArguments): ValidationResult;
  canSkip(args: ParsedArguments): boolean;
  priority: number;
}
```

## Error Handling & Recovery

### 1. Graceful Error Handling
```typescript
interface ErrorHandler {
  handleParsingError(error: ParsingError): RecoveryAction;
  handleValidationError(error: ValidationError): RecoveryAction;
  handlePositionalMismatch(error: MismatchError): RecoveryAction;
  
  suggestCorrection(error: Error): string[];
  recoverFromError(error: Error, context: ParseContext): ParsedArguments;
}

type RecoveryAction = 
  | 'prompt-user'
  | 'use-defaults' 
  | 'show-help'
  | 'fallback-to-interactive'
  | 'exit-with-error';
```

### 2. User Guidance System
- Intelligent error messages with suggestions
- Context-aware help generation
- Auto-completion for arguments
- Usage examples based on current context

## Backward Compatibility

### 1. Legacy Command Support
All existing Unjucks commands continue to work without changes:
```bash
# These remain unchanged
unjucks generate component button --name=MyButton
unjucks list
unjucks help component button
```

### 2. Migration Path
The system provides a seamless migration path:
```typescript
interface MigrationSupport {
  detectLegacyUsage(args: string[]): boolean;
  convertLegacyToNew(args: string[]): ParsedArguments;
  showMigrationHint(legacyCommand: string): void;
  supportBothFormats: boolean;
}
```

### 3. Configuration-driven Behavior
Users can configure parsing behavior:
```typescript
// unjucks.config.ts
export default {
  parsing: {
    mode: 'flexible',      // 'strict' | 'flexible' | 'legacy'
    allowPositional: true,
    allowFlags: true,
    hygenCompatible: true,
    autoMigrate: false,
  }
}
```

## Testing & Validation

### 1. Comprehensive Test Coverage
- Unit tests for all parser components
- Integration tests for CLI workflows
- Property-based testing for argument combinations
- Performance benchmarks for parsing operations

### 2. Validation Framework
```typescript
interface TestFramework {
  testPositionalParsing(): TestSuite;
  testBackwardCompatibility(): TestSuite;
  testPerformance(): TestSuite;
  testErrorHandling(): TestSuite;
  testHygenParity(): TestSuite;
}
```

This architecture ensures that Unjucks achieves complete Hygen parity while maintaining backward compatibility and providing enhanced capabilities for modern CLI workflows.