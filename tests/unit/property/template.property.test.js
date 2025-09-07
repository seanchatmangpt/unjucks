import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";
import { TemplateScanner } from "../../../src/lib/template-scanner.js";

describe("Template Rendering Property Tests", () => {
  let tmpDir;
  let nunjucksEnv;
  
  beforeEach(async () => {
    tmpDir = path.join(process.cwd(), "test-bzyH4B", `template-prop-${Date.now()}`);
    await fs.ensureDir(tmpDir);
    
    nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined,
      trimBlocks,
      lstripBlocks,
    });

    // Add the same custom filters
    addCustomFilters(nunjucksEnv);
    templateScanner = new TemplateScanner();
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe("Variable Substitution", () => { it("should substitute all variables consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            variables),
              fc.oneof(
                fc.string({ minLength }
            ),
            templateContent: fc.string({ minLength }),
          async ({ variables, templateContent }) => {
            const variableNames = Object.keys(variables);
            
            // Create template with all variables
            const template = variableNames
              .map(name => `{{ ${name} }}`)
              .join(" ") + " " + templateContent;

            const rendered = nunjucksEnv.renderString(template, variables);

            // Property: All variables should be substituted
            for (const [name, value] of Object.entries(variables)) { expect(rendered).toContain(String(value));
              // Property } }}`);
            }

            // Property: Template content should be preserved
            expect(rendered).toContain(templateContent);
          }
        ),
        { numRuns }
      );
    });

    it("should handle nested object variables correctly", async () => { await fc.assert(
        fc.asyncProperty(
          fc.record({
            nestedObject })
            })
          }),
          async ({ nestedObject }) => { const template = "Name }}, Enabled: {{ obj.config.enabled }}, Count: {{ obj.config.count }}";
            const rendered = nunjucksEnv.renderString(template, { obj });

            // Property: Nested properties should be accessible and rendered
            expect(rendered).toContain(`Name);
            expect(rendered).toContain(`Enabled);
            expect(rendered).toContain(`Count);
            
            // Property: No unresolved nested variables
            expect(rendered).not.toMatch(/\{\{\s*obj\.[^}]+\s*\}\}/);
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Filter Application", () => { it("should apply filters deterministically", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength },
              { name },
              { name },
              { name },
              { name },
              { name }
            ];

            for (const filter of filters) {
              const template = `{{ input | ${filter.name} }}`;
              const result1 = nunjucksEnv.renderString(template, { input });
              const result2 = nunjucksEnv.renderString(template, { input });

              // Property: Filter should be deterministic
              expect(result1).toBe(result2);

              // Property: Filter output should match expected pattern
              if (filter.pattern && inputString.length > 0) {
                expect(result1.trim()).toMatch(filter.pattern);
              }
            }
          }
        ),
        { numRuns }
      );
    });

    it("should handle pluralization consistently", async () => { await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength }
          ),
          async (words) => {
            for (const word of words) {
              const pluralTemplate = "{{ word | pluralize }}";
              const singularTemplate = "{{ word | pluralize | singularize }}";

              const plural = nunjucksEnv.renderString(pluralTemplate, { word });
              const backToSingular = nunjucksEnv.renderString(singularTemplate, { word });

              // Property: Pluralization should add something (usually)
              if (!word.endsWith('s')) {
                expect(plural.length).toBeGreaterThanOrEqual(word.length);
              }

              // Property: Double transformation should be stable for many cases
              const doublePlural = nunjucksEnv.renderString(pluralTemplate, { word });
              expect(doublePlural).toBe(plural);

              // Property: Pluralize then singularize should often return to original
              // Note: This isn't always true due to English complexity, but should work for simple cases
              if (word.match(/^[a-z]+$/) && !word.endsWith('s')) {
                expect(backToSingular).toBe(word);
              }
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Conditional Rendering", () => { it("should handle if/else conditions correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            condition),
            trueValue }),
          async ({ condition, trueValue, falseValue }) => {
            const template = `{% if enabled %}${trueValue}{% else %}${falseValue}{% endif %}`;
            const rendered = nunjucksEnv.renderString(template, { enabled });

            // Property: Should render exactly one of the branches
            if (condition) {
              expect(rendered).toBe(trueValue);
              expect(rendered).not.toContain(falseValue);
            } else {
              expect(rendered).toBe(falseValue);
              expect(rendered).not.toContain(trueValue);
            }
          }
        ),
        { numRuns }
      );
    });

    it("should handle complex boolean expressions", async () => { await fc.assert(
        fc.asyncProperty(
          fc.record({
            a),
            b }),
          async ({ a, b, value }) => { const templates = [
              { template }${value}{% endif %}`, expected: a && b },
              { template }${value}{% endif %}`, expected: a || b },
              { template }${value}{% endif %}`, expected: !a }
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

  describe("Loop Rendering", () => { it("should render loops with correct iteration count", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength }),
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

    it("should provide correct loop variables", async () => { await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength }),
          async (items) => {
            const template = `{% for item in items %}{{ loop.index }}: {{ item }}{% if not loop.last %}|{% endif %}{% endfor %}`;
            const rendered = nunjucksEnv.renderString(template, { items });

            // Property: Should have correct index numbers (1-based)
            for (let i = 0; i < items.length; i++) {
              expect(rendered).toContain(`${i + 1});
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

  describe("Error Handling", () => { it("should handle undefined variables gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            definedVars),
              fc.string({ minLength }),
          async ({ definedVars, undefinedVar }) => {
            // Ensure undefinedVar is actually undefined
            if (undefinedVar in definedVars) return;

            const template = `{% for key, value in defined %}{{ key }}: {{ value }}{% endfor %}{{ undefined }}`;
            
            // Property: Should not throw with undefined variables (throwOnUndefined)
            expect(() => { const rendered = nunjucksEnv.renderString(template, { 
                defined, 
                undefined });
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
  env.addFilter("camelCase", (str) => { return str
      .replace(/(? })
      .replace(/\s+/g, "");
  });

  // pascalCase filter
  env.addFilter("pascalCase", (str) => { return str
      .replace(/(? })
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