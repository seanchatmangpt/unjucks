# KGEN Validation Engine

## Overview

The KGEN Validation Engine is a comprehensive validation system designed to eliminate state drift and ensure data quality through SHACL validation, drift detection, and CI/CD integration.

## Key Features

### 🔍 Comprehensive Validation
- **SHACL Validation**: Full SHACL shapes validation with enhanced error reporting
- **OWL Constraints**: Support for OWL constraint checking
- **Custom Rules**: Extensible custom validation rules system
- **Parallel Processing**: Concurrent validation for improved performance

### 🔄 Drift Detection
- **Baseline Management**: Automatic baseline creation and comparison
- **Similarity Scoring**: Configurable drift tolerance levels
- **Auto-Fix Capabilities**: Intelligent drift correction with backup
- **Change Tracking**: Detailed difference reporting

### 🚀 CI/CD Integration
- **Exit Codes**: Proper exit codes for build pipeline integration
- **Reporting**: JSON and text reports with comprehensive metrics
- **Performance Monitoring**: Validation timing and statistics
- **Failure Handling**: Graceful error handling and recovery

### 📊 Compliance Validation
- **GDPR**: General Data Protection Regulation compliance
- **HIPAA**: Health Insurance Portability and Accountability Act
- **SOX**: Sarbanes-Oxley Act financial compliance
- **ISO 27001**: Information Security Management

## Installation

```bash
# Install the validation engine
npm install @kgen/validation

# Or use directly from source
cd packages/kgen-core/src/validation
npm install
```

## Usage

### Command Line Interface

```bash
# Basic SHACL validation
kgen-validate validate --data data.ttl --shapes shapes.ttl

# Validation with drift detection
kgen-validate validate --data data.ttl --shapes shapes.ttl --target /path/to/file --expected expected.ttl

# Drift detection only
kgen-validate drift --target /path/to/file --expected expected.ttl --auto-fix

# Baseline management
kgen-validate baseline create --target /path/to/file
kgen-validate baseline list
kgen-validate baseline clear

# Report management
kgen-validate report list
kgen-validate report view --report-id 12345678
kgen-validate report cleanup --days 30
```

### Programmatic API

```javascript
import { KGenValidationEngine } from '@kgen/validation';

// Initialize engine
const engine = new KGenValidationEngine({
  reporting: { outputPath: './reports' },
  driftDetection: { enabled: true, autoFix: false },
  validation: { strictMode: true }
});

await engine.initialize();

// Run comprehensive validation
const result = await engine.validateWithDriftDetection({
  dataGraph: dataContent,
  shapesGraph: shapesContent,
  targetPath: './data/current.ttl',
  expectedData: expectedContent
});

console.log(`Validation ${result.exitCode === 0 ? 'passed' : 'failed'}`);
console.log(`Report: ${result.reportPath}`);

await engine.shutdown();
```

## Configuration

### Default Configuration

```json
{
  "exitCodes": {
    "success": 0,
    "warnings": 0,
    "violations": 3,
    "errors": 1
  },
  "driftDetection": {
    "enabled": true,
    "autoFix": false,
    "tolerance": 0.95
  },
  "validation": {
    "strictMode": false,
    "parallelValidation": true,
    "checkOWLConstraints": true
  },
  "reporting": {
    "format": "json",
    "outputPath": "./validation-reports",
    "includeStatistics": true,
    "timestamped": true
  }
}
```

### Environment Variables

- `KGEN_VALIDATION_OUTPUT_DIR`: Override report output directory
- `KGEN_VALIDATION_STRICT_MODE`: Enable strict validation mode
- `KGEN_VALIDATION_AUTO_FIX`: Enable automatic drift fixing
- `KGEN_VALIDATION_TOLERANCE`: Set drift detection tolerance (0.0-1.0)

## Exit Codes

The validation engine uses specific exit codes for CI/CD integration:

- **0**: Success or warnings only
- **1**: System errors (configuration, file access, etc.)
- **3**: Validation violations detected

## Compliance Frameworks

### GDPR (General Data Protection Regulation)
- Legal basis validation
- Consent management
- Data subject rights
- Retention period compliance
- Data minimization principles

### HIPAA (Health Insurance Portability and Accountability Act)
- PHI encryption requirements
- Access control validation
- Audit logging compliance
- Minimum necessary standard

### SOX (Sarbanes-Oxley Act)
- Financial record integrity
- Audit trail requirements
- Retention period compliance
- Internal control validation

### ISO 27001 (Information Security Management)
- Information asset classification
- Access control policies
- Risk assessment validation
- Security control implementation

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:engine
npm run test:cli
npm run test:integration

# Run compliance tests
npm run test:compliance
```

## Performance

The validation engine is optimized for performance:

- **Caching**: SHACL validators are cached for reuse
- **Parallel Processing**: Multiple validations run concurrently
- **Memory Management**: Efficient memory usage for large datasets
- **Timeout Protection**: Configurable timeouts prevent hanging

### Benchmarks

- **Small datasets** (< 1000 triples): < 100ms
- **Medium datasets** (1K-100K triples): < 5s
- **Large datasets** (> 100K triples): < 30s

## Integration Examples

### GitHub Actions

```yaml
name: Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install KGEN Validation
        run: npm install -g @kgen/validation
      
      - name: Run Validation
        run: |
          kgen-validate validate \
            --data ./data/current.ttl \
            --shapes ./schemas/compliance.ttl \
            --output-dir ./reports \
            --exit-on-violations
      
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: validation-reports
          path: ./reports/
```

### Docker

```dockerfile
FROM node:18-alpine

RUN npm install -g @kgen/validation

COPY data/ /data/
COPY schemas/ /schemas/

ENTRYPOINT ["kgen-validate"]
CMD ["validate", "--data", "/data/current.ttl", "--shapes", "/schemas/compliance.ttl"]
```

## Troubleshooting

### Common Issues

1. **"SHACL validation failed"**
   - Check RDF syntax in data and shapes files
   - Verify all prefixes are properly declared
   - Ensure shapes target the correct classes

2. **"Drift detection failed"**
   - Verify target file exists and is readable
   - Check that expected data is valid RDF
   - Ensure baseline directory is writable

3. **"Report generation failed"**
   - Check output directory permissions
   - Verify sufficient disk space
   - Ensure no conflicting processes

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
# CLI
kgen-validate validate --verbose --data data.ttl --shapes shapes.ttl

# Environment variable
export KGEN_LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [KGEN Validation Docs](https://kgen.dev/validation)
- Issues: [GitHub Issues](https://github.com/kgen/validation/issues)
- Discussions: [GitHub Discussions](https://github.com/kgen/validation/discussions)