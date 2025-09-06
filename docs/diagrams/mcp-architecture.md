# MCP Integration Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph "User Interface"
        CLI[Unjucks CLI]
        AI[Claude AI Assistant]
        API[Programmatic API]
    end
    
    subgraph "MCP Layer"
        CF[Claude Flow MCP Server]
        UN[Unjucks MCP Server]
        BR[MCP Bridge]
    end
    
    subgraph "Coordination Engine"
        SC[Swarm Coordinator]
        MM[Memory Manager]
        NN[Neural Networks]
        HK[Hooks System]
    end
    
    subgraph "Template System"
        TR[Template Registry]
        TO[Template Orchestrator]
        RDF[RDF Data Loader]
        GEN[Generator Engine]
    end
    
    subgraph "Enterprise Templates"
        MS[Microservice]
        AG[API Gateway]
        DP[Data Pipeline]
        CF_COMP[Compliance Framework]
        MON[Monitoring Stack]
    end
    
    subgraph "Infrastructure"
        CACHE[Performance Cache]
        MEM[Shared Memory]
        AUDIT[Audit Trail]
        COMP[Compliance Engine]
    end
    
    CLI --> UN
    AI --> CF
    AI --> UN
    API --> UN
    
    CF <--> BR
    UN <--> BR
    
    BR <--> SC
    BR <--> MM
    BR <--> HK
    
    SC --> TO
    MM --> TR
    TO --> RDF
    TO --> GEN
    
    GEN --> MS
    GEN --> AG
    GEN --> DP
    GEN --> CF_COMP
    GEN --> MON
    
    TO --> CACHE
    TO --> AUDIT
    TO --> COMP
    MM --> MEM
    
    style AI fill:#e1f5fe
    style BR fill:#f3e5f5
    style TO fill:#e8f5e8
    style MS fill:#fff3e0
    style AG fill:#fff3e0
    style DP fill:#fff3e0
    style CF_COMP fill:#fff3e0
    style MON fill:#fff3e0
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant C as Claude AI
    participant CF as Claude Flow MCP
    participant BR as MCP Bridge
    participant UN as Unjucks MCP
    participant TO as Template Orchestrator
    participant GEN as Generator
    
    Note over C: User requests microservice generation
    C->>CF: task_orchestrate("Generate microservice")
    CF->>BR: SwarmTask{type: generate, parameters}
    
    Note over BR: Task conversion and coordination
    BR->>UN: unjucks_generate{generator, template, variables}
    BR->>TO: syncTemplateVariables()
    
    Note over TO: Template discovery and rendering
    TO->>GEN: renderTemplate(fortune5/microservice)
    GEN-->>TO: RenderedFiles[]
    TO-->>UN: GenerationResult
    
    UN-->>BR: ToolResult
    BR->>BR: updateSwarmMemory()
    BR-->>CF: TaskResult
    CF-->>C: Generated microservice with 15 files
    
    Note over C: Real-time coordination hooks
    par Parallel Operations
        BR->>CF: hooks.post-task()
        BR->>UN: hooks.post-edit()
        BR->>BR: syncMemoryBidirectional()
    end
```

## Template Discovery Process

```mermaid
flowchart TD
    START([Start Discovery]) --> SCAN[Scan Template Directories]
    
    SCAN --> CHECK{Directory Exists?}
    CHECK -->|No| SKIP[Skip Directory]
    CHECK -->|Yes| FIND[Find Template Files]
    
    FIND --> PARSE[Parse Frontmatter]
    PARSE --> EXTRACT[Extract Variables]
    EXTRACT --> RDF{RDF Enabled?}
    
    RDF -->|Yes| GEN_RDF[Generate RDF Metadata]
    RDF -->|No| CALC_HASH[Calculate Hash]
    GEN_RDF --> CALC_HASH
    
    CALC_HASH --> CREATE[Create Registry Entry]
    CREATE --> CACHE_CHECK{Cache Valid?}
    
    CACHE_CHECK -->|Yes| REUSE[Reuse Cached Entry]
    CACHE_CHECK -->|No| STORE[Store in Registry]
    
    REUSE --> NEXT{More Directories?}
    STORE --> NEXT
    SKIP --> NEXT
    
    NEXT -->|Yes| SCAN
    NEXT -->|No| SYNC[Sync to MCP Memory]
    SYNC --> END([Discovery Complete])
    
    style START fill:#e8f5e8
    style END fill:#e8f5e8
    style CACHE_CHECK fill:#fff3e0
    style RDF fill:#e1f5fe
```

## JTBD Workflow Execution

```mermaid
stateDiagram-v2
    [*] --> WorkflowReceived
    
    WorkflowReceived --> ValidatingSteps
    ValidatingSteps --> ExecutionPlanning
    ExecutionPlanning --> StepExecution
    
    state StepExecution {
        [*] --> StepStart
        StepStart --> GenerateAction : action == 'generate'
        StepStart --> InjectAction : action == 'inject'
        StepStart --> AnalyzeAction : action == 'analyze'
        StepStart --> ValidateAction : action == 'validate'
        
        GenerateAction --> RenderTemplate
        InjectAction --> ModifyFile
        AnalyzeAction --> ScanTemplate
        ValidateAction --> CheckFiles
        
        RenderTemplate --> StepComplete
        ModifyFile --> StepComplete
        ScanTemplate --> StepComplete
        CheckFiles --> StepComplete
        
        StepComplete --> [*]
    }
    
    StepExecution --> MoreSteps{More Steps?}
    MoreSteps -->|Yes| StepExecution
    MoreSteps -->|No| ResultAggregation
    
    ResultAggregation --> MemorySync
    MemorySync --> AuditLogging
    AuditLogging --> WorkflowComplete
    
    WorkflowComplete --> [*]
    
    note right of ValidatingSteps
        • Check step dependencies
        • Validate parameters
        • Verify template availability
    end note
    
    note right of MemorySync
        • Update swarm memory
        • Sync template variables
        • Store workflow results
    end note
```

## Memory Synchronization Architecture

```mermaid
graph TB
    subgraph "Swarm Memory"
        SA[Swarm Agents State]
        ST[Swarm Tasks]
        SW[Swarm Workflows] 
        SC_MEM[Swarm Configuration]
    end
    
    subgraph "Bridge Memory"
        TV[Template Variables]
        TC[Template Context]
        TM[Template Metadata]
        WS[Workflow State]
    end
    
    subgraph "Template Registry"
        TE[Template Entries]
        PC[Performance Cache]
        RM[RDF Metadata]
        AI_TRAIL[Audit Trail]
    end
    
    subgraph "Synchronization Engine"
        SYNC[Memory Synchronizer]
        HOOKS[Hooks Processor]
        MERGE[Merge Strategy]
        CONFLICT[Conflict Resolution]
    end
    
    SA <--> SYNC
    ST <--> SYNC
    SW <--> SYNC
    SC_MEM <--> SYNC
    
    SYNC <--> TV
    SYNC <--> TC
    SYNC <--> TM
    SYNC <--> WS
    
    TV --> TE
    TC --> PC
    TM --> RM
    WS --> AI_TRAIL
    
    SYNC --> HOOKS
    HOOKS --> MERGE
    MERGE --> CONFLICT
    
    CONFLICT --> SYNC
    
    style SYNC fill:#e1f5fe
    style HOOKS fill:#f3e5f5
    style MERGE fill:#e8f5e8
    style CONFLICT fill:#ffebee
```

## Performance and Caching Layer

```mermaid
graph LR
    subgraph "Request Flow"
        REQ[Template Request]
        CACHE_CHECK{Cache Hit?}
        RENDER[Render Template]
        CACHE_STORE[Store in Cache]
        RESPONSE[Return Result]
    end
    
    subgraph "Cache Management"
        LRU[LRU Eviction]
        TTL[TTL Expiration]
        SIZE[Size Limits]
        WARMUP[Cache Warmup]
    end
    
    subgraph "Performance Metrics"
        HIT_RATE[Hit Rate Tracking]
        RENDER_TIME[Render Time Metrics]
        USAGE_COUNT[Usage Statistics]
        PERF_OPT[Performance Optimization]
    end
    
    REQ --> CACHE_CHECK
    CACHE_CHECK -->|Hit| RESPONSE
    CACHE_CHECK -->|Miss| RENDER
    RENDER --> CACHE_STORE
    CACHE_STORE --> RESPONSE
    
    CACHE_STORE --> HIT_RATE
    RENDER --> RENDER_TIME
    RESPONSE --> USAGE_COUNT
    
    LRU --> CACHE_STORE
    TTL --> CACHE_CHECK
    SIZE --> LRU
    WARMUP --> CACHE_STORE
    
    HIT_RATE --> PERF_OPT
    RENDER_TIME --> PERF_OPT
    USAGE_COUNT --> PERF_OPT
    
    style CACHE_CHECK fill:#fff3e0
    style RENDER fill:#e8f5e8
    style PERF_OPT fill:#e1f5fe
```

## Security and Compliance Flow

```mermaid
graph TD
    START[Template Request] --> AUTH{Authenticated?}
    AUTH -->|No| REJECT[Reject Request]
    AUTH -->|Yes| AUTHZ{Authorized?}
    
    AUTHZ -->|No| REJECT
    AUTHZ -->|Yes| VALIDATE[Validate Input]
    
    VALIDATE --> COMPLIANCE{Compliance Mode?}
    COMPLIANCE -->|None| RENDER[Render Template]
    COMPLIANCE -->|SOC2| SOC2_CHECK[SOC2 Validation]
    COMPLIANCE -->|HIPAA| HIPAA_CHECK[HIPAA Validation]
    COMPLIANCE -->|PCI-DSS| PCI_CHECK[PCI-DSS Validation]
    COMPLIANCE -->|GDPR| GDPR_CHECK[GDPR Validation]
    
    SOC2_CHECK --> AUDIT_LOG[Create Audit Entry]
    HIPAA_CHECK --> AUDIT_LOG
    PCI_CHECK --> AUDIT_LOG
    GDPR_CHECK --> AUDIT_LOG
    
    AUDIT_LOG --> ENCRYPT{Encryption Required?}
    ENCRYPT -->|Yes| APPLY_ENCRYPTION[Apply Encryption]
    ENCRYPT -->|No| RENDER
    APPLY_ENCRYPTION --> RENDER
    
    RENDER --> SCAN[Security Scan]
    SCAN --> SAFE{Scan Clean?}
    SAFE -->|No| SANITIZE[Sanitize Output]
    SAFE -->|Yes| LOG[Log Success]
    
    SANITIZE --> LOG
    LOG --> RETURN[Return Result]
    
    REJECT --> LOG_FAILURE[Log Security Event]
    LOG_FAILURE --> END[End]
    RETURN --> END
    
    style AUTH fill:#ffebee
    style AUTHZ fill:#ffebee
    style COMPLIANCE fill:#e8f5e8
    style AUDIT_LOG fill:#e1f5fe
    style SCAN fill:#fff3e0
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_CLI[Unjucks CLI]
        DEV_AI[Claude AI]
        DEV_MCP[Local MCP Servers]
    end
    
    subgraph "CI/CD Pipeline"
        GIT[Git Repository]
        CI[CI Pipeline]
        SCAN_SEC[Security Scanning]
        SCAN_COMP[Compliance Check]
        TEST[Integration Tests]
    end
    
    subgraph "Staging Environment"
        STAGE_MCP[Staging MCP Cluster]
        STAGE_CACHE[Staging Cache]
        STAGE_DB[Staging Database]
    end
    
    subgraph "Production Environment"
        PROD_LB[Load Balancer]
        PROD_MCP[Production MCP Cluster]
        PROD_CACHE[Production Cache]
        PROD_DB[Production Database]
        MONITOR[Monitoring Stack]
    end
    
    subgraph "Enterprise Features"
        VAULT[Secret Management]
        SSO[Single Sign-On]
        RBAC[Role-Based Access]
        AUDIT_SYS[Audit System]
    end
    
    DEV_CLI --> GIT
    DEV_AI --> GIT
    DEV_MCP --> GIT
    
    GIT --> CI
    CI --> SCAN_SEC
    SCAN_SEC --> SCAN_COMP
    SCAN_COMP --> TEST
    TEST --> STAGE_MCP
    
    STAGE_MCP --> STAGE_CACHE
    STAGE_MCP --> STAGE_DB
    STAGE_MCP --> PROD_LB
    
    PROD_LB --> PROD_MCP
    PROD_MCP --> PROD_CACHE
    PROD_MCP --> PROD_DB
    PROD_MCP --> MONITOR
    
    PROD_MCP --> VAULT
    PROD_MCP --> SSO
    PROD_MCP --> RBAC
    PROD_MCP --> AUDIT_SYS
    
    style DEV_CLI fill:#e8f5e8
    style DEV_AI fill:#e1f5fe
    style PROD_MCP fill:#fff3e0
    style VAULT fill:#ffebee
    style SSO fill:#ffebee
    style RBAC fill:#ffebee
    style AUDIT_SYS fill:#f3e5f5
```

## Error Handling and Recovery

```mermaid
stateDiagram-v2
    [*] --> OperationStart
    
    OperationStart --> Executing
    Executing --> OperationError : Error Occurs
    Executing --> OperationSuccess : Success
    
    state OperationError {
        [*] --> ErrorClassification
        ErrorClassification --> ConnectionError : Network/MCP Issue
        ErrorClassification --> TemplateError : Template Issue
        ErrorClassification --> ValidationError : Input Issue
        ErrorClassification --> ComplianceError : Compliance Issue
        
        ConnectionError --> RetryConnection
        TemplateError --> FallbackTemplate
        ValidationError --> RequestInput
        ComplianceError --> ComplianceBypass
        
        RetryConnection --> RetryExecution
        FallbackTemplate --> RetryExecution
        RequestInput --> RetryExecution
        ComplianceBypass --> RetryExecution
        
        RetryExecution --> MaxRetriesReached{Max Retries?}
        MaxRetriesReached -->|No| [*]
        MaxRetriesReached -->|Yes| FailureLogging
        
        FailureLogging --> NotifyUser
        NotifyUser --> GracefulDegradation
        GracefulDegradation --> [*]
    }
    
    OperationError --> AuditError
    OperationSuccess --> AuditSuccess
    
    AuditError --> [*]
    AuditSuccess --> [*]
    
    note right of ErrorClassification
        Errors are classified by:
        • Error type and code
        • Originating component
        • Severity level
        • Recovery strategy
    end note
    
    note right of GracefulDegradation
        Fallback strategies:
        • Basic template generation
        • Cached results
        • Manual intervention
    end note
```

These architectural diagrams provide comprehensive visual documentation of the MCP integration system, covering all major components, data flows, and operational patterns.