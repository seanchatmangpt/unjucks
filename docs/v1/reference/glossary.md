# Glossary

> **Quick Reference**: Key terms and concepts used throughout Unjucks documentation.

## Core Concepts

### **Generator**
A collection of templates for a specific purpose (e.g., `component`, `service`, `page`).
- **Location**: `_templates/component/` directory
- **Usage**: `unjucks generate component new --name=Button`
- **Contains**: One or more templates

### **Template**
A specific variation within a generator (e.g., `new`, `edit`, `delete`).
- **Location**: `_templates/component/new/` directory
- **Files**: `.njk` template files with frontmatter
- **Usage**: `unjucks generate component new`

### **Frontmatter** 
YAML metadata at the top of template files that controls file generation.
```yaml
---
to: src/components/{{ name }}.tsx
inject: true
skipIf: "{{ name }}"
---
```

### **Variable**
Dynamic placeholders in templates that become CLI flags.
- **Template**: `{{ componentName }}`
- **CLI**: `--componentName=Button`
- **Auto-generated**: Extracted from template content

### **Filter**
Nunjucks functions that transform variables (similar to pipes).
- **Usage**: `{{ name | pascalCase }}`
- **Built-in**: `upper`, `lower`, `title`
- **Custom**: Defined in `unjucks.config.ts`

## Template Concepts

### **Injection**
Updating existing files instead of creating new ones.
- **Property**: `inject: true` in frontmatter
- **Markers**: `before:`, `after:`, `append:`, `prepend:`
- **Use case**: Adding exports to index files

### **Skip Condition**
Prevents template execution when condition is met.
- **Property**: `skipIf: "condition"` in frontmatter
- **Example**: `skipIf: "{{ not withTests }}"` (skip if no tests needed)
- **Use case**: Conditional file creation

### **Template Discovery**
Process of finding and indexing available generators.
- **Search paths**: `_templates/`, custom dirs from config
- **Structure**: `generator/template/files.njk`
- **Command**: `unjucks list` shows discovered templates

## CLI Concepts

### **Dynamic CLI**
Command-line interface generated automatically from template variables.
- **Source**: `{{ variableName }}` in templates
- **Result**: `--variableName` flag available
- **Types**: String, boolean, array flags

### **Dry Run**
Preview mode that shows what would be generated without creating files.
- **Flag**: `--dry` or `--dry-run`
- **Output**: Shows file paths and content preview
- **Use case**: Testing templates before execution

### **Force Mode**
Overwrites existing files without prompting.
- **Flag**: `--force`
- **Default**: Unjucks prompts before overwriting
- **Use case**: Regenerating files during development

## File System Concepts

### **Templates Directory**
Root directory containing all generators and templates.
- **Default**: `_templates/`
- **Configurable**: Via `unjucks.config.ts`
- **Structure**: `_templates/generator/template/file.njk`

### **Output Directory** 
Where generated files are created.
- **Default**: Current working directory
- **Configurable**: Via `to:` in frontmatter or config
- **Relative**: To project root or absolute paths

### **Template Path**
The `to:` property in frontmatter defining output file location.
- **Static**: `to: src/index.ts`
- **Dynamic**: `to: src/components/{{ name }}.tsx`
- **Conditional**: `to: {% if withTests %}src/{{ name }}.test.ts{% endif %}`

## Configuration Concepts

### **Config File**
TypeScript/JavaScript file defining Unjucks behavior.
- **Name**: `unjucks.config.ts` (or `.js`, `.json`)
- **Loader**: Uses c12 for flexible loading
- **Type safe**: Full TypeScript support

### **Template Engine**
Nunjucks templating system used to process templates.
- **Syntax**: `{{ variable }}`, `{% if condition %}`
- **Features**: Filters, macros, inheritance
- **Extension**: `.njk` files

### **Hooks** 
Extension points for customizing Unjucks behavior.
- **Types**: `beforeGenerate`, `afterGenerate`, `onError`
- **Usage**: Custom validation, file processing
- **Definition**: In config file

## Advanced Concepts

### **RDF Metadata**
Semantic annotations for templates using RDF triples.
- **Format**: JSON-LD in frontmatter
- **Use case**: Template categorization, relationships
- **Querying**: SPARQL-like queries

### **BDD Testing**
Behavior-driven development testing for templates.
- **Framework**: Vitest + Cucumber
- **Files**: `.feature` files with scenarios
- **Purpose**: Test template behavior and output

### **Template Inheritance**
Nunjucks feature for template reuse and extension.
- **Base templates**: Common structure
- **Child templates**: Extend with `{% extends "base.njk" %}`
- **Blocks**: `{% block content %}` for overrides

## Comparison Terms

### **Hygen vs Unjucks**
- **Hygen**: Uses EJS templating (`.ejs.t` files)
- **Unjucks**: Uses Nunjucks templating (`.njk` files)
- **Migration**: Change extensions and variable syntax

### **EJS vs Nunjucks**
- **EJS**: `<%= variable %>`, JavaScript-based
- **Nunjucks**: `{{ variable }}`, Python Jinja2-inspired
- **Performance**: Nunjucks is generally faster

### **Code Generation vs Scaffolding**
- **Generation**: Creating new files from templates
- **Scaffolding**: Setting up project structure
- **Unjucks**: Does both - generates files and scaffolds projects

## Error Terms

### **Template Not Found**
Error when trying to use non-existent generator/template.
- **Cause**: Wrong path or missing template files
- **Fix**: Check `unjucks list` and verify paths

### **Variable Not Defined**
Error when template uses undefined variable.
- **Cause**: Missing CLI flag or typo in variable name
- **Fix**: Pass required flags or check template syntax

### **Frontmatter Parse Error**
Error when YAML frontmatter is invalid.
- **Cause**: Invalid YAML syntax in template
- **Fix**: Validate YAML format in frontmatter

## Abbreviations

- **CLI**: Command Line Interface
- **YAML**: YAML Ain't Markup Language
- **RDF**: Resource Description Framework
- **BDD**: Behavior Driven Development
- **EJS**: Embedded JavaScript templates
- **JSON-LD**: JSON for Linking Data

## See Also

- **[CLI Reference](cli-reference.md)**: All available commands
- **[Template Syntax](template-syntax.md)**: Nunjucks syntax guide
- **[Configuration](configuration.md)**: Config file options
- **[Troubleshooting](troubleshooting.md)**: Common issues and fixes

---

*This glossary covers Unjucks v1.0 terminology. Terms may evolve with new versions.*