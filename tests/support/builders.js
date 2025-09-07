import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileSystemHelper } from './helpers.js';

/**
 * Builder for creating test templates with frontmatter and content
 */
export class TemplateBuilder {
  constructor(
    generatorName,
    templatesBasePath
  ) {
    this.generatorName = generatorName;
    this.templatesBasePath = templatesBasePath;
    this.files = new Map();
    this.frontmatter = {};
  }
  
  async addFile(relativePath, content, frontmatter) {
    const templateFile = {
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
  
  setFrontmatter(yaml) {
    // Parse YAML-like string into object
    const lines = yaml.split('\n');
    const parsed = {};
    
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
  
  withVariable(name, defaultValue, description) {
    if (!this.frontmatter.variables) {
      this.frontmatter.variables = {};
    }
    
    this.frontmatter.variables[name] = {
      default: defaultValue,
      description
    };
    
    return this;
  }
  
  withDescription(description) {
    this.frontmatter.description = description;
    return this;
  }
  
  withDestination(destination) {
    this.frontmatter.to = destination;
    return this;
  }
  
  withInjection(options) {
    this.frontmatter = { ...this.frontmatter, ...options };
    return this;
  }
  
  async build() {
    return {
      name: this.generatorName,
      description: this.frontmatter.description,
      variables: this.frontmatter.variables,
      files: [...this.files.values()]
    };
  }
  
  getGeneratorPath() {
    return path.join(this.templatesBasePath, this.generatorName);
  }
}

/**
 * Builder for creating test data scenarios
 */
export class TestDataBuilder {
  constructor() {
    this.data = {};
  }
  
  withVariable(name, value) {
    this.data[name] = value;
    return this;
  }
  
  withVariables(variables) {
    this.data = { ...this.data, ...variables };
    return this;
  }
  
  withRandomString(name, length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.data[name] = result;
    return this;
  }
  
  withTimestamp(name) {
    this.data[name] = Date.now().toString();
    return this;
  }
  
  withBoolean(name, value) {
    this.data[name] = value;
    return this;
  }
  
  withArray(name, items) {
    this.data[name] = items;
    return this;
  }
  
  withObject(name, obj) {
    this.data[name] = obj;
    return this;
  }
  
  build() {
    return { ...this.data };
  }
  
  toCliFlags() {
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
  constructor() {
    this.baseCommand = 'unjucks';
    this.subcommand = '';
    this.flags = [];
    this.args = [];
  }
  
  command(cmd) {
    this.subcommand = cmd;
    return this;
  }
  
  withFlag(flag, value) {
    if (value === undefined) {
      this.flags.push(`--${flag}`);
    } else {
      this.flags.push(`--${flag} "${value}"`);
    }
    return this;
  }
  
  withArg(arg) {
    this.args.push(`"${arg}"`);
    return this;
  }
  
  withVariables(variables) {
    for (const [key, value] of Object.entries(variables)) {
      this.withFlag(key, String(value));
    }
    return this;
  }
  
  build() {
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
  constructor() {
    this.structure = [];
  }
  
  addFile(path, content = '', permissions) {
    this.structure.push({
      type: 'file',
      path,
      content,
      permissions
    });
    return this;
  }
  
  addDirectory(path, permissions) {
    this.structure.push({
      type: 'directory',
      path,
      permissions
    });
    return this;
  }
  
  addPackageJson(content) {
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
  
  addReadme(content) {
    const defaultContent = `# Test Project\n\nGenerated for testing purposes.\n`;
    return this.addFile('README.md', content || defaultContent);
  }
  
  addConfigFile(filename, config) {
    let content;
    
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
  
  async create(helper) {
    for (const item of this.structure) {
      await (item.type === 'directory' ? helper.createDirectory(item.path) : helper.createFile(item.path, item.content || ''));
    }
  }
  
  build() {
    return [...this.structure];
  }
}

/**
 * Builder for creating assertion scenarios
 */
export class AssertionBuilder {
  constructor() {
    this.assertions = [];
  }
  
  fileExists(path) {
    this.assertions.push({
      type: 'file-exists',
      target: path,
      expected: true
    });
    return this;
  }
  
  fileNotExists(path) {
    this.assertions.push({
      type: 'file-exists',
      target: path,
      expected: false
    });
    return this;
  }
  
  fileContains(path, content) {
    this.assertions.push({
      type: 'file-contains',
      target: path,
      expected: content,
      operator: 'includes'
    });
    return this;
  }
  
  fileMatches(path, pattern) {
    this.assertions.push({
      type: 'file-matches',
      target: path,
      expected: pattern,
      operator: 'matches'
    });
    return this;
  }
  
  outputContains(text) {
    this.assertions.push({
      type: 'output-contains',
      target: 'stdout',
      expected: text,
      operator: 'includes'
    });
    return this;
  }
  
  errorContains(text) {
    this.assertions.push({
      type: 'output-contains',
      target: 'stderr',
      expected: text,
      operator: 'includes'
    });
    return this;
  }
  
  exitCode(code) {
    this.assertions.push({
      type: 'exit-code',
      target: 'exitCode',
      expected: code,
      operator: 'equals'
    });
    return this;
  }
  
  build() {
    return [...this.assertions];
  }
}