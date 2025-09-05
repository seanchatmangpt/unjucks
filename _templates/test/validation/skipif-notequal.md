---
to: "test-outputs/skipif-notequal-{{ name }}.md"
skipIf: "name!=keep"
---
# This should be skipped when name is NOT equal to 'keep'

Name: {{ name }}
This file should only exist when name IS 'keep'