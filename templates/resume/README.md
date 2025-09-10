# Resume Template Generator

Professional resume templates with semantic data integration for the Unjucks scaffolding system.

## Features

- 🎨 **Multiple Formats**: LaTeX (PDF), HTML (Web), JSON-LD (Semantic)
- 🧠 **Semantic Integration**: Schema.org structured data, RDF extraction
- 🏭 **Industry Variants**: Software, Data Science, Product Management, Design, and more
- 🔍 **SEO Optimized**: Semantic keywords and structured markup
- 📱 **Responsive Design**: Mobile-friendly HTML templates
- ⚡ **Professional Quality**: LaTeX formatting for print-ready PDFs

## Quick Start

```bash
# Generate all formats
unjucks generate resume --candidateName "John Doe" --jobTitle "Software Engineer" --format all

# Generate specific format
unjucks generate resume --candidateName "Jane Smith" --jobTitle "Data Scientist" --format latex

# Generate with industry variant
unjucks generate resume --candidateName "Alex Johnson" --jobTitle "Product Manager" --industry product
```

## Template Structure

```
templates/resume/
├── generator.js              # Main generator configuration
├── semantic-filters.js       # RDF data extraction filters
├── latex/
│   └── resume.tex.njk        # LaTeX template
├── html/
│   └── resume.html.njk       # HTML template with CSS
├── json-ld/
│   └── structured-data.json.njk  # JSON-LD semantic data
└── variants/
    ├── software-engineer.json   # Software industry variant
    ├── data-scientist.json      # Data science variant
    └── product-manager.json     # Product management variant
```

## Generated Files

When you run the generator, it creates:

- `{name}-{industry}-resume.tex` - LaTeX source file
- `{name}-{industry}-resume.html` - HTML resume with embedded CSS
- `{name}-{industry}-structured-data.json` - JSON-LD semantic data

## Semantic Features

### Schema.org Integration
- Person markup with contact information
- WorkExperience structured data
- EducationalOccupationalCredential for degrees/certifications
- Organization data for employers and schools

### RDF Data Extraction
- Automatic skill categorization
- Experience data extraction
- Education timeline parsing
- Semantic keyword identification

### Industry Optimization
- Role-specific skill categories
- Industry-relevant project examples
- Targeted certification recommendations
- Optimized semantic keywords

## Customization

### Variables
- `candidateName` - Full name
- `jobTitle` - Current/target position
- `email` - Contact email
- `phone` - Phone number
- `location` - City, state/region
- `linkedinUrl` - LinkedIn profile
- `githubUrl` - GitHub profile
- `portfolioUrl` - Personal website
- `industry` - Industry type for optimization
- `format` - Output format (latex/html/json-ld/all)

### Industry Variants
- `software` - Software Engineering
- `data-science` - Data Science & ML
- `product` - Product Management
- `design` - UX/UI Design
- `marketing` - Digital Marketing
- `finance` - Finance & Fintech
- `healthcare` - Healthcare & Biotech
- `education` - Education & Training

## Building PDFs

For LaTeX templates, compile to PDF:

```bash
# Requires LaTeX installation (texlive, mactex, etc.)
pdflatex john-doe-software-resume.tex
```

## Semantic Validation

The templates include built-in semantic validation:

```javascript
// Validate Schema.org markup
const validation = filters.validateSemanticMarkup(schemaData, 'schema.org');
console.log(validation.valid, validation.errors);
```

## Contributing

When adding new industry variants:

1. Create JSON configuration in `variants/`
2. Add semantic keywords for SEO
3. Define relevant skill categories
4. Include industry-specific project examples
5. Update generator.js with new industry option

## Examples

### Software Engineer
- Emphasizes technical skills and architecture
- Includes open source contributions
- Highlights system scalability metrics

### Data Scientist
- Features ML/AI projects and research
- Includes publication and conference speaking
- Emphasizes statistical analysis and modeling

### Product Manager
- Focuses on business impact and metrics
- Highlights cross-functional leadership
- Includes market research and strategy

## License

MIT License - Feel free to customize and distribute.