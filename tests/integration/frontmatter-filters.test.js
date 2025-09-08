/**
 * Integration tests for frontmatter processing with filters
 * Tests how filters work in frontmatter `to:` fields and other metadata
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import grayMatter from 'gray-matter';

describe('Frontmatter Filter Integration', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Dynamic Path Generation', () => {
    it('should process filters in frontmatter `to` field', () => {
      const frontmatterTemplate = `---
to: src/components/{{ componentName | pascalCase }}Component.jsx
inject: false
---
import React from 'react';

const {{ componentName | pascalCase }}Component = () => {
  return <div>{{ componentName | titleCase }}</div>;
};

export default {{ componentName | pascalCase }}Component;
`;

      // Parse frontmatter
      const parsed = grayMatter(frontmatterTemplate);
      
      // Render the `to` field with context
      const context = { componentName: 'user-profile' };
      const renderedPath = env.renderString(parsed.data.to, context);
      const renderedContent = env.renderString(parsed.content, context);
      
      expect(renderedPath).toBe('src/components/UserProfileComponent.jsx');
      expect(renderedContent).toContain('const UserProfileComponent');
      expect(renderedContent).toContain('<div>User-Profile</div>'); // titleCase converts to kebab-like format
    });

    it('should handle complex path structures', () => {
      const frontmatterTemplate = `---
to: src/{{ moduleType | kebabCase }}/{{ moduleName | snakeCase }}/{{ moduleName | pascalCase }}.{{ fileExtension }}
skipIf: "{{ skipCondition }}"
---
// {{ moduleName | pascalCase }} {{ moduleType | lowerCase }}
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = {
        moduleType: 'API Controllers',
        moduleName: 'userProfile',
        fileExtension: 'ts',
        skipCondition: false
      };

      const renderedPath = env.renderString(parsed.data.to, context);
      const renderedSkipIf = env.renderString(parsed.data.skipIf, context);
      
      expect(renderedPath).toBe('src/api-controllers/user_profile/UserProfile.ts');
      expect(renderedSkipIf).toBe('false');
    });
  });

  describe('Conditional Processing', () => {
    it('should process filters in skipIf conditions', () => {
      const frontmatterTemplate = `---
to: "{{ outputPath }}"
skipIf: "{{ existingFile | lowerCase }}.js"
inject: true
---
content here
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = {
        outputPath: 'src/test.js',
        existingFile: 'EXISTING_FILE'
      };

      const renderedSkipIf = env.renderString(parsed.data.skipIf, context);
      expect(renderedSkipIf).toBe('existing_file.js');
    });

    it('should handle boolean skipIf with filters', () => {
      const frontmatterTemplate = `---
to: "{{ outputPath }}"
skipIf: "{{ mode | upperCase === 'PRODUCTION' }}"
---
content
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = {
        outputPath: 'src/test.js',
        mode: 'production'
      };

      const renderedSkipIf = env.renderString(parsed.data.skipIf, context);
      // This should render as a boolean expression result
      expect(renderedSkipIf).toBe('true');
    });
  });

  describe('Injection Points with Filters', () => {
    it('should process filters in before/after injection markers', () => {
      const frontmatterTemplate = `---
to: "existing-file.js"
inject: true
before: "// {{ sectionName | constantCase }}_START"
after: "// {{ sectionName | constantCase }}_END"
---
const {{ variableName | camelCase }} = '{{ value }}';
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = {
        sectionName: 'api routes',
        variableName: 'base_url',
        value: 'https://api.example.com'
      };

      const renderedBefore = env.renderString(parsed.data.before, context);
      const renderedAfter = env.renderString(parsed.data.after, context);
      const renderedContent = env.renderString(parsed.content, context);

      expect(renderedBefore).toBe('// API_ROUTES_START');
      expect(renderedAfter).toBe('// API_ROUTES_END');
      expect(renderedContent).toContain('const baseUrl =');
    });

    it('should handle lineAt with dynamic line numbers', () => {
      const frontmatterTemplate = `---
to: "existing-file.js"
inject: true
lineAt: "{{ lineNumber }}"
---
// Injected at line {{ lineNumber }}
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = { lineNumber: 42 };

      const renderedLineAt = env.renderString(String(parsed.data.lineAt), context);
      expect(renderedLineAt).toBe('42');
    });
  });

  describe('File Permission and Shell Commands', () => {
    it('should process filters in chmod values', () => {
      const frontmatterTemplate = `---
to: "scripts/{{ scriptName | kebabCase }}.sh"
chmod: "{{ permissions | default('755') }}"
sh: "echo 'Created {{ scriptName | titleCase }} script'"
---
#!/bin/bash
echo "Running {{ scriptName | lowerCase }}"
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = {
        scriptName: 'buildProject',
        permissions: '755'
      };

      const renderedChmod = env.renderString(parsed.data.chmod, context);
      const renderedSh = env.renderString(parsed.data.sh, context);
      const renderedContent = env.renderString(parsed.content, context);

      expect(renderedChmod).toBe('755');
      expect(renderedSh).toBe("echo 'Created Buildproject script'"); // titleCase implementation converts to single word
      expect(renderedContent).toContain('echo "Running buildproject"');
    });
  });

  describe('Complex Frontmatter Scenarios', () => {
    it('should handle database migration template', () => {
      const migrationTemplate = `---
to: "migrations/{{ timestamp() }}_{{ action | snakeCase }}_{{ tableName | snakeCase }}.sql"
skipIf: false
---
-- Migration: {{ action | titleCase }} {{ tableName | pascalCase }}
-- Created: {{ now() }}

{% if action === 'create' -%}
CREATE TABLE {{ tableName | snakeCase }} (
  id SERIAL PRIMARY KEY,
  {{ fields | join(',\\n  ') }},
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
{%- elif action === 'drop' -%}
DROP TABLE IF EXISTS {{ tableName | snakeCase }};
{%- endif %}
`;

      const parsed = grayMatter(migrationTemplate);
      const context = {
        action: 'create',
        tableName: 'UserProfiles',
        fields: ['name VARCHAR(255)', 'email VARCHAR(255) UNIQUE']
      };

      const renderedPath = env.renderString(parsed.data.to, context);
      const renderedContent = env.renderString(parsed.content, context);

      expect(renderedPath).toMatch(/^migrations\/\d{14}_create_user_profiles\.sql$/);
      expect(renderedContent).toContain('CREATE TABLE user_profiles');
      expect(renderedContent).toContain('-- Migration: Create UserProfiles');
    });

    it('should handle React component template with multiple filters', () => {
      const componentTemplate = `---
to: "src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.{{ fileType }}"
skipIf: "{{ !generateTests && fileType === 'test.tsx' }}"
inject: false
---
{% if fileType === 'tsx' -%}
import React from 'react';
import styles from './{{ componentName | pascalCase }}.module.css';

interface {{ componentName | pascalCase }}Props {
  {{ props | join(',\\n  ') }}
}

const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = ({
  {{ propNames | join(', ') }}
}) => {
  return (
    <div className={styles.{{ componentName | camelCase }}}>
      {/* {{ componentName | titleCase }} content */}
    </div>
  );
};

export default {{ componentName | pascalCase }};
{%- elif fileType === 'module.css' -%}
.{{ componentName | camelCase }} {
  /* {{ componentName | titleCase }} styles */
}
{%- endif %}
`;

      const parsed = grayMatter(componentTemplate);
      const context = {
        componentName: 'user-profile-card',
        fileType: 'tsx',
        generateTests: false,
        props: ['title: string', 'isActive: boolean'],
        propNames: ['title', 'isActive']
      };

      const renderedPath = env.renderString(parsed.data.to, context);
      const renderedContent = env.renderString(parsed.content, context);

      expect(renderedPath).toBe('src/components/UserProfileCard/UserProfileCard.tsx');
      expect(renderedContent).toContain('interface UserProfileCardProps');
      expect(renderedContent).toContain('const UserProfileCard:');
      expect(renderedContent).toContain('className={styles.userProfileCard}');
    });
  });

  describe('Error Handling in Frontmatter', () => {
    it('should handle missing variables in frontmatter gracefully', () => {
      const frontmatterTemplate = `---
to: "src/{{ missingVar | pascalCase }}.js"
---
content
`;

      const parsed = grayMatter(frontmatterTemplate);
      const renderedPath = env.renderString(parsed.data.to, {});

      expect(renderedPath).toBe('src/.js'); // Should render empty for missing vars
    });

    it('should handle invalid filter chains in frontmatter', () => {
      const frontmatterTemplate = `---
to: "src/{{ validVar | nonExistentFilter }}.js"
---
content
`;

      const parsed = grayMatter(frontmatterTemplate);
      const context = { validVar: 'test' };

      // This should throw an error for non-existent filter
      expect(() => {
        env.renderString(parsed.data.to, context);
      }).toThrow();
    });
  });
});

describe('Advanced Frontmatter Filter Patterns', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  it('should handle conditional path generation', () => {
    const template = `---
to: "{{ basePath }}/{% if isTest %}tests{% else %}src{% endif %}/{{ fileName | kebabCase }}.{% if isTest %}test.{% endif %}{{ fileExtension }}"
---
content
`;

    const parsed = grayMatter(template);
    const context = {
      basePath: 'project',
      isTest: true,
      fileName: 'UserService',
      fileExtension: 'js'
    };

    const renderedPath = env.renderString(parsed.data.to, context);
    expect(renderedPath).toBe('project/tests/user-service.test.js');
  });

  it('should handle nested object properties with filters', () => {
    const template = `---
to: "src/{{ config.module | snakeCase }}/{{ config.component | pascalCase }}.tsx"
---
content
`;

    const parsed = grayMatter(template);
    const context = {
      config: {
        module: 'userManagement',
        component: 'profile-editor'
      }
    };

    const renderedPath = env.renderString(parsed.data.to, context);
    expect(renderedPath).toBe('src/user_management/ProfileEditor.tsx');
  });
});