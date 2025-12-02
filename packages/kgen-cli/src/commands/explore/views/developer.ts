/**
 * Developer View Generator (TypeScript)
 * 
 * Provides API documentation, code examples, quickstart guides and implementation
 * details for software developers and engineers.
 * 
 * Outputs static JSON suitable for GitHub Pages hosting with marketplace links.
 */

interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  responses: Array<{
    status: number;
    description: string;
    schema: any;
  }>;
  examples: Array<{
    title: string;
    request: any;
    response: any;
  }>;
}

interface InstallCommand {
  manager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  command: string;
  global: boolean;
  postInstall?: string[];
}

interface CodeExample {
  title: string;
  description: string;
  language: string;
  code: string;
  marketplaceUrl?: string;
  dependencies: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

interface APIContract {
  name: string;
  version: string;
  baseUrl: string;
  authentication: {
    type: 'bearer' | 'api-key' | 'oauth2' | 'none';
    description: string;
    examples: Record<string, string>;
  };
  endpoints: APIEndpoint[];
  rateLimit: {
    requests: number;
    window: string;
    headers: string[];
  };
  sdk: {
    javascript: string;
    typescript: string;
    python: string;
    go: string;
    java: string;
  };
}

interface QuickstartGuide {
  title: string;
  description: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  steps: Array<{
    title: string;
    description: string;
    code?: string;
    command?: string;
    marketplacePackage?: {
      name: string;
      url: string;
      installation: string;
    };
  }>;
  nextSteps: string[];
  troubleshooting: Array<{
    issue: string;
    solution: string;
  }>;
}

interface DeveloperViewData {
  viewType: 'developer';
  persona: 'Software Developer';
  timestamp: string;
  summary: {
    availableAPIs: number;
    codeExamples: number;
    quickstartGuides: number;
    supportedLanguages: string[];
    difficultyLevels: Record<string, number>;
    installMethods: number;
  };
  installation: {
    commands: InstallCommand[];
    requirements: {
      node: string;
      npm: string;
      system: string[];
    };
    verification: {
      command: string;
      expectedOutput: string;
    };
    troubleshooting: Array<{
      issue: string;
      solution: string;
      command?: string;
    }>;
  };
  apis: {
    contracts: APIContract[];
    playground: {
      url: string;
      interactive: boolean;
      examples: string[];
    };
    documentation: {
      openapi: string;
      postman: string;
      insomnia: string;
    };
  };
  examples: {
    byCategory: Record<string, CodeExample[]>;
    byLanguage: Record<string, CodeExample[]>;
    featured: CodeExample[];
    interactive: Array<{
      name: string;
      url: string;
      environment: 'sandbox' | 'codesandbox' | 'stackblitz';
    }>;
    repositories: Array<{
      name: string;
      url: string;
      description: string;
      stars: number;
      language: string;
    }>;
  };
  quickstarts: {
    gettingStarted: QuickstartGuide[];
    tutorials: Array<{
      title: string;
      url: string;
      duration: string;
      difficulty: string;
      topics: string[];
    }>;
    workflows: Array<{
      name: string;
      description: string;
      steps: string[];
      marketplacePackages: Array<{
        name: string;
        url: string;
        role: string;
      }>;
    }>;
    bestPractices: Array<{
      category: string;
      practices: Array<{
        title: string;
        description: string;
        example?: string;
      }>;
    }>;
  };
  tools: {
    cli: Array<{
      name: string;
      description: string;
      installation: string;
      commands: Array<{
        command: string;
        description: string;
        example: string;
      }>;
    }>;
    ide: Array<{
      name: string;
      marketplace: string;
      features: string[];
      installUrl: string;
    }>;
    testing: Array<{
      framework: string;
      language: string;
      setup: string;
      exampleUrl: string;
    }>;
    cicd: Array<{
      platform: string;
      configUrl: string;
      marketplaceAction?: string;
    }>;
  };
  marketplaceIntegrations: {
    developerTools: Array<{
      name: string;
      url: string;
      category: string;
      description: string;
      installation: InstallCommand;
      quickstart: string;
    }>;
    templates: Array<{
      name: string;
      url: string;
      framework: string;
      features: string[];
      complexity: string;
    }>;
    extensions: Array<{
      name: string;
      url: string;
      platform: string;
      rating: number;
      downloads: number;
    }>;
  };
}

interface GenerateOptions {
  depth?: 'summary' | 'detailed' | 'comprehensive';
  filter?: string;
  format?: 'json' | 'yaml' | 'table';
}

interface GenerateResult {
  success: boolean;
  data: DeveloperViewData | null;
  error?: string;
  metadata: {
    generated: string;
    schema: string;
    version: string;
    githubPagesReady: boolean;
  };
}

class DeveloperViewGenerator {
  async generate(options: GenerateOptions = {}): Promise<GenerateResult> {
    const { depth = 'summary', filter, format = 'json' } = options;
    
    try {
      const [installation, apis, examples, quickstarts, tools, marketplace] = await Promise.all([
        this.generateInstallationInstructions(),
        this.generateAPIContracts(),
        this.generateCodeExamples(filter),
        this.generateQuickstartGuides(),
        this.generateDeveloperTools(),
        this.getMarketplaceIntegrations()
      ]);

      const developerView: DeveloperViewData = {
        viewType: 'developer',
        persona: 'Software Developer',
        timestamp: new Date().toISOString(),
        summary: {
          availableAPIs: apis.contracts.length,
          codeExamples: Object.values(examples.byCategory).flat().length,
          quickstartGuides: quickstarts.gettingStarted.length,
          supportedLanguages: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'C#'],
          difficultyLevels: {
            beginner: 45,
            intermediate: 32,
            advanced: 18
          },
          installMethods: installation.commands.length
        },
        installation,
        apis,
        examples,
        quickstarts,
        tools,
        marketplaceIntegrations: marketplace
      };

      return {
        success: true,
        data: developerView,
        metadata: {
          generated: new Date().toISOString(),
          schema: 'kmkt:DeveloperView',
          version: '2.0.0',
          githubPagesReady: true
        }
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        data: null,
        metadata: {
          generated: new Date().toISOString(),
          schema: 'kmkt:DeveloperView',
          version: '2.0.0',
          githubPagesReady: false
        }
      };
    }
  }

  private async generateInstallationInstructions() {
    const commands: InstallCommand[] = [
      {
        manager: 'npm',
        command: 'npm install -g @kgen/cli',
        global: true,
        postInstall: ['kgen --version', 'kgen init']
      },
      {
        manager: 'yarn',
        command: 'yarn global add @kgen/cli',
        global: true,
        postInstall: ['kgen --version']
      },
      {
        manager: 'pnpm',
        command: 'pnpm add -g @kgen/cli',
        global: true
      },
      {
        manager: 'bun',
        command: 'bun add -g @kgen/cli',
        global: true
      }
    ];

    return {
      commands,
      requirements: {
        node: '>=18.0.0',
        npm: '>=9.0.0',
        system: ['Git', 'Docker (optional)']
      },
      verification: {
        command: 'kgen --version',
        expectedOutput: '@kgen/cli version 2.0.0'
      },
      troubleshooting: [
        {
          issue: 'Permission denied during global installation',
          solution: 'Use sudo or configure npm to use a different directory',
          command: 'npm config set prefix ~/.npm-global'
        },
        {
          issue: 'Command not found after installation',
          solution: 'Add npm global bin directory to PATH',
          command: 'echo "export PATH=\$PATH:$(npm config get prefix)/bin" >> ~/.bashrc'
        }
      ]
    };
  }

  private async generateAPIContracts() {
    const mainAPI: APIContract = {
      name: 'KGEN API',
      version: '2.0.0',
      baseUrl: 'https://api.kgen.dev/v2',
      authentication: {
        type: 'bearer',
        description: 'Bearer token authentication using API key',
        examples: {
          header: 'Authorization: Bearer your-api-key-here',
          curl: 'curl -H "Authorization: Bearer $KGEN_API_KEY"'
        }
      },
      endpoints: [
        {
          path: '/packages',
          method: 'GET',
          description: 'List available packages',
          parameters: [
            {
              name: 'category',
              type: 'string',
              required: false,
              description: 'Filter by package category'
            },
            {
              name: 'limit',
              type: 'number',
              required: false,
              description: 'Number of results to return (default: 20)'
            }
          ],
          responses: [
            {
              status: 200,
              description: 'Success',
              schema: {
                type: 'object',
                properties: {
                  packages: { type: 'array' },
                  total: { type: 'number' },
                  page: { type: 'number' }
                }
              }
            }
          ],
          examples: [
            {
              title: 'List all packages',
              request: {
                url: '/packages',
                headers: { 'Authorization': 'Bearer token' }
              },
              response: {
                packages: [{ name: 'kgen-api-scaffold', version: '1.0.0' }],
                total: 127,
                page: 1
              }
            }
          ]
        },
        {
          path: '/packages/{id}/install',
          method: 'POST',
          description: 'Install a package',
          parameters: [
            {
              name: 'id',
              type: 'string',
              required: true,
              description: 'Package identifier'
            }
          ],
          responses: [
            {
              status: 201,
              description: 'Package installed successfully',
              schema: {
                type: 'object',
                properties: {
                  installId: { type: 'string' },
                  status: { type: 'string' },
                  artifacts: { type: 'array' }
                }
              }
            }
          ],
          examples: [
            {
              title: 'Install API scaffold package',
              request: {
                url: '/packages/kgen-api-scaffold/install',
                method: 'POST',
                body: { projectPath: './my-api' }
              },
              response: {
                installId: 'inst_123',
                status: 'completed',
                artifacts: ['src/app.js', 'package.json']
              }
            }
          ]
        }
      ],
      rateLimit: {
        requests: 1000,
        window: '1h',
        headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining']
      },
      sdk: {
        javascript: 'npm install @kgen/sdk',
        typescript: 'npm install @kgen/sdk @types/kgen',
        python: 'pip install kgen-sdk',
        go: 'go get github.com/kgen/sdk-go',
        java: 'implementation "dev.kgen:sdk:2.0.0"'
      }
    };

    return {
      contracts: [mainAPI],
      playground: {
        url: 'https://api-playground.kgen.dev',
        interactive: true,
        examples: ['package-search', 'installation', 'project-generation']
      },
      documentation: {
        openapi: 'https://api.kgen.dev/openapi.json',
        postman: 'https://documenter.getpostman.com/view/kgen-api',
        insomnia: 'https://insomnia.rest/run/?label=KGEN%20API&uri=https%3A%2F%2Fapi.kgen.dev%2Fopenapi.json'
      }
    };
  }

  private async generateCodeExamples(filter?: string): Promise<any> {
    const examples: CodeExample[] = [
      {
        title: 'Basic Package Installation',
        description: 'Install and use a KGEN package in your project',
        language: 'javascript',
        code: `import { KgenClient } from '@kgen/sdk';

const client = new KgenClient({
  apiKey: process.env.KGEN_API_KEY
});

// Install a package
const result = await client.packages.install('kgen-api-scaffold', {
  projectPath: './my-project',
  options: {
    framework: 'express',
    database: 'postgresql'
  }
});

console.log('Installed:', result.artifacts);`,
        marketplaceUrl: 'https://marketplace.kgen.dev/packages/api-scaffold',
        dependencies: ['@kgen/sdk'],
        complexity: 'beginner',
        tags: ['installation', 'api', 'basic']
      },
      {
        title: 'Custom Template Generation',
        description: 'Generate code from custom templates with KGEN',
        language: 'typescript',
        code: `import { TemplateEngine } from '@kgen/core';
import { CustomGenerator } from '@kgen/generators';

interface APIConfig {
  name: string;
  endpoints: string[];
  auth: 'jwt' | 'apikey' | 'oauth';
}

const generator = new CustomGenerator({
  templatePath: './templates',
  outputPath: './generated'
});

const config: APIConfig = {
  name: 'UserAPI',
  endpoints: ['/users', '/auth', '/profile'],
  auth: 'jwt'
};

// Generate API structure
const files = await generator.generate('api-template', config);
console.log('Generated files:', files.map(f => f.path));`,
        marketplaceUrl: 'https://marketplace.kgen.dev/packages/custom-templates',
        dependencies: ['@kgen/core', '@kgen/generators'],
        complexity: 'intermediate',
        tags: ['templates', 'generation', 'typescript']
      },
      {
        title: 'Advanced Pipeline Integration',
        description: 'Integrate KGEN with CI/CD pipelines for automated code generation',
        language: 'yaml',
        code: `# .github/workflows/kgen-generate.yml
name: KGEN Code Generation

on:
  push:
    paths:
      - 'specs/**'
      - 'templates/**'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install KGEN CLI
        run: npm install -g @kgen/cli
        
      - name: Generate Code
        run: |
          kgen generate --config ./kgen.config.js \
            --input ./specs \
            --output ./src/generated \
            --dry-run false
        env:
          KGEN_API_KEY: \${{ secrets.KGEN_API_KEY }}
          
      - name: Commit Generated Code
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .
          git diff --staged --quiet || git commit -m "Auto-generated code update"
          git push`,
        marketplaceUrl: 'https://marketplace.kgen.dev/packages/github-action',
        dependencies: ['@kgen/cli'],
        complexity: 'advanced',
        tags: ['cicd', 'automation', 'github-actions']
      }
    ];

    return {
      byCategory: {
        'Getting Started': examples.filter(e => e.complexity === 'beginner'),
        'API Integration': examples.filter(e => e.tags.includes('api')),
        'Templates': examples.filter(e => e.tags.includes('templates')),
        'CI/CD': examples.filter(e => e.tags.includes('cicd'))
      },
      byLanguage: {
        'JavaScript': examples.filter(e => e.language === 'javascript'),
        'TypeScript': examples.filter(e => e.language === 'typescript'),
        'YAML': examples.filter(e => e.language === 'yaml')
      },
      featured: examples.slice(0, 2),
      interactive: [
        {
          name: 'KGEN Playground',
          url: 'https://playground.kgen.dev',
          environment: 'sandbox' as const
        },
        {
          name: 'API Scaffold Demo',
          url: 'https://codesandbox.io/s/kgen-api-demo',
          environment: 'codesandbox' as const
        }
      ],
      repositories: [
        {
          name: 'kgen-examples',
          url: 'https://github.com/kgen/examples',
          description: 'Official KGEN examples repository',
          stars: 1247,
          language: 'TypeScript'
        },
        {
          name: 'kgen-templates',
          url: 'https://github.com/kgen/templates',
          description: 'Community-contributed templates',
          stars: 892,
          language: 'JavaScript'
        }
      ]
    };
  }

  private async generateQuickstartGuides() {
    const gettingStarted: QuickstartGuide[] = [
      {
        title: 'Your First KGEN Project',
        description: 'Create your first project using KGEN in under 10 minutes',
        estimatedTime: '10 minutes',
        difficulty: 'beginner',
        prerequisites: ['Node.js 18+', 'npm or yarn', 'Basic JavaScript knowledge'],
        steps: [
          {
            title: 'Install KGEN CLI',
            description: 'Install the KGEN command-line interface globally',
            command: 'npm install -g @kgen/cli'
          },
          {
            title: 'Initialize Project',
            description: 'Create a new KGEN project with the initialization wizard',
            command: 'kgen init my-first-project',
            code: '# Follow the interactive prompts to configure your project'
          },
          {
            title: 'Install Your First Package',
            description: 'Add a pre-built package from the marketplace',
            command: 'kgen marketplace install api-scaffold',
            marketplacePackage: {
              name: 'api-scaffold',
              url: 'https://marketplace.kgen.dev/packages/api-scaffold',
              installation: 'kgen marketplace install api-scaffold'
            }
          },
          {
            title: 'Generate Code',
            description: 'Use the installed package to generate your API structure',
            command: 'kgen generate api --name UserAPI --endpoints users,auth,profile'
          },
          {
            title: 'Run Your API',
            description: 'Start the generated API server',
            command: 'cd my-first-project && npm start'
          }
        ],
        nextSteps: [
          'Explore more packages in the marketplace',
          'Create custom templates for your team',
          'Set up CI/CD integration'
        ],
        troubleshooting: [
          {
            issue: 'Permission denied during installation',
            solution: 'Try using sudo or configure npm to use a different directory'
          },
          {
            issue: 'Package not found',
            solution: 'Ensure you have access to the marketplace and check package name'
          }
        ]
      }
    ];

    return {
      gettingStarted,
      tutorials: [
        {
          title: 'Building a REST API with KGEN',
          url: 'https://docs.kgen.dev/tutorials/rest-api',
          duration: '30 minutes',
          difficulty: 'intermediate',
          topics: ['API design', 'Database integration', 'Authentication']
        },
        {
          title: 'Custom Template Creation',
          url: 'https://docs.kgen.dev/tutorials/custom-templates',
          duration: '45 minutes',
          difficulty: 'advanced',
          topics: ['Template syntax', 'Variable binding', 'Conditional generation']
        }
      ],
      workflows: [
        {
          name: 'API Development Workflow',
          description: 'Complete workflow for API development using KGEN packages',
          steps: [
            'Design API specification',
            'Generate API scaffold',
            'Add authentication',
            'Configure database',
            'Generate tests',
            'Deploy to cloud'
          ],
          marketplacePackages: [
            {
              name: 'api-scaffold',
              url: 'https://marketplace.kgen.dev/packages/api-scaffold',
              role: 'Core API structure'
            },
            {
              name: 'auth-templates',
              url: 'https://marketplace.kgen.dev/packages/auth-templates',
              role: 'Authentication layer'
            }
          ]
        }
      ],
      bestPractices: [
        {
          category: 'Project Structure',
          practices: [
            {
              title: 'Use consistent naming conventions',
              description: 'Follow established patterns for file and directory naming',
              example: 'kgen generate component --name UserProfile --type react'
            },
            {
              title: 'Organize templates by domain',
              description: 'Group related templates together for better maintainability'
            }
          ]
        },
        {
          category: 'Performance',
          practices: [
            {
              title: 'Cache frequently used packages',
              description: 'Enable package caching to speed up generation times',
              example: 'kgen config set cache.enabled true'
            }
          ]
        }
      ]
    };
  }

  private async generateDeveloperTools() {
    return {
      cli: [
        {
          name: 'KGEN CLI',
          description: 'Primary command-line interface for KGEN operations',
          installation: 'npm install -g @kgen/cli',
          commands: [
            {
              command: 'kgen init [project]',
              description: 'Initialize a new KGEN project',
              example: 'kgen init my-api --template express'
            },
            {
              command: 'kgen generate <template> [options]',
              description: 'Generate code from templates',
              example: 'kgen generate api --name UserAPI --auth jwt'
            },
            {
              command: 'kgen marketplace <action>',
              description: 'Interact with the KGEN marketplace',
              example: 'kgen marketplace search --category api'
            }
          ]
        }
      ],
      ide: [
        {
          name: 'KGEN VS Code Extension',
          marketplace: 'Visual Studio Code Marketplace',
          features: ['Syntax highlighting for templates', 'IntelliSense', 'Debugging', 'Project scaffolding'],
          installUrl: 'https://marketplace.visualstudio.com/items?itemName=kgen.vscode-extension'
        },
        {
          name: 'KGEN JetBrains Plugin',
          marketplace: 'JetBrains Plugin Repository',
          features: ['Template editing', 'Code generation', 'Project management'],
          installUrl: 'https://plugins.jetbrains.com/plugin/kgen'
        }
      ],
      testing: [
        {
          framework: 'Jest',
          language: 'JavaScript/TypeScript',
          setup: 'npm install --save-dev @kgen/jest-preset',
          exampleUrl: 'https://github.com/kgen/examples/tree/main/testing/jest'
        },
        {
          framework: 'Mocha',
          language: 'JavaScript',
          setup: 'npm install --save-dev @kgen/mocha-helpers',
          exampleUrl: 'https://github.com/kgen/examples/tree/main/testing/mocha'
        }
      ],
      cicd: [
        {
          platform: 'GitHub Actions',
          configUrl: 'https://github.com/kgen/examples/blob/main/.github/workflows/kgen.yml',
          marketplaceAction: 'https://github.com/marketplace/actions/kgen-generate'
        },
        {
          platform: 'GitLab CI',
          configUrl: 'https://gitlab.com/kgen/examples/-/blob/main/.gitlab-ci.yml'
        }
      ]
    };
  }

  private async getMarketplaceIntegrations() {
    return {
      developerTools: [
        {
          name: 'KGEN Debug Assistant',
          url: 'https://marketplace.kgen.dev/packages/debug-assistant',
          category: 'Development',
          description: 'Advanced debugging tools for KGEN-generated code',
          installation: {
            manager: 'npm' as const,
            command: 'npm install @kgen/debug-assistant',
            global: false
          },
          quickstart: 'import { debugAssistant } from "@kgen/debug-assistant"; debugAssistant.start();'
        },
        {
          name: 'KGEN Performance Profiler',
          url: 'https://marketplace.kgen.dev/packages/performance-profiler',
          category: 'Performance',
          description: 'Profile and optimize KGEN template performance',
          installation: {
            manager: 'npm' as const,
            command: 'npm install --save-dev @kgen/profiler',
            global: false
          },
          quickstart: 'kgen profile --template my-template --iterations 100'
        }
      ],
      templates: [
        {
          name: 'React Component Library',
          url: 'https://marketplace.kgen.dev/templates/react-components',
          framework: 'React',
          features: ['TypeScript support', 'Storybook integration', 'Testing setup', 'Build optimization'],
          complexity: 'intermediate'
        },
        {
          name: 'Node.js Microservice',
          url: 'https://marketplace.kgen.dev/templates/nodejs-microservice',
          framework: 'Node.js',
          features: ['Express.js', 'Docker', 'Health checks', 'Monitoring', 'Authentication'],
          complexity: 'advanced'
        }
      ],
      extensions: [
        {
          name: 'KGEN Template Validator',
          url: 'https://marketplace.kgen.dev/extensions/template-validator',
          platform: 'VS Code',
          rating: 4.8,
          downloads: 15420
        },
        {
          name: 'KGEN Project Manager',
          url: 'https://marketplace.kgen.dev/extensions/project-manager',
          platform: 'VS Code',
          rating: 4.6,
          downloads: 8930
        }
      ]
    };
  }
}

export default new DeveloperViewGenerator();
export { DeveloperViewGenerator, type DeveloperViewData, type GenerateOptions, type GenerateResult };
