import { describe, it, expect, vi } from "vitest";
import { TaskCommand } from "./Task.js";

describe("TaskCommand", () => {
  it("should have correct meta information", () => {
    expect(TaskCommand.meta.name).toBe("task");
    expect(TaskCommand.meta.description).toBe("Manage tasks in your project");
  });

  it("should execute successfully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await TaskCommand.run({ args: {} });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle verbose option", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await TaskCommand.run({ args: { verbose: true } });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Verbose mode enabled"));
    consoleSpy.mockRestore();
  });
});