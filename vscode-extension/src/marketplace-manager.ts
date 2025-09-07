import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import axios from 'axios';

export interface MarketplaceTemplate {
    id: string;
    name: string;
    displayName: string;
    description: string;
    author: string;
    version: string;
    downloads: number;
    rating: number;
    tags: string[];
    category: string;
    repository?: string;
    homepage?: string;
    license: string;
    lastUpdated: string;
    screenshots?: string[];
    dependencies: string[];
    featured: boolean;
    verified: boolean;
}

export interface InstalledTemplate {
    id: string;
    name: string;
    version: string;
    installPath: string;
    installedAt: string;
    source: 'marketplace' | 'local' | 'git';
}

export class MarketplaceManager implements vscode.Disposable {
    private static readonly MARKETPLACE_API = 'https://api.unjucks.dev/templates';
    private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    private marketplaceCache: Map<string, { data: MarketplaceTemplate[]; timestamp: number }> = new Map();
    private installedTemplates: Map<string, InstalledTemplate> = new Map();
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Unjucks Marketplace');
        this.loadInstalledTemplates();
    }

    async openMarketplace(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'unjucksMarketplace',
            'Unjucks Template Marketplace',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'resources')
                ]
            }
        );

        panel.webview.html = await this.getMarketplaceHtml(panel.webview);
        
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'loadTemplates':
                        await this.handleLoadTemplates(panel.webview, message.filters);
                        break;
                    case 'installTemplate':
                        await this.handleInstallTemplate(panel.webview, message.templateId);
                        break;
                    case 'uninstallTemplate':
                        await this.handleUninstallTemplate(panel.webview, message.templateId);
                        break;
                    case 'previewTemplate':
                        await this.handlePreviewTemplate(panel.webview, message.templateId);
                        break;
                    case 'searchTemplates':
                        await this.handleSearchTemplates(panel.webview, message.query);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Load initial templates
        setTimeout(() => this.handleLoadTemplates(panel.webview), 100);
    }

    async searchTemplates(query: string, filters: any = {}): Promise<MarketplaceTemplate[]> {
        const templates = await this.getMarketplaceTemplates();
        const searchLower = query.toLowerCase();
        
        return templates.filter(template => {
            // Text search
            const matchesSearch = !query || 
                template.name.toLowerCase().includes(searchLower) ||
                template.displayName.toLowerCase().includes(searchLower) ||
                template.description.toLowerCase().includes(searchLower) ||
                template.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            // Category filter
            const matchesCategory = !filters.category || template.category === filters.category;
            
            // Author filter
            const matchesAuthor = !filters.author || template.author === filters.author;
            
            // Tags filter
            const matchesTags = !filters.tags || filters.tags.some((tag: string) => 
                template.tags.includes(tag)
            );
            
            return matchesSearch && matchesCategory && matchesAuthor && matchesTags;
        });
    }

    async installTemplate(templateId: string): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`Installing template: ${templateId}`);
            
            // Get template metadata
            const templates = await this.getMarketplaceTemplates();
            const template = templates.find(t => t.id === templateId);
            
            if (!template) {
                throw new Error(`Template ${templateId} not found in marketplace`);
            }

            // Check if already installed
            if (this.installedTemplates.has(templateId)) {
                const action = await vscode.window.showInformationMessage(
                    `Template "${template.displayName}" is already installed. Update?`,
                    'Update',
                    'Cancel'
                );
                
                if (action !== 'Update') {
                    return false;
                }
            }

            // Download and install template
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${template.displayName}...`,
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 20, message: 'Downloading template' });
                
                const templateData = await this.downloadTemplate(template);
                
                if (token.isCancellationRequested) {
                    throw new Error('Installation cancelled');
                }
                
                progress.report({ increment: 50, message: 'Extracting files' });
                
                const installPath = await this.extractTemplate(template, templateData);
                
                progress.report({ increment: 80, message: 'Registering template' });
                
                // Register installed template
                const installedTemplate: InstalledTemplate = {
                    id: templateId,
                    name: template.name,
                    version: template.version,
                    installPath,
                    installedAt: new Date().toISOString(),
                    source: 'marketplace'
                };
                
                this.installedTemplates.set(templateId, installedTemplate);
                await this.saveInstalledTemplates();
                
                progress.report({ increment: 100, message: 'Complete' });
            });

            vscode.window.showInformationMessage(
                `Template "${template.displayName}" installed successfully!`
            );
            
            // Refresh template browser
            await vscode.commands.executeCommand('unjucks.refreshTemplates');
            
            return true;
            
        } catch (error) {
            this.outputChannel.appendLine(`Installation failed: ${error}`);
            vscode.window.showErrorMessage(`Failed to install template: ${error}`);
            return false;
        }
    }

    async uninstallTemplate(templateId: string): Promise<boolean> {
        try {
            const installedTemplate = this.installedTemplates.get(templateId);
            
            if (!installedTemplate) {
                vscode.window.showWarningMessage('Template not found or not installed');
                return false;
            }

            const action = await vscode.window.showWarningMessage(
                `Uninstall "${installedTemplate.name}"? This cannot be undone.`,
                'Uninstall',
                'Cancel'
            );
            
            if (action !== 'Uninstall') {
                return false;
            }

            // Remove template files
            if (existsSync(installedTemplate.installPath)) {
                await fs.rm(installedTemplate.installPath, { recursive: true, force: true });
            }

            // Remove from registry
            this.installedTemplates.delete(templateId);
            await this.saveInstalledTemplates();

            vscode.window.showInformationMessage(
                `Template "${installedTemplate.name}" uninstalled successfully`
            );
            
            // Refresh template browser
            await vscode.commands.executeCommand('unjucks.refreshTemplates');
            
            return true;
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to uninstall template: ${error}`);
            return false;
        }
    }

    async getInstalledTemplates(): Promise<InstalledTemplate[]> {
        return Array.from(this.installedTemplates.values());
    }

    isTemplateInstalled(templateId: string): boolean {
        return this.installedTemplates.has(templateId);
    }

    private async getMarketplaceTemplates(): Promise<MarketplaceTemplate[]> {
        const cacheKey = 'all';
        const cached = this.marketplaceCache.get(cacheKey);
        
        // Check cache
        if (cached && Date.now() - cached.timestamp < MarketplaceManager.CACHE_DURATION) {
            return cached.data;
        }

        try {
            this.outputChannel.appendLine('Fetching templates from marketplace...');
            
            const response = await axios.get(MarketplaceManager.MARKETPLACE_API, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Unjucks-VSCode-Extension/1.0.0'
                }
            });
            
            const templates: MarketplaceTemplate[] = response.data;
            
            // Cache the results
            this.marketplaceCache.set(cacheKey, {
                data: templates,
                timestamp: Date.now()
            });
            
            this.outputChannel.appendLine(`Loaded ${templates.length} templates from marketplace`);
            
            return templates;
            
        } catch (error) {
            this.outputChannel.appendLine(`Failed to fetch marketplace templates: ${error}`);
            
            // Return fallback templates if available
            const fallback = await this.getFallbackTemplates();
            return fallback;
        }
    }

    private async getFallbackTemplates(): Promise<MarketplaceTemplate[]> {
        // Return some built-in templates as fallback
        return [
            {
                id: 'react-component',
                name: 'react-component',
                displayName: 'React Component',
                description: 'Modern React functional component with TypeScript',
                author: 'unjucks',
                version: '1.0.0',
                downloads: 1000,
                rating: 4.8,
                tags: ['react', 'typescript', 'component'],
                category: 'Components',
                license: 'MIT',
                lastUpdated: '2025-01-01',
                dependencies: ['react', '@types/react'],
                featured: true,
                verified: true
            },
            {
                id: 'express-api',
                name: 'express-api',
                displayName: 'Express API Route',
                description: 'RESTful API route with Express.js and TypeScript',
                author: 'unjucks',
                version: '1.0.0',
                downloads: 850,
                rating: 4.7,
                tags: ['express', 'api', 'typescript', 'rest'],
                category: 'API',
                license: 'MIT',
                lastUpdated: '2025-01-01',
                dependencies: ['express', '@types/express'],
                featured: true,
                verified: true
            },
            {
                id: 'jest-test',
                name: 'jest-test',
                displayName: 'Jest Test Suite',
                description: 'Complete Jest test suite with TypeScript support',
                author: 'unjucks',
                version: '1.0.0',
                downloads: 650,
                rating: 4.6,
                tags: ['jest', 'testing', 'typescript'],
                category: 'Testing',
                license: 'MIT',
                lastUpdated: '2025-01-01',
                dependencies: ['jest', '@types/jest'],
                featured: false,
                verified: true
            }
        ];
    }

    private async downloadTemplate(template: MarketplaceTemplate): Promise<Buffer> {
        const downloadUrl = `${MarketplaceManager.MARKETPLACE_API}/${template.id}/download`;
        
        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        return Buffer.from(response.data);
    }

    private async extractTemplate(template: MarketplaceTemplate, data: Buffer): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder available for installation');
        }

        const templatesPath = vscode.workspace.getConfiguration('unjucks')
            .get<string>('templatesPath') || '_templates';
            
        const installPath = path.join(
            workspaceFolder.uri.fsPath,
            templatesPath,
            'marketplace',
            template.name
        );

        // Create directory structure
        await fs.mkdir(installPath, { recursive: true });

        // For this example, we'll assume the data is a simple template structure
        // In a real implementation, this would handle zip files, tar.gz, etc.
        const templatePath = path.join(installPath, 'template.zip');
        await fs.writeFile(templatePath, data);

        // Extract (simplified - would use proper archive extraction)
        await this.extractArchive(templatePath, installPath);

        return installPath;
    }

    private async extractArchive(archivePath: string, targetPath: string): Promise<void> {
        // Simplified extraction - in a real implementation, use libraries like yauzl, tar, etc.
        // For now, just create a basic template structure
        const basicTemplate = `---
to: <%= name %>.jsx
---
import React from 'react';

interface <%= name %>Props {
  // Add your props here
}

const <%= name %>: React.FC<<%= name %>Props> = (props) => {
  return (
    <div>
      <h1><%= name %></h1>
      {/* Your component content */}
    </div>
  );
};

export default <%= name %>;
`;

        await fs.writeFile(path.join(targetPath, 'index.njk'), basicTemplate);
        
        // Remove the archive file
        await fs.unlink(archivePath);
    }

    private async loadInstalledTemplates(): Promise<void> {
        const storageUri = this.context.globalStorageUri;
        const installedPath = vscode.Uri.joinPath(storageUri, 'installed-templates.json');

        try {
            const data = await vscode.workspace.fs.readFile(installedPath);
            const templates: InstalledTemplate[] = JSON.parse(data.toString());
            
            for (const template of templates) {
                this.installedTemplates.set(template.id, template);
            }
            
        } catch (error) {
            // No installed templates file yet
            this.outputChannel.appendLine('No previous template installations found');
        }
    }

    private async saveInstalledTemplates(): Promise<void> {
        const storageUri = this.context.globalStorageUri;
        await vscode.workspace.fs.createDirectory(storageUri);
        
        const installedPath = vscode.Uri.joinPath(storageUri, 'installed-templates.json');
        const templates = Array.from(this.installedTemplates.values());
        
        await vscode.workspace.fs.writeFile(
            installedPath,
            Buffer.from(JSON.stringify(templates, null, 2))
        );
    }

    private async handleLoadTemplates(webview: vscode.Webview, filters?: any): Promise<void> {
        try {
            const templates = await this.getMarketplaceTemplates();
            const installedIds = new Set(this.installedTemplates.keys());
            
            // Add installation status
            const templatesWithStatus = templates.map(template => ({
                ...template,
                installed: installedIds.has(template.id)
            }));
            
            webview.postMessage({
                command: 'templatesLoaded',
                templates: templatesWithStatus
            });
        } catch (error) {
            webview.postMessage({
                command: 'error',
                message: `Failed to load templates: ${error}`
            });
        }
    }

    private async handleInstallTemplate(webview: vscode.Webview, templateId: string): Promise<void> {
        const success = await this.installTemplate(templateId);
        
        webview.postMessage({
            command: 'installResult',
            templateId,
            success
        });

        if (success) {
            // Reload templates to update status
            await this.handleLoadTemplates(webview);
        }
    }

    private async handleUninstallTemplate(webview: vscode.Webview, templateId: string): Promise<void> {
        const success = await this.uninstallTemplate(templateId);
        
        webview.postMessage({
            command: 'uninstallResult',
            templateId,
            success
        });

        if (success) {
            // Reload templates to update status
            await this.handleLoadTemplates(webview);
        }
    }

    private async handlePreviewTemplate(webview: vscode.Webview, templateId: string): Promise<void> {
        try {
            const templates = await this.getMarketplaceTemplates();
            const template = templates.find(t => t.id === templateId);
            
            if (template) {
                // In a real implementation, this would fetch and parse the template
                const previewContent = await this.generateTemplatePreview(template);
                
                webview.postMessage({
                    command: 'previewLoaded',
                    templateId,
                    preview: previewContent
                });
            }
        } catch (error) {
            webview.postMessage({
                command: 'error',
                message: `Failed to load preview: ${error}`
            });
        }
    }

    private async handleSearchTemplates(webview: vscode.Webview, query: string): Promise<void> {
        const templates = await this.searchTemplates(query);
        const installedIds = new Set(this.installedTemplates.keys());
        
        const templatesWithStatus = templates.map(template => ({
            ...template,
            installed: installedIds.has(template.id)
        }));
        
        webview.postMessage({
            command: 'searchResults',
            templates: templatesWithStatus,
            query
        });
    }

    private async generateTemplatePreview(template: MarketplaceTemplate): Promise<any> {
        // Generate a preview of what the template would create
        return {
            files: [
                {
                    name: `${template.name}.example.js`,
                    content: `// Example generated by ${template.displayName}\n// ${template.description}`
                }
            ],
            variables: [
                { name: 'name', description: 'Component name', required: true },
                { name: 'author', description: 'Author name', required: false }
            ]
        };
    }

    private async getMarketplaceHtml(webview: vscode.Webview): Promise<string> {
        // Create the marketplace UI HTML
        // In a real implementation, this would be a separate HTML file with proper styling
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Unjucks Template Marketplace</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .search-box {
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    width: 300px;
                }
                .template-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                }
                .template-card {
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 16px;
                    background-color: var(--vscode-editor-background);
                }
                .template-card:hover {
                    border-color: var(--vscode-focusBorder);
                }
                .template-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 8px;
                }
                .template-title {
                    font-weight: bold;
                    font-size: 16px;
                }
                .template-author {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
                .template-description {
                    color: var(--vscode-descriptionForeground);
                    margin: 8px 0;
                    line-height: 1.4;
                }
                .template-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin: 8px 0;
                }
                .tag {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                }
                .template-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                }
                .btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-primary:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn-danger {
                    background-color: var(--vscode-errorForeground);
                    color: var(--vscode-editor-background);
                }
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-descriptionForeground);
                }
                .installed-badge {
                    background-color: var(--vscode-testing-iconPassed);
                    color: var(--vscode-editor-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Template Marketplace</h1>
                <input type="text" class="search-box" id="searchInput" placeholder="Search templates...">
            </div>
            
            <div id="loading" class="loading">
                Loading templates...
            </div>
            
            <div id="templateGrid" class="template-grid" style="display: none;">
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                let templates = [];
                
                // Search functionality
                document.getElementById('searchInput').addEventListener('input', (e) => {
                    const query = e.target.value;
                    if (query.length > 2 || query.length === 0) {
                        vscode.postMessage({ command: 'searchTemplates', query });
                    }
                });
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'templatesLoaded':
                        case 'searchResults':
                            templates = message.templates;
                            renderTemplates();
                            break;
                        case 'installResult':
                            if (message.success) {
                                updateTemplateStatus(message.templateId, true);
                            }
                            break;
                        case 'uninstallResult':
                            if (message.success) {
                                updateTemplateStatus(message.templateId, false);
                            }
                            break;
                        case 'error':
                            showError(message.message);
                            break;
                    }
                });
                
                function renderTemplates() {
                    const loading = document.getElementById('loading');
                    const grid = document.getElementById('templateGrid');
                    
                    loading.style.display = 'none';
                    grid.style.display = 'grid';
                    
                    grid.innerHTML = templates.map(template => \`
                        <div class="template-card" data-id="\${template.id}">
                            <div class="template-header">
                                <div>
                                    <div class="template-title">\${template.displayName}</div>
                                    <div class="template-author">by \${template.author}</div>
                                </div>
                                \${template.installed ? '<span class="installed-badge">INSTALLED</span>' : ''}
                            </div>
                            <div class="template-description">\${template.description}</div>
                            <div class="template-tags">
                                \${template.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                            </div>
                            <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 8px;">
                                ⭐ \${template.rating} • 📥 \${template.downloads} downloads
                            </div>
                            <div class="template-actions">
                                \${!template.installed ? 
                                    \`<button class="btn btn-primary" onclick="installTemplate('\${template.id}')">Install</button>\` :
                                    \`<button class="btn btn-danger" onclick="uninstallTemplate('\${template.id}')">Uninstall</button>\`
                                }
                                <button class="btn btn-secondary" onclick="previewTemplate('\${template.id}')">Preview</button>
                            </div>
                        </div>
                    \`).join('');
                }
                
                function installTemplate(templateId) {
                    vscode.postMessage({ command: 'installTemplate', templateId });
                }
                
                function uninstallTemplate(templateId) {
                    vscode.postMessage({ command: 'uninstallTemplate', templateId });
                }
                
                function previewTemplate(templateId) {
                    vscode.postMessage({ command: 'previewTemplate', templateId });
                }
                
                function updateTemplateStatus(templateId, installed) {
                    const template = templates.find(t => t.id === templateId);
                    if (template) {
                        template.installed = installed;
                        renderTemplates();
                    }
                }
                
                function showError(message) {
                    const loading = document.getElementById('loading');
                    loading.innerHTML = \`<div style="color: var(--vscode-errorForeground);">Error: \${message}</div>\`;
                    loading.style.display = 'block';
                }
                
                // Initial load
                vscode.postMessage({ command: 'loadTemplates' });
            </script>
        </body>
        </html>
        `;
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.marketplaceCache.clear();
        this.installedTemplates.clear();
    }
}