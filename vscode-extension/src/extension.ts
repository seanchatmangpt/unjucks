import * as vscode from 'vscode';
import { TemplateTreeProvider, TemplateItem } from './template-browser';
import { PreviewProvider } from './preview-provider';
import { MCPIntegration } from './mcp-integration';
import { AISuggestionEngine } from './ai-suggestions';
import { ComplianceValidator } from './compliance-validator';
import { SwarmCoordinator } from './swarm-coordinator';
import { MarketplaceManager } from './marketplace-manager';

export class UnjucksExtension {
    private templateProvider: TemplateTreeProvider;
    private previewProvider: PreviewProvider;
    private mcpIntegration: MCPIntegration;
    private aiEngine: AISuggestionEngine;
    private complianceValidator: ComplianceValidator;
    private swarmCoordinator: SwarmCoordinator;
    private marketplaceManager: MarketplaceManager;
    private statusBarItem: vscode.StatusBarItem;

    constructor(private context: vscode.ExtensionContext) {
        this.templateProvider = new TemplateTreeProvider(context);
        this.previewProvider = new PreviewProvider(context);
        this.mcpIntegration = new MCPIntegration(context);
        this.aiEngine = new AISuggestionEngine(context, this.mcpIntegration);
        this.complianceValidator = new ComplianceValidator(context);
        this.swarmCoordinator = new SwarmCoordinator(context, this.mcpIntegration);
        this.marketplaceManager = new MarketplaceManager(context);
        
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.text = "$(file-code) Unjucks";
        this.statusBarItem.tooltip = "Unjucks Template Generator";
        this.statusBarItem.command = "unjucks.generateTemplate";
        this.statusBarItem.show();
    }

    public async activate(): Promise<void> {
        console.log('Unjucks extension is now active!');

        // Set context for conditional UI elements
        await vscode.commands.executeCommand('setContext', 'unjucks:enabled', true);

        // Register tree data providers
        const templateView = vscode.window.createTreeView('unjucksTemplates', {
            treeDataProvider: this.templateProvider,
            showCollapseAll: true
        });

        // Register preview provider
        this.context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(
                'unjucks-preview',
                this.previewProvider
            )
        );

        // Register commands
        this.registerCommands();

        // Initialize MCP integration
        if (this.getConfig('mcpEnabled')) {
            await this.mcpIntegration.initialize();
        }

        // Start AI suggestion engine
        if (this.getConfig('aiSuggestions')) {
            await this.aiEngine.initialize();
        }

        // Setup file watchers
        this.setupFileWatchers();

        // Show contextual suggestions on file creation
        this.setupContextualSuggestions();

        this.context.subscriptions.push(
            templateView,
            this.statusBarItem,
            ...this.getDisposables()
        );
    }

    private registerCommands(): void {
        const commands = [
            vscode.commands.registerCommand('unjucks.generateTemplate', 
                (templateItem?: TemplateItem, targetUri?: vscode.Uri) => 
                    this.generateTemplate(templateItem, targetUri)
            ),
            vscode.commands.registerCommand('unjucks.previewTemplate', 
                (templateItem: TemplateItem) => 
                    this.previewTemplate(templateItem)
            ),
            vscode.commands.registerCommand('unjucks.refreshTemplates', () => 
                this.templateProvider.refresh()
            ),
            vscode.commands.registerCommand('unjucks.openMarketplace', () => 
                this.marketplaceManager.openMarketplace()
            ),
            vscode.commands.registerCommand('unjucks.startSwarm', 
                (task?: string) => this.swarmCoordinator.startSwarm(task)
            ),
            vscode.commands.registerCommand('unjucks.validateCompliance', () => 
                this.complianceValidator.validateCurrentFile()
            ),
            vscode.commands.registerCommand('unjucks.aiSuggest', () => 
                this.aiEngine.suggestTemplatesForContext()
            )
        ];

        this.context.subscriptions.push(...commands);
    }

    private async generateTemplate(
        templateItem?: TemplateItem, 
        targetUri?: vscode.Uri
    ): Promise<void> {
        try {
            let template = templateItem;
            
            // If no template provided, show quick pick
            if (!template) {
                const templates = await this.templateProvider.getTemplates();
                const selected = await vscode.window.showQuickPick(
                    templates.map(t => ({
                        label: t.label,
                        description: t.description,
                        detail: t.path,
                        template: t
                    })),
                    { placeHolder: 'Select a template to generate' }
                );
                
                if (!selected) {
                    return;
                }
                template = selected.template;
            }

            // Determine target directory
            const targetPath = await this.getTargetPath(targetUri);
            if (!targetPath) {
                return;
            }

            // Collect variables
            const variables = await this.collectVariables(template);
            if (!variables) {
                return;
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating template...",
                cancellable: true
            }, async (progress) => {
                progress.report({ increment: 20, message: "Processing template" });
                
                // Use MCP agents if enabled
                if (this.getConfig('mcpEnabled') && template.complexity > 3) {
                    progress.report({ increment: 40, message: "Coordinating AI agents" });
                    await this.swarmCoordinator.generateWithSwarm(template, variables, targetPath);
                } else {
                    progress.report({ increment: 40, message: "Rendering template" });
                    await this.generateDirectly(template, variables, targetPath);
                }
                
                progress.report({ increment: 80, message: "Finalizing" });
                
                // Run compliance check
                if (this.getConfig('complianceChecking')) {
                    await this.complianceValidator.validateGenerated(targetPath);
                }
            });

            vscode.window.showInformationMessage(
                `Template "${template.label}" generated successfully!`
            );

        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to generate template: ${error}`
            );
            console.error('Template generation error:', error);
        }
    }

    private async previewTemplate(templateItem: TemplateItem): Promise<void> {
        try {
            const variables = await this.collectVariables(templateItem, true);
            if (!variables) {
                return;
            }

            const previewUri = vscode.Uri.parse(
                `unjucks-preview://preview/${templateItem.id}.preview`
            );

            // Update preview content
            await this.previewProvider.updatePreview(templateItem, variables);

            // Open preview
            const doc = await vscode.workspace.openTextDocument(previewUri);
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Preview failed: ${error}`);
        }
    }

    private async collectVariables(
        template: TemplateItem, 
        useDefaults: boolean = false
    ): Promise<Record<string, any> | undefined> {
        const variables: Record<string, any> = {};

        // Get template variable definitions
        const templateVars = await this.templateProvider.getTemplateVariables(template);

        if (templateVars.length === 0) {
            return {};
        }

        if (useDefaults) {
            // Use default values for preview
            for (const variable of templateVars) {
                variables[variable.name] = variable.default || this.getDefaultValue(variable.type);
            }
            return variables;
        }

        // Interactive variable collection
        for (const variable of templateVars) {
            let value: string | undefined;
            
            if (variable.options) {
                // Show quick pick for enum variables
                value = await vscode.window.showQuickPick(variable.options, {
                    placeHolder: `Select ${variable.name}`,
                    ignoreFocusOut: true
                });
            } else {
                // Show input box for text variables
                value = await vscode.window.showInputBox({
                    prompt: `Enter ${variable.name}`,
                    placeHolder: variable.description || variable.name,
                    value: variable.default,
                    ignoreFocusOut: true,
                    validateInput: (input) => this.validateVariable(input, variable)
                });
            }

            if (value === undefined) {
                return undefined; // User cancelled
            }

            variables[variable.name] = this.convertValue(value, variable.type);
        }

        // Add AI-suggested context variables
        if (this.getConfig('aiSuggestions')) {
            const contextVars = await this.aiEngine.getContextVariables();
            Object.assign(variables, contextVars);
        }

        return variables;
    }

    private async generateDirectly(
        template: TemplateItem, 
        variables: Record<string, any>, 
        targetPath: string
    ): Promise<void> {
        // Direct generation without swarm coordination
        const templatePath = template.path;
        
        // Execute unjucks CLI
        const { execFile } = require('child_process');
        const unjucksPath = vscode.workspace.getConfiguration('unjucks').get<string>('cliPath') || 'unjucks';
        
        return new Promise((resolve, reject) => {
            const args = ['generate', template.generator, template.name];
            
            // Add variables as CLI flags
            for (const [key, value] of Object.entries(variables)) {
                args.push(`--${key}`, String(value));
            }
            
            args.push('--dest', targetPath);
            
            execFile(unjucksPath, args, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`${error.message}\n${stderr}`));
                } else {
                    resolve();
                }
            });
        });
    }

    private async getTargetPath(targetUri?: vscode.Uri): Promise<string | undefined> {
        if (targetUri) {
            const stat = await vscode.workspace.fs.stat(targetUri);
            if (stat.type === vscode.FileType.Directory) {
                return targetUri.fsPath;
            } else {
                return vscode.Uri.joinPath(targetUri, '..').fsPath;
            }
        }

        // Use workspace folder or ask user
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length === 1) {
            return workspaceFolders[0].uri.fsPath;
        }

        // Multiple workspaces or no workspace - ask user
        const folder = await vscode.window.showWorkspaceFolderPick();
        return folder?.uri.fsPath;
    }

    private setupFileWatchers(): void {
        // Watch template directory for changes
        const templatesPath = this.getConfig('templatesPath');
        
        if (vscode.workspace.workspaceFolders) {
            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const templateGlob = new vscode.RelativePattern(
                    workspaceFolder,
                    `${templatesPath}/**/*`
                );
                
                const watcher = vscode.workspace.createFileSystemWatcher(templateGlob);
                
                watcher.onDidCreate(() => this.templateProvider.refresh());
                watcher.onDidDelete(() => this.templateProvider.refresh());
                watcher.onDidChange(() => this.templateProvider.refresh());
                
                this.context.subscriptions.push(watcher);
            }
        }
    }

    private setupContextualSuggestions(): void {
        // Show template suggestions when creating new files
        vscode.workspace.onDidCreateFiles(async (event) => {
            if (!this.getConfig('aiSuggestions')) {
                return;
            }

            for (const file of event.files) {
                const suggestions = await this.aiEngine.suggestForNewFile(file);
                if (suggestions.length > 0) {
                    this.showSuggestionNotification(suggestions);
                }
            }
        }, null, this.context.subscriptions);

        // Show suggestions when changing active editor
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (!editor || !this.getConfig('aiSuggestions')) {
                return;
            }

            const suggestions = await this.aiEngine.suggestForContext(editor);
            if (suggestions.length > 0) {
                this.updateStatusBarWithSuggestions(suggestions.length);
            }
        }, null, this.context.subscriptions);
    }

    private async showSuggestionNotification(suggestions: any[]): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            `Found ${suggestions.length} relevant template(s) for this file type`,
            'View Suggestions',
            'Dismiss'
        );

        if (action === 'View Suggestions') {
            await vscode.commands.executeCommand('unjucks.aiSuggest');
        }
    }

    private updateStatusBarWithSuggestions(count: number): void {
        this.statusBarItem.text = `$(file-code) Unjucks (${count})`;
        this.statusBarItem.tooltip = `${count} template suggestions available`;
    }

    private validateVariable(input: string, variable: any): string | undefined {
        if (variable.required && !input) {
            return `${variable.name} is required`;
        }
        
        if (variable.pattern && !new RegExp(variable.pattern).test(input)) {
            return `Invalid format for ${variable.name}`;
        }
        
        return undefined;
    }

    private convertValue(value: string, type: string): any {
        switch (type) {
            case 'boolean':
                return value.toLowerCase() === 'true';
            case 'number':
                return parseInt(value, 10);
            case 'array':
                return value.split(',').map(s => s.trim());
            default:
                return value;
        }
    }

    private getDefaultValue(type: string): any {
        switch (type) {
            case 'boolean':
                return false;
            case 'number':
                return 0;
            case 'array':
                return [];
            default:
                return '';
        }
    }

    private getConfig<T>(key: string): T {
        return vscode.workspace.getConfiguration('unjucks').get<T>(key) as T;
    }

    private getDisposables(): vscode.Disposable[] {
        return [
            this.templateProvider,
            this.previewProvider,
            this.mcpIntegration,
            this.aiEngine,
            this.complianceValidator,
            this.swarmCoordinator,
            this.marketplaceManager
        ].filter(d => d && typeof d.dispose === 'function');
    }

    public deactivate(): void {
        console.log('Unjucks extension is now inactive');
    }
}

let extension: UnjucksExtension;

export function activate(context: vscode.ExtensionContext) {
    extension = new UnjucksExtension(context);
    return extension.activate();
}

export function deactivate() {
    if (extension) {
        extension.deactivate();
    }
}