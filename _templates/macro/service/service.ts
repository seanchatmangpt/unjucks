---
to: "src/{{ name }}.ts"
---
{% macro generateMethod(methodName, returnType, params) %}
  {{ methodName }}({{ params | join(', ') }}): {{ returnType }} {
    // Implementation for {{ methodName }}
    throw new Error('Not implemented');
  }
{% endmacro %}

export class {{ name | pascalCase }}Service {
  {{ generateMethod('create', 'Promise<' + (name | pascalCase) + '>', ['data: Partial<' + (name | pascalCase) + '>']) }}
  
  {{ generateMethod('update', 'Promise<' + (name | pascalCase) + '>', ['id: string', 'data: Partial<' + (name | pascalCase) + '>']) }}
  
  {{ generateMethod('delete', 'Promise<void>', ['id: string']) }}
}