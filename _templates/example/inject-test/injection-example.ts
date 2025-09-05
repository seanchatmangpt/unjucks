---
to: src/index.ts
inject: true
after: "// Add new imports here"
---
import { {{ componentName }} } from './components/{{ componentName }}';