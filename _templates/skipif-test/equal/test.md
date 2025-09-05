---
to: "test-outputs/skipif-equal-{{ name }}.md"
skipIf: "name==skip"
---
# This should be skipped when name equals 'skip'

Name: {{ name }}
This file should only exist when name is NOT 'skip'