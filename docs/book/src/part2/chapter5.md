# Chapter 5: Code Generation and Template Systems

## Learning Objectives

By the end of this chapter, you will understand:
- Modern code generation approaches and template systems
- How AI enhances traditional template-based development
- The role of template systems in specification-driven development
- Implementation patterns for AI-powered code generation

## Introduction

Code generation and template systems form the backbone of modern AI-assisted development. This chapter explores how traditional template systems have evolved with AI integration, using the Unjucks v2 refactor as a primary case study to demonstrate these concepts in practice.

## Evolution of Code Generation

### Traditional Code Generation

#### Static Templates
- Fixed template structures
- Simple variable substitution
- Limited logic capabilities
- Manual template maintenance

#### Template Engines
- Handlebars, Mustache, Nunjucks
- Conditional rendering and loops
- Helper functions and filters
- Partial template support

#### Code Scaffolding Tools
- Yeoman generators
- Angular CLI
- Create React App
- Rails generators

### AI-Enhanced Code Generation

#### Intelligent Templates
- Context-aware generation
- Dynamic template selection
- AI-optimized output
- Adaptive template evolution

#### Natural Language Interfaces
- Plain English to code generation
- Specification-driven templates
- Intent-based code creation
- Context-preserving generation

#### Multi-Modal Generation
- Code, documentation, and tests together
- Integrated asset generation
- Cross-language template coordination
- Full-stack application generation

## Modern Template System Architecture

### Core Components

#### Template Engine
```typescript
interface TemplateEngine {
    render(template: string, data: object): string;
    registerHelper(name: string, fn: Function): void;
    registerPartial(name: string, template: string): void;
    compile(template: string): CompiledTemplate;
}
```

#### Context Provider
```typescript
interface ContextProvider {
    getContext(request: GenerationRequest): Promise<Context>;
    validateContext(context: Context): ValidationResult;
    enrichContext(context: Context): Promise<EnrichedContext>;
}
```

#### Output Processor
```typescript
interface OutputProcessor {
    process(output: GeneratedCode): ProcessedOutput;
    validate(output: ProcessedOutput): ValidationResult;
    optimize(output: ProcessedOutput): OptimizedOutput;
}
```

### Template System Patterns

#### File-Based Templates
```
templates/
├── component/
│   ├── index.ts.njk
│   ├── component.tsx.njk
│   └── component.test.tsx.njk
├── service/
│   ├── service.ts.njk
│   └── service.test.ts.njk
└── helpers/
    ├── string-helpers.js
    └── type-helpers.js
```

#### Configuration-Driven Generation
```yaml
# Generator configuration
generators:
  component:
    description: "Generate React component with tests"
    prompts:
      - name: componentName
        type: string
        required: true
      - name: withProps
        type: boolean
        default: false
    actions:
      - type: add
        path: "src/components/{{pascalCase componentName}}/index.ts"
        template: "templates/component/index.ts.njk"
```

#### AI-Integrated Templates
```javascript
// AI-enhanced template processing
const aiTemplate = {
    template: "Create a {{componentType}} component named {{name}}",
    aiEnhancement: {
        contextAnalysis: true,
        codeOptimization: true,
        testGeneration: true,
        documentationGeneration: true
    }
};
```

## Unjucks v2: Modern Template System Design

### Architecture Overview

Unjucks v2 represents a modern approach to template-based code generation, combining traditional template engine capabilities with AI-assisted enhancement and multi-agent coordination.

#### Core Design Principles
1. **Simplicity**: Minimal configuration, maximum output
2. **Flexibility**: Support for diverse project structures
3. **AI Integration**: Seamless AI assistance throughout generation
4. **Performance**: Fast template processing and generation
5. **Extensibility**: Plugin architecture for custom functionality

### Template Structure

#### Frontmatter-Driven Templates
```yaml
---
to: src/components/{{ pascalCase name }}/index.ts
inject: true
after: "// Component exports"
skip_if: "export { {{ pascalCase name }} }"
---
export { {{ pascalCase name }} } from './{{ pascalCase name }}';
export type { {{ pascalCase name }}Props } from './{{ pascalCase name }}';
```

#### Dynamic Path Generation
```javascript
// AI-assisted path resolution
const generatePath = async (template, context) => {
    const aiSuggestion = await ai.suggestPath({
        template: template.to,
        context: context,
        projectStructure: await analyzeProject()
    });
    
    return aiSuggestion.optimizedPath;
};
```

#### Conditional Generation
```yaml
---
to: src/{{ kebabCase name }}/{{ if withTests }}__tests__/{{ endif }}{{ kebabCase name }}.test.ts
skip_if: "{{ unless withTests }}true{{ endunless }}"
---
```

### AI Enhancement Features

#### Context-Aware Generation
```typescript
class AIContextProvider implements ContextProvider {
    async getContext(request: GenerationRequest): Promise<Context> {
        const baseContext = await super.getContext(request);
        const aiEnhancement = await this.aiService.analyzeContext({
            projectType: baseContext.projectType,
            existingCode: baseContext.codebase,
            userIntent: request.description
        });
        
        return {
            ...baseContext,
            ...aiEnhancement,
            suggestions: aiEnhancement.optimizations
        };
    }
}
```

#### Intelligent Template Selection
```typescript
class TemplateSelector {
    async selectOptimalTemplate(request: GenerationRequest): Promise<Template> {
        const candidates = await this.findCandidateTemplates(request);
        const analysis = await this.aiService.analyzeTemplates({
            candidates,
            context: request.context,
            requirements: request.requirements
        });
        
        return analysis.recommendedTemplate;
    }
}
```

#### Dynamic Content Generation
```javascript
// AI-generated template content
const generateTemplateContent = async (specification) => {
    const aiGenerated = await ai.generateCode({
        specification: specification,
        templateType: 'component',
        framework: 'react',
        typescript: true
    });
    
    return {
        code: aiGenerated.implementation,
        tests: aiGenerated.tests,
        documentation: aiGenerated.docs
    };
};
```

## Implementation Patterns

### Template Discovery and Indexing

#### Automatic Template Discovery
```typescript
class TemplateIndexer {
    async indexTemplates(directory: string): Promise<TemplateIndex> {
        const templates = await this.scanDirectory(directory);
        const indexed = await Promise.all(
            templates.map(template => this.analyzeTemplate(template))
        );
        
        return new TemplateIndex(indexed);
    }
    
    private async analyzeTemplate(template: Template): Promise<IndexedTemplate> {
        const metadata = await this.extractMetadata(template);
        const dependencies = await this.analyzeDependencies(template);
        const aiAnalysis = await this.aiService.analyzeTemplate(template);
        
        return {
            ...template,
            metadata,
            dependencies,
            aiInsights: aiAnalysis
        };
    }
}
```

#### Template Categorization
```typescript
interface TemplateCategory {
    name: string;
    description: string;
    templates: Template[];
    aiRecommendations: Recommendation[];
}

const categories: TemplateCategory[] = [
    {
        name: 'components',
        description: 'React/Vue component generators',
        templates: [...componentTemplates],
        aiRecommendations: await ai.getRecommendations('components')
    },
    {
        name: 'services',
        description: 'Backend service generators', 
        templates: [...serviceTemplates],
        aiRecommendations: await ai.getRecommendations('services')
    }
];
```

### Variable Extraction and Processing

#### AI-Assisted Variable Detection
```typescript
class VariableExtractor {
    async extractVariables(template: Template): Promise<Variable[]> {
        const staticVariables = this.extractStaticVariables(template);
        const dynamicVariables = await this.aiService.inferVariables({
            templateContent: template.content,
            templateType: template.type,
            context: template.metadata
        });
        
        return this.mergeVariables(staticVariables, dynamicVariables);
    }
    
    private extractStaticVariables(template: Template): Variable[] {
        // Extract {{ variable }} patterns
        const regex = /\{\{\s*(\w+)\s*\}\}/g;
        const matches = [...template.content.matchAll(regex)];
        return matches.map(match => ({ name: match[1], type: 'string' }));
    }
}
```

#### Dynamic CLI Generation
```typescript
class CLIGenerator {
    async generateCLI(variables: Variable[]): Promise<CLIConfiguration> {
        const prompts = await Promise.all(
            variables.map(variable => this.generatePrompt(variable))
        );
        
        return {
            prompts,
            validation: await this.generateValidation(variables),
            help: await this.generateHelp(variables)
        };
    }
    
    private async generatePrompt(variable: Variable): Promise<Prompt> {
        const aiSuggestion = await this.aiService.suggestPrompt({
            variableName: variable.name,
            variableType: variable.type,
            context: variable.context
        });
        
        return {
            name: variable.name,
            type: aiSuggestion.inputType,
            message: aiSuggestion.promptMessage,
            validation: aiSuggestion.validation
        };
    }
}
```

### File Injection and Modification

#### Intelligent File Injection
```typescript
class FileInjector {
    async inject(target: string, content: string, options: InjectionOptions): Promise<void> {
        const existingContent = await fs.readFile(target, 'utf-8');
        const aiAnalysis = await this.aiService.analyzeInjection({
            existingContent,
            newContent: content,
            injectionPoint: options.after || options.before,
            skipCondition: options.skipIf
        });
        
        if (aiAnalysis.shouldSkip) {
            console.log(`Skipping injection: ${aiAnalysis.reason}`);
            return;
        }
        
        const injectedContent = await this.performInjection(
            existingContent,
            content,
            aiAnalysis.optimizedOptions
        );
        
        await fs.writeFile(target, injectedContent);
    }
}
```

#### Smart Conflict Resolution
```typescript
class ConflictResolver {
    async resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]> {
        return await Promise.all(
            conflicts.map(conflict => this.resolveConflict(conflict))
        );
    }
    
    private async resolveConflict(conflict: Conflict): Promise<Resolution> {
        const aiResolution = await this.aiService.resolveConflict({
            conflictType: conflict.type,
            existingCode: conflict.existing,
            newCode: conflict.new,
            context: conflict.context
        });
        
        return {
            action: aiResolution.recommendedAction,
            mergedCode: aiResolution.mergedResult,
            explanation: aiResolution.reasoning
        };
    }
}
```

## Multi-Agent Template Processing

### Agent Coordination for Template Generation

#### Template Processing Pipeline
```typescript
class TemplateProcessingPipeline {
    async process(request: GenerationRequest): Promise<GenerationResult> {
        // Spawn specialized agents for different aspects
        const agents = await this.spawnAgents([
            { type: 'template-selector', task: 'Select optimal template' },
            { type: 'context-analyzer', task: 'Analyze generation context' },
            { type: 'code-generator', task: 'Generate code from template' },
            { type: 'quality-validator', task: 'Validate generated output' }
        ]);
        
        // Coordinate agent execution
        const results = await this.coordinateAgents(agents, request);
        
        return this.consolidateResults(results);
    }
}
```

#### Parallel Template Processing
```typescript
// Multiple templates processed simultaneously
const processTemplateSet = async (templates: Template[], context: Context) => {
    return await Promise.all(templates.map(template => 
        processTemplate(template, context)
    ));
};

const processTemplate = async (template: Template, context: Context) => {
    const [analysis, generation, validation] = await Promise.all([
        analyzeTemplate(template),
        generateCode(template, context),
        validateOutput(template, context)
    ]);
    
    return { template, analysis, generation, validation };
};
```

### Quality Assurance and Validation

#### AI-Powered Code Review
```typescript
class CodeReviewAgent {
    async reviewGeneratedCode(code: GeneratedCode): Promise<ReviewResult> {
        const analysis = await this.aiService.reviewCode({
            code: code.content,
            language: code.language,
            framework: code.framework,
            standards: code.codingStandards
        });
        
        return {
            quality: analysis.qualityScore,
            issues: analysis.identifiedIssues,
            suggestions: analysis.improvements,
            approved: analysis.meetsStandards
        };
    }
}
```

#### Automated Testing Generation
```typescript
class TestGenerationAgent {
    async generateTests(code: GeneratedCode): Promise<TestSuite> {
        const testStrategy = await this.aiService.planTests({
            sourceCode: code.content,
            componentType: code.type,
            framework: code.testFramework
        });
        
        const tests = await this.aiService.generateTests({
            strategy: testStrategy,
            sourceCode: code.content,
            testTypes: ['unit', 'integration', 'snapshot']
        });
        
        return {
            unitTests: tests.unit,
            integrationTests: tests.integration,
            snapshotTests: tests.snapshot,
            coverage: tests.expectedCoverage
        };
    }
}
```

## Integration with SPARC Methodology

### Specification Phase Integration

#### Requirements to Template Mapping
```typescript
class SpecificationMapper {
    async mapToTemplates(specification: Specification): Promise<TemplateMapping[]> {
        const analysis = await this.aiService.analyzeSpecification({
            requirements: specification.requirements,
            constraints: specification.constraints,
            preferences: specification.preferences
        });
        
        return analysis.recommendedTemplates.map(template => ({
            template,
            relevance: template.relevanceScore,
            adaptations: template.suggestedAdaptations
        }));
    }
}
```

### Implementation Phase Integration

#### Template-Driven Development Workflow
```typescript
const implementationWorkflow = async (specification: Specification) => {
    // Phase 1: Template Selection and Adaptation
    const templates = await selectTemplates(specification);
    const adaptedTemplates = await adaptTemplates(templates, specification);
    
    // Phase 2: Context Generation and Enrichment
    const context = await generateContext(specification);
    const enrichedContext = await enrichContext(context);
    
    // Phase 3: Coordinated Code Generation
    const agents = await spawnGenerationAgents(adaptedTemplates);
    const generated = await coordinateGeneration(agents, enrichedContext);
    
    // Phase 4: Quality Validation and Integration
    const validated = await validateGenerated(generated);
    const integrated = await integrateCode(validated);
    
    return integrated;
};
```

## Performance and Optimization

### Template Caching Strategies

#### Smart Caching
```typescript
class TemplateCache {
    private cache = new Map<string, CachedTemplate>();
    
    async getTemplate(id: string): Promise<Template> {
        const cached = this.cache.get(id);
        if (cached && !this.isExpired(cached)) {
            return cached.template;
        }
        
        const template = await this.loadTemplate(id);
        const enhanced = await this.aiService.enhanceTemplate(template);
        
        this.cache.set(id, {
            template: enhanced,
            timestamp: Date.now(),
            hitCount: (cached?.hitCount || 0) + 1
        });
        
        return enhanced;
    }
}
```

#### Generation Optimization
```typescript
class GenerationOptimizer {
    async optimize(generation: GenerationPlan): Promise<OptimizedPlan> {
        const analysis = await this.aiService.analyzePlan({
            templates: generation.templates,
            dependencies: generation.dependencies,
            parallelizationOpportunities: generation.parallelizable
        });
        
        return {
            ...generation,
            executionOrder: analysis.optimizedOrder,
            parallelGroups: analysis.parallelGroups,
            resourceAllocation: analysis.resourceNeeds
        };
    }
}
```

## Case Study: Unjucks v2 Implementation

### Architecture Decisions

#### Template Engine Choice
- Nunjucks for powerful template processing
- Custom frontmatter parser for metadata
- Plugin architecture for extensibility
- AI integration hooks throughout pipeline

#### File Organization Strategy
```
templates/
├── _templates/          # User template directory
│   ├── component/       # Component generators
│   ├── service/        # Service generators
│   └── full-stack/     # Full application generators
├── core/               # Core template processing
├── ai/                 # AI integration modules
└── plugins/           # Extension plugins
```

### Implementation Highlights

#### AI-Enhanced Template Discovery
```typescript
// Unjucks v2 template discovery
const discoverTemplates = async (directory: string) => {
    const discovered = await scanTemplateDirectory(directory);
    const analyzed = await Promise.all(
        discovered.map(template => analyzeWithAI(template))
    );
    
    return buildTemplateIndex(analyzed);
};
```

#### Dynamic CLI Generation
```typescript
// AI-generated command line interface
const generateCLI = async (templates: Template[]) => {
    const commands = await Promise.all(
        templates.map(template => generateCommand(template))
    );
    
    return buildCLIInterface(commands);
};
```

### Results and Metrics

#### Performance Improvements
- 5x faster template processing through caching
- 3x reduction in configuration overhead
- 90% reduction in boilerplate template code
- 2x improvement in generation accuracy

#### Developer Experience Enhancements
- Natural language template descriptions
- Automatic CLI generation from templates
- Intelligent conflict resolution
- Comprehensive error reporting with suggestions

## Summary

Code generation and template systems have evolved significantly with AI integration, moving from static template processing to intelligent, context-aware code generation. The combination of traditional template engine capabilities with AI assistance creates powerful development tools that can significantly accelerate development while maintaining high quality standards.

The Unjucks v2 case study demonstrates how modern template systems can integrate AI assistance throughout the generation pipeline, from template discovery and selection to code generation and validation.

## Key Takeaways

- AI enhances traditional template systems with intelligent context analysis
- Multi-agent coordination enables sophisticated code generation workflows
- Template systems serve as effective bridges between specifications and implementation
- Performance optimization remains crucial for practical template system adoption
- Quality assurance and validation are essential components of AI-assisted generation

## Discussion Questions

1. How can template systems balance flexibility with ease of use when integrating AI assistance?
2. What are the key considerations for maintaining template system performance as AI integration increases?
3. How might template systems evolve to better support collaborative development workflows?

## Further Reading

- Template engine documentation and best practices
- AI code generation research and case studies
- Performance optimization techniques for template systems
- Multi-agent coordination patterns in software development