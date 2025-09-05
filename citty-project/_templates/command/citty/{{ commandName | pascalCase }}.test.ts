import { describe, expect, it } from "vitest";
import { {{ commandName | pascalCase }}Command } from "./{{ commandName | pascalCase }}";

describe("{{ commandName | pascalCase }}Command", () => {
  it("should be defined", () => {
    expect({{ commandName | pascalCase }}Command).toBeDefined();
  });

  it("should have correct meta", () => {
    expect({{ commandName | pascalCase }}Command.meta?.name).toBe("{{ commandName | kebabCase }}");
    expect({{ commandName | pascalCase }}Command.meta?.description).toBe("{{ commandName | titleCase }} command");
  });

  // Add more tests here
});
