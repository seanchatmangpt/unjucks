import { describe, it, expect, vi } from "vitest";
import { ProjectCommand } from "./Project.js";

describe("ProjectCommand", () => {
  it("should have correct meta information", () => {
    expect(ProjectCommand.meta.name).toBe("project");
    expect(ProjectCommand.meta.description).toBe("Manage project settings and configuration");
  });

  it("should execute successfully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await ProjectCommand.run({ args: {} });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle verbose option", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await ProjectCommand.run({ args: { verbose: true } });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Verbose mode enabled"));
    consoleSpy.mockRestore();
  });
});