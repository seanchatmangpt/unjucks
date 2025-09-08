// Context Priming Scripts for Development Phases
import { writeFile } from 'fs/promises';

interface PrimingTemplate {
  phase: string;
  contextSize: 'small' | 'medium' | 'large';
  focus: string[];
  exclusions: string[];
  agentConfiguration: Record<string, any>;
}

export const PRIMING_TEMPLATES: Record<string, PrimingTemplate> = {
  'rapid-prototyping': {
    phase: 'prototyping',
    contextSize: 'small',
    focus: [
      'Core functionality only',
      'Minimal viable implementation',
      'Quick validation cycles',
      'High-level architecture'
    ],
    exclusions: [
      'Detailed error handling',
      'Comprehensive testing',
      'Performance optimization',
      'Security hardening'
    ],
    agentConfiguration: {
      maxAgents: 3,
      topology: 'star',
      coordination: 'centralized'
    }
  },

  'production-ready': {
    phase: 'production',
    contextSize: 'large',
    focus: [
      'Comprehensive testing',
      'Security implementation',
      'Performance optimization',
      'Error handling and recovery',
      'Monitoring and observability'
    ],
    exclusions: [
      'Experimental features',
      'Temporary workarounds',
      'Debug-only code'
    ],
    agentConfiguration: {
      maxAgents: 8,
      topology: 'mesh',
      coordination: 'distributed'
    }
  },

  'refactoring': {
    phase: 'refactoring',
    contextSize: 'medium',
    focus: [
      'Code quality improvement',
      'Architecture simplification',
      'Performance optimization',
      'Maintainability enhancement'
    ],
    exclusions: [
      'New feature development',
      'API changes',
      'Breaking modifications'
    ],
    agentConfiguration: {
      maxAgents: 4,
      topology: 'hierarchical',
      coordination: 'consensus'
    }
  }
};

export function generatePrimingScript(templateName: string, customizations: Partial<PrimingTemplate> = {}): string {
  const template = PRIMING_TEMPLATES[templateName];
  if (!template) throw new Error(`Unknown priming template: ${templateName}`);

  const merged = { ...template, ...customizations };

  return `#!/bin/bash
# Auto-generated priming script for ${templateName}

echo "🎯 Priming AI swarm for ${merged.phase} phase"
echo "📏 Context size: ${merged.contextSize}"
echo "🤖 Max agents: ${merged.agentConfiguration.maxAgents}"

# Initialize swarm with optimized configuration
npx claude-flow@alpha swarm init \\
  --topology ${merged.agentConfiguration.topology} \\
  --max-agents ${merged.agentConfiguration.maxAgents} \\
  --session-id "${templateName}-$(date +%s)"

# Set context focus
cat > /tmp/${templateName}-focus.json << 'EOF'
{
  "phase": "${merged.phase}",
  "contextSize": "${merged.contextSize}",
  "focus": ${JSON.stringify(merged.focus, null, 2)},
  "exclusions": ${JSON.stringify(merged.exclusions, null, 2)},
  "coordination": "${merged.agentConfiguration.coordination}"
}
EOF

echo "✅ ${templateName} phase primed successfully"
echo "📋 Context configuration saved to /tmp/${templateName}-focus.json"
`;
}

export async function createPrimingScript(templateName: string, outputPath: string): Promise<void> {
  const script = generatePrimingScript(templateName);
  await writeFile(outputPath, script, { mode: 0o755 });
  console.log(`✅ Priming script created: ${outputPath}`);
}