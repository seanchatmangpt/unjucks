import * as vscode from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';
import { MCPIntegration } from './mcp-integration';
import { TemplateItem } from './template-browser';

export interface SuggestionContext {
    fileType: string;
    fileName: string;
    directory: string;
    projectType: string;
    existingFiles: string[];
    gitStatus?: string[];
    packageJson?: any;
    dependencies?: string[];
}

export interface TemplateSuggestion {
    template: TemplateItem;
    relevance: number;
    reason: string;
    confidence: number;
}

export class AISuggestionEngine implements vscode.Disposable {
    private contextCache: Map<string, SuggestionContext> = new Map();
    private suggestionCache: Map<string, TemplateSuggestion[]> = new Map();
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private context: vscode.ExtensionContext,
        private mcpIntegration: MCPIntegration
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            98
        );
        this.statusBarItem.command = 'unjucks.aiSuggest';
    }

    async initialize(): Promise<void> {
        // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('unjucks.aiSuggest', () => 
                this.suggestTemplatesForContext()
            ),
            vscode.commands.registerCommand('unjucks.showMCPStatus', () => 
                this.mcpIntegration.showOutput()
            )
        );

        // Train initial patterns from workspace
        await this.trainFromWorkspace();
        
        console.log('AI Suggestion Engine initialized');
    }

    async suggestTemplatesForContext(): Promise<TemplateSuggestion[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor for context analysis');
            return [];
        }

        const suggestions = await this.suggestForContext(editor);
        
        if (suggestions.length === 0) {
            vscode.window.showInformationMessage('No relevant templates found for current context');
            return [];
        }

        // Show suggestions in quick pick
        const items = suggestions.map(suggestion => ({
            label: suggestion.template.label,
            description: `${Math.round(suggestion.confidence * 100)}% confidence`,
            detail: suggestion.reason,
            suggestion
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a template to generate',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await vscode.commands.executeCommand('unjucks.generateTemplate', selected.suggestion.template);
        }

        return suggestions;
    }

    async suggestForContext(editor: vscode.TextEditor): Promise<TemplateSuggestion[]> {
        const context = await this.analyzeContext(editor.document.uri);
        const cacheKey = this.getCacheKey(context);
        
        // Check cache first
        if (this.suggestionCache.has(cacheKey)) {
            return this.suggestionCache.get(cacheKey)!;
        }

        // Generate suggestions using multiple strategies
        const suggestions = await this.generateSuggestions(context);
        
        // Cache results
        this.suggestionCache.set(cacheKey, suggestions);
        
        // Update status bar
        this.updateStatusBar(suggestions.length);
        
        return suggestions;
    }

    async suggestForNewFile(fileUri: vscode.Uri): Promise<TemplateSuggestion[]> {
        const context = await this.analyzeContext(fileUri);
        return this.generateSuggestions(context);
    }

    async getContextVariables(): Promise<Record<string, any>> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {};
        }

        const context = await this.analyzeContext(editor.document.uri);
        
        return {
            projectName: context.projectType,
            fileName: context.fileName,
            fileType: context.fileType,
            directory: path.basename(context.directory),
            timestamp: new Date().toISOString(),
            author: await this.getAuthorInfo()
        };
    }

    private async generateSuggestions(context: SuggestionContext): Promise<TemplateSuggestion[]> {
        const strategies = [
            this.suggestByFileType.bind(this),
            this.suggestByProjectStructure.bind(this),
            this.suggestByNamingPatterns.bind(this),
            this.suggestByDependencies.bind(this),
            this.suggestByMCPAnalysis.bind(this)
        ];

        const allSuggestions: TemplateSuggestion[] = [];
        
        for (const strategy of strategies) {
            try {
                const suggestions = await strategy(context);
                allSuggestions.push(...suggestions);
            } catch (error) {
                console.error('Strategy error:', error);
            }
        }

        // Aggregate and rank suggestions
        const aggregated = this.aggregateSuggestions(allSuggestions);
        
        // Sort by relevance and confidence
        return aggregated
            .sort((a, b) => {
                const scoreA = a.relevance * a.confidence;
                const scoreB = b.relevance * b.confidence;
                return scoreB - scoreA;
            })
            .slice(0, 10); // Top 10 suggestions
    }

    private async suggestByFileType(context: SuggestionContext): Promise<TemplateSuggestion[]> {
        const suggestions: TemplateSuggestion[] = [];
        
        // Get available templates (this would need to be implemented to get from template browser)
        const templates = await this.getAvailableTemplates();
        
        for (const template of templates) {
            let relevance = 0;
            let reason = '';
            
            // Match file extension
            if (this.templateHandlesFileType(template, context.fileType)) {
                relevance += 0.8;
                reason = `Handles ${context.fileType} files`;
            }
            
            // Match naming patterns
            if (this.templateMatchesNaming(template, context.fileName)) {
                relevance += 0.6;
                reason += `, matches naming pattern`;
            }
            
            if (relevance > 0.3) {
                suggestions.push({
                    template,
                    relevance,
                    reason: reason.replace(/^, /, ''),
                    confidence: 0.7
                });
            }
        }
        
        return suggestions;
    }

    private async suggestByProjectStructure(context: SuggestionContext): Promise<TemplateSuggestion[]> {
        const suggestions: TemplateSuggestion[] = [];
        const templates = await this.getAvailableTemplates();
        
        // Analyze project structure patterns
        const structurePatterns = this.analyzeProjectStructure(context);
        
        for (const template of templates) {
            let relevance = 0;
            const reasons: string[] = [];
            
            // Check if template fits project structure
            if (structurePatterns.isReactProject && template.name.includes('react')) {
                relevance += 0.9;
                reasons.push('React project detected');
            }
            
            if (structurePatterns.isNodeProject && template.name.includes('node')) {
                relevance += 0.8;
                reasons.push('Node.js project detected');
            }
            
            if (structurePatterns.hasTypeScript && template.name.includes('typescript')) {
                relevance += 0.7;
                reasons.push('TypeScript project');
            }
            
            if (structurePatterns.isApiProject && template.category === 'API') {
                relevance += 0.8;
                reasons.push('API project structure');
            }
            
            if (relevance > 0.4) {
                suggestions.push({
                    template,
                    relevance,
                    reason: reasons.join(', '),
                    confidence: 0.8
                });
            }
        }
        
        return suggestions;
    }

    private async suggestByNamingPatterns(context: SuggestionContext): Promise<TemplateSuggestion[]> {
        const suggestions: TemplateSuggestion[] = [];
        const templates = await this.getAvailableTemplates();
        
        const namingPatterns = {
            isComponent: /^[A-Z][a-zA-Z]*Component?$/.test(context.fileName),
            isService: /Service$/.test(context.fileName),
            isController: /Controller$/.test(context.fileName),
            isModel: /Model$/.test(context.fileName),
            isTest: /\.(test|spec)\./.test(context.fileName),
            isConfig: /config|settings/.test(context.fileName.toLowerCase())
        };
        
        for (const template of templates) {
            let relevance = 0;
            const reasons: string[] = [];
            
            if (namingPatterns.isComponent && template.category === 'Components') {
                relevance += 0.9;
                reasons.push('Component naming pattern');
            }
            
            if (namingPatterns.isService && template.category === 'Services') {
                relevance += 0.9;
                reasons.push('Service naming pattern');
            }
            
            if (namingPatterns.isController && template.category === 'Controllers') {
                relevance += 0.9;
                reasons.push('Controller naming pattern');
            }
            
            if (namingPatterns.isTest && template.category === 'Testing') {
                relevance += 0.8;
                reasons.push('Test file pattern');
            }
            
            if (relevance > 0.5) {
                suggestions.push({
                    template,
                    relevance,
                    reason: reasons.join(', '),
                    confidence: 0.85
                });
            }
        }
        
        return suggestions;
    }

    private async suggestByDependencies(context: SuggestionContext): Promise<TemplateSuggestion[]> {
        const suggestions: TemplateSuggestion[] = [];
        
        if (!context.dependencies || context.dependencies.length === 0) {
            return suggestions;
        }
        
        const templates = await this.getAvailableTemplates();
        
        for (const template of templates) {
            let relevance = 0;
            const reasons: string[] = [];
            
            // Check if template dependencies align with project dependencies
            const templateDeps = this.getTemplateDependencies(template);
            
            for (const dep of templateDeps) {
                if (context.dependencies.includes(dep)) {
                    relevance += 0.6;
                    reasons.push(`Uses ${dep}`);
                }
            }
            
            if (relevance > 0.3) {
                suggestions.push({
                    template,
                    relevance: Math.min(1.0, relevance),
                    reason: reasons.join(', '),
                    confidence: 0.75
                });
            }
        }
        
        return suggestions;
    }

    private async suggestByMCPAnalysis(context: SuggestionContext): Promise<TemplateSuggestion[]> {
        try {
            // Use MCP agents for advanced analysis
            const taskId = await this.mcpIntegration.orchestrateTask(
                `Analyze project context and suggest relevant templates: ${JSON.stringify(context)}`,
                { strategy: 'parallel', priority: 'medium' }
            );
            
            // Wait a bit for analysis
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const results = await this.mcpIntegration.getTaskResults(taskId);
            
            if (results && results.suggestions) {
                return results.suggestions.map((suggestion: any) => ({
                    template: suggestion.template,
                    relevance: suggestion.relevance || 0.5,
                    reason: suggestion.reason || 'AI analysis',
                    confidence: suggestion.confidence || 0.6
                }));
            }
        } catch (error) {
            console.debug('MCP analysis failed:', error);
        }
        
        return [];
    }

    private async analyzeContext(fileUri: vscode.Uri): Promise<SuggestionContext> {
        const filePath = fileUri.fsPath;
        const fileName = path.basename(filePath);
        const directory = path.dirname(filePath);
        const fileType = path.extname(fileName);
        
        // Check cache
        const cacheKey = filePath;
        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey)!;
        }
        
        // Analyze workspace
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        const existingFiles = await this.getExistingFiles(directory);
        const projectType = await this.detectProjectType(workspaceFolder?.uri.fsPath || directory);
        const packageJson = await this.getPackageJson(workspaceFolder?.uri.fsPath);
        const dependencies = packageJson ? Object.keys({
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        }) : [];
        
        const context: SuggestionContext = {
            fileType,
            fileName,
            directory,
            projectType,
            existingFiles,
            packageJson,
            dependencies
        };
        
        // Cache context
        this.contextCache.set(cacheKey, context);
        
        return context;
    }

    private async getExistingFiles(directory: string): Promise<string[]> {
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(directory));
            return files
                .filter(([name, type]) => type === vscode.FileType.File)
                .map(([name]) => name);
        } catch {
            return [];
        }
    }

    private async detectProjectType(rootPath: string): Promise<string> {
        if (!rootPath) {
            return 'unknown';
        }
        
        const packageJsonPath = path.join(rootPath, 'package.json');
        
        if (existsSync(packageJsonPath)) {
            try {
                const packageJson = require(packageJsonPath);
                const deps = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies
                };
                
                if (deps.react) return 'react';
                if (deps.vue) return 'vue';
                if (deps.angular || deps['@angular/core']) return 'angular';
                if (deps.express || deps.koa) return 'node-api';
                if (deps.next) return 'nextjs';
                if (deps.nuxt) return 'nuxtjs';
                if (deps.gatsby) return 'gatsby';
                if (deps.electron) return 'electron';
                
                return 'node';
            } catch {
                return 'javascript';
            }
        }
        
        // Check for other project types
        if (existsSync(path.join(rootPath, 'Cargo.toml'))) return 'rust';
        if (existsSync(path.join(rootPath, 'go.mod'))) return 'go';
        if (existsSync(path.join(rootPath, 'requirements.txt'))) return 'python';
        if (existsSync(path.join(rootPath, 'Gemfile'))) return 'ruby';
        if (existsSync(path.join(rootPath, 'pom.xml'))) return 'java';
        if (existsSync(path.join(rootPath, 'composer.json'))) return 'php';
        
        return 'unknown';
    }

    private async getPackageJson(rootPath?: string): Promise<any> {
        if (!rootPath) return null;
        
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (existsSync(packageJsonPath)) {
            try {
                return require(packageJsonPath);
            } catch {
                return null;
            }
        }
        
        return null;
    }

    private analyzeProjectStructure(context: SuggestionContext): any {
        return {
            isReactProject: context.dependencies?.includes('react') || context.existingFiles.some(f => f.includes('jsx')),
            isNodeProject: context.packageJson?.engines?.node || context.dependencies?.includes('express'),
            hasTypeScript: context.dependencies?.includes('typescript') || context.existingFiles.some(f => f.endsWith('.ts')),
            isApiProject: context.existingFiles.some(f => f.includes('api') || f.includes('route')),
            hasTests: context.existingFiles.some(f => f.includes('.test.') || f.includes('.spec.')),
            hasComponents: context.existingFiles.some(f => f.includes('Component'))
        };
    }

    private async getAvailableTemplates(): Promise<TemplateItem[]> {
        // This would integrate with the template browser to get available templates
        // For now, return an empty array - this would be implemented to work with TemplateTreeProvider
        return [];
    }

    private templateHandlesFileType(template: TemplateItem, fileType: string): boolean {
        // Check if template generates files of this type
        return template.variables.some(v => 
            v.name.toLowerCase().includes('extension') ||
            v.name.toLowerCase().includes('type')
        ) || template.path.includes(fileType.slice(1));
    }

    private templateMatchesNaming(template: TemplateItem, fileName: string): boolean {
        const templateName = template.name.toLowerCase();
        const baseFileName = fileName.split('.')[0].toLowerCase();
        
        return templateName.includes(baseFileName) || 
               baseFileName.includes(templateName) ||
               this.hasCommonWords(templateName, baseFileName);
    }

    private hasCommonWords(str1: string, str2: string): boolean {
        const words1 = str1.split(/[_-]/);
        const words2 = str2.split(/[_-]/);
        
        return words1.some(word => words2.includes(word));
    }

    private getTemplateDependencies(template: TemplateItem): string[] {
        // Extract dependencies that template might use
        // This would be implemented based on template metadata
        return [];
    }

    private aggregateSuggestions(suggestions: TemplateSuggestion[]): TemplateSuggestion[] {
        const aggregated = new Map<string, TemplateSuggestion>();
        
        for (const suggestion of suggestions) {
            const key = suggestion.template.id;
            
            if (aggregated.has(key)) {
                const existing = aggregated.get(key)!;
                existing.relevance = Math.max(existing.relevance, suggestion.relevance);
                existing.confidence = (existing.confidence + suggestion.confidence) / 2;
                existing.reason += `, ${suggestion.reason}`;
            } else {
                aggregated.set(key, { ...suggestion });
            }
        }
        
        return Array.from(aggregated.values());
    }

    private getCacheKey(context: SuggestionContext): string {
        return `${context.directory}:${context.fileName}:${context.fileType}`;
    }

    private updateStatusBar(suggestionCount: number): void {
        if (suggestionCount > 0) {
            this.statusBarItem.text = `$(lightbulb) ${suggestionCount} suggestions`;
            this.statusBarItem.tooltip = `${suggestionCount} template suggestions available`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private async trainFromWorkspace(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            
            // Collect workspace patterns for training
            const patterns = await this.collectWorkspacePatterns();
            
            // Train MCP neural patterns
            await this.mcpIntegration.trainNeuralPatterns(patterns);
            
            // Store in memory for quick access
            await this.mcpIntegration.storeMemory('workspace-patterns', patterns);
            
        } catch (error) {
            console.error('Failed to train from workspace:', error);
        }
    }

    private async collectWorkspacePatterns(): Promise<any> {
        const patterns = {
            fileTypes: new Set<string>(),
            namingPatterns: new Set<string>(),
            directoryStructure: [],
            dependencies: new Set<string>(),
            frameworks: new Set<string>()
        };
        
        // This would collect patterns from the workspace for training
        return patterns;
    }

    private async getAuthorInfo(): Promise<string> {
        try {
            const gitConfig = await vscode.workspace.getConfiguration('git');
            return gitConfig.get<string>('defaultCloneDirectory') || 'Developer';
        } catch {
            return 'Developer';
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.contextCache.clear();
        this.suggestionCache.clear();
    }
}