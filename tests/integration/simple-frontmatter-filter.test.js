import { describe, test, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import matter from 'gray-matter';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';

describe('Simple Frontmatter Filter Test', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false
    });
    addCommonFilters(env);
  });

  test('should render frontmatter "to" field with pascalCase filter', () => {
    const template = `---
to: src/components/{{ name | pascalCase }}.vue
inject: true
---
<div class="{{ name | kebabCase }}">{{ name | titleCase }}</div>`;

    const { data: frontmatter, content } = matter(template);
    const variables = { name: 'user_button' };

    const renderedTo = env.renderString(frontmatter.to, variables);
    const renderedContent = env.renderString(content, variables);

    expect(renderedTo).toBe('src/components/UserButton.vue');
    expect(renderedContent).toBe('<div class="user-button">User Button</div>');
  });

  test('should handle multiple filters in frontmatter fields', () => {
    const template = `---
to: '{{ type | snakeCase }}/{{ name | kebabCase }}/{{ name | pascalCase }}.js'
description: '{{ name | sentenceCase }} for {{ type | titleCase }}'
---
// {{ name | pascalCase }} implementation`;

    const { data: frontmatter, content } = matter(template);
    const variables = { name: 'userService', type: 'businessLogic' };

    const renderedTo = env.renderString(frontmatter.to, variables);
    const renderedDescription = env.renderString(frontmatter.description, variables);
    const renderedContent = env.renderString(content, variables);

    expect(renderedTo).toBe('business_logic/user-service/UserService.js');
    expect(renderedDescription).toBe('User service for Business Logic');
    expect(renderedContent).toBe('// UserService implementation');
  });

  test('should validate that filters work in boolean skipIf conditions', () => {
    const template = `---
to: src/{{ name | kebabCase }}.js
skipIf: '{{ name | lowerCase == "test" }}'
---
Content here`;

    const { data: frontmatter } = matter(template);
    
    // Test with name that should skip
    let variables = { name: 'Test' };
    let renderedSkipIf = env.renderString(frontmatter.skipIf, variables);
    expect(renderedSkipIf).toBe('true');

    // Test with name that should not skip
    variables = { name: 'Component' };
    renderedSkipIf = env.renderString(frontmatter.skipIf, variables);
    expect(renderedSkipIf).toBe('false');
  });

  test('should demonstrate working frontmatter filter integration', () => {
    // This shows that the current implementation DOES support filters in frontmatter
    const template = `---
to: src/{{ category | kebabCase }}/{{ name | pascalCase }}.vue
inject: '{{ withInjection | default(false) }}'
chmod: '{{ permissions | default("644") }}'
---
<template>
  <div class="{{ name | kebabCase }}-{{ category | kebabCase }}">
    <h1>{{ name | titleCase }}</h1>
    <p>Category: {{ category | sentenceCase }}</p>
  </div>
</template>`;

    const { data: frontmatter, content } = matter(template);
    const variables = { 
      name: 'userProfile', 
      category: 'UI_Components',
      withInjection: true,
      permissions: '755'
    };

    // Render all frontmatter fields
    const renderedFrontmatter = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      renderedFrontmatter[key] = env.renderString(String(value), variables);
    }

    const renderedContent = env.renderString(content, variables);

    expect(renderedFrontmatter.to).toBe('src/ui-components/UserProfile.vue');
    expect(renderedFrontmatter.inject).toBe('true');
    expect(renderedFrontmatter.chmod).toBe('755');
    
    expect(renderedContent).toContain('<div class="user-profile-ui-components">');
    expect(renderedContent).toContain('<h1>User Profile</h1>');
    expect(renderedContent).toContain('<p>Category: Ui components</p>');
  });
});