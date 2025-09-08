# Troubleshooting Guide

## Table of Contents
1. [Common Issues](#common-issues)
2. [Installation Problems](#installation-problems)
3. [CLI Issues](#cli-issues)
4. [Template Generation Problems](#template-generation-problems)
5. [Build and Deployment Issues](#build-and-deployment-issues)
6. [Semantic Web Issues](#semantic-web-issues)
7. [Performance Problems](#performance-problems)
8. [Error Messages](#error-messages)
9. [Debug Mode](#debug-mode)
10. [Getting Help](#getting-help)

## Common Issues

### Quick Diagnostics
Before diving into specific issues, run these quick diagnostic commands:

```bash
# Check Unjucks installation
unjucks --version

# Check Node.js version (should be ≥18.0.0)
node --version

# Check npm configuration
npm config list

# List available templates
unjucks list

# Run health check
npm run test:smoke
```

### Environment Check Script
```bash
#!/bin/bash
# diagnose.sh - Quick environment diagnostics

echo "🔍 Unjucks Environment Diagnostics"
echo "=================================="

# Node.js version
echo "Node.js: $(node --version)"
if ! node -e "process.exit(process.version.slice(1).split('.')[0] >= 18 ? 0 : 1)"; then
    echo "❌ Node.js version must be ≥18.0.0"
    exit 1
fi

# Unjucks installation
if command -v unjucks &> /dev/null; then
    echo "✅ Unjucks: $(unjucks --version)"
else
    echo "❌ Unjucks not installed or not in PATH"
    exit 1
fi

# npm configuration
echo "📦 npm: $(npm --version)"
echo "📂 Global packages: $(npm root -g)"

# Template availability
template_count=$(unjucks list 2>/dev/null | grep -c "├─" || echo "0")
echo "📋 Templates available: $template_count"

echo "✅ Environment check complete"
```

## Installation Problems

### Issue: "Command not found: unjucks"

**Symptoms:**
```bash
$ unjucks --version
-bash: unjucks: command not found
```

**Solutions:**

1. **Verify Installation:**
   ```bash
   # Check if globally installed
   npm list -g @seanchatmangpt/unjucks
   
   # If not installed, install globally
   npm install -g @seanchatmangpt/unjucks
   ```

2. **Check PATH Configuration:**
   ```bash
   # Find npm global bin directory
   npm config get prefix
   
   # Add to PATH (add to ~/.bashrc or ~/.zshrc)
   export PATH="$(npm config get prefix)/bin:$PATH"
   
   # Reload shell configuration
   source ~/.bashrc  # or ~/.zshrc
   ```

3. **Alternative Installation Methods:**
   ```bash
   # Use npx instead of global install
   npx @seanchatmangpt/unjucks --version
   
   # Install locally in project
   npm install @seanchatmangpt/unjucks
   ./node_modules/.bin/unjucks --version
   ```

### Issue: Permission Denied Errors

**Symptoms:**
```bash
npm ERR! code EACCES
npm ERR! syscall mkdir
npm ERR! path /usr/local/lib/node_modules/@seanchatmangpt
```

**Solutions:**

1. **Fix npm Permissions (Linux/macOS):**
   ```bash
   # Change ownership of npm directories
   sudo chown -R $(whoami) ~/.npm
   sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
   ```

2. **Use npm Prefix:**
   ```bash
   # Create directory for global packages
   mkdir ~/.npm-global
   
   # Configure npm to use new directory
   npm config set prefix '~/.npm-global'
   
   # Add to PATH
   export PATH=~/.npm-global/bin:$PATH
   
   # Install unjucks
   npm install -g @seanchatmangpt/unjucks
   ```

3. **Use Node Version Manager:**
   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   
   # Install and use latest Node.js
   nvm install node
   nvm use node
   
   # Now install unjucks
   npm install -g @seanchatmangpt/unjucks
   ```

### Issue: Version Mismatch or Outdated Package

**Symptoms:**
```bash
# Old version installed
unjucks --version  # Shows older version
```

**Solutions:**

1. **Update to Latest Version:**
   ```bash
   # Uninstall old version
   npm uninstall -g @seanchatmangpt/unjucks
   
   # Clear npm cache
   npm cache clean --force
   
   # Install latest version
   npm install -g @seanchatmangpt/unjucks@latest
   
   # Verify update
   unjucks --version
   ```

2. **Check for Pre-release Versions:**
   ```bash
   # List available versions
   npm view @seanchatmangpt/unjucks versions --json
   
   # Install specific version
   npm install -g @seanchatmangpt/unjucks@2025.9.8.1
   ```

## CLI Issues

### Issue: CLI Hangs or Doesn't Respond

**Symptoms:**
```bash
$ unjucks list
# Command hangs with no output
```

**Solutions:**

1. **Check for Infinite Loops:**
   ```bash
   # Run with timeout
   timeout 30s unjucks list
   
   # Kill hanging process
   pkill -f unjucks
   ```

2. **Enable Debug Mode:**
   ```bash
   DEBUG=unjucks:* unjucks list
   ```

3. **Check File Permissions:**
   ```bash
   # Verify CLI files are executable
   ls -la $(which unjucks)
   
   # Fix permissions if needed
   chmod +x $(which unjucks)
   ```

### Issue: "Module not found" Errors

**Symptoms:**
```bash
Error: Cannot find module '@seanchatmangpt/unjucks/src/cli/index.js'
```

**Solutions:**

1. **Reinstall Package:**
   ```bash
   npm uninstall -g @seanchatmangpt/unjucks
   npm install -g @seanchatmangpt/unjucks
   ```

2. **Check Installation Integrity:**
   ```bash
   # Verify package contents
   npm pack @seanchatmangpt/unjucks --dry-run
   
   # Check file structure
   ls -la $(npm root -g)/@seanchatmangpt/unjucks/
   ```

3. **Use Alternative Entry Point:**
   ```bash
   # Try direct node execution
   node $(npm root -g)/@seanchatmangpt/unjucks/bin/unjucks.cjs --version
   ```

### Issue: Arguments Not Parsed Correctly

**Symptoms:**
```bash
$ unjucks component react Button --props name,type
# Props not recognized or parsed incorrectly
```

**Solutions:**

1. **Check Argument Syntax:**
   ```bash
   # Use explicit generate command
   unjucks generate component react Button --props "name,type"
   
   # Quote complex arguments
   unjucks generate api endpoint users --fields "name:string,email:string"
   ```

2. **Use Configuration File:**
   ```javascript
   // .unjucks.config.js
   module.exports = {
     variables: {
       props: ['name', 'type'],
       fields: [
         { name: 'name', type: 'string' },
         { name: 'email', type: 'string' }
       ]
     }
   };
   ```

3. **Debug Argument Parsing:**
   ```bash
   DEBUG=citty:* unjucks component react Button --props name,type
   ```

## Template Generation Problems

### Issue: Template Not Found

**Symptoms:**
```bash
$ unjucks component react Button
Error: Template not found: component/react
```

**Solutions:**

1. **List Available Templates:**
   ```bash
   # List all generators
   unjucks list
   
   # List specific generator templates
   unjucks list component
   ```

2. **Check Template Path:**
   ```bash
   # Verify template directory structure
   ls -la _templates/component/
   
   # Check for typos in generator/template names
   find _templates -name "*react*" -type d
   ```

3. **Use Custom Template Path:**
   ```bash
   # Specify custom template path
   unjucks generate component react Button --template-path ./custom-templates
   
   # Set environment variable
   export UNJUCKS_TEMPLATE_PATH=./custom-templates
   unjucks generate component react Button
   ```

### Issue: Template Generation Fails

**Symptoms:**
```bash
Error: Template generation failed: ReferenceError: Name is not defined
```

**Solutions:**

1. **Check Template Syntax:**
   ```bash
   # Preview template to check for syntax errors
   unjucks preview component react Button
   ```

2. **Validate Template Variables:**
   ```ejs
   <!-- In template file, check variable definitions -->
   <% if (typeof Name === 'undefined') { %>
     <% throw new Error('Name variable is required'); %>
   <% } %>
   ```

3. **Debug Template Processing:**
   ```bash
   DEBUG=unjucks:template unjucks generate component react Button
   ```

### Issue: Generated Files Have Syntax Errors

**Symptoms:**
```bash
# Generated file contains template syntax
// Component: <%= Name %>  # Should be: // Component: Button
```

**Solutions:**

1. **Check Template File Extensions:**
   ```bash
   # Template files should end with .ejs.t
   mv template.ejs template.ejs.t
   ```

2. **Validate EJS Syntax:**
   ```ejs
   <!-- Correct syntax -->
   <%= Name %>           <!-- Escaped output -->
   <%- unescapedHtml %>  <!-- Unescaped output -->
   <% if (condition) { %><!-- Logic blocks -->
   
   <!-- Incorrect syntax -->
   <Name>                <!-- Not EJS syntax -->
   {{ Name }}           <!-- Wrong template syntax -->
   ```

3. **Test Template Independently:**
   ```javascript
   // test-template.js
   const ejs = require('ejs');
   const template = `const <%= Name %> = () => { return '<%= name %>'; };`;
   const result = ejs.render(template, { Name: 'Button', name: 'button' });
   console.log(result);
   ```

### Issue: File Permissions on Generated Files

**Symptoms:**
```bash
# Generated files not executable or wrong permissions
-rw------- script.sh  # Should be -rwxr-xr-x
```

**Solutions:**

1. **Set Permissions in Template:**
   ```ejs
   ---
   to: scripts/<%= name %>.sh
   chmod: 755
   ---
   #!/bin/bash
   echo "Script content"
   ```

2. **Post-generation Hook:**
   ```javascript
   // In template index.js
   module.exports = {
     hooks: {
       after: ({ generatedFiles }) => {
         generatedFiles
           .filter(file => file.endsWith('.sh'))
           .forEach(file => {
             require('fs').chmodSync(file, 0o755);
           });
       }
     }
   };
   ```

## Build and Deployment Issues

### Issue: Build Failures

**Symptoms:**
```bash
$ npm run build
❌ Build failed: Permission setup failed
```

**Solutions:**

1. **Check File Permissions:**
   ```bash
   # Make CLI files executable
   chmod +x bin/unjucks.cjs
   chmod +x src/cli/index.js
   
   # Run build again
   npm run build
   ```

2. **Clean Build:**
   ```bash
   # Remove build artifacts
   rm -rf build-report.json
   
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   
   # Try build again
   npm run build
   ```

3. **Debug Build Process:**
   ```bash
   # Run build with debug information
   DEBUG=1 npm run build
   
   # Skip tests during build
   npm run build -- --skip-tests
   
   # Run minimal build
   npm run build:validate
   ```

### Issue: Test Failures

**Symptoms:**
```bash
$ npm test
Tests failed: 5 passed, 3 failed
```

**Solutions:**

1. **Run Specific Tests:**
   ```bash
   # Run only passing test suites
   npm run test:cli
   npm run test:cucumber
   
   # Run tests with verbose output
   npm test -- --verbose
   
   # Run tests with coverage
   npm test -- --coverage
   ```

2. **Fix Test Environment:**
   ```bash
   # Clear test cache
   npm run test -- --clearCache
   
   # Update test snapshots
   npm run test -- --updateSnapshot
   
   # Run tests in band (no parallelization)
   npm run test -- --runInBand
   ```

### Issue: Deployment Problems

**Symptoms:**
```bash
$ npm publish
npm ERR! 403 You do not have permission to publish
```

**Solutions:**

1. **Check npm Authentication:**
   ```bash
   # Verify logged in
   npm whoami
   
   # Login if needed
   npm login
   
   # Check package access
   npm access list packages
   ```

2. **Verify Package Configuration:**
   ```bash
   # Check package name availability
   npm view @seanchatmangpt/unjucks
   
   # Test publish (dry run)
   npm publish --dry-run
   ```

## Semantic Web Issues

### Issue: RDF Parsing Errors

**Symptoms:**
```bash
Error: Unexpected ":" on line 5
```

**Solutions:**

1. **Validate RDF Syntax:**
   ```bash
   # Use online validator
   curl -X POST -F "data=@schema.ttl" https://www.w3.org/RDF/Validator/ARPServlet
   
   # Check with N3.js directly
   node -e "
   const n3 = require('n3');
   const fs = require('fs');
   const parser = new n3.Parser();
   const data = fs.readFileSync('schema.ttl', 'utf8');
   parser.parse(data, (error, quad, prefixes) => {
     if (error) console.error('Parse error:', error);
     else if (quad) console.log('Quad:', quad);
     else console.log('Parsing complete, prefixes:', prefixes);
   });
   "
   ```

2. **Check Turtle Syntax:**
   ```turtle
   # Common syntax issues and fixes
   
   # Missing prefix declarations
   @prefix ex: <http://example.com/> .
   @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
   
   # Missing final dots
   ex:Person a rdfs:Class .  # Note the dot at the end
   
   # Incorrect URI brackets
   <http://example.com/Person>  # Correct
   http://example.com/Person    # Incorrect
   ```

### Issue: Ontology Loading Problems

**Symptoms:**
```bash
$ unjucks semantic generate --ontology schema.ttl
Error: Failed to load ontology: ENOENT
```

**Solutions:**

1. **Check File Path:**
   ```bash
   # Verify file exists
   ls -la schema.ttl
   
   # Use absolute path
   unjucks semantic generate --ontology /full/path/to/schema.ttl
   
   # Check current directory
   pwd
   ```

2. **Validate File Format:**
   ```bash
   # Check file content type
   file schema.ttl
   
   # Verify it's text, not binary
   head -n 5 schema.ttl
   ```

### Issue: Code Generation from RDF Fails

**Symptoms:**
```bash
Generated classes are empty or malformed
```

**Solutions:**

1. **Check Ontology Structure:**
   ```sparql
   # Query to check class definitions
   PREFIX owl: <http://www.w3.org/2002/07/owl#>
   PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
   
   SELECT ?class ?label WHERE {
     ?class a owl:Class .
     OPTIONAL { ?class rdfs:label ?label }
   }
   ```

2. **Verify Property Definitions:**
   ```sparql
   PREFIX owl: <http://www.w3.org/2002/07/owl#>
   PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
   
   SELECT ?property ?domain ?range WHERE {
     ?property a owl:DatatypeProperty .
     OPTIONAL { ?property rdfs:domain ?domain }
     OPTIONAL { ?property rdfs:range ?range }
   }
   ```

3. **Debug Generation Process:**
   ```bash
   DEBUG=unjucks:semantic unjucks semantic generate --ontology schema.ttl --verbose
   ```

## Performance Problems

### Issue: Slow Template Generation

**Symptoms:**
```bash
# Generation takes several seconds for simple templates
$ time unjucks component react Button
real    0m15.234s
```

**Solutions:**

1. **Profile Template Processing:**
   ```bash
   # Run with timing information
   time unjucks preview component react Button
   
   # Profile with Node.js
   node --prof $(which unjucks) component react Button
   node --prof-process --preprocess -j isolate*.log > profile.txt
   ```

2. **Optimize Template Complexity:**
   ```javascript
   // In template index.js, avoid complex computations
   module.exports = {
     prompts: [
       {
         type: 'input',
         name: 'name',
         message: 'Component name?',
         // Avoid complex validation functions
         validate: input => input.length > 0
       }
     ]
   };
   ```

3. **Cache Template Compilation:**
   ```bash
   # Clear template cache if corrupted
   rm -rf ~/.unjucks/cache
   
   # Rebuild template cache
   unjucks list
   ```

### Issue: High Memory Usage

**Symptoms:**
```bash
# Memory usage grows excessively during generation
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solutions:**

1. **Increase Node.js Memory Limit:**
   ```bash
   # Increase heap size
   NODE_OPTIONS="--max-old-space-size=4096" unjucks generate large-project app MyApp
   ```

2. **Optimize Template Size:**
   ```javascript
   // Break large templates into smaller chunks
   // Instead of one large template:
   module.exports = [
     { type: 'add', path: 'src/components/{{Name}}/index.js', templateFile: 'index.ejs' },
     { type: 'add', path: 'src/components/{{Name}}/{{Name}}.js', templateFile: 'component.ejs' },
     // ... many more files
   ];
   
   // Use template inheritance or composition
   ```

3. **Monitor Memory Usage:**
   ```bash
   # Monitor during generation
   top -p $(pgrep -f unjucks)
   
   # Use memory profiling
   node --inspect $(which unjucks) component react Button
   ```

## Error Messages

### Common Error Messages and Solutions

#### "Template not found"
```bash
Error: Template not found: component/react
```
**Solution:** Check template path and naming, run `unjucks list` to see available templates.

#### "Permission denied"
```bash
Error: EACCES: permission denied, open '/usr/local/lib/node_modules'
```
**Solution:** Fix npm permissions or use `sudo` (not recommended), or use nvm.

#### "Module not found"
```bash
Error: Cannot find module 'n3'
```
**Solution:** Reinstall dependencies with `npm install`.

#### "Syntax error in template"
```bash
SyntaxError: Unexpected token '<' in JSON at position 0
```
**Solution:** Check EJS template syntax, ensure proper file extensions (.ejs.t).

#### "RDF parsing failed"
```bash
Error: Parse error on line 15: Unexpected "^"
```
**Solution:** Validate RDF/Turtle syntax, check for missing prefixes or malformed URIs.

#### "Command not found"
```bash
bash: unjucks: command not found
```
**Solution:** Check installation and PATH configuration.

## Debug Mode

### Enabling Debug Output

#### Environment Variables
```bash
# Enable all debug output
export DEBUG=unjucks:*

# Enable specific debug categories
export DEBUG=unjucks:cli,unjucks:template,unjucks:semantic

# Disable debug output
unset DEBUG
```

#### Debug Categories
```bash
DEBUG=unjucks:cli        # CLI argument parsing and execution
DEBUG=unjucks:template   # Template processing and rendering
DEBUG=unjucks:semantic   # RDF/semantic processing
DEBUG=unjucks:build      # Build system operations
DEBUG=unjucks:performance # Performance metrics
```

### Verbose Mode
```bash
# Enable verbose output for any command
unjucks --verbose component react Button

# Combine with debug
DEBUG=unjucks:* unjucks --verbose semantic generate --ontology schema.ttl
```

### Logging Configuration
```javascript
// .unjucks.config.js
module.exports = {
  logging: {
    level: 'debug',          // debug, info, warn, error
    file: 'unjucks.log',     // Log to file
    console: true            // Also log to console
  }
};
```

### Debug Utilities

#### Template Debug Script
```javascript
// debug-template.js
const { TemplateEngine } = require('@seanchatmangpt/unjucks');

async function debugTemplate(generator, template, variables = {}) {
  const engine = new TemplateEngine({
    debug: true,
    verbose: true
  });
  
  try {
    console.log('Loading template:', generator, template);
    const tmpl = await engine.loadTemplate(`${generator}/${template}`);
    console.log('Template loaded:', tmpl);
    
    console.log('Rendering with variables:', variables);
    const result = await engine.render(tmpl, variables);
    console.log('Render result:', result);
    
  } catch (error) {
    console.error('Debug error:', error);
    console.error('Stack:', error.stack);
  }
}

// Usage
debugTemplate('component', 'react', { name: 'TestComponent' });
```

## Getting Help

### Self-Help Resources

1. **Documentation:**
   - [User Guide](USER_GUIDE.md)
   - [API Documentation](API_DOCUMENTATION.md)
   - [Template Development Guide](TEMPLATE_DEVELOPMENT_GUIDE.md)
   - [Build and Deployment Guide](BUILD_DEPLOYMENT_GUIDE.md)

2. **Built-in Help:**
   ```bash
   # General help
   unjucks --help
   
   # Command-specific help
   unjucks generate --help
   unjucks semantic --help
   
   # Template help
   unjucks help component react
   ```

3. **Online Resources:**
   - GitHub Repository: https://github.com/unjucks/unjucks
   - Issues: https://github.com/unjucks/unjucks/issues
   - Wiki: https://github.com/unjucks/unjucks/wiki

### Reporting Issues

#### Before Reporting
1. Check existing issues on GitHub
2. Update to latest version
3. Try debug mode
4. Gather system information

#### Issue Template
```markdown
## Bug Report

### Environment
- Unjucks version: (run `unjucks --version`)
- Node.js version: (run `node --version`)
- npm version: (run `npm --version`)
- OS: (macOS/Linux/Windows)

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Error Messages
```
Paste error messages or logs here
```

### Debug Output
```
Paste debug output here (run with DEBUG=unjucks:*)
```

### Additional Context
Any other relevant information
```

### Getting Community Support

1. **GitHub Discussions:** For questions and community support
2. **Issues:** For bug reports and feature requests  
3. **Stack Overflow:** Tag questions with `unjucks`
4. **Discord/Slack:** Community chat channels (if available)

### Emergency Support

For critical issues in production:

1. **Check Health Status:**
   ```bash
   unjucks --version
   npm run test:smoke
   ```

2. **Quick Fixes:**
   ```bash
   # Rollback to previous version
   npm install -g @seanchatmangpt/unjucks@<previous-version>
   
   # Use npx instead of global install
   npx @seanchatmangpt/unjucks@latest --version
   ```

3. **Temporary Workarounds:**
   ```bash
   # Use older Node.js version if compatibility issue
   nvm use 18
   
   # Skip problematic operations
   unjucks generate component react Button --skip-validation
   ```

---

This troubleshooting guide covers the most common issues and their solutions. If you encounter an issue not covered here, please refer to the [Getting Help](#getting-help) section or create an issue on GitHub.