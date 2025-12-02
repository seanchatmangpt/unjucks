/**
 * Init Command - Project Scaffolding
 * 
 * Scaffolds a new KGEN project with kgen.config.json configuration
 * and basic directory structure for knowledge graph development.
 */

import { defineCommand } from 'citty';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { consola } from 'consola';

interface KgenConfig {
  version: string;
  project: {
    name: string;
    description: string;
    author?: string;
    license?: string;
  };
  sources: {
    graphs: string[];
    templates: string[];
    rules: string[];
  };
  build: {
    outputDir: string;
    cleanBeforeBuild: boolean;
    generateAttestation: boolean;
  };
  validation: {
    strict: boolean;
    shaclProfiles: string[];
  };
  marketplace: {
    registry?: string;
    publishPrivate?: boolean;
  };
}

const DEFAULT_CONFIG: KgenConfig = {
  version: "1.0.0",
  project: {
    name: "kgen-project",
    description: "KGEN knowledge graph project",
    license: "MIT"
  },
  sources: {
    graphs: ["src/graphs/**/*.ttl", "src/graphs/**/*.rdf"],
    templates: ["src/templates/**/*.hbs"],
    rules: ["src/rules/**/*.n3"]
  },
  build: {
    outputDir: "dist",
    cleanBeforeBuild: true,
    generateAttestation: true
  },
  validation: {
    strict: false,
    shaclProfiles: ["src/validation/**/*.ttl"]
  },
  marketplace: {
    publishPrivate: false
  }
};

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a new KGEN project with configuration and directory structure'
  },
  args: {
    name: {
      type: 'string',
      description: 'Project name',
      required: false
    },
    template: {
      type: 'string',
      description: 'Project template (basic|enterprise|minimal)',
      default: 'basic'
    },
    dir: {
      type: 'string',
      description: 'Target directory (defaults to current directory)',
      default: '.'
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing files',
      default: false
    },
    json: {
      type: 'boolean',
      description: 'Output result as JSON',
      default: false
    }
  },
  async run({ args }) {
    const targetDir = args.dir || '.';
    const projectName = args.name || 'kgen-project';
    const configPath = join(targetDir, 'kgen.config.json');
    
    try {
      // Check if config already exists
      if (existsSync(configPath) && !args.force) {
        const error = {
          success: false,
          error: 'kgen.config.json already exists. Use --force to overwrite.',
          code: 'CONFIG_EXISTS'
        };
        
        if (args.json) {
          console.log(JSON.stringify(error, null, 2));
        } else {
          consola.error(error.error);
        }
        process.exit(1);
      }

      // Create directory structure based on template
      const directories = getDirectoriesForTemplate(args.template);
      
      for (const dir of directories) {
        const fullPath = join(targetDir, dir);
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true });
        }
      }

      // Create config file
      const config = {
        ...DEFAULT_CONFIG,
        project: {
          ...DEFAULT_CONFIG.project,
          name: projectName
        }
      };

      if (args.template === 'enterprise') {
        config.validation.strict = true;
        config.marketplace.publishPrivate = true;
      } else if (args.template === 'minimal') {
        config.sources.rules = [];
        config.validation.shaclProfiles = [];
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Create sample files based on template
      createSampleFiles(targetDir, args.template);

      const result = {
        success: true,
        data: {
          projectName,
          configPath,
          template: args.template,
          directories: directories,
          message: `KGEN project '${projectName}' initialized successfully`
        },
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        consola.success(`KGEN project '${projectName}' initialized successfully`);
        consola.info(`Configuration: ${configPath}`);
        consola.info(`Template: ${args.template}`);
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'INIT_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else {
        consola.error(`Initialization failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

function getDirectoriesForTemplate(template: string): string[] {
  const base = [
    'src/graphs',
    'src/templates', 
    'dist'
  ];

  switch (template) {
    case 'enterprise':
      return [
        ...base,
        'src/rules',
        'src/validation',
        'docs',
        'tests',
        'scripts'
      ];
    case 'minimal':
      return base;
    case 'basic':
    default:
      return [
        ...base,
        'src/rules',
        'src/validation',
        'docs'
      ];
  }
}

function createSampleFiles(targetDir: string, template: string): void {
  // Create a sample graph file
  const sampleGraph = `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Project rdf:type rdfs:Class ;
    rdfs:label "Project" ;
    rdfs:comment "A software project" .

ex:hasName rdf:type rdf:Property ;
    rdfs:domain ex:Project ;
    rdfs:range rdfs:Literal .
`;

  writeFileSync(join(targetDir, 'src/graphs/sample.ttl'), sampleGraph);

  // Create a sample template
  const sampleTemplate = `{{!-- KGEN Template for {{projectType}} --}}
# {{title}}

Generated from knowledge graph on {{timestamp}}.

{{#each entities}}
## {{name}}
{{description}}
{{/each}}
`;

  writeFileSync(join(targetDir, 'src/templates/sample.hbs'), sampleTemplate);

  if (template !== 'minimal') {
    // Create a sample SHACL validation
    const sampleShacl = `@prefix ex: <http://example.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:ProjectShape a sh:NodeShape ;
    sh:targetClass ex:Project ;
    sh:property [
        sh:path ex:hasName ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] .
`;

    writeFileSync(join(targetDir, 'src/validation/project-shape.ttl'), sampleShacl);
  }

  // Create .gitignore
  const gitignore = `# KGEN build artifacts
dist/
*.attest.json

# Dependencies
node_modules/

# Logs
*.log

# Cache
.kgen-cache/
`;

  writeFileSync(join(targetDir, '.gitignore'), gitignore);
}