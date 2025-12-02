/**
 * Git Test Repository Fixtures
 * 
 * Creates sample git repositories with attestations, keys, and provenance data
 * for comprehensive testing of git-integrated attestation scenarios.
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class GitTestRepositoryFactory {
  constructor(baseDir = '/tmp') {
    this.baseDir = baseDir;
    this.repositories = new Map();
  }

  /**
   * Create a basic git repository with KGEN configuration
   */
  async createBasicRepository(repoName = 'kgen-test-repo') {
    const repoPath = path.join(this.baseDir, repoName);
    
    // Clean up if exists
    await fs.rm(repoPath, { recursive: true, force: true });
    await fs.mkdir(repoPath, { recursive: true });
    
    // Initialize git
    execSync('git init', { cwd: repoPath });
    execSync('git config user.name "KGEN Test"', { cwd: repoPath });
    execSync('git config user.email "test@kgen.dev"', { cwd: repoPath });
    
    // Create basic KGEN config
    const kgenConfig = {
      version: "2.0.0",
      provenance: {
        enabled: true,
        attestation: {
          enabled: true,
          format: "JOSE/JWS",
          algorithms: ["Ed25519", "RS256"]
        },
        git: {
          enabled: true,
          useNotes: true,
          notesRef: "refs/notes/kgen-attestations"
        }
      },
      templates: {
        baseDir: "templates",
        extensions: [".njk", ".j2"]
      },
      output: {
        baseDir: "generated"
      }
    };
    
    await fs.writeFile(
      path.join(repoPath, 'kgen.config.json'), 
      JSON.stringify(kgenConfig, null, 2)
    );
    
    // Initial commit
    execSync('git add .', { cwd: repoPath });
    execSync('git commit -m "Initial KGEN configuration"', { cwd: repoPath });
    
    this.repositories.set(repoName, {
      path: repoPath,
      commits: [this._getCurrentCommit(repoPath)],
      attestations: new Map(),
      keys: new Map()
    });
    
    return { 
      path: repoPath, 
      repository: this.repositories.get(repoName) 
    };
  }

  /**
   * Add cryptographic keys to repository
   */
  async addSigningKeys(repoName, keyTypes = ['ed25519', 'rsa']) {
    const repo = this.repositories.get(repoName);
    if (!repo) throw new Error(`Repository ${repoName} not found`);
    
    const keysDir = path.join(repo.path, 'keys');
    await fs.mkdir(keysDir, { recursive: true });
    
    for (const keyType of keyTypes) {
      let keyPair;
      let filePrefix;
      
      switch (keyType) {
        case 'ed25519':
          keyPair = crypto.generateKeyPairSync('ed25519', {
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
          filePrefix = 'ed25519';
          break;
          
        case 'rsa':
          keyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
          filePrefix = 'rsa';
          break;
          
        default:
          throw new Error(`Unsupported key type: ${keyType}`);
      }
      
      const privateKeyPath = path.join(keysDir, `${filePrefix}_private.pem`);
      const publicKeyPath = path.join(keysDir, `${filePrefix}_public.pem`);
      
      await fs.writeFile(privateKeyPath, keyPair.privateKey);
      await fs.writeFile(publicKeyPath, keyPair.publicKey);
      
      repo.keys.set(keyType, {
        private: keyPair.privateKey,
        public: keyPair.publicKey,
        privatePath: privateKeyPath,
        publicPath: publicKeyPath,
        keyId: `${filePrefix}_${Date.now()}`
      });
    }
    
    // Commit keys
    execSync('git add keys/', { cwd: repo.path });
    execSync('git commit -m "Add signing keys"', { cwd: repo.path });
    repo.commits.push(this._getCurrentCommit(repo.path));
    
    return repo.keys;
  }

  /**
   * Create template hierarchy for testing inheritance
   */
  async createTemplateHierarchy(repoName, templates) {
    const repo = this.repositories.get(repoName);
    if (!repo) throw new Error(`Repository ${repoName} not found`);
    
    const templatesDir = path.join(repo.path, 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    
    const templateHashes = new Map();
    
    // Create templates in dependency order
    const sortedTemplates = this._sortTemplatesByDependency(templates);
    
    for (const template of sortedTemplates) {
      const templatePath = path.join(templatesDir, template.name);
      let content = '';
      
      // Add extends directive if template has parent
      if (template.extends) {
        content += `{% extends "${template.extends}" %}\n\n`;
      }
      
      // Add template content
      content += template.content || `
<div class="${template.name.replace('.njk', '')}">
  {% block content %}
    <h1>{{title | default("Default Title")}}</h1>
    <p>{{description | default("Default description")}}</p>
  {% endblock %}
</div>
      `.trim();
      
      await fs.writeFile(templatePath, content);
      
      // Add to git and get hash
      execSync('git add .', { cwd: repo.path });
      execSync(`git commit -m "Add template ${template.name}"`, { cwd: repo.path });
      
      const templateHash = execSync(
        `git hash-object templates/${template.name}`,
        { cwd: repo.path, encoding: 'utf8' }
      ).trim();
      
      templateHashes.set(template.name, {
        hash: templateHash,
        commit: this._getCurrentCommit(repo.path),
        path: templatePath,
        extends: template.extends
      });
    }
    
    repo.templates = templateHashes;
    return templateHashes;
  }

  /**
   * Generate artifacts with attestations
   */
  async generateArtifactsWithAttestations(repoName, artifacts) {
    const repo = this.repositories.get(repoName);
    if (!repo) throw new Error(`Repository ${repoName} not found`);
    
    const generatedDir = path.join(repo.path, 'generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    for (const artifact of artifacts) {
      const artifactPath = path.join(generatedDir, artifact.name);
      
      // Generate artifact content
      const content = artifact.content || this._generateArtifactContent(artifact);
      await fs.writeFile(artifactPath, content);
      
      // Calculate content hash
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Create attestation
      const attestation = await this._createTestAttestation(
        repo, 
        artifact.name, 
        contentHash, 
        artifact.templateName
      );
      
      // Save attestation file
      const attestationPath = artifactPath + '.attest.json';
      await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));
      
      // Add to git
      execSync('git add .', { cwd: repo.path });
      execSync(`git commit -m "Generate ${artifact.name} with attestation"`, { cwd: repo.path });
      
      // Store attestation as git note
      const blobHash = execSync(
        `git hash-object generated/${artifact.name}`,
        { cwd: repo.path, encoding: 'utf8' }
      ).trim();
      
      execSync(
        `git notes --ref=kgen-attestations add -m '${JSON.stringify(attestation)}' ${blobHash}`,
        { cwd: repo.path }
      );
      
      repo.attestations.set(artifact.name, {
        attestation,
        blobHash,
        contentHash,
        path: artifactPath,
        attestationPath
      });
    }
    
    return repo.attestations;
  }

  /**
   * Create a repository with cross-repo template references
   */
  async createCrossRepoScenario() {
    // Create template repository
    const { repository: templateRepo } = await this.createBasicRepository('template-repo');
    await this.addSigningKeys('template-repo');
    
    // Create shared templates
    await this.createTemplateHierarchy('template-repo', [
      {
        name: 'shared-base.njk',
        content: `
<div class="shared-base">
  {% block content %}{% endblock %}
</div>
        `.trim()
      },
      {
        name: 'shared-component.njk',
        extends: 'shared-base.njk',
        content: `
{% extends "shared-base.njk" %}
{% block content %}
  <div class="component">
    <h2>{{componentName}}</h2>
    <div class="props">{{props | dump}}</div>
  </div>
{% endblock %}
        `.trim()
      }
    ]);
    
    // Create consumer repository
    const { repository: consumerRepo } = await this.createBasicRepository('consumer-repo');
    await this.addSigningKeys('consumer-repo');
    
    // Add git submodule or reference to template repo
    const submodulePath = path.join(consumerRepo.path, 'shared-templates');
    execSync(
      `git submodule add ${templateRepo.path} shared-templates`,
      { cwd: consumerRepo.path }
    );
    execSync('git commit -m "Add shared templates submodule"', { cwd: consumerRepo.path });
    
    return {
      templateRepo: templateRepo.path,
      consumerRepo: consumerRepo.path,
      submodulePath
    };
  }

  /**
   * Create repository with performance test data
   */
  async createLargeRepository(repoName, fileCount = 100) {
    const { repository: repo } = await this.createBasicRepository(repoName);
    await this.addSigningKeys(repoName);
    
    const artifacts = [];
    
    // Generate multiple file types
    const fileTypes = [
      { ext: '.js', type: 'javascript' },
      { ext: '.ts', type: 'typescript' },
      { ext: '.tsx', type: 'react' },
      { ext: '.vue', type: 'vue' },
      { ext: '.html', type: 'html' }
    ];
    
    for (let i = 0; i < fileCount; i++) {
      const fileType = fileTypes[i % fileTypes.length];
      artifacts.push({
        name: `file_${i}${fileType.ext}`,
        templateName: `${fileType.type}.njk`,
        content: this._generateContentByType(fileType.type, i)
      });
    }
    
    await this.generateArtifactsWithAttestations(repoName, artifacts);
    
    return {
      repository: repo,
      artifactCount: artifacts.length,
      attestationCount: artifacts.length
    };
  }

  /**
   * Clean up all test repositories
   */
  async cleanup() {
    for (const [repoName, repo] of this.repositories) {
      try {
        await fs.rm(repo.path, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup repository ${repoName}:`, error.message);
      }
    }
    this.repositories.clear();
  }

  /**
   * Get repository information
   */
  getRepository(repoName) {
    return this.repositories.get(repoName);
  }

  /**
   * List all repositories
   */
  listRepositories() {
    return Array.from(this.repositories.keys());
  }

  // Private helper methods
  
  _getCurrentCommit(repoPath) {
    return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
  }

  _sortTemplatesByDependency(templates) {
    const sorted = [];
    const visited = new Set();
    
    const visit = (template) => {
      if (visited.has(template.name)) return;
      
      if (template.extends) {
        const parent = templates.find(t => t.name === template.extends);
        if (parent) visit(parent);
      }
      
      sorted.push(template);
      visited.add(template.name);
    };
    
    templates.forEach(visit);
    return sorted;
  }

  async _createTestAttestation(repo, artifactName, contentHash, templateName) {
    const currentCommit = this._getCurrentCommit(repo.path);
    const timestamp = new Date().toISOString();
    
    // Get template info if exists
    const templateInfo = repo.templates?.get(templateName);
    
    // Create base attestation
    const attestation = {
      version: "2.0.0",
      id: uuidv4(),
      artifact_name: artifactName,
      artifact_hash: contentHash,
      algorithm: "sha256",
      generation_timestamp: timestamp,
      
      // Git context
      git_commit_sha: currentCommit,
      git_branch: execSync('git branch --show-current', { cwd: repo.path, encoding: 'utf8' }).trim(),
      git_repository_url: repo.path,
      
      // Template info
      template_name: templateName,
      template_hash: templateInfo?.hash || null,
      template_commit: templateInfo?.commit || null,
      
      // KGEN metadata
      kgen_version: "2.0.0",
      generator: "KGEN CLI",
      
      // PROV-O compliance
      "prov:wasGeneratedBy": {
        "prov:activity": "kgen:generation",
        "prov:agent": "kgen:cli",
        "prov:time": timestamp
      }
    };
    
    // Add signature simulation (in real tests, this would use actual crypto)
    const ed25519Key = repo.keys.get('ed25519');
    if (ed25519Key) {
      attestation.jose_header = {
        alg: "Ed25519",
        typ: "JWT",
        kid: ed25519Key.keyId
      };
      
      // Create a mock JWS signature structure
      const header = Buffer.from(JSON.stringify(attestation.jose_header)).toString('base64url');
      const payload = Buffer.from(JSON.stringify(attestation)).toString('base64url');
      const signature = Buffer.from(crypto.randomBytes(32)).toString('base64url');
      
      attestation.signature = `${header}.${payload}.${signature}`;
    }
    
    return attestation;
  }

  _generateArtifactContent(artifact) {
    const ext = path.extname(artifact.name);
    const baseName = path.basename(artifact.name, ext);
    
    switch (ext) {
      case '.tsx':
      case '.jsx':
        return `
import React from 'react';

interface ${baseName}Props {
  title?: string;
  description?: string;
}

export const ${baseName}: React.FC<${baseName}Props> = ({ title = "Default", description = "Generated component" }) => {
  return (
    <div className="${baseName.toLowerCase()}">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
};
        `.trim();
        
      case '.ts':
      case '.js':
        return `
/**
 * Generated ${baseName} module
 */

export class ${baseName} {
  constructor(public title: string = "Default", public description: string = "Generated module") {}
  
  render(): string {
    return \`<div class="${baseName.toLowerCase()}"><h1>\${this.title}</h1><p>\${this.description}</p></div>\`;
  }
}
        `.trim();
        
      case '.html':
        return `
<!DOCTYPE html>
<html>
<head>
  <title>${baseName}</title>
</head>
<body>
  <div class="${baseName.toLowerCase()}">
    <h1>Generated HTML</h1>
    <p>This is a generated HTML file for ${baseName}</p>
  </div>
</body>
</html>
        `.trim();
        
      default:
        return `/* Generated content for ${artifact.name} */\nconsole.log('Generated file: ${artifact.name}');`;
    }
  }

  _generateContentByType(type, index) {
    switch (type) {
      case 'javascript':
        return `console.log('JavaScript file ${index}');\nexport const value${index} = ${index};`;
        
      case 'typescript':
        return `export interface Type${index} { id: number; }\nexport const value${index}: Type${index} = { id: ${index} };`;
        
      case 'react':
        return `import React from 'react';\nexport const Component${index} = () => <div>Component {${index}}</div>;`;
        
      case 'vue':
        return `<template><div>Vue Component {{${index}}}</div></template>\n<script>export default { data: () => ({ value: ${index} }) };</script>`;
        
      case 'html':
        return `<!DOCTYPE html><html><body><h1>File ${index}</h1></body></html>`;
        
      default:
        return `/* File ${index} */`;
    }
  }
}

// Export utility functions for direct use in tests
export const createTestRepo = async (name, options = {}) => {
  const factory = new GitTestRepositoryFactory(options.baseDir);
  return await factory.createBasicRepository(name);
};

export const createRepoWithKeys = async (name, keyTypes = ['ed25519', 'rsa'], options = {}) => {
  const factory = new GitTestRepositoryFactory(options.baseDir);
  await factory.createBasicRepository(name);
  await factory.addSigningKeys(name, keyTypes);
  return factory.getRepository(name);
};

export const createTemplateHierarchy = async (repoName, templates, options = {}) => {
  const factory = new GitTestRepositoryFactory(options.baseDir);
  return await factory.createTemplateHierarchy(repoName, templates);
};

export default GitTestRepositoryFactory;