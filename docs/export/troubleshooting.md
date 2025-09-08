# Export Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for Unjucks export functionality, covering common issues, debugging techniques, and resolution strategies.

## Common Export Issues

### 1. File Not Found Errors

**Symptoms:**
```
Error: Input file not found: document.md
Error: ENOENT: no such file or directory
```

**Causes:**
- Incorrect file path
- File moved or deleted
- Permission restrictions
- Working directory mismatch

**Solutions:**
```bash
# Verify file exists
ls -la document.md

# Use absolute path
unjucks export /full/path/to/document.md

# Check current directory
pwd
ls -la

# Use glob patterns for batch operations
unjucks export "docs/**/*.md" --all --format pdf
```

### 2. Permission Denied Issues

**Symptoms:**
```
Error: EACCES: permission denied, open '/restricted/output.pdf'
Error: Cannot write to output directory
```

**Causes:**
- Insufficient write permissions
- Read-only directories
- System-protected locations
- File locks

**Solutions:**
```bash
# Check directory permissions
ls -la /output/directory/

# Use user-writable location
unjucks export document.md --output ~/Documents/output.pdf

# Create output directory first
mkdir -p ./exports
unjucks export document.md --output ./exports/document.pdf

# Fix permissions (Linux/macOS)
chmod 755 ./output/directory/
```

### 3. Template Not Found

**Symptoms:**
```
Error: Template 'custom' not available for format 'pdf'
Warning: Falling back to default template
```

**Causes:**
- Typo in template name
- Template not available for format
- Missing template files

**Solutions:**
```bash
# List available templates
unjucks export templates

# List templates for specific format
unjucks export templates --format pdf

# Use correct template name (case-sensitive)
unjucks export document.md --format pdf --template academic

# Check template availability
unjucks export presets
```

### 4. LaTeX Compilation Errors

**Symptoms:**
```
Warning: LaTeX compilation failed, keeping .tex file
Error: pdflatex not found in PATH
LaTeX Error: File 'package.sty' not found
```

**Causes:**
- LaTeX not installed
- Missing LaTeX packages
- Malformed LaTeX content
- Engine mismatch

**Solutions:**

**Install LaTeX:**
```bash
# Ubuntu/Debian
sudo apt-get install texlive-full

# macOS with Homebrew
brew install --cask mactex

# Windows
# Download and install MiKTeX or TeX Live
```

**Package Issues:**
```bash
# Update LaTeX packages
sudo tlmgr update --all

# Install specific package
sudo tlmgr install [package-name]

# Use different engine
unjucks export pdf document.md --engine xelatex
```

**Content Issues:**
```bash
# Enable verbose mode to see LaTeX errors
unjucks export document.md --format pdf --verbose

# Use minimal template to isolate issues
unjucks export document.md --format pdf --template minimal

# Check generated .tex file
unjucks export document.md --format tex --output debug.tex
```

### 5. Memory and Performance Issues

**Symptoms:**
```
Error: JavaScript heap out of memory
Process terminated due to timeout
Export taking very long time
```

**Causes:**
- Large file processing
- High concurrency settings
- Memory leaks
- Resource exhaustion

**Solutions:**
```bash
# Reduce concurrency for batch operations
unjucks export "*.md" --all --format pdf --concurrency 1

# Process files individually
for file in *.md; do
  unjucks export "$file" --format pdf
done

# Use minimal templates
unjucks export document.md --format pdf --template minimal

# Monitor resource usage
top -p $(pgrep -f unjucks)
```

### 6. Format-Specific Issues

#### PDF Export Issues

**Symptoms:**
```
PDF generation incomplete
Missing fonts in PDF
LaTeX package conflicts
```

**Solutions:**
```bash
# Use different LaTeX engine
unjucks export pdf document.md --engine lualatex

# Disable problematic features
unjucks export pdf document.md --template minimal --no-toc

# Check font availability
fc-list | grep "Font Name"
```

#### DOCX Export Issues

**Symptoms:**
```
DOCX file corrupted
Missing formatting
Template application failed
```

**Solutions:**
```bash
# Use simpler template
unjucks export docx document.md --template simple

# Disable advanced features
unjucks export docx document.md --no-header --no-footer

# Validate DOCX structure
unzip -l output.docx
```

#### HTML Export Issues

**Symptoms:**
```
CSS not loading
Broken HTML structure
Encoding issues
```

**Solutions:**
```bash
# Disable CSS for debugging
unjucks export html document.md --no-css

# Use minimal template
unjucks export html document.md --template minimal

# Check HTML validation
html5validator output.html
```

## Debugging Techniques

### 1. Enable Verbose Mode

Always use `--verbose` for detailed debugging information:

```bash
unjucks export document.md --format pdf --verbose
```

**Verbose Output Includes:**
- Template processing steps
- File operation details
- Error stack traces
- Performance metrics
- Resource usage

### 2. Use Dry Run Mode

Preview operations without creating files:

```bash
# Single file dry run
unjucks export document.md --format pdf --dry

# Batch dry run with verbose output
unjucks export "*.md" --all --format pdf --dry --verbose
```

### 3. Step-by-Step Debugging

Break down complex operations:

```bash
# 1. Test basic export
unjucks export document.md --format html

# 2. Add template
unjucks export document.md --format html --template modern

# 3. Add advanced features
unjucks export document.md --format html --template modern --responsive

# 4. Test variables
unjucks export document.md --format html --variables '{"title":"Test"}'
```

### 4. Isolate Issues

Use minimal configurations to isolate problems:

```bash
# Minimal export
unjucks export document.md --format txt

# Basic template
unjucks export document.md --format pdf --template minimal

# Single format test
unjucks export document.md --format html --template minimal --no-css
```

### 5. File System Debugging

Check file system operations:

```bash
# Monitor file operations (Linux/macOS)
strace -e trace=file unjucks export document.md

# Check disk space
df -h

# Monitor directory changes
inotifywait -m -r ./output/

# Check file locks
lsof | grep document
```

## System-Specific Issues

### macOS Issues

**Common Problems:**
- Gatekeeper blocking LaTeX
- Permission issues with system directories
- Path issues with Homebrew installations

**Solutions:**
```bash
# Fix Gatekeeper issues
sudo spctl --master-disable

# Use Homebrew PATH
export PATH="/opt/homebrew/bin:$PATH"

# Install LaTeX via Homebrew
brew install --cask mactex
```

### Linux Issues

**Common Problems:**
- Missing LaTeX packages
- Font rendering issues
- Permission restrictions

**Solutions:**
```bash
# Install full LaTeX suite
sudo apt-get install texlive-full

# Install fonts
sudo apt-get install fonts-liberation fonts-dejavu

# Fix permissions
sudo chown -R $USER:$USER ~/.texlive
```

### Windows Issues

**Common Problems:**
- Path separator issues
- PowerShell execution policies
- LaTeX PATH configuration

**Solutions:**
```powershell
# Set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Use forward slashes or escape backslashes
unjucks export "C:/path/to/document.md"

# Add LaTeX to PATH
$env:PATH += ";C:\texlive\2024\bin\windows"
```

## Performance Troubleshooting

### Memory Usage Optimization

```bash
# Monitor memory usage
unjucks export document.md --format pdf --verbose | grep -i memory

# Reduce memory footprint
unjucks export document.md --format pdf --template minimal --no-toc

# Process in smaller batches
unjucks export "docs/*.md" --all --format pdf --concurrency 2
```

### CPU Usage Optimization

```bash
# Single-threaded processing
unjucks export "*.md" --all --format pdf --concurrency 1

# Monitor CPU usage
top -p $(pgrep -f unjucks)

# Use faster templates
unjucks export document.md --format html --template minimal
```

### Disk I/O Optimization

```bash
# Use SSD for temporary files
export TMPDIR=/path/to/ssd/tmp

# Minimize disk writes
unjucks export document.md --format pdf --no-intermediate-files

# Use ramdisk for temporary processing
mount -t tmpfs -o size=1G tmpfs /tmp/unjucks
```

## Network and Dependency Issues

### LaTeX Distribution Problems

```bash
# Check LaTeX installation
which pdflatex
pdflatex --version

# Test basic LaTeX functionality
echo '\documentclass{article}\begin{document}Hello\end{document}' | pdflatex

# Update LaTeX packages
sudo tlmgr update --self
sudo tlmgr update --all
```

### Font Issues

```bash
# List available fonts
fc-list : family

# Install missing fonts
sudo apt-get install fonts-recommended

# Check font cache
fc-cache -fv
```

### Package Manager Issues

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for conflicting packages
npm ls
```

## Error Code Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| ENOENT | File not found | Check file path and permissions |
| EACCES | Permission denied | Modify file permissions or use different location |
| EMFILE | Too many open files | Reduce concurrency or increase system limits |
| ENOMEM | Out of memory | Reduce batch size or use streaming processing |
| ETIMEDOUT | Operation timeout | Increase timeout or reduce complexity |

## Log Analysis

### Understanding Export Logs

```bash
# Enable detailed logging
DEBUG=unjucks:export unjucks export document.md --format pdf

# Save logs to file
unjucks export document.md --format pdf --verbose 2>&1 | tee export.log

# Filter specific log types
grep -i "error\|warning" export.log
```

### Log Levels

- **ERROR**: Critical issues preventing export
- **WARN**: Non-critical issues with fallbacks
- **INFO**: General progress information
- **DEBUG**: Detailed processing steps

## Prevention Strategies

### Pre-Export Validation

```bash
# Validate input files
unjucks validate document.md

# Check system requirements
unjucks doctor

# Test configuration
unjucks export templates --format pdf
```

### Regular Maintenance

```bash
# Update LaTeX packages
sudo tlmgr update --all

# Clean temporary files
rm -rf ~/.unjucks/temp/*

# Verify system dependencies
unjucks export --check-dependencies
```

### Monitoring Setup

```bash
# Set up export monitoring
unjucks export monitor start

# Configure alerts
unjucks export monitor configure --alert-threshold 10

# View export statistics
unjucks export monitor stats
```

## Getting Additional Help

### Diagnostic Information Collection

```bash
# Generate diagnostic report
unjucks export diagnose > diagnostic-report.txt

# Include system information
unjucks export system-info >> diagnostic-report.txt

# Test all formats
unjucks export test-formats >> diagnostic-report.txt
```

### Community Resources

1. **GitHub Issues**: Report bugs with diagnostic information
2. **Documentation**: Check latest troubleshooting updates
3. **Community Forum**: Ask questions and share solutions
4. **Stack Overflow**: Tag questions with `unjucks` and `export`

### Professional Support

For enterprise users requiring professional support:

- **Priority Issue Resolution**: Dedicated support channel
- **Custom Integration Support**: Assistance with enterprise workflows
- **Performance Optimization**: System-specific tuning
- **Training and Onboarding**: Team training programs

## Appendix: Command Reference

### Quick Diagnostic Commands

```bash
# System check
unjucks export --version
unjucks export templates
unjucks export presets

# Dependency check
which pdflatex
which node
npm list @seanchatmangpt/unjucks

# Permission check
touch test.txt && rm test.txt
mkdir -p ./test-dir && rmdir ./test-dir

# Memory check
node -e "console.log(process.memoryUsage())"
```

### Emergency Recovery

```bash
# Reset to default configuration
rm -rf ~/.unjucks/config
unjucks export --reset-config

# Clear all caches
rm -rf ~/.unjucks/cache
npm cache clean --force

# Reinstall clean
npm uninstall -g @seanchatmangpt/unjucks
npm install -g @seanchatmangpt/unjucks
```

---

*This troubleshooting guide is regularly updated. For the latest information, visit the [official documentation](https://unjucks.dev/docs/export/troubleshooting).*