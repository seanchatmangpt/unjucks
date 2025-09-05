---
to: "test-outputs/inject-target.md"
inject: true
before: "// INJECT BEFORE HERE"
---

// This content should be injected before the marker
console.log("Before injection: {{ message }}");