/**
 * Agent 1: PRD Requirements Extractor
 * Extracts all CLI requirements from KGEN-PRD.md and creates validation matrix
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

export class PRDRequirementsExtractor {
  constructor() {
    this.requirements = [];
    this.commandMap = new Map();
    this.report = {
      agent: 'PRD Requirements Extractor',
      timestamp: new Date().toISOString(),
      requirements: {},
      coverage: {}
    };
  }

  async execute() {
    console.log('🔍 Agent 1: Extracting PRD requirements...');
    
    try {
      // Read PRD file
      const prdPath = resolve('/Users/sac/unjucks/KGEN-PRD.md');
      const prdContent = readFileSync(prdPath, 'utf8');
      
      // Extract section 5: Feature Requirements
      this.extractFeatureRequirements(prdContent);
      
      // Map CLI commands from PRD
      this.mapPRDCommands();
      
      // Calculate requirement categories
      this.categorizeRequirements();
      
      console.log(`✅ Extracted ${this.requirements.length} CLI requirements`);
      
      return this.report;
    } catch (error) {
      console.error('❌ PRD extraction failed:', error);
      throw error;
    }
  }

  extractFeatureRequirements(content) {
    const lines = content.split('\n');
    let inRequirements = false;
    let currentSection = '';
    
    for (const line of lines) {
      if (line.includes('5. Feature Requirements')) {
        inRequirements = true;
        continue;
      }
      
      if (inRequirements && line.startsWith('6.')) {
        break; // End of requirements section
      }
      
      if (inRequirements) {
        // Extract subsections
        if (line.match(/^5\.\d+\./)) {
          currentSection = line.trim();
          this.report.requirements[currentSection] = [];
        }
        
        // Extract user stories with CLI commands
        if (line.includes('kgen ') || line.includes('invoke ')) {
          const requirement = this.parseRequirement(line, currentSection);
          if (requirement) {
            this.requirements.push(requirement);
            if (currentSection) {
              this.report.requirements[currentSection].push(requirement);
            }
          }
        }
      }
    }
  }

  parseRequirement(line, section) {
    // Extract CLI command pattern
    const commandMatch = line.match(/kgen\s+([\w\s]+?)(?:\s|,|\.)/);
    const invokeMatch = line.match(/invoke\s+([\w\s]+?)(?:\s|,|\.)/);
    
    if (commandMatch || invokeMatch) {
      const command = commandMatch ? `kgen ${commandMatch[1].trim()}` : invokeMatch[1].trim();
      
      return {
        section,
        command: command.toLowerCase(),
        description: line.trim(),
        type: this.inferCommandType(command),
        priority: this.inferPriority(line),
        userStory: line.includes('As a') ? line.trim() : null
      };
    }
    
    return null;
  }

  inferCommandType(command) {
    if (command.includes('graph')) return 'graph';
    if (command.includes('artifact')) return 'artifact';
    if (command.includes('project')) return 'project';
    if (command.includes('templates') || command.includes('rules')) return 'tooling';
    if (command.includes('cache') || command.includes('metrics')) return 'system';
    return 'other';
  }

  inferPriority(line) {
    if (line.includes('must be able')) return 'critical';
    if (line.includes('should be able')) return 'high';
    return 'medium';
  }

  mapPRDCommands() {
    // Expected CLI commands from PRD analysis
    const expectedCommands = [
      // Graph System (5.1)
      'kgen graph hash',
      'kgen graph diff', 
      'kgen graph index',
      
      // Artifact System (5.2)
      'kgen artifact generate',
      'kgen artifact drift',
      'kgen artifact explain',
      
      // Project System (5.3)
      'kgen project lock',
      'kgen project attest',
      
      // Tooling Systems (5.4)
      'kgen templates ls',
      'kgen rules ls',
      'kgen cache gc',
      'kgen metrics export'
    ];
    
    this.report.coverage.expectedCommands = expectedCommands;
    this.report.coverage.totalExpected = expectedCommands.length;
    
    // Map requirements to commands
    for (const command of expectedCommands) {
      this.commandMap.set(command, {
        implemented: false,
        tested: false,
        location: null,
        issues: []
      });
    }
  }

  categorizeRequirements() {
    const categories = {
      graph: [],
      artifact: [],
      project: [],
      tooling: [],
      system: []
    };
    
    for (const req of this.requirements) {
      categories[req.type].push(req);
    }
    
    this.report.categories = categories;
    this.report.summary = {
      totalRequirements: this.requirements.length,
      graphCommands: categories.graph.length,
      artifactCommands: categories.artifact.length,
      projectCommands: categories.project.length,
      toolingCommands: categories.tooling.length,
      systemCommands: categories.system.length
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const extractor = new PRDRequirementsExtractor();
  extractor.execute()
    .then(report => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default PRDRequirementsExtractor;