import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { TemplateScanner } from "../src/lib/template-scanner.ts";
import {
  TestHelper,
  setupTestEnvironment,
  cleanupTestEnvironment,
} from "./helpers/test-helper.ts";
import path from "node:path";

describe("TemplateScanner", () => {
  let helper: TestHelper;
  let scanner: TemplateScanner;

  beforeEach(async () => {
    helper = await setupTestEnvironment();
    scanner = new TemplateScanner();
  });

  afterEach(async () => {
    await cleanupTestEnvironment(helper);
  });

  describe("scanTemplate", () => {
    it("should scan simple variables in template files", async () => {
      // Given: A template with simple variables
      await helper.createFile(
        "template/Component.tsx",
        `
import React from 'react';

interface {{ componentName }}Props {
  title: string;
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({ title }) => {
  return <div>{{ title }}</div>;
};
`,
      );

      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should find the variables
      expect(result.variables).toHaveLength(2);
      expect(
        result.variables.find((v) => v.name === "componentName"),
      ).toBeDefined();
      expect(result.variables.find((v) => v.name === "title")).toBeDefined();
    });

    it("should scan variables with filters", async () => {
      // Given: A template with filtered variables
      await helper.createFile(
        "template/Component.tsx",
        `
import React from 'react';

export const {{ componentName | pascalCase }}: React.FC = () => {
  return <div className="{{ componentName | kebabCase }}">{{ componentName }}</div>;
};
`,
      );

      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should find the variable (without filters)
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe("componentName");
    });

    it("should scan variables in filenames", async () => {
      // Given: A template with variables in filename
      await helper.createFile(
        "template/{{ componentName }}.tsx",
        `
import React from 'react';

export const {{ componentName }}: React.FC = () => {
  return <div>Hello</div>;
};
`,
      );

      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should find the variable
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe("componentName");
    });

    it("should scan conditional variables", async () => {
      // Given: A template with conditional variables
      await helper.createFile(
        "template/Component.tsx",
        `
import React from 'react';

{% if withTests %}
import { render, screen } from '@testing-library/react';
{% endif %}

export const {{ componentName }}: React.FC = () => {
  return <div>Hello</div>;
};
`,
      );

      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should find both variables
      expect(result.variables).toHaveLength(2);
      expect(
        result.variables.find((v) => v.name === "componentName"),
      ).toBeDefined();
      expect(
        result.variables.find((v) => v.name === "withTests"),
      ).toBeDefined();
    });

    it("should scan loop variables", async () => {
      // Given: A template with loop variables
      await helper.createFile(
        "template/Component.tsx",
        `
import React from 'react';

export const {{ componentName }}: React.FC = () => {
  return (
    <div>
      {% for prop in props %}
        <span>{{ prop.name }}</span>
      {% endfor %}
    </div>
  );
};
`,
      );

      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should find the variables
      expect(result.variables).toHaveLength(2);
      expect(
        result.variables.find((v) => v.name === "componentName"),
      ).toBeDefined();
      expect(result.variables.find((v) => v.name === "props")).toBeDefined();
    });

    it("should skip built-in Nunjucks variables", async () => {
      // Given: A template with built-in variables
      await helper.createFile(
        "template/Component.tsx",
        `
import React from 'react';

export const {{ componentName }}: React.FC = () => {
  return <div>{{ loop.index }} {{ super() }}</div>;
};
`,
      );

      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should only find custom variables
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe("componentName");
    });
  });

  describe("inferVariableType", () => {
    it("should infer boolean type for boolean patterns", () => {
      const scanner = new TemplateScanner();

      // Access private method through any cast for testing
      const inferType = (scanner as any).inferVariableType.bind(scanner);

      expect(inferType("isVisible")).toBe("boolean");
      expect(inferType("hasError")).toBe("boolean");
      expect(inferType("canEdit")).toBe("boolean");
      expect(inferType("shouldRender")).toBe("boolean");
      expect(inferType("withTests")).toBe("boolean");
      expect(inferType("enableFeature")).toBe("boolean");
      expect(inferType("disableCache")).toBe("boolean");
      expect(inferType("debugFlag")).toBe("boolean");
    });

    it("should infer number type for number patterns", () => {
      const scanner = new TemplateScanner();
      const inferType = (scanner as any).inferVariableType.bind(scanner);

      expect(inferType("itemCount")).toBe("number");
      expect(inferType("pageSize")).toBe("number");
      expect(inferType("maxLength")).toBe("number");
      expect(inferType("currentIndex")).toBe("number");
      expect(inferType("userId")).toBe("number");
      expect(inferType("versionNumber")).toBe("number");
    });

    it("should infer string type for other patterns", () => {
      const scanner = new TemplateScanner();
      const inferType = (scanner as any).inferVariableType.bind(scanner);

      expect(inferType("componentName")).toBe("string");
      expect(inferType("title")).toBe("string");
      expect(inferType("description")).toBe("string");
      expect(inferType("className")).toBe("string");
    });
  });

  describe("generateCliArgs", () => {
    it("should generate CLI arguments from template variables", () => {
      const scanner = new TemplateScanner();

      const variables = [
        {
          name: "componentName",
          type: "string" as const,
          description: "Component Name",
          required: true,
        },
        {
          name: "withTests",
          type: "boolean" as const,
          description: "Include tests",
          required: false,
        },
        {
          name: "itemCount",
          type: "number" as const,
          description: "Number of items",
          required: false,
        },
      ];

      const args = scanner.generateCliArgs(variables);

      expect(args.componentName).toEqual({
        type: "string",
        description: "Component Name",
        default: "",
      });

      expect(args.withTests).toEqual({
        type: "boolean",
        description: "Include tests",
        default: false,
      });

      expect(args.itemCount).toEqual({
        type: "string",
        description: "Number of items",
        default: "0",
      });
    });
  });

  describe("convertArgsToVariables", () => {
    it("should convert CLI arguments to template variables", () => {
      const scanner = new TemplateScanner();

      const variables = [
        { name: "componentName", type: "string" as const },
        { name: "withTests", type: "boolean" as const },
        { name: "itemCount", type: "number" as const },
      ];

      const args = {
        componentName: "Button",
        withTests: "true",
        itemCount: "5",
      };

      const result = scanner.convertArgsToVariables(args, variables);

      expect(result.componentName).toBe("Button");
      expect(result.withTests).toBe(true);
      expect(result.itemCount).toBe(5);
    });
  });
});
