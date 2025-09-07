// Additional route handler
// Basic JavaScript file for injection testing
const express = require('express');
const app = express();

const cors = require('cors');
// EXPORTS
---
to: src/index.js
inject: true
after: "// EXPORTS"
---
export { {{ name | pascalCase }} } from './components/{{ name | pascalCase }}.js';
// This marker is used for injection tests

// MIDDLEWARE
// New middleware added

// ROUTES

// SERVER SETUP
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
// End of file marker
test
// Forced injection at end