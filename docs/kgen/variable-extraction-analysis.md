# Variable Extraction and Injection Analysis

*Comprehensive analysis of template variable extraction and injection systems in Unjucks*

## Executive Summary

The Unjucks codebase implements a sophisticated template variable extraction and injection system that supports multiple template syntaxes, intelligent type inference, validation, and secure injection mechanisms. The system is designed for robust document generation and template processing across various formats including Office documents, text files, and web templates.

## Core Components

### 1. Variable Extraction Systems

#### 1.1 Main Variable Extractor (`src/office/utils/variable-extractor.js`)

**Capabilities:**
- **Multi-syntax Support**: Handles 7+ template syntaxes
  - Handlebars/Mustache: `{{variable}}`
  - Single brace: `{variable}`
  - Template literals: `${variable}`
  - Angular: `<variable>`
  - PHP-style: `<?= $variable ?>`
  - ERB-style: `<%= variable %>`
  - Jinja2/Django: `{{ variable }}`

**Advanced Features:**
- **Complex Expression Parsing**: 
  - Object notation: `{{user.profile.name}}`
  - Array access: `{{items[0].data}}`
  - Variable indices: `{{items[index]}` with dependency tracking
  - Nested paths: `{{users[0].profile.settings["theme"].color}}`

- **Template Construct Detection**:
  - Loop variables: `{{#each items}}` with iterator extraction
  - Conditional variables: `{{#if condition}}` with expression parsing
  - Filter chains: `{{price|currency|round:2}}` with parameter dependencies
  - Helper functions with complex parameter analysis

**Architecture:**
```javascript
class VariableExtractor {
  // Multi-pattern syntax definitions
  syntaxDefinitions = Map<string, SyntaxDefinition>
  customSyntax = Map<string, CustomSyntaxDefinition>
  
  // Core extraction methods
  extract(content) → ExtractionResult
  extractByType(content, type) → VariableInfo[]
  getDependencies(content, variableName) → string[]
  
  // Analysis capabilities  
  validateVariables(variables) → ValidationResult
  generateDocumentation(result, options) → string
  calculateComplexity(variable) → number
}
```

#### 1.2 TypeScript Variable Extractor (`src/office/utils/variable-extractor.ts`)

**Document-Specific Extraction:**
- **Word Documents**: Paragraphs, headers, footers, tables, bookmarks
- **Excel Documents**: Worksheets, cells, named ranges, formulas
- **PowerPoint Documents**: Slides, text boxes, speaker notes, placeholders

**Type Inference Engine:**
```typescript
inferVariableType(name: string, locations: VariableLocation[]): TemplateVariable['type'] {
  // Pattern-based inference:
  // - Date/time patterns
  // - Numeric patterns  
  // - Boolean patterns
  // - Collection patterns
  // - Object patterns
}
```

#### 1.3 Template Engine Variable Extraction (`src/templates/template-engine.js`)

**Nunjucks Integration:**
- **Enhanced Variable Detection**: Complex expressions with filters
- **Control Flow Parsing**: For loops, conditionals with variable extraction
- **Filter Parameter Analysis**: Dependencies from filter arguments
- **Reserved Word Filtering**: Excludes template engine reserved words

### 2. Variable Pattern Matching

#### 2.1 Syntax Pattern Definitions

```javascript
const SYNTAX_PATTERNS = {
  [VariableSyntax.NUNJUCKS]: {
    simple: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}\}/g,
    complex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|\s*([^}]+?))?\s*\}\}/g,
    filters: /\|\s*([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s*\(([^)]*)\))?/g
  },
  [VariableSyntax.SIMPLE]: {
    simple: /\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}/g
  },
  // Additional patterns for 5+ other syntaxes...
}
```

#### 2.2 Variable Path Parsing

**Nested Object Access:**
```javascript
_splitVariablePath(path) {
  // Handles complex cases:
  // - Dot notation: user.profile.name
  // - Array access: items[0], items["key"]
  // - Mixed notation: user.items[index].data
  // - Quoted keys: settings["theme-color"]
}
```

**Dependency Resolution:**
- Tracks variable dependencies for array indices
- Identifies filter parameter dependencies
- Maps conditional expression variables
- Builds comprehensive dependency graphs

### 3. Variable Injection Systems

#### 3.1 Injection Validator (`src/office/utils/injection-validator.js`)

**Validation Layers:**
- **Configuration Validation**: Structure, required fields, data types
- **Target Validation**: Location formats for different document types
- **Content Safety**: XSS prevention, script detection, size limits
- **Permission Validation**: File access, write permissions, backup capability
- **Format-Specific Validation**: Word/Excel/PowerPoint injection targets

**Security Features:**
```javascript
validateContentSafety(content) {
  const dangerousPatterns = [
    { pattern: /<script[^>]*>/i, message: 'Contains script tags' },
    { pattern: /javascript:/i, message: 'Contains JavaScript protocol' },
    { pattern: /on\w+\s*=/i, message: 'Contains event handlers' }
  ];
}
```

#### 3.2 Injection Command (`src/commands/inject.js`)

**Injection Modes:**
- `before`: Inject before target content
- `after`: Inject after target content  
- `append`: Add to end of file
- `prepend`: Add to beginning of file
- `lineAt`: Insert at specific line number
- `replace`: Replace target content

**Template Integration:**
```javascript
// Template-based injection with variable substitution
const templateVariables = extractCommandLineVariables(args);
const result = await generator.generate({
  generator: args.generator,
  template: args.template,
  variables: templateVariables
});
contentToInject = result.files[0].content;
```

**Idempotent Operations:**
```javascript
// Automatic skipIf generation for avoiding duplicates
if (!args.force) {
  frontmatterConfig.skipIf = `content.includes('${contentToInject.trim()}')`;
}
```

### 4. Type Inference and Validation

#### 4.1 Type Inference Algorithms

**Name-Based Inference:**
```javascript
inferVariableType(name, locations) {
  const lowerName = name.toLowerCase();
  
  // Pattern matching for type detection:
  if (lowerName.includes('date') || lowerName.includes('time')) return 'date';
  if (lowerName.includes('count') || lowerName.includes('amount')) return 'number';
  if (lowerName.includes('is') || lowerName.includes('has')) return 'boolean';
  if (lowerName.includes('list') || lowerName.includes('items')) return 'array';
  if (lowerName.includes('config') || lowerName.includes('data')) return 'object';
  
  return 'string'; // Default fallback
}
```

**Context-Based Analysis:**
- **Usage Patterns**: Variables in headers/titles marked as required
- **Frequency Analysis**: Multiple usage indicates importance
- **Location Context**: Document section influences type inference

#### 4.2 Validation Framework

```typescript
validateVariables(variables: TemplateVariable[], data: Record<string, any>): ValidationResult {
  // Multi-layer validation:
  // 1. Required field validation
  // 2. Type compatibility checking
  // 3. Custom validation rules
  // 4. Unused variable detection
  // 5. Constraint validation (min/max, patterns, enums)
}
```

### 5. Variable Scoping and Context

#### 5.1 Nested Variable Access

**Dot Notation Processing:**
```javascript
getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}
```

**Scope Resolution:**
- **Local Scope**: Loop variables, conditional contexts
- **Global Scope**: Document-level variables
- **Parameter Scope**: Filter and helper parameters
- **Template Scope**: Inherited from base templates

#### 5.2 Variable Replacement Engine

**Multi-Strategy Replacement:**
```javascript
replaceVariables(content, data) {
  return content.replace(pattern, (match, variableName) => {
    const value = this.getNestedValue(data, variableName);
    
    if (value === undefined || value === null) {
      return match; // Preserve original if no replacement
    }
    
    // Type-aware conversion
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  });
}
```

### 6. Debugging and Analysis Tools

#### 6.1 Documentation Generation

**Multi-Format Output:**
- **Markdown**: Human-readable documentation with examples
- **JSON**: Machine-readable structured data
- **HTML**: Interactive documentation with styling

**Documentation Features:**
```javascript
generateDocumentation(result, options) {
  // Includes:
  // - Variable summary statistics
  // - Grouping by type and complexity
  // - Dependency graph visualization
  // - Location mapping with line numbers
  // - Validation results and warnings
}
```

#### 6.2 Complexity Analysis

**Complexity Scoring:**
```javascript
_calculateVariableComplexity(variable) {
  let score = 1; // Base score
  
  // Nested paths add complexity
  if (variable.metadata?.parts) {
    score += variable.metadata.parts.length - 1;
  }
  
  // Dependencies increase complexity
  score += variable.dependencies.length;
  
  // Filters add processing complexity
  if (variable.type === 'filter' && variable.metadata.filters) {
    score += variable.metadata.filters.length;
  }
  
  // Control structures are inherently complex
  if (['conditional', 'loop'].includes(variable.type)) {
    score += 2;
  }
  
  return score;
}
```

### 7. Security and Validation

#### 7.1 Input Sanitization

**Content Safety Validation:**
- **Script Detection**: Identifies potentially dangerous script tags
- **Protocol Validation**: Blocks javascript:, vbscript: protocols  
- **Event Handler Detection**: Prevents event attribute injection
- **Template Expression Scanning**: Validates template syntax safety

#### 7.2 Variable Name Validation

**Security Constraints:**
```javascript
_validateVariableName(variable) {
  // Security checks:
  // 1. Valid identifier format
  // 2. Reserved word detection
  // 3. Length limits (prevent DoS)
  // 4. Character set restrictions
  // 5. Naming convention compliance
}
```

### 8. Performance Characteristics

#### 8.1 Optimization Strategies

**Efficient Pattern Matching:**
- **Regex Optimization**: Pre-compiled patterns with lastIndex management
- **Deduplication**: Set-based duplicate removal during extraction
- **Lazy Evaluation**: On-demand analysis for complex features

**Performance Metrics:**
```javascript
// Performance test results from test suite:
// - Large template processing: <1000ms for 1000 variables
// - Memory efficiency: Constant space complexity
// - Regex performance: Optimized for large documents
```

#### 8.2 Scalability Features

- **Streaming Processing**: Can handle large documents incrementally
- **Memory Management**: Efficient storage with Map-based grouping
- **Batch Processing**: Support for multiple documents simultaneously

### 9. Integration Patterns

#### 9.1 Template Engine Integration

**Nunjucks Filter System:**
```javascript
// Custom filters for document formatting
env.addFilter('dateFormat', (date, format) => { /* ... */ });
env.addFilter('currency', (amount, currency) => { /* ... */ });
env.addFilter('legalNumber', (index, style) => { /* ... */ });
```

#### 9.2 Office Document Integration

**Format-Specific Processing:**
- **Word (.docx)**: Paragraph, table, bookmark injection
- **Excel (.xlsx)**: Cell, range, worksheet manipulation  
- **PowerPoint (.pptx)**: Slide, placeholder, text box modification

### 10. Error Handling and Recovery

#### 10.1 Graceful Degradation

```javascript
// Malformed template handling
try {
  const variables = definition.extractor(match, content, lineNumber, column);
  // Process normally
} catch (error) {
  result.errors.push(`Error parsing line ${lineIndex + 1}: ${error.message}`);
  // Continue processing other matches
}
```

#### 10.2 Validation Error Management

- **Progressive Validation**: Continues processing despite individual failures
- **Detailed Error Messages**: Specific location and context information
- **Warning vs Error Classification**: Distinguishes severity levels
- **Recovery Suggestions**: Provides actionable guidance for fixes

## Recommendations

### 1. Performance Enhancements

- **Implement Variable Caching**: Cache parsed variable information for repeated processing
- **Add Streaming Support**: Process very large documents without full memory loading
- **Optimize Regex Patterns**: Further optimize commonly used patterns for speed

### 2. Security Improvements

- **Enhanced XSS Prevention**: Add more sophisticated content analysis
- **Template Sandbox**: Implement sandboxed execution for custom expressions
- **Audit Logging**: Track variable extraction and injection operations

### 3. Feature Extensions

- **Custom Type Inference**: Allow user-defined type inference rules
- **Variable Transformation**: Support for variable preprocessing and transformation
- **Interactive Debugging**: Add debug mode with step-by-step execution

### 4. Documentation and Testing

- **Integration Tests**: Add more comprehensive end-to-end testing scenarios
- **Performance Benchmarks**: Establish baseline performance metrics
- **API Documentation**: Complete TypeScript type definitions for all interfaces

## Conclusion

The Unjucks variable extraction and injection system demonstrates sophisticated template processing capabilities with strong security, performance, and extensibility characteristics. The multi-layered architecture supports complex document generation workflows while maintaining code quality and reliability standards.

The system successfully balances flexibility with security, providing powerful template processing capabilities while preventing common security vulnerabilities through comprehensive validation and sanitization mechanisms.