#!/usr/bin/env node

/**
 * Test Data Factories and Mock Services
 * Provides reliable, consistent test data and mock services
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class TestDataFactory {
  constructor() {
    this.seed = 12345; // Consistent seed for reproducible tests
    faker.seed(this.seed);
  }

  // Reset faker seed for consistent test data
  reset() {
    faker.seed(this.seed);
  }

  // Generate template data
  generateTemplateData(overrides = {}) {
    return {
      name: faker.word.words({ count: { min: 1, max: 3 } }).replace(/\s+/g, ''),
      description: faker.lorem.sentence(),
      author: faker.person.fullName(),
      version: faker.system.semver(),
      category: faker.helpers.arrayElement(['component', 'service', 'util', 'model', 'controller']),
      tags: faker.helpers.arrayElements(['react', 'node', 'typescript', 'api'], 2),
      ...overrides
    };
  }

  // Generate component data
  generateComponentData(overrides = {}) {
    const baseName = faker.word.words({ count: 1 }).replace(/\s+/g, '');
    return {
      name: baseName,
      className: `${baseName}Component`,
      fileName: `${baseName}.tsx`,
      testFileName: `${baseName}.test.tsx`,
      props: this.generateProps(),
      methods: this.generateMethods(),
      ...overrides
    };
  }

  generateProps(count = 3) {
    const props = [];
    for (let i = 0; i < count; i++) {
      props.push({
        name: faker.hacker.noun(),
        type: faker.helpers.arrayElement(['string', 'number', 'boolean', 'object']),
        required: faker.datatype.boolean(),
        defaultValue: this.generateDefaultValue()
      });
    }
    return props;
  }

  generateMethods(count = 2) {
    const methods = [];
    for (let i = 0; i < count; i++) {
      methods.push({
        name: faker.hacker.verb(),
        parameters: faker.helpers.arrayElements(['id', 'data', 'options'], 2),
        returnType: faker.helpers.arrayElement(['void', 'string', 'boolean', 'Promise<void>'])
      });
    }
    return methods;
  }

  generateDefaultValue() {
    const type = faker.helpers.arrayElement(['string', 'number', 'boolean']);
    switch (type) {
      case 'string':
        return `"${faker.lorem.word()}"`;
      case 'number':
        return faker.number.int({ min: 1, max: 100 });
      case 'boolean':
        return faker.datatype.boolean();
      default:
        return 'undefined';
    }
  }

  // Generate API data
  generateApiData(overrides = {}) {
    return {
      endpoint: `/${faker.hacker.noun()}`,
      method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
      description: faker.lorem.sentence(),
      parameters: this.generateApiParameters(),
      response: this.generateApiResponse(),
      ...overrides
    };
  }

  generateApiParameters(count = 3) {
    const params = [];
    for (let i = 0; i < count; i++) {
      params.push({
        name: faker.hacker.noun(),
        type: faker.helpers.arrayElement(['string', 'number', 'boolean']),
        required: faker.datatype.boolean(),
        description: faker.lorem.sentence()
      });
    }
    return params;
  }

  generateApiResponse() {
    return {
      status: 200,
      data: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        createdAt: faker.date.recent().toISOString()
      }
    };
  }

  // Generate file system data
  generateFileSystemData(overrides = {}) {
    return {
      fileName: `${faker.system.fileName()}.${faker.helpers.arrayElement(['js', 'ts', 'tsx', 'vue'])}`,
      directory: faker.system.directoryPath(),
      content: this.generateFileContent(),
      size: faker.number.int({ min: 100, max: 10000 }),
      ...overrides
    };
  }

  generateFileContent(type = 'component') {
    switch (type) {
      case 'component':
        return this.generateComponentContent();
      case 'service':
        return this.generateServiceContent();
      case 'test':
        return this.generateTestContent();
      default:
        return faker.lorem.paragraphs(3);
    }
  }

  generateComponentContent() {
    const componentName = faker.word.words({ count: 1 }).replace(/\s+/g, '');
    return `import React from 'react';

export interface ${componentName}Props {
  ${faker.hacker.noun()}: string;
  ${faker.hacker.noun()}?: number;
}

export const ${componentName}: React.FC<${componentName}Props> = ({ ${faker.hacker.noun()}, ${faker.hacker.noun()} }) => {
  return (
    <div className="${componentName.toLowerCase()}">
      <h1>{${faker.hacker.noun()}}</h1>
    </div>
  );
};

export default ${componentName};
`;
  }

  generateServiceContent() {
    const serviceName = faker.word.words({ count: 1 }).replace(/\s+/g, '');
    return `export class ${serviceName}Service {
  private baseUrl = '${faker.internet.url()}';

  async ${faker.hacker.verb()}(id: string): Promise<any> {
    const response = await fetch(\`\${this.baseUrl}/${faker.hacker.noun()}/\${id}\`);
    return response.json();
  }

  async ${faker.hacker.verb()}(data: any): Promise<any> {
    const response = await fetch(\`\${this.baseUrl}/${faker.hacker.noun()}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
}
`;
  }

  generateTestContent() {
    const testName = faker.word.words({ count: 1 }).replace(/\s+/g, '');
    return `import { ${testName} } from './${testName}';

describe('${testName}', () => {
  it('should ${faker.hacker.verb()} ${faker.hacker.noun()}', () => {
    // Arrange
    const ${faker.hacker.noun()} = '${faker.lorem.word()}';
    
    // Act
    const result = ${testName}.${faker.hacker.verb()}(${faker.hacker.noun()});
    
    // Assert
    expect(result).toBeDefined();
  });

  it('should handle ${faker.hacker.noun()} ${faker.hacker.verb()}', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
`;
  }

  // Generate template variables
  generateTemplateVariables(template = 'component', count = 5) {
    const variables = {};
    
    // Always include common variables
    variables.name = faker.word.words({ count: 1 }).replace(/\s+/g, '');
    variables.description = faker.lorem.sentence();
    variables.author = faker.person.fullName();
    
    // Template-specific variables
    switch (template) {
      case 'component':
        variables.componentName = variables.name;
        variables.props = faker.helpers.arrayElements(['id', 'title', 'onClick', 'className'], 2);
        variables.hasChildren = faker.datatype.boolean();
        break;
        
      case 'service':
        variables.serviceName = `${variables.name}Service`;
        variables.endpoint = `/${faker.hacker.noun()}`;
        variables.methods = ['get', 'post', 'put', 'delete'];
        break;
        
      case 'model':
        variables.modelName = variables.name;
        variables.fields = this.generateModelFields();
        variables.hasTimestamps = faker.datatype.boolean();
        break;
    }
    
    // Add random additional variables
    for (let i = 0; i < count - 3; i++) {
      const key = faker.hacker.noun();
      variables[key] = faker.helpers.arrayElement([
        faker.lorem.word(),
        faker.number.int({ min: 1, max: 100 }),
        faker.datatype.boolean()
      ]);
    }
    
    return variables;
  }

  generateModelFields(count = 4) {
    const fields = [];
    for (let i = 0; i < count; i++) {
      fields.push({
        name: faker.hacker.noun(),
        type: faker.helpers.arrayElement(['string', 'number', 'boolean', 'Date']),
        required: faker.datatype.boolean(),
        unique: faker.datatype.boolean({ probability: 0.2 })
      });
    }
    return fields;
  }
}

class MockServices {
  constructor() {
    this.factory = new TestDataFactory();
  }

  // Mock file system operations
  createMockFileSystem() {
    const mockFs = {
      files: new Map(),
      directories: new Set(['/', '/src', '/tests', '/docs']),
      
      readFile: async (path) => {
        if (mockFs.files.has(path)) {
          return mockFs.files.get(path);
        }
        throw new Error(`File not found: ${path}`);
      },
      
      writeFile: async (path, content) => {
        mockFs.files.set(path, content);
        // Ensure directory exists
        const dir = path.substring(0, path.lastIndexOf('/'));
        mockFs.directories.add(dir);
      },
      
      exists: async (path) => {
        return mockFs.files.has(path) || mockFs.directories.has(path);
      },
      
      readdir: async (path) => {
        const files = [];
        for (const [filePath] of mockFs.files) {
          if (filePath.startsWith(path + '/') && !filePath.substring(path.length + 1).includes('/')) {
            files.push(filePath.substring(path.length + 1));
          }
        }
        return files;
      },
      
      reset: () => {
        mockFs.files.clear();
        mockFs.directories.clear();
        mockFs.directories.add('/');
      }
    };
    
    return mockFs;
  }

  // Mock CLI process
  createMockCliProcess() {
    const outputs = [];
    const errors = [];
    
    return {
      stdout: {
        write: (data) => outputs.push(data),
        getOutput: () => outputs.join(''),
        clear: () => outputs.length = 0
      },
      
      stderr: {
        write: (data) => errors.push(data),
        getOutput: () => errors.join(''),
        clear: () => errors.length = 0
      },
      
      exit: (code) => {
        throw new Error(`Process exited with code ${code}`);
      },
      
      getExitCode: () => 0,
      
      reset: () => {
        outputs.length = 0;
        errors.length = 0;
      }
    };
  }

  // Mock template engine
  createMockTemplateEngine() {
    return {
      templates: new Map(),
      
      addTemplate: (name, content) => {
        mockEngine.templates.set(name, content);
      },
      
      render: (templateName, variables) => {
        const template = mockEngine.templates.get(templateName);
        if (!template) {
          throw new Error(`Template not found: ${templateName}`);
        }
        
        // Simple variable replacement
        let result = template;
        Object.entries(variables).forEach(([key, value]) => {
          const regex = new RegExp(`<%=\\s*${key}\\s*%>`, 'g');
          result = result.replace(regex, String(value));
        });
        
        return result;
      },
      
      reset: () => {
        mockEngine.templates.clear();
      }
    };
  }

  // Mock HTTP requests
  createMockHttpClient() {
    const responses = new Map();
    const requests = [];
    
    return {
      setResponse: (url, response) => {
        responses.set(url, response);
      },
      
      get: async (url) => {
        requests.push({ method: 'GET', url });
        if (responses.has(url)) {
          return responses.get(url);
        }
        return { status: 404, data: null };
      },
      
      post: async (url, data) => {
        requests.push({ method: 'POST', url, data });
        if (responses.has(url)) {
          return responses.get(url);
        }
        return { status: 201, data: { id: faker.string.uuid(), ...data } };
      },
      
      getRequests: () => [...requests],
      
      reset: () => {
        responses.clear();
        requests.length = 0;
      }
    };
  }
}

class TestEnvironment {
  constructor() {
    this.factory = new TestDataFactory();
    this.mocks = new MockServices();
    this.tempDirs = [];
  }

  // Create a temporary test environment
  async createTempEnvironment(name = 'test-env') {
    const tempDir = path.join('/tmp', `${name}-${this.getDeterministicTimestamp()}`);
    await fs.ensureDir(tempDir);
    this.tempDirs.push(tempDir);
    
    return {
      path: tempDir,
      
      createFile: async (relativePath, content) => {
        const fullPath = path.join(tempDir, relativePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
        return fullPath;
      },
      
      createTemplate: async (templateName, templateContent) => {
        const templateDir = path.join(tempDir, '_templates', templateName);
        await fs.ensureDir(templateDir);
        const templateFile = path.join(templateDir, 'new.ejs');
        await fs.writeFile(templateFile, templateContent);
        return templateFile;
      },
      
      readFile: async (relativePath) => {
        const fullPath = path.join(tempDir, relativePath);
        return await fs.readFile(fullPath, 'utf8');
      },
      
      exists: async (relativePath) => {
        const fullPath = path.join(tempDir, relativePath);
        return await fs.pathExists(fullPath);
      },
      
      cleanup: async () => {
        await fs.remove(tempDir);
        const index = this.tempDirs.indexOf(tempDir);
        if (index > -1) {
          this.tempDirs.splice(index, 1);
        }
      }
    };
  }

  // Setup common test scenarios
  async setupTemplateTestScenario() {
    const env = await this.createTempEnvironment('template-test');
    
    // Create sample templates
    await env.createTemplate('component', 
      `import React from 'react';

export const <%= name %> = () => {
  return <div><%= name %> Component</div>;
};
`
    );
    
    await env.createTemplate('service',
      `export class <%= name %>Service {
  async get<%= name %>(id: string) {
    return fetch(\`/api/<%= name.toLowerCase() %>/\${id}\`);
  }
}
`
    );
    
    return env;
  }

  async setupErrorTestScenario() {
    const env = await this.createTempEnvironment('error-test');
    
    // Create template with syntax error
    await env.createTemplate('broken',
      `This is <%= broken syntax %><%
`
    );
    
    // Create template with missing variables
    await env.createTemplate('incomplete',
      `export const <%= name %> = {
  value: <%= undefinedVariable %>
};
`
    );
    
    return env;
  }

  // Cleanup all temporary environments
  async cleanup() {
    for (const tempDir of this.tempDirs) {
      try {
        await fs.remove(tempDir);
      } catch (error) {
        console.warn(`Warning: Could not cleanup ${tempDir}`);
      }
    }
    this.tempDirs.length = 0;
  }

  // Reset all mocks and factories
  reset() {
    this.factory.reset();
    // Reset all mock services if they exist
  }
}

// Pre-built test data sets
const TestDataSets = {
  components: [
    { name: 'Button', props: ['onClick', 'disabled', 'children'], hasTests: true },
    { name: 'Modal', props: ['isOpen', 'onClose', 'title'], hasTests: true },
    { name: 'Form', props: ['onSubmit', 'validation', 'fields'], hasTests: false }
  ],
  
  services: [
    { name: 'UserService', endpoints: ['/users', '/users/:id'], hasAuth: true },
    { name: 'ApiService', endpoints: ['/api/data'], hasAuth: false },
    { name: 'AuthService', endpoints: ['/auth/login', '/auth/logout'], hasAuth: true }
  ],
  
  templates: [
    { name: 'react-component', type: 'component', variables: ['name', 'props'] },
    { name: 'express-route', type: 'service', variables: ['name', 'method', 'path'] },
    { name: 'test-suite', type: 'test', variables: ['name', 'describe', 'tests'] }
  ]
};

// Export everything
export {
  TestDataFactory,
  MockServices,
  TestEnvironment,
  TestDataSets
};

// Execute if run directly (for testing the factories themselves)
if (import.meta.url === `file://${__filename}`) {
  console.log('🏭 Testing Test Data Factories...');
  
  const factory = new TestDataFactory();
  const env = new TestEnvironment();
  
  // Test data generation
  console.log('\n📋 Generated Template Data:');
  console.log(JSON.stringify(factory.generateTemplateData(), null, 2));
  
  console.log('\n🧩 Generated Component Data:');
  console.log(JSON.stringify(factory.generateComponentData(), null, 2));
  
  console.log('\n🌐 Generated API Data:');
  console.log(JSON.stringify(factory.generateApiData(), null, 2));
  
  // Test environment setup
  env.createTempEnvironment('factory-test').then(async (testEnv) => {
    await testEnv.createFile('test.txt', 'Hello from test factory!');
    
    const exists = await testEnv.exists('test.txt');
    console.log(`\n📝 Test file exists: ${exists}`);
    
    const content = await testEnv.readFile('test.txt');
    console.log(`📝 Test file content: ${content}`);
    
    await testEnv.cleanup();
    console.log('🧙 Test environment cleaned up');
    
    console.log('\n🎉 Test factories working correctly!');
  }).catch(error => {
    console.error('Test factory error:', error);
    process.exit(1);
  });
}
