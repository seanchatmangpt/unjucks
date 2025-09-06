# Enhanced Frontmatter Processing Architecture

## Overview

This document defines the comprehensive architecture for enhanced YAML frontmatter processing in Unjucks, providing advanced template configuration capabilities while maintaining full backward compatibility with existing frontmatter formats.

## Core Architecture

### 1. Enhanced Frontmatter Schema

The enhanced frontmatter system supports nested configurations, conditional logic, and advanced processing directives:

```yaml
---
# Basic file configuration (existing)
to: "{{ directory }}/{{ name | kebabCase }}.{{ extension }}"
inject: true
before: "// INJECTION_POINT"
skipIf: "{{ !withTests }}"

# Enhanced configuration (new)
config:
  version: "2.0"
  engine: "enhanced"
  
# Advanced targeting
target:
  path: "{{ outputPath }}/{{ name }}.ts"
  createDirs: true
  backupExisting: true
  
# Conditional processing
conditions:
  - when: "{{ type === 'component' }}"
    then:
      to: "src/components/{{ name }}/index.ts"
      inject: true
      after: "// Components"
  - when: "{{ type === 'util' }}"
    then:
      to: "src/utils/{{ name }}.ts"
      chmod: "755"

# Multi-file output
outputs:
  - path: "{{ name }}.ts"
    template: "main"
  - path: "{{ name }}.test.ts"
    template: "test"
    skipIf: "{{ !withTests }}"
  - path: "{{ name }}.stories.ts"  
    template: "stories"
    skipIf: "{{ !withStories }}"

# Advanced injection
injection:
  mode: "smart"          # smart | exact | regex
  target: "// INJECT_HERE"
  strategy: "append"     # append | prepend | replace | merge
  preserveFormatting: true
  addImports: true
  
# Template inheritance
extends: "../base/component.yml"
overrides:
  to: "custom/{{ name }}.ts"

# Validation rules
validate:
  required: ["name", "type"]
  patterns:
    name: "^[A-Z][a-zA-Z0-9]*$"
    type: "^(component|util|service)$"
  custom:
    - rule: "nameNotReserved"
      message: "Name cannot be a reserved keyword"

# Post-processing
postProcess:
  format: true
  lint: true
  commands:
    - "npm run lint:fix {{ outputPath }}"
    - "git add {{ outputPath }}"

# Hooks
hooks:
  beforeRender: ["validateInput", "prepareContext"]
  afterRender: ["formatOutput", "updateImports"]
  beforeWrite: ["checkConflicts", "createBackup"]
  afterWrite: ["runTests", "updateIndex"]

# Metadata
meta:
  author: "{{ author }}"
  created: "{{ now }}"
  generator: "{{ generator }}/{{ template }}"
  version: "{{ templateVersion }}"
---
```

### 2. Frontmatter Processing Engine

```typescript
interface EnhancedFrontmatterEngine {
  parser: FrontmatterParser;
  validator: FrontmatterValidator;
  processor: FrontmatterProcessor;
  executor: FrontmatterExecutor;
  
  parse(content: string): ParsedFrontmatter;
  validate(frontmatter: ParsedFrontmatter): ValidationResult;
  process(frontmatter: ParsedFrontmatter, context: ProcessingContext): ProcessedFrontmatter;
  execute(processed: ProcessedFrontmatter, options: ExecutionOptions): ExecutionResult;
}

interface ParsedFrontmatter extends FrontmatterConfig {
  version: string;
  engine: 'basic' | 'enhanced';
  
  // Enhanced features
  config?: FrontmatterConfigMeta;
  target?: TargetConfig;
  conditions?: ConditionalConfig[];
  outputs?: OutputConfig[];
  injection?: InjectionConfig;
  extends?: string;
  overrides?: Partial<FrontmatterConfig>;
  validate?: ValidationConfig;
  postProcess?: PostProcessConfig;
  hooks?: HookConfig;
  meta?: MetadataConfig;
  
  // Processing metadata
  _metadata: {
    parsed: boolean;
    valid: boolean;
    errors: string[];
    warnings: string[];
    inherited: string[];
    conditionalPaths: string[];
  };
}
```

### 3. Advanced Injection System

```typescript
interface SmartInjectionEngine {
  injectionModes: InjectionMode[];
  strategies: InjectionStrategy[];
  formatters: ContentFormatter[];
  
  analyzeTarget(filePath: string, content: string): InjectionAnalysis;
  planInjection(analysis: InjectionAnalysis, config: InjectionConfig): InjectionPlan;
  executeInjection(plan: InjectionPlan, content: string): InjectionResult;
  
  // Smart injection features
  detectImportSection(content: string): CodeSection;
  detectExportSection(content: string): CodeSection;
  mergeImports(existing: string[], newImports: string[]): string[];
  preserveFormatting(original: string, injected: string): string;
}

interface InjectionConfig {
  mode: 'smart' | 'exact' | 'regex' | 'ast';
  target?: string | RegExp | ASTSelector;
  strategy: 'append' | 'prepend' | 'replace' | 'merge' | 'surround';
  position?: 'before' | 'after' | 'inside';
  preserveFormatting: boolean;
  addImports: boolean;
  deduplicateImports: boolean;
  smartSpacing: boolean;
  
  // Advanced options
  astParsing?: {
    language: 'typescript' | 'javascript' | 'jsx' | 'tsx';
    preserveComments: boolean;
    reformatCode: boolean;
  };
  
  conflict?: {
    detection: 'content' | 'semantic' | 'none';
    resolution: 'error' | 'skip' | 'merge' | 'prompt';
  };
}

interface InjectionPlan {
  operations: InjectionOperation[];
  conflicts: ConflictDetection[];
  backups: BackupPlan[];
  rollback: RollbackPlan;
  
  validate(): ValidationResult;
  preview(): PreviewResult;
  execute(): ExecutionResult;
}
```

### 4. Conditional Processing System

```typescript
interface ConditionalProcessor {
  evaluateConditions(conditions: ConditionalConfig[], context: ProcessingContext): ConditionalResult[];
  resolveConditionalPath(conditions: ConditionalResult[]): ProcessingPath;
  
  // Condition evaluation
  evaluateExpression(expression: string, variables: Record<string, any>): boolean;
  evaluateComplexCondition(condition: ComplexCondition, variables: Record<string, any>): boolean;
  
  // Path resolution
  selectActivePath(paths: ConditionalPath[]): ConditionalPath;
  mergeConditionalConfigs(configs: FrontmatterConfig[]): FrontmatterConfig;
}

interface ConditionalConfig {
  when: string | ComplexCondition;
  then: Partial<FrontmatterConfig>;
  else?: Partial<FrontmatterConfig>;
  priority?: number;
}

interface ComplexCondition {
  and?: string[];
  or?: string[];
  not?: string;
  custom?: {
    function: string;
    params: Record<string, any>;
  };
}

interface ConditionalResult {
  condition: ConditionalConfig;
  matched: boolean;
  config: Partial<FrontmatterConfig>;
  path: string[];
}
```

### 5. Template Inheritance System

```typescript
interface TemplateInheritanceEngine {
  resolveInheritance(frontmatter: ParsedFrontmatter, templatePath: string): Promise<ResolvedFrontmatter>;
  loadParentTemplate(parentPath: string): Promise<ParsedFrontmatter>;
  mergeConfigurations(child: ParsedFrontmatter, parent: ParsedFrontmatter): MergedFrontmatter;
  
  // Inheritance resolution
  resolveInheritanceChain(templatePath: string): Promise<FrontmatterConfig[]>;
  detectCircularInheritance(chain: string[]): boolean;
  
  // Configuration merging
  mergeArrayFields(child: any[], parent: any[]): any[];
  mergeObjectFields(child: Record<string, any>, parent: Record<string, any>): Record<string, any>;
  resolveOverrides(base: FrontmatterConfig, overrides: Partial<FrontmatterConfig>): FrontmatterConfig;
}

interface ResolvedFrontmatter extends ParsedFrontmatter {
  _inheritance: {
    chain: string[];
    merged: boolean;
    overrides: string[];
    conflicts: InheritanceConflict[];
  };
}

interface MergedFrontmatter extends ResolvedFrontmatter {
  _mergeLog: MergeOperation[];
}
```

## Advanced Features

### 1. Multi-Output Generation

```typescript
interface MultiOutputProcessor {
  processOutputs(outputs: OutputConfig[], context: ProcessingContext): Promise<OutputResult[]>;
  generateOutput(output: OutputConfig, context: ProcessingContext): Promise<GeneratedOutput>;
  
  // Output coordination
  coordinateOutputs(outputs: OutputConfig[]): OutputPlan;
  resolveOutputConflicts(conflicts: OutputConflict[]): ConflictResolution;
  validateOutputPaths(outputs: OutputConfig[]): ValidationResult;
}

interface OutputConfig {
  path: string;
  template?: string;        // Use different template section
  content?: string;         // Direct content override
  skipIf?: string;          // Conditional output
  format?: FormatConfig;    // Output-specific formatting
  inject?: InjectionConfig; // Output-specific injection
  postProcess?: string[];   // Output-specific post-processing
}

interface OutputResult {
  output: OutputConfig;
  generated: GeneratedOutput;
  skipped: boolean;
  reason?: string;
  errors: string[];
}
```

### 2. Hook System

```typescript
interface HookSystem {
  registerHook(event: HookEvent, handler: HookHandler): void;
  executeHooks(event: HookEvent, context: HookContext): Promise<HookResult[]>;
  
  // Built-in hooks
  beforeRender(context: RenderContext): Promise<RenderContext>;
  afterRender(context: RenderContext, result: RenderResult): Promise<RenderResult>;
  beforeWrite(context: WriteContext): Promise<WriteContext>;
  afterWrite(context: WriteContext, result: WriteResult): Promise<WriteResult>;
  
  // Custom hooks
  registerCustomHook(name: string, handler: CustomHookHandler): void;
  executeCustomHook(name: string, params: any[]): Promise<any>;
}

type HookEvent = 'beforeRender' | 'afterRender' | 'beforeWrite' | 'afterWrite' | 'onError' | 'onComplete';

interface HookHandler {
  name: string;
  priority: number;
  async: boolean;
  execute(context: HookContext): Promise<HookResult>;
}

interface HookContext {
  event: HookEvent;
  data: any;
  metadata: Record<string, any>;
  template: ParsedFrontmatter;
  variables: Record<string, any>;
}
```

### 3. Advanced Validation

```typescript
interface AdvancedValidator {
  validateFrontmatter(frontmatter: ParsedFrontmatter): ValidationResult;
  validateVariables(variables: Record<string, any>, rules: ValidationConfig): ValidationResult;
  validateOutput(output: GeneratedOutput, config: ValidationConfig): ValidationResult;
  
  // Validation rules
  addValidationRule(name: string, rule: ValidationRule): void;
  executeValidationRule(rule: ValidationRule, value: any, context: ValidationContext): ValidationResult;
  
  // Custom validation
  registerCustomValidator(name: string, validator: CustomValidator): void;
  executeCustomValidation(name: string, value: any, params: any[]): ValidationResult;
}

interface ValidationConfig {
  required?: string[];
  patterns?: Record<string, string | RegExp>;
  ranges?: Record<string, { min?: number; max?: number }>;
  custom?: CustomValidationConfig[];
  
  // Advanced validation
  schema?: JSONSchema;
  dependencies?: DependencyValidation[];
  conflicts?: ConflictValidation[];
}

interface CustomValidationConfig {
  rule: string;
  field?: string;
  message: string;
  params?: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
}
```

## Performance Optimizations

### 1. Frontmatter Caching

```typescript
interface FrontmatterCache {
  parsedCache: Map<string, ParsedFrontmatter>;
  validationCache: Map<string, ValidationResult>;
  inheritanceCache: Map<string, ResolvedFrontmatter>;
  
  getCached(key: string, type: 'parsed' | 'validation' | 'inheritance'): any | null;
  setCached(key: string, type: 'parsed' | 'validation' | 'inheritance', value: any): void;
  invalidate(templatePath: string): void;
  
  // Smart caching
  generateCacheKey(content: string, context: ProcessingContext): string;
  shouldCache(frontmatter: ParsedFrontmatter): boolean;
  cleanupExpired(): void;
}
```

### 2. Lazy Evaluation

```typescript
interface LazyFrontmatterProcessor {
  lazyFields: Set<string>;
  evaluatedFields: Map<string, any>;
  
  markLazy(fieldName: string): void;
  evaluateField(fieldName: string, context: ProcessingContext): Promise<any>;
  evaluateAllLazy(context: ProcessingContext): Promise<Record<string, any>>;
  
  // Lazy evaluation optimization
  shouldEvaluateLazy(field: string, context: ProcessingContext): boolean;
  batchEvaluate(fields: string[], context: ProcessingContext): Promise<Record<string, any>>;
}
```

## Error Handling & Recovery

### 1. Comprehensive Error Handling

```typescript
interface FrontmatterErrorHandler {
  handleParsingError(error: ParsingError, content: string): ErrorRecovery;
  handleValidationError(error: ValidationError, frontmatter: ParsedFrontmatter): ErrorRecovery;
  handleExecutionError(error: ExecutionError, context: ProcessingContext): ErrorRecovery;
  
  // Error recovery strategies
  attemptRecovery(error: FrontmatterError): RecoveryResult;
  fallbackToBasicMode(frontmatter: ParsedFrontmatter): FrontmatterConfig;
  provideErrorGuidance(error: FrontmatterError): string[];
}

interface ErrorRecovery {
  strategy: 'retry' | 'fallback' | 'skip' | 'prompt' | 'abort';
  fallbackValue?: any;
  userGuidance: string[];
  autoFix?: AutoFix;
}

interface AutoFix {
  canFix: boolean;
  fixDescription: string;
  fix(): Promise<any>;
}
```

This architecture provides a comprehensive foundation for enhanced frontmatter processing while maintaining backward compatibility and providing powerful new capabilities for advanced template configuration.