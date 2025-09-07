import { resolve, join, relative } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { parse } from 'yaml';
import { performance } from 'perf_hooks';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'array' | 'object';
  description: string;
  default?: any;
  required?: boolean;
  choices?: string[];
  pattern?: string;
}

export interface TemplatePreview {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: TemplateVariable[];
  sampleOutput: string;
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  files: string[];
  path: string;
  meta: {
    author?: string;
    version?: string;
    created?: string;
    updated?: string;
    usage?: string;
    examples?: string[];
  };
}

export interface DiscoveryFilter {
  category?: string;
  tags?: string[];
  complexity?: string;
  search?: string;
  author?: string;
}

export class TemplateDiscovery {
  private templates: Map<string, TemplatePreview> = new Map();
  private indexed = false;
  private templatePaths: string[] = [];

  constructor(templatePaths: string[] = ['_templates', 'templates']) {
    this.templatePaths = templatePaths.map(p => resolve(p));
  }

  async indexTemplates(): Promise<void> {
    const startTime = performance.now();
    this.templates.clear();

    for (const templatePath of this.templatePaths) {
      if (existsSync(templatePath)) {
        await this.scanDirectory(templatePath);
      }
    }

    // Add built-in starter templates
    await this.addBuiltInTemplates();

    this.indexed = true;
    const endTime = performance.now();
    console.log(`Indexed ${this.templates.size} templates in ${Math.round(endTime - startTime)}ms`);
  }

  private async scanDirectory(dir: string, category = ''): Promise<void> {
    try {
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Check if this is a template directory (contains template files)
          const hasTemplateFiles = await this.hasTemplateFiles(fullPath);
          
          if (hasTemplateFiles) {
            const templateId = this.generateTemplateId(fullPath);
            const preview = await this.generatePreview(fullPath, templateId, category || entry);
            this.templates.set(templateId, preview);
          } else {
            // Recursively scan subdirectories
            await this.scanDirectory(fullPath, category || entry);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dir}:`, error);
    }
  }

  private async hasTemplateFiles(dir: string): Promise<boolean> {
    try {
      const entries = await readdir(dir);
      return entries.some(entry => 
        entry.endsWith('.ejs') || 
        entry.endsWith('.hbs') || 
        entry.endsWith('.njk') ||
        entry.includes('{{') ||
        entry.includes('<%')
      );
    } catch {
      return false;
    }
  }

  private generateTemplateId(path: string): string {
    const relativePath = this.templatePaths
      .map(basePath => relative(basePath, path))
      .find(rel => !rel.startsWith('..')) || path;
    
    return relativePath.replace(/[\/\\]/g, '/').replace(/^\/+/, '');
  }

  private async generatePreview(templatePath: string, id: string, category: string): Promise<TemplatePreview> {
    const files = await this.getTemplateFiles(templatePath);
    const variables = await this.extractVariables(templatePath, files);
    const meta = await this.extractMetadata(templatePath);
    const sampleOutput = await this.generateSampleOutput(templatePath, files, variables);

    return {
      id,
      name: meta.name || this.humanizeName(id),
      description: meta.description || `Template for ${category}`,
      category,
      variables,
      sampleOutput,
      tags: meta.tags || [category],
      complexity: meta.complexity || this.inferComplexity(variables, files),
      files: files.map(f => relative(templatePath, f)),
      path: templatePath,
      meta
    };
  }

  private async getTemplateFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          const subFiles = await this.getTemplateFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      console.warn(`Failed to read template files from ${dir}:`, error);
    }

    return files;
  }

  private async extractVariables(templatePath: string, files: string[]): Promise<TemplateVariable[]> {
    const variables: Map<string, TemplateVariable> = new Map();
    const variablePattern = /\{\{\s*([^}]+)\s*\}\}/g;
    const ejsPattern = /<%=?\s*([^%]+)\s*%>/g;

    // Check for metadata file first
    const metaFile = join(templatePath, 'meta.yml');
    if (existsSync(metaFile)) {
      try {
        const metaContent = await readFile(metaFile, 'utf-8');
        const meta = parse(metaContent);
        if (meta.variables) {
          return meta.variables;
        }
      } catch (error) {
        console.warn(`Failed to parse metadata file ${metaFile}:`, error);
      }
    }

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        
        // Extract Nunjucks/Handlebars variables
        let match;
        while ((match = variablePattern.exec(content)) !== null) {
          const varExpr = match[1].trim();
          const varName = this.parseVariableName(varExpr);
          
          if (varName && !variables.has(varName)) {
            variables.set(varName, {
              name: varName,
              type: this.inferVariableType(varExpr, content),
              description: this.generateVariableDescription(varName),
              required: !varExpr.includes('|') && !varExpr.includes('default')
            });
          }
        }

        // Extract EJS variables
        while ((match = ejsPattern.exec(content)) !== null) {
          const varExpr = match[1].trim();
          const varName = this.parseVariableName(varExpr);
          
          if (varName && !variables.has(varName)) {
            variables.set(varName, {
              name: varName,
              type: this.inferVariableType(varExpr, content),
              description: this.generateVariableDescription(varName),
              required: true
            });
          }
        }

        // Extract from filename patterns
        const filename = relative(templatePath, file);
        const filenameVars = this.extractFilenameVariables(filename);
        for (const varName of filenameVars) {
          if (!variables.has(varName)) {
            variables.set(varName, {
              name: varName,
              type: 'string',
              description: this.generateVariableDescription(varName),
              required: true
            });
          }
        }

      } catch (error) {
        console.warn(`Failed to extract variables from ${file}:`, error);
      }
    }

    return Array.from(variables.values());
  }

  private parseVariableName(expr: string): string | null {
    // Handle various variable expression formats
    const cleanExpr = expr.split('|')[0].split('.')[0].trim();
    
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cleanExpr)) {
      return cleanExpr;
    }

    return null;
  }

  private inferVariableType(expr: string, content: string): TemplateVariable['type'] {
    if (expr.includes('each') || expr.includes('for')) return 'array';
    if (expr.includes('if') || expr.toLowerCase().includes('boolean')) return 'boolean';
    if (content.includes(`${expr}.`) || content.includes(`${expr}[`)) return 'object';
    return 'string';
  }

  private generateVariableDescription(name: string): string {
    const descriptions: Record<string, string> = {
      name: 'The name identifier',
      title: 'Display title',
      description: 'Description text',
      author: 'Author name',
      version: 'Version number',
      className: 'CSS class name',
      componentName: 'Component name',
      moduleName: 'Module name',
      functionName: 'Function name',
      apiKey: 'API key',
      port: 'Port number',
      host: 'Host address',
      database: 'Database name',
      table: 'Table name',
      model: 'Model name',
      route: 'Route path',
      method: 'HTTP method',
      endpoint: 'API endpoint',
      schema: 'Database schema',
      type: 'Data type',
      props: 'Component properties',
      state: 'Component state',
      config: 'Configuration object',
      options: 'Options object',
      params: 'Parameters',
      args: 'Arguments',
      data: 'Data object'
    };

    return descriptions[name] || `${name.charAt(0).toUpperCase()}${name.slice(1)} value`;
  }

  private extractFilenameVariables(filename: string): string[] {
    const variables: string[] = [];
    const patterns = [
      /\{\{\s*([^}]+)\s*\}\}/g,
      /<%=?\s*([^%]+)\s*%>/g,
      /__([^_]+)__/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(filename)) !== null) {
        const varName = this.parseVariableName(match[1]);
        if (varName) {
          variables.push(varName);
        }
      }
    }

    return variables;
  }

  private async extractMetadata(templatePath: string): Promise<TemplatePreview['meta']> {
    const metaFiles = ['meta.yml', 'meta.yaml', 'template.yml', 'template.yaml', '.template.yml'];
    
    for (const metaFile of metaFiles) {
      const metaPath = join(templatePath, metaFile);
      if (existsSync(metaPath)) {
        try {
          const content = await readFile(metaPath, 'utf-8');
          return parse(content) || {};
        } catch (error) {
          console.warn(`Failed to parse metadata file ${metaPath}:`, error);
        }
      }
    }

    // Try to extract from README files
    const readmeFiles = ['README.md', 'readme.md', 'README.txt'];
    for (const readmeFile of readmeFiles) {
      const readmePath = join(templatePath, readmeFile);
      if (existsSync(readmePath)) {
        try {
          const content = await readFile(readmePath, 'utf-8');
          return this.parseReadmeMeta(content);
        } catch (error) {
          console.warn(`Failed to read README file ${readmePath}:`, error);
        }
      }
    }

    return {};
  }

  private parseReadmeMeta(content: string): TemplatePreview['meta'] {
    const meta: TemplatePreview['meta'] = {};
    
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      meta.name = titleMatch[1];
    }

    const descMatch = content.match(/^#[^#\n]*\n\n(.+?)$/m);
    if (descMatch) {
      meta.description = descMatch[1];
    }

    return meta;
  }

  private async generateSampleOutput(
    templatePath: string, 
    files: string[], 
    variables: TemplateVariable[]
  ): Promise<string> {
    // Generate sample values for variables
    const sampleVars = this.generateSampleVariables(variables);
    
    // Find the main template file
    const mainFile = files.find(f => 
      f.includes('index') || 
      f.includes('main') || 
      files.length === 1
    ) || files[0];

    if (!mainFile) return 'No template files found';

    try {
      const content = await readFile(mainFile, 'utf-8');
      
      // Simple variable substitution for preview
      let preview = content;
      for (const [key, value] of Object.entries(sampleVars)) {
        const patterns = [
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          new RegExp(`<%=?\\s*${key}\\s*%>`, 'g')
        ];
        
        for (const pattern of patterns) {
          preview = preview.replace(pattern, String(value));
        }
      }

      // Limit preview length
      if (preview.length > 500) {
        preview = preview.substring(0, 497) + '...';
      }

      return preview;
    } catch (error) {
      return `Error generating preview: ${error}`;
    }
  }

  private generateSampleVariables(variables: TemplateVariable[]): Record<string, any> {
    const samples: Record<string, any> = {};
    
    for (const variable of variables) {
      if (variable.default !== undefined) {
        samples[variable.name] = variable.default;
      } else {
        samples[variable.name] = this.generateSampleValue(variable);
      }
    }

    return samples;
  }

  private generateSampleValue(variable: TemplateVariable): any {
    if (variable.choices && variable.choices.length > 0) {
      return variable.choices[0];
    }

    switch (variable.type) {
      case 'boolean':
        return true;
      case 'array':
        return ['item1', 'item2'];
      case 'object':
        return { key: 'value' };
      case 'string':
      default:
        return this.generateSampleString(variable.name);
    }
  }

  private generateSampleString(name: string): string {
    const samples: Record<string, string> = {
      name: 'MyComponent',
      title: 'My Title',
      description: 'A sample description',
      author: 'John Doe',
      version: '1.0.0',
      className: 'my-class',
      componentName: 'MyComponent',
      moduleName: 'myModule',
      functionName: 'myFunction',
      port: '3000',
      host: 'localhost',
      database: 'mydb',
      table: 'users',
      model: 'User',
      route: '/api/users',
      method: 'GET',
      endpoint: '/api/endpoint',
      type: 'string'
    };

    return samples[name] || name.charAt(0).toUpperCase() + name.slice(1);
  }

  private inferComplexity(variables: TemplateVariable[], files: string[]): 'beginner' | 'intermediate' | 'advanced' {
    const score = variables.length + files.length;
    
    if (score <= 5) return 'beginner';
    if (score <= 15) return 'intermediate';
    return 'advanced';
  }

  private humanizeName(id: string): string {
    return id
      .split('/')
      .pop()!
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private async addBuiltInTemplates(): Promise<void> {
    const builtInPath = resolve(__dirname, '../../templates/starters');
    if (existsSync(builtInPath)) {
      await this.scanDirectory(builtInPath, 'starter');
    }
  }

  // Public API methods
  
  async getTemplates(): Promise<TemplatePreview[]> {
    if (!this.indexed) {
      await this.indexTemplates();
    }
    return Array.from(this.templates.values());
  }

  async getTemplate(id: string): Promise<TemplatePreview | null> {
    if (!this.indexed) {
      await this.indexTemplates();
    }
    return this.templates.get(id) || null;
  }

  async searchTemplates(filter: DiscoveryFilter): Promise<TemplatePreview[]> {
    const templates = await this.getTemplates();
    
    return templates.filter(template => {
      if (filter.category && template.category !== filter.category) {
        return false;
      }
      
      if (filter.complexity && template.complexity !== filter.complexity) {
        return false;
      }
      
      if (filter.tags && !filter.tags.some(tag => template.tags.includes(tag))) {
        return false;
      }
      
      if (filter.author && template.meta.author !== filter.author) {
        return false;
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const searchableText = [
          template.name,
          template.description,
          ...template.tags,
          template.category
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }

  async getCategories(): Promise<string[]> {
    const templates = await this.getTemplates();
    const categories = new Set(templates.map(t => t.category));
    return Array.from(categories).sort();
  }

  async getTags(): Promise<string[]> {
    const templates = await this.getTemplates();
    const tags = new Set(templates.flatMap(t => t.tags));
    return Array.from(tags).sort();
  }

  async getRecommendations(projectContext?: any): Promise<TemplatePreview[]> {
    const templates = await this.getTemplates();
    
    // Simple recommendation based on project context
    if (projectContext?.packageJson) {
      const deps = Object.keys({
        ...projectContext.packageJson.dependencies,
        ...projectContext.packageJson.devDependencies
      });
      
      const scores = templates.map(template => ({
        template,
        score: this.calculateRecommendationScore(template, deps, projectContext)
      }));
      
      return scores
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.template);
    }
    
    // Default recommendations - most popular beginner templates
    return templates
      .filter(t => t.complexity === 'beginner')
      .slice(0, 5);
  }

  private calculateRecommendationScore(template: TemplatePreview, deps: string[], context: any): number {
    let score = 0;
    
    // Score based on dependencies
    const templateTags = template.tags.map(t => t.toLowerCase());
    for (const dep of deps) {
      if (templateTags.includes(dep.toLowerCase())) {
        score += 10;
      }
      if (dep.includes('react') && templateTags.includes('react')) {
        score += 5;
      }
      if (dep.includes('vue') && templateTags.includes('vue')) {
        score += 5;
      }
      if (dep.includes('express') && templateTags.includes('api')) {
        score += 5;
      }
    }
    
    // Score based on complexity (prefer simpler for new projects)
    if (template.complexity === 'beginner') score += 3;
    if (template.complexity === 'intermediate') score += 1;
    
    return score;
  }

  async refreshIndex(): Promise<void> {
    this.indexed = false;
    await this.indexTemplates();
  }
}

// Singleton instance
export const templateDiscovery = new TemplateDiscovery();