---
to: "src/{{ name | pascalCase }}.ts"
---
export class {{ name | pascalCase }} {
  private {{ enabled }}: boolean = {{ withTests }};
  description = "{{ description }}";
}