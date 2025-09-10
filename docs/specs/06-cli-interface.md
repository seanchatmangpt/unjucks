# CLI Interface Specifications

## 6. Command Line Interface

### 6.1 Command Structure

```bash
unjucks [global-options] <command> [command-options] [arguments]
```

### 6.2 Global Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--version` | Boolean | Display version information | false |
| `--help` | Boolean | Show help information | false |

### 6.3 Commands Specification

#### 6.3.1 Main Command (Default)

**Purpose**: Display help and available commands when no subcommand is provided

**Syntax**: 
```bash
unjucks [--version|--help]
```

**Behavior**:
- Without flags: Shows help information and available commands
- With `--version`: Displays version number (currently "1.0.0")
- With `--help`: Shows detailed usage information and examples

**Exit Codes**:
- 0: Success (help displayed)

#### 6.3.2 generate Command

**Purpose**: Generate files from templates using specified generators

**Syntax**: 
```bash
unjucks generate [generator] [template] [options]
```

**Positional Arguments**:
- `generator` (optional): Name of the generator to use
- `template` (optional): Name of the template to generate

**Options**:
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--dest` | String | Destination directory for generated files | "." |
| `--force` | Boolean | Overwrite existing files without prompting | false |
| `--dry` | Boolean | Show what would be generated without creating files | false |

**Interactive Mode**:
- If no generator specified: Prompts user to select from available generators
- If no template specified: Prompts user to select from available templates for chosen generator

**Examples**:
```bash
unjucks generate component citty --name MyComponent
unjucks generate api endpoint users --dest ./api --force
unjucks generate database migration --dry
```

**Exit Codes**:
- 0: Success
- 1: Generation error (missing generator, template not found, file system errors)

#### 6.3.3 list Command

**Purpose**: List available generators and templates

**Syntax**: 
```bash
unjucks list [generator]
```

**Positional Arguments**:
- `generator` (optional): Name of generator to list templates for

**Behavior**:
- Without generator: Lists all available generators with their templates
- With generator: Lists templates for the specified generator only

**Output Format**:
```
Available generators:
  • component
    Description text if available
    Templates: react, vue, angular

  • api
    Description text if available  
    Templates: endpoint, middleware
```

**Examples**:
```bash
unjucks list                    # List all generators
unjucks list component          # List templates for component generator
```

**Exit Codes**:
- 0: Success
- 1: Error accessing generator directory or invalid generator name

#### 6.3.4 init Command

**Purpose**: Initialize a new project with generators and project structure

**Syntax**: 
```bash
unjucks init [type] [options]
```

**Positional Arguments**:
- `type` (optional): Type of project to initialize

**Options**:
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--dest` | String | Destination directory for the project | "." |

**Interactive Mode**:
- If no type specified: Prompts user to select project type

**Examples**:
```bash
unjucks init                    # Interactive mode
unjucks init react-app --dest ./my-app
```

**Exit Codes**:
- 0: Success
- 1: Initialization error

#### 6.3.5 version Command

**Purpose**: Show detailed version information

**Syntax**: 
```bash
unjucks version
```

**Output**:
```
Unjucks CLI
Version: 0.0.0
A Hygen-style CLI generator for creating templates and scaffolding projects
```

**Exit Codes**:
- 0: Success

#### 6.3.6 help Command

**Purpose**: Show template variable help for specific generators and templates

**Syntax**: 
```bash
unjucks help [generator] [template]
```

**Positional Arguments**:
- `generator` (optional): Generator name for specific help
- `template` (optional): Template name for specific help

**Behavior**:
- Without arguments: Shows general template help information
- With generator/template: Shows specific template variables and usage

**Examples**:
```bash
unjucks help                    # General help
unjucks help component          # Generator help
unjucks help component react    # Template-specific help
```

**Exit Codes**:
- 0: Success

### 6.4 Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | Command completed successfully |
| 1 | General Error | File system error, template not found, generation failed |
| 2 | Invalid Arguments | Invalid command arguments or missing required parameters |
| 3 | Template Not Found | Specified generator or template does not exist |

### 6.5 Error Handling

#### Common Error Scenarios

1. **Template Not Found**
   ```bash
   $ unjucks generate nonexistent template
   Error generating files: [error details]
   # Exit code: 1
   ```

2. **Invalid Generator**
   ```bash
   $ unjucks list nonexistent
   Error listing generators: [error details]  
   # Exit code: 1
   ```

3. **File System Permissions**
   ```bash
   $ unjucks generate component react --dest /protected
   Error generating files: [permission error]
   # Exit code: 1
   ```

### 6.6 Configuration Files

The CLI supports configuration through:
- Command-line arguments (highest priority)
- Environment variables
- Configuration files (lowest priority)

### 6.7 Output Formatting

#### Standard Output
- **Success messages**: Green text with checkmark (✅)
- **Information**: Blue text for headers and important info
- **File listings**: Green text for generated files with "+" prefix
- **Dry run**: Yellow text indicating no files were created

#### Progress Indicators
- Uses `ora` spinner for long-running operations
- Shows "Generating files..." during generation
- Shows "Initializing project..." during initialization

#### Error Output
- **Error messages**: Red text with "Error" prefix
- Sent to stderr for proper shell integration
- Include helpful context and suggestions when possible

### 6.8 Shell Integration

#### Completion Support
Currently not implemented but planned for future versions.

#### Exit Code Standards
Follows POSIX standards for shell integration:
- 0 = success
- 1-255 = various error conditions

### 6.9 Accessibility

- **Color support detection**: Gracefully handles terminals without color support
- **Clear text**: All output remains readable without color
- **Consistent formatting**: Predictable output format for screen readers

### 6.10 Future Command Extensions

The CLI architecture supports additional commands that may be added:

- `unjucks new` - Alias for generate
- `unjucks preview` - Preview template without generation
- `unjucks validate` - Validate templates
- `unjucks config` - Configuration management
- `unjucks update` - Update generators and templates

### 6.11 CLI Framework

Built using:
- **citty**: Modern CLI framework for argument parsing and command definition
- **chalk**: Terminal color support
- **ora**: Progress spinners
- **inquirer**: Interactive prompts

### 6.12 Binary Distribution

The CLI is distributed via:
- **Main entry**: `bin/unjucks-standalone.cjs` (CommonJS for compatibility)
- **ES Module support**: `src/cli/index.js`
- **Global installation**: `npm install -g @seanchatmangpt/unjucks`

This specification ensures consistent behavior across all CLI operations and provides a foundation for testing and documentation.