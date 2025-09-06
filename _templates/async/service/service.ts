---
to: "src/{{ name }}.ts"
---
export class {{ name | pascalCase }}Service {
  {% set asyncMethods = ['create', 'read', 'update', 'delete'] %}
  {% for method in asyncMethods %}
  async {{ method }}{{ name | pascalCase }}(): Promise<{{ name | pascalCase }}> {
    // Async {{ method }} implementation
    return new Promise(resolve => {
      setTimeout(() => resolve({} as {{ name | pascalCase }}), 100);
    });
  }
  {% endfor %}
}