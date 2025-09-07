# Interactive Modes and Dynamic Command Generation

The Unjucks CLI features sophisticated interactive modes that provide intelligent prompting, dynamic command generation, and adaptive user experiences.

## Overview

The interactive system automatically activates when:
- Required parameters are missing
- User explicitly requests interactive mode with `--interactive`
- Complex configuration is needed
- Template variables require user input

## Interactive Command Patterns

### 1. Generator Selection Mode

When no generator is specified, the CLI enters interactive generator selection:

```bash
$ unjucks generate

? Select a generator: (Use arrow keys)
❯ component - React/Vue component generator
  api - REST API endpoint generator  
  model - Database model generator
  test - Test file generator
  workflow - Development workflow templates
```

**Features:**
- Fuzzy search through available generators
- Category grouping and filtering
- Description and usage statistics
- Recently used generators prioritized

### 2. Template Selection Mode

After generator selection, template picker is shown:

```bash
$ unjucks generate component

? Select a template: (Use arrow keys)
❯ react - React functional component with hooks
  react-class - React class component (legacy)
  vue - Vue 3 composition API component
  angular - Angular component with CLI integration
  storybook - Component with Storybook stories
```

**Features:**
- Template metadata display
- Dependency requirements shown
- Output file previews
- Compatibility indicators

### 3. Variable Prompting System

Dynamic variable collection based on template analysis:

```bash
$ unjucks generate component react

✔ Component name: MyButton
? Select component type: (Use arrow keys)
❯ Functional (recommended)
  Class Component
  Forward Ref Component

✔ Include TypeScript? (Y/n) · true
✔ Include tests? (Y/n) · true  
✔ Include Storybook stories? (y/N) · false
✔ Styling approach: CSS Modules
✔ Export type: Named export
```

**Dynamic Prompting Rules:**
1. **String variables**: Text input with validation
2. **Boolean variables**: Confirmation prompts with smart defaults
3. **Choice variables**: Selection lists from template metadata
4. **Conditional variables**: Only shown based on previous answers

### 4. Path and Destination Prompting

Intelligent path resolution with suggestions:

```bash
? Destination directory: (src/components)
  src/components/buttons/     <- suggested based on component type
  src/components/forms/       <- recently used
  src/components/layout/      <- project structure analysis
  [Enter custom path]
```

**Features:**
- Project structure analysis
- Convention-based suggestions
- Recently used paths
- Auto-completion support

## Dynamic Command Generation

### Variable Discovery Engine

The CLI scans templates to discover available variables:

1. **Template Content Analysis**
   ```nunjucks
   // Template: component.tsx.njk
   import React from 'react';
   
   interface {{ name }}Props {
     {{ #if includeChildren }}
     children?: React.ReactNode;
     {{ /if }}
     {{ #each propTypes }}
     {{ this.name }}: {{ this.type }};
     {{ /each }}
   }
   
   export const {{ name }}: React.FC<{{ name }}Props> = ({ 
     {{ #each propTypes }}{{ this.name }}{{ #unless @last }}, {{ /unless }}{{ /each }} 
   }) => {
     return <div>{{ name }}</div>;
   };
   ```

2. **Extracted Variables**
   - `name` (string, required)
   - `includeChildren` (boolean, optional)
   - `propTypes` (array, optional)

3. **Generated CLI Flags**
   ```bash
   unjucks generate component react MyButton \
     --includeChildren \
     --propTypes '[{"name":"onClick","type":"() => void"}]'
   ```

### Frontmatter Processing

Templates can specify prompting behavior through frontmatter:

```yaml
---
to: src/components/<%= name %>/<%= name %>.tsx
prompts:
  - name: componentType
    type: select
    message: "Component type:"
    choices:
      - { name: "Functional", value: "functional" }
      - { name: "Class", value: "class" }
  - name: includeTests
    type: confirm
    message: "Generate tests?"
    initial: true
    when: "{{ answers.componentType === 'functional' }}"
  - name: testingLibrary
    type: select
    message: "Testing library:"
    choices: ["@testing-library/react", "enzyme"]
    when: "{{ answers.includeTests }}"
variables:
  name:
    type: string
    required: true
    validate: /^[A-Z][a-zA-Z0-9]*$/
  includeProps:
    type: boolean
    default: true
    description: "Include props interface"
---
```

**Frontmatter Features:**
- **prompts**: Define interactive questions
- **variables**: Specify variable types and validation
- **conditions**: Show prompts based on previous answers
- **validation**: Runtime input validation rules

### Intelligent Type Inference

When frontmatter is not available, the CLI infers types:

1. **String Detection**
   ```nunjucks
   {{ name }} -> String (default)
   {{ className }} -> String with validation
   ```

2. **Boolean Detection**
   ```nunjucks
   {{ #if includeTests }} -> Boolean
   {{ #unless skipLinting }} -> Boolean (inverted)
   ```

3. **Array Detection**
   ```nunjucks
   {{ #each items }} -> Array
   {{ items.length }} -> Array (inferred)
   ```

4. **Complex Object Detection**
   ```nunjucks
   {{ config.database.host }} -> Object with nested properties
   ```

## Advanced Interactive Features

### 1. Multi-Step Wizards

Complex generators can implement multi-step configuration:

```bash
$ unjucks generate fullstack-app

Step 1 of 4: Project Setup
✔ Project name: my-awesome-app
✔ Description: A full-stack application
✔ Author: John Doe <john@example.com>

Step 2 of 4: Frontend Configuration  
✔ Frontend framework: React with TypeScript
✔ State management: Redux Toolkit
✔ Styling: Styled Components + Theme UI

Step 3 of 4: Backend Configuration
✔ Backend framework: Express with TypeScript  
✔ Database: PostgreSQL with Prisma
✔ Authentication: JWT + Passport.js

Step 4 of 4: DevOps Configuration
✔ Containerization: Docker + Docker Compose
✔ CI/CD: GitHub Actions
✔ Hosting: Vercel (frontend) + Railway (backend)
```

### 2. Configuration Persistence

The CLI can save and reuse configuration:

```bash
$ unjucks generate component react --save-config my-component-preset

# Later usage
$ unjucks generate component react --load-config my-component-preset MyNewComponent
```

**Configuration Features:**
- Named presets for common patterns
- Team-shared configurations
- Project-level defaults
- Environment-specific overrides

### 3. Real-time Preview

Live preview of generated files during configuration:

```bash
? Component name: › UserProfile

Preview (src/components/UserProfile/UserProfile.tsx):
┌─────────────────────────────────────────────────────────────┐
│ import React from 'react';                                  │
│                                                             │
│ interface UserProfileProps {                                │
│   // TODO: Add props based on your selections              │
│ }                                                           │
│                                                             │
│ export const UserProfile: React.FC<UserProfileProps> = () => │
│   return <div>UserProfile Component</div>;                 │
│ };                                                          │
└─────────────────────────────────────────────────────────────┘

✔ Include TypeScript interfaces? (Y/n) · true

Updated Preview:
┌─────────────────────────────────────────────────────────────┐
│ export interface User {                                     │
│   id: string;                                               │
│   name: string;                                             │
│   email: string;                                            │
│ }                                                           │
│                                                             │
│ interface UserProfileProps {                                │
│   user: User;                                               │
│   onEdit?: (user: User) => void;                           │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

### 4. Context-Aware Suggestions

The CLI analyzes the current project to provide intelligent suggestions:

**Package.json Analysis:**
- Detects existing dependencies
- Suggests compatible versions
- Warns about conflicts

**File Structure Analysis:**
- Recognizes project conventions
- Suggests appropriate directories
- Maintains consistency with existing patterns

**Git Repository Analysis:**
- Detects branching strategy
- Suggests appropriate commit patterns
- Integrates with CI/CD configurations

## Error Handling in Interactive Mode

### Validation Feedback

Real-time validation with helpful error messages:

```bash
? Component name: › my-component
✖ Component name must start with a capital letter (PascalCase)

? Component name: › MyComponent
✔ Component name looks good!

? Destination directory: › src/pages/components  
✖ Directory 'src/pages' doesn't exist. Create it? (Y/n)
```

### Recovery Mechanisms

Graceful handling of user mistakes:

1. **Undo Support**: Allow users to go back and change previous answers
2. **Validation Retry**: Re-prompt for invalid inputs with suggestions
3. **Exit Options**: Provide clear exit paths at any step
4. **State Preservation**: Save progress across interruptions

### Contextual Help

Built-in help system accessible during prompts:

```bash
? Select testing framework: (Use arrow keys, ? for help)
❯ Jest (recommended)
  Vitest (modern alternative)
  Mocha (classic choice)
  [?] Need help choosing?

Help: Testing Framework Selection
─────────────────────────────────
Jest: Most popular, extensive ecosystem, great for React
Vitest: Faster alternative, Vite-native, modern features  
Mocha: Mature and stable, flexible configuration

Press any key to continue...
```

## Integration with External Systems

### 1. MCP Protocol Integration

Interactive modes can leverage MCP for enhanced capabilities:

```bash
? Use AI assistance for component generation? (Y/n) · true

🤖 AI Assistant: Analyzing your project structure...
✨ Suggestion: Based on your existing components, I recommend:
  - Using TypeScript interfaces for props
  - Including Storybook stories for documentation  
  - Following your established naming conventions

? Accept AI suggestions? (Y/n) · true
```

### 2. Cloud Configuration

Integration with cloud-based configuration management:

```bash
? Load configuration from: (Use arrow keys)
❯ Local presets
  Team shared (GitHub)
  Organization templates (Cloud)
  AI-generated suggestions
```

This comprehensive interactive system makes the Unjucks CLI accessible to both beginners and power users, providing guidance and automation while maintaining flexibility for complex use cases.