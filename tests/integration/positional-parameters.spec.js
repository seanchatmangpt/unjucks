import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * from 'node:os';
import * from 'node:path';

describe('Positional Parameters Integration Tests', () => {
  let testHelper;
  let testDir => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup templates for comprehensive positional parameter testing
    await testHelper.createStructuredTemplates([
      // Component generator with single positional parameter
      { type },
      { type },
      { type }}.tsx',
        frontmatter: 'to: "src/components/{{ name | pascalCase }}.tsx"',
        content: `import React from 'react';

export interface {{ name | pascalCase }}Props { className? }

export const {{ name | pascalCase }}, 
  children 
}) => {
  return (
    <div className={className}>
      {{ name | titleCase }}</h1>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`
      },

      // Service generator with multiple positional parameters
      { type },
      { type },
      { type }}{{ resource | pascalCase }}Service.ts',
        frontmatter: 'to: "src/services/{{ serviceName | pascalCase }}{{ resource | pascalCase }}Service.ts"',
        content: `import { {{ resource | pascalCase }} } from '../types/{{ resource | pascalCase }}.js';
{% if withCache %}
import { CacheManager } from '../utils/CacheManager.js';
{% endif %}
{% if withAuth %}
import { AuthService } from './AuthService.js';
{% endif %}

export class {{ serviceName | pascalCase }}{{ resource | pascalCase }}Service {
{% if withCache %}
  private cache = new CacheManager('{{ serviceName | kebabCase }}-{{ resource | kebabCase }}');
{% endif %}
{% if withAuth %}
  private auth = new AuthService();
{% endif %}
  private baseUrl = '{{ apiUrl || "/api" }}';

  async getAll() {
{% if withCache %}
    const cached = await this.cache.get('all-{{ resource | pluralize | kebabCase }}');
    if (cached) return cached;
{% endif %}

    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`{% if withAuth %}, {
      headers)
    }{% endif %});
    
    if (!response.ok) {
      throw new Error(\`Failed to fetch {{ resource | pluralize | lower }});
    }
    
    const {{ resource | pluralize | camelCase }} = await response.json();
{% if withCache %}
    await this.cache.set('all-{{ resource | pluralize | kebabCase }}', {{ resource | pluralize | camelCase }}, 300);
{% endif %}
    return {{ resource | pluralize | camelCase }};
  }

  async getById(id) {
{% if withCache %}
    const cached = await this.cache.get(\`{{ resource | kebabCase }}-\${id}\`);
    if (cached) return cached;
{% endif %}

    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}/\${id}\`{% if withAuth %}, {
      headers)
    }{% endif %});
    
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(\`Failed to fetch {{ resource | lower }});
    }
    
    const {{ resource | camelCase }} = await response.json();
{% if withCache %}
    await this.cache.set(\`{{ resource | kebabCase }}-\${id}\`, {{ resource | camelCase }}, 300);
{% endif %}
    return {{ resource | camelCase }};
  }

  async create(data) {
    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`, { method }
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to create {{ resource | lower }});
    }
    
    const {{ resource | camelCase }} = await response.json();
{% if withCache %}
    await this.cache.invalidate('all-{{ resource | pluralize | kebabCase }}');
{% endif %}
    return {{ resource | camelCase }};
  }
}`
      },

      // Page generator with mixed positional and flag parameters
      { type },
      { type },
      { type }}/page.tsx',
        frontmatter: 'to: "src/app/{{ pageName | kebabCase }}/page.tsx"',
        content: `import React from 'react';
{% if withLayout %}
import { {{ layout | pascalCase }}Layout } from '@/components/layouts/{{ layout | pascalCase }}Layout';
{% endif %}
{% if withMetadata %}
import { Metadata } from 'next';

export const metadata = { title }}',
  description: '{{ pageDescription || ("Page for " + (pageName | titleCase)) }}'
};
{% endif %}

interface {{ pageName | pascalCase }}PageProps { params };
  searchParams: { [key };
}

export default function {{ pageName | pascalCase }}Page({ params, searchParams }) {
  return (
{% if withLayout %}
    <{{ layout | pascalCase }}Layout>
{% endif %}
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{{ pageTitle || (pageName | titleCase) }}</h1>
        
        {% if withSection %}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{{ sectionTitle || "Content" }}</h2>
          <p className="text-gray-600">
            This is the {{ pageName | titleCase }} page. Add your content here.
          </p>
        </section>
        {% endif %}

        {% if withAuth %}
        <div className="auth-required">
          This page requires authentication.</p>
        </div>
        {% endif %}

        <div className="content">
          {/* Page content goes here */}
          Welcome to the {{ pageName | titleCase }} page!</p>
        </div>
      </div>
{% if withLayout %}
    </{{ layout | pascalCase }}Layout>
{% endif %}
  );
}`
      },

      // Model generator with validation schema  
      { type },
      { type },
      { type }}.ts',
        frontmatter: 'to: "src/models/{{ modelName | pascalCase }}.ts"',
        content: `import { z } from 'zod';

export const {{ modelName | pascalCase }}Schema = z.object({
  id).uuid(),
  {% if hasName %}
  name: z.string().min(1, 'Name is required'),
  {% endif %}
  {% if hasEmail %}
  email: z.string().email('Invalid email format'),
  {% endif %}
  {% if hasPhone %}
  phone: z.string().regex(/^\\+?[1-9]\\d{1,14}$/, 'Invalid phone number'),
  {% endif %}
  {% if withTimestamps %}
  createdAt: z.date(),
  updatedAt: z.date(),
  {% endif %}
  {% if withStatus %}
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
  {% endif %}
});

// export type {{ modelName | pascalCase }} = z.infer<typeof {{ modelName | pascalCase }}Schema>;

export const Create{{ modelName | pascalCase }}Schema = {{ modelName | pascalCase }}Schema.omit({ id },
  createdAt,
  updatedAt);

export type Create{{ modelName | pascalCase }} = z.infer<typeof Create{{ modelName | pascalCase }}Schema>;

export const Update{{ modelName | pascalCase }}Schema = Create{{ modelName | pascalCase }}Schema.partial();

export type Update{{ modelName | pascalCase }} = z.infer<typeof Update{{ modelName | pascalCase }}Schema>;

// Helper functions for validation
export const validate{{ modelName | pascalCase }} = (data): {{ modelName | pascalCase }} => {
  return {{ modelName | pascalCase }}Schema.parse(data);
};

export const validateCreate{{ modelName | pascalCase }} = (data){{ modelName | pascalCase }} => {
  return Create{{ modelName | pascalCase }}Schema.parse(data);
};

export const validateUpdate{{ modelName | pascalCase }} = (data){{ modelName | pascalCase }} => {
  return Update{{ modelName | pascalCase }}Schema.parse(data);
};`
      }
    ]);

    // Create package.json to establish project root
    await testHelper.createFile('package.json', JSON.stringify({ name });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Single Positional Parameter', () => { it('should handle component generation with positional syntax', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle kebab-case positional parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle snake_case positional parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Multiple Positional Parameters', () => { it('should handle service generation with two positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } from \'../types/User.js\'');
        expect(content).toContain('async getAll()>');
        expect(content).toContain('fetch(`${this.baseUrl}/users`)');
        expect(content).toContain('Failed to fetch users');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle service generation with kebab-case positional parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } from \'../types/ProductData.js\'');
        expect(content).toContain('fetch(`${this.baseUrl}/product-datas`)');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Mixed Positional and Flag Parameters', () => { it('should handle page generation with positional and flag parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test }');
        expect(content).toContain('export const metadata);
        expect(content).toContain('title);
        expect(content).toContain('');
        expect(content).toContain('function DashboardPage');
        expect(content).toContain('<h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle model generation with positional and boolean flags', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });

    it('should prefer positional parameters over flag parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Flag-Based Parameters (Explicit Generate Command)', () => { it('should handle explicit generate command with flags', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle complex flag-based service generation', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test }');
        expect(content).toContain('import { AuthService }');
        expect(content).toContain('private baseUrl = \'/v1/api\'');
        expect(content).toContain('private cache = new CacheManager(\'data-manager-product\')');
        expect(content).toContain('headers)');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Parameter Validation and Help', () => {
    it('should show template help with positional parameter information', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('help component new');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Help for component/new');
        expect(result.stdout).toContain('Positional Parameters');
        expect(result.stdout).toContain('name');
        expect(result.stdout).toContain('Usage Examples');
        expect(result.stdout).toContain('unjucks component new');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should show help for multi-parameter templates', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('help service api');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Help for service/api');
        expect(result.stdout).toContain('serviceName');
        expect(result.stdout).toContain('resource');
        expect(result.stdout).toContain('withCache');
        expect(result.stdout).toContain('withAuth');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => { it('should handle empty positional parameters gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle special characters in positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test component name with numbers and special characters
        const result = await testHelper.runCli('component new UserCard2024');

        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/components/UserCard2024.tsx');
        expect(content).toContain('export const UserCard2024');
        expect(content).toContain('User Card2024</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle too many positional parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle missing required positional parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Performance and Consistency', () => {
    it('should generate files consistently regardless of parameter style', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Generate with positional parameters
        const result1 = await testHelper.runCli('component new TestConsistency1');
        expect(result1.exitCode).toBe(0);

        // Generate with flag parameters
        const result2 = await testHelper.runCli('generate component new --name=TestConsistency2');
        expect(result2.exitCode).toBe(0);

        // Both should create similar files with appropriate content
        const content1 = await testHelper.readFile('src/components/TestConsistency1.tsx');
        const content2 = await testHelper.readFile('src/components/TestConsistency2.tsx');

        // Structure should be the same, only names should differ
        expect(content1.replace(/TestConsistency1/g, 'TestConsistency')).toBe(
          content2.replace(/TestConsistency2/g, 'TestConsistency')
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle rapid sequential generations', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Generate multiple components rapidly
        const commands = [
          'component new Rapid1',
          'component new Rapid2', 
          'component new Rapid3'
        ];

        const results = await Promise.all(
          commands.map(cmd => testHelper.runCli(cmd))
        );

        // All should succeed
        results.forEach((result, index) => {
          expect(result.exitCode).toBe(0);
        });

        // All files should exist
        const files = [
          'src/components/Rapid1.tsx',
          'src/components/Rapid2.tsx',
          'src/components/Rapid3.tsx'
        ];

        for (const file of files) {
          const exists = await testHelper.fileExists(file);
          expect(exists).toBe(true);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});