import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { TemplateScanner } from '../src/lib/template-scanner.js';
import { TestHelper,
  setupTestEnvironment,
  cleanupTestEnvironment } from './helpers/test-helper.js';
import path from "node:path";

describe("TemplateScanner", () => {
  let helper;
  let scanner;

  beforeEach(async () => {
    helper = await setupTestEnvironment();
    scanner = new TemplateScanner();
  });

  afterEach(async () => {
    await cleanupTestEnvironment(helper);
  });

  describe("scanTemplate", () => {
    it("should scan simple variables in template files", async () => {
      // Given
      const templateContent = `import React from 'react';

interface Props {
  title: string;
}

export const {{ componentName }} = () => {
  return <div>{{ title }}</div>;
};
`;

      // Create test file
      const templatePath = path.join(helper.getTempDir(), 'component.tsx.njk');
      await helper.writeFile('component.tsx.njk', templateContent);

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
      // Given
      const templateContent = `import React from 'react';

export const {{ componentName }} = () => {
  return React.createElement('div', { className: '{{ componentName | kebabCase }}' }, '{{ componentName }}');
};`;
      
      // Create test file
      await helper.writeFile('component.tsx.njk', templateContent);
      
      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template")
      );
      
      // Then: Should find the variables with filters
      expect(result.variables).toHaveLength(1);
      expect(
        result.variables.find((v) => v.name === "componentName")
      ).toBeDefined();
    });

    it("should scan template without filters", async () => {
      // Given: A template with simple variable
      const templateContent = `import React from 'react';

export const {{ componentName }} = () => {
  return <div>Hello {{ componentName }}!</div>;
};`;
      
      await helper.writeFile('component.tsx.njk', templateContent);
      
      // When: Scanning the template
      const result = await scanner.scanTemplate(
        path.join(helper.getTempDir(), "template"),
      );

      // Then: Should find the variable (without filters)
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe("componentName");
    });

    it("should scan variables in filenames", async () => {
      // Given: A template with variable in filename
      const templateContent = `import React from 'react';

export const {{ componentName }} = () => {
  return <div>Hello {{ componentName }}!</div>;
};
`;
      
      await helper.writeFile('{{ componentName }}.tsx.njk', templateContent);

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
      const templateContent = `{% if withTests %}
import { render, screen } from '@testing-library/react';
{% endif %}

export const {{ componentName }} = () => {
  return <div>Hello {{ componentName }}!</div>;
};
`;
      
      await helper.writeFile('component.tsx.njk', templateContent);

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
      const templateContent = `export const {{ componentName }} = ({ props }) => {
  return (
    <div className="component">
      {% for prop in props %}
        <span key="{{ loop.index }}">{{ prop.name }}</span>
      {% endfor %}
    </div>
  );
};
`;
      
      await helper.writeFile('component.tsx.njk', templateContent);

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
      // Given: A template with built-in Nunjucks variables
      const templateContent = `export const {{ componentName }} = ({ items }) => {
  return <div className="list">{
    items.map((item, index) => <div key={index}>{{ loop.index }} {{ super() }}</div>)
  }</div>;
};
`;
      
      await helper.writeFile('component.tsx.njk', templateContent);

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
      const inferType = (scanner).inferVariableType.bind(scanner);

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
      const inferType = (scanner).inferVariableType.bind(scanner);

      expect(inferType("itemCount")).toBe("number");
      expect(inferType("pageSize")).toBe("number");
      expect(inferType("maxLength")).toBe("number");
      expect(inferType("currentIndex")).toBe("number");
      expect(inferType("userId")).toBe("number");
      expect(inferType("versionNumber")).toBe("number");
    });

    it("should infer string type for other patterns", () => {
      const scanner = new TemplateScanner();
      const inferType = (scanner).inferVariableType.bind(scanner);

      expect(inferType("componentName")).toBe("string");
      expect(inferType("title")).toBe("string");
      expect(inferType("description")).toBe("string");
      expect(inferType("className")).toBe("string");
    });
  });

  describe("generateCliArgs", () => { it("should generate CLI arguments from template variables", () => {
      const scanner = new TemplateScanner();

      const variables = [
        {
          name },
        { name },
        { name },
      ];

      const args = scanner.generateCliArgs(variables);

      expect(args.componentName).toEqual({ type });

      expect(args.withTests).toEqual({ type });

      expect(args.itemCount).toEqual({ type });
    });
  });

  describe("convertArgsToVariables", () => {
    it("should convert CLI arguments to template variables", () => {
      const scanner = new TemplateScanner();

      const variables = [
        { name: 'componentName', type: 'string' },
        { name: 'withTests', type: 'boolean' },
        { name: 'itemCount', type: 'number' },
      ];

      const args = { componentName: 'Button', withTests: true, itemCount: 5 };

      const result = scanner.convertArgsToVariables(args, variables);

      expect(result.componentName).toBe("Button");
      expect(result.withTests).toBe(true);
      expect(result.itemCount).toBe(5);
    });
  });
});
