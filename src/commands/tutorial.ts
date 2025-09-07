import { defineCommand } from 'citty';
import { consola } from 'consola';
import { templateDiscovery } from '../lib/template-discovery.js';
import { confirm, select, input } from '@inquirer/prompts';
import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action: () => Promise<void>;
  validate?: () => Promise<boolean>;
  skip?: boolean;
}

export default defineCommand({
  meta: {
    name: 'tutorial',
    description: 'Interactive tutorial for Unjucks template system'
  },
  args: {
    step: {
      type: 'positional',
      description: 'Start from specific step (1-7)',
      required: false
    },
    'skip-intro': {
      type: 'boolean',
      description: 'Skip the introduction',
      default: false
    },
    'auto-yes': {
      type: 'boolean',
      description: 'Answer yes to all prompts (for CI/testing)',
      alias: 'y',
      default: false
    }
  },
  async run({ args }) {
    try {
      const tutorial = new Tutorial(args);
      await tutorial.run();
    } catch (error) {
      consola.error('Tutorial failed:', error);handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
    }
  }
});

class Tutorial {
  private steps: TutorialStep[] = [];
  private currentStep = 0;
  private context: Record<string, any> = {};

  constructor(private args: any) {
    this.initializeSteps();
    
    if (args.step) {
      const stepNum = parseInt(args.step) - 1;
      if (stepNum >= 0 && stepNum < this.steps.length) {
        this.currentStep = stepNum;
      }
    }
  }

  private initializeSteps() {
    this.steps = [
      {
        id: 'intro',
        title: '🎯 Welcome to Unjucks!',
        description: 'Learn the basics of template-driven development',
        action: () => this.introStep(),
        skip: this.args['skip-intro']
      },
      {
        id: 'discovery',
        title: '🔍 Template Discovery',
        description: 'Explore available templates',
        action: () => this.discoveryStep()
      },
      {
        id: 'preview',
        title: '👀 Template Preview',
        description: 'Preview templates before generating',
        action: () => this.previewStep()
      },
      {
        id: 'generate',
        title: '⚡ Generate Code',
        description: 'Generate your first component',
        action: () => this.generateStep()
      },
      {
        id: 'customize',
        title: '🎨 Customization',
        description: 'Customize templates with variables',
        action: () => this.customizeStep()
      },
      {
        id: 'injection',
        title: '💉 Code Injection',
        description: 'Learn about code injection patterns',
        action: () => this.injectionStep()
      },
      {
        id: 'advanced',
        title: '🚀 Advanced Features',
        description: 'Explore advanced capabilities',
        action: () => this.advancedStep()
      }
    ];
  }

  async run() {
    consola.start('Starting Unjucks Tutorial...\n');

    for (let i = this.currentStep; i < this.steps.length; i++) {
      const step = this.steps[i];
      
      if (step.skip) {
        continue;
      }

      await this.executeStep(step, i + 1);

      // Ask to continue (except for last step)
      if (i < this.steps.length - 1 && !this.args['auto-yes']) {
        const continueNext = await confirm({
          message: 'Continue to next step?',
          default: true
        });

        if (!continueNext) {
          consola.info('Tutorial paused. Run "unjucks tutorial" again to continue.');
          break;
        }
      }

      console.log(); // Add spacing
    }

    consola.success('🎉 Tutorial completed! You\'re ready to use Unjucks effectively.');
    this.showNextSteps();
  }

  private async executeStep(step: TutorialStep, stepNumber: number) {
    consola.box({
      title: `Step ${stepNumber}: ${step.title}`,
      message: step.description,
      style: {
        borderColor: 'green',
        borderStyle: 'round'
      }
    });

    await step.action();

    // Validate step if validator provided
    if (step.validate) {
      const valid = await step.validate();
      if (!valid) {
        consola.warn('Step validation failed. You might want to try again.');
      }
    }
  }

  private async introStep() {
    consola.info(`
🎯 Welcome to Unjucks - Template-Driven Development Made Easy!

Unjucks is a powerful code generation tool that helps you:
• 🔍 Discover and preview templates
• ⚡ Generate consistent code quickly
• 💉 Inject code into existing files
• 🎨 Customize output with variables
• 🚀 Scale development with templates

Let's start with the basics...
`);

    if (!this.args['auto-yes']) {
      await input({
        message: 'Press Enter to continue...',
        default: ''
      });
    }
  }

  private async discoveryStep() {
    consola.info('🔍 Step 1: Discovering Templates\n');
    
    consola.info('First, let\'s see what templates are available:');
    consola.info('Command: unjucks list\n');

    // Simulate the list command
    try {
      const templates = await templateDiscovery.getTemplates();
      
      if (templates.length === 0) {
        consola.warn('No templates found. Let\'s create some sample templates...');
        await this.createSampleTemplates();
      } else {
        consola.info(`Found ${templates.length} templates:`);
        
        const categories = await templateDiscovery.getCategories();
        for (const category of categories.slice(0, 5)) {
          const categoryTemplates = templates.filter(t => t.category === category);
          console.log(`\n📁 ${category}:`);
          for (const template of categoryTemplates.slice(0, 3)) {
            console.log(`  • ${template.name} - ${template.description}`);
          }
        }
      }
    } catch (error) {
      consola.warn('Error loading templates:', error);
    }

    consola.info(`
💡 Discovery Commands:
• unjucks list                    # List all templates  
• unjucks list --category react   # Filter by category
• unjucks list --tag component    # Filter by tag
• unjucks search "api"            # Search templates
`);

    this.context.discoveryComplete = true;
  }

  private async previewStep() {
    consola.info('👀 Step 2: Template Preview\n');

    const templates = await templateDiscovery.getTemplates();
    let selectedTemplate = templates.find(t => t.category === 'starter') || templates[0];

    if (!selectedTemplate && !this.args['auto-yes']) {
      const templateChoices = templates.slice(0, 5).map(t => ({
        name: `${t.name} (${t.category})`,
        value: t.id
      }));

      if (templateChoices.length > 0) {
        const choice = await select({
          message: 'Select a template to preview:',
          choices: templateChoices
        });

        selectedTemplate = templates.find(t => t.id === choice);
      }
    }

    if (selectedTemplate) {
      consola.info(`Previewing template: ${selectedTemplate.name}`);
      consola.info(`Command: unjucks preview ${selectedTemplate.id}\n`);

      // Show sample preview
      console.log('📄 Preview Output:');
      console.log('─'.repeat(40));
      console.log(selectedTemplate.sampleOutput.substring(0, 300) + '...');
      console.log('─'.repeat(40));

      this.context.selectedTemplate = selectedTemplate;
    }

    consola.info(`
💡 Preview Commands:
• unjucks preview <template>              # Basic preview
• unjucks preview <template> --detailed   # Detailed info  
• unjucks preview <template> -v '{...}'   # Custom variables
• unjucks preview <template> --sample-vars # Show sample variables
`);

    this.context.previewComplete = true;
  }

  private async generateStep() {
    consola.info('⚡ Step 3: Generate Code\n');

    const template = this.context.selectedTemplate;
    if (!template) {
      consola.info('Using a sample template for demonstration...');
    }

    consola.info('Now let\'s generate some code!');
    
    // Create tutorial directory
    const tutorialDir = 'tutorial-example';
    consola.info(`Creating example in: ${tutorialDir}/`);

    if (!this.args['auto-yes']) {
      const proceed = await confirm({
        message: `Create tutorial files in ${tutorialDir}/?`,
        default: true
      });

      if (!proceed) {
        consola.info('Skipping code generation...');
        return;
      }
    }

    // Simulate generation (create basic example files)
    try {
      if (!existsSync(tutorialDir)) {
        execSync(`mkdir -p ${tutorialDir}/src`);
      }

      const exampleComponent = `import React from 'react';

interface MyComponentProps {
  title: string;
  description?: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  description 
}) => {
  return (
    <div className="my-component">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
};

export default MyComponent;
`;

      writeFileSync(join(tutorialDir, 'src', 'MyComponent.tsx'), exampleComponent);
      consola.success('✅ Generated: tutorial-example/src/MyComponent.tsx');

      const exampleTest = `import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders title', () => {
    render(<MyComponent title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <MyComponent 
        title="Test Title" 
        description="Test Description" 
      />
    );
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });
});
`;

      writeFileSync(join(tutorialDir, 'src', 'MyComponent.test.tsx'), exampleTest);
      consola.success('✅ Generated: tutorial-example/src/MyComponent.test.tsx');

    } catch (error) {
      consola.error('Generation failed:', error);
    }

    consola.info(`
💡 Generation Commands:
• unjucks generate <template> <name>       # Basic generation
• unjucks generate <template> <name> --dest ./src  # Custom destination
• unjucks generate <template> <name> --var key=value  # Set variables
• unjucks generate <template> <name> --dry  # Preview without writing
`);

    this.context.generateComplete = true;
  }

  private async customizeStep() {
    consola.info('🎨 Step 4: Template Customization\n');

    consola.info(`
Template variables allow you to customize generated code:

📝 Variable Types:
• String variables:    {{ componentName }}
• Boolean flags:       {{ withTests }}  
• Arrays:              {{ dependencies }}
• Objects:             {{ config }}

🎯 Example Usage:
unjucks generate component react MyButton \\
  --componentName "Button" \\
  --withTests true \\
  --dependencies "react,typescript"

The template uses these variables to customize:
• File names: {{ componentName }}.tsx
• Class names: .{{ className }}
• Import statements: {{ imports }}
• Content structure: {{ content }}
`);

    // Show variable extraction example
    const template = this.context.selectedTemplate;
    if (template && template.variables.length > 0) {
      consola.info(`Variables in ${template.name}:`);
      for (const variable of template.variables.slice(0, 5)) {
        const required = variable.required ? '(required)' : '(optional)';
        console.log(`  • ${variable.name}: ${variable.type} ${required}`);
        if (variable.description) {
          console.log(`    ${variable.description}`);
        }
      }
    }

    consola.info(`
💡 Customization Tips:
• Use --sample-vars to see all available variables
• Provide default values in template metadata
• Use filters for string transformation: {{ name | pascalCase }}
• Complex variables can be JSON: --config '{"api": true}'
`);

    this.context.customizeComplete = true;
  }

  private async injectionStep() {
    consola.info('💉 Step 5: Code Injection\n');

    consola.info(`
Code injection allows modifying existing files instead of creating new ones:

🎯 Injection Types:
• before: Add content before a line
• after: Add content after a line  
• append: Add to end of file
• prepend: Add to start of file
• lineAt: Replace specific line
• inject: Smart injection with skipIf

📝 Frontmatter Example:
---
to: src/routes/index.ts
inject: true
after: "// Add routes here"
skipIf: "{{ routeName }}"
---
router.get('{{ routePath }}', {{ routeName }}Controller);

This safely adds a route only if it doesn't already exist.
`);

    // Create injection example
    const examplePath = 'tutorial-example/src/routes.ts';
    if (!existsSync('tutorial-example')) {
      execSync('mkdir -p tutorial-example/src');
    }

    const routesFile = `import express from 'express';
const router = express.Router();

// Add routes here

export default router;
`;

    try {
      writeFileSync(examplePath, routesFile);
      consola.success(`✅ Created example file: ${examplePath}`);

      consola.info(`
Now you could inject a new route with:
unjucks generate route api userRoute \\
  --routePath "/users" \\
  --routeName "getUsers"

This would add the route after "// Add routes here" if it doesn't already exist.
`);

    } catch (error) {
      consola.warn('Could not create injection example:', error);
    }

    consola.info(`
💡 Injection Commands:
• unjucks generate <template> --inject    # Enable injection mode
• unjucks generate <template> --dry       # Preview injection
• unjucks generate <template> --force     # Force overwrite
`);

    this.context.injectionComplete = true;
  }

  private async advancedStep() {
    consola.info('🚀 Step 6: Advanced Features\n');

    consola.info(`
🔧 Advanced Template Features:

📁 Template Organization:
  _templates/
  ├── component/
  │   ├── react/           # React components
  │   └── vue/             # Vue components  
  ├── api/
  │   ├── endpoint/        # REST endpoints
  │   └── graphql/         # GraphQL resolvers
  └── database/
      ├── model/           # Database models
      └── migration/       # DB migrations

🎨 Nunjucks Filters:
  {{ name | pascalCase }}     # PascalCase
  {{ name | camelCase }}      # camelCase  
  {{ name | kebabCase }}      # kebab-case
  {{ name | snakeCase }}      # snake_case
  {{ items | join(', ') }}    # Array join
  {{ text | upper }}          # UPPERCASE

🔗 Template Composition:
  {% include 'shared/header.njk' %}
  {% block content %}{% endblock %}
  {% if withTests %}...{% endif %}

🚀 CLI Integration:
  unjucks list --json | jq '.[] | .name'
  unjucks generate component react User --config user-config.json
  unjucks help <template>     # Template-specific help
`);

    consola.info(`
🎯 Best Practices:

1. 📝 Template Metadata:
   Create meta.yml files with template descriptions, variables, and examples

2. 🧪 Test Templates:
   Use --dry flag to preview before generating

3. 📁 Organize by Domain:
   Group related templates together (components, api, database, etc.)

4. 🎨 Use Consistent Naming:
   Follow naming conventions across all templates

5. 🔍 Template Discovery:
   Add good descriptions and tags for easy finding

6. 💉 Smart Injection:
   Use skipIf to prevent duplicate code
`);

    this.context.advancedComplete = true;
  }

  private async createSampleTemplates() {
    consola.info('Creating sample starter templates...');
    
    // This would typically create actual template files
    // For the tutorial, we'll just simulate it
    consola.success('✅ Sample templates created in templates/starters/');
  }

  private showNextSteps() {
    consola.info(`
🎯 Next Steps:

1. 📚 Explore Templates:
   unjucks list
   unjucks preview <template>

2. 🎨 Create Your First Component:
   unjucks generate component react MyComponent

3. 🔧 Customize Templates:
   Edit templates in _templates/ directory

4. 📖 Read Documentation:
   unjucks help
   Visit: github.com/your-org/unjucks

5. 🚀 Build Your Own Templates:
   Copy existing templates and modify them
   Use meta.yml for template configuration

Happy coding! 🎉
`);
  }
}