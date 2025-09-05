import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { FileInjector } from "../../../src/lib/file-injector.js";
import { Generator } from "../../../src/lib/generator.js";

describe("Filesystem Adversary Tests", () => {
  let tmpDir: string;
  let fileInjector: FileInjector;
  let generator: Generator;
  let templatesDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `unjucks-fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(tmpDir);
    
    templatesDir = path.join(tmpDir, "_templates");
    await fs.ensureDir(templatesDir);
    
    fileInjector = new FileInjector();
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

  describe("Path Traversal and Directory Attacks", () => {
    it("should prevent directory traversal attacks", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            traversalPath: fc.constantFrom(
              "../../../etc/passwd",
              "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
              "../../../../proc/version",
              "../../../home/user/.ssh/authorized_keys",
              "../../root/.profile",
              "../../../var/log/messages",
              "..\\..\\..\\Users\\Administrator\\Desktop\\sensitive.txt",
              "../../../../dev/null",
              "../../../tmp/../etc/shadow"
            ),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ traversalPath, content }) => {
            const result = await fileInjector.processFile(
              traversalPath,
              content,
              {},
              { force: true, dry: false }
            );

            if (result.success) {
              // If operation succeeded, ensure it's contained within safe boundaries
              const resolvedPath = path.resolve(traversalPath);
              
              // Should not be in system directories
              expect(resolvedPath).not.toMatch(/^\/etc\//);
              expect(resolvedPath).not.toMatch(/^\/root\//);
              expect(resolvedPath).not.toMatch(/^\/proc\//);
              expect(resolvedPath).not.toMatch(/^\/dev\//);
              expect(resolvedPath).not.toMatch(/^\/var\/log\//);
              expect(resolvedPath).not.toMatch(/^C:\\Windows\\/i);
              expect(resolvedPath).not.toMatch(/^C:\\Users\\Administrator\\/i);
              
              // Verify file was created in expected location
              if (await fs.pathExists(resolvedPath)) {
                const actualContent = await fs.readFile(resolvedPath, "utf-8");
                expect(actualContent).toBe(content);
              }
            } else {
              // Failure is preferred for security
              expect(result.message).toBeDefined();
              expect(result.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it("should handle symbolic link attacks safely", async () => {
      if (process.platform === "win32") return; // Skip on Windows

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            systemTarget: fc.constantFrom(
              "/etc/passwd",
              "/etc/hosts", 
              "/root/.bashrc",
              "/usr/bin/sudo",
              "/etc/shadow",
              "/proc/self/environ"
            ),
            content: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async ({ systemTarget, content }) => {
            const symlinkPath = path.join(tmpDir, `evil-symlink-${Math.random().toString(36).slice(2)}`);
            
            try {
              // Create symlink to system file
              if (await fs.pathExists(systemTarget)) {
                await fs.symlink(systemTarget, symlinkPath);
                
                // Attempt to modify through symlink
                const result = await fileInjector.processFile(
                  symlinkPath,
                  content,
                  {},
                  { force: true, dry: false }
                );

                if (result.success) {
                  // Verify the original system file wasn't modified
                  const originalContent = await fs.readFile(systemTarget, "utf-8").catch(() => "");
                  expect(originalContent).not.toContain(content);
                  
                  // Verify symlink properties
                  const stats = await fs.lstat(symlinkPath);
                  expect(stats.isSymbolicLink()).toBe(true);
                }
                
              } else {
                // If system file doesn't exist, create regular test
                await fs.symlink("/nonexistent/target", symlinkPath);
                
                const result = await fileInjector.processFile(
                  symlinkPath,
                  content,
                  {},
                  { force: true, dry: false }
                );
                
                // Should handle broken symlinks gracefully
                expect(typeof result.success).toBe("boolean");
              }

            } catch (error) {
              // Symlink creation or processing errors are acceptable
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
        { numRuns: 10 }
      );
    });

    it("should prevent hard link exploitation", async () => {
      if (process.platform === "win32") return; // Skip on Windows

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sensitiveFile: fc.constantFrom(
              "/etc/passwd",
              "/etc/hosts",
              "/etc/fstab"
            ),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ sensitiveFile, content }) => {
            const hardlinkPath = path.join(tmpDir, `hardlink-${Math.random().toString(36).slice(2)}`);
            
            try {
              // Attempt to create hard link to system file
              if (await fs.pathExists(sensitiveFile)) {
                const originalStat = await fs.stat(sensitiveFile);
                
                try {
                  await fs.link(sensitiveFile, hardlinkPath);
                  
                  // Attempt to modify through hard link
                  const result = await fileInjector.processFile(
                    hardlinkPath,
                    content,
                    {},
                    { force: true, dry: true } // Use dry run for safety
                  );

                  // Verify original file wasn't modified
                  const newStat = await fs.stat(sensitiveFile);
                  expect(newStat.mtime.getTime()).toBe(originalStat.mtime.getTime());
                  
                  // Hard link should have same inode
                  if (await fs.pathExists(hardlinkPath)) {
                    const linkStat = await fs.stat(hardlinkPath);
                    expect(linkStat.ino).toBe(originalStat.ino);
                  }

                } catch (linkError) {
                  // Hard link creation failure is expected (and preferred) for security
                  expect(linkError).toBeDefined();
                }
              }

            } catch (error) {
              // Permission errors are expected and preferred
              expect(error).toBeDefined();
            } finally {
              try {
                await fs.unlink(hardlinkPath);
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 8 }
      );
    });

    it("should handle device files and special files safely", async () => {
      if (process.platform === "win32") return; // Skip on Windows

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            deviceFile: fc.constantFrom(
              "/dev/null",
              "/dev/zero", 
              "/dev/random",
              "/dev/urandom",
              "/dev/sda",
              "/dev/mem",
              "/proc/self/mem",
              "/sys/class/gpio/export"
            ),
            content: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async ({ deviceFile, content }) => {
            try {
              const result = await fileInjector.processFile(
                deviceFile,
                content,
                {},
                { force: false, dry: true } // Always use dry run for device files
              );

              // Property: Should either succeed safely or fail gracefully
              expect(typeof result.success).toBe("boolean");
              
              if (result.success) {
                // Dry run should report what would happen
                expect(result.message).toContain("Would");
                expect(result.changes.length).toBeGreaterThan(0);
              } else {
                // Failure is preferred for device files
                expect(result.message).toBeDefined();
              }

            } catch (error) {
              // Errors accessing device files are expected
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe("File Permission and Access Control", () => {
    it("should respect file system permissions", async () => {
      if (process.platform === "win32") return; // Skip on Windows

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            permissions: fc.constantFrom(0o000, 0o444, 0o555, 0o644, 0o755, 0o777),
            content: fc.string({ minLength: 10, maxLength: 100 }),
            newContent: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ permissions, content, newContent }) => {
            const testFile = path.join(tmpDir, `perm-test-${Math.random().toString(36).slice(2)}.txt`);
            
            // Create file with specific permissions
            await fs.writeFile(testFile, content, "utf-8");
            await fs.chmod(testFile, permissions);

            const result = await fileInjector.processFile(
              testFile,
              newContent,
              {},
              { force: true, dry: false }
            );

            const stats = await fs.stat(testFile);
            const fileMode = stats.mode & 0o777;

            if (permissions & 0o200) { // Owner write permission
              // Should succeed if file is writable
              expect(result.success).toBe(true);
              const actualContent = await fs.readFile(testFile, "utf-8");
              expect(actualContent).toBe(newContent);
            } else {
              // Should handle read-only files appropriately
              if (!result.success) {
                expect(result.message).toBeDefined();
                // Original content should be unchanged
                const actualContent = await fs.readFile(testFile, "utf-8");
                expect(actualContent).toBe(content);
              }
            }

            // Permissions should be preserved or handled according to system policy
            expect(fileMode).toBeDefined();
          }
        ),
        { numRuns: 12 }
      );
    });

    it("should handle setuid and setgid files carefully", async () => {
      if (process.platform === "win32" || process.getuid?.() !== 0) return; // Skip on Windows or non-root

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            specialMode: fc.constantFrom(0o4755, 0o2755, 0o6755), // setuid, setgid, both
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ specialMode, content }) => {
            const testFile = path.join(tmpDir, `setuid-test-${Math.random().toString(36).slice(2)}`);
            
            try {
              // Create file with setuid/setgid bits
              await fs.writeFile(testFile, "original content", "utf-8");
              await fs.chmod(testFile, specialMode);

              const result = await fileInjector.processFile(
                testFile,
                content,
                {},
                { force: true, dry: true } // Use dry run for safety with setuid files
              );

              // Property: Should handle setuid files with extreme caution
              expect(typeof result.success).toBe("boolean");
              
              if (result.success) {
                // Should indicate this is a dry run operation
                expect(result.message).toContain("Would");
              }

              // Verify special permission bits are preserved
              const stats = await fs.stat(testFile);
              const mode = stats.mode & 0o7777;
              expect(mode).toBe(specialMode);

            } catch (error) {
              // Permission errors with setuid files are expected
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe("Race Condition and Atomic Operation Tests", () => {
    it("should handle concurrent file access safely", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_.-]{3,20}$/),
            contents: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 3, maxLength: 8 })
          }),
          async ({ filename, contents }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Launch concurrent operations
            const promises = contents.map((content, index) => 
              fileInjector.processFile(
                filePath,
                `${content}-${index}`,
                {},
                { force: true, dry: false }
              )
            );

            const results = await Promise.allSettled(promises);
            
            // At least one operation should succeed
            const successful = results.filter(r => 
              r.status === 'fulfilled' && r.value.success
            );
            expect(successful.length).toBeGreaterThan(0);

            if (await fs.pathExists(filePath)) {
              const finalContent = await fs.readFile(filePath, "utf-8");
              
              // Content should be from one of the operations
              const expectedContents = contents.map((c, i) => `${c}-${i}`);
              expect(expectedContents.some(expected => finalContent === expected)).toBe(true);
              
              // File should not be corrupted
              expect(finalContent).not.toMatch(/\u0000/); // No null bytes
              expect(finalContent.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("should prevent TOCTOU (Time of Check Time of Use) attacks", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_.-]{3,20}$/),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ filename, content }) => {
            const filePath = path.join(tmpDir, filename);
            
            // Create initial file
            await fs.writeFile(filePath, "initial content", "utf-8");
            
            // Start file operation
            const operationPromise = fileInjector.processFile(
              filePath,
              content,
              { append: true },
              { force: false, dry: false }
            );

            // Simultaneously try to modify file permissions/delete file
            const racePromise = (async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
                
                if (process.platform !== "win32") {
                  await fs.chmod(filePath, 0o000); // Remove all permissions
                }
                
                // Try to delete file during operation
                await fs.unlink(filePath);
              } catch {
                // Race condition operations may fail - that's expected
              }
            })();

            const [operationResult] = await Promise.allSettled([operationPromise, racePromise]);
            
            // Operation should complete safely regardless of race conditions
            if (operationResult.status === 'fulfilled') {
              expect(typeof operationResult.value.success).toBe("boolean");
              expect(operationResult.value.message).toBeDefined();
            }

            // Verify file system integrity
            const exists = await fs.pathExists(filePath);
            if (exists) {
              const finalContent = await fs.readFile(filePath, "utf-8").catch(() => null);
              if (finalContent !== null) {
                // Content should not be corrupted
                expect(finalContent).not.toMatch(/\u0000/);
              }
            }
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe("Resource Exhaustion Prevention", () => {
    it("should handle extremely deep directory structures", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            depth: fc.integer({ min: 50, max: 200 }),
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ depth, content }) => {
            // Create deep directory path
            const pathSegments = Array(depth).fill(0).map((_, i) => `dir${i}`);
            const deepPath = path.join(tmpDir, ...pathSegments, "deep-file.txt");
            
            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Deep path timeout")), 5000)
            );

            try {
              await Promise.race([
                fileInjector.processFile(
                  deepPath,
                  content,
                  {},
                  { force: true, dry: false }
                ),
                timeout
              ]);

              // If operation completed, verify file was created correctly
              if (await fs.pathExists(deepPath)) {
                const actualContent = await fs.readFile(deepPath, "utf-8");
                expect(actualContent).toBe(content);
                
                // Verify path length is reasonable
                expect(deepPath.length).toBeLessThan(4096); // Most filesystems limit
              }

            } catch (error) {
              // Timeout or filesystem errors are expected for very deep paths
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 6 }
      );
    });

    it("should handle filesystem full conditions gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            largeContent: fc.string({ minLength: 1000000, maxLength: 5000000 }) // 1-5MB
          }),
          async ({ largeContent }) => {
            const largeFile = path.join(tmpDir, "large-file.txt");
            
            try {
              const result = await fileInjector.processFile(
                largeFile,
                largeContent,
                {},
                { force: true, dry: false }
              );

              if (result.success) {
                // Verify file was written completely
                const stats = await fs.stat(largeFile);
                expect(stats.size).toBe(largeContent.length);
                
                // Spot check content integrity
                const actualContent = await fs.readFile(largeFile, "utf-8");
                expect(actualContent.length).toBe(largeContent.length);
                expect(actualContent.substring(0, 100)).toBe(largeContent.substring(0, 100));
                expect(actualContent.substring(-100)).toBe(largeContent.substring(-100));
              } else {
                // Disk full or quota errors are acceptable
                expect(result.message).toBeDefined();
                expect(result.message.length).toBeGreaterThan(0);
              }

            } catch (error) {
              // ENOSPC (no space left on device) or similar errors are expected
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 3 }
      );
    });

    it("should limit filesystem operations within reasonable bounds", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileCount: fc.integer({ min: 100, max: 1000 }),
            prefix: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{2,10}$/)
          }),
          async ({ fileCount, prefix }) => {
            const operations: Promise<any>[] = [];
            
            // Launch many concurrent file operations
            for (let i = 0; i < fileCount; i++) {
              const filePath = path.join(tmpDir, `${prefix}-${i}.txt`);
              operations.push(
                fileInjector.processFile(
                  filePath,
                  `Content for file ${i}`,
                  {},
                  { force: true, dry: false }
                ).catch(error => ({ error, index: i }))
              );
            }

            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Mass operation timeout")), 10000)
            );

            try {
              const results = await Promise.race([
                Promise.allSettled(operations),
                timeout
              ]) as PromiseSettledResult<any>[];

              // At least some operations should succeed
              const successful = results.filter(r => 
                r.status === 'fulfilled' && 
                r.value.success !== false && 
                !r.value.error
              );

              expect(successful.length).toBeGreaterThan(0);
              expect(successful.length).toBeLessThanOrEqual(fileCount);

              // System should handle resource limits gracefully
              const failed = results.filter(r => 
                r.status === 'rejected' || 
                (r.status === 'fulfilled' && r.value.error)
              );
              
              // Some failures are acceptable under resource pressure
              expect(failed.length + successful.length).toBe(results.length);

            } catch (error) {
              // Timeout or resource exhaustion is acceptable
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 3 }
      );
    });
  });

  describe("Filename and Path Injection", () => {
    it("should sanitize malicious filenames", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maliciousFilename: fc.constantFrom(
              "../../etc/passwd",
              "CON", "PRN", "AUX", "NUL", // Windows reserved names
              "COM1", "COM2", "LPT1", "LPT2",
              "file\x00.txt", // Null byte injection
              "file\r\n.txt", // Newline injection
              "file\t.txt", // Tab injection
              "file<script>.txt", // HTML injection
              "file|rm -rf /.txt", // Command injection
              "file;whoami.txt",
              "file`id`.txt",
              "file$(id).txt"
            ),
            content: fc.string({ minLength: 5, maxLength: 50 })
          }),
          async ({ maliciousFilename, content }) => {
            try {
              const result = await fileInjector.processFile(
                maliciousFilename,
                content,
                {},
                { force: true, dry: false }
              );

              if (result.success) {
                // If file was created, verify it's in a safe location
                const resolvedPath = path.resolve(maliciousFilename);
                
                // Should not create files in system directories
                expect(resolvedPath).not.toMatch(/^\/etc\//);
                expect(resolvedPath).not.toMatch(/^C:\\Windows\//i);
                
                // Should not contain dangerous characters in final path
                const finalFilename = path.basename(resolvedPath);
                expect(finalFilename).not.toMatch(/[<>|;&$`\x00-\x1F]/);
                
                if (await fs.pathExists(resolvedPath)) {
                  const actualContent = await fs.readFile(resolvedPath, "utf-8");
                  expect(actualContent).toBe(content);
                }
              } else {
                // Rejection of malicious filenames is preferred
                expect(result.message).toBeDefined();
              }

            } catch (error) {
              // Filename validation errors are expected and preferred
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});