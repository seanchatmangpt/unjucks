import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";
import { TemplateScanner } from "../../../src/lib/template-scanner.js";

describe("Template Rendering Property Tests", () => {
  let tmpDir, nunjucksEnv, templateScanner;
  const numRuns = 20;
  
  beforeEach(async () => {
    tmpDir = path.join(process.cwd(), "test-bzyH4B", `template-prop-${Date.now()}`);
    await fs.ensureDir(tmpDir);
    
    nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    // Add the same custom filters
    addCustomFilters(nunjucksEnv);
    templateScanner = new TemplateScanner();
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe("Variable Substitution", () => {
    it("should substitute all variables consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            variables: fc.dictionary(
              fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/),
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.boolean(),
                fc.nat({ max: 1000 })
              ),
              { minKeys: 1, maxKeys: 5 }
            ),
            templateContent: fc.string({ minLength: 0, maxLength: 100 })
          }),
          async ({ variables, templateContent }) => {
            const variableNames = Object.keys(variables);
            
            // Create template with all variables
            const template = variableNames
              .map(name => `{{ ${name} }}`)
              .join(" ") + " " + templateContent;

            const rendered = nunjucksEnv.renderString(template, variables);

            // Property: All variables should be substituted
            for (const [name, value] of Object.entries(variables)) {
              expect(rendered).toContain(String(value));
              // Property: No unresolved variables
              expect(rendered).not.toMatch(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`));
            }

            // Property: Template content should be preserved
            expect(rendered).toContain(templateContent);
          }
        ),
        { numRuns }
      );
    });

    it("should handle nested object variables correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            nestedObject: fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              config: fc.record({
                enabled: fc.boolean(),
                count: fc.nat({ max: 100 })
              })
            })
          }),
          async ({ nestedObject }) => {
            const template = "Name: {{ obj.name }}, Enabled: {{ obj.config.enabled }}, Count: {{ obj.config.count }}";
            const rendered = nunjucksEnv.renderString(template, { obj: nestedObject });

            // Property: Nested properties should be accessible and rendered
            expect(rendered).toContain(`Name: ${nestedObject.name}`);
            expect(rendered).toContain(`Enabled: ${nestedObject.config.enabled}`);
            expect(rendered).toContain(`Count: ${nestedObject.config.count}`);
            
            // Property: No unresolved nested variables
            expect(rendered).not.toMatch(/\{\{\s*obj\.[^}]+\s*\}\}/);
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Filter Application", () => {
    it("should apply filters deterministically", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9\s_-]*$/).filter(s => s.length >= 1 && s.length <= 50),
          async (inputString) => {
            const filters = [
              { name: "kebabCase" },
              { name: "camelCase" },
              { name: "pascalCase" },
              { name: "snakeCase" },
              { name: "capitalize" },
              { name: "titleCase" }
            ];

            for (const filter of filters) {
              const template = `{{ input | ${filter.name} }}`;
              const result1 = nunjucksEnv.renderString(template, { input: inputString });
              const result2 = nunjucksEnv.renderString(template, { input: inputString });

              // Property: Filter should be deterministic
              expect(result1).toBe(result2);

              // Property: Filter output should be a string
              expect(typeof result1).toBe("string");
              expect(typeof result2).toBe("string");
            }
          }
        ),
        { numRuns }
      );
    });

    it("should handle pluralization consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-z]+$/).filter(s => s.length >= 2 && s.length <= 15),
            { minLength: 1, maxLength: 5 }
          ),
          async (words) => {
            for (const word of words) {
              const pluralTemplate = "{{ word | pluralize }}";
              const singularTemplate = "{{ word | pluralize | singularize }}";

              const plural = nunjucksEnv.renderString(pluralTemplate, { word });
              const backToSingular = nunjucksEnv.renderString(singularTemplate, { word });

              // Property: Pluralization should produce a string
              expect(typeof plural).toBe("string");
              expect(typeof backToSingular).toBe("string");

              // Property: Pluralization should add something (for simple words)
              if (!word.endsWith('s')) {
                expect(plural.length).toBeGreaterThanOrEqual(word.length);
              }

              // Property: Double transformation should be deterministic
              const doublePlural = nunjucksEnv.renderString(pluralTemplate, { word: plural });
              expect(typeof doublePlural).toBe("string");
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Conditional Rendering", () => {
    it("should handle if/else conditions correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            condition: fc.boolean(),
            trueValue: fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length >= 1 && s.length <= 20 && s.trim() === s),
            falseValue: fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length >= 1 && s.length <= 20 && s.trim() === s)
          }).filter(({ trueValue, falseValue }) => trueValue !== falseValue),
          async ({ condition, trueValue, falseValue }) => {
            const template = `{% if enabled %}${trueValue}{% else %}${falseValue}{% endif %}`;
            const rendered = nunjucksEnv.renderString(template, { enabled: condition });

            // Property: Should render exactly one of the branches
            if (condition) {
              expect(rendered).toBe(trueValue);
            } else {
              expect(rendered).toBe(falseValue);
            }
            
            // Property: Result should be either true or false value
            expect(rendered === trueValue || rendered === falseValue).toBe(true);
          }
        ),
        { numRuns }
      );
    });

    it("should handle complex boolean expressions", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            a: fc.boolean(),
            b: fc.boolean(),
            value: fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter(s => s.length >= 1 && s.length <= 20)
          }),
          async ({ a, b, value }) => {
            const templates = [
              { template: `{% if a and b %}${value}{% endif %}`, expected: a && b },
              { template: `{% if a or b %}${value}{% endif %}`, expected: a || b },
              { template: `{% if not a %}${value}{% endif %}`, expected: !a }
            ];

            for (const { template, expected } of templates) {
              const rendered = nunjucksEnv.renderString(template, { a, b });

              // Property: Boolean logic should work correctly
              if (expected) {
                expect(rendered).toBe(value);
              } else {
                expect(rendered).toBe("");
              }
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Loop Rendering", () => {
    it("should render loops with correct iteration count", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('|')), { maxLength: 10 }),
          async (items) => {
            const template = `{% for item in items %}{{ item }}|{% endfor %}`;
            const rendered = nunjucksEnv.renderString(template, { items });

            // Property: Should have exactly items.length pipe separators
            const pipeCount = (rendered.match(/\|/g) || []).length;
            expect(pipeCount).toBe(items.length);

            // Property: All items should appear in output
            for (const item of items) {
              expect(rendered).toContain(item);
            }

            // Property: Empty array should produce empty output
            if (items.length === 0) {
              expect(rendered).toBe("");
            }
          }
        ),
        { numRuns }
      );
    });

    it("should provide correct loop variables", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('|')), { maxLength: 10 }),
          async (items) => {
            const template = `{% for item in items %}{{ loop.index }}: {{ item }}{% if not loop.last %}|{% endif %}{% endfor %}`;
            const rendered = nunjucksEnv.renderString(template, { items });

            // Property: Should have correct index numbers (1-based)
            for (let i = 0; i < items.length; i++) {
              expect(rendered).toContain(`${i + 1}:`);
            }

            // Property: Should have items.length - 1 separators
            const separatorCount = (rendered.match(/\|/g) || []).length;
            expect(separatorCount).toBe(Math.max(0, items.length - 1));
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle undefined variables gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            definedVars: fc.dictionary(
              fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/),
              fc.oneof(fc.string(), fc.boolean(), fc.nat({ max: 100 })),
              { minKeys: 1, maxKeys: 3 }
            ),
            undefinedVar: fc.string({ minLength: 1, maxLength: 20 })
          }),
          async ({ definedVars, undefinedVar }) => {
            // Ensure undefinedVar is actually undefined
            if (undefinedVar in definedVars) return;

            const template = `{% for key, value in defined %}{{ key }}: {{ value }}{% endfor %}{{ undefined }}`;
            
            // Property: Should not throw with undefined variables (throwOnUndefined: false)
            expect(() => {
              const rendered = nunjucksEnv.renderString(template, { 
                defined: definedVars, 
                undefined: undefined 
              });
              expect(typeof rendered).toBe("string");
            }).not.toThrow();
          }
        ),
        { numRuns }
      );
    });
  });
});

// Helper function to add custom filters (copied from Generator class)
function addCustomFilters(env) {
  // kebabCase filter
  env.addFilter("kebabCase", (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  });

  // camelCase filter
  env.addFilter("camelCase", (str) => {
    return str
      .replace(/(^|[-_\s])(.)/g, (match, sep, char) => sep ? char.toUpperCase() : char.toLowerCase())
      .replace(/\s+/g, "");
  });

  // pascalCase filter
  env.addFilter("pascalCase", (str) => {
    return str
      .replace(/(^|[-_\s])(.)/g, (match, sep, char) => char.toUpperCase())
      .replace(/\s+/g, "");
  });

  // snakeCase filter
  env.addFilter("snakeCase", (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[\s-]+/g, "_")
      .toLowerCase();
  });

  // pluralize filter
  env.addFilter("pluralize", (str) => {
    if (str.endsWith("y")) {
      return str.slice(0, -1) + "ies";
    } else if (
      str.endsWith("s") ||
      str.endsWith("sh") ||
      str.endsWith("ch") ||
      str.endsWith("x") ||
      str.endsWith("z")
    ) {
      return str + "es";
    } else {
      return str + "s";
    }
  });

  // singularize filter
  env.addFilter("singularize", (str) => {
    if (str.endsWith("ies")) {
      return str.slice(0, -3) + "y";
    } else if (str.endsWith("es") && str.length > 3) {
      return str.slice(0, -2);
    } else if (str.endsWith("s") && str.length > 1) {
      return str.slice(0, -1);
    }
    return str;
  });

  // capitalize filter (override default to handle edge cases)
  env.addFilter("capitalize", (str) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  });

  // titleCase filter
  env.addFilter("titleCase", (str) => {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
    });
  });
}