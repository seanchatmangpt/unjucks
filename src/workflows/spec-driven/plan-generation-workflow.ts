/**
 * Plan Generation Workflow - From specification to technical architecture
 * Automatically generates technical plans and architecture from approved specifications
 */

import type {
  WorkflowConfig,
  WorkflowState,
  WorkflowResult,
  SpecificationDocument,
  TechnicalPlan,
  ComponentSpec,
  ArchitecturalDecision,
  DependencySpec,
  Milestone,
  RiskAssessment
} from './types';

export interface PlanGenerationConfig extends WorkflowConfig {
  architecturePatterns: ArchitecturePattern[];
  technologyStack: TechnologyStack;
  estimationModel: EstimationModel;
  riskThreshold: number;
}

export interface ArchitecturePattern {
  name: string;
  description: string;
  applicability: string[];
  pros: string[];
  cons: string[];
  components: string[];
}

export interface TechnologyStack {
  frontend: string[];
  backend: string[];
  database: string[];
  infrastructure: string[];
  tools: string[];
}

export interface EstimationModel {
  baseComplexityPoints: Record<string, number>;
  multipliers: Record<string, number>;
  bufferPercentage: number;
}

export class PlanGenerationWorkflow {
  private config: PlanGenerationConfig;
  private state: WorkflowState;

  constructor(config: PlanGenerationConfig) {
    this.config = config;
    this.state = {
      id: `plan-gen-${Date.now()}`,
      status: 'pending',
      currentStep: 'initialization',
      progress: 0,
      startTime: new Date(),
      metadata: {}
    };
  }

  async execute(specification: SpecificationDocument): Promise<WorkflowResult<TechnicalPlan>> {
    const startTime = Date.now();

    try {
      this.updateState('in_progress', 'architecture-analysis', 15);

      // Step 1: Analyze requirements for architectural patterns
      const architecturalDecisions = await this.analyzeArchitecture(specification);
      this.updateState('in_progress', 'component-design', 30);

      // Step 2: Design system components
      const components = await this.designComponents(specification, architecturalDecisions);
      this.updateState('in_progress', 'dependency-mapping', 50);

      // Step 3: Map dependencies and integration points
      const dependencies = await this.mapDependencies(components, specification);
      this.updateState('in_progress', 'timeline-planning', 70);

      // Step 4: Generate timeline and milestones
      const timeline = await this.generateTimeline(components, dependencies);
      this.updateState('in_progress', 'risk-assessment', 85);

      // Step 5: Assess risks and create mitigation strategies
      const risks = await this.assessRisks(specification, components, dependencies);
      this.updateState('in_progress', 'plan-finalization', 95);

      // Step 6: Finalize technical plan
      const technicalPlan: TechnicalPlan = {
        id: `plan-${specification.id}-${Date.now()}`,
        specificationId: specification.id,
        version: '1.0.0',
        created: new Date(),
        architecture: architecturalDecisions,
        components,
        dependencies,
        timeline,
        risks
      };

      this.updateState('completed', 'finished', 100);

      return {
        success: true,
        data: technicalPlan,
        metrics: {
          duration: Date.now() - startTime,
          stepsCompleted: 6,
          totalSteps: 6,
          resourcesUsed: { 
            'components': components.length,
            'dependencies': dependencies.length,
            'risks': risks.length
          },
          agentsInvolved: ['architect', 'researcher', 'planner']
        }
      };

    } catch (error) {
      this.updateState('failed', 'error', this.state.progress);
      this.state.error = {
        code: 'PLAN_GENERATION_FAILED',
        message: error.message,
        stack: error.stack,
        recoverable: true
      };

      return {
        success: false,
        error: this.state.error,
        metrics: {
          duration: Date.now() - startTime,
          stepsCompleted: 0,
          totalSteps: 6,
          resourcesUsed: {},
          agentsInvolved: []
        }
      };
    }
  }

  private async analyzeArchitecture(spec: SpecificationDocument): Promise<ArchitecturalDecision[]> {
    const decisions: ArchitecturalDecision[] = [];

    // Analyze functional requirements for architecture patterns
    const functionalReqs = spec.requirements.filter(r => r.type === 'functional');
    const nonFunctionalReqs = spec.requirements.filter(r => r.type === 'non-functional');

    // Determine system type based on requirements
    const systemType = this.determineSystemType(functionalReqs);
    const pattern = this.selectArchitecturePattern(systemType, nonFunctionalReqs);

    decisions.push({
      id: 'arch-001',
      title: 'Overall Architecture Pattern',
      description: `Selected ${pattern.name} architecture based on system requirements`,
      rationale: `System type: ${systemType}. This pattern provides ${pattern.pros.join(', ')}`,
      alternatives: this.config.architecturePatterns
        .filter(p => p.name !== pattern.name)
        .map(p => p.name),
      implications: [
        `Components will follow ${pattern.name} structure`,
        `Technology stack should align with pattern requirements`,
        ...pattern.pros.map(pro => `Benefit: ${pro}`),
        ...pattern.cons.map(con => `Challenge: ${con}`)
      ],
      status: 'accepted'
    });

    // Technology stack decisions
    const techStack = this.selectTechnologyStack(pattern, nonFunctionalReqs);
    decisions.push({
      id: 'arch-002',
      title: 'Technology Stack Selection',
      description: 'Primary technologies for implementation',
      rationale: 'Selected based on architecture pattern and non-functional requirements',
      alternatives: ['Alternative stacks considered but not selected'],
      implications: [
        `Frontend: ${techStack.frontend.join(', ')}`,
        `Backend: ${techStack.backend.join(', ')}`,
        `Database: ${techStack.database.join(', ')}`,
        `Infrastructure: ${techStack.infrastructure.join(', ')}`
      ],
      status: 'accepted'
    });

    // Data architecture decision
    const dataDecision = this.analyzeDataRequirements(spec);
    if (dataDecision) {
      decisions.push(dataDecision);
    }

    // Integration architecture
    const integrationDecision = this.analyzeIntegrationRequirements(spec);
    if (integrationDecision) {
      decisions.push(integrationDecision);
    }

    return decisions;
  }

  private async designComponents(
    spec: SpecificationDocument, 
    architecturalDecisions: ArchitecturalDecision[]
  ): Promise<ComponentSpec[]> {
    const components: ComponentSpec[] = [];

    // Group requirements by functional domain
    const domainGroups = this.groupRequirementsByDomain(spec.requirements);

    // Create components for each domain
    for (const [domain, requirements] of domainGroups.entries()) {
      const component = await this.createComponent(domain, requirements, architecturalDecisions);
      components.push(component);
    }

    // Add cross-cutting components
    const crossCuttingComponents = await this.createCrossCuttingComponents(spec, architecturalDecisions);
    components.push(...crossCuttingComponents);

    // Add integration components if needed
    const integrationComponents = await this.createIntegrationComponents(spec);
    components.push(...integrationComponents);

    return components;
  }

  private async createComponent(
    domain: string, 
    requirements: any[], 
    architecturalDecisions: ArchitecturalDecision[]
  ): Promise<ComponentSpec> {
    const interfaces = this.designComponentInterfaces(requirements);
    const dependencies = this.identifyComponentDependencies(requirements, domain);
    const complexity = this.assessComponentComplexity(requirements);
    const effort = this.estimateEffort(requirements, complexity);

    return {
      id: `comp-${domain.toLowerCase().replace(/\s+/g, '-')}`,
      name: `${domain} Service`,
      type: this.determineComponentType(requirements),
      description: `Handles ${domain.toLowerCase()} functionality`,
      interfaces,
      dependencies,
      estimatedEffort: effort,
      complexity
    };
  }

  private async createCrossCuttingComponents(
    spec: SpecificationDocument,
    architecturalDecisions: ArchitecturalDecision[]
  ): Promise<ComponentSpec[]> {
    const components: ComponentSpec[] = [];

    // Security component
    if (this.requiresSecurityComponent(spec)) {
      components.push({
        id: 'comp-security',
        name: 'Security Service',
        type: 'service',
        description: 'Handles authentication, authorization, and security policies',
        interfaces: [
          {
            name: 'AuthenticationAPI',
            type: 'rest',
            schema: { endpoints: ['/login', '/logout', '/validate'] },
            documentation: 'Authentication service API'
          }
        ],
        dependencies: ['database', 'logging'],
        estimatedEffort: 40,
        complexity: 'high'
      });
    }

    // Logging and monitoring component
    components.push({
      id: 'comp-monitoring',
      name: 'Monitoring Service',
      type: 'service',
      description: 'System monitoring, logging, and observability',
      interfaces: [
        {
          name: 'MetricsAPI',
          type: 'rest',
          schema: { endpoints: ['/metrics', '/health'] },
          documentation: 'System metrics and health checks'
        }
      ],
      dependencies: ['infrastructure'],
      estimatedEffort: 24,
      complexity: 'medium'
    });

    return components;
  }

  private async createIntegrationComponents(spec: SpecificationDocument): Promise<ComponentSpec[]> {
    const components: ComponentSpec[] = [];

    // Check for external system integrations
    const integrationReqs = spec.requirements.filter(req =>
      req.description.toLowerCase().includes('integration') ||
      req.description.toLowerCase().includes('external') ||
      req.description.toLowerCase().includes('third-party')
    );

    if (integrationReqs.length > 0) {
      components.push({
        id: 'comp-integration',
        name: 'Integration Gateway',
        type: 'service',
        description: 'Manages external system integrations and API gateway functionality',
        interfaces: [
          {
            name: 'GatewayAPI',
            type: 'rest',
            schema: { endpoints: ['/gateway/*', '/webhooks/*'] },
            documentation: 'API gateway and integration endpoints'
          }
        ],
        dependencies: ['security', 'monitoring'],
        estimatedEffort: 32,
        complexity: 'high'
      });
    }

    return components;
  }

  private async mapDependencies(
    components: ComponentSpec[],
    spec: SpecificationDocument
  ): Promise<DependencySpec[]> {
    const dependencies: DependencySpec[] = [];

    // Internal dependencies (between components)
    for (const component of components) {
      for (const depName of component.dependencies) {
        const dependentComponent = components.find(c => 
          c.name.toLowerCase().includes(depName.toLowerCase())
        );

        if (dependentComponent) {
          dependencies.push({
            name: `${component.name} -> ${dependentComponent.name}`,
            version: '1.0.0',
            type: 'internal',
            critical: true,
            alternatives: []
          });
        }
      }
    }

    // External dependencies (libraries, services, etc.)
    const techStack = this.config.technologyStack;
    
    // Add technology stack dependencies
    [...techStack.frontend, ...techStack.backend, ...techStack.database].forEach(tech => {
      dependencies.push({
        name: tech,
        version: 'latest',
        type: 'external',
        critical: true,
        alternatives: this.getAlternativeTechnologies(tech)
      });
    });

    return dependencies;
  }

  private async generateTimeline(
    components: ComponentSpec[],
    dependencies: DependencySpec[]
  ): Promise<Milestone[]> {
    const milestones: Milestone[] = [];
    const startDate = new Date();

    // Sort components by dependencies and complexity
    const sortedComponents = this.sortComponentsByDependencies(components);

    let currentDate = new Date(startDate);
    let week = 0;

    // Phase 1: Foundation (infrastructure and core components)
    const foundationComponents = sortedComponents.filter(c => 
      c.type === 'service' && (c.name.includes('Security') || c.name.includes('Monitoring'))
    );

    if (foundationComponents.length > 0) {
      week += 2;
      milestones.push({
        id: 'milestone-foundation',
        name: 'Foundation Phase',
        description: 'Core infrastructure and security components',
        dueDate: new Date(currentDate.getTime() + week * 7 * 24 * 60 * 60 * 1000),
        deliverables: foundationComponents.map(c => c.name),
        dependencies: []
      });
    }

    // Phase 2: Core Business Logic
    const businessComponents = sortedComponents.filter(c => 
      c.type === 'service' && !foundationComponents.includes(c) && c.complexity !== 'low'
    );

    if (businessComponents.length > 0) {
      week += 4;
      milestones.push({
        id: 'milestone-core',
        name: 'Core Business Logic',
        description: 'Main business functionality components',
        dueDate: new Date(currentDate.getTime() + week * 7 * 24 * 60 * 60 * 1000),
        deliverables: businessComponents.map(c => c.name),
        dependencies: ['milestone-foundation']
      });
    }

    // Phase 3: Integration and UI
    const integrationComponents = sortedComponents.filter(c => 
      c.name.includes('Integration') || c.type === 'ui'
    );

    week += 3;
    milestones.push({
      id: 'milestone-integration',
      name: 'Integration & User Interface',
      description: 'External integrations and user interface components',
      dueDate: new Date(currentDate.getTime() + week * 7 * 24 * 60 * 60 * 1000),
      deliverables: integrationComponents.map(c => c.name),
      dependencies: ['milestone-core']
    });

    // Phase 4: Testing and Deployment
    week += 2;
    milestones.push({
      id: 'milestone-deployment',
      name: 'Testing & Deployment',
      description: 'System testing, performance optimization, and production deployment',
      dueDate: new Date(currentDate.getTime() + week * 7 * 24 * 60 * 60 * 1000),
      deliverables: ['Integration Tests', 'Performance Tests', 'Production Deployment'],
      dependencies: ['milestone-integration']
    });

    return milestones;
  }

  private async assessRisks(
    spec: SpecificationDocument,
    components: ComponentSpec[],
    dependencies: DependencySpec[]
  ): Promise<RiskAssessment[]> {
    const risks: RiskAssessment[] = [];

    // Technical complexity risks
    const highComplexityComponents = components.filter(c => c.complexity === 'high');
    if (highComplexityComponents.length > 0) {
      risks.push({
        id: 'risk-complexity',
        description: `${highComplexityComponents.length} high-complexity components may cause delays`,
        probability: 'medium',
        impact: 'high',
        mitigation: 'Break down complex components, add extra time buffer, assign experienced developers',
        owner: 'Tech Lead'
      });
    }

    // Dependency risks
    const externalDeps = dependencies.filter(d => d.type === 'external');
    if (externalDeps.length > 10) {
      risks.push({
        id: 'risk-dependencies',
        description: 'High number of external dependencies may cause integration issues',
        probability: 'medium',
        impact: 'medium',
        mitigation: 'Identify alternatives, implement dependency isolation, regular dependency updates',
        owner: 'DevOps Lead'
      });
    }

    // Performance risks
    const perfRequirements = spec.requirements.filter(r => 
      r.type === 'non-functional' && 
      r.description.toLowerCase().includes('performance')
    );

    if (perfRequirements.length > 0) {
      risks.push({
        id: 'risk-performance',
        description: 'Performance requirements may not be met without proper optimization',
        probability: 'medium',
        impact: 'high',
        mitigation: 'Early performance testing, profiling, scalable architecture design',
        owner: 'Performance Engineer'
      });
    }

    // Security risks
    const securityRequirements = spec.requirements.filter(r =>
      r.description.toLowerCase().includes('security') ||
      r.description.toLowerCase().includes('authentication')
    );

    if (securityRequirements.length > 0) {
      risks.push({
        id: 'risk-security',
        description: 'Security implementation complexity may introduce vulnerabilities',
        probability: 'low',
        impact: 'high',
        mitigation: 'Security review, penetration testing, follow security best practices',
        owner: 'Security Lead'
      });
    }

    // Timeline risks
    const totalEffort = components.reduce((sum, c) => sum + c.estimatedEffort, 0);
    if (totalEffort > 200) {
      risks.push({
        id: 'risk-timeline',
        description: 'Large project scope may lead to timeline overruns',
        probability: 'high',
        impact: 'medium',
        mitigation: 'Agile methodology, regular progress reviews, scope management',
        owner: 'Project Manager'
      });
    }

    return risks;
  }

  // Helper methods
  private determineSystemType(requirements: any[]): string {
    const apiRequirements = requirements.filter(r => 
      r.description.toLowerCase().includes('api') || 
      r.description.toLowerCase().includes('service')
    );

    const uiRequirements = requirements.filter(r =>
      r.description.toLowerCase().includes('user interface') ||
      r.description.toLowerCase().includes('web') ||
      r.description.toLowerCase().includes('mobile')
    );

    const dataRequirements = requirements.filter(r =>
      r.description.toLowerCase().includes('data') ||
      r.description.toLowerCase().includes('database')
    );

    if (apiRequirements.length > uiRequirements.length) {
      return 'API-First';
    } else if (uiRequirements.length > 0 && dataRequirements.length > 0) {
      return 'Full-Stack Web Application';
    } else if (dataRequirements.length > requirements.length * 0.5) {
      return 'Data-Driven Application';
    } else {
      return 'Service-Oriented Application';
    }
  }

  private selectArchitecturePattern(systemType: string, nonFunctionalReqs: any[]): ArchitecturePattern {
    const performanceReqs = nonFunctionalReqs.filter(r => 
      r.description.toLowerCase().includes('performance') ||
      r.description.toLowerCase().includes('scalability')
    );

    const patterns = this.config.architecturePatterns;

    if (performanceReqs.length > 0 && systemType.includes('API')) {
      return patterns.find(p => p.name === 'Microservices') || patterns[0];
    } else if (systemType.includes('Full-Stack')) {
      return patterns.find(p => p.name === 'Layered Architecture') || patterns[0];
    } else {
      return patterns.find(p => p.name === 'Modular Monolith') || patterns[0];
    }
  }

  private selectTechnologyStack(pattern: ArchitecturePattern, nonFunctionalReqs: any[]): TechnologyStack {
    // This would typically involve more sophisticated selection logic
    return this.config.technologyStack;
  }

  private groupRequirementsByDomain(requirements: any[]): Map<string, any[]> {
    const domains = new Map<string, any[]>();
    
    // Simple domain detection based on requirement titles and descriptions
    requirements.forEach(req => {
      const text = `${req.title} ${req.description}`.toLowerCase();
      let domain = 'Core';

      if (text.includes('user') || text.includes('account') || text.includes('profile')) {
        domain = 'User Management';
      } else if (text.includes('payment') || text.includes('billing') || text.includes('subscription')) {
        domain = 'Payment';
      } else if (text.includes('notification') || text.includes('email') || text.includes('message')) {
        domain = 'Notification';
      } else if (text.includes('report') || text.includes('analytics') || text.includes('dashboard')) {
        domain = 'Reporting';
      }

      if (!domains.has(domain)) {
        domains.set(domain, []);
      }
      domains.get(domain)!.push(req);
    });

    return domains;
  }

  private updateState(status: WorkflowState['status'], step: string, progress: number): void {
    this.state.status = status;
    this.state.currentStep = step;
    this.state.progress = progress;
    
    if (status === 'completed' || status === 'failed') {
      this.state.endTime = new Date();
    }
  }

  private designComponentInterfaces(requirements: any[]): any[] {
    // Simplified interface design logic
    return [
      {
        name: 'API',
        type: 'rest',
        schema: { endpoints: requirements.map(r => `/${r.title.toLowerCase().replace(/\s+/g, '-')}`) },
        documentation: 'Component API endpoints'
      }
    ];
  }

  private identifyComponentDependencies(requirements: any[], domain: string): string[] {
    const deps: string[] = [];
    
    if (domain !== 'Core') {
      deps.push('database');
    }
    
    if (requirements.some(r => r.description.toLowerCase().includes('security'))) {
      deps.push('security');
    }
    
    return deps;
  }

  private assessComponentComplexity(requirements: any[]): 'low' | 'medium' | 'high' {
    if (requirements.length > 5) return 'high';
    if (requirements.length > 2) return 'medium';
    return 'low';
  }

  private estimateEffort(requirements: any[], complexity: 'low' | 'medium' | 'high'): number {
    const basePoints = requirements.length * 8; // 8 hours per requirement
    const complexityMultiplier = { low: 1, medium: 1.5, high: 2.5 };
    return Math.round(basePoints * complexityMultiplier[complexity]);
  }

  private determineComponentType(requirements: any[]): ComponentSpec['type'] {
    const text = requirements.map(r => `${r.title} ${r.description}`).join(' ').toLowerCase();
    
    if (text.includes('database') || text.includes('data')) return 'database';
    if (text.includes('ui') || text.includes('interface')) return 'ui';
    if (text.includes('integration') || text.includes('external')) return 'integration';
    if (text.includes('library') || text.includes('utility')) return 'library';
    
    return 'service';
  }

  private requiresSecurityComponent(spec: SpecificationDocument): boolean {
    return spec.requirements.some(r => 
      r.description.toLowerCase().includes('authentication') ||
      r.description.toLowerCase().includes('authorization') ||
      r.description.toLowerCase().includes('security')
    );
  }

  private getAlternativeTechnologies(tech: string): string[] {
    const alternatives: Record<string, string[]> = {
      'React': ['Vue.js', 'Angular'],
      'Node.js': ['Python', 'Java'],
      'PostgreSQL': ['MySQL', 'MongoDB'],
      'Express': ['Fastify', 'Koa'],
      'TypeScript': ['JavaScript', 'Flow']
    };
    
    return alternatives[tech] || [];
  }

  private sortComponentsByDependencies(components: ComponentSpec[]): ComponentSpec[] {
    // Topological sort based on dependencies
    const sorted: ComponentSpec[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (component: ComponentSpec) => {
      if (visiting.has(component.id)) {
        // Circular dependency - add to end
        return;
      }
      if (visited.has(component.id)) {
        return;
      }

      visiting.add(component.id);
      
      // Visit dependencies first
      for (const depName of component.dependencies) {
        const depComponent = components.find(c => 
          c.name.toLowerCase().includes(depName.toLowerCase())
        );
        if (depComponent) {
          visit(depComponent);
        }
      }

      visiting.delete(component.id);
      visited.add(component.id);
      sorted.push(component);
    };

    components.forEach(visit);
    return sorted;
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  // Static factory methods for common configurations
  static createWebApplicationConfig(): PlanGenerationConfig {
    return {
      id: 'web-app-planner',
      name: 'Web Application Planner',
      description: 'Generates plans for web applications',
      version: '1.0.0',
      timeout: 300000, // 5 minutes
      retryCount: 2,
      parallel: true,
      dependencies: [],
      architecturePatterns: [
        {
          name: 'Layered Architecture',
          description: 'Traditional layered architecture with presentation, business, and data layers',
          applicability: ['Web Applications', 'CRUD Applications'],
          pros: ['Simple', 'Well-understood', 'Easy to maintain'],
          cons: ['Can become monolithic', 'Tight coupling between layers'],
          components: ['Presentation Layer', 'Business Layer', 'Data Layer']
        },
        {
          name: 'Microservices',
          description: 'Distributed architecture with independent services',
          applicability: ['Large Applications', 'High Scalability Requirements'],
          pros: ['Scalable', 'Independent deployment', 'Technology diversity'],
          cons: ['Complex', 'Network overhead', 'Distributed system challenges'],
          components: ['API Gateway', 'Services', 'Service Discovery', 'Database per Service']
        }
      ],
      technologyStack: {
        frontend: ['React', 'TypeScript', 'Vite'],
        backend: ['Node.js', 'Express', 'TypeScript'],
        database: ['PostgreSQL', 'Redis'],
        infrastructure: ['Docker', 'AWS', 'Nginx'],
        tools: ['Jest', 'ESLint', 'Prettier']
      },
      estimationModel: {
        baseComplexityPoints: {
          'low': 8,
          'medium': 16,
          'high': 32
        },
        multipliers: {
          'security': 1.5,
          'performance': 1.3,
          'integration': 1.4
        },
        bufferPercentage: 20
      },
      riskThreshold: 0.7
    };
  }
}