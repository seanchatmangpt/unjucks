import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

export interface TemplateItem {
    id: string;
    label: string;
    description?: string;
    path: string;
    generator: string;
    name: string;
    category?: string;
    complexity: number;
    variables: TemplateVariable[];
    iconPath?: vscode.ThemeIcon | vscode.Uri;
    contextValue: string;
}

export interface TemplateVariable {
    name: string;
    type: string;
    description?: string;
    required: boolean;
    default?: any;
    options?: string[];
    pattern?: string;
}

export interface TemplateCategory {
    name: string;
    templates: TemplateItem[];
    iconPath?: vscode.ThemeIcon;
}

export class TemplateTreeProvider implements vscode.TreeDataProvider<TemplateItem | TemplateCategory> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TemplateItem | TemplateCategory | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private templates: TemplateItem[] = [];
    private categories: TemplateCategory[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.loadTemplates();
    }

    refresh(): void {
        this.loadTemplates();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TemplateItem | TemplateCategory): vscode.TreeItem {
        if ('templates' in element) {
            // Category
            const item = new vscode.TreeItem(
                element.name,
                vscode.TreeItemCollapsibleState.Expanded
            );
            item.iconPath = element.iconPath || new vscode.ThemeIcon('folder');
            item.contextValue = 'category';
            return item;
        } else {
            // Template
            const item = new vscode.TreeItem(element.label);
            item.description = element.description;
            item.tooltip = this.createTooltip(element);
            item.iconPath = element.iconPath || this.getIconForTemplate(element);
            item.contextValue = element.contextValue;
            item.command = {
                command: 'unjucks.previewTemplate',
                title: 'Preview Template',
                arguments: [element]
            };
            return item;
        }
    }

    getChildren(element?: TemplateItem | TemplateCategory): Thenable<(TemplateItem | TemplateCategory)[]> {
        if (!element) {
            // Root level - return categories
            return Promise.resolve(this.categories);
        } else if ('templates' in element) {
            // Category - return templates
            return Promise.resolve(element.templates);
        } else {
            // Template - no children
            return Promise.resolve([]);
        }
    }

    async getTemplates(): Promise<TemplateItem[]> {
        return this.templates;
    }

    async getTemplateVariables(template: TemplateItem): Promise<TemplateVariable[]> {
        return template.variables;
    }

    private async loadTemplates(): Promise<void> {
        this.templates = [];
        this.categories = [];

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const workspaceFolder of workspaceFolders) {
            await this.loadTemplatesFromWorkspace(workspaceFolder);
        }

        this.organizeIntoCategories();
    }

    private async loadTemplatesFromWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const templatesPath = vscode.workspace.getConfiguration('unjucks')
            .get<string>('templatesPath') || '_templates';
        
        const templatesDir = path.join(workspaceFolder.uri.fsPath, templatesPath);
        
        if (!existsSync(templatesDir)) {
            return;
        }

        try {
            const generators = await fs.readdir(templatesDir, { withFileTypes: true });
            
            for (const generator of generators) {
                if (generator.isDirectory()) {
                    await this.loadGeneratorTemplates(
                        templatesDir, 
                        generator.name,
                        workspaceFolder.name
                    );
                }
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    private async loadGeneratorTemplates(
        templatesDir: string, 
        generatorName: string,
        workspaceName: string
    ): Promise<void> {
        const generatorDir = path.join(templatesDir, generatorName);
        
        try {
            const templates = await fs.readdir(generatorDir, { withFileTypes: true });
            
            for (const template of templates) {
                if (template.isDirectory()) {
                    const templateItem = await this.createTemplateItem(
                        generatorDir,
                        generatorName,
                        template.name,
                        workspaceName
                    );
                    
                    if (templateItem) {
                        this.templates.push(templateItem);
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading templates from generator ${generatorName}:`, error);
        }
    }

    private async createTemplateItem(
        generatorDir: string,
        generatorName: string,
        templateName: string,
        workspaceName: string
    ): Promise<TemplateItem | undefined> {
        const templateDir = path.join(generatorDir, templateName);
        
        try {
            // Look for metadata file
            const metadataPath = path.join(templateDir, 'template.json');
            let metadata: any = {};
            
            if (existsSync(metadataPath)) {
                const metadataContent = await fs.readFile(metadataPath, 'utf8');
                metadata = JSON.parse(metadataContent);
            }

            // Scan template files for variables
            const variables = await this.extractVariables(templateDir);
            
            // Determine complexity based on number of files and variables
            const files = await this.countTemplateFiles(templateDir);
            const complexity = Math.min(5, Math.floor((files + variables.length) / 3) + 1);

            const templateItem: TemplateItem = {
                id: `${workspaceName}:${generatorName}:${templateName}`,
                label: metadata.displayName || templateName,
                description: metadata.description || `${generatorName} template`,
                path: templateDir,
                generator: generatorName,
                name: templateName,
                category: metadata.category || this.inferCategory(generatorName),
                complexity,
                variables,
                contextValue: 'template'
            };

            return templateItem;
        } catch (error) {
            console.error(`Error creating template item for ${templateName}:`, error);
            return undefined;
        }
    }

    private async extractVariables(templateDir: string): Promise<TemplateVariable[]> {
        const variables: Map<string, TemplateVariable> = new Map();
        
        try {
            // Recursively scan all template files
            await this.scanDirectoryForVariables(templateDir, variables);
            
            // Look for variable definitions file
            const variablesPath = path.join(templateDir, 'variables.json');
            if (existsSync(variablesPath)) {
                const variableDefsContent = await fs.readFile(variablesPath, 'utf8');
                const variableDefs = JSON.parse(variableDefsContent);
                
                for (const varDef of variableDefs) {
                    variables.set(varDef.name, {
                        name: varDef.name,
                        type: varDef.type || 'string',
                        description: varDef.description,
                        required: varDef.required || false,
                        default: varDef.default,
                        options: varDef.options,
                        pattern: varDef.pattern
                    });
                }
            }
        } catch (error) {
            console.error('Error extracting variables:', error);
        }
        
        return Array.from(variables.values());
    }

    private async scanDirectoryForVariables(
        dir: string, 
        variables: Map<string, TemplateVariable>
    ): Promise<void> {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    await this.scanDirectoryForVariables(fullPath, variables);
                } else if (entry.isFile()) {
                    // Extract variables from filename
                    this.extractVariablesFromFilename(entry.name, variables);
                    
                    // Extract variables from file content
                    if (this.isTextFile(entry.name)) {
                        await this.extractVariablesFromFile(fullPath, variables);
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
        }
    }

    private extractVariablesFromFilename(filename: string, variables: Map<string, TemplateVariable>): void {
        // Look for {{ variable }} patterns in filenames
        const filenameRegex = /\{\{\s*([^}]+)\s*\}\}/g;
        let match;
        
        while ((match = filenameRegex.exec(filename)) !== null) {
            const varExpression = match[1].trim();
            const varName = varExpression.split('|')[0].trim(); // Remove filters
            
            if (!variables.has(varName)) {
                variables.set(varName, {
                    name: varName,
                    type: 'string',
                    required: true
                });
            }
        }
    }

    private async extractVariablesFromFile(
        filePath: string, 
        variables: Map<string, TemplateVariable>
    ): Promise<void> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // Extract variables from Nunjucks template syntax
            const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
            const blockRegex = /\{%\s*(?:if|for|set)\s+([^%]+)\s*%\}/g;
            
            let match;
            
            // Extract from {{ }} expressions
            while ((match = variableRegex.exec(content)) !== null) {
                const varExpression = match[1].trim();
                const varName = varExpression.split(/[\s|.(\[]/, 1)[0]; // Get base variable name
                
                if (varName && !variables.has(varName)) {
                    variables.set(varName, {
                        name: varName,
                        type: this.inferVariableType(varExpression),
                        required: true
                    });
                }
            }
            
            // Extract from {% %} blocks
            while ((match = blockRegex.exec(content)) !== null) {
                const blockExpression = match[1].trim();
                const varName = blockExpression.split(/[\s=<>!]/)[0];
                
                if (varName && !variables.has(varName)) {
                    variables.set(varName, {
                        name: varName,
                        type: 'string',
                        required: false
                    });
                }
            }
        } catch (error) {
            // File might be binary or unreadable
            console.debug(`Could not read file ${filePath}:`, error);
        }
    }

    private inferVariableType(expression: string): string {
        if (expression.includes('length') || expression.includes('count')) {
            return 'number';
        }
        if (expression.includes('true') || expression.includes('false')) {
            return 'boolean';
        }
        if (expression.includes('[') || expression.includes('split(')) {
            return 'array';
        }
        return 'string';
    }

    private async countTemplateFiles(dir: string): Promise<number> {
        let count = 0;
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile()) {
                    count++;
                } else if (entry.isDirectory()) {
                    count += await this.countTemplateFiles(path.join(dir, entry.name));
                }
            }
        } catch (error) {
            console.error(`Error counting files in ${dir}:`, error);
        }
        
        return count;
    }

    private isTextFile(filename: string): boolean {
        const textExtensions = [
            '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf',
            '.sh', '.bat', '.ps1', '.py', '.rb', '.go', '.rs',
            '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php',
            '.sql', '.graphql', '.proto', '.dockerfile', '.njk',
            '.nunjucks', '.hbs', '.mustache', '.ejs'
        ];
        
        const ext = path.extname(filename).toLowerCase();
        return textExtensions.includes(ext) || !ext; // Include files without extension
    }

    private inferCategory(generatorName: string): string {
        const categoryMap: Record<string, string> = {
            'component': 'Components',
            'page': 'Pages',
            'api': 'API',
            'service': 'Services',
            'test': 'Testing',
            'util': 'Utilities',
            'config': 'Configuration',
            'docker': 'DevOps',
            'ci': 'DevOps',
            'cd': 'DevOps',
            'database': 'Database',
            'migration': 'Database',
            'model': 'Models',
            'controller': 'Controllers',
            'middleware': 'Middleware',
            'auth': 'Authentication',
            'cli': 'CLI Tools'
        };
        
        const lowerName = generatorName.toLowerCase();
        for (const [key, category] of Object.entries(categoryMap)) {
            if (lowerName.includes(key)) {
                return category;
            }
        }
        
        return 'General';
    }

    private organizeIntoCategories(): void {
        const categoryMap: Map<string, TemplateItem[]> = new Map();
        
        for (const template of this.templates) {
            const category = template.category || 'General';
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push(template);
        }
        
        this.categories = Array.from(categoryMap.entries()).map(([name, templates]) => ({
            name,
            templates: templates.sort((a, b) => a.label.localeCompare(b.label)),
            iconPath: this.getIconForCategory(name)
        }));
        
        this.categories.sort((a, b) => a.name.localeCompare(b.name));
    }

    private getIconForTemplate(template: TemplateItem): vscode.ThemeIcon {
        const iconMap: Record<string, string> = {
            'component': 'symbol-class',
            'page': 'browser',
            'api': 'globe',
            'service': 'gear',
            'test': 'beaker',
            'util': 'tools',
            'config': 'settings-gear',
            'docker': 'server',
            'database': 'database',
            'model': 'symbol-interface',
            'controller': 'symbol-method',
            'auth': 'key'
        };
        
        const category = template.category?.toLowerCase() || '';
        const iconName = iconMap[category] || 'file-code';
        
        return new vscode.ThemeIcon(iconName);
    }

    private getIconForCategory(categoryName: string): vscode.ThemeIcon {
        const iconMap: Record<string, string> = {
            'Components': 'symbol-class',
            'Pages': 'browser',
            'API': 'globe',
            'Services': 'gear',
            'Testing': 'beaker',
            'Utilities': 'tools',
            'Configuration': 'settings-gear',
            'DevOps': 'server',
            'Database': 'database',
            'Models': 'symbol-interface',
            'Controllers': 'symbol-method',
            'Middleware': 'symbol-operator',
            'Authentication': 'key',
            'CLI Tools': 'terminal'
        };
        
        return new vscode.ThemeIcon(iconMap[categoryName] || 'folder');
    }

    private createTooltip(template: TemplateItem): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${template.label}**\n\n`);
        
        if (template.description) {
            tooltip.appendMarkdown(`${template.description}\n\n`);
        }
        
        tooltip.appendMarkdown(`**Generator:** ${template.generator}\n`);
        tooltip.appendMarkdown(`**Template:** ${template.name}\n`);
        tooltip.appendMarkdown(`**Complexity:** ${'⭐'.repeat(template.complexity)}\n`);
        
        if (template.variables.length > 0) {
            tooltip.appendMarkdown(`**Variables:** ${template.variables.length}\n`);
            const requiredVars = template.variables.filter(v => v.required).length;
            if (requiredVars > 0) {
                tooltip.appendMarkdown(`**Required:** ${requiredVars}\n`);
            }
        }
        
        tooltip.appendMarkdown(`\n*Click to preview, right-click for options*`);
        
        return tooltip;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}