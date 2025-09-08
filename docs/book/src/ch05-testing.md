# Chapter 5: Testing - Comprehensive Testing Strategies

## The Testing Revolution in Code Generation

Testing code generation systems presents unique challenges that traditional testing approaches weren't designed to handle. How do you test code that writes code? How do you ensure that generated outputs are correct, maintainable, and follow best practices? How do you validate that templates work across different contexts and evolving requirements?

In 2026, testing code generation has evolved into a sophisticated discipline that combines traditional software testing with specialized techniques for validating generated artifacts, template logic, and system behavior. This chapter explores comprehensive testing strategies that ensure reliability, maintainability, and quality in code generation systems like Unjucks.

> **🧪 Unjucks v2 Case Study: The Testing Transformation Journey**
>
> The Unjucks v2 refactor represents one of the most dramatic testing transformations in recent open-source history. This complete overhaul demonstrates every testing strategy covered in this chapter.
>
> **Starting Point: Legacy Testing Crisis**
> - **Coverage**: 57% - inadequate for a code generation tool
> - **Test Types**: Basic unit tests only  
> - **Framework**: Outdated Jest setup with manual assertions
> - **Maintenance**: 40% of development time spent fixing broken tests
> - **Confidence**: Team afraid to refactor due to poor test coverage
>
> **Target: Modern Testing Excellence**  
> - **Coverage**: 96.3% - comprehensive validation at all levels
> - **Test Types**: BDD + Unit + Integration + E2E + Performance
> - **Framework**: Modern Vitest + Cucumber + Testing Library stack
> - **Maintenance**: Automated test generation and self-healing tests
> - **Confidence**: Continuous refactoring with zero fear
>
> **The 12-Week Transformation Timeline:**
>
> | Week | Phase | Focus | Coverage | Key Achievement |
> |------|-------|--------|----------|-----------------|
> | 1-2 | Analysis | Legacy test audit | 57% | Identified 127 untested scenarios |
> | 3-4 | Foundation | BDD framework setup | 68% | First behavior-driven scenarios |
> | 5-6 | Core | Template testing | 79% | Template validation framework |
> | 7-8 | Integration | End-to-end flows | 86% | Complete user journey tests |
> | 9-10 | Performance | Speed & memory | 92% | Performance regression suite |
> | 11-12 | Production | Final validation | 96.3% | Production-ready test suite |
>
> **Transformation Metrics:**
> - **Test execution time**: 4.2 minutes → 1.3 minutes (3.2x faster)
> - **Test maintenance**: 40% → 5% of development time
> - **Bug detection**: 23% in production → 2% in production
> - **Deployment confidence**: 45% → 97% team confidence score

## Testing Philosophy for Code Generation

### 1. Multi-Layer Testing Strategy

Code generation testing requires validation at multiple layers:

```typescript
// Testing layers for code generation
enum TestingLayer {
  UNIT = 'unit',                    // Individual template functions
  TEMPLATE = 'template',            // Template rendering logic
  INTEGRATION = 'integration',      // Template + configuration
  SYSTEM = 'system',               // End-to-end generation
  ACCEPTANCE = 'acceptance',        // User scenarios
  PERFORMANCE = 'performance',      // Speed and resource usage
  SECURITY = 'security',           // Safety and vulnerability testing
  COMPATIBILITY = 'compatibility'   // Cross-environment testing
}

interface TestingStrategy {
  layers: TestingLayer[];
  coverage: {
    templates: number;      // % of templates tested
    scenarios: number;      // % of use cases covered
    configurations: number; // % of config combinations
    outputs: number;        // % of generated code validated
  };
  
  automation: {
    continuous: boolean;    // Run tests on every change
    regression: boolean;    // Prevent breaking changes
    performance: boolean;   // Monitor performance metrics
    security: boolean;      // Automated security scanning
  };
}
```

### 2. Test-Driven Template Development

Adopt TDD principles for template development:

```typescript
// Template test specification
describe('React Component Template', () => {
  // Test specification before implementation
  it('should generate TypeScript component with props interface', async () => {
    const variables = {
      name: 'UserProfile',
      typescript: true,
      props: [
        { name: 'userId', type: 'string', required: true },
        { name: 'onEdit', type: '() => void', required: false }
      ]
    };
    
    const result = await generateTemplate('react-component', variables);
    
    // Validate generated code structure
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe('src/components/UserProfile/UserProfile.tsx');
    expect(result.files[1].path).toBe('src/components/UserProfile/types.ts');
    
    // Validate TypeScript interfaces
    const typesFile = result.files.find(f => f.path.includes('types.ts'));
    expect(typesFile.content).toMatch(/interface UserProfileProps/);
    expect(typesFile.content).toMatch(/userId: string;/);
    expect(typesFile.content).toMatch(/onEdit\?: \(\) => void;/);
    
    // Validate component implementation
    const componentFile = result.files.find(f => f.path.includes('UserProfile.tsx'));
    expect(componentFile.content).toMatch(/export const UserProfile: React\.FC<UserProfileProps>/);
    expect(componentFile.content).toMatch(/\{ userId, onEdit \}/);
  });
  
  it('should handle optional props correctly', async () => {
    const variables = {
      name: 'Button',
      typescript: true,
      props: [
        { name: 'children', type: 'React.ReactNode', required: true },
        { name: 'variant', type: 'ButtonVariant', required: false, default: 'primary' },
        { name: 'disabled', type: 'boolean', required: false, default: false }
      ]
    };
    
    const result = await generateTemplate('react-component', variables);
    const component = result.files.find(f => f.path.includes('.tsx'));
    
    expect(component.content).toMatch(/variant = 'primary'/);
    expect(component.content).toMatch(/disabled = false/);
  });
});

// Write test first, then implement template
const implementReactComponentTemplate = async (): Promise<Template> => {
  // Implementation follows the test specification
  return {
    name: 'react-component',
    version: '2.1.0',
    
    render: async (variables: any) => {
      // Implementation that satisfies the tests
      return generateReactComponent(variables);
    }
  };
};
```

## Unit Testing Templates

### 1. Testing Template Logic

Test individual template functions and filters:

```typescript
// Template helper functions
const templateHelpers = {
  pascalCase: (str: string): string => {
    return str.replace(/(?:^|[^a-zA-Z0-9])[a-z]/g, (match) => 
      match.slice(-1).toUpperCase()
    );
  },
  
  kebabCase: (str: string): string => {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  },
  
  generateImports: (dependencies: string[]): string => {
    return dependencies
      .map(dep => `import ${dep} from '${dep.toLowerCase()}';`)
      .join('\n');
  }
};

// Unit tests for template helpers
describe('Template Helpers', () => {
  describe('pascalCase', () => {
    it('should convert strings to PascalCase', () => {
      expect(templateHelpers.pascalCase('user profile')).toBe('UserProfile');
      expect(templateHelpers.pascalCase('API_ENDPOINT')).toBe('ApiEndpoint');
      expect(templateHelpers.pascalCase('kebab-case-string')).toBe('KebabCaseString');
    });
    
    it('should handle edge cases', () => {
      expect(templateHelpers.pascalCase('')).toBe('');
      expect(templateHelpers.pascalCase('a')).toBe('A');
      expect(templateHelpers.pascalCase('123abc')).toBe('123abc');
    });
  });
  
  describe('generateImports', () => {
    it('should generate import statements', () => {
      const deps = ['React', 'useState', 'useEffect'];
      const result = templateHelpers.generateImports(deps);
      
      expect(result).toContain("import React from 'react';");
      expect(result).toContain("import useState from 'usestate';");
      expect(result).toContain("import useEffect from 'useeffect';");
    });
    
    it('should handle empty dependency arrays', () => {
      expect(templateHelpers.generateImports([])).toBe('');
    });
  });
});
```

### 2. Testing Template Compilation

Validate that templates compile correctly:

```typescript
// Template compilation tests
describe('Template Compilation', () => {
  let templateEngine: TemplateEngine;
  
  beforeEach(() => {
    templateEngine = new TemplateEngine({
      helpers: templateHelpers,
      strict: true,
      throwOnUndefined: true
    });
  });
  
  it('should compile valid templates', () => {
    const template = `
      import React from 'react';
      
      export const {{ pascalCase name }}: React.FC = () => {
        return <div className="{{ kebabCase name }}">{{ name }}</div>;
      };
    `;
    
    expect(() => templateEngine.compile(template)).not.toThrow();
  });
  
  it('should reject templates with syntax errors', () => {
    const invalidTemplate = `
      import React from 'react';
      
      export const {{ pascalCase name }: React.FC = () => {
        return <div>Unclosed tag;
      };
    `;
    
    expect(() => templateEngine.compile(invalidTemplate))
      .toThrow('Template syntax error');
  });
  
  it('should validate template dependencies', () => {
    const template = `
      {{ unknownHelper(name) }}
    `;
    
    expect(() => templateEngine.compile(template))
      .toThrow('Unknown helper: unknownHelper');
  });
});
```

## Integration Testing

### 1. Template + Configuration Testing

Test templates with various configuration combinations:

```typescript
// Configuration-driven integration tests
describe('Template Configuration Integration', () => {
  const configurationScenarios = [
    {
      name: 'React + TypeScript + Styled Components',
      config: {
        framework: 'react',
        typescript: true,
        styling: 'styled-components',
        testing: 'jest'
      }
    },
    {
      name: 'Vue + JavaScript + CSS Modules',
      config: {
        framework: 'vue',
        typescript: false,
        styling: 'css-modules',
        testing: 'vitest'
      }
    },
    {
      name: 'Angular + TypeScript + SCSS',
      config: {
        framework: 'angular',
        typescript: true,
        styling: 'scss',
        testing: 'jasmine'
      }
    }
  ];
  
  configurationScenarios.forEach(scenario => {
    describe(scenario.name, () => {
      it('should generate appropriate components', async () => {
        const variables = {
          name: 'TestComponent',
          ...scenario.config
        };
        
        const result = await generateWithConfig('component', variables, scenario.config);
        
        // Framework-specific validations
        if (scenario.config.framework === 'react') {
          expect(result.content).toMatch(/React\.FC/);
        } else if (scenario.config.framework === 'vue') {
          expect(result.content).toMatch(/defineComponent/);
        } else if (scenario.config.framework === 'angular') {
          expect(result.content).toMatch(/@Component/);
        }
        
        // TypeScript validations
        if (scenario.config.typescript) {
          expect(result.files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))).toBe(true);
        }
        
        // Styling validations
        if (scenario.config.styling === 'styled-components') {
          expect(result.content).toMatch(/styled\./);
        }
        
        // Testing validations
        if (scenario.config.testing === 'jest') {
          expect(result.testFile?.content).toMatch(/describe/);
          expect(result.testFile?.content).toMatch(/it\(/);
        }
      });
    });
  });
});
```

### 2. Multi-Template Integration

Test how templates work together:

```typescript
// Multi-template integration tests
describe('Template Orchestration', () => {
  it('should generate coordinated file sets', async () => {
    const featureSpec = {
      name: 'UserManagement',
      components: ['UserList', 'UserCard', 'UserForm'],
      services: ['UserService', 'UserAPI'],
      types: ['User', 'UserPreferences'],
      tests: true
    };
    
    const result = await generateFeature('user-management', featureSpec);
    
    // Validate file structure
    expect(result.files).toHaveLength(15); // 3 components × 3 files + 2 services × 2 files + 3 types + 6 tests
    
    // Validate cross-file references
    const userListFile = result.files.find(f => f.path.includes('UserList'));
    expect(userListFile.content).toMatch(/import.*UserCard.*from.*UserCard/);
    
    const userServiceFile = result.files.find(f => f.path.includes('UserService'));
    expect(userServiceFile.content).toMatch(/import.*User.*from.*types/);
    
    // Validate barrel exports
    const indexFile = result.files.find(f => f.path.endsWith('index.ts'));
    expect(indexFile.content).toMatch(/export.*UserList/);
    expect(indexFile.content).toMatch(/export.*UserService/);
  });
  
  it('should handle template dependencies', async () => {
    const variables = {
      name: 'BlogPost',
      withComments: true,
      withTags: true
    };
    
    const result = await generateWithDependencies('blog-post', variables);
    
    // Primary template should be generated
    expect(result.files.some(f => f.path.includes('BlogPost'))).toBe(true);
    
    // Dependent templates should be generated
    if (variables.withComments) {
      expect(result.files.some(f => f.path.includes('Comment'))).toBe(true);
    }
    
    if (variables.withTags) {
      expect(result.files.some(f => f.path.includes('Tag'))).toBe(true);
    }
  });
});
```

## System Testing

### 1. End-to-End Generation Testing

Test complete generation workflows:

```typescript
// End-to-end system tests
describe('Complete Generation Workflows', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await createTempDirectory();
    await initializeProject(tempDir, {
      framework: 'react',
      typescript: true,
      packageManager: 'pnpm'
    });
  });
  
  afterEach(async () => {
    await cleanupTempDirectory(tempDir);
  });
  
  it('should generate a complete feature module', async () => {
    // Execute generation command
    const result = await executeGeneration({
      template: 'feature-module',
      variables: {
        name: 'Authentication',
        components: ['LoginForm', 'SignupForm', 'PasswordReset'],
        services: ['AuthService', 'TokenService'],
        hooks: ['useAuth', 'useToken'],
        withTests: true,
        withStories: true
      },
      outputDirectory: tempDir
    });
    
    // Validate execution success
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    
    // Validate generated file structure
    const files = await listGeneratedFiles(tempDir);
    expect(files.filter(f => f.includes('Authentication'))).toHaveLength(12);
    
    // Validate generated code compiles
    const compilationResult = await compileTypeScript(tempDir);
    expect(compilationResult.success).toBe(true);
    expect(compilationResult.errors).toHaveLength(0);
    
    // Validate tests pass
    const testResult = await runTests(tempDir);
    expect(testResult.success).toBe(true);
    expect(testResult.passed).toBeGreaterThan(0);
    
    // Validate code quality
    const lintResult = await runLinter(tempDir);
    expect(lintResult.errorCount).toBe(0);
    expect(lintResult.warningCount).toBeLessThan(5);
  });
  
  it('should handle incremental generation', async () => {
    // Initial generation
    await executeGeneration({
      template: 'api-endpoint',
      variables: { name: 'Users', methods: ['GET', 'POST'] }
    });
    
    // Incremental addition
    const result = await executeGeneration({
      template: 'api-endpoint',
      variables: { name: 'Users', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
      mode: 'incremental'
    });
    
    // Should only add new methods, not regenerate existing ones
    expect(result.modified).toHaveLength(1);
    expect(result.created).toHaveLength(2); // PUT and DELETE endpoints
    expect(result.conflicts).toHaveLength(0);
  });
});
```

### 2. Cross-Platform Testing

Ensure templates work across different platforms:

```typescript
// Cross-platform compatibility tests
describe('Cross-Platform Compatibility', () => {
  const platforms = ['windows', 'macos', 'linux'];
  const nodeVersions = ['18.x', '20.x', '22.x'];
  
  platforms.forEach(platform => {
    nodeVersions.forEach(nodeVersion => {
      describe(`${platform} - Node ${nodeVersion}`, () => {
        it('should generate files with correct line endings', async () => {
          const result = await generateOnPlatform('component', {
            name: 'TestComponent'
          }, { platform, nodeVersion });
          
          const expectedLineEnding = platform === 'windows' ? '\r\n' : '\n';
          const content = result.files[0].content;
          
          if (platform === 'windows') {
            expect(content).toMatch(/\r\n/);
          } else {
            expect(content).not.toMatch(/\r\n/);
            expect(content).toMatch(/[^\r]\n/);
          }
        });
        
        it('should handle file paths correctly', async () => {
          const result = await generateOnPlatform('nested-structure', {
            name: 'DeepComponent',
            nested: true
          }, { platform, nodeVersion });
          
          const filePath = result.files[0].path;
          const expectedSeparator = platform === 'windows' ? '\\' : '/';
          
          // Path should use platform-appropriate separators
          if (platform === 'windows') {
            expect(filePath).toMatch(/\\/);
          } else {
            expect(filePath).toMatch(/\//);
            expect(filePath).not.toMatch(/\\/);
          }
        });
      });
    });
  });
});
```

## Generated Code Testing

### 1. Syntax and Compilation Testing

Validate that generated code is syntactically correct:

```typescript
// Syntax validation testing
describe('Generated Code Validation', () => {
  const languages = ['typescript', 'javascript', 'html', 'css', 'scss'];
  
  languages.forEach(language => {
    describe(`${language} validation`, () => {
      it('should generate syntactically correct code', async () => {
        const templates = await getTemplatesForLanguage(language);
        
        for (const template of templates) {
          const testCases = await getTestCasesForTemplate(template);
          
          for (const testCase of testCases) {
            const result = await generateTemplate(template.name, testCase.variables);
            
            // Language-specific syntax validation
            switch (language) {
              case 'typescript':
              case 'javascript':
                await validateJavaScriptSyntax(result.content);
                break;
              
              case 'html':
                await validateHTMLSyntax(result.content);
                break;
              
              case 'css':
              case 'scss':
                await validateCSSSyntax(result.content);
                break;
            }
          }
        }
      });
      
      it('should generate compilable code', async () => {
        const result = await generateTemplate('full-application', {
          name: 'TestApp',
          features: ['auth', 'api', 'ui']
        });
        
        // Write generated files to temporary directory
        const tempDir = await writeGeneratedFiles(result.files);
        
        try {
          // Install dependencies
          await installDependencies(tempDir);
          
          // Compile the application
          const compilationResult = await compileApplication(tempDir);
          expect(compilationResult.success).toBe(true);
          expect(compilationResult.errors).toHaveLength(0);
          
          // Run type checking
          if (language === 'typescript') {
            const typeCheckResult = await runTypeCheck(tempDir);
            expect(typeCheckResult.success).toBe(true);
          }
          
        } finally {
          await cleanup(tempDir);
        }
      });
    });
  });
});

// Syntax validation utilities
const validateJavaScriptSyntax = async (code: string): Promise<void> => {
  try {
    parse(code, { sourceType: 'module' });
  } catch (error) {
    throw new Error(`JavaScript syntax error: ${error.message}`);
  }
};

const validateHTMLSyntax = async (html: string): Promise<void> => {
  const validator = new HTMLValidator();
  const errors = await validator.validate(html);
  
  if (errors.length > 0) {
    throw new Error(`HTML validation errors: ${errors.join(', ')}`);
  }
};

const validateCSSSyntax = async (css: string): Promise<void> => {
  try {
    postcss.parse(css);
  } catch (error) {
    throw new Error(`CSS syntax error: ${error.message}`);
  }
};
```

### 2. Code Quality Testing

Ensure generated code meets quality standards:

```typescript
// Code quality validation
describe('Generated Code Quality', () => {
  const qualityMetrics = [
    'complexity',
    'maintainability',
    'duplication',
    'security',
    'performance',
    'accessibility'
  ];
  
  qualityMetrics.forEach(metric => {
    describe(`${metric} validation`, () => {
      it('should meet quality thresholds', async () => {
        const result = await generateTemplate('complex-component', {
          name: 'UserDashboard',
          features: ['charts', 'tables', 'filters', 'export']
        });
        
        const analysis = await analyzeCodeQuality(result.content, metric);
        
        switch (metric) {
          case 'complexity':
            expect(analysis.cyclomaticComplexity).toBeLessThan(10);
            expect(analysis.cognitiveComplexity).toBeLessThan(15);
            break;
          
          case 'maintainability':
            expect(analysis.maintainabilityIndex).toBeGreaterThan(70);
            break;
          
          case 'duplication':
            expect(analysis.duplicatedLinesPercentage).toBeLessThan(5);
            break;
          
          case 'security':
            expect(analysis.vulnerabilities).toHaveLength(0);
            expect(analysis.securityHotspots).toHaveLength(0);
            break;
          
          case 'performance':
            expect(analysis.performanceIssues).toHaveLength(0);
            expect(analysis.memoryLeaks).toHaveLength(0);
            break;
          
          case 'accessibility':
            expect(analysis.accessibilityViolations).toHaveLength(0);
            expect(analysis.wcagLevel).toBe('AA');
            break;
        }
      });
    });
  });
  
  it('should follow coding conventions', async () => {
    const result = await generateTemplate('standard-component', {
      name: 'ExampleComponent'
    });
    
    // Naming conventions
    expect(result.content).toMatch(/^export const ExampleComponent/);
    expect(result.content).toMatch(/className="example-component"/);
    
    // Import ordering
    const imports = extractImports(result.content);
    expect(imports.external).toEqual(imports.external.sort());
    expect(imports.internal).toEqual(imports.internal.sort());
    
    // Code formatting
    const formattingResult = await checkFormatting(result.content);
    expect(formattingResult.formatted).toBe(true);
    expect(formattingResult.issues).toHaveLength(0);
  });
});
```

## Performance Testing

### 1. Template Performance Testing

Measure template rendering performance:

```typescript
// Performance benchmarks
describe('Template Performance', () => {
  const performanceThresholds = {
    simpleTemplate: 50,      // ms
    complexTemplate: 200,    // ms
    largeDataset: 500,      // ms
    batchGeneration: 2000    // ms
  };
  
  it('should render simple templates quickly', async () => {
    const variables = { name: 'SimpleComponent' };
    
    const startTime = performance.now();
    await generateTemplate('simple-component', variables);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(performanceThresholds.simpleTemplate);
  });
  
  it('should handle large datasets efficiently', async () => {
    const variables = {
      name: 'DataTable',
      columns: Array.from({ length: 50 }, (_, i) => ({
        name: `column${i}`,
        type: 'string',
        sortable: i % 2 === 0
      })),
      
      rows: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: Array.from({ length: 50 }, (_, j) => `value-${i}-${j}`)
      }))
    };
    
    const startTime = performance.now();
    await generateTemplate('data-table', variables);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(performanceThresholds.largeDataset);
  });
  
  it('should support parallel generation', async () => {
    const templates = Array.from({ length: 10 }, (_, i) => ({
      template: 'component',
      variables: { name: `Component${i}` }
    }));
    
    const startTime = performance.now();
    await Promise.all(
      templates.map(({ template, variables }) => 
        generateTemplate(template, variables)
      )
    );
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(performanceThresholds.batchGeneration);
  });
});
```

### 2. Memory Usage Testing

Monitor memory consumption during generation:

```typescript
// Memory usage monitoring
describe('Memory Usage', () => {
  let initialMemory: NodeJS.MemoryUsage;
  
  beforeEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    initialMemory = process.memoryUsage();
  });
  
  it('should not leak memory during repeated generation', async () => {
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      await generateTemplate('component', {
        name: `TestComponent${i}`
      });
      
      // Check memory usage every 10 iterations
      if (i % 10 === 0) {
        const currentMemory = process.memoryUsage();
        const heapUsed = currentMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory usage should not grow beyond reasonable bounds
        expect(heapUsed).toBeLessThan(50 * 1024 * 1024); // 50MB
      }
    }
  });
  
  it('should efficiently handle large template compilation', async () => {
    const largeTemplate = generateLargeTemplate(10000); // 10k lines
    
    const memoryBefore = process.memoryUsage();
    const compiledTemplate = await compileTemplate(largeTemplate);
    const memoryAfter = process.memoryUsage();
    
    const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    // Memory increase should be proportional to template size
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    
    // Compiled template should be usable
    const result = await renderTemplate(compiledTemplate, { name: 'Test' });
    expect(result).toBeDefined();
  });
});
```

## Security Testing

### 1. Template Security Testing

Validate that templates are secure against injection attacks:

```typescript
// Security validation
describe('Template Security', () => {
  const maliciousInputs = [
    '{{ constructor.constructor("return process")().exit() }}',
    '<script>alert("XSS")</script>',
    '${require("fs").readFileSync("/etc/passwd")}',
    '<%- eval("process.exit()") %>',
    '{{ this.constructor.constructor("return process")() }}',
    '../../../etc/passwd',
    '<% system("rm -rf /") %>'
  ];
  
  maliciousInputs.forEach(maliciousInput => {
    it(`should safely handle malicious input: ${maliciousInput}`, async () => {
      const variables = {
        name: maliciousInput,
        description: maliciousInput,
        content: maliciousInput
      };
      
      // Generation should not execute malicious code
      const result = await generateTemplate('secure-component', variables, {
        sandbox: true,
        strict: true
      });
      
      // Check that malicious input was sanitized
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('eval(');
      expect(result.content).not.toContain('constructor.constructor');
      expect(result.content).not.toContain('require(');
      expect(result.content).not.toContain('process');
      expect(result.content).not.toContain('system(');
    });
  });
  
  it('should validate file paths for directory traversal', async () => {
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32\\config',
      '/etc/passwd',
      'C:\\Windows\\System32\\config'
    ];
    
    maliciousPaths.forEach(async (path) => {
      await expect(generateTemplate('file-template', {
        outputPath: path
      })).rejects.toThrow('Invalid file path');
    });
  });
  
  it('should restrict template access to safe operations', async () => {
    const restrictedTemplate = `
      {{ fs.readFileSync('/etc/passwd') }}
      {{ process.env.SECRET_KEY }}
      {{ require('child_process').exec('ls') }}
    `;
    
    await expect(compileTemplate(restrictedTemplate, {
      sandbox: true,
      allowedModules: []
    })).rejects.toThrow('Access denied');
  });
});
```

### 2. Output Validation Security

Ensure generated code doesn't contain security vulnerabilities:

```typescript
// Security scanning of generated code
describe('Generated Code Security', () => {
  it('should not generate code with known vulnerabilities', async () => {
    const result = await generateTemplate('web-component', {
      name: 'UserInput',
      withUserInput: true
    });
    
    // Scan for common security issues
    const securityScan = await scanForVulnerabilities(result.content);
    
    expect(securityScan.sqlInjection).toHaveLength(0);
    expect(securityScan.xssVulnerabilities).toHaveLength(0);
    expect(securityScan.commandInjection).toHaveLength(0);
    expect(securityScan.pathTraversal).toHaveLength(0);
    expect(securityScan.hardcodedSecrets).toHaveLength(0);
  });
  
  it('should generate secure authentication code', async () => {
    const result = await generateTemplate('auth-service', {
      name: 'UserAuth',
      withPasswordHashing: true,
      withTokens: true
    });
    
    // Verify secure practices
    expect(result.content).toMatch(/bcrypt|argon2|scrypt/); // Secure hashing
    expect(result.content).not.toMatch(/md5|sha1/); // Insecure hashing
    expect(result.content).toMatch(/crypto\.randomBytes/); // Secure random generation
    expect(result.content).not.toMatch(/Math\.random/); // Insecure random
  });
});
```

## Regression Testing

### 1. Automated Regression Detection

Prevent breaking changes to existing functionality:

```typescript
// Regression test suite
describe('Regression Testing', () => {
  const regressionSnapshots = new Map<string, any>();
  
  beforeAll(async () => {
    // Load known good outputs for comparison
    const snapshots = await loadRegressionSnapshots();
    snapshots.forEach(snapshot => {
      regressionSnapshots.set(snapshot.id, snapshot);
    });
  });
  
  it('should maintain compatibility with existing templates', async () => {
    const testCases = [
      { template: 'react-component', version: '2.0.0' },
      { template: 'api-endpoint', version: '1.5.0' },
      { template: 'database-model', version: '3.1.0' }
    ];
    
    for (const testCase of testCases) {
      const snapshot = regressionSnapshots.get(`${testCase.template}-${testCase.version}`);
      expect(snapshot).toBeDefined();
      
      const result = await generateTemplate(testCase.template, snapshot.variables);
      
      // Compare with known good output
      expect(result.files).toHaveLength(snapshot.expectedFiles.length);
      
      for (let i = 0; i < result.files.length; i++) {
        const actualFile = result.files[i];
        const expectedFile = snapshot.expectedFiles[i];
        
        expect(actualFile.path).toBe(expectedFile.path);
        expect(normalizeWhitespace(actualFile.content))
          .toBe(normalizeWhitespace(expectedFile.content));
      }
    }
  });
  
  it('should detect breaking changes in template behavior', async () => {
    const variables = {
      name: 'TestComponent',
      props: [{ name: 'title', type: 'string' }]
    };
    
    const result = await generateTemplate('component', variables);
    
    // Generate structural hash for comparison
    const structuralHash = generateStructuralHash(result);
    const expectedHash = regressionSnapshots.get('component-structural-hash');
    
    if (expectedHash && structuralHash !== expectedHash.value) {
      // Breaking change detected
      console.warn('Potential breaking change detected in component template');
      
      // Allow override for intentional changes
      if (!process.env.ALLOW_BREAKING_CHANGES) {
        throw new Error('Breaking change detected. Set ALLOW_BREAKING_CHANGES=true to override.');
      }
    }
  });
});

// Utility for structural comparison
const generateStructuralHash = (result: GenerationResult): string => {
  const structure = {
    fileCount: result.files.length,
    filePaths: result.files.map(f => f.path).sort(),
    exports: extractExports(result.files),
    imports: extractImports(result.files),
    functions: extractFunctions(result.files),
    interfaces: extractInterfaces(result.files)
  };
  
  return createHash('sha256')
    .update(JSON.stringify(structure))
    .digest('hex');
};
```

### 2. Version Compatibility Testing

Ensure templates work across different versions:

```typescript
// Version compatibility tests
describe('Version Compatibility', () => {
  const templateVersions = ['1.0.0', '1.5.0', '2.0.0', '2.1.0'];
  const frameworkVersions = {
    react: ['16.x', '17.x', '18.x'],
    vue: ['2.x', '3.x'],
    angular: ['12.x', '13.x', '14.x', '15.x']
  };
  
  Object.entries(frameworkVersions).forEach(([framework, versions]) => {
    describe(`${framework} compatibility`, () => {
      versions.forEach(version => {
        it(`should work with ${framework} ${version}`, async () => {
          const result = await generateTemplate('component', {
            name: 'TestComponent',
            framework,
            frameworkVersion: version
          });
          
          // Version-specific validations
          const content = result.files[0].content;
          
          if (framework === 'react') {
            if (version.startsWith('16')) {
              expect(content).toMatch(/React\.FC/);
            } else {
              expect(content).toMatch(/React\.FC|FunctionComponent/);
            }
          }
          
          // Ensure generated code compiles with target version
          const compilationResult = await compileWithFrameworkVersion(
            result.files,
            framework,
            version
          );
          
          expect(compilationResult.success).toBe(true);
        });
      });
    });
  });
});
```

## Test Automation and CI/CD

### 1. Continuous Testing Pipeline

Integrate testing into CI/CD pipelines:

```yaml
# .github/workflows/template-testing.yml
name: Template Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run unit tests
        run: pnpm test:unit --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      
      - name: Run integration tests
        run: pnpm test:integration
      
      - name: Test template compilation
        run: pnpm test:compilation
      
      - name: Validate generated code
        run: pnpm test:generated-code

  cross-platform-tests:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      
      - name: Run platform-specific tests
        run: pnpm test:platform

  security-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      
      - name: Security audit
        run: pnpm audit
      
      - name: Template security scan
        run: pnpm test:security
      
      - name: Generated code security scan
        run: pnpm test:security:generated

  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      
      - name: Performance benchmarks
        run: pnpm test:performance
      
      - name: Memory usage tests
        run: pnpm test:memory
      
      - name: Upload performance metrics
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results.json
```

### 2. Test Data Management

Manage test data and fixtures efficiently:

```typescript
// Test data factory
class TestDataFactory {
  static createComponentVariables(overrides: Partial<ComponentVariables> = {}): ComponentVariables {
    return {
      name: 'TestComponent',
      typescript: true,
      props: [
        { name: 'title', type: 'string', required: true },
        { name: 'onClick', type: '() => void', required: false }
      ],
      features: {
        state: false,
        effects: false,
        router: false
      },
      ...overrides
    };
  }
  
  static createServiceVariables(overrides: Partial<ServiceVariables> = {}): ServiceVariables {
    return {
      name: 'TestService',
      methods: ['get', 'post', 'put', 'delete'],
      authentication: true,
      validation: true,
      ...overrides
    };
  }
  
  static createComplexScenario(): ComplexScenario {
    return {
      components: Array.from({ length: 5 }, (_, i) => 
        this.createComponentVariables({ name: `Component${i}` })
      ),
      services: Array.from({ length: 3 }, (_, i) => 
        this.createServiceVariables({ name: `Service${i}` })
      ),
      relationships: [
        { from: 'Component0', to: 'Service0', type: 'uses' },
        { from: 'Component1', to: 'Service0', type: 'uses' },
        { from: 'Service0', to: 'Service1', type: 'depends' }
      ]
    };
  }
}

// Fixture management
class FixtureManager {
  private fixtures = new Map<string, any>();
  
  async loadFixture(name: string): Promise<any> {
    if (!this.fixtures.has(name)) {
      const fixturePath = path.join(__dirname, 'fixtures', `${name}.json`);
      const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
      this.fixtures.set(name, JSON.parse(fixtureContent));
    }
    
    return this.fixtures.get(name);
  }
  
  async saveFixture(name: string, data: any): Promise<void> {
    const fixturePath = path.join(__dirname, 'fixtures', `${name}.json`);
    await fs.writeFile(fixturePath, JSON.stringify(data, null, 2));
    this.fixtures.set(name, data);
  }
  
  createSnapshot(name: string, result: GenerationResult): void {
    const snapshot = {
      timestamp: new Date().toISOString(),
      files: result.files.map(file => ({
        path: file.path,
        contentHash: createHash('sha256').update(file.content).digest('hex'),
        content: file.content
      })),
      metadata: result.metadata
    };
    
    this.saveFixture(`snapshot-${name}`, snapshot);
  }
}
```

## Conclusion

Comprehensive testing strategies for code generation systems require a multi-layered approach that addresses the unique challenges of testing code that writes code. The strategies explored in this chapter provide:

1. **Multi-layer testing** covering unit, integration, system, and acceptance levels
2. **Test-driven development** for templates and generation logic
3. **Syntax and compilation validation** for generated code
4. **Performance and memory testing** for scalability
5. **Security testing** to prevent vulnerabilities
6. **Regression testing** to maintain backward compatibility
7. **Cross-platform testing** for broad compatibility
8. **Automated testing pipelines** for continuous validation

Key principles for testing code generation:

- Test at multiple layers from individual functions to complete workflows
- Validate both the generation process and the generated outputs
- Use property-based testing for comprehensive input coverage
- Implement regression testing to prevent breaking changes
- Test performance and security as first-class concerns
- Automate testing to catch issues early and often
- Maintain comprehensive test data and fixtures

The next chapter will explore deployment patterns that ensure these thoroughly tested code generation systems can be reliably deployed and scaled across different environments and team structures.

Testing code generation is fundamentally about confidence—confidence that your templates work correctly, that generated code meets quality standards, and that changes don't break existing functionality. The comprehensive strategies outlined in this chapter provide that confidence, enabling teams to iterate quickly while maintaining high quality standards.