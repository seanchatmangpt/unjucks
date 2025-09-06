# Turtle Data Flow Architecture Diagram

## System Overview

```mermaid
graph TD
    A[CLI Command] --> B[Argument Parser]
    C[Frontmatter] --> D[Frontmatter Parser]
    
    B --> E[TurtleDataSource[]]
    D --> E
    
    E --> F[TurtleParser.parseFile()]
    F --> G[N3.js Parser]
    G --> H[RDFContext]
    
    H --> I[RDFContextBuilder]
    I --> J[Template Variables]
    
    J --> K[Generator.nunjucksEnv]
    K --> L[Rendered Content]
    
    L --> M[FileInjector]
    M --> N[Output Files]
    
    style G fill:#e1f5fe
    style H fill:#f3e5f5
    style J fill:#e8f5e8
```

## Detailed Component Interaction

### 1. Input Processing
```mermaid
sequenceDiagram
    participant CLI
    participant ArgParser
    participant FrontmatterParser
    participant TurtleDataSource
    
    CLI->>ArgParser: --turtle-data schema.ttl
    CLI->>ArgParser: --turtle-namespace schema
    CLI->>ArgParser: --turtle-query "?s a schema:Person"
    
    Note over ArgParser: Parse CLI arguments
    ArgParser->>TurtleDataSource: Create data source
    
    FrontmatterParser->>TurtleDataSource: turtle_data: ./schema.ttl
    FrontmatterParser->>TurtleDataSource: turtle_namespace: schema
    FrontmatterParser->>TurtleDataSource: turtle_query: "?s a schema:Person"
```

### 2. RDF Processing Pipeline
```mermaid
flowchart LR
    A[Turtle File] --> B[TurtleParser]
    B --> C[N3.js Stream]
    C --> D[Triple Stream]
    D --> E[RDFContext Builder]
    E --> F[Indexed Context]
    
    F --> G[Subject Index]
    F --> H[Predicate Index] 
    F --> I[Object Index]
    F --> J[Namespace Map]
    
    G --> K[Template Context]
    H --> K
    I --> K
    J --> K
    
    style C fill:#e1f5fe
    style F fill:#f3e5f5
    style K fill:#e8f5e8
```

### 3. Template Context Integration
```mermaid
graph TB
    A[Existing Variables] --> D[Merged Context]
    B[RDF Context] --> D
    C[CLI Arguments] --> D
    
    B --> E[rdf.subjects]
    B --> F[rdf.predicates]
    B --> G[rdf.namespaces]
    B --> H[rdf.query()]
    
    E --> I[{{ rdf.schema.subjects }}]
    F --> J[{{ rdf.schema.predicates }}]
    G --> K[{{ rdf.schema.namespaces.foaf }}]
    H --> L[{{ rdf.schema.query('?s a foaf:Person') }}]
    
    style D fill:#fff3e0
    style B fill:#f3e5f5
```

## Data Structure Details

### RDFContext Structure
```javascript
{
  triples: [
    {
      subject: { termType: 'NamedNode', value: 'http://example.org/person1' },
      predicate: { termType: 'NamedNode', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
      object: { termType: 'NamedNode', value: 'http://xmlns.com/foaf/0.1/Person' }
    }
  ],
  subjects: Map {
    'http://example.org/person1' => [Triple, ...]
  },
  predicates: Map {
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' => [Triple, ...]
  },
  objects: Map {
    'http://xmlns.com/foaf/0.1/Person' => [Triple, ...]
  },
  namespaces: Map {
    'foaf' => 'http://xmlns.com/foaf/0.1/',
    'schema' => 'https://schema.org/'
  }
}
```

### Template Context Integration
```javascript
{
  // Existing template variables
  name: "UserService",
  withTests: true,
  
  // New RDF context (namespaced)
  rdf: {
    schema: {
      subjects: [...],
      by_type: {
        "schema:Person": [...],
        "schema:Organization": [...]
      },
      query: (pattern) => [...],
      namespaces: {
        foaf: "http://xmlns.com/foaf/0.1/",
        schema: "https://schema.org/"
      }
    }
  }
}
```

## Performance Optimization Flow

### Caching Strategy
```mermaid
graph LR
    A[File Request] --> B{Cache Check}
    B -->|Hit| C[Cached RDFContext]
    B -->|Miss| D[Parse File]
    D --> E[Store in Cache]
    E --> F[Return RDFContext]
    C --> G[Template Processing]
    F --> G
    
    G --> H{Query Cache}
    H -->|Hit| I[Cached Results]
    H -->|Miss| J[Execute Query]
    J --> K[Store Query Result]
    K --> L[Return Results]
    I --> M[Template Rendering]
    L --> M
    
    style B fill:#e1f5fe
    style H fill:#e1f5fe
    style C fill:#c8e6c9
    style I fill:#c8e6c9
```

### Memory Management
```mermaid
flowchart TD
    A[Large Turtle File] --> B[Streaming Parser]
    B --> C[Chunk Processing]
    C --> D[Memory Pool]
    D --> E[Triple Objects]
    E --> F[Index Building]
    F --> G[Lazy Loading]
    
    H[Memory Monitor] --> I{Memory Threshold}
    I -->|High| J[Trigger GC]
    I -->|Normal| K[Continue Processing]
    
    J --> L[Clear Unused Caches]
    L --> M[Free Memory Pool]
    
    style B fill:#e1f5fe
    style D fill:#fff3e0
    style H fill:#ffcdd2
```

## Error Handling Flow

### Graceful Degradation
```mermaid
graph TD
    A[Parse Turtle File] --> B{Parse Success?}
    B -->|Yes| C[Build RDF Context]
    B -->|No| D[Log Warning]
    D --> E[Empty RDF Context]
    E --> F[Continue Generation]
    C --> F
    
    F --> G[Template Rendering]
    G --> H{RDF Variables Used?}
    H -->|Yes| I[Inject RDF Context]
    H -->|No| J[Skip RDF Processing]
    
    I --> K{Context Available?}
    K -->|Yes| L[Render with RDF]
    K -->|No| M[Render with Defaults]
    
    L --> N[Success]
    M --> N
    J --> N
    
    style D fill:#ffcdd2
    style E fill:#fff3e0
    style M fill:#fff3e0
```

## Integration Points Summary

1. **CLI Extension**: New `--turtle-*` arguments
2. **Frontmatter Extension**: New `turtle_*` properties
3. **Context Extension**: New `rdf.*` template variables
4. **Filter Extension**: New Nunjucks filters for RDF data
5. **Caching Extension**: New cache layers for RDF data
6. **Error Extension**: New error types and handling for RDF parsing

This architecture ensures that RDF integration is seamless while maintaining backward compatibility and performance.