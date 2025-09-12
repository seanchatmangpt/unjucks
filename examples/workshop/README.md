# KGEN Workshop

Welcome to the KGEN Workshop! Learn Knowledge Generation through practical examples and hands-on tutorials.

## 🎯 What You'll Learn

- Deterministic artifact generation with KGEN v1
- Git-native development workflows
- Semantic web integration with RDF/SHACL
- Office document automation
- API service generation
- Drift detection and validation
- Enterprise governance patterns

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Git
- Basic knowledge of templates and JSON

### Installation
```bash
# Install KGEN CLI
npm install -g @kgen/cli

# Verify installation
kgen version
```

### Your First Generation
```bash
# Generate a Next.js page
cd examples/workshop/_templates/nextjs-app
kgen generate page --pageName="Welcome" --title="Hello KGEN"

# Generate an API service
cd ../api-service
kgen generate endpoint --resourceName="users" --withAuth=true
```

## 📚 Workshop Contents

### 🏗️ Templates
- **nextjs-app/**: React/Next.js application generators
- **api-service/**: REST API service templates
- **office-report/**: MS Office document templates

### 🧠 Knowledge Base
- **knowledge/sample.ttl**: Sample RDF semantic data
- **knowledge/shapes.ttl**: SHACL validation shapes

### ⚖️ Governance Rules
- **rules/validation.n3**: N3 validation logic
- **rules/governance.n3**: Enterprise governance rules

### 📖 Tutorials
1. **Getting Started**: Basic KGEN concepts and first generation
2. **Deterministic Generation**: Ensuring reproducible builds
3. **Drift Detection**: Monitoring for unauthorized changes

## 🎓 Learning Path

### Beginner (30 minutes)
1. Follow the Quick Start guide
2. Complete Tutorial 01: Getting Started
3. Generate your first Next.js page

### Intermediate (1 hour)
1. Explore API service generation
2. Learn SHACL validation
3. Complete Tutorial 02: Deterministic Generation

### Advanced (2 hours)
1. Create custom templates
2. Implement governance rules
3. Complete Tutorial 03: Drift Detection
4. Build enterprise workflows

## 🛠️ Workshop Examples

### Example 1: Next.js Dashboard
```bash
kgen generate dashboard \
  --pageName="Analytics" \
  --components="Chart,Table,Filter" \
  --withAuth=true
```

### Example 2: REST API
```bash
kgen generate api \
  --resourceName="products" \
  --methods="GET,POST,PUT,DELETE" \
  --withValidation=true
```

### Example 3: Compliance Report
```bash
kgen generate report \
  --type="hipaa" \
  --format="docx" \
  --withSignatures=true
```

## 🔍 Key Concepts

### Deterministic Generation
- **Reproducible**: Same inputs = same outputs
- **Traceable**: Full provenance tracking
- **Verifiable**: Cryptographic attestations

### Git-Native Workflows
- **Version controlled**: All templates in git
- **Branch-aware**: Generation respects git context
- **Collaborative**: Team-friendly workflows

### Semantic Integration
- **RDF Support**: Rich semantic modeling
- **SHACL Validation**: Constraint checking
- **SPARQL Queries**: Semantic data access

## 📊 Workshop Metrics

After completing this workshop, you should be able to:
- [ ] Generate deterministic artifacts in <100ms
- [ ] Create custom templates with semantic validation
- [ ] Implement drift detection in CI/CD pipelines
- [ ] Build governance-compliant code generation
- [ ] Integrate RDF knowledge graphs

## 🎯 Success Criteria

### Functional Achievements
- Generate working Next.js applications
- Create validated REST APIs
- Produce compliant Office documents
- Implement custom validation rules

### Performance Benchmarks
- Template rendering <100ms
- RDF processing <1s for 10K triples
- Memory usage <150MB
- Zero drift in generated artifacts

## 📞 Support

- **Documentation**: [KGEN Docs](../docs/)
- **Examples**: [Example Projects](../examples/)
- **Issues**: [GitHub Issues](https://github.com/kgen/kgen/issues)
- **Community**: [Discussions](https://github.com/kgen/kgen/discussions)

## 🎉 What's Next?

After completing the workshop:
1. Explore advanced templates in the `/examples` directory
2. Read the KGEN Production Readiness Report
3. Join the community discussions
4. Contribute your own templates

---

**Ready to start?** Begin with [Tutorial 01: Getting Started](tutorials/01-getting-started.md)

*Workshop Duration: 2-4 hours*  
*Skill Level: Beginner to Advanced*  
*Prerequisites: Basic programming knowledge*