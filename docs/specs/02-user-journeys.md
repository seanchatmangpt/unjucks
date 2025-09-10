# User Journey Specifications

## 2. User Journeys

### 2.1 First-Time User Journey

#### 2.1.1 Discovery & Installation Journey

**Context**: A JavaScript developer discovers Unjucks and evaluates it for their development workflow.

**Journey Steps**:

1. **Discovery Phase**
   - User finds Unjucks through npm search, GitHub, or word-of-mouth
   - Reviews README.md to understand core value proposition
   - Evaluates feature set against current workflow pain points
   - **Expected Outcome**: Clear understanding of benefits vs. alternatives (Hygen, Plop, etc.)
   - **Pain Points**: Unclear differentiation from existing tools
   - **User Emotions**: Curious but skeptical, needs convincing evidence

2. **Installation Phase**
   ```bash
   # Auto-detect package manager
   npx nypm install unjucks
   
   # Or manual installation
   npm install -g unjucks
   ```
   - User installs via preferred method
   - Verifies installation with `unjucks --version`
   - **Expected Outcome**: Clean installation without dependency conflicts
   - **Pain Points**: Node version compatibility, global vs local installation confusion
   - **User Emotions**: Hopeful but cautious about adding new tooling

3. **Initial Exploration**
   ```bash
   unjucks --help
   unjucks list  # Shows empty or example generators
   ```
   - User explores available commands
   - Discovers no generators exist in current project
   - **Expected Outcome**: Clear guidance on next steps
   - **Pain Points**: Empty state provides no immediate value
   - **User Emotions**: Slightly disappointed, needs clear next steps

#### 2.1.2 First Generation Experience

4. **Project Setup**
   ```bash
   unjucks init
   ```
   - Interactive prompts guide project type selection
   - Creates `_templates` directory with example generators
   - Generates `unjucks.yml` configuration file
   - **Expected Outcome**: Working examples ready to modify
   - **Pain Points**: Generic examples may not match user's technology stack
   - **User Emotions**: Encouraged by working examples

5. **First Template Generation**
   ```bash
   unjucks list  # Shows available generators
   unjucks generate component react --name="MyButton"
   ```
   - User selects familiar generator (component)
   - Provides component name
   - Observes file generation with clear output
   - **Expected Outcome**: Generated files match expectations and compile correctly
   - **Pain Points**: Template variables may be confusing, generated code style mismatch
   - **User Emotions**: Excited by immediate results, concerned about code quality

6. **Validation & Customization**
   - User examines generated files
   - Tests compilation and functionality
   - Modifies templates to match coding standards
   - Re-runs generation to validate changes
   - **Expected Outcome**: Templates produce production-ready code
   - **Pain Points**: Complex Nunjucks syntax, unclear variable scoping
   - **User Emotions**: Satisfied with customizability, frustrated by learning curve

#### 2.1.3 Integration Decision

7. **Workflow Integration**
   - User experiments with different generators
   - Tests dry-run mode for safety
   - Shares generated code with team for feedback
   - **Expected Outcome**: Demonstrates clear productivity gains
   - **Pain Points**: Team resistance to new tooling, inconsistent results
   - **User Emotions**: Confident in tool value, concerned about team adoption

**Success Metrics**:
- Time-to-first-generation: <10 minutes from installation
- Template customization: User successfully modifies template within 30 minutes
- Code compilation: Generated code compiles without errors 95% of time
- Satisfaction score: 8/10 after first session

### 2.2 Template Developer Journey

#### 2.2.1 Advanced Template Creation

**Context**: An experienced developer creates custom templates for team use.

**Journey Steps**:

1. **Template Planning**
   - Analyzes existing code patterns in project
   - Identifies repetitive structures worth templating
   - Plans variable structure and conditional logic
   - **Expected Outcome**: Clear template specification document
   - **Pain Points**: Complex conditional requirements, variable interdependencies
   - **User Emotions**: Confident in technical approach, overwhelmed by complexity

2. **Generator Structure Setup**
   ```bash
   mkdir -p _templates/api-service/express
   ```
   - Creates logical generator hierarchy
   - Plans multiple templates per generator
   - Designs reusable configuration patterns
   - **Expected Outcome**: Scalable template organization
   - **Pain Points**: Directory naming conventions, template discovery
   - **User Emotions**: Methodical and organized

3. **Template Development**
   ```yaml
   # config.yml
   name: api-service
   description: Generate Express.js API services with TypeScript
   templates:
     - name: express
       description: Full Express service with routes, controllers, tests
       files:
         - "{{ serviceName | pascalCase }}Controller.ts"
         - "{{ serviceName | kebabCase }}.routes.ts"
         - "{{ serviceName | pascalCase }}.test.ts"
       prompts:
         - name: serviceName
           message: "Service name:"
           type: input
         - name: withAuth
           message: "Include authentication?"
           type: confirm
         - name: databaseType
           message: "Database type:"
           type: list
           choices: ["mongodb", "postgresql", "mysql"]
   ```
   - Writes comprehensive template configuration
   - Implements complex Nunjucks templates with conditionals
   - Uses advanced features (template inheritance, custom filters)
   - **Expected Outcome**: Robust templates handling edge cases
   - **Pain Points**: Nunjucks syntax complexity, debugging template errors
   - **User Emotions**: Focused and methodical, occasionally frustrated by syntax

4. **Template Testing & Iteration**
   ```bash
   unjucks generate api-service express --serviceName="User" --dry
   unjucks generate api-service express --serviceName="User" --withAuth=true
   ```
   - Tests templates with various input combinations
   - Uses dry-run mode extensively for validation
   - Iterates on template content and structure
   - **Expected Outcome**: Templates produce consistent, high-quality code
   - **Pain Points**: Debugging complex template logic, testing edge cases
   - **User Emotions**: Satisfied with robustness, proud of technical achievement

#### 2.2.2 Team Distribution

5. **Documentation Creation**
   - Creates README for template usage
   - Documents variable options and examples
   - Provides troubleshooting guide
   - **Expected Outcome**: Self-service template usage by team
   - **Pain Points**: Keeping documentation current, comprehensive variable documentation
   - **User Emotions**: Responsible for team success, concerned about maintenance

6. **Team Training**
   - Demonstrates template usage in team meeting
   - Provides hands-on workshop
   - Establishes template contribution guidelines
   - **Expected Outcome**: Team adopts templates consistently
   - **Pain Points**: Varying skill levels, resistance to new patterns
   - **User Emotions**: Evangelist for productivity, patient with adoption curve

**Success Metrics**:
- Template development time: 2-4 hours for complex template
- Template usage adoption: 80% of team uses templates within 2 weeks
- Code consistency: 95% adherence to patterns when using templates
- Maintenance overhead: <10% of development time

### 2.3 Team Lead Journey

#### 2.3.1 Standardization Implementation

**Context**: A team lead implements Unjucks to enforce coding standards and accelerate development.

**Journey Steps**:

1. **Standards Analysis**
   - Reviews existing code quality issues
   - Identifies inconsistency patterns across team
   - Maps current manual processes that could be templated
   - **Expected Outcome**: Clear ROI case for template adoption
   - **Pain Points**: Quantifying current inefficiencies, stakeholder buy-in
   - **User Emotions**: Strategic and analytical, pressured by delivery timelines

2. **Template Strategy Design**
   - Plans template hierarchy aligned with architecture
   - Defines mandatory vs. optional templates
   - Establishes template governance process
   - **Expected Outcome**: Comprehensive template strategy document
   - **Pain Points**: Balancing standardization with developer flexibility
   - **User Emotions**: Responsible for team productivity, concerned about developer satisfaction

3. **Pilot Implementation**
   ```bash
   # Create core templates for common patterns
   unjucks init
   # Customize for organization standards
   # Test with subset of team
   ```
   - Implements core templates for most common patterns
   - Runs pilot with experienced developers
   - Measures productivity impact
   - **Expected Outcome**: Demonstrated productivity gains with pilot group
   - **Pain Points**: Pilot selection bias, limited pattern coverage
   - **User Emotions**: Optimistic but cautious, gathering evidence

4. **Team Rollout**
   - Conducts training sessions
   - Provides template usage guidelines
   - Establishes code review integration
   - **Expected Outcome**: Team-wide adoption with maintained code quality
   - **Pain Points**: Training overhead, inconsistent adoption, resistance to change
   - **User Emotions**: Confident in long-term benefits, stressed by adoption challenges

#### 2.3.2 Governance & Maintenance

5. **Template Versioning**
   - Establishes template update procedures
   - Implements backward compatibility considerations
   - Creates template changelog process
   - **Expected Outcome**: Stable template evolution without breaking changes
   - **Pain Points**: Version conflicts, migration complexity
   - **User Emotions**: Cautious about changes, responsible for stability

6. **Quality Assurance**
   - Integrates template validation in CI/CD
   - Establishes template testing procedures
   - Monitors generated code quality metrics
   - **Expected Outcome**: Consistent high-quality generated code
   - **Pain Points**: Automated testing complexity, quality metric definition
   - **User Emotions**: Confident in quality processes

**Success Metrics**:
- Team adoption rate: 90% within 1 month
- Code review time reduction: 30% for templated code
- Bug reduction: 40% fewer bugs in generated vs manual code
- Developer satisfaction: 8/10 with template usage

### 2.4 Daily Developer Journey

#### 2.4.1 Quick Scaffolding Workflow

**Context**: A developer uses Unjucks as part of their daily development routine.

**Journey Steps**:

1. **Feature Planning**
   - Developer receives feature requirements
   - Identifies reusable patterns from templates
   - Plans component/service structure
   - **Expected Outcome**: Clear implementation approach with template usage
   - **Pain Points**: Template selection for complex requirements
   - **User Emotions**: Confident and efficient

2. **Rapid Scaffolding**
   ```bash
   # List available templates
   unjucks list
   
   # Generate primary components
   unjucks generate component react --name="UserProfile" --withTests=true
   unjucks generate api-service express --serviceName="UserService" --withAuth=true
   
   # Generate supporting files
   unjucks generate database schema --tableName="users" --withIndexes=true
   ```
   - Quickly generates multiple related files
   - Uses familiar templates with muscle memory
   - Leverages advanced template features
   - **Expected Outcome**: Complete feature skeleton in <5 minutes
   - **Pain Points**: Template variable memorization, complex dependency relationships
   - **User Emotions**: Productive and focused, occasionally impatient with prompts

3. **Customization & Implementation**
   - Reviews generated code structure
   - Implements business logic within template framework
   - Modifies generated tests with specific cases
   - **Expected Outcome**: Accelerated development with consistent patterns
   - **Pain Points**: Template limitations for edge cases, over-scaffolding cleanup
   - **User Emotions**: Satisfied with speed, occasionally constrained by templates

#### 2.4.2 Template Discovery & Learning

4. **Template Exploration**
   ```bash
   unjucks list component  # See available component templates
   unjucks help component react  # Learn about template variables
   unjucks generate component react --dry --name="Example"  # Preview generation
   ```
   - Discovers new templates added by team
   - Learns template capabilities through help system
   - Experiments with dry-run mode
   - **Expected Outcome**: Expanded template usage repertoire
   - **Pain Points**: Template documentation quality, variable option discovery
   - **User Emotions**: Curious and exploratory, occasionally frustrated by poor documentation

5. **Workflow Optimization**
   - Creates custom aliases for frequently used templates
   - Develops personal template usage patterns
   - Contributes template improvements back to team
   - **Expected Outcome**: Optimized personal development workflow
   - **Pain Points**: Template customization conflicts with team standards
   - **User Emotions**: Empowered and efficient

#### 2.4.3 Error Recovery & Troubleshooting

6. **Generation Issues**
   ```bash
   unjucks generate service api --name="Invalid@Name"  # Error case
   unjucks generate service api --name="ValidName" --force  # Overwrite case
   ```
   - Encounters template errors or conflicts
   - Uses dry-run mode to debug issues
   - Applies force mode when appropriate
   - **Expected Outcome**: Successful generation after troubleshooting
   - **Pain Points**: Cryptic error messages, unclear recovery steps
   - **User Emotions**: Temporarily frustrated, satisfied after resolution

7. **Template Modification**
   - Encounters template limitations
   - Makes local template modifications
   - Tests changes with dry-run
   - Shares improvements with team
   - **Expected Outcome**: Enhanced templates benefiting entire team
   - **Pain Points**: Template syntax complexity, testing local changes
   - **User Emotions**: Empowered to improve tooling, proud of contributions

**Success Metrics**:
- Generation frequency: 5-10 templates per day
- Time to scaffolding: <2 minutes for familiar patterns
- Template success rate: >95% successful generations
- Error recovery time: <5 minutes average

### 2.5 Cross-Journey Pain Points & Solutions

#### 2.5.1 Common Pain Points

1. **Template Discovery**
   - **Problem**: Users struggle to find relevant templates
   - **Solution**: Enhanced list command with search and categorization
   - **Journey Impact**: All user types

2. **Variable Documentation**
   - **Problem**: Complex templates have poorly documented variables
   - **Solution**: Auto-generated help from template analysis
   - **Journey Impact**: Daily developers and first-time users

3. **Error Messages**
   - **Problem**: Cryptic errors when templates fail
   - **Solution**: Context-aware error messages with recovery suggestions
   - **Journey Impact**: All user types

4. **Template Testing**
   - **Problem**: No easy way to test complex templates
   - **Solution**: Enhanced dry-run mode with validation
   - **Journey Impact**: Template developers and team leads

#### 2.5.2 Success Patterns

1. **Incremental Adoption**
   - Start with simple, high-value templates
   - Gradually expand to complex scenarios
   - Build confidence through early wins

2. **Community Contribution**
   - Establish template sharing practices
   - Create template contribution guidelines
   - Recognize and reward template creators

3. **Continuous Improvement**
   - Regular template review cycles
   - Usage analytics to guide improvements
   - Developer feedback integration

### 2.6 Journey Success Metrics

#### 2.6.1 Quantitative Metrics

| Journey Phase | Success Metric | Target | Measurement Method |
|---------------|----------------|--------|-------------------|
| First-Time User | Time to first successful generation | <15 minutes | Analytics tracking |
| Template Developer | Template development efficiency | <4 hours for complex template | Time tracking |
| Team Lead | Adoption rate | >80% within 4 weeks | Usage analytics |
| Daily Developer | Generation frequency | 5-10 per day active user | Usage analytics |
| All Journeys | Error rate | <5% failed generations | Error logging |

#### 2.6.2 Qualitative Metrics

| Journey Phase | Experience Metric | Target | Measurement Method |
|---------------|------------------|--------|-------------------|
| First-Time User | Confidence in tool value | 8/10 satisfaction | Post-session survey |
| Template Developer | Template quality pride | 9/10 satisfaction | Developer interviews |
| Team Lead | Code consistency improvement | Measurable improvement | Code review metrics |
| Daily Developer | Workflow integration ease | 8/10 satisfaction | Regular surveys |

---

**Document Status**: Draft v1.0  
**Last Updated**: 2025-01-09  
**Next Review**: After user validation and initial implementation phase
**Dependencies**: Project Overview, Functional Requirements, CLI Interface specifications