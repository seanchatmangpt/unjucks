# Basic Semantic Template Generation

This example demonstrates the core functionality of Unjucks: generating files from templates using semantic data (RDF/TTL/N3).

## Files Structure

- `data/api-schema.ttl` - API ontology defining REST endpoints and data models
- `templates/api-client.njk` - Nunjucks template that consumes the semantic data
- `generated/api-client.ts` - Example TypeScript client generated from the template

## How It Works

1. **Semantic Data**: The TTL file defines an API schema with endpoints, methods, and data models
2. **Template Processing**: Unjucks processes the template using RDF filters to extract semantic data
3. **File Generation**: The template renders to produce a fully functional TypeScript API client

## Running the Example

```bash
# Generate the API client from semantic data
unjucks generate api-client --data ./data/api-schema.ttl --output ./generated/

# Validate the generated output
node ./scripts/validate-output.js
```

## Key Concepts

### Semantic Filters in Templates

```njk
{# Extract API endpoints from RDF #}
{% for endpoint in data | rdfQuery('SELECT ?endpoint ?method ?path WHERE { ?endpoint a :RestEndpoint ; :method ?method ; :path ?path }') %}
  // {{ endpoint.method }} {{ endpoint.path }}
{% endfor %}
```

### Type-Safe Generation

The semantic data ensures generated code is type-safe and consistent:
- Data models are defined once in RDF
- Templates generate matching TypeScript interfaces
- Validation rules prevent schema drift

## Benefits

1. **Single Source of Truth**: API schema is defined once in semantic format
2. **Consistency**: All generated clients follow the same data model
3. **Validation**: Semantic rules ensure correctness
4. **Evolution**: Schema changes propagate automatically to generated code