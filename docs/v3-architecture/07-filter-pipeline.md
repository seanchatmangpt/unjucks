# Filter Pipeline Architecture

The Unjucks filter system provides 65+ filters organized into functional categories with powerful chaining and composition capabilities.

## Pipeline Overview

```mermaid
flowchart LR
    subgraph "Input"
        VAR[Template Variable]
        CTX[Context Data]
        ENV[Environment]
    end
    
    subgraph "Core Processing"
        PARSE[Parse Input]
        VALIDATE[Validate Type]
        CHAIN[Chain Filters]
    end
    
    subgraph "Filter Categories"
        BASIC[Basic Filters]
        RDF[RDF/Semantic]
        LATEX[LaTeX/Academic]
        ADVANCED[Advanced]
    end
    
    subgraph "Output"
        RESULT[Processed Value]
        CACHE[Cache Result]
    end
    
    VAR --> PARSE
    CTX --> PARSE
    ENV --> PARSE
    
    PARSE --> VALIDATE
    VALIDATE --> CHAIN
    
    CHAIN --> BASIC
    CHAIN --> RDF
    CHAIN --> LATEX
    CHAIN --> ADVANCED
    
    BASIC --> RESULT
    RDF --> RESULT
    LATEX --> RESULT
    ADVANCED --> RESULT
    
    RESULT --> CACHE
```

## Filter Categories

### 1. Basic String Filters

```mermaid
flowchart TD
    subgraph "Case Transforms"
        PC[pascalCase]
        CC[camelCase]
        KC[kebabCase]
        SC[snakeCase]
        UC[upperCase]
        LC[lowerCase]
        TC[titleCase]
        CC2[constantCase]
    end
    
    subgraph "String Operations"
        CAP[capitalize]
        SLUG[slug]
        HUMAN[humanize]
        TRIM[trim]
        PAD[pad]
        TRUNC[truncate]
        REP[replace]
        STRIP[stripTags]
    end
    
    subgraph "Formatting"
        WRAP[wrap]
        INDENT[indent]
        ESC[escape]
        UESC[unescape]
        QUOTE[quote]
        UNQUOTE[unquote]
    end
```

**Usage Examples:**
```jinja2
{{ "hello world" | pascalCase }}           <!-- HelloWorld -->
{{ "some-long-text" | kebabCase }}         <!-- some-long-text -->
{{ "user_name" | humanize }}               <!-- User Name -->
{{ "  spaced  " | trim }}                  <!-- spaced -->
{{ "text" | pad(10, "0") }}                <!-- 000text000 -->
```

### 2. Date & Time Filters

```mermaid
flowchart LR
    subgraph "Date Input"
        ISO[ISO String]
        UNIX[Unix Timestamp]
        DATE_OBJ[Date Object]
    end
    
    subgraph "Date Filters"
        FMT[dateFormat]
        REL[fromNow]
        TZ[timezone]
        ADD[addDays]
        SUB[subtractDays]
        START[startOf]
        END[endOf]
    end
    
    subgraph "Output Formats"
        HUMAN_DATE[Human Readable]
        ISO_OUT[ISO Format]
        CUSTOM[Custom Format]
        RELATIVE[Relative Time]
    end
    
    ISO --> FMT
    UNIX --> REL
    DATE_OBJ --> TZ
    
    FMT --> HUMAN_DATE
    REL --> RELATIVE
    TZ --> CUSTOM
```

**Usage Examples:**
```jinja2
{{ "2023-12-25" | dateFormat("MMMM Do, YYYY") }}     <!-- December 25th, 2023 -->
{{ "2023-01-01" | fromNow }}                         <!-- 10 months ago -->
{{ date | timezone("America/New_York") }}            <!-- Eastern time -->
{{ date | addDays(7) | dateFormat("YYYY-MM-DD") }}   <!-- Add week -->
```

### 3. Collection Filters

```mermaid
flowchart TD
    subgraph "Array Operations"
        SORT[sort]
        FILTER[filter]
        MAP[map]
        REDUCE[reduce]
        UNIQ[unique]
        FLAT[flatten]
        CHUNK[chunk]
        ZIP[zip]
    end
    
    subgraph "Object Operations"
        KEYS[keys]
        VALUES[values]
        PAIRS[pairs]
        MERGE[merge]
        PICK[pick]
        OMIT[omit]
        GROUP[groupBy]
    end
    
    subgraph "Utility"
        LEN[length]
        FIRST[first]
        LAST[last]
        SLICE[slice]
        REVERSE[reverse]
        SHUFFLE[shuffle]
    end
```

**Usage Examples:**
```jinja2
{{ users | sort('name') }}                          <!-- Sort by name -->
{{ items | filter('active') }}                      <!-- Filter active -->
{{ numbers | map('multiply', 2) }}                  <!-- Double all -->
{{ data | groupBy('category') }}                    <!-- Group by field -->
{{ array | unique | sort }}                         <!-- Chain operations -->
```

### 4. RDF/Semantic Filters

```mermaid
flowchart LR
    subgraph "RDF Input"
        URI[RDF URI]
        GRAPH[RDF Graph]
        TRIPLE[RDF Triple]
    end
    
    subgraph "RDF Operations"
        LABEL[rdfLabel]
        TYPE[rdfType]
        PROP[rdfProperties]
        NS[rdfNamespace]
        QUERY[rdfQuery]
        DESCRIBE[rdfDescribe]
        CONSTRUCT[rdfConstruct]
        SELECT[rdfSelect]
    end
    
    subgraph "Semantic Output"
        HUMAN_LABEL[Human Label]
        TYPE_INFO[Type Information]
        PROPS[Property List]
        NAMESPACE[Namespace URI]
        RESULTS[Query Results]
    end
    
    URI --> LABEL
    GRAPH --> QUERY
    TRIPLE --> TYPE
    
    LABEL --> HUMAN_LABEL
    QUERY --> RESULTS
    TYPE --> TYPE_INFO
```

**Usage Examples:**
```jinja2
{{ "http://schema.org/Person" | rdfLabel }}         <!-- Person -->
{{ uri | rdfType }}                                 <!-- Class type -->
{{ resource | rdfProperties }}                      <!-- Property list -->
{{ graph | rdfQuery("SELECT ?label WHERE { ?s rdfs:label ?label }") }}
```

### 5. LaTeX/Academic Filters

```mermaid
flowchart TD
    subgraph "LaTeX Input"
        TEXT[Plain Text]
        MATH[Math Expression]
        REF[Reference]
        META[Metadata]
    end
    
    subgraph "LaTeX Filters"
        ESC[texEscape]
        MATH_MODE[mathMode]
        CITE[citation]
        BB[bluebook]
        ARXIV[arXivMeta]
        BIB[bibEntry]
        THEOREM[theorem]
        PROOF[proof]
    end
    
    subgraph "Academic Output"
        SAFE_TEX[Safe LaTeX]
        FORMATTED_MATH[Formatted Math]
        CITATIONS[Citations]
        LEGAL_CITE[Legal Citation]
        PAPER_META[Paper Metadata]
    end
    
    TEXT --> ESC
    MATH --> MATH_MODE
    REF --> CITE
    META --> ARXIV
    
    ESC --> SAFE_TEX
    MATH_MODE --> FORMATTED_MATH
    CITE --> CITATIONS
    ARXIV --> PAPER_META
```

**Usage Examples:**
```jinja2
{{ "Special & chars" | texEscape }}                 <!-- Special \& chars -->
{{ "x^2 + y^2 = z^2" | mathMode }}                  <!-- $x^2 + y^2 = z^2$ -->
{{ paper | citation("apa") }}                       <!-- APA citation -->
{{ case | bluebook }}                               <!-- Legal citation -->
{{ arxivId | arXivMeta }}                           <!-- Paper metadata -->
```

## Filter Chaining Patterns

### 1. Linear Chaining

```mermaid
flowchart LR
    INPUT[Input] --> F1[Filter 1] --> F2[Filter 2] --> F3[Filter 3] --> OUTPUT[Output]
```

```jinja2
{{ "hello_world_example" | camelCase | capitalize | quote }}
<!-- "HelloWorldExample" -->
```

### 2. Conditional Chaining

```mermaid
flowchart TD
    INPUT[Input]
    CONDITION{Condition}
    PATH_A[Filter A]
    PATH_B[Filter B]
    OUTPUT[Output]
    
    INPUT --> CONDITION
    CONDITION -->|true| PATH_A
    CONDITION -->|false| PATH_B
    PATH_A --> OUTPUT
    PATH_B --> OUTPUT
```

```jinja2
{{ value | (isString ? 'capitalize' : 'toString') | trim }}
```

### 3. Branching & Merging

```mermaid
flowchart TD
    INPUT[Input]
    BRANCH1[Branch 1]
    BRANCH2[Branch 2]
    F1A[Filter 1A]
    F1B[Filter 1B]
    F2A[Filter 2A]
    F2B[Filter 2B]
    MERGE[Merge]
    OUTPUT[Output]
    
    INPUT --> BRANCH1
    INPUT --> BRANCH2
    BRANCH1 --> F1A --> F1B
    BRANCH2 --> F2A --> F2B
    F1B --> MERGE
    F2B --> MERGE
    MERGE --> OUTPUT
```

```jinja2
{{ {
  name: person.name | capitalize,
  slug: person.name | slug,
  label: person.name | rdfLabel
} }}
```

## Advanced Composition Patterns

### 1. Filter Factories

```javascript
// Custom filter with parameters
function createFormatter(type, options) {
  return function(value) {
    switch(type) {
      case 'academic':
        return value | citation(options.style) | texEscape;
      case 'web':
        return value | slug | lowercase;
      case 'semantic':
        return value | rdfLabel | humanize;
    }
  };
}
```

### 2. Pipeline Templates

```jinja2
<!-- Define reusable pipeline -->
{% set academicPipeline = ['citation("apa")', 'texEscape', 'wrap("\\cite{", "}")'] %}

<!-- Apply pipeline -->
{{ paper | apply(academicPipeline) }}
```

### 3. Context-Aware Filtering

```jinja2
<!-- Different processing based on output format -->
{% if outputFormat === 'latex' %}
  {{ content | texEscape | mathMode }}
{% elif outputFormat === 'html' %}
  {{ content | escape | markdown }}
{% elif outputFormat === 'rdf' %}
  {{ content | rdfSerialize("turtle") }}
{% endif %}
```

## Filter Performance Optimization

### 1. Caching Strategy

```mermaid
flowchart LR
    subgraph "Cache Layers"
        L1[Filter Result Cache]
        L2[RDF Query Cache]
        L3[External API Cache]
    end
    
    INPUT[Input] --> CHECK{Cache Hit?}
    CHECK -->|Yes| L1
    CHECK -->|No| PROCESS[Process Filter]
    PROCESS --> STORE[Store in Cache]
    STORE --> L1
    L1 --> OUTPUT[Output]
```

### 2. Lazy Evaluation

```mermaid
flowchart TD
    INPUT[Input]
    DEFER[Defer Processing]
    TRIGGER{Access Needed?}
    PROCESS[Process Chain]
    CACHE[Cache Result]
    OUTPUT[Output]
    
    INPUT --> DEFER
    DEFER --> TRIGGER
    TRIGGER -->|Yes| PROCESS
    TRIGGER -->|No| DEFER
    PROCESS --> CACHE
    CACHE --> OUTPUT
```

## Error Handling Pipeline

```mermaid
flowchart TD
    INPUT[Input]
    VALIDATE[Validate Input]
    ERROR{Error?}
    FILTER[Apply Filter]
    CATCH[Catch Error]
    FALLBACK[Fallback Value]
    LOG[Log Error]
    OUTPUT[Output]
    
    INPUT --> VALIDATE
    VALIDATE --> ERROR
    ERROR -->|No| FILTER
    ERROR -->|Yes| CATCH
    FILTER --> OUTPUT
    CATCH --> FALLBACK
    CATCH --> LOG
    FALLBACK --> OUTPUT
```

**Error Handling Examples:**
```jinja2
{{ value | safe('camelCase') | default('defaultValue') }}
{{ date | try('dateFormat', 'YYYY-MM-DD') | fallback('Invalid Date') }}
```

## Filter Extension Points

### 1. Custom Filter Registration

```javascript
// Register custom filter
unjucks.addFilter('customFormat', function(value, format) {
  // Implementation
  return processed;
});
```

### 2. Filter Middleware

```javascript
// Filter middleware for logging
unjucks.use('filterLogger', function(filterName, input, output) {
  console.log(`Filter ${filterName}: ${input} -> ${output}`);
});
```

### 3. Plugin Architecture

```javascript
// RDF plugin
const rdfPlugin = {
  filters: ['rdfLabel', 'rdfType', 'rdfQuery'],
  setup(unjucks) {
    // Register RDF-specific filters
  }
};

unjucks.use(rdfPlugin);
```

## Best Practices

1. **Chain Order Matters**: Apply type-specific filters before generic ones
2. **Cache Expensive Operations**: RDF queries, external API calls
3. **Validate Input Types**: Ensure filters receive expected data types
4. **Use Fallbacks**: Provide default values for failed filter operations
5. **Compose Thoughtfully**: Break complex operations into simple, testable filters
6. **Document Chains**: Comment complex filter chains for maintainability

The filter pipeline provides a powerful, extensible system for data transformation that scales from simple string formatting to complex semantic and academic processing workflows.