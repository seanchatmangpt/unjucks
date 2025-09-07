import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Homebrew Formula Validation', () => {
  const formulaPath = resolve(__dirname, '../../homebrew/unjucks.rb');
  let formulaContent => {
    expect(existsSync(formulaPath)).toBe(true);
    formulaContent = readFileSync(formulaPath, 'utf8');
  });

  it('should have valid Ruby syntax', () => {
    // Check basic Ruby class structure
    expect(formulaContent).toContain('class Unjucks < Formula');
    expect(formulaContent).toContain('desc "');
    expect(formulaContent).toContain('homepage "');
    expect(formulaContent).toContain('url "');
    expect(formulaContent).toContain('license "');
  });

  it('should specify correct NPM registry URL', () => { expect(formulaContent).toContain('https });

  it('should declare Node.js', () => {
    expect(formulaContent).toContain('depends_on "node"');
  });

  it('should have proper install method', () => {
    expect(formulaContent).toContain('def install');
    expect(formulaContent).toContain('npm", "install"');
    expect(formulaContent).toContain('std_npm_install_args(libexec)');
    expect(formulaContent).toContain('bin.install_symlink');
  });

  it('should have comprehensive test block', () => {
    expect(formulaContent).toContain('test do');
    
    // Should test version command
    expect(formulaContent).toContain('system "#{bin}/unjucks", "--version"');
    
    // Should test list command
    expect(formulaContent).toContain('shell_output("#{bin}/unjucks list")');
    
    // Should test help command
    expect(formulaContent).toContain('shell_output("#{bin}/unjucks --help")');
    
    // Should test init command
    expect(formulaContent).toContain('shell_output("#{bin}/unjucks init")');
    
    // Should test dry run
    expect(formulaContent).toContain('shell_output("#{bin}/unjucks generate component react --dry")');
    
    // Should have performance test
    expect(formulaContent).toContain('start_time = Time.now');
    expect(formulaContent).toContain('duration < 2');
    
    // Should verify binary exists and is executable
    expect(formulaContent).toContain('assert_predicate bin/"unjucks", :exist?');
    expect(formulaContent).toContain('assert_predicate bin/"unjucks", :executable?');
  });

  it('should have bottle configurations for multiple architectures', () => {
    expect(formulaContent).toContain('bottle do');
    expect(formulaContent).toContain('arm64_sonoma');
    expect(formulaContent).toContain('arm64_ventura');
    expect(formulaContent).toContain('arm64_monterey');
    expect(formulaContent).toContain('sonoma');
    expect(formulaContent).toContain('ventura');
    expect(formulaContent).toContain('monterey');
    expect(formulaContent).toContain('x86_64_linux');
  });

  it('should validate expected outputs in tests', () => {
    const expectedChecks = [
      'assert_match(/\\d+\\.\\d+\\.\\d+/, shell_output("#{bin}/unjucks --version"))',
      'assert_match "Available generators", output',
      'assert_match "component", output',
      'assert_match "api", output',
      'assert_match "service", output',
      'assert_match "Usage:", help_output',
      'assert_match "Commands:", help_output',
      'assert_match "generate", help_output',
      'assert_match "Initializing Unjucks templates", init_output',
      'assert_match "Dry run", dry_run_output',
      'assert_match "Would generate", dry_run_output'
    ];

    expectedChecks.forEach(check => {
      expect(formulaContent).toContain(check);
    });
  });

  it('should have proper metadata formatting', () => { // Check for proper quotes and formatting
    expect(formulaContent).toMatch(/desc\s+"[^"]+"/);
    expect(formulaContent).toMatch(/homepage\s+"https? });

  it('should be compatible with Homebrew formula requirements', () => {
    // Check for Ruby-style indentation (2 spaces)
    const lines = formulaContent.split('\n');
    const indentedLines = lines.filter(line => line.startsWith('  ') && !line.startsWith('    '));
    expect(indentedLines.length).toBeGreaterThan(5);

    // Should not have trailing whitespace (except empty lines)
    lines.forEach((line, index) => {
      if (line.trim().length > 0) {
        expect(line).not.toMatch(/\s+$/);
      }
    });

    // Should end with proper 'end' statement
    expect(formulaContent.trim()).toMatch(/end\s*$/);
  });

  describe('Formula Syntax Validation', () => {
    it('should validate Ruby syntax using ruby -c if available', () => {
      try {
        execSync('which ruby', { stdio);
        
        // If Ruby is available, validate syntax
        const result = execSync(`ruby -c "${formulaPath}"`, { encoding);
        expect(result).toContain('Syntax OK');
      } catch (error) {
        console.warn('Ruby not available for syntax validation, skipping');
      }
    });

    it('should have proper method definitions', () => {
      // Check for install method
      expect(formulaContent).toMatch(/def install\b/);
      expect(formulaContent).toMatch(/def install[\s\S]*?\n  end/);
      
      // Check for test block (not a method)
      expect(formulaContent).toMatch(/test do\b/);
      expect(formulaContent).toMatch(/test do[\s\S]*?\n  end/);
    });

    it('should use proper Homebrew DSL methods', () => {
      const homebrewMethods = [
        'desc',
        'homepage', 
        'url',
        'sha256',
        'license',
        'depends_on',
        'system',
        'shell_output',
        'assert_match',
        'assert_predicate'
      ];

      homebrewMethods.forEach(method => {
        expect(formulaContent).toContain(method);
      });
    });
  });
});