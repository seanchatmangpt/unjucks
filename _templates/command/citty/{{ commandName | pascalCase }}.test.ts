import { describe, it, expect, vi } from "vitest";
import { {{ commandName | pascalCase }}Command } from "./{{ commandName | pascalCase }}.js";

describe("{{ commandName | pascalCase }}Command", () => {
  it("should have correct meta information", () => {
    expect({{ commandName | pascalCase }}Command.meta.name).toBe("{{ commandName | kebabCase }}");
    expect({{ commandName | pascalCase }}Command.meta.description).toBe("{{ commandDescription }}");
  });

  it("should execute successfully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await {{ commandName | pascalCase }}Command.run({ args: {} });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  {% if withOptions %}
  it("should handle verbose option", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await {{ commandName | pascalCase }}Command.run({ args: { verbose: true } });
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Verbose mode enabled"));
    consoleSpy.mockRestore();
  });
  {% endif %}
});