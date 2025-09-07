import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'child_process';

describe('Frontmatter Filters - End-to-End Integration', () => {
  const testOutputDir = path.join(process.cwd(), 'test-output-e2e');
  const templateDir = '_templates/test-filters';

  beforeEach(async () => {
    // Clean up test output directory
    await fs.remove(testOutputDir);
    
    // Create test template directory
    await fs.ensureDir(`${templateDir}/component`);
  });

  afterEach(async () => {
    // Clean up after tests
    await fs.remove(testOutputDir);
    await fs.remove(templateDir);
  });

  test('should generate files with frontmatter filters working correctly', async () => {
    // Create a comprehensive test template
    const templateContent = `---
to: src/{{ category | kebabCase }}/{{ name | pascalCase }}.vue
inject: false
chmod: '755'
description: 'Generated {{ name | sentenceCase }} for {{ category | titleCase }}'
---
<template>
  <div class="{{ name | kebabCase }}-{{ category | kebabCase }}">
    <h1>{{ name | pascalCase }}</h1>
    <p>Category: {{ category | humanize }}</p>
    <p>Camel: {{ name | camelCase }}</p>
    <p>Snake: {{ name | snakeCase }}</p>
    <p>Constant: {{ name | constantCase }}</p>
  </div>
</template>

<script>
export default {
  name: '{{ name | pascalCase }}',
  data() {
    return {
      {{ name | camelCase }}Data: 'test'
    };
  }
};
</script>

<style scoped>
.{{ name | kebabCase }}-{{ category | kebabCase }} {
  background: #f0f0f0;
}
</style>`;

    await fs.writeFile(`${templateDir}/component/test.vue.njk`, templateContent);

    // Execute the CLI command
    const result = execSync(
      `node src/cli/index.js generate test-filters component --name userProfileWidget --category UI_Components --dest ${testOutputDir}`,
      { encoding: 'utf8' }
    );

    // Check that the file was generated with correct path (using frontmatter filters)
    const expectedPath = path.join(testOutputDir, 'src/ui-components/UserProfileWidget.vue');
    expect(await fs.pathExists(expectedPath)).toBe(true);

    // Read and verify the generated content
    const generatedContent = await fs.readFile(expectedPath, 'utf8');
    
    // Verify all filter applications worked
    expect(generatedContent).toContain('class="user-profile-widget-ui-components"'); // kebabCase
    expect(generatedContent).toContain('<h1>UserProfileWidget</h1>'); // pascalCase
    expect(generatedContent).toContain('Category: UI components'); // humanize  
    expect(generatedContent).toContain('Camel: userProfileWidget'); // camelCase
    expect(generatedContent).toContain('Snake: user_profile_widget'); // snakeCase
    expect(generatedContent).toContain('Constant: USER_PROFILE_WIDGET'); // constantCase
    expect(generatedContent).toContain("name: 'UserProfileWidget'"); // pascalCase in script
    expect(generatedContent).toContain('userProfileWidgetData: \'test\''); // camelCase in data
  });

  test('should handle complex frontmatter with conditional logic', async () => {
    const conditionalTemplate = `---
to: '{{ "tests/" + (name | kebabCase) + ".test.js" if withTests else "src/" + (name | kebabCase) + ".js" }}'
inject: '{{ injectMode | default(false) }}'
skipIf: '{{ skipGeneration | default(false) }}'
---
// {{ name | pascalCase }} {{ "Test" if withTests else "Implementation" }}
export {{ "default" if withTests else "const " + (name | camelCase) }} = {{ "{}" if withTests else "null" }};`;

    await fs.writeFile(`${templateDir}/component/conditional.js.njk`, conditionalTemplate);

    // Test with withTests=true
    execSync(
      `node src/cli/index.js generate test-filters component --name ApiService --withTests=true --dest ${testOutputDir}`,
      { encoding: 'utf8' }
    );

    let expectedPath = path.join(testOutputDir, 'tests/api-service.test.js');
    expect(await fs.pathExists(expectedPath)).toBe(true);
    
    let content = await fs.readFile(expectedPath, 'utf8');
    expect(content).toContain('// ApiService Test');
    expect(content).toContain('export default = {};');

    // Clean for next test
    await fs.remove(testOutputDir);

    // Test with withTests=false  
    execSync(
      `node src/cli/index.js generate test-filters component --name DataProcessor --withTests=false --dest ${testOutputDir}`,
      { encoding: 'utf8' }
    );

    expectedPath = path.join(testOutputDir, 'src/data-processor.js');
    expect(await fs.pathExists(expectedPath)).toBe(true);
    
    content = await fs.readFile(expectedPath, 'utf8');
    expect(content).toContain('// DataProcessor Implementation');
    expect(content).toContain('export const dataProcessor = null;');
  });

  test('should support injection with frontmatter filters', async () => {
    const injectionTemplate = `---
to: existing-file.js
inject: true
after: '// {{ marker | upperCase }}'
---
  // Injected {{ name | pascalCase }} code
  const {{ name | camelCase }} = '{{ name | kebabCase }}';`;

    await fs.writeFile(`${templateDir}/component/inject.js.njk`, injectionTemplate);

    // Create target file for injection
    const targetFile = path.join(testOutputDir, 'existing-file.js');
    await fs.ensureFile(targetFile);
    await fs.writeFile(targetFile, `// Start
// INJECTION_POINT
// End`);

    execSync(
      `node src/cli/index.js generate test-filters component --name ComponentHelper --marker injection_point --dest ${testOutputDir}`,
      { encoding: 'utf8' }
    );

    const injectedContent = await fs.readFile(targetFile, 'utf8');
    expect(injectedContent).toContain('// Injected ComponentHelper code');
    expect(injectedContent).toContain("const componentHelper = 'component-helper';");
  });

  test('should demonstrate that addCommonFilters is properly configured', async () => {
    // This test verifies that the Nunjucks environment in the CLI has filters properly set up
    const filterTestTemplate = `---
to: filters/{{ name | classify }}.js
---
// Testing all major filter categories

// Case conversion filters  
const pascalName = '{{ name | pascalCase }}';
const camelName = '{{ name | camelCase }}'; 
const kebabName = '{{ name | kebabCase }}';
const snakeName = '{{ name | snakeCase }}';
const constantName = '{{ name | constantCase }}';

// Enhanced inflection filters
const titleName = '{{ name | titleCase }}';
const sentenceName = '{{ name | sentenceCase }}';  
const slugName = '{{ name | slug }}';
const humanizedName = '{{ name | humanize }}';
const classifiedName = '{{ name | classify }}';
const tableizedName = '{{ name | tableize }}';

// String utilities
const truncatedName = '{{ name | truncate(10) }}';
const paddedName = '{{ name | pad(15) }}';
const reversedName = '{{ name | reverse }}';

// Pluralization
const pluralName = '{{ name | pluralize }}';
const singularName = '{{ name | singular }}';

export { 
  pascalName, camelName, kebabName, snakeName, constantName,
  titleName, sentenceName, slugName, humanizedName,
  classifiedName, tableizedName, truncatedName, paddedName,
  reversedName, pluralName, singularName
};`;

    await fs.writeFile(`${templateDir}/component/all-filters.js.njk`, filterTestTemplate);

    execSync(
      `node src/cli/index.js generate test-filters component --name userAccount --dest ${testOutputDir}`,
      { encoding: 'utf8' }
    );

    const expectedPath = path.join(testOutputDir, 'filters/UserAccount.js');
    expect(await fs.pathExists(expectedPath)).toBe(true);

    const content = await fs.readFile(expectedPath, 'utf8');
    
    // Verify all filters worked
    expect(content).toContain("const pascalName = 'UserAccount';");
    expect(content).toContain("const camelName = 'userAccount';");
    expect(content).toContain("const kebabName = 'user-account';");
    expect(content).toContain("const snakeName = 'user_account';");
    expect(content).toContain("const constantName = 'USER_ACCOUNT';");
    expect(content).toContain("const classifiedName = 'UserAccount';");
    expect(content).toContain("const tableizedName = 'user_accounts';");
    expect(content).toContain("const pluralName = 'userAccounts';");
    expect(content).toContain("const singularName = 'userAccount';");
  });
});