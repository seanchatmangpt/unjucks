---
to: "test-outputs/skipif-existence-{{ name || 'undefined' }}.md"
skipIf: "debug"
---
# This should be skipped when debug variable exists and is truthy

Name: {{ name }}
Debug: {{ debug }}
This file should only exist when debug is falsy or undefined