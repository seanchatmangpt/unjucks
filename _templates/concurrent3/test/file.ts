---
to: "src/concurrent/{{ name }}{{ 3 }}.ts"
---
export const {{ name }}{{ 3 }} = {
  id: {{ 3 }},
  processed: new Date().toISOString(),
  name: "{{ name | titleCase }} {{ 3 }}"
};