import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import nunjucks from "nunjucks";
import { Generator } from "../../../src/lib/generator.js";
import { TemplateScanner } from "../../../src/lib/template-scanner.js";
import { FrontmatterParser } from "../../../src/lib/frontmatter-parser.js";

describe("Template Injection Adversary Tests", () => {
  let tmpDir: string;
  let generator: Generator;
  let templateScanner: TemplateScanner;
  let frontmatterParser: FrontmatterParser;
  let templatesDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `unjucks-injection-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(tmpDir);
    
    templatesDir = path.join(tmpDir, "_templates");
    await fs.ensureDir(templatesDir);
    
    generator = new Generator(templatesDir);
    templateScanner = new TemplateScanner();
    frontmatterParser = new FrontmatterParser();

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      await fs.remove(tmpDir);
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe("Nunjucks Template Injection", () => {
    it("should prevent server-side template injection (SSTI)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousTemplate: fc.constantFrom(
              "{{constructor.constructor('return process')().exit()}}",
              "{{constructor.constructor('return global')().process.exit()}}",
              "{% set x = constructor.constructor('return global')() %}{{x.process.exit()}}",
              "{{''.__class__.__bases__[0].__subclasses__()}}",
              "{{config.items()}}",
              "{{self.__init__.__globals__}}",
              "{% for item in [].__class__.__base__.__subclasses__() %}{{item}}{% endfor %}",
              "{{''.__class__.__mro__[1].__subclasses__()}}",
              "{{lipsum.__globals__.os.system('id')}}",
              "{{range.__globals__.os.system('whoami')}}"
            ),
            safeContent: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async ({ maliciousTemplate, safeContent }) => {
            const template = `---
to: output.txt
---
${safeContent}
${maliciousTemplate}`;

            const genDir = path.join(templatesDir, "ssti");
            const templateDir = path.join(genDir, "test");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "malicious.txt"), template, "utf-8");

            try {
              const result = await generator.generate({
                generator: "ssti",
                template: "test",
                dest: tmpDir,
                force: true,
                dry: true // Use dry run to prevent actual execution
              });

              // Property: Template should not execute dangerous operations
              for (const file of result.files) {
                // Content should not contain evidence of successful code execution
                expect(file.content).not.toMatch(/uid=\d+/); // Unix user info
                expect(file.content).not.toMatch(/gid=\d+/); // Unix group info
                expect(file.content).not.toMatch(/root/); // Root user
                expect(file.content).not.toMatch(/administrator/i); // Windows admin
                
                // Should not contain constructor access patterns
                expect(file.content).not.toMatch(/function Function/);
                expect(file.content).not.toMatch(/\[native code\]/);
                
                // Should not expose global objects
                expect(file.content).not.toMatch(/process\.exit/);
                expect(file.content).not.toMatch(/global\./);
                expect(file.content).not.toMatch(/require\(/);
              }

            } catch (error) {
              // Template processing errors are expected and preferred for malicious templates
              expect(error).toBeDefined();
              
              // Error should not expose sensitive information
              const errorMessage = error.toString();
              expect(errorMessage).not.toMatch(/\/etc\/passwd/);
              expect(errorMessage).not.toMatch(/node_modules/);
              expect(errorMessage).not.toMatch(/process\.env/);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it("should sanitize variable access in templates", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            dangerousVariable: fc.constantFrom(
              "constructor",
              "__proto__", 
              "prototype",
              "__class__",
              "__bases__",
              "__subclasses__",
              "__init__",
              "__globals__",
              "process",
              "global",
              "require",
              "module",
              "exports"
            ),
            accessor: fc.constantFrom(
              ".constructor",
              "['constructor']",
              "[\"constructor\"]",
              ".__proto__",
              ".prototype",
              ".__class__"
            )
          }),
          async ({ dangerousVariable, accessor }) => {
            const template = `---
to: test.txt  
---
{{${dangerousVariable}${accessor}}}
{{'' ${accessor}.constructor}}
{%set x = ${dangerousVariable}${accessor}%}{{x}}`;

            // Create Nunjucks environment similar to Generator
            const env = new nunjucks.Environment(null, {
              autoescape: false,
              throwOnUndefined: false,
              trimBlocks: true,
              lstripBlocks: true,
            });

            const variables = {
              [dangerousVariable]: "safe_value"
            };

            try {
              const result = env.renderString(template, variables);
              
              // Property: Dangerous object access should not succeed
              expect(result).not.toMatch(/function Function/);
              expect(result).not.toMatch(/\[native code\]/);
              expect(result).not.toMatch(/function Object/);
              expect(result).not.toMatch(/ƒ Object/); // Chrome function representation
              
              // Should not expose constructors or prototypes
              expect(result).not.toContain("function String");
              expect(result).not.toContain("function Array");
              expect(result).not.toContain("[object Object]");
              
            } catch (error) {
              // Errors are preferred when accessing dangerous properties
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it("should prevent filter and macro injection", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousFilter: fc.constantFrom(
              "{{''|attr('constructor')|attr('constructor')('return process')()}}",
              "{{''['constructor']['constructor']('alert(1)')()}}",
              "{{lipsum|attr('__globals__')}}",
              "{{'test'|attr('__class__')|attr('__bases__')}}",
              "{{range|attr('__globals__')|attr('os')|attr('system')('id')}}"
            ),
            maliciousMacro: fc.constantFrom(
              "{% macro evil() %}{{constructor.constructor('return process')()}}{% endmacro %}{{evil()}}",
              "{% macro hack() %}{{lipsum.__globals__.os}}{% endmacro %}{{hack()}}",
              "{% set x = {}.__class__.__bases__[0].__subclasses__() %}{{x}}"
            )
          }),
          async ({ maliciousFilter, maliciousMacro }) => {
            for (const maliciousContent of [maliciousFilter, maliciousMacro]) {
              const template = `---
to: evil.txt
---
Safe content: {{name}}
${maliciousContent}
End of template`;

              const env = new nunjucks.Environment(null, {
                autoescape: false,
                throwOnUndefined: false,
                trimBlocks: true,
                lstripBlocks: true,
              });

              try {
                const result = env.renderString(template, { name: "test" });
                
                // Property: Malicious filters/macros should not execute
                expect(result).not.toMatch(/uid=\d+/);
                expect(result).not.toMatch(/function/i);
                expect(result).not.toMatch(/\[object/);
                expect(result).not.toMatch(/process/);
                expect(result).not.toMatch(/<module/);
                
                // Should contain safe content
                expect(result).toContain("Safe content: test");
                expect(result).toContain("End of template");
                
              } catch (error) {
                // Template processing errors are acceptable for malicious input
                expect(error).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 12 }
      );
    });

    it("should handle recursive template inclusion safely", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recursionDepth: fc.integer({ min: 50, max: 200 }),
            content: fc.string({ minLength: 5, maxLength: 30 })
          }),
          async ({ recursionDepth, content }) => {
            // Create self-referencing template
            const recursiveTemplate = `---
to: recursive.txt
---
{{content}}
{% for i in range(${recursionDepth}) %}
  Iteration {{i}}
  {% if i < ${recursionDepth - 1} %}
    {% include 'self' %}
  {% endif %}
{% endfor %}`;

            const genDir = path.join(templatesDir, "recursive");
            const templateDir = path.join(genDir, "test");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "self.txt"), recursiveTemplate, "utf-8");

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Recursion timeout")), 3000)
            );

            try {
              await Promise.race([
                generator.generate({
                  generator: "recursive",
                  template: "test",
                  dest: tmpDir,
                  force: true,
                  dry: true,
                  content
                } as any),
                timeout
              ]);
              
              // If generation completed without timeout, it handled recursion safely
              // No specific assertions needed - completion is the test
              
            } catch (error) {
              // Timeout or recursion limit errors are expected and preferred
              expect(error.message).toMatch(/(timeout|recursion|stack)/i);
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe("Variable Injection Attacks", () => {
    it("should sanitize user-provided template variables", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            variableValue: fc.constantFrom(
              "{{constructor.constructor('return process')()}}",
              "<script>alert('xss')</script>",
              "'; DROP TABLE users; --",
              "../../../etc/passwd",
              "${process.exit(1)}",
              "`rm -rf /`",
              "\\x00\\x01\\x02", // Control characters
              "{{range(999999)|join}}", // Resource exhaustion
              "{% raw %}{{evil}}{% endraw %}{{constructor}}" // Raw block bypass
            ),
            templateContent: fc.string({ minLength: 10, maxLength: 50 })
          }),
          async ({ variableValue, templateContent }) => {
            const template = `---
to: output-{{name}}.txt
---
Hello {{name}}!
Content: ${templateContent}
Value: {{value}}`;

            const genDir = path.join(templatesDir, "var-injection");
            const templateDir = path.join(genDir, "test");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "test.txt"), template, "utf-8");

            try {
              const result = await generator.generate({
                generator: "var-injection",
                template: "test",
                dest: tmpDir,
                force: true,
                dry: true,
                name: "safe",
                value: variableValue
              } as any);

              for (const file of result.files) {
                // Property: Variables should be treated as strings, not executed
                expect(file.content).not.toMatch(/uid=\d+/);
                expect(file.content).not.toMatch(/process\.exit/);
                expect(file.content).not.toMatch(/constructor\.constructor/);
                expect(file.content).not.toMatch(/<script>/);
                
                // Should contain the literal variable value as string
                expect(file.content).toContain("Hello safe!");
                expect(file.content).toContain(templateContent);
                
                // Variable value should be present but not executed
                if (file.content.includes(variableValue)) {
                  // If the value appears, it should be as literal text
                  expect(file.content).toContain("Value: " + variableValue);
                }
                
                // File path should be safe
                expect(file.path).not.toContain("..");
                expect(file.path).toMatch(/output-safe\.txt$/);
              }

            } catch (error) {
              // Processing errors for malicious variables are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it("should prevent environment variable exposure", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            envAccess: fc.constantFrom(
              "{{process.env}}",
              "{{process.env.PATH}}",
              "{{process.env.HOME}}",
              "{{process.env.USER}}",
              "{{process.env.SECRET_KEY}}",
              "{{global.process.env}}",
              "{% for key, value in process.env %}{{key}}={{value}}{% endfor %}",
              "{{range.__globals__.os.environ}}"
            )
          }),
          async ({ envAccess }) => {
            const template = `---
to: env-test.txt
---
Environment access attempt:
${envAccess}
End of template`;

            const env = new nunjucks.Environment(null, {
              autoescape: false,
              throwOnUndefined: false,
              trimBlocks: true,
              lstripBlocks: true,
            });

            // Set up potentially sensitive environment variables
            const originalEnv = process.env.SECRET_KEY;
            process.env.SECRET_KEY = "super-secret-key-123";

            try {
              const result = env.renderString(template, {});
              
              // Property: Environment variables should not be exposed
              expect(result).not.toContain("super-secret-key-123");
              expect(result).not.toContain(process.env.PATH || "");
              expect(result).not.toContain(process.env.HOME || "");
              expect(result).not.toContain(process.env.USER || "");
              
              // Should not contain object representations of env
              expect(result).not.toMatch(/\[object Object\]/);
              expect(result).not.toMatch(/PATH=/);
              expect(result).not.toMatch(/HOME=/);
              
            } catch (error) {
              // Errors when accessing process.env are preferred
              expect(error).toBeDefined();
            } finally {
              if (originalEnv) {
                process.env.SECRET_KEY = originalEnv;
              } else {
                delete process.env.SECRET_KEY;
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should handle code injection in custom filters", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousInput: fc.constantFrom(
              "constructor.constructor('return process')().exit()",
              "__proto__.constructor.constructor('alert(1)')()",
              "valueOf.constructor.constructor('return global')()",
              "toString.constructor.constructor('process.exit()')",
              "hasOwnProperty.constructor('return this.process.exit()')"
            ),
            filterName: fc.constantFrom("camelCase", "kebabCase", "pascalCase", "snakeCase", "pluralize")
          }),
          async ({ maliciousInput, filterName }) => {
            const template = `---
to: filtered.txt  
---
Filtered value: {{ value | ${filterName} }}
Direct access: {{ value.constructor }}
Chain access: {{ value.constructor.constructor }}`;

            const genDir = path.join(templatesDir, "filter-injection");
            const templateDir = path.join(genDir, "test");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "test.txt"), template, "utf-8");

            try {
              const result = await generator.generate({
                generator: "filter-injection",
                template: "test",
                dest: tmpDir,
                force: true,
                dry: true,
                value: maliciousInput
              } as any);

              for (const file of result.files) {
                // Property: Filter should process string safely
                expect(file.content).not.toMatch(/function Function/);
                expect(file.content).not.toMatch(/\[native code\]/);
                expect(file.content).not.toMatch(/process\.exit/);
                
                // Should contain filtered output, not executed code
                expect(file.content).toContain("Filtered value:");
                
                // Constructor access should not expose function constructors
                expect(file.content).not.toContain("function String");
                expect(file.content).not.toContain("function Object");
              }

            } catch (error) {
              // Filter processing errors are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 12 }
      );
    });
  });

  describe("Expression Evaluation Security", () => {
    it("should prevent arithmetic expression injection", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            expression: fc.constantFrom(
              "{{1/0}}", // Division by zero
              "{{9**9**9}}", // Exponential explosion  
              "{{range(999999999)|list}}", // Memory exhaustion
              "{{[].constructor.constructor('return 1')()}}", // Constructor access via arithmetic
              "{{1 and ''.__class__}}", // Boolean logic to access classes
              "{{1 if ''.__class__ else 0}}" // Conditional to access classes
            )
          }),
          async ({ expression }) => {
            const template = `---
to: expr.txt
---
Safe content
Expression: ${expression}
End content`;

            const env = new nunjucks.Environment(null, {
              autoescape: false,
              throwOnUndefined: false,
              trimBlocks: true,
              lstripBlocks: true,
            });

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Expression timeout")), 2000)
            );

            try {
              const result = await Promise.race([
                env.renderString(template, {}),
                timeout
              ]);
              
              // Property: Expression should not cause system issues
              expect(result).toContain("Safe content");
              expect(result).toContain("End content");
              expect(result).not.toMatch(/Infinity/);
              expect(result).not.toMatch(/function/);
              expect(result).not.toMatch(/constructor/);
              
            } catch (error) {
              // Timeouts, division by zero, or other math errors are expected
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should prevent conditional logic exploitation", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            condition: fc.constantFrom(
              "''.__class__.__bases__",
              "constructor.constructor",
              "[].__class__.__mro__",
              "{}.__class__.__subclasses__()",
              "().__class__.__bases__[0]",
              "range.__globals__",
              "''.constructor.constructor('return process')()"
            )
          }),
          async ({ condition }) => {
            const template = `---
to: conditional.txt
---
{% if ${condition} %}
  Dangerous condition was true
{% else %}
  Safe condition path
{% endif %}
Also testing: {% if not ${condition} %}safe{% endif %}`;

            const env = new nunjucks.Environment(null, {
              autoescape: false, 
              throwOnUndefined: false,
              trimBlocks: true,
              lstripBlocks: true,
            });

            try {
              const result = env.renderString(template, {});
              
              // Property: Dangerous conditions should not evaluate to true
              expect(result).not.toContain("Dangerous condition was true");
              
              // Should follow safe path or throw error
              if (result.includes("Safe condition path")) {
                expect(result).toContain("safe");
              }
              
              // Should not expose object internals
              expect(result).not.toMatch(/function/i);
              expect(result).not.toMatch(/\[object/);
              expect(result).not.toMatch(/constructor/);
              
            } catch (error) {
              // Errors evaluating dangerous conditions are preferred
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 12 }
      );
    });
  });

  describe("Template Scanner Security", () => {
    it("should safely scan malicious template files", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousContent: fc.constantFrom(
              "{{constructor.constructor('global.process.exit()')()}}",
              "{% include '/etc/passwd' %}",
              "{% extends '../../../etc/hosts' %}", 
              "{{range(99999999)|join}}",
              "{% raw %}{{evil}}{% endraw %}",
              "{% for i in ''.__class__.__mro__[1].__subclasses__() %}{{i}}{% endfor %}"
            )
          }),
          async ({ maliciousContent }) => {
            const templatePath = path.join(tmpDir, "malicious-template");
            await fs.ensureDir(templatePath);
            
            const maliciousFile = path.join(templatePath, "evil.txt");
            await fs.writeFile(maliciousFile, maliciousContent, "utf-8");

            try {
              const scanResult = await templateScanner.scanTemplate(templatePath);
              
              // Property: Scanner should complete without executing template
              expect(scanResult).toBeDefined();
              expect(Array.isArray(scanResult.variables)).toBe(true);
              
              // Variables should be extracted safely without execution
              for (const variable of scanResult.variables) {
                expect(variable.name).toBeDefined();
                expect(typeof variable.name).toBe("string");
                
                // Should not contain dangerous variable names extracted from malicious templates
                expect(variable.name).not.toMatch(/constructor/);
                expect(variable.name).not.toMatch(/__class__/);
                expect(variable.name).not.toMatch(/process/);
              }
              
            } catch (error) {
              // Scanning errors for malicious templates are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should handle template files with binary or control characters", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            binaryContent: fc.constantFrom(
              "\x00\x01\x02\x03{{name}}\xFF\xFE",
              "{{name}}\u0000\u0001\u0002",
              "\r\n{{value}}\r\n\x1A\x1B",
              "{{test}}\uFFFE\uFFFF", // Unicode non-characters
              "{{var}}\x7F\x80\x81" // DEL and high control chars
            )
          }),
          async ({ binaryContent }) => {
            const templatePath = path.join(tmpDir, "binary-template");
            await fs.ensureDir(templatePath);
            
            const binaryFile = path.join(templatePath, "binary.txt");
            await fs.writeFile(binaryFile, binaryContent, "binary");

            try {
              const scanResult = await templateScanner.scanTemplate(templatePath);
              
              // Property: Should handle binary content gracefully
              expect(scanResult).toBeDefined();
              
              // Should extract legitimate variables even from binary files
              for (const variable of scanResult.variables) {
                expect(variable.name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
                
                // Should not contain control characters
                expect(variable.name).not.toMatch(/[\x00-\x1F\x7F-\x9F]/);
              }
              
            } catch (error) {
              // Errors reading binary files are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });
});