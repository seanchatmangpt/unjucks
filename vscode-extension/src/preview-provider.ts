import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as nunjucks from 'nunjucks';
import { TemplateItem } from './template-browser';

export class PreviewProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    private previews: Map<string, PreviewContent> = new Map();
    private nunjucksEnv: nunjucks.Environment;

    constructor(private context: vscode.ExtensionContext) {
        this.nunjucksEnv = new nunjucks.Environment();
        this.setupNunjucksFilters();
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const previewId = this.getPreviewId(uri);
        const preview = this.previews.get(previewId);
        
        if (!preview) {
            return 'Preview not available. Please regenerate the preview.';
        }

        try {
            const content = await this.renderPreview(preview);
            return content;
        } catch (error) {
            return `Preview Error:\n\n${error}\n\nTemplate: ${preview.template.path}\nVariables: ${JSON.stringify(preview.variables, null, 2)}`;
        }
    }

    async updatePreview(template: TemplateItem, variables: Record<string, any>): Promise<void> {
        const previewId = template.id;
        
        this.previews.set(previewId, {
            template,
            variables,
            timestamp: Date.now()
        });

        const previewUri = vscode.Uri.parse(`unjucks-preview://preview/${previewId}.preview`);
        this._onDidChange.fire(previewUri);
    }

    private async renderPreview(preview: PreviewContent): Promise<string> {
        const { template, variables } = preview;
        
        // Get all template files
        const files = await this.getTemplateFiles(template.path);
        
        if (files.length === 0) {
            return 'No template files found.';
        }

        // Render each file
        const renderedFiles: RenderedFile[] = [];
        
        for (const file of files) {
            try {
                const rendered = await this.renderFile(file, variables, template.path);
                renderedFiles.push(rendered);
            } catch (error) {
                renderedFiles.push({
                    originalPath: file.path,
                    renderedPath: file.path,
                    content: `Error rendering file: ${error}`,
                    isError: true
                });
            }
        }

        // Format preview content
        return this.formatPreviewContent(template, variables, renderedFiles);
    }

    private async renderFile(
        file: TemplateFile, 
        variables: Record<string, any>,
        templateRoot: string
    ): Promise<RenderedFile> {
        const content = await fs.readFile(file.path, 'utf8');
        
        // Parse frontmatter if present
        const { frontmatter, body } = this.parseFrontmatter(content);
        
        // Create enhanced variables context
        const context = {
            ...variables,
            ...this.createHelperContext(variables),
            h: this.createNunjucksHelpers()
        };

        // Render filename
        const relativePath = path.relative(templateRoot, file.path);
        const renderedPath = this.nunjucksEnv.renderString(relativePath, context);

        // Render content
        let renderedContent: string;
        
        if (this.shouldRenderFile(file.path)) {
            renderedContent = this.nunjucksEnv.renderString(body, context);
        } else {
            renderedContent = body; // Binary or non-template files
        }

        // Apply frontmatter processing hints
        if (frontmatter.to) {
            const renderedTo = this.nunjucksEnv.renderString(frontmatter.to, context);
            renderedContent = `// Target: ${renderedTo}\n${renderedContent}`;
        }

        return {
            originalPath: relativePath,
            renderedPath,
            content: renderedContent,
            frontmatter,
            isError: false
        };
    }

    private async getTemplateFiles(templatePath: string): Promise<TemplateFile[]> {
        const files: TemplateFile[] = [];
        
        try {
            await this.scanDirectory(templatePath, templatePath, files);
        } catch (error) {
            console.error('Error getting template files:', error);
        }
        
        return files.sort((a, b) => a.path.localeCompare(b.path));
    }

    private async scanDirectory(
        dirPath: string, 
        rootPath: string, 
        files: TemplateFile[]
    ): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // Skip certain directories
                if (!this.shouldSkipDirectory(entry.name)) {
                    await this.scanDirectory(fullPath, rootPath, files);
                }
            } else if (entry.isFile()) {
                // Skip certain files
                if (!this.shouldSkipFile(entry.name)) {
                    files.push({
                        path: fullPath,
                        name: entry.name,
                        relativePath: path.relative(rootPath, fullPath),
                        size: 0 // We'll get this if needed
                    });
                }
            }
        }
    }

    private shouldSkipDirectory(name: string): boolean {
        const skipDirs = ['node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.next', '.nuxt'];
        return skipDirs.includes(name) || name.startsWith('.');
    }

    private shouldSkipFile(name: string): boolean {
        const skipFiles = [
            '.DS_Store', 'Thumbs.db', '.gitignore', '.npmignore',
            'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
        ];
        return skipFiles.includes(name);
    }

    private shouldRenderFile(filePath: string): boolean {
        const textExtensions = [
            '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf',
            '.sh', '.bat', '.ps1', '.py', '.rb', '.go', '.rs',
            '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php',
            '.sql', '.graphql', '.proto', '.dockerfile', '.njk',
            '.nunjucks', '.hbs', '.mustache', '.ejs', '.vue',
            '.svelte', '.astro'
        ];
        
        const ext = path.extname(filePath).toLowerCase();
        return textExtensions.includes(ext) || !ext;
    }

    private parseFrontmatter(content: string): { frontmatter: any; body: string } {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        
        if (match) {
            try {
                const yaml = require('yaml');
                const frontmatter = yaml.parse(match[1]);
                return { frontmatter, body: match[2] };
            } catch (error) {
                console.error('Error parsing frontmatter:', error);
            }
        }
        
        return { frontmatter: {}, body: content };
    }

    private createHelperContext(variables: Record<string, any>): Record<string, any> {
        return {
            // String helpers
            camelCase: (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()),
            pascalCase: (str: string) => str.replace(/(?:^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase()),
            snakeCase: (str: string) => str.replace(/-/g, '_').toLowerCase(),
            kebabCase: (str: string) => str.replace(/[A-Z]/g, (g) => `-${g.toLowerCase()}`),
            upperCase: (str: string) => str.toUpperCase(),
            lowerCase: (str: string) => str.toLowerCase(),
            
            // Date helpers
            now: new Date(),
            year: new Date().getFullYear(),
            
            // Project helpers
            projectName: this.getProjectName(),
            workspaceName: this.getWorkspaceName(),
            
            // Utility helpers
            uuid: () => this.generateUUID(),
            randomId: () => Math.random().toString(36).substr(2, 9)
        };
    }

    private createNunjucksHelpers(): Record<string, any> {
        return {
            // File system helpers
            exists: (filePath: string) => existsSync(filePath),
            
            // String manipulation
            indent: (str: string, spaces: number = 2) => 
                str.split('\n').map(line => ' '.repeat(spaces) + line).join('\n'),
            
            // Code generation helpers
            importStatement: (module: string, imports?: string[]) => {
                if (imports) {
                    return `import { ${imports.join(', ')} } from '${module}';`;
                }
                return `import ${module};`;
            },
            
            exportStatement: (name: string, isDefault: boolean = false) => {
                return isDefault ? `export default ${name};` : `export { ${name} };`;
            }
        };
    }

    private setupNunjucksFilters(): void {
        this.nunjucksEnv.addFilter('camelCase', (str: string) => 
            str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        );
        
        this.nunjucksEnv.addFilter('pascalCase', (str: string) => 
            str.replace(/(?:^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase())
        );
        
        this.nunjucksEnv.addFilter('snakeCase', (str: string) => 
            str.replace(/-/g, '_').toLowerCase()
        );
        
        this.nunjucksEnv.addFilter('kebabCase', (str: string) => 
            str.replace(/[A-Z]/g, (g) => `-${g.toLowerCase()}`)
        );
        
        this.nunjucksEnv.addFilter('indent', (str: string, spaces: number = 2) => 
            str.split('\n').map(line => ' '.repeat(spaces) + line).join('\n')
        );
    }

    private formatPreviewContent(
        template: TemplateItem, 
        variables: Record<string, any>, 
        files: RenderedFile[]
    ): string {
        const sections: string[] = [];
        
        // Header
        sections.push(`# Template Preview: ${template.label}`);
        sections.push('');
        
        if (template.description) {
            sections.push(template.description);
            sections.push('');
        }
        
        // Variables
        sections.push('## Variables');
        sections.push('```json');
        sections.push(JSON.stringify(variables, null, 2));
        sections.push('```');
        sections.push('');
        
        // Files
        sections.push(`## Generated Files (${files.length})`);
        sections.push('');
        
        for (const file of files) {
            sections.push(`### ${file.renderedPath}`);
            
            if (file.originalPath !== file.renderedPath) {
                sections.push(`*Original: ${file.originalPath}*`);
            }
            
            sections.push('');
            
            if (file.isError) {
                sections.push('```');
                sections.push(file.content);
                sections.push('```');
            } else {
                const language = this.inferLanguage(file.renderedPath);
                sections.push(`\`\`\`${language}`);
                sections.push(file.content);
                sections.push('```');
            }
            
            sections.push('');
        }
        
        return sections.join('\n');
    }

    private inferLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            '.js': 'javascript',
            '.jsx': 'jsx',
            '.ts': 'typescript',
            '.tsx': 'tsx',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.xml': 'xml',
            '.md': 'markdown',
            '.py': 'python',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.php': 'php',
            '.sql': 'sql',
            '.sh': 'bash',
            '.ps1': 'powershell',
            '.dockerfile': 'dockerfile'
        };
        
        return languageMap[ext] || 'text';
    }

    private getPreviewId(uri: vscode.Uri): string {
        const segments = uri.path.split('/');
        const filename = segments[segments.length - 1];
        return filename.replace('.preview', '');
    }

    private getProjectName(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
            if (existsSync(packageJsonPath)) {
                try {
                    const packageJson = require(packageJsonPath);
                    return packageJson.name || workspaceFolder.name;
                } catch {
                    return workspaceFolder.name;
                }
            }
            return workspaceFolder.name;
        }
        return 'untitled';
    }

    private getWorkspaceName(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder?.name || 'workspace';
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}

interface PreviewContent {
    template: TemplateItem;
    variables: Record<string, any>;
    timestamp: number;
}

interface TemplateFile {
    path: string;
    name: string;
    relativePath: string;
    size: number;
}

interface RenderedFile {
    originalPath: string;
    renderedPath: string;
    content: string;
    frontmatter?: any;
    isError: boolean;
}