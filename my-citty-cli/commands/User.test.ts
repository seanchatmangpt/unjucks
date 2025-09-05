import { describe, it, expect, vi } from "vitest";
import { UserCommand } from "./User.js";

describe("UserCommand", () => {
  it("should have correct meta information", () => {
    expect(UserCommand.meta.name).toBe("user");
    expect(UserCommand.meta.description).toBe("Manage users and permissions");
  });

  it("should execute successfully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await UserCommand.run({ args: {} });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should handle verbose option", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await UserCommand.run({ args: { verbose: true } });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Verbose mode enabled"));
    consoleSpy.mockRestore();
  });
});