# KGenCLIEngine API Reference

The `KGenCLIEngine` class is the primary interface for all KGEN operations, providing high-level methods for artifact generation, graph processing, validation, and project management.

## Class Overview

```javascript
class KGenCLIEngine {
  constructor()
  async initialize(options = {})
  
  // Graph Operations
  async graphHash(filePath)
  async graphDiff(file1, file2)
  async graphIndex(filePath)
  
  // Artifact Generation
  async artifactGenerate(graphFile, template, options = {})
  
  // Project Management
  async projectLock(directory = '.')
  
  // Template Discovery
  async discoverTemplates(templatesDir, options = {})
  async analyzeTemplate(templateName)
  
  // Rule Discovery
  async discoverRules(rulesDir)
  async analyzeRule(ruleName)
  
  // Configuration
  async loadConfiguration()
}
```

## Constructor

### `new KGenCLIEngine()`

Creates a new KGEN CLI engine instance with default configuration.

```javascript
const kgen = new KGenCLIEngine();
```

**Properties:**
- `version`: KGEN version string ('1.0.0')
- `workingDir`: Current working directory
- `config`: Loaded configuration object
- `debug`: Debug mode flag
- `verbose`: Verbose output flag

## Initialization

### `initialize(options = {})`

Initializes the KGEN engine with configuration and loads all required modules.

**Parameters:**
- `options.debug` (boolean): Enable debug mode
- `options.verbose` (boolean): Enable verbose output
- `options.config` (string): Path to custom configuration file

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  config: Object,
  error?: string
}
```

**Example:**
```javascript
const kgen = new KGenCLIEngine();
const result = await kgen.initialize({ 
  debug: true,
  verbose: true 
});

if (result.success) {
  console.log('KGEN initialized successfully');
  console.log('Configuration:', result.config);
} else {
  console.error('Initialization failed:', result.error);
}
```

**Internal Initialization Process:**
1. Load configuration using c12
2. Initialize deterministic rendering system
3. Initialize artifact generator
4. Initialize drift detector
5. Initialize impact calculator
6. Initialize RDF bridge for semantic processing
7. Set up OpenTelemetry tracing (if enabled)

## Graph Operations

### `graphHash(filePath)`

Generate canonical SHA256 hash of RDF graph with semantic processing.

**Parameters:**
- `filePath` (string): Path to RDF/Turtle file

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  operation: 'graph:hash',
  file: string,
  hash: string,
  size: number,
  algorithm: 'sha256',
  mode?: 'semantic' | 'fallback',
  error?: Object
}
```

**Example:**
```javascript
const result = await kgen.graphHash('knowledge/domain.ttl');

if (result.success) {
  console.log(`Graph hash: ${result.hash}`);
  console.log(`File size: ${result.size} bytes`);
  console.log(`Processing mode: ${result.mode || 'semantic'}`);
} else {
  console.error('Hashing failed:', result.error);
}
```

**Semantic vs Fallback Processing:**
- **Semantic Mode**: Uses enhanced RDF processing with canonical serialization
- **Fallback Mode**: Simple file content hashing when semantic processing unavailable

### `graphDiff(file1, file2)`

Compare two RDF graphs and analyze semantic differences with impact assessment.

**Parameters:**
- `file1` (string): Path to first graph file
- `file2` (string): Path to second graph file

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  operation: 'graph:diff',
  file1: string,
  file2: string,
  summary: {
    added: number,
    removed: number,
    changedSubjects: number
  },
  changes: {
    added: Array,
    removed: Array,
    changedSubjects: Set
  },
  impactScore: {
    overall: number
  },
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
  },
  blastRadius: {
    maxRadius: number
  },
  recommendations: Array<string>
}
```

**Example:**
```javascript
const diff = await kgen.graphDiff('baseline.ttl', 'current.ttl');

console.log(`Changes: +${diff.summary.added} -${diff.summary.removed}`);
console.log(`Impact score: ${diff.impactScore.overall}`);
console.log(`Risk level: ${diff.riskAssessment.level}`);

diff.recommendations.forEach(rec => {
  console.log(`Recommendation: ${rec}`);
});
```

### `graphIndex(filePath)`

Build searchable index of RDF graph triples with statistical analysis.

**Parameters:**
- `filePath` (string): Path to RDF/Turtle file

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  operation: 'graph:index',
  file: string,
  triples: number,
  subjects: number,
  predicates: number,
  objects: number,
  index: {
    subjects: Array<string>,
    predicates: Array<string>,
    objects: Array<string>
  },
  statistics?: {
    literals: number,
    uris: number,
    blankNodes: number
  }
}
```

**Example:**
```javascript
const index = await kgen.graphIndex('knowledge/large-graph.ttl');

console.log(`Indexed ${index.triples} triples`);
console.log(`Subjects: ${index.subjects}, Predicates: ${index.predicates}`);
console.log('Top subjects:', index.index.subjects.slice(0, 5));

if (index.statistics) {
  console.log(`Literals: ${index.statistics.literals}`);
  console.log(`URIs: ${index.statistics.uris}`);
}
```

## Artifact Generation

### `artifactGenerate(graphFile, template, options = {})`

Generate deterministic artifacts from knowledge graphs with complete provenance.

**Parameters:**
- `graphFile` (string): Path to RDF knowledge graph
- `template` (string): Template name or path
- `options.output` (string): Output directory
- `options.debug` (boolean): Enable debug mode
- `options.verbose` (boolean): Enable verbose output

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  operation: 'artifact:generate',
  graph: string,
  template: string,
  templatePath: string,
  outputPath: string,
  contentHash: string,
  attestationPath: string,
  context: Array<string>,
  timestamp: string,
  error?: string
}
```

**Example:**
```javascript
const result = await kgen.artifactGenerate(
  'knowledge/api-spec.ttl',
  'rest-api',
  { 
    output: 'generated/',
    debug: true 
  }
);

if (result.success) {
  console.log(`Generated: ${result.outputPath}`);
  console.log(`Content hash: ${result.contentHash}`);
  console.log(`Attestation: ${result.attestationPath}`);
  console.log(`Context keys: ${result.context.join(', ')}`);
} else {
  console.error('Generation failed:', result.error);
}
```

**Context Enrichment Process:**
1. Load and parse RDF knowledge graph
2. Apply reasoning rules (if available)
3. Extract template context variables
4. Add environment and provenance metadata
5. Render template with deterministic settings
6. Generate cryptographic attestation

## Project Management

### `projectLock(directory = '.')`

Generate lockfile for reproducible builds by hashing all RDF files.

**Parameters:**
- `directory` (string): Project directory to scan

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  operation: 'project:lock',
  lockfile: string,
  filesHashed: number,
  rdfFiles: number,
  timestamp: string,
  error?: string
}
```

**Example:**
```javascript
const lockResult = await kgen.projectLock('./my-project');

if (lockResult.success) {
  console.log(`Created lockfile: ${lockResult.lockfile}`);
  console.log(`Hashed ${lockResult.filesHashed} files`);
  console.log(`Found ${lockResult.rdfFiles} RDF files`);
} else {
  console.error('Lock generation failed:', lockResult.error);
}
```

**Lockfile Contents:**
```json
{
  "version": "1.0.0",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "directory": "./my-project",
  "files": {
    "knowledge/domain.ttl": {
      "hash": "sha256:abc123...",
      "size": 2048,
      "modified": "2024-12-01T11:30:00.000Z"
    }
  }
}
```

## Template Discovery

### `discoverTemplates(templatesDir, options = {})`

Discover and analyze available templates in the specified directory.

**Parameters:**
- `templatesDir` (string): Templates directory path
- `options.verbose` (boolean): Include detailed analysis

**Returns:** Promise<Array>
```javascript
[
  {
    name: string,
    path: string,
    size: number,
    modified: string,
    frontmatter?: Object,
    variables?: Array<string>,
    error?: string
  }
]
```

**Example:**
```javascript
const templates = await kgen.discoverTemplates('_templates', { 
  verbose: true 
});

templates.forEach(template => {
  console.log(`Template: ${template.name}`);
  console.log(`Path: ${template.path}`);
  console.log(`Variables: ${template.variables?.join(', ') || 'none'}`);
  
  if (template.frontmatter) {
    console.log('Frontmatter:', template.frontmatter);
  }
});
```

### `analyzeTemplate(templateName)`

Perform detailed analysis of a specific template.

**Parameters:**
- `templateName` (string): Name of template to analyze

**Returns:** Promise<Object>
```javascript
{
  name: string,
  path: string,
  frontmatter: Object,
  variables: Array<string>,
  structure: {
    blocks: Array<string>,
    includes: Array<string>,
    macros: Array<string>,
    complexity: number
  },
  size: number,
  lines: number,
  modified: string
}
```

**Example:**
```javascript
const analysis = await kgen.analyzeTemplate('rest-api');

console.log(`Template: ${analysis.name}`);
console.log(`Variables: ${analysis.variables.join(', ')}`);
console.log(`Complexity: ${analysis.structure.complexity}`);
console.log(`Includes: ${analysis.structure.includes.join(', ')}`);

if (analysis.structure.blocks.length > 0) {
  console.log(`Blocks: ${analysis.structure.blocks.join(', ')}`);
}
```

## Rule Discovery

### `discoverRules(rulesDir)`

Discover SHACL shapes and N3 reasoning rules in the specified directory.

**Parameters:**
- `rulesDir` (string): Rules directory path

**Returns:** Promise<Array>
```javascript
[
  {
    name: string,
    path: string,
    type: 'ttl' | 'n3' | 'rules',
    size: number,
    modified: string,
    relativePath: string
  }
]
```

**Example:**
```javascript
const rules = await kgen.discoverRules('./rules');

rules.forEach(rule => {
  console.log(`Rule: ${rule.name} (${rule.type})`);
  console.log(`Path: ${rule.relativePath}`);
  console.log(`Size: ${rule.size} bytes`);
});
```

### `analyzeRule(ruleName)`

Perform detailed analysis of a specific rule file.

**Parameters:**
- `ruleName` (string): Name of rule to analyze

**Returns:** Promise<Object>
```javascript
{
  name: string,
  path: string,
  type: string,
  content: string,
  size: number,
  lines: number,
  ruleCount: number,
  prefixes: Array<{prefix: string, uri: string}>,
  modified: string
}
```

**Example:**
```javascript
const ruleAnalysis = await kgen.analyzeRule('api-constraints');

console.log(`Rule: ${ruleAnalysis.name}`);
console.log(`Type: ${ruleAnalysis.type}`);
console.log(`Lines: ${ruleAnalysis.lines}`);
console.log(`Rule count: ${ruleAnalysis.ruleCount}`);

ruleAnalysis.prefixes.forEach(prefix => {
  console.log(`@prefix ${prefix.prefix}: <${prefix.uri}>`);
});
```

## Configuration Management

### `loadConfiguration()`

Load KGEN configuration using c12 with layered defaults.

**Returns:** Promise<Object>
```javascript
{
  directories: {
    out: string,
    state: string,
    cache: string,
    templates: string,
    rules: string,
    knowledge: string
  },
  generate: {
    defaultTemplate: string,
    attestByDefault: boolean,
    enableContentAddressing: boolean,
    staticBuildTime: string,
    enableSemanticEnrichment: boolean
  },
  drift: {
    onDrift: 'fail' | 'warn' | 'ignore',
    exitCode: number,
    tolerance: number
  },
  validation: {
    strictMode: boolean,
    enablePolicyEnforcement: boolean
  }
}
```

**Example:**
```javascript
const config = await kgen.loadConfiguration();

console.log('Output directory:', config.directories.out);
console.log('Default template:', config.generate.defaultTemplate);
console.log('Attestations enabled:', config.generate.attestByDefault);
console.log('Drift tolerance:', config.drift.tolerance);
```

**Configuration Sources (in precedence order):**
1. Command line arguments
2. Environment variables (KGEN_*)
3. kgen.config.js/ts
4. kgen.config.json
5. Default values

## Error Handling

### Error Response Format
All methods return standardized error responses:

```javascript
{
  success: false,
  operation: string,
  error: {
    code: string,
    message: string,
    details?: Object
  },
  timestamp: string
}
```

### Common Error Codes
- `INITIALIZATION_FAILED`: Engine initialization error
- `FILE_NOT_FOUND`: Input file does not exist
- `TEMPLATE_NOT_FOUND`: Specified template not available
- `VALIDATION_ERROR`: SHACL constraint violation
- `GENERATION_FAILED`: Artifact generation failure
- `CONFIGURATION_ERROR`: Invalid configuration

### Error Handling Example
```javascript
try {
  const result = await kgen.artifactGenerate(
    'nonexistent.ttl',
    'invalid-template'
  );
  
  if (!result.success) {
    console.error(`Error ${result.error.code}: ${result.error.message}`);
    if (result.error.details) {
      console.error('Details:', result.error.details);
    }
  }
} catch (error) {
  console.error('Unexpected error:', error.message);
}
```

## Performance Considerations

### Initialization Optimization
- Lazy loading of heavy dependencies
- Conditional module imports based on feature usage
- Cached configuration parsing

### Memory Management
- Automatic cleanup of large RDF graphs after processing
- Template compilation caching
- LRU eviction for validation results

### Concurrent Operations
```javascript
// Process multiple graphs in parallel
const results = await Promise.all([
  kgen.graphHash('graph1.ttl'),
  kgen.graphHash('graph2.ttl'),
  kgen.graphHash('graph3.ttl')
]);

// Generate multiple artifacts concurrently
const generations = await Promise.all([
  kgen.artifactGenerate('api.ttl', 'typescript'),
  kgen.artifactGenerate('schema.ttl', 'json-schema'),
  kgen.artifactGenerate('docs.ttl', 'markdown')
]);
```

## Integration Examples

### CI/CD Pipeline Integration
```javascript
import { KGenCLIEngine } from 'kgen';

async function cicdPipeline() {
  const kgen = new KGenCLIEngine();
  
  // Initialize with CI environment
  await kgen.initialize({
    debug: process.env.CI_DEBUG === 'true',
    verbose: process.env.CI_VERBOSE === 'true'
  });
  
  // Lock dependencies
  const lockResult = await kgen.projectLock();
  if (!lockResult.success) {
    throw new Error('Failed to create project lock');
  }
  
  // Generate all artifacts
  const templates = await kgen.discoverTemplates('_templates');
  const results = [];
  
  for (const template of templates) {
    const result = await kgen.artifactGenerate(
      process.env.KNOWLEDGE_GRAPH,
      template.name,
      { output: 'dist/' }
    );
    results.push(result);
  }
  
  // Verify all generations succeeded
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    throw new Error(`${failed.length} generations failed`);
  }
  
  console.log(`Successfully generated ${results.length} artifacts`);
}
```

### Custom Plugin Integration
```javascript
class MetricsPlugin {
  constructor(kgen) {
    this.kgen = kgen;
    this.metrics = new Map();
  }
  
  async beforeGenerate(context) {
    this.startTime = performance.now();
    return context;
  }
  
  async afterGenerate(result) {
    const duration = performance.now() - this.startTime;
    this.metrics.set(result.outputPath, duration);
    return result;
  }
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

// Usage
const kgen = new KGenCLIEngine();
const plugin = new MetricsPlugin(kgen);
kgen.registerPlugin(plugin);
```

The KGenCLIEngine provides a comprehensive, high-level interface to all KGEN functionality while maintaining performance and reliability through careful error handling and resource management.