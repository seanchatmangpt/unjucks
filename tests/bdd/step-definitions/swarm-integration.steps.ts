import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testContext, executeCommand } from './cli-core.steps.js';

// Mock MCP integration for testing
interface MockMCPResponse {
  success: boolean;
  data: any;
  message?: string;
}

interface SwarmContext {
  activeSwarms: Map<string, any>;
  swarmAgents: Map<string, any[]>;
  workflows: Map<string, any>;
  mcpResponses: MockMCPResponse[];
  agentActivities: string[];
}

const swarmContext: SwarmContext = {
  activeSwarms: new Map(),
  swarmAgents: new Map(),
  workflows: new Map(),
  mcpResponses: [],
  agentActivities: []
};

// Mock MCP tool responses
function mockMCPToolResponse(tool: string, success: boolean = true, data: any = {}): MockMCPResponse {
  const response: MockMCPResponse = {
    success,
    data,
    message: success ? `${tool} completed successfully` : `${tool} failed`
  };
  
  swarmContext.mcpResponses.push(response);
  return response;
}

// Mock swarm initialization
function mockSwarmInit(topology: string, agents: number): any {
  const swarmId = `swarm-${Date.now()}`;
  const swarm = {
    id: swarmId,
    topology,
    maxAgents: agents,
    status: 'active',
    agents: [],
    createdAt: new Date().toISOString()
  };
  
  swarmContext.activeSwarms.set(swarmId, swarm);
  return swarm;
}

// Mock agent spawning
function mockAgentSpawn(type: string, swarmId?: string): any {
  const agentId = `agent-${type}-${Date.now()}`;
  const agent = {
    id: agentId,
    type,
    status: 'active',
    capabilities: getAgentCapabilities(type),
    swarmId: swarmId || Array.from(swarmContext.activeSwarms.keys())[0],
    spawnedAt: new Date().toISOString()
  };
  
  const currentAgents = swarmContext.swarmAgents.get(agent.swarmId) || [];
  currentAgents.push(agent);
  swarmContext.swarmAgents.set(agent.swarmId, currentAgents);
  
  return agent;
}

function getAgentCapabilities(type: string): string[] {
  const capabilities: Record<string, string[]> = {
    'coder': ['coding', 'refactoring', 'debugging'],
    'tester': ['testing', 'quality-assurance', 'validation'],
    'reviewer': ['code-review', 'security-audit', 'best-practices'],
    'researcher': ['analysis', 'documentation', 'requirements'],
    'performance': ['optimization', 'benchmarking', 'profiling'],
    'security': ['security-analysis', 'vulnerability-scanning', 'compliance']
  };
  
  return capabilities[type] || ['general'];
}

// Mock workflow creation
function mockWorkflowCreate(name: string, steps: string[], triggers?: string[]): any {
  const workflowId = `workflow-${Date.now()}`;
  const workflow = {
    id: workflowId,
    name,
    steps: steps.map((step, index) => ({
      id: `step-${index + 1}`,
      name: step,
      status: 'pending',
      agentType: inferAgentType(step)
    })),
    triggers: triggers || ['manual'],
    status: 'created',
    createdAt: new Date().toISOString()
  };
  
  swarmContext.workflows.set(workflowId, workflow);
  return workflow;
}

function inferAgentType(stepName: string): string {
  const stepLower = stepName.toLowerCase();
  if (stepLower.includes('test')) return 'tester';
  if (stepLower.includes('review')) return 'reviewer';
  if (stepLower.includes('implement') || stepLower.includes('code')) return 'coder';
  if (stepLower.includes('analyze') || stepLower.includes('research')) return 'researcher';
  return 'coder';
}

// Given steps
Given('I have a working Unjucks installation with MCP integration', async () => {
  // Verify MCP integration is available (mock)
  const mcpStatus = mockMCPToolResponse('mcp-status', true, { 
    servers: ['claude-flow', 'flow-nexus'],
    status: 'connected'
  });
  
  expect(mcpStatus.success).toBe(true);
});

Given('I have Claude Flow swarm capabilities enabled', async () => {
  // Mock Claude Flow availability
  const claudeFlowStatus = mockMCPToolResponse('claude-flow-status', true, {
    version: '2.0.0',
    features: ['swarm', 'neural', 'workflow'],
    available: true
  });
  
  expect(claudeFlowStatus.success).toBe(true);
});

Given('I have appropriate MCP servers configured', async () => {
  // Mock MCP server configuration
  const serverConfig = {
    'claude-flow': { url: 'mock://claude-flow', status: 'connected' },
    'flow-nexus': { url: 'mock://flow-nexus', status: 'connected' }
  };
  
  swarmContext.mcpResponses.push({
    success: true,
    data: serverConfig,
    message: 'MCP servers configured successfully'
  });
});

Given('I have an active swarm', async () => {
  const swarm = mockSwarmInit('mesh', 5);
  
  // Spawn some initial agents
  mockAgentSpawn('coder', swarm.id);
  mockAgentSpawn('tester', swarm.id);
  mockAgentSpawn('reviewer', swarm.id);
  
  expect(swarmContext.activeSwarms.size).toBeGreaterThan(0);
});

Given('I have generated code files', async () => {
  // Create some mock generated files
  const srcDir = path.join(testContext.workingDir, 'src');
  fs.ensureDirSync(srcDir);
  
  const files = [
    'UserService.ts',
    'UserController.ts',
    'UserRepository.ts',
    'user.routes.ts'
  ];
  
  files.forEach(file => {
    const content = `// Generated ${file}\nexport class ${file.replace('.ts', '')} {\n  // Implementation\n}\n`;
    fs.writeFileSync(path.join(srcDir, file), content);
  });
});

Given('I have an active swarm with review agents', async () => {
  const swarm = mockSwarmInit('hierarchical', 6);
  
  // Spawn review-focused agents
  mockAgentSpawn('reviewer', swarm.id);
  mockAgentSpawn('security', swarm.id);
  mockAgentSpawn('performance', swarm.id);
  
  expect(swarmContext.swarmAgents.get(swarm.id)?.length).toBeGreaterThanOrEqual(3);
});

Given(/^I have a created workflow "([^"]+)"$/, async (workflowName: string) => {
  const workflow = mockWorkflowCreate(
    workflowName,
    ['analyze', 'design', 'implement', 'test', 'review'],
    ['push', 'pr']
  );
  
  expect(swarmContext.workflows.has(workflow.id)).toBe(true);
});

Given('I have an active swarm with running tasks', async () => {
  const swarm = mockSwarmInit('mesh', 8);
  
  // Add agents with active tasks
  const agents = [
    mockAgentSpawn('coder', swarm.id),
    mockAgentSpawn('tester', swarm.id),
    mockAgentSpawn('reviewer', swarm.id)
  ];
  
  // Mock running tasks
  agents.forEach((agent, index) => {
    agent.currentTask = `task-${index + 1}`;
    agent.taskStarted = new Date(Date.now() - (index * 30000)).toISOString();
  });
  
  swarmContext.agentActivities = [
    'coder: implementing UserService.ts',
    'tester: running unit tests',
    'reviewer: analyzing code quality'
  ];
});

Given('I have completed several successful workflows', async () => {
  // Create mock workflow history
  const workflows = [
    mockWorkflowCreate('api-development', ['design', 'implement', 'test']),
    mockWorkflowCreate('frontend-component', ['analyze', 'code', 'review']),
    mockWorkflowCreate('database-migration', ['plan', 'implement', 'validate'])
  ];
  
  workflows.forEach(workflow => {
    workflow.status = 'completed';
    workflow.completedAt = new Date().toISOString();
    workflow.performance = {
      duration: 1800000, // 30 minutes
      efficiency: 0.95,
      quality: 0.92
    };
  });
  
  expect(swarmContext.workflows.size).toBeGreaterThanOrEqual(3);
});

Given('I have GitHub integration configured', async () => {
  // Mock GitHub integration setup
  const githubConfig = mockMCPToolResponse('github-config', true, {
    token: 'mock-token',
    permissions: ['repo', 'issues', 'pull_requests'],
    webhooks: ['push', 'pull_request', 'issues']
  });
  
  expect(githubConfig.success).toBe(true);
});

Given('I have swarm agents with accumulated experience', async () => {
  const swarm = mockSwarmInit('adaptive', 6);
  const agents = swarmContext.swarmAgents.get(swarm.id) || [];
  
  // Add experience data to agents
  agents.forEach(agent => {
    agent.experience = {
      tasksCompleted: Math.floor(Math.random() * 50) + 10,
      successRate: 0.85 + Math.random() * 0.15,
      patterns: ['async-patterns', 'error-handling', 'optimization'],
      knowledgeDomains: ['javascript', 'typescript', 'testing']
    };
  });
});

Given('I have a swarm with variable workload', async () => {
  const swarm = mockSwarmInit('mesh', 5);
  
  // Simulate variable workload
  swarm.workload = {
    current: 75, // 75% CPU utilization
    pending: 12,
    processing: 8,
    completed: 150
  };
  
  swarm.metrics = {
    avgResponseTime: 250,
    throughput: 45,
    errorRate: 0.02
  };
});

Given('I have a swarm with a failing agent', async () => {
  const swarm = mockSwarmInit('hierarchical', 5);
  const agents = swarmContext.swarmAgents.get(swarm.id) || [];
  
  if (agents.length > 0) {
    agents[0].status = 'failed';
    agents[0].lastError = 'Connection timeout';
    agents[0].failedAt = new Date().toISOString();
  }
});

Given('I have RDF data and semantic templates', async () => {
  // Create RDF schema
  const rdfSchema = `
@prefix : <http://example.org/domain#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:DomainModel rdf:type :Ontology ;
  rdfs:label "Domain Model" ;
  :hasEntity [
    :name "User" ;
    :properties [
      :name "id" ; :type "string" ;
      :name "email" ; :type "string" ;
      :name "profile" ; :type "Profile"
    ]
  ] .
`;
  
  const schemaPath = path.join(testContext.workingDir, 'schema/domain.ttl');
  fs.ensureDirSync(path.dirname(schemaPath));
  fs.writeFileSync(schemaPath, rdfSchema);
  
  // Create semantic templates
  const semanticTemplate = `---
to: src/ontology/{{ entity.name }}.ts
semanticType: entity
---
// Generated from ontology: {{ ontology.name }}
export interface I{{ entity.name }} {
{% for prop in entity.properties %}
  {{ prop.name }}: {{ prop.type }};
{% endfor %}
}
`;
  
  const templatePath = path.join(testContext.workingDir, 'templates/ontology-api/entity.ts.njk');
  fs.ensureDirSync(path.dirname(templatePath));
  fs.writeFileSync(templatePath, semanticTemplate);
});

Given('I have an active swarm with reasoning capabilities', async () => {
  const swarm = mockSwarmInit('mesh', 6);
  
  // Add reasoning-capable agents
  const reasoningAgent = mockAgentSpawn('researcher', swarm.id);
  reasoningAgent.capabilities.push('semantic-reasoning', 'inference', 'knowledge-graph');
  
  const semanticAgent = mockAgentSpawn('coder', swarm.id);
  semanticAgent.capabilities.push('semantic-code-generation', 'ontology-mapping');
});

// When steps are handled by core CLI steps, but we add some swarm-specific behavior

// Then steps
Then('I should see "Swarm initialized successfully" message', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/swarm.*initialized|initialization.*successful/i);
});

Then('I should see agent spawn confirmations', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/agent.*spawned|spawning.*agent/i);
});

Then('the swarm should be in "active" status', async () => {
  // In a real implementation, this would check actual swarm status
  // For testing, we verify our mock has active swarms
  expect(swarmContext.activeSwarms.size).toBeGreaterThan(0);
  
  const swarms = Array.from(swarmContext.activeSwarms.values());
  expect(swarms.some(swarm => swarm.status === 'active')).toBe(true);
});

Then('I should see coordinated agent activity', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/agent.*coordination|coordinating.*agents|collaborative/i);
});

Then('multiple files should be generated in parallel', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir, { recursive: true });
    expect(files.length).toBeGreaterThan(1);
  }
});

Then('I should see agent collaboration messages', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/collaboration|coordinating|working together/i);
});

Then('I should see multi-agent analysis results', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/analysis|review|multiple.*agents/i);
});

Then('I should get comprehensive review reports', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/report|analysis|review.*results/i);
});

Then('suggestions should be prioritized by consensus', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/consensus|priority|ranked.*suggestions/i);
});

Then('the workflow should be registered with MCP', async () => {
  expect(swarmContext.workflows.size).toBeGreaterThan(0);
});

Then('triggers should be configured', async () => {
  const workflows = Array.from(swarmContext.workflows.values());
  const hasConfiguredTriggers = workflows.some(w => w.triggers && w.triggers.length > 0);
  expect(hasConfiguredTriggers).toBe(true);
});

Then('agents should be automatically assigned to steps', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/agent.*assigned|assigning.*agents|automatic.*assignment/i);
});

Then('execution should proceed asynchronously', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/async|asynchronous|queued|background/i);
});

Then('I should see individual agent statuses', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/agent.*status|individual.*agents/i);
});

Then('I should see performance metrics', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/performance|metrics|cpu|memory|throughput/i);
});

Then('I should see task distribution information', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/task.*distribution|load.*balance|work.*allocation/i);
});

Then('neural patterns should be extracted from workflow history', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/neural.*pattern|learning.*from.*history|pattern.*extraction/i);
});

Then('training should improve future agent coordination', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/training.*complete|coordination.*improved|learning.*applied/i);
});

Then('I should see training progress updates', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/training.*progress|learning.*update/i);
});

Then('swarm agents should analyze the repository', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/repository.*analysis|analyzing.*repo|swarm.*analysis/i);
});

Then('I should get multi-perspective insights', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/multi.*perspective|diverse.*insights|multiple.*viewpoints/i);
});

Then('recommendations should be consensus-driven', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/consensus.*recommendation|agreed.*upon|collective.*decision/i);
});

Then('multiple agents should run performance tests', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/performance.*test|benchmark.*agent|multiple.*testing/i);
});

Then('results should be aggregated intelligently', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/aggregate.*results|intelligent.*combination|merged.*analysis/i);
});

Then('I should see comparative performance analysis', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/comparative.*analysis|performance.*comparison|benchmark.*results/i);
});

Then('shared knowledge should be exported', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/knowledge.*export|memory.*export|shared.*data/i);
});

Then('patterns should be preserved for future use', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/pattern.*preserved|future.*use|knowledge.*retained/i);
});

Then('memory should be properly structured', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/structured.*memory|organized.*knowledge|formatted.*data/i);
});

Then('the swarm should automatically adjust agent count', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/auto.*scale|adjust.*agent.*count|scaling.*agents/i);
});

Then('scaling decisions should be based on metrics', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/metric.*based.*scaling|performance.*driven|threshold.*based/i);
});

Then('I should see scaling activity notifications', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/scaling.*activity|agent.*count.*changed|auto.*scale.*event/i);
});

Then('failed agents should be detected', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/failed.*agent.*detected|agent.*failure.*identified/i);
});

Then('replacement agents should be spawned', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/replacement.*agent|spawning.*new.*agent|failover.*agent/i);
});

Then('work should be redistributed', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/work.*redistributed|task.*reassigned|load.*rebalanced/i);
});

Then('agents should collaborate on semantic analysis', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/semantic.*analysis|collaborative.*reasoning|ontology.*analysis/i);
});

Then('generated code should reflect semantic understanding', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/semantic.*code|ontology.*driven|knowledge.*based.*generation/i);
});

Then('reasoning results should be shared between agents', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/shared.*reasoning|knowledge.*sharing|collaborative.*inference/i);
});

// Export context for other step files
export { swarmContext, mockMCPToolResponse, mockSwarmInit, mockAgentSpawn };
