import fs from "fs-extra";
import path from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

export interface TestContext {
  tempDir: string;
  originalCwd: string;
}

export class TestHelper {
  private tempDir: string;
  private originalCwd: string;

  constructor() {
    this.tempDir = "";
    this.originalCwd = process.cwd();
  }

  async setupTempDir(): Promise<string> {
    this.tempDir = await fs.mkdtemp(path.join(process.cwd(), "test-"));
    return this.tempDir;
  }

  async cleanup(): Promise<void> {
    if (this.tempDir && await fs.pathExists(this.tempDir)) {
      await fs.remove(this.tempDir);
    }
    process.chdir(this.originalCwd);
  }

  getTempDir(): string {
    return this.tempDir;
  }

  async createFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.tempDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = path.join(this.tempDir, dirPath);
    await fs.ensureDir(fullPath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.tempDir, filePath);
    return await fs.pathExists(fullPath);
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.tempDir, filePath);
    return await fs.readFile(fullPath, "utf8");
  }

  async listFiles(dirPath: string = ""): Promise<string[]> {
    const fullPath = path.join(this.tempDir, dirPath);
    if (!await fs.pathExists(fullPath)) {
      return [];
    }
    return await fs.readdir(fullPath);
  }

  async runCli(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const cliPath = path.join(process.cwd(), "dist", "cli.mjs");
    const fullCommand = `node "${cliPath}" ${command}`;
    
    try {
      const stdout = execSync(fullCommand, { 
        cwd: this.tempDir,
        encoding: "utf-8",
        stdio: "pipe"
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: any) {
      console.log(`CLI Command failed: ${fullCommand}`);
      console.log(`Exit code: ${error.status || 1}`);
      console.log(`Stdout: ${error.stdout || ""}`);
      console.log(`Stderr: ${error.stderr || ""}`);
      return { 
        stdout: error.stdout || "", 
        stderr: error.stderr || "", 
        exitCode: error.status || 1 
      };
    }
  }

  async changeToTempDir(): Promise<void> {
    process.chdir(this.tempDir);
  }
}

export function createTestContext(): TestContext {
  return {
    tempDir: "",
    originalCwd: process.cwd(),
  };
}

export async function setupTestEnvironment(): Promise<TestHelper> {
  const helper = new TestHelper();
  await helper.setupTempDir();
  return helper;
}

export async function cleanupTestEnvironment(helper: TestHelper): Promise<void> {
  await helper.cleanup();
}
