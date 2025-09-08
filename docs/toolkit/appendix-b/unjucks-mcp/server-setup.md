# Unjucks MCP Server Setup Guide

## Overview

The Unjucks MCP (Model Context Protocol) Server provides seamless integration between Claude AI and the Unjucks code generation system. This enables AI-powered template development, intelligent code generation, and automated specification-to-code workflows.

## Prerequisites

- Node.js 18+ with npm/yarn/pnpm
- Claude Desktop app or API access
- Unjucks CLI installed globally
- Valid Anthropic API key (for programmatic access)

## Installation

### Method 1: NPM Installation (Recommended)

```bash
# Install globally
npm install -g @unjucks/mcp-server

# Or install locally in project
npm install --save-dev @unjucks/mcp-server

# Verify installation
unjucks-mcp --version
```

### Method 2: Docker Installation

```bash
# Pull the official image
docker pull unjucks/mcp-server:latest

# Run the server
docker run -d \
  --name unjucks-mcp \
  -p 3000:3000 \
  -v $(pwd)/templates:/app/templates \
  -v $(pwd)/config:/app/config \
  -e ANTHROPIC_API_KEY=your_api_key \
  unjucks/mcp-server:latest
```

### Method 3: From Source

```bash
# Clone repository
git clone https://github.com/unjucks/mcp-server.git
cd mcp-server

# Install dependencies
npm install

# Build the server
npm run build

# Start development server
npm run dev

# Or build and start production
npm run build && npm start
```

## Configuration

### MCP Server Configuration

Create `.mcp-config.json` in your project root:

```json
{
  "server": {
    "name": "unjucks-mcp",
    "version": "1.0.0",
    "port": 3000,
    "host": "localhost",
    "protocol": "stdio",
    "logging": {
      "level": "info",
      "file": "./logs/mcp-server.log"
    }
  },
  
  "unjucks": {
    "templatesDir": "./templates",
    "outputDir": "./src",
    "configFile": "./unjucks.config.ts",
    "extensions": [".njk", ".nunjucks", ".html", ".js", ".ts"],
    "filters": {
      "custom": "./filters/custom-filters.js"
    },
    "globals": {
      "projectName": "MyProject",
      "version": "1.0.0",
      "author": "Development Team"
    }
  },
  
  "claude": {
    "modelName": "claude-3-sonnet-20240229",
    "maxTokens": 4096,
    "temperature": 0.1,
    "systemPrompt": "You are an expert code generator using Unjucks templates. Generate clean, maintainable, and well-documented code following best practices."
  },
  
  "features": {
    "templateDiscovery": true,
    "codeGeneration": true,
    "specificationParsing": true,
    "testGeneration": true,
    "documentationGeneration": true,
    "aiAssistance": true
  },
  
  "security": {
    "allowedPaths": ["./templates", "./src", "./specs"],
    "blockedPaths": [".env", "node_modules"],
    "enableSandbox": true,
    "maxFileSize": "10MB"
  },
  
  "integrations": {
    "github": {
      "enabled": true,
      "webhookSecret": "${GITHUB_WEBHOOK_SECRET}"
    },
    "vscode": {
      "enabled": true,
      "extensionId": "unjucks.vscode-extension"
    }
  }
}
```

### Claude Desktop Integration

Add MCP server to Claude Desktop configuration file:

**On macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**On Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**On Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "unjucks": {
      "command": "npx",
      "args": ["@unjucks/mcp-server"],
      "env": {
        "UNJUCKS_CONFIG": "./.mcp-config.json",
        "UNJUCKS_TEMPLATES_DIR": "./templates",
        "UNJUCKS_OUTPUT_DIR": "./src"
      }
    }
  },
  "defaultModel": "claude-3-sonnet-20240229",
  "environment": {
    "ANTHROPIC_API_KEY": "your_api_key_here"
  }
}
```

### Environment Variables

Create `.env` file (add to `.gitignore`):

```bash
# Required
ANTHROPIC_API_KEY=your_claude_api_key_here

# MCP Server Configuration
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost
MCP_LOG_LEVEL=info

# Unjucks Configuration
UNJUCKS_CONFIG=./.mcp-config.json
UNJUCKS_TEMPLATES_DIR=./templates
UNJUCKS_OUTPUT_DIR=./src

# Optional: GitHub Integration
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Optional: Advanced Features
ENABLE_AI_ASSISTANCE=true
ENABLE_TEMPLATE_DISCOVERY=true
ENABLE_SPEC_PARSING=true

# Security
ALLOWED_PATHS=./templates,./src,./specs
BLOCKED_PATHS=.env,node_modules,.git
MAX_FILE_SIZE=10485760
```

## Server Startup

### Development Mode

```bash
# Start with hot reload
unjucks-mcp dev

# Start with specific config
unjucks-mcp dev --config ./.mcp-config.json

# Start with debug logging
unjucks-mcp dev --log-level debug

# Start with custom port
unjucks-mcp dev --port 3001
```

### Production Mode

```bash
# Start production server
unjucks-mcp start

# Start as daemon
unjucks-mcp start --daemon

# Start with PM2
pm2 start unjucks-mcp --name "unjucks-mcp"

# Docker production
docker-compose up -d unjucks-mcp
```

### SystemD Service (Linux)

Create `/etc/systemd/system/unjucks-mcp.service`:

```ini
[Unit]
Description=Unjucks MCP Server
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/home/node/unjucks-project
Environment=NODE_ENV=production
Environment=ANTHROPIC_API_KEY=your_api_key
ExecStart=/usr/local/bin/unjucks-mcp start --config ./.mcp-config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable unjucks-mcp
sudo systemctl start unjucks-mcp
sudo systemctl status unjucks-mcp
```

## Available MCP Tools

The Unjucks MCP server provides these tools to Claude:

### Template Management
- `list_templates` - Discover and list available templates
- `get_template` - Retrieve template content and metadata
- `validate_template` - Validate template syntax and structure
- `create_template` - Create new templates with AI assistance

### Code Generation
- `generate_code` - Generate code from templates and data
- `generate_from_spec` - Generate code from specification documents
- `batch_generate` - Generate multiple files in one operation
- `preview_generation` - Preview generated code without writing files

### Specification Processing
- `parse_specification` - Parse and extract data from spec documents
- `validate_specification` - Validate specification completeness
- `trace_requirements` - Trace requirements to implementation
- `generate_spec_report` - Generate specification compliance reports

### AI-Assisted Development
- `suggest_templates` - AI suggestions for suitable templates
- `optimize_templates` - AI-powered template optimization
- `generate_tests` - Generate test cases from specifications
- `explain_code` - AI explanations of generated code

## Testing the Setup

### Health Check

```bash
# Check server health
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "features": {
    "templateDiscovery": true,
    "codeGeneration": true,
    "aiAssistance": true
  }
}
```

### Template Discovery Test

```bash
# Test template discovery
curl http://localhost:3000/api/templates

# Test specific template
curl http://localhost:3000/api/templates/component/react
```

### Claude Integration Test

Open Claude Desktop and test these commands:

```
# Test template listing
List all available Unjucks templates

# Test code generation
Generate a React component using the "component/react" template with props: name="UserProfile", hasState=true

# Test specification parsing
Parse this requirement specification and generate corresponding code:
[paste a simple requirement]
```

## Advanced Configuration

### Custom Filters and Functions

Create `filters/custom-filters.js`:

```javascript
module.exports = {
  // Convert string to camelCase
  camelCase: (str) => {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  },
  
  // Format date for code comments
  codeDate: (date = new Date()) => {
    return date.toISOString().split('T')[0];
  },
  
  // Generate unique ID
  uniqueId: (prefix = 'id') => {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  // Pluralize words
  pluralize: (word, count = 2) => {
    if (count === 1) return word;
    if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
    if (word.endsWith('s')) return word + 'es';
    return word + 's';
  }
};
```

### Template Preprocessing

Create `preprocessors/spec-parser.js`:

```javascript
const yaml = require('yaml');

class SpecificationParser {
  static parseRequirement(content) {
    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { content, metadata: {} };
    
    const metadata = yaml.parse(match[1]);
    const body = match[2];
    
    return {
      metadata,
      content: body,
      requirements: this.extractRequirements(body),
      acceptanceCriteria: this.extractAcceptanceCriteria(body)
    };
  }
  
  static extractRequirements(content) {
    const reqRegex = /(?:^|\n)(?:REQ-\d+|Requirement|MUST|SHALL):\s*(.+?)(?=\n|$)/gi;
    const requirements = [];
    let match;
    
    while ((match = reqRegex.exec(content)) !== null) {
      requirements.push(match[1].trim());
    }
    
    return requirements;
  }
  
  static extractAcceptanceCriteria(content) {
    const criteriaRegex = /(?:^|\n)-\s*\[\s*\]\s*(.+?)(?=\n|$)/gi;
    const criteria = [];
    let match;
    
    while ((match = criteriaRegex.exec(content)) !== null) {
      criteria.push(match[1].trim());
    }
    
    return criteria;
  }
}

module.exports = SpecificationParser;
```

### Webhook Integration

Set up GitHub webhooks to trigger code generation:

```javascript
// webhook-handler.js
const express = require('express');
const crypto = require('crypto');
const { generateFromSpecs } = require('@unjucks/cli');

const app = express();
app.use(express.json());

app.post('/webhook/github', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
  
  if (!crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`, 'utf8'),
    Buffer.from(signature, 'utf8')
  )) {
    return res.status(401).send('Unauthorized');
  }
  
  // Handle push events to specs directory
  if (req.body.ref === 'refs/heads/main' && 
      req.body.commits.some(c => c.added.concat(c.modified).some(f => f.startsWith('specs/')))) {
    
    // Trigger code generation
    generateFromSpecs({
      specsDir: './specs',
      outputDir: './src',
      templatesDir: './templates'
    }).then(() => {
      console.log('Code generation completed');
    }).catch(err => {
      console.error('Code generation failed:', err);
    });
  }
  
  res.status(200).send('OK');
});

app.listen(3001, () => {
  console.log('Webhook handler listening on port 3001');
});
```

## Monitoring and Logging

### Log Configuration

Update `.mcp-config.json`:

```json
{
  "logging": {
    "level": "info",
    "file": "./logs/mcp-server.log",
    "format": "json",
    "maxSize": "10MB",
    "maxFiles": 5,
    "colorize": true,
    "timestamp": true
  }
}
```

### Monitoring Dashboard

Access the built-in monitoring dashboard at `http://localhost:3000/dashboard`:

- Server health and uptime
- Template usage statistics
- Code generation metrics
- Error rates and performance
- AI assistance usage

### Metrics Collection

Enable metrics collection:

```bash
# Install metrics dependencies
npm install prometheus-client

# Start with metrics enabled
unjucks-mcp start --enable-metrics

# View metrics
curl http://localhost:3000/metrics
```

## Troubleshooting

### Common Issues

#### Issue: MCP Server Won't Start
```bash
# Check port availability
lsof -i :3000

# Check configuration
unjucks-mcp validate-config .mcp-config.json

# Start with verbose logging
unjucks-mcp start --log-level debug
```

#### Issue: Claude Can't Connect to Server
```bash
# Verify Claude Desktop config
cat ~/.config/claude/claude_desktop_config.json

# Test MCP connection
unjucks-mcp test-mcp-connection

# Restart Claude Desktop
killall Claude && open -a Claude
```

#### Issue: Template Generation Fails
```bash
# Validate templates
unjucks-mcp validate-templates ./templates

# Test generation with debug
unjucks-mcp generate --debug --dry-run template-name
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Start with full debugging
DEBUG=unjucks:* unjucks-mcp start --log-level debug

# Check logs
tail -f ./logs/mcp-server.log

# Monitor real-time activity
unjucks-mcp monitor --real-time
```

## Next Steps

1. **Configure Templates**: Set up your first templates directory
2. **Test Integration**: Verify Claude can communicate with the server
3. **Create Workflows**: Set up automated generation workflows
4. **Monitor Usage**: Set up logging and monitoring
5. **Advanced Features**: Explore AI-assisted development features

For additional configuration options, see the [advanced configuration guide](./advanced-config.md) or refer to the [API documentation](./api-reference.md).