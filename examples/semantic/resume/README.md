# Semantic Resume Generation

This directory contains examples for generating resumes using semantic web technologies and RDF ontologies.

## Quick Start

### 1. Basic Resume Generation

```bash
# Generate academic-style resume
unjucks semantic generate resume --person person.ttl --style academic --format html

# Generate corporate-style resume with job matching
unjucks semantic generate resume --person person.ttl --job job.ttl --style corporate --format pdf,html --skillMatching

# Preview without writing files
unjucks semantic generate resume --person person.ttl --style academic --dry
```

### 2. Multiple Format Output

```bash
# Generate resume in multiple formats
unjucks semantic generate resume \
  --person person.ttl \
  --job job.ttl \
  --style corporate \
  --format pdf,html,json,md \
  --skillMatching \
  --output ./resumes
```

### 3. Command Options

| Flag | Description | Example |
|------|-------------|---------|
| `--person` | Person ontology file (TTL) | `--person person.ttl` |
| `--job` | Job requirements file (TTL) | `--job job.ttl` |
| `--style` | Resume style | `--style academic,corporate,creative,technical` |
| `--format` | Output format(s) | `--format pdf,html,json,txt,md,latex` |
| `--skillMatching` | Enable semantic skill matching | `--skillMatching` |
| `--includeOntology` | Show semantic metadata | `--includeOntology` |
| `--output` | Output directory | `--output ./resumes` |
| `--dry` | Preview mode | `--dry` |

## Ontology Files

### person.ttl
Contains person information using FOAF and Schema.org vocabularies:
- Personal details (name, email, phone, address)
- Skills and competencies
- Education history
- Work experience
- Projects and certifications

### job.ttl
Contains job posting information:
- Job title and company
- Required and preferred skills
- Job description
- Education requirements
- Location and salary information

## Available Styles

### Academic
- Clean, traditional layout
- Emphasis on education and research
- Publication-friendly format
- Times New Roman typography

### Corporate
- Modern, professional design
- Skills-focused presentation
- Gradient headers and modern styling
- Business-friendly color scheme

### Creative (Planned)
- Artistic, visually appealing
- Creative industry focus
- Custom graphics and layouts

### Technical (Planned)
- Code-friendly format
- Technical skills emphasis
- Developer portfolio integration

## Semantic Features

### Skill Matching
When both `--person` and `--job` files are provided with `--skillMatching`:
- Automatically highlights matching skills
- Calculates skill match percentage
- Prioritizes relevant competencies

### Ontology Integration
The system uses semantic web technologies to:
- Parse RDF/TTL files using N3.js
- Execute SPARQL queries for data extraction
- Apply semantic reasoning for skill matching
- Generate structured JSON-LD output

### Template Discovery
Templates are automatically discovered from:
- `_templates/semantic/resume/{style}.njk`
- Nunjucks templating with semantic filters
- Responsive HTML with print styles

## Output Formats

### HTML
- Responsive design
- Print-optimized styles
- Interactive skill highlighting

### PDF
- Professional formatting
- Print-ready output
- (Requires puppeteer integration)

### JSON
- Structured data format
- Schema.org compatible
- Machine-readable resume

### Markdown
- Plain text compatible
- Git-friendly format
- Documentation standard

### LaTeX
- Academic publishing
- High-quality typography
- Bibliography integration

## Examples

### Basic Academic Resume
```bash
unjucks semantic generate resume \
  --person examples/semantic/resume/person.ttl \
  --style academic \
  --format html \
  --output ./resume
```

### Job-Tailored Corporate Resume
```bash
unjucks semantic generate resume \
  --person examples/semantic/resume/person.ttl \
  --job examples/semantic/resume/job.ttl \
  --style corporate \
  --format pdf,html,json \
  --skillMatching \
  --includeOntology \
  --output ./tailored-resume
```

### Batch Generation (Planned)
```bash
# Generate resumes for multiple job applications
unjucks semantic generate resume \
  --person person.ttl \
  --jobs "job1.ttl,job2.ttl,job3.ttl" \
  --style corporate \
  --batch \
  --output ./applications
```

## Integration with Hive Mind

This semantic resume generation integrates with the Hive Mind system:
- Memory storage: `hive/cli/semantic`
- Agent coordination for parallel processing
- Neural pattern recognition for skill matching
- Swarm-based template optimization

## Future Enhancements

1. **Interactive Mode**: Guided resume creation
2. **Batch Processing**: Multiple job applications
3. **Advanced Matching**: ML-powered skill analysis
4. **Template Marketplace**: Community-contributed styles
5. **Real-time Updates**: Live preview and editing
6. **Integration APIs**: LinkedIn, GitHub, ORCID connections