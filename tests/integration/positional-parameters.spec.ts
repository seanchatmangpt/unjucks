import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Positional Parameters Integration Tests', () => {
  let testHelper: TestHelper;
  let testDir: string;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup templates for comprehensive positional parameter testing
    await testHelper.createStructuredTemplates([
      // Component generator with single positional parameter
      { type: 'directory', path: 'component' },
      { type: 'directory', path: 'component/new' },
      {
        type: 'file',
        path: 'component/new/{{ name | pascalCase }}.tsx',
        frontmatter: 'to: "src/components/{{ name | pascalCase }}.tsx"',
        content: `import React from 'react';

export interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  className = "{{ name | kebabCase }}", 
  children 
}) => {
  return (
    <div className={className}>
      <h1>{{ name | titleCase }}</h1>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`
      },

      // Service generator with multiple positional parameters
      { type: 'directory', path: 'service' },
      { type: 'directory', path: 'service/api' },
      {
        type: 'file',
        path: 'service/api/{{ serviceName | pascalCase }}{{ resource | pascalCase }}Service.ts',
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

  async getAll(): Promise<{{ resource | pascalCase }}[]> {
{% if withCache %}
    const cached = await this.cache.get('all-{{ resource | pluralize | kebabCase }}');
    if (cached) return cached;
{% endif %}

    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`{% if withAuth %}, {
      headers: await this.auth.getHeaders()
    }{% endif %});
    
    if (!response.ok) {
      throw new Error(\`Failed to fetch {{ resource | pluralize | lower }}: \${response.statusText}\`);
    }
    
    const {{ resource | pluralize | camelCase }} = await response.json();
{% if withCache %}
    await this.cache.set('all-{{ resource | pluralize | kebabCase }}', {{ resource | pluralize | camelCase }}, 300);
{% endif %}
    return {{ resource | pluralize | camelCase }};
  }

  async getById(id: string): Promise<{{ resource | pascalCase }} | null> {
{% if withCache %}
    const cached = await this.cache.get(\`{{ resource | kebabCase }}-\${id}\`);
    if (cached) return cached;
{% endif %}

    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}/\${id}\`{% if withAuth %}, {
      headers: await this.auth.getHeaders()
    }{% endif %});
    
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(\`Failed to fetch {{ resource | lower }}: \${response.statusText}\`);
    }
    
    const {{ resource | camelCase }} = await response.json();
{% if withCache %}
    await this.cache.set(\`{{ resource | kebabCase }}-\${id}\`, {{ resource | camelCase }}, 300);
{% endif %}
    return {{ resource | camelCase }};
  }

  async create(data: Omit<{{ resource | pascalCase }}, 'id'>): Promise<{{ resource | pascalCase }}> {
    const response = await fetch(\`\${this.baseUrl}/{{ resource | pluralize | kebabCase }}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'{% if withAuth %},
        ...await this.auth.getHeaders(){% endif %}
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(\`Failed to create {{ resource | lower }}: \${response.statusText}\`);
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
      { type: 'directory', path: 'page' },
      { type: 'directory', path: 'page/nextjs' },
      {
        type: 'file',
        path: 'page/nextjs/{{ pageName | kebabCase }}/page.tsx',
        frontmatter: 'to: "src/app/{{ pageName | kebabCase }}/page.tsx"',
        content: `import React from 'react';
{% if withLayout %}
import { {{ layout | pascalCase }}Layout } from '@/components/layouts/{{ layout | pascalCase }}Layout';
{% endif %}
{% if withMetadata %}
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '{{ pageTitle || (pageName | titleCase) }}',
  description: '{{ pageDescription || ("Page for " + (pageName | titleCase)) }}'
};
{% endif %}

interface {{ pageName | pascalCase }}PageProps {
  params: { id?: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function {{ pageName | pascalCase }}Page({ params, searchParams }: {{ pageName | pascalCase }}PageProps) {
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
          <p>This page requires authentication.</p>
        </div>
        {% endif %}

        <div className="content">
          {/* Page content goes here */}
          <p>Welcome to the {{ pageName | titleCase }} page!</p>
        </div>
      </div>
{% if withLayout %}
    </{{ layout | pascalCase }}Layout>
{% endif %}
  );
}`
      },

      // Model generator with validation schema  
      { type: 'directory', path: 'model' },
      { type: 'directory', path: 'model/zod' },
      {
        type: 'file',
        path: 'model/zod/{{ modelName | pascalCase }}.ts',
        frontmatter: 'to: "src/models/{{ modelName | pascalCase }}.ts"',
        content: `import { z } from 'zod';

export const {{ modelName | pascalCase }}Schema = z.object({
  id: z.string().uuid(),
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

export type {{ modelName | pascalCase }} = z.infer<typeof {{ modelName | pascalCase }}Schema>;

export const Create{{ modelName | pascalCase }}Schema = {{ modelName | pascalCase }}Schema.omit({
  id: true{% if withTimestamps %},
  createdAt: true,
  updatedAt: true{% endif %}
});

export type Create{{ modelName | pascalCase }} = z.infer<typeof Create{{ modelName | pascalCase }}Schema>;

export const Update{{ modelName | pascalCase }}Schema = Create{{ modelName | pascalCase }}Schema.partial();

export type Update{{ modelName | pascalCase }} = z.infer<typeof Update{{ modelName | pascalCase }}Schema>;

// Helper functions for validation
export const validate{{ modelName | pascalCase }} = (data: unknown): {{ modelName | pascalCase }} => {
  return {{ modelName | pascalCase }}Schema.parse(data);
};

export const validateCreate{{ modelName | pascalCase }} = (data: unknown): Create{{ modelName | pascalCase }} => {
  return Create{{ modelName | pascalCase }}Schema.parse(data);
};

export const validateUpdate{{ modelName | pascalCase }} = (data: unknown): Update{{ modelName | pascalCase }} => {
  return Update{{ modelName | pascalCase }}Schema.parse(data);
};`
      }
    ]);

    // Create package.json to establish project root
    await testHelper.createFile('package.json', JSON.stringify({
      name: 'positional-test-project',
      version: '1.0.0'
    }));
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Single Positional Parameter', () => {
    it('should handle component generation with positional syntax', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks component new UserProfile
        const result = await testHelper.runCli('component new UserProfile');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Generated');

        // Verify file creation
        const componentExists = await testHelper.fileExists('src/components/UserProfile.tsx');
        expect(componentExists).toBe(true);

        // Verify content with positional parameter value
        const content = await testHelper.readFile('src/components/UserProfile.tsx');
        expect(content).toContain('export interface UserProfileProps');
        expect(content).toContain('export const UserProfile');
        expect(content).toContain('className = "user-profile"');
        expect(content).toContain('<h1>User Profile</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle kebab-case positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks component new shopping-cart
        const result = await testHelper.runCli('component new shopping-cart');

        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/components/ShoppingCart.tsx');
        expect(content).toContain('export const ShoppingCart');
        expect(content).toContain('<h1>Shopping Cart</h1>');
        expect(content).toContain('className = "shopping-cart"');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle snake_case positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks component new user_profile_card
        const result = await testHelper.runCli('component new user_profile_card');

        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/components/UserProfileCard.tsx');
        expect(content).toContain('export const UserProfileCard');
        expect(content).toContain('<h1>User Profile Card</h1>');
        expect(content).toContain('className = "user-profile-card"');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Multiple Positional Parameters', () => {
    it('should handle service generation with two positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks service api UserData User
        const result = await testHelper.runCli('service api UserData User');

        expect(result.exitCode).toBe(0);

        // Verify file creation with multiple positional parameters
        const serviceExists = await testHelper.fileExists('src/services/UserDataUserService.ts');
        expect(serviceExists).toBe(true);

        const content = await testHelper.readFile('src/services/UserDataUserService.ts');
        expect(content).toContain('export class UserDataUserService');
        expect(content).toContain('import { User } from \'../types/User.js\'');
        expect(content).toContain('async getAll(): Promise<User[]>');
        expect(content).toContain('fetch(`${this.baseUrl}/users`)');
        expect(content).toContain('Failed to fetch users');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle service generation with kebab-case positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks service api api-client product-data
        const result = await testHelper.runCli('service api api-client product-data');

        expect(result.exitCode).toBe(0);

        const serviceExists = await testHelper.fileExists('src/services/ApiClientProductDataService.ts');
        expect(serviceExists).toBe(true);

        const content = await testHelper.readFile('src/services/ApiClientProductDataService.ts');
        expect(content).toContain('export class ApiClientProductDataService');
        expect(content).toContain('import { ProductData } from \'../types/ProductData.js\'');
        expect(content).toContain('fetch(`${this.baseUrl}/product-datas`)');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Mixed Positional and Flag Parameters', () => {
    it('should handle page generation with positional and flag parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks page nextjs dashboard --withLayout=true --layout=admin --withMetadata=true --pageTitle="Admin Dashboard"
        const result = await testHelper.runCli('page nextjs dashboard --withLayout=true --layout=admin --withMetadata=true --pageTitle="Admin Dashboard"');

        expect(result.exitCode).toBe(0);

        const pageExists = await testHelper.fileExists('src/app/dashboard/page.tsx');
        expect(pageExists).toBe(true);

        const content = await testHelper.readFile('src/app/dashboard/page.tsx');
        expect(content).toContain('import { AdminLayout }');
        expect(content).toContain('export const metadata: Metadata');
        expect(content).toContain('title: \'Admin Dashboard\'');
        expect(content).toContain('<AdminLayout>');
        expect(content).toContain('function DashboardPage');
        expect(content).toContain('<h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle model generation with positional and boolean flags', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks model zod User --hasName=true --hasEmail=true --withTimestamps=true --withStatus=true
        const result = await testHelper.runCli('model zod User --hasName=true --hasEmail=true --withTimestamps=true --withStatus=true');

        expect(result.exitCode).toBe(0);

        const modelExists = await testHelper.fileExists('src/models/User.ts');
        expect(modelExists).toBe(true);

        const content = await testHelper.readFile('src/models/User.ts');
        expect(content).toContain('export const UserSchema = z.object({');
        expect(content).toContain('name: z.string().min(1, \'Name is required\')');
        expect(content).toContain('email: z.string().email(\'Invalid email format\')');
        expect(content).toContain('createdAt: z.date()');
        expect(content).toContain('updatedAt: z.date()');
        expect(content).toContain('status: z.enum([\'active\', \'inactive\', \'pending\'])');
        expect(content).toContain('export type User = z.infer<typeof UserSchema>');
        expect(content).toContain('export const validateUser = (data: unknown): User =>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should prefer positional parameters over flag parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks component new PositionalWins --name=FlagValue
        // Positional parameter "PositionalWins" should take precedence over flag --name=FlagValue
        const result = await testHelper.runCli('component new PositionalWins --name=FlagValue');

        expect(result.exitCode).toBe(0);

        // Should create PositionalWins.tsx, not FlagValue.tsx
        const positionalExists = await testHelper.fileExists('src/components/PositionalWins.tsx');
        const flagExists = await testHelper.fileExists('src/components/FlagValue.tsx');

        expect(positionalExists).toBe(true);
        expect(flagExists).toBe(false);

        const content = await testHelper.readFile('src/components/PositionalWins.tsx');
        expect(content).toContain('export const PositionalWins');
        expect(content).toContain('<h1>Positional Wins</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Flag-Based Parameters (Explicit Generate Command)', () => {
    it('should handle explicit generate command with flags', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks generate component new --name=ExplicitComponent
        const result = await testHelper.runCli('generate component new --name=ExplicitComponent');

        expect(result.exitCode).toBe(0);

        const componentExists = await testHelper.fileExists('src/components/ExplicitComponent.tsx');
        expect(componentExists).toBe(true);

        const content = await testHelper.readFile('src/components/ExplicitComponent.tsx');
        expect(content).toContain('export const ExplicitComponent');
        expect(content).toContain('<h1>Explicit Component</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle complex flag-based service generation', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks generate service api --serviceName=DataManager --resource=Product --withCache=true --withAuth=true --apiUrl="/v1/api"
        const result = await testHelper.runCli('generate service api --serviceName=DataManager --resource=Product --withCache=true --withAuth=true --apiUrl="/v1/api"');

        expect(result.exitCode).toBe(0);

        const serviceExists = await testHelper.fileExists('src/services/DataManagerProductService.ts');
        expect(serviceExists).toBe(true);

        const content = await testHelper.readFile('src/services/DataManagerProductService.ts');
        expect(content).toContain('export class DataManagerProductService');
        expect(content).toContain('import { CacheManager }');
        expect(content).toContain('import { AuthService }');
        expect(content).toContain('private baseUrl = \'/v1/api\'');
        expect(content).toContain('private cache = new CacheManager(\'data-manager-product\')');
        expect(content).toContain('headers: await this.auth.getHeaders()');
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

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty positional parameters gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks component new ""
        const result = await testHelper.runCli('component new ""');

        // Should either prompt for input or show error
        expect(result.exitCode).toBe(0); // Might prompt and get input
      } finally {
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
        expect(content).toContain('<h1>User Card2024</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle too many positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks component new Name Extra Parameters
        const result = await testHelper.runCli('component new Name Extra Parameters');

        expect(result.exitCode).toBe(0);

        // Should use the first positional parameter and ignore the rest
        const componentExists = await testHelper.fileExists('src/components/Name.tsx');
        expect(componentExists).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle missing required positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test: unjucks service api (missing required positional parameters)
        const result = await testHelper.runCli('service api');

        // Should either prompt for missing parameters or show error
        expect([0, 1]).toContain(result.exitCode);
      } finally {
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