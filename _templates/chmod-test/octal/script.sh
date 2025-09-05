---
to: "test-outputs/chmod-test-{{ name }}.sh"
chmod: "755"
---
#!/bin/bash

# This script should have 755 permissions
echo "Script with chmod permissions: {{ name }}"