# Build and Deployment Guide
## Unjucks: Modern Code Generation in 2026

This guide provides comprehensive instructions for building, testing, and deploying the Unjucks book in production environments.

---

## Prerequisites

### System Requirements
- **Rust**: Latest stable version (for mdbook)
- **Node.js**: v18+ (for development tools)
- **Git**: For version control
- **mdbook**: Latest stable release

### Installation
```bash
# Install mdbook
cargo install mdbook

# Verify installation
mdbook --version

# Optional: Install additional processors
cargo install mdbook-linkcheck  # Link validation
cargo install mdbook-mermaid    # Diagram support
cargo install mdbook-katex      # Math support
```

---

## Project Structure

```
docs/book/
├── book.toml              # Configuration
├── src/                   # Source content
│   ├── SUMMARY.md        # Table of contents
│   ├── preface.md        # Book preface
│   ├── introduction.md   # Introduction
│   ├── ch01-introduction.md through ch09-advanced-workflows.md
│   ├── core/             # Core reference
│   ├── advanced/         # Advanced reference
│   ├── enterprise/       # Enterprise patterns
│   └── appendices/       # Appendices
├── theme/                # Custom theme
│   ├── index.hbs        # Main template
│   ├── custom.css       # Custom styles
│   └── custom.js        # Custom JavaScript
└── book/                 # Generated output (git-ignored)
```

---

## Local Development

### Quick Start
```bash
# Clone repository
git clone https://github.com/ruvnet/unjucks.git
cd unjucks/docs/book

# Build the book
mdbook build

# Serve locally with hot reload
mdbook serve

# Open in browser (typically http://localhost:3000)
```

### Development Workflow
```bash
# Start development server
mdbook serve --open

# In another terminal, watch for changes
mdbook watch

# Test build without serving
mdbook build

# Clean previous builds
rm -rf book/
mdbook build
```

### Content Editing
1. **Edit Markdown**: Modify files in `src/`
2. **Update TOC**: Edit `src/SUMMARY.md` if adding/removing chapters
3. **Test Changes**: Use `mdbook serve` for live preview
4. **Validate Build**: Run `mdbook build` to check for errors

---

## Configuration Management

### book.toml Settings
```toml
[book]
title = "Unjucks: Modern Code Generation in 2026"
authors = ["Development Team", "AI Assistants"]
description = "Comprehensive guide to modern code generation"
src = "src"
language = "en"

[build]
build-dir = "book"
create-missing = true

[output.html]
mathjax-support = true
default-theme = "navy"
git-repository-url = "https://github.com/ruvnet/unjucks"
site-url = "https://ruvnet.github.io/unjucks/"
cname = "unjucks.dev"

[output.html.fold]
enable = true
level = 2

[output.html.search]
enable = true
limit-results = 30
teaser-word-count = 30
use-boolean-and = true
boost-title = 2
boost-hierarchy = 1
boost-paragraph = 1
expand = true
heading-split-level = 3

[output.html.print]
enable = true
page-break = true

[output.linkcheck]
optional = true
follow-web-links = true
```

### Environment-Specific Configurations

**Development (book.dev.toml)**
```toml
[output.html]
default-theme = "light"
mathjax-support = false

[output.linkcheck]
optional = true
follow-web-links = false
```

**Production (book.prod.toml)**
```toml
[preprocessor.index]

[output.html]
google-analytics = "UA-XXXXXXX-1"
git-repository-url = "https://github.com/ruvnet/unjucks"
edit-url-template = "https://github.com/ruvnet/unjucks/edit/main/docs/book/src/{path}"

[output.linkcheck]
optional = false
follow-web-links = true
```

---

## Quality Assurance

### Pre-Build Validation
```bash
# Validate all markdown files
find src/ -name "*.md" -exec mdbook test {} \;

# Check for broken internal links
grep -r "\[.*\](" src/ | grep -v "http" | while read line; do
  # Extract and validate internal links
  echo "Checking: $line"
done

# Validate SUMMARY.md structure
mdbook build --dry-run
```

### Content Quality Checks
```bash
# Check for placeholder content
grep -r "TODO\|FIXME\|placeholder" src/ --exclude-dir=.git

# Validate code blocks have language specifiers
grep -n "^```$" src/**/*.md

# Check for broken cross-references
grep -r "\[.*\](#.*)" src/ | while read line; do
  # Validate anchor links exist
  echo "Checking anchor: $line"
done
```

### Automated Testing
```bash
#!/bin/bash
# test-build.sh - Comprehensive build testing

set -e

echo "🔍 Running content validation..."
# Check for required files
required_files=(
  "src/SUMMARY.md"
  "src/introduction.md" 
  "src/preface.md"
  "book.toml"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "❌ Missing required file: $file"
    exit 1
  fi
done

echo "🏗️  Testing build..."
mdbook build

echo "🔗 Validating structure..."
if [[ ! -d "book/html" ]]; then
  echo "❌ Build output not found"
  exit 1
fi

echo "📊 Analyzing output..."
echo "Generated files: $(find book/ -name "*.html" | wc -l)"
echo "CSS files: $(find book/ -name "*.css" | wc -l)"
echo "JS files: $(find book/ -name "*.js" | wc -l)"

echo "✅ Build validation complete!"
```

---

## Deployment Strategies

### GitHub Pages Deployment
```yaml
# .github/workflows/deploy.yml
name: Deploy mdBook

on:
  push:
    branches: [ main ]
    paths: [ 'docs/book/**' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Install mdbook
      run: cargo install mdbook
    
    - name: Build book
      run: |
        cd docs/book
        mdbook build
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: docs/book/book
        cname: unjucks.dev
```

### Netlify Deployment
```toml
# netlify.toml
[build]
  base = "docs/book"
  command = "mdbook build"
  publish = "book"

[build.environment]
  RUST_VERSION = "1.70.0"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
```

### Vercel Deployment
```json
{
  "version": 2,
  "builds": [
    {
      "src": "docs/book/book.toml",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "cd docs/book && mdbook build",
        "outputDirectory": "docs/book/book"
      }
    }
  ]
}
```

### Docker Deployment
```dockerfile
# Dockerfile
FROM rust:1.70 as builder

# Install mdbook
RUN cargo install mdbook

# Copy source
WORKDIR /app
COPY docs/book/ .

# Build book
RUN mdbook build

# Production image
FROM nginx:alpine

# Copy built book
COPY --from=builder /app/book /usr/share/nginx/html

# Custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
```

---

## Performance Optimization

### Build Performance
```bash
# Enable parallel processing
export RUST_LOG=mdbook=info
mdbook build --verbose

# Use faster linker (macOS)
export RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Cache dependencies
cargo install --locked mdbook
```

### Output Optimization
```toml
# Optimize HTML output
[output.html]
no-section-label = true
git-repository-icon = "fa-github"
theme = "navy"
preferred-dark-theme = "ayu"

# Optimize search
[output.html.search]
limit-results = 20
teaser-word-count = 20
```

### Asset Optimization
```bash
# Optimize images
find book/ -name "*.png" -exec optipng {} \;
find book/ -name "*.jpg" -exec jpegoptim {} \;

# Minify CSS and JS (if custom)
npx postcss theme/custom.css -o theme/custom.min.css
npx terser theme/custom.js -o theme/custom.min.js
```

---

## Monitoring and Analytics

### Build Monitoring
```bash
# Monitor build times
time mdbook build

# Track output size
du -sh book/

# Monitor file counts
find book/ -type f | wc -l
```

### Production Analytics
```html
<!-- Google Analytics (in custom theme) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_TRACKING_ID');
</script>
```

### Health Checks
```bash
#!/bin/bash
# health-check.sh
curl -f https://unjucks.dev/ > /dev/null || exit 1
curl -f https://unjucks.dev/ch01-introduction.html > /dev/null || exit 1
echo "✅ Site health check passed"
```

---

## Maintenance Procedures

### Regular Updates
```bash
# Weekly maintenance script
#!/bin/bash

echo "🔄 Starting weekly maintenance..."

# Update mdbook
cargo install mdbook --force

# Rebuild book
cd docs/book
mdbook clean
mdbook build

# Validate links (if linkcheck installed)
mdbook build 2>&1 | grep -E "(WARN|ERROR)" || echo "✅ Build clean"

# Update dependencies
git pull origin main

echo "✅ Maintenance complete"
```

### Content Updates
1. **Edit Source**: Modify markdown files in `src/`
2. **Test Locally**: `mdbook serve` to preview
3. **Build Test**: `mdbook build` to validate
4. **Commit Changes**: Standard git workflow
5. **Deploy**: Automatic via CI/CD

### Backup Procedures
```bash
# Backup source content
tar -czf unjucks-book-backup-$(date +%Y%m%d).tar.gz src/ theme/ book.toml

# Backup to S3 (if configured)
aws s3 cp unjucks-book-backup-$(date +%Y%m%d).tar.gz s3://backup-bucket/
```

---

## Troubleshooting

### Common Build Issues
```bash
# Clear build cache
rm -rf book/
mdbook clean
mdbook build

# Check for missing files
mdbook build --verbose 2>&1 | grep "not found"

# Validate configuration
mdbook build --dry-run
```

### Performance Issues
- **Large Images**: Optimize or compress images in `src/`
- **Complex Themes**: Simplify custom CSS/JS
- **Many Chapters**: Consider splitting into multiple books

### Deployment Issues
- **404 Errors**: Check `CNAME` and base URL configuration
- **Broken Links**: Run link validation before deployment
- **SSL Issues**: Verify HTTPS configuration

---

## Support and Resources

### Documentation
- **mdBook Guide**: https://rust-lang.github.io/mdBook/
- **Markdown Guide**: https://www.markdownguide.org/
- **Custom Themes**: mdBook theme documentation

### Community
- **GitHub Issues**: Report bugs and feature requests
- **Discussions**: Community support and questions
- **Stack Overflow**: `mdbook` and `unjucks` tags

### Contribution Guidelines
1. Fork repository
2. Create feature branch
3. Make changes and test
4. Submit pull request
5. Respond to feedback

---

This guide ensures reliable, maintainable deployment of the Unjucks book across different environments and platforms.