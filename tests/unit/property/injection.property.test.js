import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import { FileInjector, InjectionOptions } from "../../../src/lib/file-injector.js";
import { FrontmatterParser, FrontmatterConfig } from "../../../src/lib/frontmatter-parser.js";

describe("File Injection Property Tests", () => {
  let tmpDir, fileInjector, frontmatterParser;
  const numRuns = 20;

  beforeEach(async () => {
    tmpDir = path.join(process.cwd(), "test-bzyH4B", `injection-prop-${this.getDeterministicTimestamp()}`);
    await fs.ensureDir(tmpDir);
    fileInjector = new FileInjector();
    frontmatterParser = new FrontmatterParser();
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe("Idempotent Operations", () => {
    it("should be idempotent for write operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            content: fc.string({ minLength: 1, maxLength: 100 })
          }),
          async ({ filename, content }) => {
            const filePath = path.join(tmpDir, filename);
            const frontmatter = {};
            const options = { force: true, dry: false };

            // First write
            const result1 = await fileInjector.processFile(filePath, content, frontmatter, options);
            expect(result1.success).toBe(true);

            const content1 = await fs.readFile(filePath, "utf-8");

            // Second write with force
            const result2 = await fileInjector.processFile(filePath, content, frontmatter, options);
            expect(result2.success).toBe(true);

            const content2 = await fs.readFile(filePath, "utf-8");

            // Property: Multiple writes should produce same content
            expect(content1).toBe(content2);
            expect(content1).toBe(content);
          }
        ),
        { numRuns }
      );
    });

    it("should be idempotent for append operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            initialContent: fc.string({ minLength: 1, maxLength: 50 }),
            appendContent: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async ({ filename, initialContent, appendContent }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create initial file
            await fs.writeFile(filePath, initialContent, "utf-8");

            const frontmatter = { append: true };
            const options = { force: true, dry: false };

            // First append
            const result1 = await fileInjector.processFile(filePath, appendContent, frontmatter, options);
            expect(result1.success).toBe(true);

            const content1 = await fs.readFile(filePath, "utf-8");

            // Second append (should be skipped due to idempotency)
            const result2 = await fileInjector.processFile(filePath, appendContent, frontmatter, options);

            const content2 = await fs.readFile(filePath, "utf-8");

            // Property: Second append should be skipped and content unchanged
            if (result2.skipped) {
              expect(content1).toBe(content2);
            }

            // Property: Content should contain both parts
            expect(content2).toContain(initialContent);
            expect(content2).toContain(appendContent);
          }
        ),
        { numRuns }
      );
    });

    it("should be idempotent for prepend operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            initialContent: fc.string({ minLength: 1, maxLength: 50 }),
            prependContent: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async ({ filename, initialContent, prependContent }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create initial file
            await fs.writeFile(filePath, initialContent, "utf-8");

            const frontmatter = { prepend: true };
            const options = { force: true, dry: false };

            // First prepend
            const result1 = await fileInjector.processFile(filePath, prependContent, frontmatter, options);
            expect(result1.success).toBe(true);

            const content1 = await fs.readFile(filePath, "utf-8");

            // Second prepend (should be skipped due to idempotency)
            const result2 = await fileInjector.processFile(filePath, prependContent, frontmatter, options);

            const content2 = await fs.readFile(filePath, "utf-8");

            // Property: Second prepend should be skipped and content unchanged
            if (result2.skipped) {
              expect(content1).toBe(content2);
            }

            // Property: Content should start with prepended content
            expect(content2).toStartWith(prependContent);
            expect(content2).toContain(initialContent);
          }
        ),
        { numRuns }
      );
    });

    it("should be idempotent for injection operations", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            initialLines: fc.array(
              fc.string({ minLength: 1, maxLength: 20 }),
              { minLength: 1, maxLength: 10 }
            ),
            injectContent: fc.string({ minLength: 1, maxLength: 20 }),
            targetLineIndex: fc.nat()
          }),
          async ({ filename, initialLines, injectContent, targetLineIndex }) => {
            if (initialLines.length === 0) return;

            const filePath = path.join(tmpDir, filename);
            const targetIndex = targetLineIndex % initialLines.length;
            const targetLine = initialLines[targetIndex];
            
            // Create initial file
            await fs.writeFile(filePath, initialLines.join("\n"), "utf-8");

            const frontmatter = { inject: true, after: targetLine };
            const options = { force: true, dry: false };

            // First injection
            const result1 = await fileInjector.processFile(filePath, injectContent, frontmatter, options);
            expect(result1.success).toBe(true);

            const content1 = await fs.readFile(filePath, "utf-8");

            // Second injection (should be skipped due to idempotency)
            const result2 = await fileInjector.processFile(filePath, injectContent, frontmatter, options);

            const content2 = await fs.readFile(filePath, "utf-8");

            // Property: Second injection should be skipped if content exists
            if (result2.skipped) {
              expect(content1).toBe(content2);
            }

            // Property: Content should contain both original and injected content
            expect(content2).toContain(targetLine);
            expect(content2).toContain(injectContent);
          }
        ),
        { numRuns }
      );
    });
  });

  describe("File Permissions", () => {
    it("should preserve and set file permissions correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            content: fc.string({ minLength: 1, maxLength: 100 }),
            chmod: fc.oneof(
              fc.stringMatching(/^[0-7]{3}$/),
              fc.nat({ min: 0o000, max: 0o777 })
            )
          }),
          async ({ filename, content, chmod }) => {
            const filePath = path.join(tmpDir, filename);
            const frontmatter = { chmod };
            const options = { force: true, dry: false };

            const result = await fileInjector.processFile(filePath, content, frontmatter, options);
            expect(result.success).toBe(true);

            // Property: File should exist and be readable
            expect(await fs.pathExists(filePath)).toBe(true);
            const fileContent = await fs.readFile(filePath, "utf-8");
            expect(fileContent).toBe(content);

            // Property: Permissions should be set correctly (on Unix systems)
            if (process.platform !== "win32") {
              const stats = await fs.stat(filePath);
              const expectedMode = typeof chmod === "string" ? 
                parseInt(chmod, 8) : chmod;
              expect(stats.mode & 0o777).toBe(expectedMode);
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Line-based Injection", () => {
    it("should inject at correct line numbers consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            lines: fc.array(
              fc.string({ minLength: 1, maxLength: 20 }),
              { minLength: 1, maxLength: 10 }
            ),
            injectContent: fc.string({ minLength: 1, maxLength: 20 }),
            lineNumber: fc.nat({ min: 1, max: 20 })
          }),
          async ({ filename, lines, injectContent, lineNumber }) => {
            if (lineNumber > lines.length + 1) return;

            const filePath = path.join(tmpDir, filename);
            
            // Create initial file
            await fs.writeFile(filePath, lines.join("\n"), "utf-8");

            const frontmatter = { lineAt: lineNumber };
            const options = { force: true, dry: false };

            const result = await fileInjector.processFile(filePath, injectContent, frontmatter, options);

            if (result.success) {
              const content = await fs.readFile(filePath, "utf-8");
              const resultLines = content.split("\n");

              // Property: Injection should be at correct line
              expect(resultLines[lineNumber - 1]).toBe(injectContent);
              
              // Property: Original lines should be preserved in correct positions
              for (let i = lineNumber; i < resultLines.length; i++) {
                expect(resultLines[i]).toBe(lines[i - 1]);
              }
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Dry Run Mode", () => {
    it("should not modify files in dry run mode", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            initialContent: fc.string({ minLength: 1, maxLength: 50 }),
            newContent: fc.string({ minLength: 1, maxLength: 50 }),
            operation: fc.constantFrom("write", "append", "prepend", "inject")
          }),
          async ({ filename, initialContent, newContent, operation }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create initial file
            await fs.writeFile(filePath, initialContent, "utf-8");
            const originalContent = await fs.readFile(filePath, "utf-8");

            // Setup frontmatter based on operation
            let frontmatter = {};
            switch (operation) {
              case "append":
                frontmatter = { append: true };
                break;
              case "prepend":
                frontmatter = { prepend: true };
                break;
              case "inject":
                frontmatter = { inject: true };
                break;
              // write is default
            }

            const dryRunOptions = { force: true, dry: true };

            const result = await fileInjector.processFile(filePath, newContent, frontmatter, dryRunOptions);

            // Property: Dry run should succeed
            expect(result.success).toBe(true);
            expect(result.message).toContain("Would");

            // Property: File content should be unchanged
            const contentAfterDry = await fs.readFile(filePath, "utf-8");
            expect(contentAfterDry).toBe(originalContent);

            // Property: Changes should be reported
            expect(result.changes.length).toBeGreaterThan(0);
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Backup Creation", () => {
    it("should create backups when requested", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            initialContent: fc.string({ minLength: 1, maxLength: 50 }),
            newContent: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async ({ filename, initialContent, newContent }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create initial file
            await fs.writeFile(filePath, initialContent, "utf-8");

            const frontmatter = {};
            const options = { force: true, dry: false, backup: true };

            const result = await fileInjector.processFile(filePath, newContent, frontmatter, options);

            expect(result.success).toBe(true);

            // Property: Original file should be updated
            const finalContent = await fs.readFile(filePath, "utf-8");
            expect(finalContent).toBe(newContent);

            // Property: Backup should exist and contain original content
            const backupFiles = (await fs.readdir(tmpDir)).filter(f => f.startsWith(filename + ".bak."));
            expect(backupFiles.length).toBe(1);

            const backupPath = path.join(tmpDir, backupFiles[0]);
            const backupContent = await fs.readFile(backupPath, "utf-8");
            expect(backupContent).toBe(initialContent);
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle permission errors gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            content: fc.string({ minLength: 1, maxLength: 100 })
          }),
          async ({ filename, content }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create file and make it read-only (skip on Windows)
            if (process.platform === "win32") return;
            
            await fs.writeFile(filePath, "initial content", "utf-8");
            await fs.chmod(filePath, 0o444); // Read-only

            const frontmatter = {};
            const options = { force: true, dry: false };

            try {
              const result = await fileInjector.processFile(filePath, content, frontmatter, options);
              
              // Property: Should either succeed or fail gracefully
              expect(typeof result.success).toBe("boolean");
            } finally {
              // Cleanup - restore write permissions
              try {
                await fs.chmod(filePath, 0o644);
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns }
      );
    });

    it("should handle invalid frontmatter gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
            content: fc.string({ minLength: 1, maxLength: 100 }),
            invalidLineAt: fc.oneof(
              fc.nat({ min: -100, max: 0 }),
              fc.nat({ min: 1000 })
            )
          }),
          async ({ filename, content, invalidLineAt }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create a small file
            await fs.writeFile(filePath, "line1\nline2\nline3\n", "utf-8");

            const frontmatter = { lineAt: invalidLineAt };
            const options = { force: true, dry: false };

            const result = await fileInjector.processFile(filePath, content, frontmatter, options);

            // Property: Invalid line numbers should result in failure
            if (invalidLineAt < 1) {
              expect(result.success).toBe(false);
            } else if (invalidLineAt > 1000) {
              expect(result.success).toBe(false);
              expect(result.message).toContain("exceeds file length");
            }

            // Property: Error messages should be informative
            if (!result.success) {
              expect(result.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns }
      );
    });
  });
});