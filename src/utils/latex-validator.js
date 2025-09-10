/**
 * LaTeX Validation and Testing Utilities
 * 
 * Tools to validate LaTeX installation and test PDF compilation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Logger } from './logger.js';

const execFileAsync = promisify(execFile);

/**
 * LaTeX test documents for validation
 */
const TEST_DOCUMENTS = {
  minimal: `\\documentclass{article}
\\begin{document}
Hello, LaTeX!
\\end{document}`,
  
  withPackages: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\title{Test Document}
\\author{Test Author}
\\date{\\today}
\\begin{document}
\\maketitle
\\section{Introduction}
This is a test document to validate LaTeX compilation.
\\subsection{Features}
\\begin{itemize}
\\item UTF-8 support
\\item Custom margins
\\item Hyperlinks
\\item Basic formatting
\\end{itemize}
\\end{document}`,
  
  resume: `\\documentclass{moderncv}
\\moderncvstyle{classic}
\\moderncvcolor{blue}
\\usepackage[scale=0.75]{geometry}
\\firstname{John}
\\familyname{Doe}
\\title{Software Engineer}
\\address{123 Main St}{City, State 12345}
\\phone[mobile]{+1~(555)~123~4567}
\\email{john@example.com}
\\begin{document}
\\makecvtitle
\\section{Education}
\\cventry{2020--2024}{Bachelor of Science in Computer Science}{University}{City}{}{}
\\section{Experience}
\\cventry{2024--Present}{Software Engineer}{Tech Company}{City}{}{Development of web applications}
\\end{document}`
};

class LaTeXValidator {
  constructor(options = {}) {
    this.logger = new Logger('LaTeXValidator');
    this.latexCommand = options.latexCommand || 'pdflatex';
    this.tempDir = options.tempDir || './temp';
    this.timeout = options.timeout || 30000; // 30 seconds
  }

  /**
   * Validate LaTeX installation and capabilities
   */
  async validateInstallation() {
    const results = {
      installed: false,
      version: null,
      packages: {
        geometry: false,
        hyperref: false,
        inputenc: false,
        moderncv: false
      },
      compilation: {
        minimal: false,
        withPackages: false,
        resume: false
      },
      errors: []
    };

    try {
      // Check if LaTeX is installed
      const versionResult = await this.checkLatexVersion();
      results.installed = versionResult.installed;
      results.version = versionResult.version;

      if (!results.installed) {
        results.errors.push('LaTeX not found in PATH');
        return results;
      }

      // Test compilation capabilities
      await this.ensureDir(this.tempDir);
      
      // Test minimal document
      try {
        await this.testCompilation('minimal', TEST_DOCUMENTS.minimal);
        results.compilation.minimal = true;
        this.logger.info('Minimal LaTeX compilation: ✅');
      } catch (error) {
        results.errors.push(`Minimal compilation failed: ${error.message}`);
        this.logger.warn('Minimal LaTeX compilation: ❌');
      }

      // Test document with packages
      try {
        await this.testCompilation('withPackages', TEST_DOCUMENTS.withPackages);
        results.compilation.withPackages = true;
        results.packages.geometry = true;
        results.packages.hyperref = true;
        results.packages.inputenc = true;
        this.logger.info('LaTeX with packages compilation: ✅');
      } catch (error) {
        results.errors.push(`Package compilation failed: ${error.message}`);
        this.logger.warn('LaTeX with packages compilation: ❌');
      }

      // Test resume template (moderncv)
      try {
        await this.testCompilation('resume', TEST_DOCUMENTS.resume);
        results.compilation.resume = true;
        results.packages.moderncv = true;
        this.logger.info('ModernCV resume compilation: ✅');
      } catch (error) {
        results.errors.push(`Resume compilation failed: ${error.message}`);
        this.logger.warn('ModernCV resume compilation: ❌');
      }

    } catch (error) {
      results.errors.push(`Validation failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Check LaTeX version and availability
   */
  async checkLatexVersion() {
    try {
      const { stdout } = await execFileAsync(this.latexCommand, ['--version'], {
        timeout: this.timeout
      });
      
      const versionMatch = stdout.match(/pdfTeX ([0-9.]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      return {
        installed: true,
        version,
        output: stdout
      };
    } catch (error) {
      return {
        installed: false,
        version: null,
        error: error.message
      };
    }
  }

  /**
   * Test LaTeX compilation with a specific document
   */
  async testCompilation(name, latexContent) {
    const texFile = join(this.tempDir, `test_${name}.tex`);
    const pdfFile = join(this.tempDir, `test_${name}.pdf`);
    
    try {
      // Write test document
      await fs.writeFile(texFile, latexContent, 'utf8');
      
      // Compile with pdflatex
      const { stdout, stderr } = await execFileAsync(this.latexCommand, [
        '-interaction=nonstopmode',
        '-output-directory', this.tempDir,
        texFile
      ], {
        timeout: this.timeout
      });

      // Check if PDF was generated
      try {
        const pdfStats = await fs.stat(pdfFile);
        if (pdfStats.size === 0) {
          throw new Error('Generated PDF is empty');
        }
      } catch {
        throw new Error('PDF was not generated');
      }

      // Cleanup test files
      await this.cleanupTestFiles(name);
      
      return {
        success: true,
        stdout,
        stderr
      };
      
    } catch (error) {
      // Try to extract more detailed error information
      const logFile = join(this.tempDir, `test_${name}.log`);
      try {
        const logContent = await fs.readFile(logFile, 'utf8');
        const errorMatch = logContent.match(/! (.+)/g);
        if (errorMatch) {
          error.latexErrors = errorMatch;
        }
      } catch {
        // Log file might not exist
      }
      
      throw error;
    }
  }

  /**
   * Check if specific LaTeX packages are available
   */
  async checkPackages(packages) {
    const results = {};
    
    for (const pkg of packages) {
      try {
        const testDoc = `\\documentclass{article}
\\usepackage{${pkg}}
\\begin{document}
Test
\\end{document}`;
        
        await this.testCompilation(`pkg_${pkg}`, testDoc);
        results[pkg] = true;
      } catch {
        results[pkg] = false;
      }
    }
    
    return results;
  }

  /**
   * Generate a validation report
   */
  async generateReport() {
    const validation = await this.validateInstallation();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        latexInstalled: validation.installed,
        version: validation.version,
        basicCompilation: validation.compilation.minimal,
        advancedCompilation: validation.compilation.withPackages,
        resumeSupport: validation.compilation.resume,
        errorCount: validation.errors.length
      },
      details: validation,
      recommendations: this.generateRecommendations(validation)
    };
    
    return report;
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations(validation) {
    const recommendations = [];
    
    if (!validation.installed) {
      recommendations.push({
        type: 'critical',
        message: 'Install LaTeX distribution (TeX Live, MiKTeX, or MacTeX)',
        action: 'Install LaTeX'
      });
    }
    
    if (validation.installed && !validation.compilation.minimal) {
      recommendations.push({
        type: 'error',
        message: 'Basic LaTeX compilation fails - check installation',
        action: 'Reinstall LaTeX'
      });
    }
    
    if (!validation.packages.geometry || !validation.packages.hyperref) {
      recommendations.push({
        type: 'warning',
        message: 'Essential packages missing - install complete LaTeX distribution',
        action: 'Install missing packages'
      });
    }
    
    if (!validation.packages.moderncv) {
      recommendations.push({
        type: 'info',
        message: 'ModernCV package not available - resume templates will be limited',
        action: 'Install moderncv package'
      });
    }
    
    if (validation.errors.length === 0 && validation.compilation.resume) {
      recommendations.push({
        type: 'success',
        message: 'LaTeX installation is fully functional for PDF generation',
        action: 'Ready to use'
      });
    }
    
    return recommendations;
  }

  /**
   * Fix common LaTeX issues automatically
   */
  async attemptFixes() {
    const fixes = [];
    
    try {
      // Try to update package database
      await execFileAsync('tlmgr', ['update', '--self'], { timeout: 60000 });
      fixes.push('Updated TeX Live manager');
    } catch {
      // tlmgr might not be available
    }
    
    try {
      // Try to install common packages
      const packages = ['geometry', 'hyperref', 'moderncv'];
      for (const pkg of packages) {
        try {
          await execFileAsync('tlmgr', ['install', pkg], { timeout: 30000 });
          fixes.push(`Installed package: ${pkg}`);
        } catch {
          // Package might already be installed or tlmgr not available
        }
      }
    } catch {
      // tlmgr operations failed
    }
    
    return fixes;
  }

  /**
   * Cleanup test files
   */
  async cleanupTestFiles(name) {
    const extensions = ['.tex', '.pdf', '.aux', '.log', '.out', '.fdb_latexmk', '.fls'];
    
    for (const ext of extensions) {
      try {
        await fs.unlink(join(this.tempDir, `test_${name}${ext}`));
      } catch {
        // File might not exist
      }
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  /**
   * Get LaTeX installation info
   */
  async getInstallationInfo() {
    const info = {
      command: this.latexCommand,
      available: false,
      version: null,
      distribution: null,
      path: null
    };
    
    try {
      const { stdout } = await execFileAsync('which', [this.latexCommand]);
      info.path = stdout.trim();
      info.available = true;
      
      const versionResult = await this.checkLatexVersion();
      info.version = versionResult.version;
      
      // Detect distribution
      if (versionResult.output.includes('TeX Live')) {
        info.distribution = 'TeX Live';
      } else if (versionResult.output.includes('MiKTeX')) {
        info.distribution = 'MiKTeX';
      } else {
        info.distribution = 'Unknown';
      }
      
    } catch {
      // LaTeX not available or detection failed
    }
    
    return info;
  }
}

export { LaTeXValidator, TEST_DOCUMENTS };
