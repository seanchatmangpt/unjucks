---
to: "test-outputs/chmod-octal-{{ name }}.sh"
chmod: "755"
---
#!/bin/bash

# This script should have 755 permissions (octal format)
echo "Script with octal chmod: {{ name }}"
echo "Permissions should be 755"