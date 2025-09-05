import { describe, expect, it } from "vitest";
import { Generator, TemplateScanner } from "../src/index.ts";

describe("Unjucks Core Functionality", () => {
  it("should export Generator class", () => {
    expect(Generator).toBeDefined();
    expect(typeof Generator).toBe("function");
  });

  it("should export TemplateScanner class", () => {
    expect(TemplateScanner).toBeDefined();
    expect(typeof TemplateScanner).toBe("function");
  });

  it("should create Generator instance", () => {
    const generator = new Generator();
    expect(generator).toBeInstanceOf(Generator);
  });

  it("should create TemplateScanner instance", () => {
    const scanner = new TemplateScanner();
    expect(scanner).toBeInstanceOf(TemplateScanner);
  });
});
