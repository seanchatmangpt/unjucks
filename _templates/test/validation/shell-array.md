---
to: "test-outputs/shell-array-{{ name }}.md"
sh:
  - "echo 'First command for {{ name }}'"
  - "echo 'Second command for {{ name }}'"
  - "touch test-outputs/shell-array-{{ name }}.touch"
---
# Shell Command Test - Array

This file tests array shell command execution.

Name: {{ name }}