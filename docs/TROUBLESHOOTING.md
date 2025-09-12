# KGEN Troubleshooting Guide

Common issues, solutions, and debugging strategies for KGEN.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Template Errors](#template-errors)
- [Graph Processing Issues](#graph-processing-issues)
- [Generation Failures](#generation-failures)
- [Drift Detection Problems](#drift-detection-problems)
- [Performance Issues](#performance-issues)
- [Debugging Techniques](#debugging-techniques)

---

## Installation Issues

### Error: Command not found

**Problem**: `kgen: command not found`

**Solutions**:
1. **Make executable**:
   ```bash
   chmod +x bin/kgen.mjs
   ```

2. **Use relative path**:
   ```bash
   ./bin/kgen.mjs --help
   ```

3. **Add to PATH**:
   ```bash
   export PATH="$PATH:/path/to/kgen/bin"
   ```

4. **Create symlink**:
   ```bash
   ln -s /full/path/to/kgen/bin/kgen.mjs /usr/local/bin/kgen
   ```

### Node.js Version Issues

**Problem**: `Error: Unexpected token 'import'`

**Solution**: Ensure Node.js version >= 18.0.0:
```bash
node --version
nvm use 18  # if using nvm
```

### Permission Errors

**Problem**: `EACCES: permission denied`

**Solutions**:
1. **Check file permissions**:
   ```bash
   ls -la bin/kgen.mjs
   chmod 755 bin/kgen.mjs
   ```

2. **Run with appropriate permissions**:
   ```bash
   sudo ./bin/kgen.mjs  # Only if necessary
   ```

---

## Configuration Problems

### Configuration Not Found

**Problem**: `Could not load kgen.config.js`

**Solutions**:
1. **Create default configuration**:
   ```javascript
   // kgen.config.js
   export default {
     directories: {
       out: './generated',
       templates: '_templates'
     }
   };
   ```

2. **Specify config path**:
   ```bash
   kgen --config ./custom-config.js artifact generate
   ```

3. **Use environment variables**:
   ```bash
   export KGEN_CONFIG_PATH=./config/kgen.config.js
   ```

### Invalid Configuration

**Problem**: `Configuration validation failed`

**Debug Steps**:
1. **Enable debug mode**:
   ```bash
   kgen --debug --verbose templates ls
   ```

2. **Validate JavaScript syntax**:
   ```bash
   node -c kgen.config.js
   ```

3. **Check configuration schema**:
   ```javascript
   // Valid structure
   export default {
     directories: { /* string values */ },
     generate: { /* generation options */ },
     drift: { /* drift detection options */ }
   };
   ```

### Template Directory Issues

**Problem**: `Templates directory not found: _templates`

**Solutions**:
1. **Create directory**:
   ```bash
   mkdir -p _templates
   ```

2. **Update configuration**:
   ```javascript
   export default {
     directories: {
       templates: './custom-templates'
     }
   };
   ```

3. **Check current working directory**:
   ```bash
   pwd
   ls -la _templates/
   ```

---

## Template Errors

### Template Not Found

**Problem**: `Template not found: api-service`

**Debug Steps**:
1. **List available templates**:
   ```bash
   kgen templates ls
   ```

2. **Check template file exists**:
   ```bash
   ls -la _templates/api-service.njk
   ls -la _templates/api-service.j2
   ```

3. **Use absolute path**:
   ```bash
   kgen templates show /full/path/to/_templates/api-service
   ```

### Template Syntax Errors

**Problem**: `Error: unexpected token in template`

**Debug Steps**:
1. **Validate Nunjucks syntax**:
   ```bash
   kgen deterministic validate _templates/api-service.njk
   ```

2. **Common syntax issues**:
   ```nunjucks
   <!-- Wrong: Missing endif -->
   {% if condition %}
   Content
   
   <!-- Correct: Proper closing -->
   {% if condition %}
   Content
   {% endif %}
   
   <!-- Wrong: Invalid variable reference -->
   {{ undefined.property }}
   
   <!-- Correct: Safe property access -->
   {{ data.property if data else 'default' }}
   ```

3. **Check frontmatter YAML**:
   ```yaml
   ---
   to: "output.js"      # Correct: quoted strings
   inject: true         # Correct: boolean
   skipIf: false        # Correct: boolean
   ---
   ```

### Variable Resolution Issues

**Problem**: `ReferenceError: variable is not defined`

**Solutions**:
1. **Check available variables**:
   ```bash
   kgen templates show api-service --verbose
   ```

2. **Provide context**:
   ```bash
   kgen deterministic render template.njk -c '{"service": {"name": "Users"}}'
   ```

3. **Debug template variables**:
   ```nunjucks
   <!-- Add debug output -->
   <!-- DEBUG: {{ graph | jsonify }} -->
   <!-- Available vars: {{ Object.keys(this) }} -->
   ```

### Frontmatter Problems

**Problem**: `Invalid frontmatter configuration`

**Common Issues**:
```yaml
# Wrong: Invalid YAML syntax
---
to: output.js        # Missing quotes for complex expressions
inject true          # Missing colon
skipIf: {{ expr }}   # Template expressions not allowed in frontmatter
---

# Correct: Valid frontmatter
---
to: "{{ graph.name | lower }}-service.js"
inject: true
skipIf: "{{ graph.type !== 'Service' }}"
---
```

---

## Graph Processing Issues

### RDF Parsing Errors

**Problem**: `Error parsing RDF graph: Invalid syntax`

**Debug Steps**:
1. **Validate RDF syntax**:
   ```bash
   kgen validate graph schema.ttl
   ```

2. **Check common Turtle syntax errors**:
   ```turtle
   # Wrong: Missing prefix declaration
   ex:Person a owl:Class .
   
   # Correct: Declare prefix first
   @prefix ex: <http://example.org/> .
   @prefix owl: <http://www.w3.org/2002/07/owl#> .
   ex:Person a owl:Class .
   
   # Wrong: Missing closing quotes
   ex:name "John Smith .
   
   # Correct: Proper string literal
   ex:name "John Smith" .
   ```

3. **Use RDF validator tools**:
   ```bash
   # Online: http://www.w3.org/RDF/Validator/
   # Command line: rapper (from raptor-utils)
   rapper -i turtle -o ntriples schema.ttl
   ```

### Empty Graph Results

**Problem**: `Graph index shows 0 triples`

**Solutions**:
1. **Check file encoding**:
   ```bash
   file schema.ttl
   head -c 100 schema.ttl | od -c  # Check for BOM or special characters
   ```

2. **Verify file content**:
   ```bash
   cat schema.ttl | grep -v '^#' | grep -v '^$'  # Show non-comment lines
   ```

3. **Test with minimal graph**:
   ```turtle
   @prefix ex: <http://example.org/> .
   ex:test ex:property "value" .
   ```

### Namespace Issues

**Problem**: `Unknown prefix: api`

**Solutions**:
1. **Declare all prefixes**:
   ```turtle
   @prefix api: <http://api.example.org/> .
   @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
   @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
   ```

2. **Use full URIs as fallback**:
   ```turtle
   <http://api.example.org/User> a <http://api.example.org/Entity> .
   ```

---

## Generation Failures

### Output Directory Issues

**Problem**: `ENOENT: no such file or directory, open './generated/service.js'`

**Solutions**:
1. **Create output directory**:
   ```bash
   mkdir -p ./generated
   ```

2. **Check permissions**:
   ```bash
   ls -ld ./generated
   chmod 755 ./generated
   ```

3. **Use absolute paths**:
   ```bash
   kgen artifact generate -g schema.ttl -t api-service -o /full/path/to/output
   ```

### Context Processing Errors

**Problem**: `Cannot read property of undefined`

**Debug Steps**:
1. **Enable debug mode**:
   ```bash
   kgen --debug artifact generate -g schema.ttl -t api-service
   ```

2. **Check graph processing**:
   ```bash
   kgen graph index schema.ttl
   ```

3. **Validate template with minimal context**:
   ```bash
   kgen deterministic render template.njk -c '{}'
   ```

### Attestation Failures

**Problem**: `Failed to generate attestation`

**Solutions**:
1. **Check disk space**:
   ```bash
   df -h
   ```

2. **Verify file permissions**:
   ```bash
   ls -la ./generated/*.attest.json
   ```

3. **Disable attestations temporarily**:
   ```javascript
   // kgen.config.js
   export default {
     generate: {
       attestByDefault: false
     }
   };
   ```

---

## Drift Detection Problems

### False Positive Drift

**Problem**: `Drift detected` when no changes made

**Causes & Solutions**:
1. **Timestamp variations**:
   ```javascript
   // Use static build time
   export default {
     generate: {
       staticBuildTime: '2024-01-01T00:00:00.000Z'
     }
   };
   ```

2. **File modification times**:
   ```bash
   touch ./generated/service.js  # Updates mtime
   ```

3. **Environment differences**:
   ```bash
   # Check Node.js version consistency
   node --version
   
   # Check platform differences
   uname -a
   ```

### Drift Not Detected

**Problem**: Changes not detected by drift system

**Debug Steps**:
1. **Manual comparison**:
   ```bash
   diff -u ./generated/service.js.backup ./generated/service.js
   ```

2. **Check baseline files**:
   ```bash
   ls -la .kgen/state/
   cat .kgen/state/baseline.json
   ```

3. **Regenerate baseline**:
   ```bash
   kgen project lock .
   ```

### Exit Code Issues

**Problem**: CI/CD not failing on drift

**Solutions**:
1. **Check exit code configuration**:
   ```javascript
   export default {
     drift: {
       onDrift: 'fail',    // 'warn', 'fail', 'ignore'
       exitCode: 3         // Custom exit code
     }
   };
   ```

2. **Test exit codes**:
   ```bash
   kgen artifact drift ./generated
   echo $?  # Should be 3 if drift detected
   ```

---

## Performance Issues

### Slow Generation

**Problem**: `Generation takes several minutes`

**Solutions**:
1. **Enable caching**:
   ```javascript
   export default {
     cache: {
       enabled: true,
       maxSize: '100MB',
       ttl: 3600000  // 1 hour
     }
   };
   ```

2. **Optimize templates**:
   ```nunjucks
   <!-- Avoid complex loops -->
   {% for item in largeArray %}  <!-- Slow -->
   
   <!-- Use filters instead -->
   {{ largeArray | slice(0, 10) }}  <!-- Faster -->
   ```

3. **Profile performance**:
   ```bash
   time kgen --debug artifact generate -g schema.ttl -t api-service
   ```

### Memory Issues

**Problem**: `JavaScript heap out of memory`

**Solutions**:
1. **Increase Node.js memory**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" kgen artifact generate
   ```

2. **Process in batches**:
   ```bash
   # Split large graphs
   for file in small-*.ttl; do
     kgen artifact generate -g "$file" -t template
   done
   ```

3. **Configure memory limits**:
   ```javascript
   export default {
     security: {
       maxMemory: '2GB'
     }
   };
   ```

### Cache Issues

**Problem**: `Cache not improving performance`

**Debug Steps**:
1. **Check cache statistics**:
   ```bash
   kgen cache status
   ```

2. **Clear cache**:
   ```bash
   kgen cache clear
   ```

3. **Verify cache directory**:
   ```bash
   ls -la .kgen/cache/
   du -sh .kgen/cache/
   ```

---

## Debugging Techniques

### Enable Debug Mode

**Always start debugging with**:
```bash
kgen --debug --verbose <command>
```

This provides:
- Step-by-step execution logging
- Configuration details
- Performance metrics
- Error stack traces

### Incremental Testing

1. **Test components separately**:
   ```bash
   # Test graph processing
   kgen graph hash schema.ttl
   
   # Test template syntax
   kgen deterministic validate template.njk
   
   # Test simple generation
   kgen deterministic render template.njk -c '{}'
   ```

2. **Use minimal examples**:
   ```turtle
   # Minimal test graph
   @prefix ex: <http://example.org/> .
   ex:test a ex:Thing ;
       ex:name "Test" .
   ```

   ```nunjucks
   <!-- Minimal template -->
   ---
   to: "test.txt"
   ---
   Hello {{ test.name or 'World' }}!
   ```

### Log Analysis

**Check log files**:
```bash
# System logs
tail -f /var/log/kgen.log

# Debug output
kgen --debug command 2>&1 | tee debug.log

# JSON output analysis
kgen command | jq .
```

### Configuration Validation

**Test configuration loading**:
```bash
# Test config syntax
node -e "console.log(JSON.stringify(require('./kgen.config.js'), null, 2))"

# Test config with KGEN
kgen --debug templates ls  # Shows loaded config
```

### Template Debugging

**Add debug output to templates**:
```nunjucks
---
to: "debug-output.txt"
---
<!-- DEBUG INFORMATION -->
Graph path: {{ graph.path }}
Graph hash: {{ graph.hash }}
Available properties: {{ Object.keys(this) | join(', ') }}

{% if graph %}
Graph data: {{ graph | jsonify }}
{% else %}
ERROR: No graph data available
{% endif %}

<!-- END DEBUG -->
```

### Network and File System

**Check file system issues**:
```bash
# Check disk space
df -h

# Check file permissions
ls -la kgen.config.js _templates/ generated/

# Check file locks (Linux/Mac)
lsof | grep kgen

# Check network (if using remote resources)
ping api.example.org
curl -I http://api.example.org/schema.ttl
```

### Error Recovery

**Common recovery steps**:
1. **Clean slate approach**:
   ```bash
   # Remove generated files
   rm -rf ./generated/*
   
   # Clear cache
   rm -rf .kgen/cache/*
   
   # Regenerate
   kgen artifact generate -g schema.ttl -t template
   ```

2. **Rollback to working state**:
   ```bash
   # Restore from backup
   cp schema.ttl.backup schema.ttl
   
   # Use known good configuration
   cp kgen.config.js.backup kgen.config.js
   ```

3. **Test with defaults**:
   ```bash
   # Ignore custom config
   mv kgen.config.js kgen.config.js.backup
   
   # Use built-in defaults
   kgen artifact generate -g schema.ttl -t template
   ```

## Getting Help

If troubleshooting doesn't resolve your issue:

1. **Check the documentation**:
   - [CLI Reference](CLI_REFERENCE.md) - Complete command syntax
   - [Examples](EXAMPLES.md) - Working examples

2. **Enable debug mode**:
   ```bash
   kgen --debug --verbose <command> 2>&1 | tee debug.log
   ```

3. **Create minimal reproduction**:
   - Simple RDF graph
   - Basic template  
   - Full command with output

4. **Gather system information**:
   ```bash
   node --version
   npm --version
   kgen --version  # If implemented
   uname -a
   ```

5. **File an issue** with:
   - Debug output
   - Minimal reproduction case
   - System information
   - Expected vs actual behavior