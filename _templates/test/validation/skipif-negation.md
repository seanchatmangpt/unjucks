---
to: "test-outputs/skipif-negation-{{ name }}.md"
skipIf: "!enabled"
---
# This should be skipped when enabled is false

Enabled: {{ enabled }}
This file should only exist when enabled is true