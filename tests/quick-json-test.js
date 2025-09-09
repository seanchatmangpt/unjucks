/**
 * Quick standalone test for JSON dump filter functionality
 */

import nunjucks from 'nunjucks';

// Create basic environment
const env = new nunjucks.Environment();

// Add a simplified dump filter to test current behavior
env.addFilter('dump', function(obj) {
  try {
    // Handle circular references
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
    
    // Generate clean JSON
    const jsonString = JSON.stringify(obj, replacer, 2);
    
    // Mark as safe to prevent HTML entity encoding
    return new nunjucks.runtime.SafeString(jsonString);
  } catch (error) {
    return new nunjucks.runtime.SafeString(`"[JSON Error: ${error.message}]"`);
  }
});

// Test data with problematic characters
const testObj = {
  message: "Hello \"quoted\" World",
  company: "Johnson & Johnson",
  html: "<div>Content</div>",
  url: "https://api.com/data?param1=value1&param2=value2",
  comparison: "x < 5 and y > 10",
  nested: {
    bio: "Developer & Designer at <Company>",
    tags: ["<important>", "R&D", "Q&A"]
  }
};

console.log("=== JSON DUMP FILTER TEST ===");
console.log("Testing HTML entity encoding corruption...");

const result = env.renderString(`{{ obj | dump }}`, { obj: testObj });

console.log("\nDump filter output:");
console.log(result);

console.log("\n=== ANALYSIS ===");
console.log("Contains &quot;:", result.includes('&quot;'));
console.log("Contains &amp;:", result.includes('&amp;'));
console.log("Contains &lt;:", result.includes('&lt;'));
console.log("Contains &gt;:", result.includes('&gt;'));

console.log("\n=== JSON VALIDITY TEST ===");
try {
  const parsed = JSON.parse(result);
  console.log("✅ JSON is valid and parseable");
  console.log("Parsed company name:", parsed.company);
  console.log("Parsed URL:", parsed.url);
  console.log("Parsed HTML:", parsed.html);
} catch (error) {
  console.log("❌ JSON parsing failed:", error.message);
}

console.log("\n=== TEMPLATE CONTEXT TEST ===");
const template = `const config = {{ config | dump }};`;
const configResult = env.renderString(template, { 
  config: {
    database: "postgres://user:pass@host/db?ssl=true&retry=3",
    features: ["auth & sessions", "cache <redis>"]
  }
});

console.log("Template with JSON output:");
console.log(configResult);

const jsonMatch = configResult.match(/const config = (.*);/);
if (jsonMatch) {
  const extractedJson = jsonMatch[1];
  console.log("Extracted JSON contains HTML entities:", 
    extractedJson.includes('&quot;') || 
    extractedJson.includes('&amp;') || 
    extractedJson.includes('&lt;') || 
    extractedJson.includes('&gt;'));
  
  try {
    JSON.parse(extractedJson);
    console.log("✅ Extracted JSON is valid");
  } catch (error) {
    console.log("❌ Extracted JSON is invalid:", error.message);
  }
}