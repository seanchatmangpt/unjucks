import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileSystemHelper } from './helpers.js';

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface TemplateFile {
  path: string;
  content: string;
  frontmatter?: any;
}

export interface GeneratorConfig {
  name: string;
  description?: string;
  variables?: { [key: string]: any };
  files: TemplateFile[];
}

/**
 * Builder for creating test templates with frontmatter and content
 */
export class TemplateBuilder {
  private files: Map<string, TemplateFile> = new Map();
  private frontmatter: any = {};
  
  constructor(
    private generatorName: string,
    private templatesBasePath: string
  ) {}
  
  async addFile(relativePath: string, content: string, frontmatter?: any): Promise<this> {
    const templateFile: TemplateFile = {
      path: relativePath,
      content,
      frontmatter
    };
    
    this.files.set(relativePath, templateFile);
    
    // Actually create the file on disk
    const generatorPath = path.join(this.templatesBasePath, this.generatorName);
    const fullFilePath = path.join(generatorPath, relativePath);
    
    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
    
    let fileContent = content;
    if (frontmatter || this.frontmatter) {
      const fm = { ...this.frontmatter, ...frontmatter };
      const yamlFrontmatter = Object.entries(fm)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      fileContent = `---\n${yamlFrontmatter}\n---\n${content}`;
    }
    
    await fs.writeFile(fullFilePath, fileContent);
    
    return this;
  }
  
  setFrontmatter(yaml: string): this {
    // Parse YAML-like string into object
    const lines = yaml.split('\n');
    const parsed: any = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        
        // Try to parse as JSON, fallback to string
        const trimmedKey = key?.trim();
        if (trimmedKey) {
          try {
            parsed[trimmedKey] = JSON.parse(value);
          } catch {
            parsed[trimmedKey] = value.replace(/^["']|["']$/g, ''); // Remove quotes
          }
        }
      }
    }
    
    this.frontmatter = { ...this.frontmatter, ...parsed };
    return this;
  }
  
  withVariable(name: string, defaultValue: any, description?: string): this {
    if (!this.frontmatter.variables) {
      this.frontmatter.variables = {};
    }
    
    this.frontmatter.variables[name] = {
      default: defaultValue,
      description
    };
    
    return this;
  }
  
  withDescription(description: string): this {
    this.frontmatter.description = description;
    return this;
  }
  
  withDestination(destination: string): this {
    this.frontmatter.to = destination;
    return this;
  }
  
  withInjection(options: {
    inject?: boolean;
    after?: string;
    before?: string;
    lineAt?: number;
    append?: boolean;
    prepend?: boolean;
    skipIf?: string;
  }): this {
    this.frontmatter = { ...this.frontmatter, ...options };
    return this;
  }
  
  async build(): Promise<GeneratorConfig> {
    return {
      name: this.generatorName,
      description: this.frontmatter.description,
      variables: this.frontmatter.variables,
      files: [...this.files.values()]
    };
  }
  
  getGeneratorPath(): string {
    return path.join(this.templatesBasePath, this.generatorName);
  }
}

/**
 * Builder for creating test data scenarios
 */
export class TestDataBuilder {
  private data: { [key: string]: any } = {};
  
  withVariable(name: string, value: any): this {
    this.data[name] = value;
    return this;
  }
  
  withVariables(variables: { [key: string]: any }): this {
    this.data = { ...this.data, ...variables };
    return this;
  }
  
  withRandomString(name: string, length: number = 8): this {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.data[name] = result;
    return this;
  }
  
  withTimestamp(name: string): this {
    this.data[name] = Date.now().toString();
    return this;
  }
  
  withBoolean(name: string, value: boolean): this {
    this.data[name] = value;
    return this;
  }
  
  withArray(name: string, items: any[]): this {
    this.data[name] = items;
    return this;
  }
  
  withObject(name: string, obj: any): this {
    this.data[name] = obj;
    return this;
  }
  
  build(): { [key: string]: any } {
    return { ...this.data };
  }
  
  toCliFlags(): string {
    return Object.entries(this.data)
      .map(([key, value]) => {
        if (typeof value === 'boolean') {
          return value ? `--${key}` : '';
        } else if (Array.isArray(value)) {
          return `--${key} ${value.map(v => `"${v}"`).join(',')}`;
        } else if (typeof value === 'object') {
          return `--${key} ${JSON.stringify(value)}`;
        } else {
          return `--${key} "${value}"`;
        }
      })
      .filter(Boolean)
      .join(' ');
  }
}

/**
 * Builder for creating CLI command scenarios
 */
export class CLICommandBuilder {
  private baseCommand = 'unjucks';
  private subcommand = '';
  private flags: string[] = [];
  private args: string[] = [];
  
  command(cmd: string): this {
    this.subcommand = cmd;
    return this;
  }
  
  withFlag(flag: string, value?: string): this {
    if (value === undefined) {
      this.flags.push(`--${flag}`);
    } else {
      this.flags.push(`--${flag} "${value}"`);
    }
    return this;
  }
  
  withArg(arg: string): this {
    this.args.push(`"${arg}"`);
    return this;
  }
  
  withVariables(variables: { [key: string]: any }): this {
    for (const [key, value] of Object.entries(variables)) {
      this.withFlag(key, String(value));
    }
    return this;
  }
  
  build(): string {
    const parts = [this.baseCommand];
    
    if (this.subcommand) {
      parts.push(this.subcommand);
    }
    
    parts.push(...this.args, ...this.flags);
    
    return parts.join(' ');
  }
}

/**
 * Builder for creating file structure scenarios
 */
export class FileStructureBuilder {
  private structure: Array<{
    type: 'file' | 'directory';
    path: string;
    content?: string;
    permissions?: string;
  }> = [];
  
  addFile(path: string, content: string = '', permissions?: string): this {
    this.structure.push({
      type: 'file',
      path,
      content,
      permissions
    });
    return this;
  }
  
  addDirectory(path: string, permissions?: string): this {
    this.structure.push({
      type: 'directory',
      path,
      permissions
    });
    return this;
  }
  
  addPackageJson(content?: any): this {
    const defaultContent = {
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        test: 'vitest',
        build: 'tsc'
      }
    };
    
    const packageContent = { ...defaultContent, ...content };
    
    return this.addFile('package.json', JSON.stringify(packageContent, null, 2));
  }
  
  addReadme(content?: string): this {
    const defaultContent = `# Test Project\n\nGenerated for testing purposes.\n`;
    return this.addFile('README.md', content || defaultContent);
  }
  
  addConfigFile(filename: string, config: any): this {
    let content: string;
    
    if (filename.endsWith('.json')) {
      content = JSON.stringify(config, null, 2);
    } else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      // Simple YAML serialization
      content = Object.entries(config)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
    } else {
      content = String(config);
    }
    
    return this.addFile(filename, content);
  }
  
  async create(helper: FileSystemHelper): Promise<void> {
    for (const item of this.structure) {
      await (item.type === 'directory' ? helper.createDirectory(item.path) : helper.createFile(item.path, item.content || ''));
    }
  }
  
  build(): Array<{
    type: 'file' | 'directory';
    path: string;
    content?: string;
    permissions?: string;
  }> {
    return [...this.structure];
  }
}

/**
 * Builder for creating assertion scenarios
 */
export class AssertionBuilder {
  private assertions: Array<{
    type: string;
    target: string;
    expected: any;
    operator?: string;
  }> = [];
  
  fileExists(path: string): this {
    this.assertions.push({
      type: 'file-exists',
      target: path,
      expected: true
    });
    return this;
  }
  
  fileNotExists(path: string): this {
    this.assertions.push({
      type: 'file-exists',
      target: path,
      expected: false
    });
    return this;
  }
  
  fileContains(path: string, content: string): this {
    this.assertions.push({
      type: 'file-contains',
      target: path,
      expected: content,
      operator: 'includes'
    });
    return this;
  }
  
  fileMatches(path: string, pattern: string): this {
    this.assertions.push({
      type: 'file-matches',
      target: path,
      expected: pattern,
      operator: 'matches'
    });
    return this;
  }
  
  outputContains(text: string): this {
    this.assertions.push({
      type: 'output-contains',
      target: 'stdout',
      expected: text,
      operator: 'includes'
    });
    return this;
  }
  
  errorContains(text: string): this {
    this.assertions.push({
      type: 'output-contains',
      target: 'stderr',
      expected: text,
      operator: 'includes'
    });
    return this;
  }
  
  exitCode(code: number): this {
    this.assertions.push({
      type: 'exit-code',
      target: 'exitCode',
      expected: code,
      operator: 'equals'
    });
    return this;
  }
  
  build(): Array<{
    type: string;
    target: string;
    expected: any;
    operator?: string;
  }> {
    return [...this.assertions];
  }
}