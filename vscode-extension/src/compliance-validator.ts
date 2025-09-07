import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

export interface ComplianceRule {
    id: string;
    name: string;
    description: string;
    category: 'security' | 'style' | 'performance' | 'accessibility' | 'best-practices';
    severity: 'error' | 'warning' | 'info';
    pattern?: RegExp;
    validator?: (content: string, filePath: string) => ComplianceIssue[];
    autoFix?: (content: string, filePath: string) => string;
}

export interface ComplianceIssue {
    ruleId: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    range?: vscode.Range;
    fixable: boolean;
    suggestion?: string;
}

export interface ComplianceReport {
    filePath: string;
    issues: ComplianceIssue[];
    score: number;
    timestamp: string;
}

export class ComplianceValidator implements vscode.Disposable {
    private rules: Map<string, ComplianceRule> = new Map();
    private diagnosticCollection: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;

    constructor(private context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('unjucks-compliance');
        this.outputChannel = vscode.window.createOutputChannel('Unjucks Compliance');
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            97
        );

        this.initializeRules();
        this.setupEventHandlers();
    }

    async validateCurrentFile(): Promise<ComplianceReport | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor to validate');
            return undefined;
        }

        const report = await this.validateFile(editor.document);
        
        if (report) {
            await this.showComplianceReport(report);
        }

        return report;
    }

    async validateFile(document: vscode.TextDocument): Promise<ComplianceReport> {
        const content = document.getText();
        const filePath = document.uri.fsPath;
        const issues: ComplianceIssue[] = [];

        // Run all applicable rules
        for (const rule of this.rules.values()) {
            if (this.isRuleApplicable(rule, filePath, document.languageId)) {
                const ruleIssues = await this.runRule(rule, content, filePath, document);
                issues.push(...ruleIssues);
            }
        }

        const score = this.calculateComplianceScore(issues);
        
        const report: ComplianceReport = {
            filePath,
            issues,
            score,
            timestamp: new Date().toISOString()
        };

        // Update diagnostics
        this.updateDiagnostics(document, issues);
        
        // Update status bar
        this.updateStatusBar(score, issues.length);

        return report;
    }

    async validateGenerated(targetPath: string): Promise<ComplianceReport[]> {
        const reports: ComplianceReport[] = [];
        
        try {
            const files = await this.getGeneratedFiles(targetPath);
            
            for (const filePath of files) {
                if (this.shouldValidateFile(filePath)) {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    const report = await this.validateFile(document);
                    reports.push(report);
                }
            }

            // Show summary if multiple files
            if (reports.length > 1) {
                await this.showValidationSummary(reports);
            }

        } catch (error) {
            this.outputChannel.appendLine(`Validation error: ${error}`);
        }

        return reports;
    }

    async fixIssues(document: vscode.TextDocument, issues?: ComplianceIssue[]): Promise<boolean> {
        const targetIssues = issues || (await this.validateFile(document)).issues;
        const fixableIssues = targetIssues.filter(issue => issue.fixable);

        if (fixableIssues.length === 0) {
            vscode.window.showInformationMessage('No auto-fixable issues found');
            return false;
        }

        const action = await vscode.window.showInformationMessage(
            `Auto-fix ${fixableIssues.length} issue(s)?`,
            'Fix All',
            'Fix Selected',
            'Cancel'
        );

        if (!action || action === 'Cancel') {
            return false;
        }

        let issuesToFix = fixableIssues;
        
        if (action === 'Fix Selected') {
            const selected = await vscode.window.showQuickPick(
                fixableIssues.map(issue => ({
                    label: issue.message,
                    description: `Line ${issue.line || '?'}`,
                    detail: issue.suggestion,
                    issue
                })),
                { canPickMany: true, placeHolder: 'Select issues to fix' }
            );
            
            if (!selected || selected.length === 0) {
                return false;
            }
            
            issuesToFix = selected.map(s => s.issue);
        }

        // Apply fixes
        const edit = new vscode.WorkspaceEdit();
        let content = document.getText();

        for (const issue of issuesToFix) {
            const rule = this.rules.get(issue.ruleId);
            if (rule && rule.autoFix) {
                content = rule.autoFix(content, document.uri.fsPath);
            }
        }

        // Apply the entire fixed content
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        
        edit.replace(document.uri, fullRange, content);
        
        const success = await vscode.workspace.applyEdit(edit);
        
        if (success) {
            vscode.window.showInformationMessage(
                `Fixed ${issuesToFix.length} compliance issue(s)`
            );
        }

        return success;
    }

    private initializeRules(): void {
        const rules: ComplianceRule[] = [
            // Security Rules
            {
                id: 'no-hardcoded-secrets',
                name: 'No Hardcoded Secrets',
                description: 'Detect hardcoded API keys, passwords, and tokens',
                category: 'security',
                severity: 'error',
                validator: (content, filePath) => {
                    const issues: ComplianceIssue[] = [];
                    const lines = content.split('\n');
                    
                    const secretPatterns = [
                        { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, name: 'API Key' },
                        { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Password' },
                        { pattern: /token\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Token' },
                        { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Secret' }
                    ];
                    
                    lines.forEach((line, index) => {
                        secretPatterns.forEach(({ pattern, name }) => {
                            if (pattern.test(line)) {
                                issues.push({
                                    ruleId: 'no-hardcoded-secrets',
                                    severity: 'error',
                                    message: `Potential hardcoded ${name} detected`,
                                    line: index + 1,
                                    column: 0,
                                    fixable: false,
                                    suggestion: `Move ${name} to environment variable`
                                });
                            }
                        });
                    });
                    
                    return issues;
                }
            },
            
            // Style Rules
            {
                id: 'consistent-naming',
                name: 'Consistent Naming Convention',
                description: 'Ensure consistent naming conventions',
                category: 'style',
                severity: 'warning',
                validator: (content, filePath) => {
                    const issues: ComplianceIssue[] = [];
                    const ext = path.extname(filePath);
                    
                    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
                        const lines = content.split('\n');
                        
                        lines.forEach((line, index) => {
                            // Check function naming (should be camelCase)
                            const functionMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                            if (functionMatch) {
                                const funcName = functionMatch[1];
                                if (!/^[a-z][a-zA-Z0-9]*$/.test(funcName) && funcName !== 'constructor') {
                                    issues.push({
                                        ruleId: 'consistent-naming',
                                        severity: 'warning',
                                        message: `Function '${funcName}' should use camelCase`,
                                        line: index + 1,
                                        column: line.indexOf(funcName),
                                        fixable: true,
                                        suggestion: `Rename to ${this.toCamelCase(funcName)}`
                                    });
                                }
                            }
                            
                            // Check variable naming (should be camelCase)
                            const varMatch = line.match(/(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                            if (varMatch) {
                                const varName = varMatch[1];
                                if (!/^[a-z][a-zA-Z0-9]*$/.test(varName)) {
                                    issues.push({
                                        ruleId: 'consistent-naming',
                                        severity: 'warning',
                                        message: `Variable '${varName}' should use camelCase`,
                                        line: index + 1,
                                        column: line.indexOf(varName),
                                        fixable: true,
                                        suggestion: `Rename to ${this.toCamelCase(varName)}`
                                    });
                                }
                            }
                        });
                    }
                    
                    return issues;
                },
                autoFix: (content, filePath) => {
                    // Simple auto-fix for naming (basic implementation)
                    return content.replace(/function\s+([A-Z][a-zA-Z0-9_]*)/g, (match, name) => {
                        return `function ${this.toCamelCase(name)}`;
                    });
                }
            },
            
            // Performance Rules
            {
                id: 'no-console-log',
                name: 'No Console Logs in Production',
                description: 'Remove console.log statements from production code',
                category: 'performance',
                severity: 'warning',
                pattern: /console\.log\s*\(/g,
                validator: (content, filePath) => {
                    const issues: ComplianceIssue[] = [];
                    const lines = content.split('\n');
                    
                    lines.forEach((line, index) => {
                        if (/console\.log\s*\(/.test(line)) {
                            issues.push({
                                ruleId: 'no-console-log',
                                severity: 'warning',
                                message: 'console.log statement found',
                                line: index + 1,
                                column: line.indexOf('console.log'),
                                fixable: true,
                                suggestion: 'Remove console.log or replace with proper logging'
                            });
                        }
                    });
                    
                    return issues;
                },
                autoFix: (content, filePath) => {
                    return content.replace(/console\.log\s*\([^)]*\);\s*\n?/g, '');
                }
            },
            
            // Accessibility Rules
            {
                id: 'img-alt-text',
                name: 'Image Alt Text',
                description: 'Ensure images have alt text for accessibility',
                category: 'accessibility',
                severity: 'warning',
                validator: (content, filePath) => {
                    const issues: ComplianceIssue[] = [];
                    const lines = content.split('\n');
                    
                    lines.forEach((line, index) => {
                        // Check for img tags without alt
                        const imgMatch = /<img[^>]*>/gi;
                        let match;
                        
                        while ((match = imgMatch.exec(line)) !== null) {
                            const imgTag = match[0];
                            if (!imgTag.includes('alt=')) {
                                issues.push({
                                    ruleId: 'img-alt-text',
                                    severity: 'warning',
                                    message: 'Image missing alt attribute',
                                    line: index + 1,
                                    column: match.index,
                                    fixable: true,
                                    suggestion: 'Add alt attribute with descriptive text'
                                });
                            }
                        }
                    });
                    
                    return issues;
                }
            },
            
            // Best Practices Rules
            {
                id: 'prefer-const',
                name: 'Prefer Const',
                description: 'Use const for variables that are never reassigned',
                category: 'best-practices',
                severity: 'info',
                validator: (content, filePath) => {
                    const issues: ComplianceIssue[] = [];
                    const lines = content.split('\n');
                    
                    lines.forEach((line, index) => {
                        // Simple heuristic: let declarations that could be const
                        if (/let\s+\w+\s*=/.test(line) && !content.includes(`${line.match(/let\s+(\w+)/)?.[1]} =`)) {
                            const varName = line.match(/let\s+(\w+)/)?.[1];
                            issues.push({
                                ruleId: 'prefer-const',
                                severity: 'info',
                                message: `'${varName}' is never reassigned, use 'const' instead`,
                                line: index + 1,
                                column: line.indexOf('let'),
                                fixable: true,
                                suggestion: `Change 'let' to 'const'`
                            });
                        }
                    });
                    
                    return issues;
                },
                autoFix: (content, filePath) => {
                    // This would need more sophisticated analysis in a real implementation
                    return content.replace(/let(\s+\w+\s*=\s*[^;]+;)/g, 'const$1');
                }
            }
        ];

        // Register all rules
        rules.forEach(rule => {
            this.rules.set(rule.id, rule);
        });
        
        this.outputChannel.appendLine(`Loaded ${rules.length} compliance rules`);
    }

    private setupEventHandlers(): void {
        // Validate on save
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (this.shouldValidateFile(document.uri.fsPath)) {
                await this.validateFile(document);
            }
        }, null, this.context.subscriptions);

        // Validate on change (debounced)
        let changeTimeout: NodeJS.Timeout;
        vscode.workspace.onDidChangeTextDocument((event) => {
            clearTimeout(changeTimeout);
            changeTimeout = setTimeout(async () => {
                if (this.shouldValidateFile(event.document.uri.fsPath)) {
                    await this.validateFile(event.document);
                }
            }, 1000);
        }, null, this.context.subscriptions);

        // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('unjucks.fixCompliance', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await this.fixIssues(editor.document);
                }
            })
        );
    }

    private async runRule(
        rule: ComplianceRule, 
        content: string, 
        filePath: string,
        document: vscode.TextDocument
    ): Promise<ComplianceIssue[]> {
        try {
            if (rule.validator) {
                const issues = rule.validator(content, filePath);
                
                // Add ranges for issues that have line/column info
                return issues.map(issue => {
                    if (issue.line !== undefined && !issue.range) {
                        const line = Math.max(0, issue.line - 1);
                        const column = issue.column || 0;
                        const position = new vscode.Position(line, column);
                        
                        // Try to find the end of the problematic token
                        const lineText = document.lineAt(line).text;
                        const endColumn = column + (issue.message.match(/'([^']+)'/)?.[1]?.length || 10);
                        const endPosition = new vscode.Position(line, Math.min(endColumn, lineText.length));
                        
                        issue.range = new vscode.Range(position, endPosition);
                    }
                    return issue;
                });
            } else if (rule.pattern) {
                // Simple pattern-based rule
                const issues: ComplianceIssue[] = [];
                const lines = content.split('\n');
                
                lines.forEach((line, index) => {
                    const matches = line.matchAll(rule.pattern!);
                    for (const match of matches) {
                        issues.push({
                            ruleId: rule.id,
                            severity: rule.severity,
                            message: rule.description,
                            line: index + 1,
                            column: match.index,
                            fixable: !!rule.autoFix,
                            suggestion: rule.autoFix ? 'Auto-fix available' : undefined
                        });
                    }
                });
                
                return issues;
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error running rule ${rule.id}: ${error}`);
        }
        
        return [];
    }

    private isRuleApplicable(rule: ComplianceRule, filePath: string, languageId: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        
        // Rule-specific file type filtering
        switch (rule.id) {
            case 'consistent-naming':
            case 'no-console-log':
            case 'prefer-const':
                return ['.js', '.ts', '.jsx', '.tsx'].includes(ext);
            case 'img-alt-text':
                return ['.html', '.htm', '.jsx', '.tsx', '.vue'].includes(ext) || 
                       ['html', 'jsx', 'tsx', 'vue'].includes(languageId);
            case 'no-hardcoded-secrets':
                return true; // Apply to all files
            default:
                return true;
        }
    }

    private shouldValidateFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const validExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.json', '.yaml', '.yml', '.md', '.njk', '.nunjucks'
        ];
        
        return validExtensions.includes(ext) && 
               !filePath.includes('node_modules') &&
               !filePath.includes('.git');
    }

    private calculateComplianceScore(issues: ComplianceIssue[]): number {
        if (issues.length === 0) {
            return 100;
        }
        
        const weights = { error: 10, warning: 5, info: 1 };
        const totalPenalty = issues.reduce((sum, issue) => sum + weights[issue.severity], 0);
        
        // Score calculation: max penalty of 100 points
        const score = Math.max(0, 100 - Math.min(100, totalPenalty));
        return Math.round(score);
    }

    private updateDiagnostics(document: vscode.TextDocument, issues: ComplianceIssue[]): void {
        const diagnostics: vscode.Diagnostic[] = issues.map(issue => {
            const severity = this.getDiagnosticSeverity(issue.severity);
            const range = issue.range || new vscode.Range(
                new vscode.Position((issue.line || 1) - 1, issue.column || 0),
                new vscode.Position((issue.line || 1) - 1, (issue.column || 0) + 10)
            );
            
            const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
            diagnostic.source = 'unjucks-compliance';
            diagnostic.code = issue.ruleId;
            
            if (issue.suggestion) {
                diagnostic.relatedInformation = [
                    new vscode.DiagnosticRelatedInformation(
                        new vscode.Location(document.uri, range),
                        issue.suggestion
                    )
                ];
            }
            
            return diagnostic;
        });
        
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private getDiagnosticSeverity(severity: ComplianceIssue['severity']): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

    private updateStatusBar(score: number, issueCount: number): void {
        const scoreColor = score >= 80 ? '$(check)' : score >= 60 ? '$(warning)' : '$(error)';
        this.statusBarItem.text = `${scoreColor} Compliance: ${score}%`;
        this.statusBarItem.tooltip = `Compliance Score: ${score}% (${issueCount} issues)`;
        this.statusBarItem.command = 'unjucks.validateCompliance';
        this.statusBarItem.show();
    }

    private async showComplianceReport(report: ComplianceReport): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'complianceReport',
            `Compliance Report - ${path.basename(report.filePath)}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getComplianceReportHtml(report);
    }

    private async showValidationSummary(reports: ComplianceReport[]): Promise<void> {
        const totalIssues = reports.reduce((sum, report) => sum + report.issues.length, 0);
        const averageScore = reports.reduce((sum, report) => sum + report.score, 0) / reports.length;
        
        const message = `Validation complete: ${reports.length} files, ` +
                       `${totalIssues} issues, ${Math.round(averageScore)}% average score`;
        
        const action = await vscode.window.showInformationMessage(
            message,
            'Show Report',
            'Fix All'
        );
        
        if (action === 'Show Report') {
            this.outputChannel.appendLine('Compliance Validation Summary');
            this.outputChannel.appendLine('================================');
            
            reports.forEach(report => {
                this.outputChannel.appendLine(`${report.filePath}: ${report.score}% (${report.issues.length} issues)`);
                report.issues.forEach(issue => {
                    this.outputChannel.appendLine(`  ${issue.severity}: ${issue.message} (line ${issue.line})`);
                });
                this.outputChannel.appendLine('');
            });
            
            this.outputChannel.show();
        }
    }

    private getComplianceReportHtml(report: ComplianceReport): string {
        const issuesByCategory = report.issues.reduce((acc, issue) => {
            const rule = this.rules.get(issue.ruleId);
            const category = rule?.category || 'other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(issue);
            return acc;
        }, {} as Record<string, ComplianceIssue[]>);

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Compliance Report</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                    line-height: 1.6;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }
                .score {
                    font-size: 48px;
                    font-weight: bold;
                    margin: 10px 0;
                }
                .score.high { color: var(--vscode-testing-iconPassed); }
                .score.medium { color: var(--vscode-testing-iconQueued); }
                .score.low { color: var(--vscode-testing-iconFailed); }
                .category {
                    margin: 20px 0;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 15px;
                }
                .category-header {
                    font-weight: bold;
                    font-size: 16px;
                    margin-bottom: 10px;
                    text-transform: capitalize;
                }
                .issue {
                    margin: 10px 0;
                    padding: 8px 12px;
                    border-left: 3px solid;
                    border-radius: 4px;
                }
                .issue.error {
                    border-color: var(--vscode-testing-iconFailed);
                    background-color: var(--vscode-inputValidation-errorBackground);
                }
                .issue.warning {
                    border-color: var(--vscode-testing-iconQueued);
                    background-color: var(--vscode-inputValidation-warningBackground);
                }
                .issue.info {
                    border-color: var(--vscode-testing-iconPassed);
                    background-color: var(--vscode-inputValidation-infoBackground);
                }
                .issue-message {
                    font-weight: 500;
                }
                .issue-details {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
                .suggestion {
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Compliance Report</h1>
                <div><strong>File:</strong> ${path.basename(report.filePath)}</div>
                <div><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</div>
                <div class="score ${report.score >= 80 ? 'high' : report.score >= 60 ? 'medium' : 'low'}">${report.score}%</div>
            </div>
            
            ${Object.entries(issuesByCategory).map(([category, issues]) => `
                <div class="category">
                    <div class="category-header">${category} (${issues.length})</div>
                    ${issues.map(issue => `
                        <div class="issue ${issue.severity}">
                            <div class="issue-message">${issue.message}</div>
                            <div class="issue-details">
                                Line ${issue.line || '?'}, Column ${issue.column || '?'} • 
                                ${issue.fixable ? 'Auto-fixable' : 'Manual fix required'}
                            </div>
                            ${issue.suggestion ? `<div class="suggestion">💡 ${issue.suggestion}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            
            ${report.issues.length === 0 ? '<div style="text-align: center; padding: 40px; color: var(--vscode-testing-iconPassed);">✅ No compliance issues found!</div>' : ''}
        </body>
        </html>
        `;
    }

    private async getGeneratedFiles(targetPath: string): Promise<string[]> {
        const files: string[] = [];
        
        try {
            await this.scanForFiles(targetPath, files);
        } catch (error) {
            this.outputChannel.appendLine(`Error scanning files: ${error}`);
        }
        
        return files;
    }

    private async scanForFiles(dirPath: string, files: string[]): Promise<void> {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    if (!this.shouldSkipDirectory(entry.name)) {
                        await this.scanForFiles(fullPath, files);
                    }
                } else if (entry.isFile()) {
                    if (this.shouldValidateFile(fullPath)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory might not exist or be readable
            console.debug(`Could not scan directory ${dirPath}:`, error);
        }
    }

    private shouldSkipDirectory(name: string): boolean {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'];
        return skipDirs.includes(name) || name.startsWith('.');
    }

    private toCamelCase(str: string): string {
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
    }
}