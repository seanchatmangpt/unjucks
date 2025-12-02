/**
 * Quickstart Generator Utility
 * 
 * Generates step-by-step quickstart guides for different use cases.
 */

export class QuickstartGenerator {
  constructor() {
    this.guideTemplates = new Map();
    this.loadGuideTemplates();
  }

  async generateGuides(filter = null) {
    const guides = await this.createGuides();
    
    let filtered = guides;
    if (filter) {
      filtered = guides.filter(guide => 
        guide.category.includes(filter) ||
        guide.title.toLowerCase().includes(filter.toLowerCase()) ||
        guide.tags.some(tag => tag.includes(filter))
      );
    }
    
    return {
      totalGuides: filtered.length,
      gettingStarted: filtered.filter(g => g.type === 'getting-started'),
      tutorials: filtered.filter(g => g.type === 'tutorial'),
      workflows: filtered.filter(g => g.type === 'workflow'),
      bestPractices: this.generateBestPractices(),
      troubleshooting: this.generateTroubleshooting()
    };
  }

  async createGuides() {
    return [
      ...this.createGettingStartedGuides(),
      ...this.createTutorialGuides(),
      ...this.createWorkflowGuides()
    ];
  }

  createGettingStartedGuides() {
    return [
      {
        id: 'kgen-setup',
        title: 'Getting Started with KGEN',
        type: 'getting-started',
        category: 'installation',
        difficulty: 'beginner',
        estimatedTime: 15,
        description: 'Set up KGEN CLI and create your first knowledge pack',
        tags: ['installation', 'setup', 'beginner'],
        prerequisites: [
          {
            type: 'software',
            name: 'Node.js',
            version: '18.x or higher',
            description: 'JavaScript runtime for KGEN CLI'
          },
          {
            type: 'knowledge',
            name: 'Command Line Basics',
            description: 'Familiarity with terminal/command prompt'
          }
        ],
        steps: [
          {
            number: 1,
            title: 'Install KGEN CLI',
            description: 'Install the KGEN command line interface globally',
            instructions: 'Run the following command to install KGEN CLI globally on your system:',
            code: 'npm install -g @kgen/cli',
            notes: [
              'Use sudo on macOS/Linux if you encounter permission errors',
              'For Windows, run as Administrator if needed'
            ],
            validation: {
              command: 'kgen --version',
              expectedOutput: 'Should display version number'
            }
          },
          {
            number: 2,
            title: 'Initialize a New Project',
            description: 'Create a new KGEN project in your workspace',
            instructions: 'Navigate to your desired directory and initialize a new KGEN project:',
            code: `mkdir my-knowledge-project
cd my-knowledge-project
kgen init`,
            notes: [
              'This creates a kgen.config.js file and basic project structure',
              'The init command is interactive - follow the prompts'
            ],
            validation: {
              command: 'ls -la',
              expectedOutput: 'Should see kgen.config.js and templates/ directory'
            }
          },
          {
            number: 3,
            title: 'Create Your First Template',
            description: 'Generate a simple API service template',
            instructions: 'Use the built-in generator to create your first template:',
            code: 'kgen generate template api-service --interactive',
            notes: [
              'Follow the interactive prompts to customize your template',
              'Templates are stored in the templates/ directory'
            ],
            validation: {
              command: 'kgen templates ls',
              expectedOutput: 'Should list your new api-service template'
            }
          },
          {
            number: 4,
            title: 'Generate Code from Template',
            description: 'Use your template to generate actual code',
            instructions: 'Generate a new API service using your template:',
            code: `kgen artifact generate \\
  --template api-service \\
  --name UserService \\
  --output ./generated/`,
            notes: [
              'The --name parameter customizes the template variables',
              'Generated files will be in the ./generated/ directory'
            ],
            validation: {
              command: 'ls -la generated/',
              expectedOutput: 'Should see generated UserService files'
            }
          },
          {
            number: 5,
            title: 'Explore the Generated Code',
            description: 'Review and understand the generated code structure',
            instructions: 'Examine the generated files and their structure:',
            code: `find generated/ -type f -name "*.js" -o -name "*.json" | head -10
cat generated/UserService.js`,
            notes: [
              'Notice how template variables were replaced with your values',
              'The generated code follows the patterns defined in your template'
            ]
          }
        ],
        nextSteps: [
          'Learn about template customization',
          'Explore advanced generation options',
          'Set up CI/CD integration'
        ],
        troubleshooting: [
          {
            problem: 'Command not found: kgen',
            solution: 'Make sure npm global bin directory is in your PATH'
          },
          {
            problem: 'Permission errors during installation',
            solution: 'Use sudo (macOS/Linux) or run as Administrator (Windows)'
          }
        ]
      },
      {
        id: 'api-integration',
        title: 'API Integration Quickstart',
        type: 'getting-started',
        category: 'api',
        difficulty: 'beginner',
        estimatedTime: 20,
        description: 'Connect to KGEN APIs and fetch marketplace data',
        tags: ['api', 'integration', 'marketplace'],
        prerequisites: [
          {
            type: 'software',
            name: 'HTTP Client',
            description: 'curl, Postman, or programming language HTTP library'
          },
          {
            type: 'account',
            name: 'KGEN Account',
            description: 'Free account at kgen.io for API access'
          }
        ],
        steps: [
          {
            number: 1,
            title: 'Get API Credentials',
            description: 'Obtain your API key from the KGEN dashboard',
            instructions: 'Log in to your KGEN account and navigate to API settings:',
            code: '# Visit: https://dashboard.kgen.io/api-keys\n# Click "Generate New API Key"\n# Copy and save your API key securely',
            notes: [
              'Keep your API key secure and never commit it to version control',
              'Use environment variables or secure configuration files'
            ]
          },
          {
            number: 2,
            title: 'Test API Connection',
            description: 'Verify your API credentials work correctly',
            instructions: 'Test the connection using curl:',
            code: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.kgen.io/v1/user`,
            notes: [
              'Replace YOUR_API_KEY with your actual API key',
              'You should receive your user profile information'
            ],
            validation: {
              expectedOutput: 'JSON response with user details'
            }
          },
          {
            number: 3,
            title: 'Fetch Knowledge Packs',
            description: 'List available knowledge packs from the marketplace',
            instructions: 'Get a list of available knowledge packs:',
            code: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://api.kgen.io/v1/marketplace/packs?limit=10"`,
            notes: [
              'Use query parameters to filter results',
              'Add &category=api-services to filter by category'
            ]
          },
          {
            number: 4,
            title: 'Download a Knowledge Pack',
            description: 'Download and install a knowledge pack',
            instructions: 'Download a specific knowledge pack:',
            code: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  -o pack.zip \\
  https://api.kgen.io/v1/marketplace/packs/api-service-starter/download`,
            notes: [
              'Packs are downloaded as ZIP files',
              'Extract the contents to your templates directory'
            ]
          },
          {
            number: 5,
            title: 'Use the Downloaded Pack',
            description: 'Generate code using the downloaded knowledge pack',
            instructions: 'Extract and use the downloaded pack:',
            code: `unzip pack.zip -d templates/
kgen artifact generate --template api-service-starter --name MyAPI`
          }
        ]
      }
    ];
  }

  createTutorialGuides() {
    return [
      {
        id: 'custom-template-tutorial',
        title: 'Building Custom Templates',
        type: 'tutorial',
        category: 'templates',
        difficulty: 'intermediate',
        estimatedTime: 45,
        description: 'Learn to create sophisticated custom templates with variables and logic',
        tags: ['templates', 'customization', 'nunjucks'],
        prerequisites: [
          {
            type: 'knowledge',
            name: 'KGEN Basics',
            description: 'Completed the Getting Started guide'
          },
          {
            type: 'knowledge',
            name: 'Template Syntax',
            description: 'Basic understanding of template engines'
          }
        ],
        steps: [
          {
            number: 1,
            title: 'Template Structure Overview',
            description: 'Understand how KGEN templates are organized',
            instructions: 'Examine a typical template structure:',
            code: `templates/
  my-template/
    template.config.js      # Template configuration
    files/                  # Template files
      src/
        {{ name }}.service.js
        {{ name }}.test.js
    prompts.js             # Interactive prompts
    hooks/                 # Pre/post generation hooks
      pre-generate.js
      post-generate.js`,
            notes: [
              'Template files use Nunjucks syntax for variables',
              'Directory names can also use template variables'
            ]
          },
          {
            number: 2,
            title: 'Configure Template Metadata',
            description: 'Set up template configuration and metadata',
            instructions: 'Create a template.config.js file:',
            code: `module.exports = {
  name: 'microservice-generator',
  description: 'Generates a complete microservice with API, tests, and documentation',
  version: '1.0.0',
  author: 'Your Name',
  tags: ['microservice', 'api', 'node.js'],
  variables: {
    name: {
      type: 'string',
      description: 'Service name',
      required: true
    },
    port: {
      type: 'number',
      description: 'Service port',
      default: 3000
    },
    database: {
      type: 'select',
      description: 'Database type',
      choices: ['mongodb', 'postgresql', 'mysql'],
      default: 'mongodb'
    },
    includeAuth: {
      type: 'boolean',
      description: 'Include authentication middleware',
      default: true
    }
  }
};`,
            notes: [
              'Variables define the template\'s customizable parameters',
              'Support various types: string, number, boolean, select, array'
            ]
          },
          {
            number: 3,
            title: 'Create Template Files',
            description: 'Build the actual template files with variables',
            instructions: 'Create a service template file:',
            code: `// files/src/{{ name | kebabCase }}.service.js
const express = require('express');
{% if includeAuth %}
const auth = require('../middleware/auth');
{% endif %}
{% if database === 'mongodb' %}
const mongoose = require('mongoose');
{% elif database === 'postgresql' %}
const { Pool } = require('pg');
{% endif %}

class {{ name | pascalCase }}Service {
  constructor() {
    this.app = express();
    this.port = {{ port }};
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    {% if includeAuth %}
    this.app.use('/api', auth.middleware);
    {% endif %}
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: '{{ name }}' });
    });

    this.app.get('/api/{{ name | kebabCase }}', (req, res) => {
      // TODO: Implement {{ name }} logic
      res.json({ message: 'Hello from {{ name }}!' });
    });
  }

  async start() {
    {% if database === 'mongodb' %}
    await mongoose.connect(process.env.MONGODB_URL);
    {% elif database === 'postgresql' %}
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    {% endif %}

    this.app.listen(this.port, () => {
      console.log('{{ name }} service running on port {{ port }}');
    });
  }
}

module.exports = {{ name | pascalCase }}Service;`,
            notes: [
              'Use filters like kebabCase, pascalCase for naming conventions',
              'Conditional blocks with {% if %} for optional features',
              'Loop through arrays with {% for %} when needed'
            ]
          },
          {
            number: 4,
            title: 'Add Interactive Prompts',
            description: 'Create dynamic prompts for better user experience',
            instructions: 'Create a prompts.js file for advanced interactions:',
            code: `module.exports = async (inquirer) => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What is your service name?',
      validate: (input) => {
        if (!input.trim()) return 'Service name is required';
        if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(input)) {
          return 'Service name must start with a letter and contain only letters, numbers, and hyphens';
        }
        return true;
      }
    },
    {
      type: 'number',
      name: 'port',
      message: 'Port number:',
      default: 3000,
      validate: (port) => port > 0 && port < 65536
    },
    {
      type: 'list',
      name: 'database',
      message: 'Choose database:',
      choices: [
        { name: 'MongoDB', value: 'mongodb' },
        { name: 'PostgreSQL', value: 'postgresql' },
        { name: 'MySQL', value: 'mysql' }
      ]
    },
    {
      type: 'confirm',
      name: 'includeAuth',
      message: 'Include authentication?',
      default: true
    }
  ]);

  // Dynamic follow-up questions
  if (answers.includeAuth) {
    const authAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'authType',
        message: 'Authentication type:',
        choices: ['JWT', 'OAuth2', 'Session']
      }
    ]);
    answers.authType = authAnswers.authType;
  }

  return answers;
};`
          },
          {
            number: 5,
            title: 'Add Generation Hooks',
            description: 'Create pre and post-generation hooks for advanced logic',
            instructions: 'Create hooks/post-generate.js:',
            code: `const fs = require('fs-extra');
const path = require('path');

module.exports = async (context) => {
  const { outputPath, variables } = context;

  // Install dependencies based on choices
  const dependencies = ['express'];
  if (variables.database === 'mongodb') {
    dependencies.push('mongoose');
  } else if (variables.database === 'postgresql') {
    dependencies.push('pg');
  }

  if (variables.includeAuth) {
    dependencies.push('jsonwebtoken', 'bcrypt');
  }

  // Create package.json
  const packageJson = {
    name: variables.name,
    version: '1.0.0',
    main: 'src/index.js',
    scripts: {
      start: 'node src/index.js',
      dev: 'nodemon src/index.js',
      test: 'jest'
    },
    dependencies: dependencies.reduce((deps, dep) => {
      deps[dep] = 'latest';
      return deps;
    }, {}),
    devDependencies: {
      nodemon: 'latest',
      jest: 'latest'
    }
  };

  await fs.writeJson(
    path.join(outputPath, 'package.json'), 
    packageJson, 
    { spaces: 2 }
  );

  console.log('✅ Generated package.json');
  console.log('📦 Run "npm install" to install dependencies');
  console.log('🚀 Run "npm run dev" to start development server');
};`
          }
        ]
      }
    ];
  }

  createWorkflowGuides() {
    return [
      {
        id: 'cicd-integration',
        title: 'CI/CD Integration Workflow',
        type: 'workflow',
        category: 'devops',
        difficulty: 'advanced',
        estimatedTime: 60,
        description: 'Integrate KGEN into your CI/CD pipeline for automated code generation',
        tags: ['cicd', 'automation', 'github-actions'],
        prerequisites: [
          {
            type: 'platform',
            name: 'GitHub Repository',
            description: 'Repository with GitHub Actions enabled'
          },
          {
            type: 'knowledge',
            name: 'YAML Syntax',
            description: 'Basic understanding of YAML and GitHub Actions'
          }
        ],
        steps: [
          {
            number: 1,
            title: 'Create GitHub Action Workflow',
            description: 'Set up automated code generation on pull requests',
            instructions: 'Create .github/workflows/kgen.yml:',
            code: `name: KGEN Code Generation

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'templates/**'
      - 'kgen.config.js'

jobs:
  generate-and-validate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install KGEN CLI
        run: npm install -g @kgen/cli
        
      - name: Install Dependencies
        run: npm install
        
      - name: Validate Templates
        run: kgen templates validate --all
        
      - name: Generate Test Artifacts
        run: |
          mkdir -p generated-test
          kgen artifact generate \\
            --template api-service \\
            --name TestService \\
            --output generated-test/ \\
            --dry-run
            
      - name: Run Generated Code Tests
        run: |
          cd generated-test
          npm install
          npm test
          
      - name: Comment PR with Results
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const testResults = fs.readFileSync('generated-test/test-results.json', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: \`## KGEN Generation Results\\n\\n\${testResults}\`
            });`
          }
        ]
      }
    ];
  }

  generateBestPractices() {
    return {
      templateDesign: [
        {
          title: 'Use Semantic Variable Names',
          description: 'Choose variable names that clearly indicate their purpose',
          example: 'Use "serviceName" instead of "name" for better clarity'
        },
        {
          title: 'Provide Sensible Defaults',
          description: 'Set reasonable default values for optional parameters',
          example: 'Default port to 3000, timeout to 30000ms'
        },
        {
          title: 'Validate Input Early',
          description: 'Add validation to template variables and prompts',
          example: 'Check for valid identifiers, port ranges, file paths'
        }
      ],
      codeGeneration: [
        {
          title: 'Follow Naming Conventions',
          description: 'Use consistent naming patterns across generated code',
          example: 'PascalCase for classes, camelCase for functions'
        },
        {
          title: 'Include Documentation',
          description: 'Generate comments and documentation with your code',
          example: 'Add JSDoc comments to generated functions'
        }
      ],
      maintenance: [
        {
          title: 'Version Your Templates',
          description: 'Use semantic versioning for template releases',
          example: 'Increment major version for breaking changes'
        },
        {
          title: 'Test Template Changes',
          description: 'Validate templates before publishing updates',
          example: 'Run generation tests in CI/CD pipeline'
        }
      ]
    };
  }

  generateTroubleshooting() {
    return {
      common_issues: [
        {
          problem: 'Template not found error',
          symptoms: ['Error: Template "my-template" not found'],
          causes: [
            'Template name mismatch',
            'Template not in templates directory',
            'Incorrect template structure'
          ],
          solutions: [
            'Verify template name with `kgen templates ls`',
            'Check template directory structure',
            'Ensure template.config.js exists'
          ]
        },
        {
          problem: 'Variable substitution not working',
          symptoms: ['{{ variable }} appears in generated code'],
          causes: [
            'Variable not defined in config',
            'Syntax error in template',
            'Variable not passed during generation'
          ],
          solutions: [
            'Check variable definition in template.config.js',
            'Verify Nunjucks syntax',
            'Use --debug flag to see variable values'
          ]
        }
      ],
      debugging: [
        {
          technique: 'Use Debug Mode',
          description: 'Enable verbose logging to see what KGEN is doing',
          command: 'kgen artifact generate --template my-template --debug'
        },
        {
          technique: 'Dry Run Generation',
          description: 'Preview what will be generated without writing files',
          command: 'kgen artifact generate --template my-template --dry-run'
        },
        {
          technique: 'Validate Templates',
          description: 'Check template syntax and structure',
          command: 'kgen templates validate --name my-template'
        }
      ]
    };
  }

  loadGuideTemplates() {
    // Load different guide templates for reuse
    this.guideTemplates.set('quickstart', {
      sections: ['prerequisites', 'steps', 'nextSteps', 'troubleshooting'],
      stepFormat: ['title', 'description', 'instructions', 'code', 'notes', 'validation']
    });
    
    this.guideTemplates.set('tutorial', {
      sections: ['prerequisites', 'overview', 'steps', 'summary', 'further-reading'],
      stepFormat: ['title', 'description', 'instructions', 'code', 'explanation', 'exercise']
    });
    
    this.guideTemplates.set('workflow', {
      sections: ['prerequisites', 'overview', 'steps', 'optimization', 'maintenance'],
      stepFormat: ['title', 'description', 'instructions', 'code', 'configuration']
    });
  }
}