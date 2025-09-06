# SPARQL Template Querying

## Overview

Template-optimized SPARQL syntax for enterprise metadata extraction with performance optimization patterns. Focus on practical template use cases over comprehensive SPARQL features.

## Template-Optimized Query Patterns

### Template Metadata Extraction

```sparql
# Extract template variables and their types
PREFIX template: <http://unjucks.io/template/>
PREFIX schema: <http://schema.org/>

SELECT ?template ?variable ?type ?required WHERE {
  ?template a template:Generator ;
           template:hasVariable ?variable .
  ?variable template:name ?name ;
           template:type ?type ;
           template:required ?required .
  
  # Performance optimization: filter by template pattern
  FILTER(regex(str(?template), "^.*/(component|api|database)/.*$"))
}
ORDER BY ?template ?variable
```

### Enterprise Template Discovery

```sparql
# Find templates by enterprise context
PREFIX enterprise: <http://company.com/ontology/>
PREFIX template: <http://unjucks.io/template/>

SELECT DISTINCT ?generator ?template ?description ?compliance WHERE {
  ?generator a template:Generator ;
            template:hasTemplate ?template .
  ?template template:description ?description ;
           enterprise:complianceLevel ?compliance .
  
  # Enterprise filtering for Fortune 5 needs
  VALUES ?compliance { "SOX" "GDPR" "HIPAA" "FINRA" }
  
  # Performance: index on compliance level
  ?template enterprise:indexed true .
}
LIMIT 50
```

## Performance Optimization Quick Wins

### Index-Optimized Queries

```sparql
# Use indexed properties for better performance
SELECT ?template ?lastModified WHERE {
  ?template template:indexed true ;           # Primary index
           template:lastModified ?lastModified ; # Secondary index
           template:category "enterprise" .      # Tertiary index
  
  # Date range optimization
  FILTER(?lastModified >= "2024-01-01T00:00:00Z"^^xsd:dateTime)
}
```

### Template-Specific Optimizations

#### Component Template Queries
```sparql
# Optimized for React/Vue component discovery
PREFIX component: <http://unjucks.io/component/>

SELECT ?template ?framework ?hasProps ?hasTests WHERE {
  ?template a component:Template ;
           component:framework ?framework ;
           component:supportsProps ?hasProps ;
           component:includesTests ?hasTests .
  
  # Performance: pre-filter by popular frameworks
  VALUES ?framework { "react" "vue" "angular" "svelte" }
}
```

#### API Template Queries
```sparql
# Optimized for REST/GraphQL API templates
PREFIX api: <http://unjucks.io/api/>

SELECT ?template ?protocol ?authType ?hasValidation WHERE {
  ?template a api:Template ;
           api:protocol ?protocol ;
           api:authentication ?authType ;
           api:includesValidation ?hasValidation .
  
  # Enterprise API requirements
  FILTER(?authType IN ("jwt", "oauth2", "saml"))
}
```

### Query Plan Optimization

```sparql
# Optimized join order for template queries
SELECT ?generator ?template ?variable ?example WHERE {
  # Start with most selective triple (smallest result set)
  ?template template:category "enterprise" .
  
  # Join with generator (medium selectivity)
  ?generator template:hasTemplate ?template .
  
  # Join with variables (largest result set) last
  ?template template:hasVariable ?variable .
  ?variable template:example ?example .
  
  # Use OPTIONAL for non-essential data
  OPTIONAL { ?template template:documentation ?docs }
}
```

## Enterprise Metadata Patterns

### Compliance Tracking

```sparql
# Track compliance metadata across templates
PREFIX compliance: <http://company.com/compliance/>

CONSTRUCT {
  ?template compliance:gdprCompliant ?gdprStatus ;
           compliance:soxCompliant ?soxStatus ;
           compliance:lastAudit ?auditDate .
} WHERE {
  ?template a template:Template .
  
  OPTIONAL {
    ?template compliance:gdpr ?gdprStatus .
  }
  OPTIONAL {
    ?template compliance:sox ?soxStatus .
  }
  OPTIONAL {
    ?template compliance:auditDate ?auditDate .
  }
}
```

### Version Management

```sparql
# Template version tracking for enterprise governance
SELECT ?template ?currentVersion ?compatibleVersions WHERE {
  ?template template:version ?currentVersion ;
           template:compatibleWith ?compatibleVersions .
  
  # Show only production-ready templates
  ?template template:status "production" .
  
  # Order by semantic version
  ORDER BY DESC(?currentVersion)
}
```

## Common Template Use Cases

### 1. Template Discovery by Technology Stack

```sparql
# Find templates for specific tech stack
SELECT ?template ?name ?description WHERE {
  ?template template:technology ?tech ;
           template:name ?name ;
           template:description ?description .
  
  VALUES ?tech { 
    "typescript" "react" "nodejs" "postgresql" 
    "kubernetes" "terraform" "aws" "azure"
  }
  
  # Group by template to avoid duplicates
  GROUP BY ?template ?name ?description
}
```

### 2. Template Dependency Analysis

```sparql
# Analyze template dependencies for enterprise planning
SELECT ?template ?dependency ?version WHERE {
  ?template template:requires ?dependency .
  ?dependency template:version ?version .
  
  # Focus on critical dependencies
  FILTER EXISTS {
    ?dependency template:criticality "high"
  }
}
```

### 3. Template Usage Analytics

```sparql
# Template usage patterns for optimization
SELECT ?template ?usageCount ?lastUsed WHERE {
  ?template template:usageCount ?usageCount ;
           template:lastUsed ?lastUsed .
  
  # Find most-used templates in last 90 days
  FILTER(?lastUsed >= NOW() - "P90D"^^xsd:duration)
  
  ORDER BY DESC(?usageCount)
}
LIMIT 20
```

## Performance Benchmarks

### Query Response Time Targets

| Query Type | Target Time | Enterprise SLA |
|------------|-------------|----------------|
| Template Discovery | < 100ms | 99.9% uptime |
| Variable Extraction | < 50ms | 99.95% uptime |
| Compliance Check | < 200ms | 99.9% uptime |
| Usage Analytics | < 500ms | 99% uptime |

### Optimization Strategies

```sparql
# Use LIMIT for pagination
SELECT ?template ?name WHERE {
  ?template template:name ?name .
} 
ORDER BY ?name
LIMIT 25 OFFSET 0

# Use specific patterns instead of OPTIONAL chains
SELECT ?template ?hasTests WHERE {
  ?template a template:Template .
  
  # Efficient boolean check
  BIND(EXISTS { ?template template:includesTests true } AS ?hasTests)
}

# Avoid expensive operations in FILTER
SELECT ?template WHERE {
  ?template template:category ?category .
  
  # Pre-filter with VALUES instead of regex
  VALUES ?category { "component" "api" "database" }
}
```

## Enterprise Integration Examples

### CI/CD Pipeline Queries

```sparql
# Find templates for CI/CD automation
PREFIX cicd: <http://company.com/cicd/>

SELECT ?template ?pipeline ?deployTarget WHERE {
  ?template cicd:supportsPipeline ?pipeline ;
           cicd:deploymentTarget ?deployTarget .
  
  VALUES ?deployTarget { "kubernetes" "aws-ecs" "azure-aks" }
}
```

### Template Governance Queries

```sparql
# Enterprise template approval status
SELECT ?template ?approvalStatus ?reviewer ?approvalDate WHERE {
  ?template template:approvalStatus ?approvalStatus ;
           template:reviewer ?reviewer ;
           template:approvalDate ?approvalDate .
  
  FILTER(?approvalStatus = "approved")
  FILTER(?approvalDate >= "2024-01-01"^^xsd:date)
}
```

## Best Practices Summary

1. **Index Strategy**: Use indexed properties in WHERE clauses first
2. **Join Order**: Start with most selective triples
3. **LIMIT Usage**: Always limit large result sets
4. **OPTIONAL Placement**: Use OPTIONAL for non-essential data only
5. **FILTER Efficiency**: Use VALUES instead of complex regex patterns
6. **Enterprise Context**: Include compliance and governance metadata
7. **Performance Monitoring**: Track query execution times

*Focus on template-specific patterns that deliver immediate enterprise value.*