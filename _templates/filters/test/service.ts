---
to: "src/{{ name | pascalCase }}.ts"
---
export class {{ name | pascalCase }}Service {
  // Testing 8+ built-in filters
  kebabName = "{{ name | kebabCase }}";
  snakeName = "{{ name | snakeCase }}";
  camelName = "{{ name | camelCase }}";
  titleName = "{{ name | titleCase }}";
  upperName = "{{ name | upperCase }}";
  lowerName = "{{ name | lowerCase }}";
  pluralName = "{{ name | pluralize }}";
  defaultValue = "{{ optionalValue | default('fallback') }}";
}