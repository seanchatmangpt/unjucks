# KGEN Explore Command - Persona-Driven JSON Views

## Overview

The KGEN Explore command provides persona-driven marketplace exploration with tailored insights for different user types. It generates static JSON outputs suitable for GitHub Pages hosting with integrated marketplace links.

## Implementation Details

### 🏗️ Architecture

```
packages/kgen-cli/src/commands/explore/
├── index.js                    # Main command entry point
├── execute-view.js            # View execution logic
├── list-views.js              # View listing functionality
├── metrics.js                 # Aggregated metrics
└── views/                     # Persona-specific view generators
    ├── executive.ts           # C-level executive view (TypeScript)
    ├── architect.ts           # Solution architect view (TypeScript)
    └── developer.ts           # Software developer view (TypeScript)
```

### 📊 Supported Personas

#### 1. Executive View (`executive.ts`)
**Target Audience**: C-level executives, business decision makers

**Key Features**:
- **Portfolio Summaries**: Total packs installed, active projects, category breakdown
- **ROI Deltas**: Monthly ROI, cost savings, payback periods, revenue impact
- **Compliance Coverage**: SOC 2, GDPR, HIPAA, ISO 27001 with percentage scores
- **Risk Assessment**: Overall risk levels with mitigation strategies
- **Business KPIs**: Development velocity, time-to-market, cost efficiency

**Sample Output**:
```json
{
  \"viewType\": \"executive\",
  \"summary\": {
    \"totalPacksInstalled\": 127,
    \"monthlyROI\": 156789,
    \"complianceScore\": 87,
    \"riskLevel\": \"medium\"
  },
  \"compliance\": {
    \"frameworks\": [
      {
        \"name\": \"SOC 2 Type II\",
        \"coverage\": 94,
        \"status\": \"compliant\"
      }
    ]
  },
  \"marketplaceLinks\": {
    \"recommendations\": [
      {
        \"name\": \"kgen-security-hardening\",
        \"url\": \"https://marketplace.kgen.dev/packages/security-hardening\",
        \"potentialROI\": 145000
      }
    ]
  }
}
```

#### 2. Architect View (`architect.ts`)
**Target Audience**: Solution architects, technical leads, system designers

**Key Features**:
- **Dependency Graphs**: Node relationships, critical paths, cycles, conflicts
- **Trust Policy Diffs**: Current vs proposed policies with impact analysis
- **Performance Benchmarks**: Response times, bottlenecks, optimization targets
- **Architectural Patterns**: Microservices, API Gateway, best practices
- **Technical Debt**: Assessment levels and remediation recommendations

**Sample Output**:
```json
{
  \"viewType\": \"architect\",
  \"dependencies\": {
    \"criticalPaths\": [
      {
        \"path\": [\"kgen-users\", \"kgen-auth\", \"kgen-api-core\"],
        \"risk\": \"medium\",
        \"impact\": 7.8
      }
    ]
  },
  \"trustPolicies\": {
    \"diffs\": [
      {
        \"policy\": \"minimumTrustScore\",
        \"current\": 80,
        \"proposed\": 85,
        \"impact\": \"medium\",
        \"recommendation\": \"Implement gradually over 30 days\"
      }
    ]
  },
  \"performance\": {
    \"benchmarks\": [
      {
        \"metric\": \"API Response Time\",
        \"value\": 245,
        \"target\": 200,
        \"trend\": \"improving\"
      }
    ]
  }
}
```

#### 3. Developer View (`developer.ts`)
**Target Audience**: Software developers, engineers, implementers

**Key Features**:
- **Install Commands**: npm, yarn, pnpm, bun with verification steps
- **API Contracts**: OpenAPI specs, authentication, rate limits, SDKs
- **Code Examples**: JavaScript, TypeScript, Python with marketplace links
- **Quickstart Guides**: Step-by-step tutorials with troubleshooting
- **Developer Tools**: CLI, IDE extensions, testing frameworks, CI/CD

**Sample Output**:
```json
{
  \"viewType\": \"developer\",
  \"installation\": {
    \"commands\": [
      {
        \"manager\": \"npm\",
        \"command\": \"npm install -g @kgen/cli\",
        \"verification\": \"kgen --version\"
      }
    ]
  },
  \"apis\": {
    \"contracts\": [
      {
        \"name\": \"KGEN API\",
        \"baseUrl\": \"https://api.kgen.dev/v2\",
        \"authentication\": {
          \"type\": \"bearer\"
        }
      }
    ]
  },
  \"examples\": {
    \"featured\": [
      {
        \"title\": \"Basic Package Installation\",
        \"language\": \"javascript\",
        \"marketplaceUrl\": \"https://marketplace.kgen.dev/packages/api-scaffold\"
      }
    ]
  }
}
```

## 🚀 Usage Examples

### Command Line Interface

```bash
# List available views
kgen explore list-views

# Generate executive summary
kgen explore execute-view --persona executive --depth summary

# Generate detailed architect view to file
kgen explore execute-view --persona architect --depth detailed --output architect-detailed.json

# Generate comprehensive developer view with filtering
kgen explore execute-view --persona developer --depth comprehensive --filter api-services

# Show aggregated metrics
kgen explore metrics
```

### Available Options

| Option | Values | Description |
|--------|--------|-------------|
| `--persona` | `executive`, `architect`, `developer` | Target persona for the view |
| `--depth` | `summary`, `detailed`, `comprehensive` | Analysis depth level |
| `--format` | `json`, `yaml`, `table` | Output format |
| `--filter` | String | Filter by category, tag, or pattern |
| `--output` | Path | Output file path |

## 🌐 GitHub Pages Integration

### Static JSON Generation

Use the provided script to generate static JSON files for GitHub Pages hosting:

```bash
# Generate all static views
node scripts/generate-static-views.js
```

This creates the following structure:
```
docs/
├── api/
│   ├── index.json              # API index with all views
│   ├── config.json             # GitHub Pages configuration
│   └── views/                  # Static view files
│       ├── executive-summary.json
│       ├── executive-detailed.json
│       ├── executive-comprehensive.json
│       ├── architect-summary.json
│       ├── architect-detailed.json
│       ├── architect-comprehensive.json
│       ├── developer-summary.json
│       ├── developer-detailed.json
│       └── developer-comprehensive.json
```

### GitHub Pages Setup

1. **Commit the docs/ directory** to your repository
2. **Enable GitHub Pages** in repository settings
3. **Set source** to \"Deploy from a branch\" and select \"main\" branch \"/docs\" folder
4. **Access your API** at: `https://yourusername.github.io/yourrepo/api/index.json`

### API Endpoints

Once hosted on GitHub Pages, the following endpoints will be available:

```
# API Index
GET /api/index.json

# Persona Views
GET /api/views/executive-summary.json
GET /api/views/executive-detailed.json
GET /api/views/executive-comprehensive.json
GET /api/views/architect-summary.json
GET /api/views/architect-detailed.json
GET /api/views/architect-comprehensive.json
GET /api/views/developer-summary.json
GET /api/views/developer-detailed.json
GET /api/views/developer-comprehensive.json

# Configuration
GET /api/config.json
```

## 🔧 Development

### TypeScript Interfaces

Each view generator exports comprehensive TypeScript interfaces:

```typescript
// Executive View
interface ExecutiveViewData {
  viewType: 'executive';
  summary: {
    totalPacksInstalled: number;
    monthlyROI: number;
    complianceScore: number;
  };
  marketplaceLinks: {
    recommendations: Array<{
      name: string;
      url: string;
      potentialROI: number;
    }>;
  };
}

// Architect View
interface ArchitectViewData {
  viewType: 'architect';
  dependencies: DependencyGraph;
  trustPolicies: {
    diffs: TrustPolicyDiff[];
  };
  performance: {
    benchmarks: PerformanceBenchmark[];
  };
}

// Developer View
interface DeveloperViewData {
  viewType: 'developer';
  installation: {
    commands: InstallCommand[];
  };
  apis: {
    contracts: APIContract[];
  };
  examples: {
    featured: CodeExample[];
  };
}
```

### Extending Views

To add new personas or modify existing views:

1. **Create new view generator** in `packages/kgen-cli/src/commands/explore/views/`
2. **Implement the required interface** with `generate()` method
3. **Update the main command** in `index.js` to include the new persona
4. **Add marketplace links** and GitHub Pages support

### Testing

```bash
# Test individual views
node bin/kgen explore execute-view --persona executive --depth summary

# Test static generation
node scripts/generate-static-views.js

# Verify JSON output
cat docs/api/views/executive-summary.json | jq .
```

## 📝 Schema Definitions

Each view follows a consistent schema format:

- **Schema**: `kmkt:ExecutiveView`, `kmkt:ArchitectView`, `kmkt:DeveloperView`
- **Version**: `2.0.0`
- **Metadata**: Generated timestamp, GitHub Pages readiness flag
- **Marketplace Integration**: Direct links to packages and solutions

## 🎯 Key Benefits

1. **Persona-Driven**: Tailored insights for different user roles
2. **Static Hosting**: GitHub Pages ready JSON outputs
3. **Marketplace Integration**: Direct links to relevant packages
4. **TypeScript Support**: Full type safety and IntelliSense
5. **Extensible**: Easy to add new personas and views
6. **Performance**: Fast JSON API responses
7. **Standards Compliant**: Follows JSON schema best practices

## 🔮 Future Enhancements

- **Real-time Data**: Integration with live marketplace APIs
- **Customizable Views**: User-defined persona configurations
- **Interactive Dashboards**: Web UI for exploring views
- **Caching Layer**: Redis/CDN integration for better performance
- **Analytics**: Usage tracking and view optimization
- **Internationalization**: Multi-language support