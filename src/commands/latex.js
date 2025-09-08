/**
 * SECURITY-HARDENED LaTeX Command Module
 * Provides secure LaTeX document generation, compilation, and management
 * WITH COMPREHENSIVE INPUT VALIDATION AND INJECTION PREVENTION
 */
import { defineCommand } from 'citty';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import chalk from 'chalk';
import { LaTeXCompiler } from '../lib/latex/compiler.js';
import { LaTeXConfig } from '../lib/latex/config.js';
import LaTeXBuildIntegration from '../lib/latex/build-integration.js';
import { DockerLaTeXSupport } from '../lib/latex/docker-support.js';
import { validateFilePath, sanitizeInput, validateSecurityThreats } from '../lib/latex/validator.js';

/**
 * CRITICAL SECURITY: Validates all CLI arguments for injection attacks
 * @param {Object} args - CLI arguments to validate
 * @param {string} command - Command name for context
 * @returns {Object} Validation result
 */
function validateCliArguments(args, command) {
  const violations = [];
  
  // Validate file paths
  const pathFields = ['input', 'output', 'dockerfile', 'config'];
  for (const field of pathFields) {
    if (args[field]) {
      const sanitized = sanitizeInput(args[field]);
      const pathValidation = validateFilePath(sanitized);
      
      if (!pathValidation.isValid) {
        violations.push({
          field,
          error: pathValidation.error,
          violation: pathValidation.violation,
          severity: 'critical'
        });
      } else {
        args[field] = pathValidation.sanitized;
      }
    }
  }
  
  // Validate LaTeX engine
  if (args.engine) {
    const allowedEngines = ['pdflatex', 'xelatex', 'lualatex'];
    if (!allowedEngines.includes(args.engine)) {
      violations.push({
        field: 'engine',
        error: `Invalid LaTeX engine: ${args.engine}. Allowed: ${allowedEngines.join(', ')}`,
        severity: 'high'
      });
    }
  }
  
  // Validate template type
  if (args.template) {
    const allowedTemplates = ['article', 'book', 'report', 'letter', 'presentation'];
    if (!allowedTemplates.includes(args.template)) {
      violations.push({
        field: 'template',
        error: `Invalid template type: ${args.template}. Allowed: ${allowedTemplates.join(', ')}`,
        severity: 'high'
      });
    }
  }
  
  return {
    isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
    violations,
    sanitizedArgs: args
  };
}

export const latexCommand = defineCommand({
  meta: {
    name: 'latex',
    description: 'LaTeX document generation, compilation, and management'
  },
  subCommands: {
    compile: defineCommand({
      meta: {
        name: 'compile',
        description: 'Compile LaTeX document to PDF'
      },
      args: {
        input: {
          type: 'positional',
          description: 'Input .tex file to compile',
          required: true
        },
        engine: {
          type: 'string',
          description: 'LaTeX engine to use (pdflatex, xelatex, lualatex)',
          default: 'pdflatex'
        },
        output: {
          type: 'string',
          description: 'Output directory',
          default: './dist/latex'
        },
        watch: {
          type: 'boolean',
          description: 'Enable watch mode for live compilation',
          default: false
        },
        docker: {
          type: 'boolean',
          description: 'Use Docker for compilation',
          default: false
        },
        verbose: {
          type: 'boolean',
          description: 'Enable verbose output',
          default: false
        },
        'no-bibtex': {
          type: 'boolean',
          description: 'Disable BibTeX compilation',
          default: false
        },
        'no-biber': {
          type: 'boolean',
          description: 'Disable Biber compilation',
          default: false
        }
      },
      async run({ args }) {
        try {
          // CRITICAL SECURITY: Validate all CLI arguments
          const validation = validateCliArguments(args, 'compile');
          if (!validation.isValid) {
            const criticalViolations = validation.violations.filter(v => 
              v.severity === 'critical' || v.severity === 'high'
            );
            consola.error('🚨 SECURITY VIOLATION: Invalid arguments detected');
            criticalViolations.forEach(v => {
              consola.error(`  ${v.field}: ${v.error}`);
            });
            return { success: false, error: 'Security validation failed', violations: criticalViolations };
          }
          
          // Use sanitized arguments
          args = validation.sanitizedArgs;
          
          const config = new LaTeXConfig();
          const latexConfig = await config.load();
          
          // Override config with command line args
          const compilerConfig = {
            ...latexConfig,
            engine: args.engine,
            outputDir: args.output,
            verbose: args.verbose,
            enableBibtex: !args['no-bibtex'],
            enableBiber: !args['no-biber'],
            docker: {
              ...latexConfig.docker,
              enabled: args.docker
            }
          };

          const compiler = new LaTeXCompiler(compilerConfig);
          await compiler.initialize();

          if (args.watch) {
            consola.info(`Starting watch mode for: ${chalk.blue(args.input)}`);
            await compiler.startWatchMode(args.input);
            
            // Keep process alive
            process.on('SIGINT', async () => {
              consola.info('Stopping watch mode...');
              await compiler.stopWatchMode();
              process.exit(0);
            });
          } else {
            const result = await compiler.compile(args.input);
            
            if (result.success) {
              consola.success(`Compiled: ${chalk.green(result.outputPath)} (${Math.round(result.duration)}ms)`);
              return { success: true, outputPath: result.outputPath };
            } else {
              consola.error(`Compilation failed: ${result.error}`);
              return { success: false, error: result.error };
            }
          }
        } catch (error) {
          consola.error('LaTeX compilation error:', error);
          return { success: false, error: error.message };
        }
      }
    }),

    build: defineCommand({
      meta: {
        name: 'build',
        description: 'Build all LaTeX documents in project'
      },
      args: {
        output: {
          type: 'string',
          description: 'Output directory',
          default: './dist/latex'
        },
        engine: {
          type: 'string',
          description: 'LaTeX engine to use',
          default: 'pdflatex'
        },
        concurrency: {
          type: 'number',
          description: 'Number of concurrent compilations',
          default: 2
        },
        docker: {
          type: 'boolean',
          description: 'Use Docker for compilation',
          default: false
        }
      },
      async run({ args }) {
        try {
          const integration = new LaTeXBuildIntegration({
            outputDir: args.output,
            engine: args.engine,
            concurrency: args.concurrency,
            docker: { enabled: args.docker }
          });

          await integration.initialize();
          const result = await integration.buildAllDocuments();

          if (result.success) {
            consola.success(`Built ${result.successful} LaTeX document(s)`);
            return { success: true, ...result };
          } else {
            consola.error(`Build failed: ${result.failed} of ${result.total} documents failed`);
            return { success: false, ...result };
          }
        } catch (error) {
          consola.error('LaTeX build error:', error);
          return { success: false, error: error.message };
        }
      }
    }),

    watch: defineCommand({
      meta: {
        name: 'watch',
        description: 'Watch LaTeX files for changes and auto-compile'
      },
      args: {
        pattern: {
          type: 'string',
          description: 'File pattern to watch',
          default: '**/*.tex'
        },
        output: {
          type: 'string',
          description: 'Output directory',
          default: './dist/latex'
        },
        engine: {
          type: 'string',
          description: 'LaTeX engine to use',
          default: 'pdflatex'
        }
      },
      async run({ args }) {
        try {
          const integration = new LaTeXBuildIntegration({
            outputDir: args.output,
            engine: args.engine,
            watch: {
              enabled: true,
              patterns: [args.pattern]
            }
          });

          await integration.initialize();
          await integration.startWatchMode();

          return { success: true, message: 'Watch mode started' };
        } catch (error) {
          consola.error('LaTeX watch error:', error);
          return { success: false, error: error.message };
        }
      }
    }),

    generate: defineCommand({
      meta: {
        name: 'generate',
        description: 'Generate LaTeX document from template'
      },
      args: {
        template: {
          type: 'string',
          description: 'Template type (article, book, report, letter, presentation)',
          required: true
        },
        title: {
          type: 'string',
          description: 'Document title'
        },
        author: {
          type: 'string',
          description: 'Document author'
        },
        output: {
          type: 'string',
          description: 'Output filename',
          default: 'document.tex'
        },
        bibliography: {
          type: 'boolean',
          description: 'Include bibliography support',
          default: false
        },
        packages: {
          type: 'string',
          description: 'Additional LaTeX packages (comma-separated)'
        },
        interactive: {
          type: 'boolean',
          description: 'Interactive template generation',
          default: false
        }
      },
      async run({ args }) {
        try {
          // CRITICAL SECURITY: Validate template generation arguments
          const validation = validateCliArguments(args, 'generate');
          if (!validation.isValid) {
            consola.error('🚨 SECURITY: Template generation blocked');
            validation.violations.forEach(v => consola.error(`  ${v.error}`));
            return { success: false, error: 'Security validation failed' };
          }
          args = validation.sanitizedArgs;
          
          // Import template generator class at runtime
          const { LaTeXTemplateGenerator } = await import('../lib/latex/template-generator.js');
          const generator = new LaTeXTemplateGenerator();
          
          // Sanitize all user inputs
          let templateConfig = {
            type: sanitizeInput(args.template),
            title: sanitizeInput(args.title || ''),
            author: sanitizeInput(args.author || ''),
            bibliography: Boolean(args.bibliography),
            packages: args.packages ? 
              args.packages.split(',').map(p => sanitizeInput(p.trim())).filter(Boolean) : []
          };

          if (args.interactive) {
            templateConfig = await generator.interactiveGeneration(templateConfig);
          }

          // SECURITY: Validate template content before writing
          const content = generator.generateTemplate(templateConfig);
          const contentValidation = validateSecurityThreats(content);
          
          if (!contentValidation.isSafe) {
            consola.error('🚨 SECURITY: Generated template contains dangerous patterns');
            contentValidation.violations.forEach(v => consola.error(`  ${v.message}`));
            return { success: false, error: 'Template security validation failed' };
          }
          
          // Secure file write with path validation
          const pathValidation = validateFilePath(args.output);
          if (!pathValidation.isValid) {
            consola.error(`🚨 SECURITY: ${pathValidation.error}`);
            return { success: false, error: 'Output path validation failed' };
          }
          
          await fs.writeFile(pathValidation.sanitized, content);

          consola.success(`LaTeX document generated: ${chalk.green(args.output)}`);
          
          if (args.bibliography) {
            const bibFile = args.output.replace('.tex', '.bib');
            const bibContent = generator.generateBibliography();
            await fs.writeFile(bibFile, bibContent);
            consola.info(`Bibliography file created: ${chalk.blue(bibFile)}`);
          }

          return { success: true, output: args.output };
        } catch (error) {
          consola.error('LaTeX generation error:', error);
          return { success: false, error: error.message };
        }
      }
    }),

    init: defineCommand({
      meta: {
        name: 'init',
        description: 'Initialize LaTeX support in project'
      },
      args: {
        docker: {
          type: 'boolean',
          description: 'Setup Docker support',
          default: false
        },
        config: {
          type: 'boolean',
          description: 'Create configuration file',
          default: true
        },
        scripts: {
          type: 'boolean',
          description: 'Add npm scripts',
          default: true
        }
      },
      async run({ args }) {
        try {
          const integration = new LaTeXBuildIntegration();
          
          if (args.config) {
            await integration.generateBuildConfig();
            consola.success('LaTeX configuration created');
          }

          if (args.scripts) {
            await integration.addPackageScripts();
            consola.success('npm scripts added');
          }

          await integration.integrateWithBuildSystem();
          consola.success('Build system integration complete');

          if (args.docker) {
            const dockerSupport = new DockerLaTeXSupport();
            const dockerfilePath = path.join(process.cwd(), 'Dockerfile.latex');
            const composePath = path.join(process.cwd(), 'docker-compose.latex.yml');
            
            await dockerSupport.generateDockerfile(dockerfilePath);
            await dockerSupport.generateDockerCompose(composePath);
            
            consola.success(`Docker support added: ${dockerfilePath}, ${composePath}`);
          }

          // Create directories
          await fs.mkdir('./dist/latex', { recursive: true });
          await fs.mkdir('./temp/latex', { recursive: true });

          consola.success('LaTeX support initialized successfully!');
          
          return { success: true, message: 'LaTeX support initialized' };
        } catch (error) {
          consola.error('LaTeX initialization error:', error);
          return { success: false, error: error.message };
        }
      }
    }),

    docker: defineCommand({
      meta: {
        name: 'docker',
        description: 'Docker-related LaTeX operations'
      },
      subCommands: {
        setup: defineCommand({
          meta: {
            name: 'setup',
            description: 'Setup Docker LaTeX environment'
          },
          args: {
            image: {
              type: 'string',
              description: 'Docker image to use',
              default: 'texlive/texlive:latest'
            },
            pull: {
              type: 'boolean',
              description: 'Pull latest image',
              default: true
            }
          },
          async run({ args }) {
            try {
              const dockerSupport = new DockerLaTeXSupport({
                image: args.image,
                pullPolicy: args.pull ? 'always' : 'missing'
              });

              await dockerSupport.setup();
              consola.success(`Docker LaTeX environment ready: ${args.image}`);
              
              return { success: true, image: args.image };
            } catch (error) {
              consola.error('Docker setup error:', error);
              return { success: false, error: error.message };
            }
          }
        }),

        build: defineCommand({
          meta: {
            name: 'build',
            description: 'Build custom Docker image'
          },
          args: {
            name: {
              type: 'string',
              description: 'Image name',
              required: true
            },
            dockerfile: {
              type: 'string',
              description: 'Dockerfile path',
              default: './Dockerfile.latex'
            }
          },
          async run({ args }) {
            try {
              const dockerSupport = new DockerLaTeXSupport();
              const imageName = await dockerSupport.buildImage(args.dockerfile, args.name);
              
              consola.success(`Docker image built: ${imageName}`);
              return { success: true, image: imageName };
            } catch (error) {
              consola.error('Docker build error:', error);
              return { success: false, error: error.message };
            }
          }
        })
      }
    }),

    config: defineCommand({
      meta: {
        name: 'config',
        description: 'Configuration management'
      },
      subCommands: {
        create: defineCommand({
          meta: {
            name: 'create',
            description: 'Create configuration template'
          },
          args: {
            output: {
              type: 'string',
              description: 'Config file path',
              default: './unjucks.config.js'
            }
          },
          async run({ args }) {
            try {
              const config = new LaTeXConfig();
              await config.createTemplate(args.output);
              
              consola.success(`Configuration template created: ${args.output}`);
              return { success: true, config: args.output };
            } catch (error) {
              consola.error('Config creation error:', error);
              return { success: false, error: error.message };
            }
          }
        }),

        engines: defineCommand({
          meta: {
            name: 'engines',
            description: 'List available LaTeX engines'
          },
          async run() {
            const config = new LaTeXConfig();
            const engines = config.listEngines();
            
            consola.info('Available LaTeX engines:');
            engines.forEach(engine => {
              console.log(`  ${chalk.blue(engine.name)}: ${engine.description}`);
              console.log(`    Command: ${chalk.gray(engine.command)}`);
            });
            
            return { success: true, engines };
          }
        })
      }
    }),

    clean: defineCommand({
      meta: {
        name: 'clean',
        description: 'Clean LaTeX build artifacts'
      },
      args: {
        all: {
          type: 'boolean',
          description: 'Clean all artifacts including PDFs',
          default: false
        }
      },
      async run({ args }) {
        try {
          const integration = new LaTeXBuildIntegration();
          await integration.cleanup();
          
          if (args.all) {
            await fs.rm('./dist/latex', { recursive: true, force: true });
            consola.success('All LaTeX artifacts cleaned');
          } else {
            await fs.rm('./temp/latex', { recursive: true, force: true });
            consola.success('LaTeX temporary files cleaned');
          }
          
          return { success: true, cleaned: args.all ? 'all' : 'temp' };
        } catch (error) {
          consola.error('Clean error:', error);
          return { success: false, error: error.message };
        }
      }
    }),

    metrics: defineCommand({
      meta: {
        name: 'metrics',
        description: 'Show compilation metrics'
      },
      async run() {
        try {
          const integration = new LaTeXBuildIntegration();
          await integration.initialize();
          
          const metrics = integration.getMetrics();
          
          consola.info('LaTeX Compilation Metrics:');
          console.log(`  Compilations: ${metrics.compiler.compilations}`);
          console.log(`  Errors: ${metrics.compiler.errors}`);
          console.log(`  Warnings: ${metrics.compiler.warnings}`);
          console.log(`  Average Time: ${Math.round(metrics.compiler.averageTime)}ms`);
          console.log(`  Total Time: ${Math.round(metrics.compiler.totalTime)}ms`);
          
          return { success: true, metrics };
        } catch (error) {
          consola.error('Metrics error:', error);
          return { success: false, error: error.message };
        }
      }
    })
  }
});

export default latexCommand;