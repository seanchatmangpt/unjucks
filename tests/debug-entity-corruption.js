/**
 * Debug HTML Entity Corruption in Template Context
 */

import nunjucks from 'nunjucks';

// Simplified version of common filters
function addBasicFilters(nunjucksEnv) {
  nunjucksEnv.addFilter('dump', function(obj) {
    try {
      const seen = new WeakSet();
      const replacer = (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular Reference]";
          }
          seen.add(value);
        }
        return value;
      };
      
      const jsonString = JSON.stringify(obj, replacer, 2);
      return new nunjucks.runtime.SafeString(jsonString);
    } catch (error) {
      return new nunjucks.runtime.SafeString(`"[JSON Error: ${error.message}]"`);
    }
  });
  
  // Add potentially problematic escape filter
  nunjucksEnv.addFilter('escape', (str) => {
    if (!str) return str;
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  });
}

const env = new nunjucks.Environment();
addBasicFilters(env);

console.log("🔍 DEBUGGING HTML ENTITY CORRUPTION");
console.log("===================================");

// Test the specific failing template
const templateData = {
  name: "MyService \"Production\"",
  version: "2.1.0",
  timestamp: "2024-01-15T10:30:00Z",
  notes: "Config with \"quotes\" & special chars <test>",
  config: {
    database: {
      url: "postgres://user:pass@host/db?ssl=true&timeout=30",
      pool: { min: 2, max: 10 }
    }
  },
  deployment: {
    environment: "production & staging",
    regions: ["us-east-1", "eu-west-1"]
  }
};

const problematicTemplate = `{
  "name": "{{ name }}",
  "version": "{{ version }}",
  "config": {{ config | dump }},
  "deployment": {{ deployment | dump }},
  "metadata": {
    "generated": "{{ timestamp }}",
    "generator": "Unjucks Template Engine",
    "notes": "{{ notes }}"
  }
}`;

console.log("\n1️⃣ Testing problematic template...");
const result = env.renderString(problematicTemplate, templateData);

console.log("\nTemplate output:");
console.log(result);

// Analyze each part
console.log("\n2️⃣ Analyzing each template variable...");

console.log("\nDirect variable substitution:");
console.log("name:", env.renderString(`{{ name }}`, templateData));
console.log("notes:", env.renderString(`{{ notes }}`, templateData));

console.log("\nJSON dump results:");
console.log("config:", env.renderString(`{{ config | dump }}`, templateData));
console.log("deployment:", env.renderString(`{{ deployment | dump }}`, templateData));

// Check if the issue is in the overall JSON structure
console.log("\n3️⃣ Checking JSON validity...");
try {
  const parsed = JSON.parse(result);
  console.log("✅ Overall JSON is valid");
  console.log("Parsed name:", parsed.name);
  console.log("Parsed notes:", parsed.notes);
} catch (error) {
  console.log("❌ Overall JSON is invalid:", error.message);
  
  // Find the specific issue
  const lines = result.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('&quot;') || line.includes('&amp;') || line.includes('&lt;') || line.includes('&gt;')) {
      console.log(`Line ${index + 1} has entities: ${line.trim()}`);
    }
  });
}

// Test if the issue is with auto-escaping in Nunjucks
console.log("\n4️⃣ Testing Nunjucks auto-escaping...");

const simpleTemplate = `{{ name }}`;
const simpleResult = env.renderString(simpleTemplate, templateData);
console.log("Simple variable result:", simpleResult);
console.log("Has entities:", simpleResult.includes('&quot;'));

// Test with explicit safe filter
const safeTemplate = `{{ name | safe }}`;
const safeResult = env.renderString(safeTemplate, templateData);
console.log("Safe filter result:", safeResult);
console.log("Has entities:", safeResult.includes('&quot;'));

// Test the fix: use raw output in JSON context
console.log("\n5️⃣ Testing fix with raw/safe in JSON context...");

const fixedTemplate = `{
  "name": {{ name | dump }},
  "version": {{ version | dump }},
  "config": {{ config | dump }},
  "deployment": {{ deployment | dump }},
  "metadata": {
    "generated": {{ timestamp | dump }},
    "generator": "Unjucks Template Engine",
    "notes": {{ notes | dump }}
  }
}`;

const fixedResult = env.renderString(fixedTemplate, templateData);
console.log("\nFixed template output:");
console.log(fixedResult);

try {
  const fixedParsed = JSON.parse(fixedResult);
  console.log("✅ Fixed JSON is valid");
  console.log("Fixed name:", fixedParsed.name);
  console.log("Fixed notes:", fixedParsed.notes);
} catch (error) {
  console.log("❌ Fixed JSON is still invalid:", error.message);
}

console.log("\n6️⃣ ANALYSIS CONCLUSION");
console.log("=".repeat(40));
console.log("The issue occurs when:")
console.log("1. Variables with quotes/special chars are used directly in JSON: {{ name }}");
console.log("2. Nunjucks auto-escapes them for HTML safety");
console.log("3. This breaks JSON structure");
console.log("\nSOLUTION:");
console.log("1. Always use | dump filter for JSON values");
console.log("2. Or use | safe filter to bypass auto-escaping");
console.log("3. Never mix direct variable substitution with JSON structure");