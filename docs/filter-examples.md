# Unjucks Filter Pipeline - Usage Examples

This document provides comprehensive examples of the Unjucks filter system with 65+ filters across 6 categories.

## Quick Start

```javascript
import { createTemplateEngine } from './src/lib/template-engine.js';

// Create engine with full filter pipeline
const engine = createTemplateEngine({
  enableFilters: true,
  enableRDF: true,
  templatesDir: '_templates'
});

// Basic template rendering with filters
const result = engine.renderString('{{ "hello world" | pascalCase }}');
// Output: "HelloWorld"
```

## String Transformation Filters

### Case Conversion

```nunjucks
<!-- Input: "hello_world_example" -->
{{ userInput | pascalCase }}     <!-- HelloWorldExample -->
{{ userInput | camelCase }}      <!-- helloWorldExample -->
{{ userInput | kebabCase }}      <!-- hello-world-example -->
{{ userInput | snakeCase }}      <!-- hello_world_example -->
{{ userInput | constantCase }}   <!-- HELLO_WORLD_EXAMPLE -->
{{ userInput | titleCase }}      <!-- Hello World Example -->
{{ userInput | upperCase }}      <!-- HELLO_WORLD_EXAMPLE -->
{{ userInput | lowerCase }}      <!-- hello_world_example -->
```

### String Manipulation

```nunjucks
<!-- Text processing -->
{{ "  hello world  " | trim }}               <!-- "hello world" -->
{{ "hello" | capitalize }}                   <!-- "Hello" -->
{{ "Hello World!" | slug }}                  <!-- "hello-world" -->
{{ "user_name" | humanize }}                 <!-- "User Name" -->
{{ "text" | pad(10, "0") }}                  <!-- "000text000" -->
{{ longText | truncate(50, "...") }}         <!-- "First 47 chars..." -->
{{ content | replace("old", "new") }}        <!-- Replace all instances -->
{{ htmlContent | stripTags }}                <!-- Remove HTML tags -->
```

### String Formatting

```nunjucks
<!-- Wrapping and formatting -->
{{ content | wrap("[", "]") }}               <!-- [content] -->
{{ code | indent(4) }}                       <!-- 4-space indentation -->
{{ userInput | escape }}                     <!-- HTML-safe output -->
{{ htmlEntities | unescape }}                <!-- Decode HTML entities -->
{{ filename | quote }}                       <!-- "filename" -->
{{ quotedString | unquote }}                 <!-- Remove quotes -->
```

## Date & Time Filters

```nunjucks
<!-- Date formatting with dayjs -->
{{ "2023-12-25" | dateFormat("MMMM Do, YYYY") }}    <!-- December 25th, 2023 -->
{{ "2023-01-01" | fromNow }}                        <!-- "10 months ago" -->
{{ date | timezone("America/New_York") }}           <!-- Eastern time -->
{{ date | addDays(7) | dateFormat("YYYY-MM-DD") }}  <!-- Add week -->
{{ date | subtractDays(5) }}                        <!-- Subtract days -->
{{ date | startOf("month") }}                       <!-- First of month -->
{{ date | endOf("day") }}                           <!-- End of day -->
{{ timestamp | toISOString }}                       <!-- ISO format -->
```

## Collection Filters

### Array Operations

```nunjucks
<!-- Array manipulation -->
{{ users | sort("name") }}                          <!-- Sort by property -->
{{ items | filter("active") }}                      <!-- Filter active items -->
{{ products | map("price") }}                       <!-- Extract prices -->
{{ numbers | unique | sort }}                       <!-- Remove duplicates and sort -->
{{ nestedArray | flatten }}                         <!-- Flatten one level -->
{{ items | chunk(3) }}                              <!-- Split into groups of 3 -->
{{ array1 | zip(array2) }}                          <!-- Combine arrays -->

<!-- Array utilities -->
{{ collection | length }}                           <!-- Get count -->
{{ items | first }}                                 <!-- First item -->
{{ items | last }}                                  <!-- Last item -->
{{ items | slice(2, 5) }}                           <!-- Subset -->
{{ items | reverse }}                               <!-- Reverse order -->
{{ items | shuffle }}                               <!-- Random order -->
```

### Object Operations

```nunjucks
<!-- Object manipulation -->
{{ user | keys }}                                   <!-- ["name", "age", "email"] -->
{{ user | values }}                                 <!-- ["John", 30, "john@..."] -->
{{ user | pairs }}                                  <!-- [["name", "John"], ...] -->
{{ obj1 | merge(obj2, obj3) }}                      <!-- Combine objects -->
{{ user | pick("name", "email") }}                  <!-- Select properties -->
{{ user | omit("password") }}                       <!-- Exclude properties -->
{{ users | groupBy("department") }}                 <!-- Group by field -->
```

## RDF/Semantic Filters

```nunjucks
<!-- RDF operations (when RDF data is loaded) -->
{{ "http://schema.org/Person" | rdfLabel }}         <!-- "Person" -->
{{ resource | rdfType }}                            <!-- Get type information -->
{{ resource | rdfProperties }}                      <!-- List properties -->
{{ "foaf" | rdfNamespace }}                         <!-- Get namespace URI -->
{{ graph | rdfQuery("?s rdf:type foaf:Person") }}   <!-- SPARQL-like query -->
{{ uri | rdfExpand }}                               <!-- Expand prefixed URI -->
{{ fullUri | rdfCompact }}                          <!-- Compact to prefix -->
{{ subject | rdfExists("foaf:name") }}              <!-- Check if property exists -->
{{ graph | rdfCount("?s", "rdf:type", "?o") }}      <!-- Count triples -->
```

## LaTeX/Academic Filters

```nunjucks
<!-- Academic document formatting -->
{{ "Special & chars $#^_{}" | texEscape }}          <!-- Escape LaTeX -->
{{ "x^2 + y^2 = z^2" | mathMode }}                  <!-- $x^2 + y^2 = z^2$ -->
{{ paper | citation("apa") }}                       <!-- APA citation -->
{{ legalCase | bluebook }}                          <!-- Legal citation -->
{{ arxivId | arXivMeta }}                           <!-- Paper metadata -->
{{ paper | bibEntry }}                              <!-- BibTeX entry -->
{{ theorem | theorem("lemma") }}                    <!-- \begin{lemma}...\end{lemma} -->
{{ proofText | proof }}                             <!-- \begin{proof}...\end{proof} -->
```

### Citation Examples

```nunjucks
<!-- Paper object for citations -->
{% set paper = {
  author: "Smith, J. & Doe, A.",
  year: 2023,
  title: "Advanced Template Processing",
  journal: "Journal of Software Engineering"
} %}

{{ paper | citation("apa") }}
<!-- Smith, J. & Doe, A. (2023). Advanced Template Processing. Journal of Software Engineering. -->

{{ paper | citation("mla") }}
<!-- Smith, J. & Doe, A. "Advanced Template Processing." Journal of Software Engineering, 2023. -->

{{ paper | bibEntry }}
<!-- @article{key,
  title={Advanced Template Processing},
  author={Smith, J. & Doe, A.},
  journal={Journal of Software Engineering},
  year={2023}
} -->
```

## Advanced Utility Filters

```nunjucks
<!-- Error handling and safety -->
{{ riskyValue | safe("defaultValue") }}             <!-- Safe execution -->
{{ optionalValue | default("fallback") }}           <!-- Default value -->
{{ value | try("upperCase") | fallback("ERROR") }}  <!-- Try with fallback -->
{{ data | json(2) }}                                <!-- Pretty JSON -->

<!-- Filter composition -->
{{ value | apply(["trim", "upperCase", "quote"]) }} <!-- Chain multiple filters -->
```

## Filter Chaining Patterns

### Linear Chaining

```nunjucks
<!-- Transform through multiple filters -->
{{ "hello_world_example" | camelCase | capitalize | quote }}
<!-- "HelloWorldExample" -->

{{ "  Mixed Case Text  " | trim | titleCase | slug }}
<!-- "mixed-case-text" -->

{{ userInput | stripTags | truncate(100) | escape }}
<!-- Safe, truncated content -->
```

### Conditional Chaining

```nunjucks
<!-- Conditional processing -->
{% if outputFormat === 'latex' %}
  {{ content | texEscape | mathMode }}
{% elif outputFormat === 'html' %}
  {{ content | escape | replace('\n', '<br>') }}
{% elif outputFormat === 'slug' %}
  {{ content | stripTags | slug }}
{% endif %}
```

### Complex Data Processing

```nunjucks
<!-- Process collections with multiple filters -->
{{ users 
   | filter("active") 
   | sort("lastName") 
   | map("fullName") 
   | unique 
   | slice(0, 10) }}

<!-- Transform and format data -->
{{ articles 
   | groupBy("category")
   | pairs
   | sort("1.length")
   | reverse }}
```

## Template Engine Integration

### Basic Setup

```javascript
import { createEnhancedTemplateEngine } from './src/lib/template-engine.js';

const engine = createEnhancedTemplateEngine({
  templatesDir: '_templates',
  enableFilters: true,
  enableRDF: true,
  enableCache: true
});

// Get available filters
const catalog = engine.getAvailableFilters();
console.log(`Available filters: ${catalog.totalFilters}`);

// Add custom filter
engine.addFilter('customFormat', (value, format) => {
  // Custom formatting logic
  return formatted;
});
```

### Advanced Usage

```javascript
// Template with comprehensive filter usage
const template = `
<!-- User Profile Template -->
<div class="user-profile">
  <h1>{{ user.name | titleCase }}</h1>
  <p class="username">@{{ user.name | slug }}</p>
  
  <!-- Contact info -->
  <div class="contact">
    <span>{{ user.email | lowerCase }}</span>
    <span>{{ user.phone | default("Not provided") }}</span>
  </div>
  
  <!-- Bio with formatting -->
  <div class="bio">
    {{ user.bio | truncate(200) | escape | replace('\n', '<br>') }}
  </div>
  
  <!-- Skills as tags -->
  <div class="skills">
    {% for skill in user.skills | sort | unique %}
      <span class="tag">{{ skill | titleCase }}</span>
    {% endfor %}
  </div>
  
  <!-- Joined date -->
  <p class="joined">
    Member since {{ user.joinedAt | dateFormat("MMMM YYYY") }}
    ({{ user.joinedAt | fromNow }})
  </p>
  
  <!-- Articles grouped by category -->
  {% for category, articles in user.articles | groupBy("category") %}
    <h3>{{ category | humanize }}</h3>
    <ul>
      {% for article in articles | sort("publishedAt") | reverse | slice(0, 5) %}
        <li>
          <a href="/articles/{{ article.title | slug }}">
            {{ article.title | titleCase }}
          </a>
          <time>{{ article.publishedAt | dateFormat("MMM D, YYYY") }}</time>
        </li>
      {% endfor %}
    </ul>
  {% endfor %}
</div>
`;

// Render with data
const result = engine.renderString(template, {
  user: {
    name: "john_doe",
    email: "JOHN.DOE@EXAMPLE.COM",
    bio: "Software engineer & open source contributor.\nLoves building tools.",
    skills: ["javascript", "python", "javascript", "docker"],
    joinedAt: "2022-01-15",
    articles: [
      { title: "getting started with unjucks", category: "tutorials", publishedAt: "2023-01-01" },
      { title: "advanced filtering techniques", category: "tutorials", publishedAt: "2023-02-01" },
      { title: "my coding journey", category: "personal", publishedAt: "2023-01-15" }
    ]
  }
});
```

## Performance Optimization

### Caching Configuration

```javascript
const engine = createTemplateEngine({
  enableFilters: true,
  enableCache: true,
  filterOptions: {
    maxCacheSize: 1000,
    enableErrorRecovery: true,
    strictMode: false
  }
});

// Monitor performance
const stats = engine.getStats();
console.log(`Filter cache hit rate: ${stats.filterPipeline.cacheHitRate}`);
console.log(`Average filter execution time: ${stats.filterPipeline.avgExecutionTime}ms`);
```

### Error Handling

```nunjucks
<!-- Graceful error handling -->
{{ unreliableData | safe | default("No data") }}
{{ userInput | try("dateFormat", "YYYY-MM-DD") | fallback("Invalid date") }}

<!-- Multiple fallbacks -->
{{ value | try("customFilter") | try("backupFilter") | default("fallback") }}
```

## Best Practices

### 1. Filter Order Matters

```nunjucks
<!-- Good: type-specific filters first -->
{{ htmlContent | stripTags | trim | truncate(100) }}

<!-- Avoid: generic filters first -->
{{ htmlContent | truncate(100) | stripTags | trim }}
```

### 2. Use Appropriate Data Types

```nunjucks
<!-- Ensure arrays for array filters -->
{{ items | default([]) | sort("name") }}

<!-- Ensure strings for string filters -->
{{ value | default("") | upperCase }}
```

### 3. Chain Thoughtfully

```nunjucks
<!-- Clear, readable chains -->
{{ user.name 
   | default("Anonymous") 
   | titleCase 
   | quote }}

<!-- Avoid overly complex chains -->
{{ data | filter(...) | map(...) | sort(...) | groupBy(...) | values | flatten | unique }}
```

### 4. Handle Edge Cases

```nunjucks
<!-- Safe array processing -->
{{ users | default([]) | filter("active") | length }}

<!-- Safe object access -->
{{ user.profile | default({}) | pick("name", "email") }}
```

## Integration with RDF Data

```nunjucks
<!-- When RDF data is loaded -->
{% set ontology = "http://schema.org/" %}

<div class="semantic-data">
  <!-- Resource description -->
  <h2>{{ resource | rdfLabel | default(resource | rdfCompact) }}</h2>
  
  <!-- Type information -->
  <p class="types">
    Types: 
    {% for type in resource | rdfType %}
      {{ type | rdfCompact | rdfLabel }}{% if not loop.last %}, {% endif %}
    {% endfor %}
  </p>
  
  <!-- Properties -->
  <dl>
    {% for property in resource | rdfProperties %}
      <dt>{{ property | rdfLabel | humanize }}</dt>
      {% for value in resource | rdfObject(property) %}
        <dd>
          {% if value.type === 'uri' %}
            <a href="{{ value.value }}">{{ value.value | rdfLabel }}</a>
          {% else %}
            {{ value.value }}
          {% endif %}
        </dd>
      {% endfor %}
    {% endfor %}
  </dl>
</div>
```

This comprehensive filter system provides powerful data transformation capabilities while maintaining excellent performance through caching and error handling. The 80/20 approach ensures that the most commonly needed filters are implemented with high quality and performance.