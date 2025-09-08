// Optimized Agent Templates for Context Efficiency
export interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  contextOptimizations: string[];
  maxTokensRecommended: number;
  batchingStrategy: 'sequential' | 'parallel' | 'hybrid';
  memoryPattern: 'ephemeral' | 'persistent' | 'selective';
}

export const OPTIMIZED_AGENT_TEMPLATES: Record<string, AgentTemplate> = {
  'context-aware-coder': {
    id: 'context-aware-coder',
    name: 'Context-Aware Code Generator',
    role: 'coder',
    contextOptimizations: [
      'Batch all file operations in single message',
      'Use selective imports over full file reads',
      'Implement incremental context building',
      'Prioritize hot-path optimizations'
    ],
    maxTokensRecommended: 15000,
    batchingStrategy: 'parallel',
    memoryPattern: 'selective'
  },

  'efficient-researcher': {
    id: 'efficient-researcher',
    name: 'Efficient Research Agent',
    role: 'researcher',
    contextOptimizations: [
      'Focus on high-impact insights only',
      'Use structured summaries over raw data',
      'Implement progressive disclosure',
      'Cache frequently accessed patterns'
    ],
    maxTokensRecommended: 12000,
    batchingStrategy: 'sequential',
    memoryPattern: 'persistent'
  },

  'lightweight-tester': {
    id: 'lightweight-tester',
    name: 'Lightweight Test Generator',
    role: 'tester',
    contextOptimizations: [
      'Generate test templates over full suites',
      'Use parameterized test patterns',
      'Focus on critical path coverage',
      'Batch assertions efficiently'
    ],
    maxTokensRecommended: 8000,
    batchingStrategy: 'hybrid',
    memoryPattern: 'ephemeral'
  },

  'streaming-reviewer': {
    id: 'streaming-reviewer',
    name: 'Streaming Code Reviewer',
    role: 'reviewer',
    contextOptimizations: [
      'Stream feedback as changes are made',
      'Use delta-based reviews over full scans',
      'Implement smart change detection',
      'Focus on security and performance'
    ],
    maxTokensRecommended: 10000,
    batchingStrategy: 'parallel',
    memoryPattern: 'selective'
  }
};

export function generateAgentPrompt(templateId: string, task: string): string {
  const template = OPTIMIZED_AGENT_TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown template: ${templateId}`);

  return `You are a ${template.name} specialized in ${template.role} tasks.

CONTEXT OPTIMIZATIONS (Critical - Follow Exactly):
${template.contextOptimizations.map(opt => `- ${opt}`).join('\n')}

EFFICIENCY CONSTRAINTS:
- Maximum recommended tokens: ${template.maxTokensRecommended.toLocaleString()}
- Batching strategy: ${template.batchingStrategy}
- Memory pattern: ${template.memoryPattern}

TASK: ${task}

COORDINATION PROTOCOL:
1. Pre-task: npx claude-flow@alpha hooks pre-task --description "${task}"
2. During: Use hooks for state updates
3. Post-task: npx claude-flow@alpha hooks post-task --task-id "${templateId}-${Date.now()}"

Begin execution with optimal context usage.`;
}

export class OptimizedAgentFactory {
  private templates = OPTIMIZED_AGENT_TEMPLATES;
  private activeAgents: Map<string, any> = new Map();

  createAgent(templateId: string, task: string, options: any = {}): string {
    const template = this.templates[templateId];
    if (!template) throw new Error(`Template ${templateId} not found`);

    const agentId = `${templateId}-${Date.now()}`;
    const prompt = generateAgentPrompt(templateId, task);

    // Apply context optimizations
    const optimizedPrompt = this.applyContextOptimizations(prompt, template);

    this.activeAgents.set(agentId, {
      template,
      task,
      options,
      startTime: Date.now()
    });

    return optimizedPrompt;
  }

  private applyContextOptimizations(prompt: string, template: AgentTemplate): string {
    let optimized = prompt;

    // Apply batching strategy
    if (template.batchingStrategy === 'parallel') {
      optimized += '\n\nIMPORTANT: Execute ALL related operations in a SINGLE message for maximum efficiency.';
    }

    // Apply memory pattern
    if (template.memoryPattern === 'selective') {
      optimized += '\n\nMEMORY: Store only critical state. Use hooks for coordination.';
    }

    // Add token budget warning
    optimized += `\n\nTOKEN BUDGET: Stay under ${template.maxTokensRecommended.toLocaleString()} tokens.`;

    return optimized;
  }

  getActiveAgents(): Array<{ id: string; template: string; uptime: number }> {
    return Array.from(this.activeAgents.entries()).map(([id, agent]) => ({
      id,
      template: agent.template.name,
      uptime: Date.now() - agent.startTime
    }));
  }
}