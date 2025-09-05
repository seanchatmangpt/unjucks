import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'

export interface SecurityVulnerability {
  id: string
  type: SecurityVulnerabilityType
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  file?: string
  line?: number
  column?: number
  code?: string
  recommendation: string
  cwe?: string // Common Weakness Enumeration
  cvss?: number // Common Vulnerability Scoring System
  references: string[]
  firstDetected: string
  status: 'active' | 'acknowledged' | 'fixed' | 'false-positive'
}

export type SecurityVulnerabilityType =
  | 'hardcoded-secret'
  | 'sql-injection'
  | 'xss'
  | 'command-injection'
  | 'path-traversal'
  | 'insecure-random'
  | 'weak-crypto'
  | 'unsafe-deserialization'
  | 'insecure-regex'
  | 'dependency-vulnerability'
  | 'prototype-pollution'
  | 'eval-injection'
  | 'open-redirect'
  | 'information-disclosure'
  | 'insecure-cors'

export interface SecurityReport {
  timestamp: string
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    risk_score: number
    security_grade: 'A' | 'B' | 'C' | 'D' | 'F'
  }
  vulnerabilities: SecurityVulnerability[]
  dependencies: DependencySecurityAnalysis
  recommendations: SecurityRecommendation[]
  compliance: ComplianceCheck[]
  trends: SecurityTrendData
}

export interface DependencySecurityAnalysis {
  total_dependencies: number
  vulnerable_dependencies: number
  vulnerabilities: Array<{
    package: string
    version: string
    severity: string
    vulnerability: string
    patched_in?: string
  }>
}

export interface SecurityRecommendation {
  category: 'immediate' | 'short-term' | 'long-term'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

export interface ComplianceCheck {
  standard: 'OWASP-Top10' | 'CWE-Top25' | 'SANS-Top25' | 'NIST-CSF'
  status: 'compliant' | 'non-compliant' | 'partial'
  score: number
  details: string[]
}

export interface SecurityTrendData {
  vulnerabilities_over_time: Array<{ date: string; count: number }>
  severity_distribution: { critical: number; high: number; medium: number; low: number }
  resolution_time: { avg_days: number; median_days: number }
}

export class SecurityReporter {
  private reportDir = 'reports/security'
  private securityPatterns: Map<SecurityVulnerabilityType, RegExp[]> = new Map()
  private historicalData: SecurityReport[] = []

  constructor() {
    this.initializeSecurityPatterns()
  }

  async initialize() {
    await fs.ensureDir(this.reportDir)
    await this.loadHistoricalData()
  }

  async generateSecurityReport(sourceFiles: string[]): Promise<SecurityReport> {
    console.log('🔒 Starting security vulnerability analysis...')
    
    const vulnerabilities = await this.scanForVulnerabilities(sourceFiles)
    const dependencyAnalysis = await this.analyzeDependencies()
    const summary = this.calculateSummary(vulnerabilities)
    const recommendations = this.generateRecommendations(vulnerabilities, dependencyAnalysis)
    const compliance = await this.checkCompliance(vulnerabilities)
    const trends = await this.analyzeTrends(vulnerabilities)

    const report: SecurityReport = {
      timestamp: new Date().toISOString(),
      summary,
      vulnerabilities,
      dependencies: dependencyAnalysis,
      recommendations,
      compliance,
      trends
    }

    await this.saveReport(report)
    await this.generateReports(report)
    await this.updateHistoricalData(report)

    return report
  }

  private initializeSecurityPatterns() {
    this.securityPatterns.set('hardcoded-secret', [
      /password\s*[=:]\s*['"]['"]?[^'";\s]{8,}/i,
      /api[_-]?key\s*[=:]\s*['"]['"]?[A-Za-z0-9]{20,}/i,
      /secret\s*[=:]\s*['"]['"]?[^'";\s]{8,}/i,
      /token\s*[=:]\s*['"]['"]?[A-Za-z0-9+/=]{20,}/i,
      /private[_-]?key\s*[=:]/i,
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
      /AKIA[0-9A-Z]{16}/, // AWS Access Key
      /ghp_[A-Za-z0-9]{36}/, // GitHub Personal Access Token
      /sk-[A-Za-z0-9]{48}/, // OpenAI API Key
    ]),

    this.securityPatterns.set('sql-injection', [
      /\$\{.*\$\{.*\}/,
      /"[^"]*"\s*\+.*\+\s*"[^"]*"/,
      /WHERE.*=.*\$\{/i,
      /SELECT.*FROM.*WHERE.*\+/i,
      /UPDATE.*SET.*\+/i,
      /INSERT.*VALUES.*\+/i,
      /DELETE.*WHERE.*\+/i,
    ]),

    this.securityPatterns.set('xss', [
      /document\.write\s*\(/,
      /innerHTML\s*=.*\+/,
      /outerHTML\s*=.*\+/,
      /\.html\(\).*\+/,
      /\$\([^)]*\)\.html\(/,
      /dangerouslySetInnerHTML/,
      /v-html\s*=/,
    ]),

    this.securityPatterns.set('command-injection', [
      /exec\s*\(\s*[^)]*\+/,
      /spawn\s*\(\s*[^)]*\+/,
      /system\s*\(\s*[^)]*\+/,
      /shell_exec\s*\(\s*[^)]*\+/,
      /eval\s*\(\s*[^)]*\+/,
      /Function\s*\(\s*[^)]*\+/,
      /process\.env\[.*\+/,
    ]),

    this.securityPatterns.set('path-traversal', [
      /\.\.\//,
      /\.\.\\\\'/,
      /path\.join\([^)]*\+/,
      /fs\.readFile\([^)]*\+/,
      /fs\.writeFile\([^)]*\+/,
      /require\([^)]*\+/,
    ]),

    this.securityPatterns.set('insecure-random', [
      /Math\.random\(\)/,
      /Random\(\)/,
      /new Random\(\)/,
    ]),

    this.securityPatterns.set('weak-crypto', [
      /md5|sha1/i,
      /DES|3DES/i,
      /RC4/i,
      /createCipher\(/,
      /createHash\(['"]md5/i,
      /createHash\(['"]sha1/i,
    ]),

    this.securityPatterns.set('unsafe-deserialization', [
      /JSON\.parse\([^)]*\+/,
      /unserialize\(/,
      /pickle\.loads/,
      /eval\s*\(\s*JSON\.parse/,
    ]),

    this.securityPatterns.set('insecure-regex', [
      /\(\.\*\)\+/,
      /\(\.\+\)\*/,
      /\(\w\*\)\+/,
      /\(\[\^\]\*\)\+/,
    ]),

    this.securityPatterns.set('eval-injection', [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(\s*['"]/,
      /setInterval\s*\(\s*['"]/,
      /new\s+Function\s*\(/,
    ]),

    this.securityPatterns.set('prototype-pollution', [
      /\[\s*['"]__proto__['"]\s*\]/,
      /\[\s*['"]constructor['"]\s*\]/,
      /\[\s*['"]prototype['"]\s*\]/,
      /Object\.setPrototypeOf/,
      /Reflect\.setPrototypeOf/,
    ])

    this.securityPatterns.set('information-disclosure', [
      /console\.log\(/,
      /console\.error\(/,
      /console\.warn\(/,
      /console\.debug\(/,
      /\.stack/,
      /process\.env/,
      /Error\([^)]*\+/,
    ])
  }

  private async scanForVulnerabilities(sourceFiles: string[]): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = []
    
    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        const lines = content.split('\n')
        
        for (const [type, patterns] of this.securityPatterns) {
          for (const pattern of patterns) {
            let lineIndex = 0
            for (const line of lines) {
              lineIndex++
              const matches = line.match(pattern)
              
              if (matches) {
                const vulnerability = await this.createVulnerability(
                  type,
                  file,
                  lineIndex,
                  line,
                  matches[0]
                )
                vulnerabilities.push(vulnerability)
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Could not scan file ${file}: ${error}`)
      }
    }

    return vulnerabilities
  }

  private async createVulnerability(
    type: SecurityVulnerabilityType,
    file: string,
    line: number,
    code: string,
    match: string
  ): Promise<SecurityVulnerability> {
    const id = crypto.randomUUID()
    const vulnerability: SecurityVulnerability = {
      id,
      type,
      severity: this.getSeverity(type),
      title: this.getTitle(type),
      description: this.getDescription(type),
      file: file.replace(process.cwd(), ''),
      line,
      code: code.trim(),
      recommendation: this.getRecommendation(type),
      cwe: this.getCWE(type),
      cvss: this.getCVSS(type),
      references: this.getReferences(type),
      firstDetected: new Date().toISOString(),
      status: 'active'
    }

    return vulnerability
  }

  private getSeverity(type: SecurityVulnerabilityType): SecurityVulnerability['severity'] {
    const severityMap: Record<SecurityVulnerabilityType, SecurityVulnerability['severity']> = {
      'hardcoded-secret': 'critical',
      'sql-injection': 'critical',
      'command-injection': 'critical',
      'eval-injection': 'high',
      'xss': 'high',
      'path-traversal': 'high',
      'unsafe-deserialization': 'high',
      'prototype-pollution': 'high',
      'weak-crypto': 'medium',
      'insecure-random': 'medium',
      'insecure-regex': 'medium',
      'dependency-vulnerability': 'medium',
      'open-redirect': 'medium',
      'insecure-cors': 'medium',
      'information-disclosure': 'low'
    }
    return severityMap[type] || 'medium'
  }

  private getTitle(type: SecurityVulnerabilityType): string {
    const titleMap: Record<SecurityVulnerabilityType, string> = {
      'hardcoded-secret': 'Hardcoded Secret',
      'sql-injection': 'SQL Injection Vulnerability',
      'xss': 'Cross-Site Scripting (XSS)',
      'command-injection': 'Command Injection',
      'path-traversal': 'Path Traversal',
      'insecure-random': 'Insecure Random Number Generation',
      'weak-crypto': 'Weak Cryptographic Algorithm',
      'unsafe-deserialization': 'Unsafe Deserialization',
      'insecure-regex': 'Insecure Regular Expression',
      'dependency-vulnerability': 'Vulnerable Dependency',
      'prototype-pollution': 'Prototype Pollution',
      'eval-injection': 'Code Injection via eval()',
      'open-redirect': 'Open Redirect',
      'information-disclosure': 'Information Disclosure',
      'insecure-cors': 'Insecure CORS Configuration'
    }
    return titleMap[type] || 'Security Vulnerability'
  }

  private getDescription(type: SecurityVulnerabilityType): string {
    const descriptionMap: Record<SecurityVulnerabilityType, string> = {
      'hardcoded-secret': 'Sensitive information like passwords, API keys, or secrets are hardcoded in source code.',
      'sql-injection': 'User input is concatenated into SQL queries without proper sanitization.',
      'xss': 'User input is rendered in HTML context without proper encoding.',
      'command-injection': 'User input is used in system commands without proper validation.',
      'path-traversal': 'File paths are constructed using user input without validation.',
      'insecure-random': 'Math.random() is used for cryptographic purposes.',
      'weak-crypto': 'Weak cryptographic algorithms are used for security operations.',
      'unsafe-deserialization': 'Untrusted data is deserialized without validation.',
      'insecure-regex': 'Regular expression is vulnerable to ReDoS attacks.',
      'dependency-vulnerability': 'Project uses dependencies with known security vulnerabilities.',
      'prototype-pollution': 'Object prototype can be polluted through user input.',
      'eval-injection': 'Dynamic code execution using eval() with untrusted input.',
      'open-redirect': 'Application redirects to user-controlled URLs.',
      'information-disclosure': 'Sensitive information is exposed in logs or error messages.',
      'insecure-cors': 'CORS is configured to allow overly permissive access.'
    }
    return descriptionMap[type] || 'Security vulnerability detected'
  }

  private getRecommendation(type: SecurityVulnerabilityType): string {
    const recommendationMap: Record<SecurityVulnerabilityType, string> = {
      'hardcoded-secret': 'Use environment variables or secure vaults to store sensitive information.',
      'sql-injection': 'Use parameterized queries or ORM methods to prevent SQL injection.',
      'xss': 'Encode user input before rendering in HTML and use Content Security Policy.',
      'command-injection': 'Validate and sanitize all user input before using in system commands.',
      'path-traversal': 'Validate file paths and use path.resolve() to prevent directory traversal.',
      'insecure-random': 'Use crypto.randomBytes() for cryptographically secure random numbers.',
      'weak-crypto': 'Use strong algorithms like AES-256 and SHA-256 or higher.',
      'unsafe-deserialization': 'Validate and sanitize data before deserialization.',
      'insecure-regex': 'Review regex patterns for exponential backtracking vulnerabilities.',
      'dependency-vulnerability': 'Update dependencies to patched versions.',
      'prototype-pollution': 'Validate object keys and use Map instead of Object for user data.',
      'eval-injection': 'Avoid eval() and use safer alternatives like JSON.parse().',
      'open-redirect': 'Validate redirect URLs against an allowlist.',
      'information-disclosure': 'Remove sensitive information from logs and error messages.',
      'insecure-cors': 'Configure CORS with specific origins and avoid wildcards.'
    }
    return recommendationMap[type] || 'Review and fix the security vulnerability'
  }

  private getCWE(type: SecurityVulnerabilityType): string {
    const cweMap: Record<SecurityVulnerabilityType, string> = {
      'hardcoded-secret': 'CWE-798',
      'sql-injection': 'CWE-89',
      'xss': 'CWE-79',
      'command-injection': 'CWE-78',
      'path-traversal': 'CWE-22',
      'insecure-random': 'CWE-330',
      'weak-crypto': 'CWE-327',
      'unsafe-deserialization': 'CWE-502',
      'insecure-regex': 'CWE-400',
      'dependency-vulnerability': 'CWE-1035',
      'prototype-pollution': 'CWE-1321',
      'eval-injection': 'CWE-94',
      'open-redirect': 'CWE-601',
      'information-disclosure': 'CWE-200',
      'insecure-cors': 'CWE-942'
    }
    return cweMap[type] || 'CWE-1'
  }

  private getCVSS(type: SecurityVulnerabilityType): number {
    const cvssMap: Record<SecurityVulnerabilityType, number> = {
      'hardcoded-secret': 9.1,
      'sql-injection': 9.8,
      'command-injection': 9.8,
      'eval-injection': 8.8,
      'xss': 8.2,
      'path-traversal': 7.5,
      'unsafe-deserialization': 7.5,
      'prototype-pollution': 7.3,
      'weak-crypto': 5.9,
      'insecure-random': 5.9,
      'insecure-regex': 5.3,
      'dependency-vulnerability': 5.0,
      'open-redirect': 4.3,
      'insecure-cors': 4.3,
      'information-disclosure': 3.7
    }
    return cvssMap[type] || 5.0
  }

  private getReferences(type: SecurityVulnerabilityType): string[] {
    const baseReferences = [
      'https://owasp.org/Top10/',
      'https://cwe.mitre.org/'
    ]

    const specificReferences: Record<SecurityVulnerabilityType, string[]> = {
      'hardcoded-secret': [
        'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
        'https://cwe.mitre.org/data/definitions/798.html'
      ],
      'sql-injection': [
        'https://owasp.org/www-community/attacks/SQL_Injection',
        'https://cwe.mitre.org/data/definitions/89.html'
      ],
      'xss': [
        'https://owasp.org/www-community/attacks/xss/',
        'https://cwe.mitre.org/data/definitions/79.html'
      ]
    }

    return [...baseReferences, ...(specificReferences[type] || [])]
  }

  private async analyzeDependencies(): Promise<DependencySecurityAnalysis> {
    try {
      const packageJson = await fs.readJson(path.join(process.cwd(), 'package.json'))
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }
      
      const totalDependencies = Object.keys(allDeps).length
      
      // Try to run npm audit for real vulnerability data
      let auditResults: any = { vulnerabilities: {} }
      try {
        const auditOutput = execSync('npm audit --json', { encoding: 'utf-8' })
        auditResults = JSON.parse(auditOutput)
      } catch (error) {
        console.warn('npm audit failed, using empty results')
      }

      const vulnerabilities = Object.entries(auditResults.vulnerabilities || {}).map(([pkg, vuln]: [string, any]) => ({
        package: pkg,
        version: vuln.via?.[0]?.versions || 'unknown',
        severity: vuln.severity || 'unknown',
        vulnerability: vuln.via?.[0]?.title || 'Unknown vulnerability',
        patched_in: vuln.fixAvailable ? 'Available' : undefined
      }))

      return {
        total_dependencies: totalDependencies,
        vulnerable_dependencies: vulnerabilities.length,
        vulnerabilities
      }
    } catch (error) {
      return {
        total_dependencies: 0,
        vulnerable_dependencies: 0,
        vulnerabilities: []
      }
    }
  }

  private calculateSummary(vulnerabilities: SecurityVulnerability[]) {
    const total = vulnerabilities.length
    const critical = vulnerabilities.filter(v => v.severity === 'critical').length
    const high = vulnerabilities.filter(v => v.severity === 'high').length
    const medium = vulnerabilities.filter(v => v.severity === 'medium').length
    const low = vulnerabilities.filter(v => v.severity === 'low').length

    // Risk score calculation (0-100, higher is worse)
    const riskScore = Math.min(100, critical * 20 + high * 10 + medium * 5 + low * 1)
    
    // Security grade
    let securityGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (riskScore === 0) securityGrade = 'A'
    else if (riskScore <= 10) securityGrade = 'B'
    else if (riskScore <= 25) securityGrade = 'C'
    else if (riskScore <= 50) securityGrade = 'D'
    else securityGrade = 'F'

    return {
      total,
      critical,
      high,
      medium,
      low,
      risk_score: riskScore,
      security_grade: securityGrade
    }
  }

  private generateRecommendations(
    vulnerabilities: SecurityVulnerability[],
    dependencies: DependencySecurityAnalysis
  ): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = []

    // Critical vulnerabilities
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical')
    if (criticalVulns.length > 0) {
      recommendations.push({
        category: 'immediate',
        priority: 'high',
        title: 'Address Critical Security Vulnerabilities',
        description: `${criticalVulns.length} critical vulnerabilities require immediate attention`,
        effort: 'high',
        impact: 'high'
      })
    }

    // Dependency vulnerabilities
    if (dependencies.vulnerable_dependencies > 0) {
      recommendations.push({
        category: 'immediate',
        priority: 'high',
        title: 'Update Vulnerable Dependencies',
        description: `${dependencies.vulnerable_dependencies} dependencies have known security vulnerabilities`,
        effort: 'medium',
        impact: 'high'
      })
    }

    // Security practices
    recommendations.push({
      category: 'short-term',
      priority: 'medium',
      title: 'Implement Security Headers',
      description: 'Add security headers like CSP, HSTS, and X-Frame-Options',
      effort: 'low',
      impact: 'medium'
    })

    recommendations.push({
      category: 'short-term',
      priority: 'medium',
      title: 'Set up Automated Security Scanning',
      description: 'Integrate security scanning into CI/CD pipeline',
      effort: 'medium',
      impact: 'medium'
    })

    recommendations.push({
      category: 'long-term',
      priority: 'medium',
      title: 'Security Training and Code Review',
      description: 'Provide security training and implement security-focused code reviews',
      effort: 'high',
      impact: 'medium'
    })

    return recommendations
  }

  private async checkCompliance(vulnerabilities: SecurityVulnerability[]): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = []

    // OWASP Top 10 compliance
    const owaspIssues = vulnerabilities.filter(v => 
      ['sql-injection', 'xss', 'insecure-deserialization', 'weak-crypto'].includes(v.type)
    )
    checks.push({
      standard: 'OWASP-Top10',
      status: owaspIssues.length === 0 ? 'compliant' : 'non-compliant',
      score: Math.max(0, 100 - owaspIssues.length * 10),
      details: owaspIssues.map(v => `${v.type} in ${v.file}`)
    })

    // CWE Top 25 compliance  
    const cweIssues = vulnerabilities.filter(v => v.cwe)
    checks.push({
      standard: 'CWE-Top25',
      status: cweIssues.length === 0 ? 'compliant' : 'partial',
      score: Math.max(0, 100 - cweIssues.length * 5),
      details: cweIssues.map(v => `${v.cwe}: ${v.title}`)
    })

    return checks
  }

  private async analyzeTrends(vulnerabilities: SecurityVulnerability[]): Promise<SecurityTrendData> {
    // For now, return current state - in real implementation would compare with historical data
    const severityDistribution = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    }

    return {
      vulnerabilities_over_time: [
        { date: new Date().toISOString().split('T')[0], count: vulnerabilities.length }
      ],
      severity_distribution: severityDistribution,
      resolution_time: { avg_days: 0, median_days: 0 } // Would calculate from historical data
    }
  }

  private async saveReport(report: SecurityReport) {
    await fs.writeJson(
      path.join(this.reportDir, 'security-report.json'),
      report,
      { spaces: 2 }
    )
  }

  private async generateReports(report: SecurityReport) {
    // Generate HTML report
    const html = this.generateHtmlReport(report)
    await fs.writeFile(path.join(this.reportDir, 'security-report.html'), html)

    // Generate SARIF report for GitHub integration
    const sarif = this.generateSarifReport(report)
    await fs.writeJson(path.join(this.reportDir, 'security-report.sarif'), sarif, { spaces: 2 })

    // Generate CSV for analysis
    const csv = this.generateCsvReport(report)
    await fs.writeFile(path.join(this.reportDir, 'security-vulnerabilities.csv'), csv)
  }

  private generateHtmlReport(report: SecurityReport): string {
    const gradeColors = {
      A: '#27ae60', B: '#3498db', C: '#f39c12', D: '#e67e22', F: '#e74c3c'
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Security Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f8f9fa; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .critical { color: #e74c3c; }
        .high { color: #e67e22; }
        .medium { color: #f39c12; }
        .low { color: #3498db; }
        .grade-${report.summary.security_grade.toLowerCase()} { color: ${gradeColors[report.summary.security_grade]}; }
        .vulnerabilities { background: white; border-radius: 10px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .vulnerability { border-left: 4px solid #ddd; padding: 15px; margin: 10px 0; background: #f8f9fa; }
        .vulnerability.critical { border-color: #e74c3c; }
        .vulnerability.high { border-color: #e67e22; }
        .vulnerability.medium { border-color: #f39c12; }
        .vulnerability.low { border-color: #3498db; }
        .code-snippet { background: #2c3e50; color: #ecf0f1; padding: 10px; border-radius: 4px; margin: 10px 0; font-family: monospace; }
        .recommendations { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .recommendation { padding: 10px; margin: 10px 0; border-left: 4px solid #3498db; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security Vulnerability Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value grade-${report.summary.security_grade.toLowerCase()}">${report.summary.security_grade}</div>
                <div class="metric-label">Security Grade</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.risk_score}</div>
                <div class="metric-label">Risk Score</div>
            </div>
            <div class="metric">
                <div class="metric-value critical">${report.summary.critical}</div>
                <div class="metric-label">Critical</div>
            </div>
            <div class="metric">
                <div class="metric-value high">${report.summary.high}</div>
                <div class="metric-label">High</div>
            </div>
            <div class="metric">
                <div class="metric-value medium">${report.summary.medium}</div>
                <div class="metric-label">Medium</div>
            </div>
            <div class="metric">
                <div class="metric-value low">${report.summary.low}</div>
                <div class="metric-label">Low</div>
            </div>
        </div>

        <div class="vulnerabilities">
            <h3>🚨 Security Vulnerabilities</h3>
            ${report.vulnerabilities.map(vuln => `
                <div class="vulnerability ${vuln.severity}">
                    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin: 0;">${vuln.title}</h4>
                        <span class="badge ${vuln.severity}" style="background: var(--${vuln.severity}-color); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${vuln.severity.toUpperCase()}</span>
                    </div>
                    <p>${vuln.description}</p>
                    <p><strong>File:</strong> ${vuln.file}:${vuln.line}</p>
                    <div class="code-snippet">${vuln.code}</div>
                    <p><strong>Recommendation:</strong> ${vuln.recommendation}</p>
                    <p><strong>CWE:</strong> ${vuln.cwe} | <strong>CVSS:</strong> ${vuln.cvss}</p>
                </div>
            `).join('')}
        </div>

        <div class="recommendations">
            <h3>💡 Security Recommendations</h3>
            ${report.recommendations.map(rec => `
                <div class="recommendation">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                    <p><strong>Priority:</strong> ${rec.priority} | <strong>Effort:</strong> ${rec.effort} | <strong>Impact:</strong> ${rec.impact}</p>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`
  }

  private generateSarifReport(report: SecurityReport) {
    return {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'Unjucks Security Scanner',
            version: '1.0.0',
            informationUri: 'https://github.com/unjs/unjucks'
          }
        },
        results: report.vulnerabilities.map(vuln => ({
          ruleId: vuln.type,
          ruleIndex: 0,
          message: { text: vuln.description },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: vuln.file },
              region: {
                startLine: vuln.line,
                startColumn: vuln.column || 1
              }
            }
          }],
          level: vuln.severity === 'critical' ? 'error' : 
                 vuln.severity === 'high' ? 'error' :
                 vuln.severity === 'medium' ? 'warning' : 'note'
        }))
      }]
    }
  }

  private generateCsvReport(report: SecurityReport): string {
    const headers = [
      'ID', 'Type', 'Severity', 'Title', 'File', 'Line', 
      'CWE', 'CVSS', 'Status', 'First Detected'
    ].join(',')

    const rows = report.vulnerabilities.map(vuln => [
      vuln.id,
      vuln.type,
      vuln.severity,
      `"${vuln.title}"`,
      `"${vuln.file}"`,
      vuln.line || '',
      vuln.cwe || '',
      vuln.cvss || '',
      vuln.status,
      vuln.firstDetected
    ].join(','))

    return [headers, ...rows].join('\n')
  }

  private async loadHistoricalData() {
    try {
      const historyFile = path.join(this.reportDir, 'security-history.json')
      this.historicalData = await fs.readJson(historyFile)
    } catch {
      this.historicalData = []
    }
  }

  private async updateHistoricalData(report: SecurityReport) {
    this.historicalData.push(report)
    
    // Keep only last 50 reports
    if (this.historicalData.length > 50) {
      this.historicalData = this.historicalData.slice(-50)
    }

    await fs.writeJson(
      path.join(this.reportDir, 'security-history.json'),
      this.historicalData,
      { spaces: 2 }
    )
  }
}

// Export singleton instance
export const securityReporter = new SecurityReporter()