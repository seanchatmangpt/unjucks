# KGEN Policy Gates - Machine-Executable Governance

This document demonstrates the usage of KGEN's policy:// URI system for automated governance and compliance checking.

## Overview

The Policy Gates system provides:
- **Machine Verdicts**: Automated pass/fail decisions using `policy://` URIs
- **SHACL Integration**: Deep integration with SHACL validation for semantic compliance
- **Audit Trails**: Immutable audit trails for compliance and forensics
- **Environment-Specific Policies**: Different governance rules for dev/staging/production

## Quick Start

### 1. Resolve a Policy URI

```bash
# Check if a template passes security policies
kgen policy resolve "policy://template-security/pass" \
  --template ./templates/user-profile.njk

# Validate artifact attestation integrity
kgen policy resolve "policy://attestation-integrity/pass" \
  --artifact ./generated/config.json

# Run SHACL validation policy
kgen policy resolve "policy://shacl-validation/pass" \
  --data ./knowledge/artifacts.ttl
```

### 2. Execute Policy Gates

```bash
# Run development environment gate
kgen policy gate "security-check" \
  --environment development \
  --template ./templates/api-client.njk

# Run production gate with strict policies
kgen policy gate "release-validation" \
  --environment production \
  --data ./knowledge/release.ttl \
  --artifact ./dist/service.jar
```

### 3. View Audit Trail

```bash
# Show recent policy decisions
kgen policy audit view --limit 10

# Get statistics on policy verdicts
kgen policy audit stats

# Export audit trail for compliance
kgen policy audit export --format json
```

## Policy URI Schemes

### Built-in Policies

| URI | Description | Context Required |
|-----|-------------|------------------|
| `policy://template-security/pass` | Template security validation | `templateContent` or `templatePath` |
| `policy://attestation-integrity/pass` | Artifact attestation validation | `artifactPath` |
| `policy://shacl-validation/pass` | SHACL constraint validation | `dataGraph` or `dataPath` |
| `policy://compliance-audit/pass` | Regulatory compliance check | Varies by implementation |
| `policy://provenance-chain/pass` | Provenance chain validation | `artifactPath` |
| `policy://artifact-drift/pass` | Artifact drift detection | `artifactPath` |
| `policy://template-constraints/pass` | Template constraint validation | `templateContent` |
| `policy://governance-rules/pass` | Custom governance rules | Custom context |

### Custom Policies

You can define custom policies by creating SHACL shapes in the `./rules` directory:

```turtle
# ./rules/my-custom-policy.ttl
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix kgen: <https://kgen.io/ontology#> .

[] a sh:NodeShape ;
   sh:targetClass kgen:MyCustomClass ;
   sh:property [
     sh:path kgen:requiredProperty ;
     sh:minCount 1 ;
     sh:message "Custom validation failed" ;
   ] .
```

Then use it with:
```bash
kgen policy resolve "policy://my-custom-policy/pass" --data ./test-data.ttl
```

## Environment Configurations

### Development
- **Strict Mode**: `false`
- **Block on Policy Failure**: `false`
- **Block on Security Violations**: `true`
- **Required Policies**: 
  - `policy://template-security/pass`

### Staging
- **Strict Mode**: `true`
- **Block on Policy Failure**: `true`
- **Block on Security Violations**: `true`
- **Required Policies**:
  - `policy://template-security/pass`
  - `policy://attestation-integrity/pass`
  - `policy://shacl-validation/pass`

### Production
- **Strict Mode**: `true`
- **Block on Policy Failure**: `true`
- **Block on Security Violations**: `true`
- **Block on Any Violations**: `true`
- **Required Policies**:
  - `policy://template-security/pass`
  - `policy://attestation-integrity/pass`
  - `policy://shacl-validation/pass`
  - `policy://compliance-audit/pass`
  - `policy://provenance-chain/pass`

### Compliance
- **Strict Mode**: `true`
- **Block on Policy Failure**: `true`
- **All security and compliance policies enabled**
- **Cryptographic Attestation Required**: `true`
- **Immutable Audit Trail**: `true`

## Programmatic Usage

### JavaScript/Node.js

```javascript
import { PolicyURIResolver, PolicyGates } from './src/kgen/validation/policy-resolver.js';

// Initialize resolver
const resolver = new PolicyURIResolver();
await resolver.initialize();

// Resolve policy URI
const result = await resolver.resolvePolicyURI('policy://template-security/pass', {
  templateContent: '<h1>{{ title }}</h1>',
  templateName: 'page-title'
});

console.log(`Policy verdict: ${result.actualVerdict}`);
console.log(`Verdict matches expectation: ${result.verdictMatches}`);

// Initialize policy gates
const gates = new PolicyGates({ environment: 'production' });
await gates.initialize();

// Execute gate
const gateResult = await gates.executeGate('security-gate', {
  templatePath: './templates/user-form.njk',
  dataPath: './knowledge/user-schema.ttl'
});

console.log(`Gate passed: ${gateResult.passed}`);
console.log(`Gate blocked: ${gateResult.blocked}`);
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Policy Compliance Check
on: [push, pull_request]

jobs:
  policy-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install KGEN
        run: npm install -g @kgen/cli
      
      - name: Template Security Check
        run: |
          kgen policy gate "security-validation" \
            --environment staging \
            --template ./templates/api-client.njk
      
      - name: Artifact Integrity Check
        run: |
          kgen policy resolve "policy://attestation-integrity/pass" \
            --artifact ./dist/service.jar
      
      - name: Export Audit Trail
        run: kgen policy audit export --format json
        
      - name: Upload Audit Report
        uses: actions/upload-artifact@v3
        with:
          name: policy-audit-report
          path: ./.kgen/audit/comprehensive-audit-*.json
```

### Docker

```dockerfile
FROM node:18-alpine
RUN npm install -g @kgen/cli

# Copy templates and knowledge graphs
COPY ./templates /app/templates
COPY ./knowledge /app/knowledge

WORKDIR /app

# Run policy gates as part of build
RUN kgen policy gate "production-readiness" \
    --environment production \
    --template ./templates \
    --data ./knowledge/production.ttl

# Continue with application build...
```

## Machine Verdict Format

Policy resolutions return structured machine verdicts:

```json
{
  "success": true,
  "operation": "policy:resolve",
  "policyURI": "policy://template-security/pass",
  "verdict": "pass",
  "passed": true,
  "verdictMatches": true,
  "ruleResult": {
    "ruleId": "template-security",
    "passed": true,
    "violations": [],
    "summary": {
      "totalViolations": 0,
      "riskLevel": "LOW"
    }
  },
  "metadata": {
    "resolvedAt": "2024-09-12T10:30:00Z",
    "resolutionTime": 45.2,
    "resolver": "KGenPolicyResolver"
  }
}
```

Gate executions provide comprehensive results:

```json
{
  "success": true,
  "operation": "policy:gate",
  "gateName": "security-check",
  "environment": "production",
  "verdict": "PASS",
  "blocked": false,
  "policyVerdicts": [
    {
      "uri": "policy://template-security/pass",
      "verdict": "pass",
      "passed": true
    }
  ],
  "shaclResults": {
    "passed": true,
    "violations": 0
  },
  "executionTime": 123.5,
  "auditEntry": "audit-12345-67890",
  "timestamp": "2024-09-12T10:30:00Z"
}
```

## Security Considerations

### Template Security Policies

The `policy://template-security/*` policies check for:
- Script injection vulnerabilities (`<script>`, `eval()`, `Function()`)
- Dangerous template constructs (`__proto__`, `constructor`)
- Shell command injection (`rm -rf`, `sudo`, etc.)
- Path traversal attempts (`../`, `..\\`)

### Audit Trail Security

- All policy decisions are immutably recorded
- Cryptographic checksums verify audit integrity
- Timestamps use UTC with millisecond precision
- Audit entries include machine-readable verdicts

### Access Control

- Policy resolution requires appropriate file system permissions
- SHACL shapes and custom rules are validated before use
- Audit trails are write-only (no modification after creation)

## Troubleshooting

### Common Issues

1. **Policy URI parse errors**
   ```
   Error: Invalid policy URI format: policy://invalid
   ```
   - Ensure URI follows format: `policy://<ruleId>/<pass|fail|pending>`

2. **SHACL shapes not found**
   ```
   Error: Failed to load SHACL shapes from ./shapes
   ```
   - Check that shapes directory exists and contains `.ttl` files
   - Verify file permissions

3. **Template content missing**
   ```
   Error: Template security policy requires template content or path
   ```
   - Provide either `templateContent` in context or `--template` argument

### Debug Mode

Enable verbose logging:
```bash
kgen policy resolve "policy://template-security/pass" \
  --template ./my-template.njk \
  --verbose
```

### Validate Configuration

Check policy system configuration:
```bash
kgen policy validate \
  --rules-path ./rules \
  --shapes-path ./src/kgen/validation/shapes
```

## Performance

### Benchmarks

- Policy URI resolution: ~10-50ms (depending on rule complexity)
- SHACL validation: ~5-20ms (for typical templates)
- Gate execution: ~50-200ms (multiple policies + SHACL)
- Audit trail persistence: ~1-5ms

### Optimization Tips

- Use policy caching for repeated resolutions
- Batch multiple policies in single gate execution
- Pre-validate SHACL shapes during CI/CD build
- Use specific context data to reduce validation scope

## Contributing

To add new policy types:

1. Add scheme to `PolicyURISchemes` in `policy-resolver.js`
2. Implement execution method (e.g., `executeMyNewPolicy()`)
3. Add corresponding SHACL shapes if needed
4. Write tests in `tests/policy-gates.test.js`
5. Update this documentation

## References

- [SHACL Specification](https://www.w3.org/TR/shacl/)
- [RDF 1.1 Concepts](https://www.w3.org/TR/rdf11-concepts/)
- [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/)
- [PROV-O Ontology](https://www.w3.org/TR/prov-o/)