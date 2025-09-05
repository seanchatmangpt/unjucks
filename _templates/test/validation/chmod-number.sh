---
to: "test-outputs/chmod-number-{{ name }}.sh"
chmod: 420
---
#!/bin/bash

# This script should have 644 permissions (number format)
echo "Script with numeric chmod: {{ name }}"
echo "Permissions should be 644"