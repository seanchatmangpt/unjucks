---
to: "src/atomic-{{ name }}.ts"
---
export const {{ name }} = {
  timestamp: new Date().toISOString(),
  generated: true
};