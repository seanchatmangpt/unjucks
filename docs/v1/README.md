# Unjucks v1.0 Documentation

> **Quick Start**: Install → `npm i -g unjucks` → `unjucks init` → Start generating!

Universal Nunjucks-based code generator with smart templating, dynamic CLI generation, and semantic RDF capabilities.

## 🚀 3-Step Quick Start

```bash
# 1. Install
npm install -g unjucks

# 2. Initialize (creates _templates/ directory)
unjucks init

# 3. Generate from any template
unjucks list                    # See available generators
unjucks help component react    # Get help for specific template
unjucks generate component react --componentName=Button --withProps
```

## 📖 Core Documentation (80/20 Rule)

### Essential Guides (Most Users Need These)
- [**Quick Start Guide**](getting-started/README.md) - Get up and running in 5 minutes
- [**CLI Commands**](reference/cli-reference.md) - All commands you'll actually use
- [**Template Creation**](guides/creating-templates.md) - Build your own generators
- [**Common Use Cases**](guides/common-patterns.md) - Real-world examples

### Advanced Topics (20% Power Users)
- [**API Reference**](api/README.md) - Programmatic usage
- [**Architecture**](architecture/README.md) - How it works internally
- [**RDF/Semantic Features**](guides/semantic-features.md) - Advanced metadata
- [**Testing Framework**](testing/README.md) - BDD testing with Vitest+Cucumber

## 🎯 What Makes Unjucks Special

### Smart Template Engine
- **Nunjucks + Variables**: Extract `{{ name }}` as CLI flags automatically
- **Dynamic CLI**: `--componentName=Button` generated from template vars
- **File Injection**: Update existing files, not just create new ones
- **RDF Metadata**: Templates can include semantic annotations

### Hygen-Style Workflow
```bash
# Familiar hygen commands work out of the box
unjucks generate <generator> <template> [flags]
unjucks list
unjucks help <generator> <template>
```

### Enterprise Features
- **Template Discovery**: Auto-finds generators in `_templates/` or custom dirs
- **Configuration**: `unjucks.config.ts` with c12 loading
- **TypeScript**: Built-in TypeScript support and types
- **Testing**: BDD scenarios with Vitest + Cucumber integration

## 📂 Project Structure

```
my-project/
├── _templates/              # Your generators (like hygen)
│   ├── component/
│   │   └── new/
│   │       ├── index.ejs.t
│   │       └── test.ejs.t
│   └── service/
│       └── new/
├── unjucks.config.ts        # Configuration
└── src/                     # Generated files go here
```

## 🛠 Essential Commands

| Command | Purpose | Example |
|---------|---------|----------|
| `unjucks init` | Set up templates directory | `unjucks init --type=nextjs` |
| `unjucks list` | Show available generators | `unjucks list` |
| `unjucks generate` | Create from template | `unjucks generate component button --name=MyButton` |
| `unjucks help` | Get template help | `unjucks help component new` |
| `unjucks inject` | Update existing files | `unjucks inject --target=src/index.ts --template=export` |

## 🔄 Migration from Hygen

```bash
# Your existing hygen templates work with minimal changes
# Just rename .ejs.t to .njk and update variable syntax:

# Hygen:
# ---
# to: src/components/<%= name %>.tsx
# ---

# Unjucks:
# ---
# to: src/components/{{ name }}.tsx
# ---
```

## 🆕 What's New in v1.0

### Major Features
- ✅ **Nunjucks Templates**: Powerful templating with filters and inheritance
- ✅ **Dynamic CLI**: Auto-generated flags from template variables
- ✅ **File Injection**: Update existing files, not just create new ones
- ✅ **TypeScript First**: Full TypeScript support and types
- ✅ **BDD Testing**: Built-in testing framework with Vitest+Cucumber
- ✅ **RDF Metadata**: Semantic annotations for advanced template management

### Migration Made Easy
- 🔄 **Hygen Compatible**: Convert existing templates with minimal changes
- 📖 **Step-by-Step Guide**: [Migration from Hygen](guides/migration-from-hygen.md)
- 🛠 **Migration Script**: Automated conversion helpers included

### Developer Experience
- 🚀 **Performance**: Faster generation than Hygen
- 🎯 **Better CLI**: Improved help, validation, and error messages
- 📚 **Rich Documentation**: Complete guides and references
- 🔍 **Debugging**: Built-in debugging and dry-run modes

## 📚 Complete Documentation Navigation

### 🚀 Getting Started (New Users)
- [**Installation**](getting-started/installation.md) - Install and setup
- [**Quick Start**](getting-started/quick-start.md) - 5-minute tutorial
- [**First Generator**](getting-started/first-generator.md) - Create your first template

### 📖 Essential Guides (Most Users Need)
- [**Migration from Hygen**](guides/migration-from-hygen.md) - Convert existing templates
- [**Creating Templates**](guides/creating-templates.md) - Build custom generators *[Coming Soon]*
- [**Common Patterns**](guides/common-patterns.md) - Real-world examples *[Coming Soon]*
- [**File Injection**](guides/file-injection.md) - Update existing files *[Coming Soon]*

### 🔧 Reference (Look Up When Needed)
- [**CLI Reference**](api/cli-reference.md) - All commands and flags
- [**Programmatic API**](api/programmatic-api.md) - TypeScript API
- [**Template Syntax**](reference/template-syntax.md) - Nunjucks + frontmatter *[Coming Soon]*
- [**Configuration**](reference/configuration.md) - Config file options *[Coming Soon]*
- [**Troubleshooting**](reference/troubleshooting.md) - Common issues and fixes
- [**Glossary**](reference/glossary.md) - Key terms and concepts

### 🎓 Advanced Topics (Power Users)
- [**Architecture**](architecture/README.md) - Internal design *[Coming Soon]*
- [**RDF/Semantic Features**](guides/semantic-features.md) - Metadata system *[Coming Soon]*
- [**Testing Framework**](testing/README.md) - BDD testing *[Coming Soon]*

### 🗺️ Complete Site Map
- [**📍 NAVIGATION.md**](NAVIGATION.md) - **Complete documentation index and learning paths**

## 💡 Quick Examples

### Create a React Component Generator

```bash
# 1. Create template directory
mkdir -p _templates/component/new

# 2. Create template file
cat > _templates/component/new/component.njk << 'EOF'
---
to: src/components/{{ name | pascalCase }}.tsx
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  {% if withProps %}className?: string;{% endif %}
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  {% if withProps %}className{% endif %}
}) => {
  return (
    <div {% if withProps %}className={className}{% endif %}>
      {{ name | pascalCase }} Component
    </div>
  );
};
EOF

# 3. Generate components
unjucks generate component new --name=Button --withProps
unjucks generate component new --name=Modal
```

### API Usage

```typescript
import { Unjucks } from 'unjucks';

const generator = new Unjucks({
  templatesDir: './_templates',
  outputDir: './src'
});

// Generate from template
await generator.generate('component', 'new', {
  name: 'Button',
  withProps: true
});

// List available generators
const generators = await generator.list();
console.log(generators);
```

## 🎓 Learning Path

1. **Beginner**: [Quick Start](getting-started/README.md) → [First Template](getting-started/first-template.md)
2. **Intermediate**: [Common Patterns](guides/common-patterns.md) → [Advanced Templates](guides/advanced-templates.md)
3. **Advanced**: [File Injection](guides/file-injection.md) → [RDF Features](guides/semantic-features.md)
4. **Expert**: [API Reference](api/README.md) → [Architecture](architecture/README.md)

---

## Need Help?

- 🐛 **Issues**: [GitHub Issues](https://github.com/unjs/unjucks/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/unjs/unjucks/discussions)
- 📖 **Full Docs**: [Complete Index](index.md)

*Unjucks v1.0 - Built with TypeScript, tested with Vitest+Cucumber, powered by Nunjucks*