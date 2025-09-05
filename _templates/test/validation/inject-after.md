---
to: "test-outputs/inject-target.md"
inject: true
after: "// INJECT AFTER HERE"
---

// This content should be injected after the marker
console.log("Injected content: {{ message }}");