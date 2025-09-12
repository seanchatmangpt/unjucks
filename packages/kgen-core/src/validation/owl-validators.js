/**
 * KGEN OWL-based Validation Methods
 * Enhanced OWL validation capabilities for ontology consistency and completeness
 */

import { Store } from 'n3';
import consola from 'consola';

/**
 * OWL validation methods for ontology-based validation
 */
export const OWLValidationMethods = {
  
  /**
   * Validate OWL ontology consistency
   */
  async validateOWLConsistency(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    try {
      // Check for contradictory class assertions
      const classAssertions = this.extractClassAssertions(store);
      const disjointClasses = this.extractDisjointClasses(store);
      
      for (const [individual, classes] of classAssertions.entries()) {
        for (const disjointPair of disjointClasses) {
          const [class1, class2] = disjointPair;
          if (classes.has(class1) && classes.has(class2)) {
            violations.push({
              type: 'disjoint-class-violation',
              message: `Individual ${individual} cannot be both ${class1} and ${class2} (disjoint classes)`,
              individual,
              conflictingClasses: [class1, class2],
              severity: 'CRITICAL'
            });
          }
        }
      }
      
      // Check for inconsistent property assertions
      const propertyViolations = await this.validatePropertyConsistency(store);
      violations.push(...propertyViolations.violations);
      warnings.push(...propertyViolations.warnings);
      
      // Check for cardinality constraint violations
      const cardinalityViolations = await this.validateCardinalityConstraints(store);
      violations.push(...cardinalityViolations.violations);
      warnings.push(...cardinalityViolations.warnings);
      
    } catch (error) {
      violations.push({
        type: 'owl-consistency-error',
        message: `OWL consistency validation failed: ${error.message}`,
        severity: 'HIGH'
      });
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: {
        consistencyChecks: ['disjoint-classes', 'property-consistency', 'cardinality-constraints'],
        totalViolations: violations.length,
        totalWarnings: warnings.length
      }
    };
  },
  
  /**
   * Validate OWL ontology completeness
   */
  async validateOWLCompleteness(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    try {
      // Check for essential OWL components
      const ontologyDeclarations = this.findTriplesByPredicate(store, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Ontology');
      
      if (ontologyDeclarations.length === 0) {
        warnings.push({
          type: 'missing-ontology-declaration',
          message: 'No owl:Ontology declaration found',
          severity: 'MEDIUM'
        });
      }
      
      // Check for class definitions
      const classCount = this.findTriplesByPredicate(store, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class').length;
      
      if (classCount === 0) {
        violations.push({
          type: 'no-owl-classes',
          message: 'Ontology contains no OWL classes',
          severity: 'HIGH'
        });
      }
      
      // Check for property definitions
      const objectPropertyCount = this.findTriplesByPredicate(store, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#ObjectProperty').length;
      const datatypePropertyCount = this.findTriplesByPredicate(store, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#DatatypeProperty').length;
      
      if (objectPropertyCount === 0 && datatypePropertyCount === 0) {
        warnings.push({
          type: 'no-owl-properties',
          message: 'Ontology contains no OWL properties',
          severity: 'MEDIUM'
        });
      }
      
      // Check for proper imports
      const imports = this.findTriplesByPredicate(store, 'http://www.w3.org/2002/07/owl#imports');
      const importWarnings = this.validateOntologyImports(imports);
      warnings.push(...importWarnings);
      
      // Check for version information
      const versionInfo = this.findTriplesByPredicate(store, 'http://www.w3.org/2002/07/owl#versionInfo');
      if (versionInfo.length === 0) {
        warnings.push({
          type: 'missing-version-info',
          message: 'Ontology lacks version information (owl:versionInfo)',
          severity: 'LOW'
        });
      }
      
    } catch (error) {
      violations.push({
        type: 'owl-completeness-error',
        message: `OWL completeness validation failed: ${error.message}`,
        severity: 'HIGH'
      });
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: {
        completenessChecks: ['ontology-declaration', 'class-definitions', 'property-definitions', 'imports', 'version-info'],
        classCount,
        objectPropertyCount,
        datatypePropertyCount,
        importsCount: imports.length
      }
    };
  },
  
  /**
   * Validate OWL cardinality constraints
   */
  async validateOWLCardinality(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    try {
      // Extract cardinality restrictions
      const cardinalityRestrictions = this.extractCardinalityRestrictions(store);
      
      for (const restriction of cardinalityRestrictions) {
        const violatingInstances = this.findCardinalityViolations(store, restriction);
        
        for (const instance of violatingInstances) {
          violations.push({
            type: 'cardinality-violation',
            message: `Instance ${instance.subject} violates ${restriction.type} cardinality restriction on property ${restriction.property}`,
            instance: instance.subject,
            property: restriction.property,
            restrictionType: restriction.type,
            expectedCardinality: restriction.cardinality,
            actualCardinality: instance.actualCardinality,
            severity: 'HIGH'
          });
        }
      }
      
    } catch (error) {
      violations.push({
        type: 'owl-cardinality-error',
        message: `OWL cardinality validation failed: ${error.message}`,
        severity: 'HIGH'
      });
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: {
        cardinalityRestrictionsChecked: cardinalityRestrictions.length,
        violationsFound: violations.length
      }
    };
  },
  
  /**
   * Run all OWL validation rules
   */
  async validateOWLRules(dataGraph) {
    const results = {
      totalViolations: 0,
      totalWarnings: 0,
      ruleResults: [],
      passed: true
    };
    
    try {
      // Run each OWL validation rule
      for (const [ruleName, rule] of this.owlRules.entries()) {
        const startTime = Date.now();
        const ruleResult = await rule.execute(dataGraph);
        const executionTime = Date.now() - startTime;
        
        results.ruleResults.push({
          rule: ruleName,
          name: rule.name,
          passed: ruleResult.passed,
          violations: ruleResult.violations || [],
          warnings: ruleResult.warnings || [],
          executionTime,
          metadata: ruleResult.metadata || {}
        });
        
        results.totalViolations += (ruleResult.violations || []).length;
        results.totalWarnings += (ruleResult.warnings || []).length;
        
        if (!ruleResult.passed) {
          results.passed = false;
        }
        
        this.stats.n3RuleExecutions++;
      }
      
    } catch (error) {
      results.passed = false;
      results.error = error.message;
      consola.error('❌ OWL validation failed:', error.message);
    }
    
    return results;
  },
  
  // Helper methods for OWL validation
  
  /**
   * Extract class assertions from the store
   */
  extractClassAssertions(store) {
    const classAssertions = new Map();
    
    for (const quad of store) {
      if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        const individual = quad.subject.value;
        const owlClass = quad.object.value;
        
        if (!classAssertions.has(individual)) {
          classAssertions.set(individual, new Set());
        }
        classAssertions.get(individual).add(owlClass);
      }
    }
    
    return classAssertions;
  },
  
  /**
   * Extract disjoint class declarations
   */
  extractDisjointClasses(store) {
    const disjointClasses = [];
    
    for (const quad of store) {
      if (quad.predicate.value === 'http://www.w3.org/2002/07/owl#disjointWith') {
        disjointClasses.push([quad.subject.value, quad.object.value]);
      }
    }
    
    return disjointClasses;
  },
  
  /**
   * Validate property consistency
   */
  async validatePropertyConsistency(store) {
    const violations = [];
    const warnings = [];
    
    // Check for functional property violations
    const functionalProperties = this.findTriplesByPredicate(store, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#FunctionalProperty');
    
    for (const functionalProp of functionalProperties) {
      const property = functionalProp.subject.value;
      const usages = this.findTriplesByPredicate(store, property);
      
      // Group by subject
      const subjectGroups = new Map();
      for (const usage of usages) {
        const subject = usage.subject.value;
        if (!subjectGroups.has(subject)) {
          subjectGroups.set(subject, []);
        }
        subjectGroups.get(subject).push(usage.object.value);
      }
      
      // Check for multiple values (functional property violation)
      for (const [subject, values] of subjectGroups.entries()) {
        if (values.length > 1) {
          violations.push({
            type: 'functional-property-violation',
            message: `Functional property ${property} has multiple values for subject ${subject}`,
            subject,
            property,
            values,
            severity: 'HIGH'
          });
        }
      }
    }
    
    return { violations, warnings };
  },
  
  /**
   * Validate cardinality constraints
   */
  async validateCardinalityConstraints(store) {
    const violations = [];
    const warnings = [];
    
    // This is a simplified cardinality check
    // In a full implementation, this would parse OWL restriction syntax
    const cardinalityViolations = this.findCardinalityViolationsSimple(store);
    violations.push(...cardinalityViolations);
    
    return { violations, warnings };
  },
  
  /**
   * Find triples by predicate and optionally object
   */
  findTriplesByPredicate(store, predicate, object = null) {
    const results = [];
    
    for (const quad of store) {
      if (quad.predicate.value === predicate) {
        if (!object || quad.object.value === object) {
          results.push(quad);
        }
      }
    }
    
    return results;
  },
  
  /**
   * Extract cardinality restrictions (simplified)
   */
  extractCardinalityRestrictions(store) {
    const restrictions = [];
    
    // Look for owl:minCardinality, owl:maxCardinality, owl:cardinality
    const cardinalityPredicates = [
      'http://www.w3.org/2002/07/owl#minCardinality',
      'http://www.w3.org/2002/07/owl#maxCardinality',
      'http://www.w3.org/2002/07/owl#cardinality'
    ];
    
    for (const predicate of cardinalityPredicates) {
      const cardinalityTriples = this.findTriplesByPredicate(store, predicate);
      
      for (const triple of cardinalityTriples) {
        restrictions.push({
          restriction: triple.subject.value,
          type: predicate.split('#')[1],
          cardinality: parseInt(triple.object.value),
          property: null // Would need to extract from owl:onProperty
        });
      }
    }
    
    return restrictions;
  },
  
  /**
   * Find cardinality violations (simplified)
   */
  findCardinalityViolations(store, restriction) {
    // This is a placeholder implementation
    // Real implementation would check actual cardinality against restrictions
    return [];
  },
  
  /**
   * Simple cardinality violation check
   */
  findCardinalityViolationsSimple(store) {
    // Placeholder for simple cardinality checks
    return [];
  },
  
  /**
   * Validate ontology imports
   */
  validateOntologyImports(imports) {
    const warnings = [];
    
    for (const importTriple of imports) {
      const importIRI = importTriple.object.value;
      
      // Check if import IRI looks valid
      if (!importIRI.startsWith('http://') && !importIRI.startsWith('https://')) {
        warnings.push({
          type: 'invalid-import-iri',
          message: `Import IRI does not use HTTP/HTTPS scheme: ${importIRI}`,
          importIRI,
          severity: 'MEDIUM'
        });
      }
      
      // Could add more sophisticated import validation here
    }
    
    return warnings;
  }
};

export default OWLValidationMethods;