# Troubleshooting Guide

## Common Issues and Solutions

### Template Issues

#### "Template not found" Error

**Problem**: Unjucks cannot locate the specified template.

**Symptoms**:
```bash
Error: Template 'component' not found in '_templates'
```

**Solutions**:
1. Verify the templates directory exists:
   ```bash
   ls -la _templates/
   ```

2. Check the template structure:
   ```bash
   _templates/
   └── component/
       ├── index.js
       └── template.njk
   ```

3. Verify the configuration:
   ```typescript
   // unjucks.config.ts
   export default defineConfig({
     templates: '_templates', // Correct path
   });
   ```

#### Template Syntax Errors

**Problem**: Invalid Nunjucks syntax in templates.

**Symptoms**:
```bash
Error: Template syntax error at line 15: unexpected token
```

**Solutions**:
1. Validate template syntax:
   ```bash
   unjucks validate
   ```

2. Common syntax issues:
   ```yaml
   # ❌ Wrong
   {{ name | pascalcase }}
   
   # ✅ Correct
   {{ name | pascalCase }}
   ```

3. Check bracket matching:
   ```yaml
   # ❌ Wrong - missing closing bracket
   {{ if hasAuth }
   
   # ✅ Correct
   {% if hasAuth %}
   ```

### File Generation Issues

#### Files Not Being Created

**Problem**: Templates process without errors but files aren't created.

**Symptoms**:
- No error messages
- No files appear in expected locations
- Dry run shows expected output

**Solutions**:
1. Check output permissions:
   ```bash
   ls -la src/
   chmod 755 src/
   ```

2. Verify the `to` path in frontmatter:
   ```yaml
   ---
   to: "src/components/{{ pascalCase name }}.tsx"
   # Make sure the directory structure exists or will be created
   ---
   ```

3. Check for `skipIf` conditions:
   ```yaml
   ---
   skipIf: "export.*{{ pascalCase name }}"
   # This might be preventing file creation
   ---
   ```

#### File Permission Errors

**Problem**: Cannot write to target directory.

**Symptoms**:
```bash
Error: EACCES: permission denied, open 'src/components/MyComponent.tsx'
```

**Solutions**:
1. Fix directory permissions:
   ```bash
   chmod -R 755 src/
   ```

2. Use `sudo` if necessary (not recommended):
   ```bash
   sudo unjucks generate component MyComponent
   ```

3. Set proper chmod in frontmatter:
   ```yaml
   ---
   chmod: "644"
   ---
   ```

### Injection Issues

#### Content Not Being Injected

**Problem**: Injection mode enabled but content not added to existing files.

**Symptoms**:
- Files exist but new content isn't added
- No errors reported

**Solutions**:
1. Verify injection markers:
   ```yaml
   ---
   inject: true
   before: "// END EXPORTS"  # This marker must exist in target file
   ---
   ```

2. Check for `skipIf` preventing injection:
   ```yaml
   ---
   skipIf: "{{ pascalCase name }}"  # Might be too broad
   ---
   ```

3. Debug injection targets:
   ```bash
   unjucks generate component MyComponent --dry --verbose
   ```

#### Duplicate Content Injection

**Problem**: Same content injected multiple times.

**Symptoms**:
- Repeated code blocks in files
- Multiple identical imports

**Solutions**:
1. Use proper `skipIf` conditions:
   ```yaml
   ---
   skipIf: "export.*{{ pascalCase name }}"  # Prevent duplicates
   ---
   ```

2. Check injection markers are unique:
   ```yaml
   ---
   before: "// END COMPONENTS"  # Not "// END"
   ---
   ```

### Configuration Issues

#### Configuration Not Loading

**Problem**: Custom configuration ignored.

**Symptoms**:
- Default settings used instead of custom config
- Templates directory not found

**Solutions**:
1. Verify config file location:
   ```bash
   ls -la unjucks.config.ts  # Should be in project root
   ```

2. Check config file syntax:
   ```typescript
   import { defineConfig } from 'unjucks';
   
   export default defineConfig({
     // Configuration here
   });
   ```

3. Use explicit config path:
   ```bash
   unjucks generate --config ./custom.config.ts
   ```

### Variable and Context Issues

#### "Variable not defined" Errors

**Problem**: Template variables not available during generation.

**Symptoms**:
```bash
Error: Variable 'name' is not defined
```

**Solutions**:
1. Pass variables explicitly:
   ```bash
   unjucks generate component --name UserProfile
   ```

2. Define in configuration:
   ```typescript
   export default defineConfig({
     globals: {
       name: 'DefaultName'
     }
   });
   ```

3. Use default values in templates:
   ```yaml
   {{ name | default('DefaultComponent') }}
   ```

#### Context Variables Not Available

**Problem**: Expected context variables missing.

**Solutions**:
1. Debug available context:
   ```bash
   unjucks generate component MyComponent --debug
   ```

2. Check variable scope:
   ```yaml
   # Global variables vs. generator-specific variables
   ```

### AI Integration Issues

#### MCP Connection Failures

**Problem**: Cannot connect to AI agents.

**Symptoms**:
```bash
Error: MCP server 'claude-flow' not responding
```

**Solutions**:
1. Verify MCP server installation:
   ```bash
   npx claude-flow@alpha --version
   ```

2. Check server configuration:
   ```typescript
   ai: {
     mcp: {
       servers: [{
         name: 'claude-flow',
         command: 'npx',
         args: ['claude-flow@alpha', 'mcp', 'start']
       }]
     }
   }
   ```

3. Test MCP connection:
   ```bash
   npx claude-flow@alpha mcp test
   ```

#### AI Feature Disabled

**Problem**: AI features not working despite configuration.

**Solutions**:
1. Enable AI in configuration:
   ```typescript
   ai: {
     enabled: true
   }
   ```

2. Check API keys:
   ```bash
   echo $CLAUDE_API_KEY
   echo $OPENAI_API_KEY
   ```

3. Verify network connectivity:
   ```bash
   ping api.anthropic.com
   ```

### Performance Issues

#### Slow Template Processing

**Problem**: Template generation takes too long.

**Symptoms**:
- Commands hang for extended periods
- High CPU usage during generation

**Solutions**:
1. Profile template complexity:
   ```bash
   unjucks generate --verbose --debug
   ```

2. Optimize template logic:
   ```yaml
   # Avoid complex loops and conditions
   # Cache expensive operations
   ```

3. Use template inheritance:
   ```yaml
   # Extend base templates instead of duplicating logic
   ```

#### Memory Issues

**Problem**: Out of memory during large generations.

**Solutions**:
1. Increase Node.js memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" unjucks generate
   ```

2. Process files in batches:
   ```bash
   # Generate smaller chunks instead of all at once
   ```

## Diagnostic Commands

### Health Check

```bash
# Verify installation
unjucks --version

# Check configuration
unjucks config --validate

# List available templates  
unjucks list

# Validate all templates
unjucks validate

# Test with dry run
unjucks generate component Test --dry
```

### Debug Information

```bash
# Enable verbose logging
unjucks generate component Test --verbose

# Enable debug mode
unjucks generate component Test --debug

# Show configuration
unjucks config --show

# Test specific template
unjucks help component
```

### Environment Diagnostics

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check project dependencies
npm list unjucks

# Check file permissions
ls -la _templates/
ls -la src/
```

## Getting Help

### Community Resources

1. **GitHub Issues**: Report bugs and feature requests
   - Repository: https://github.com/ruvnet/unjucks
   - Include error messages and reproduction steps

2. **Documentation**: Complete reference material
   - Online docs: https://unjucks.dev
   - Built-in help: `unjucks help`

3. **Stack Overflow**: Community Q&A
   - Tag: `unjucks`
   - Search existing questions first

### Support Information to Include

When seeking help, please include:

1. **Unjucks version**: `unjucks --version`
2. **Node.js version**: `node --version`
3. **Operating system**: `uname -a` (Unix) or `ver` (Windows)
4. **Error messages**: Complete error text
5. **Configuration**: Your `unjucks.config.ts` file
6. **Template code**: Relevant template files
7. **Reproduction steps**: Exact commands run

### Creating Minimal Reproduction Cases

1. Create a minimal project structure:
   ```bash
   mkdir unjucks-issue
   cd unjucks-issue
   npm init -y
   npm install unjucks
   ```

2. Add minimal configuration:
   ```typescript
   // unjucks.config.ts
   export default defineConfig({
     templates: '_templates'
   });
   ```

3. Create minimal template:
   ```yaml
   ---
   to: "output.txt"
   ---
   Hello {{ name }}
   ```

4. Document exact steps to reproduce:
   ```bash
   unjucks generate test --name World
   ```

This approach helps maintainers quickly identify and fix issues.