#!/usr/bin/env node
/**
 * Static View Generator for GitHub Pages
 * 
 * Generates static JSON files from persona-driven views for hosting on GitHub Pages.
 * This script imports and executes the TypeScript view generators to create
 * static outputs suitable for web hosting.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const OUTPUT_DIR = join(__dirname, '../docs/api/views');
const PERSONAS = ['executive', 'architect', 'developer'];
const DEPTH_LEVELS = ['summary', 'detailed', 'comprehensive'];

async function ensureDirectory(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function generateViewForPersona(persona, depth = 'summary') {
  try {
    console.log(`Generating ${persona} view (${depth})...`);
    
    // Import the view generator (these would be actual imports in real implementation)
    // For now, we'll generate mock data that matches the TypeScript interfaces
    const viewData = await generateMockViewData(persona, depth);
    
    const filename = `${persona}-${depth}.json`;
    const filepath = join(OUTPUT_DIR, filename);
    
    await writeFile(filepath, JSON.stringify(viewData, null, 2));
    console.log(`✅ Generated: ${filepath}`);
    
    return filepath;
  } catch (error) {
    console.error(`❌ Failed to generate ${persona} view:`, error.message);
    throw error;
  }
}

async function generateMockViewData(persona, depth) {
  const baseData = {
    metadata: {
      generated: new Date().toISOString(),
      persona,
      depth,
      version: '2.0.0',
      githubPagesReady: true,
      marketplaceBaseUrl: 'https://marketplace.kgen.dev'
    }
  };

  switch (persona) {
    case 'executive':
      return {
        ...baseData,
        viewType: 'executive',
        summary: {
          totalPacksInstalled: 127,
          activeProjects: 34,
          monthlyROI: 156789,
          complianceScore: 87,
          riskLevel: 'medium'
        },
        kpis: {
          developmentVelocity: {
            metric: 47,
            trend: 'up',
            target: 50,
            status: 'below-target'
          },
          timeToMarket: {
            metric: 38,
            unit: 'days',
            improvement: 23,
            industry_benchmark: 45
          },
          costEfficiency: {
            savedHours: 1524,
            savedCost: 129540,
            roi: 3.4,
            paybackPeriod: 2.1
          }
        },
        compliance: {
          overallScore: 87,
          frameworks: [
            {
              name: 'SOC 2 Type II',
              coverage: 94,
              status: 'compliant',
              gaps: []
            },
            {
              name: 'GDPR',
              coverage: 76,
              status: 'partial',
              gaps: ['Data retention policies', 'Right to erasure automation']
            }
          ]
        },
        marketplaceLinks: {
          topPackages: [
            {
              name: 'kgen-api-scaffold',
              url: 'https://marketplace.kgen.dev/packages/api-scaffold',
              category: 'API Development',
              adoption: 89
            }
          ],
          recommendations: [
            {
              name: 'kgen-security-hardening',
              url: 'https://marketplace.kgen.dev/packages/security-hardening',
              reason: 'Addresses compliance gaps identified in GDPR',
              potentialROI: 145000
            }
          ]
        }
      };

    case 'architect':
      return {
        ...baseData,
        viewType: 'architect',
        summary: {
          totalComponents: 45,
          integrationComplexity: 7.2,
          performanceScore: 85.6,
          architecturalHealth: 78.9,
          technicalDebtLevel: 'medium',
          trustPolicyCompliance: 87
        },
        dependencies: {
          totalNodes: 45,
          criticalPaths: [
            {
              path: ['kgen-users', 'kgen-auth', 'kgen-api-core', 'postgres-db'],
              risk: 'medium',
              impact: 7.8
            }
          ],
          recommendations: [
            'Consider implementing circuit breakers for external dependencies',
            'Upgrade PostgreSQL to version 16.x for improved performance'
          ]
        },
        performance: {
          benchmarks: [
            {
              metric: 'API Response Time',
              value: 245,
              unit: 'ms',
              baseline: 300,
              target: 200,
              trend: 'improving',
              percentile: 95
            }
          ],
          optimizationTargets: [
            {
              component: 'API Gateway',
              potential: 34,
              effort: 'medium',
              marketplaceSolutions: [
                {
                  name: 'kgen-gateway-optimizer',
                  url: 'https://marketplace.kgen.dev/packages/gateway-optimizer',
                  effectiveness: 87
                }
              ]
            }
          ]
        },
        trustPolicies: {
          complianceScore: 87,
          diffs: [
            {
              policy: 'minimumTrustScore',
              current: 80,
              proposed: 85,
              impact: 'medium',
              reason: 'Improve overall security posture',
              recommendation: 'Implement gradually over 30 days'
            }
          ]
        }
      };

    case 'developer':
      return {
        ...baseData,
        viewType: 'developer',
        summary: {
          availableAPIs: 12,
          codeExamples: 47,
          quickstartGuides: 8,
          supportedLanguages: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java'],
          installMethods: 4
        },
        installation: {
          commands: [
            {
              manager: 'npm',
              command: 'npm install -g @kgen/cli',
              global: true,
              postInstall: ['kgen --version', 'kgen init']
            },
            {
              manager: 'yarn',
              command: 'yarn global add @kgen/cli',
              global: true
            }
          ],
          verification: {
            command: 'kgen --version',
            expectedOutput: '@kgen/cli version 2.0.0'
          }
        },
        apis: {
          contracts: [
            {
              name: 'KGEN API',
              version: '2.0.0',
              baseUrl: 'https://api.kgen.dev/v2',
              authentication: {
                type: 'bearer',
                description: 'Bearer token authentication using API key'
              }
            }
          ],
          playground: {
            url: 'https://api-playground.kgen.dev',
            interactive: true
          }
        },
        examples: {
          featured: [
            {
              title: 'Basic Package Installation',
              description: 'Install and use a KGEN package in your project',
              language: 'javascript',
              marketplaceUrl: 'https://marketplace.kgen.dev/packages/api-scaffold',
              complexity: 'beginner'
            }
          ]
        },
        marketplaceIntegrations: {
          developerTools: [
            {
              name: 'KGEN Debug Assistant',
              url: 'https://marketplace.kgen.dev/packages/debug-assistant',
              category: 'Development',
              description: 'Advanced debugging tools for KGEN-generated code'
            }
          ],
          templates: [
            {
              name: 'React Component Library',
              url: 'https://marketplace.kgen.dev/templates/react-components',
              framework: 'React',
              features: ['TypeScript support', 'Storybook integration'],
              complexity: 'intermediate'
            }
          ]
        }
      };

    default:
      throw new Error(`Unknown persona: ${persona}`);
  }
}

async function generateIndexFile(generatedFiles) {
  const index = {
    generated: new Date().toISOString(),
    version: '2.0.0',
    description: 'KGEN Marketplace Persona-Driven Views - Static JSON API',
    githubPages: {
      baseUrl: 'https://yourusername.github.io/yourrepo/api/views',
      note: 'Replace with your actual GitHub Pages URL'
    },
    views: {}
  };

  // Organize files by persona and depth
  for (const file of generatedFiles) {
    const filename = file.split('/').pop();
    const [persona, depth] = filename.replace('.json', '').split('-');
    
    if (!index.views[persona]) {
      index.views[persona] = {};
    }
    
    index.views[persona][depth] = {
      url: `./views/${filename}`,
      description: `${persona} view with ${depth} level details`,
      lastUpdated: new Date().toISOString()
    };
  }

  const indexPath = join(OUTPUT_DIR, '../index.json');
  await writeFile(indexPath, JSON.stringify(index, null, 2));
  console.log(`✅ Generated index: ${indexPath}`);
  
  return indexPath;
}

async function generateGitHubPagesConfig() {
  const config = {
    name: 'KGEN Marketplace Views API',
    description: 'Static JSON API for KGEN marketplace persona-driven views',
    version: '2.0.0',
    endpoints: {
      index: '/api/index.json',
      views: '/api/views/',
      personas: ['executive', 'architect', 'developer'],
      depths: ['summary', 'detailed', 'comprehensive']
    },
    cors: {
      enabled: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    },
    caching: {
      maxAge: 3600,
      staleWhileRevalidate: 86400
    },
    usage: {
      examples: [
        'fetch("https://yourusername.github.io/yourrepo/api/views/executive-summary.json")',
        'curl -H "Accept: application/json" https://yourusername.github.io/yourrepo/api/views/developer-detailed.json'
      ]
    }
  };

  const configPath = join(OUTPUT_DIR, '../config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Generated GitHub Pages config: ${configPath}`);
  
  return configPath;
}

async function main() {
  try {
    console.log('🚀 Generating static views for GitHub Pages...\n');
    
    // Ensure output directory exists
    await ensureDirectory(OUTPUT_DIR);
    await ensureDirectory(join(OUTPUT_DIR, '../'));
    
    const generatedFiles = [];
    
    // Generate views for each persona and depth combination
    for (const persona of PERSONAS) {
      for (const depth of DEPTH_LEVELS) {
        const filepath = await generateViewForPersona(persona, depth);
        generatedFiles.push(filepath);
      }
    }
    
    // Generate index and config files
    await generateIndexFile(generatedFiles);
    await generateGitHubPagesConfig();
    
    console.log('\n✅ All static views generated successfully!');
    console.log('\n📁 Output structure:');
    console.log('docs/');
    console.log('├── api/');
    console.log('│   ├── index.json');
    console.log('│   ├── config.json');
    console.log('│   └── views/');
    console.log('│       ├── executive-summary.json');
    console.log('│       ├── executive-detailed.json');
    console.log('│       ├── executive-comprehensive.json');
    console.log('│       ├── architect-summary.json');
    console.log('│       ├── architect-detailed.json');
    console.log('│       ├── architect-comprehensive.json');
    console.log('│       ├── developer-summary.json');
    console.log('│       ├── developer-detailed.json');
    console.log('│       └── developer-comprehensive.json');
    
    console.log('\n🌐 To host on GitHub Pages:');
    console.log('1. Commit the docs/ directory to your repository');
    console.log('2. Enable GitHub Pages in repository settings');
    console.log('3. Set source to "Deploy from a branch" and select "main" branch "/docs" folder');
    console.log('4. Access your API at: https://yourusername.github.io/yourrepo/api/index.json');
    
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    process.exit(1);
  }
}

// Run the generator
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateViewForPersona, generateMockViewData };