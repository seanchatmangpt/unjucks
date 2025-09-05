---
to: "test-outputs/{{ name | kebabCase }}-{{ type }}.md"
---
# Test File: {{ name | titleCase }}

This is a test file generated with the 'to' frontmatter option.

Name: {{ name }}
Type: {{ type }}