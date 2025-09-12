---
to: src/services/{{ serviceName | kebabCase }}.js
---
/**
 * {{ serviceName }} Service
 */

class {{ serviceName | pascalCase }}Service {
  constructor() {
    this.name = "{{ serviceName }}";
    this.port = {{ port || 3000 }};
  }

  start() {
    console.log(`Starting ${this.name} on port ${this.port}`);
  }
}

export default {{ serviceName | pascalCase }}Service;
