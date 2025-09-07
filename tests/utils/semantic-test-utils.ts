/**
 * Semantic Test Utils - Helper functions for RDF and semantic testing
 */

export class SemanticTestUtils {
  
  /**
   * Generate a valid user schema in Turtle format
   */
  generateUserSchema(): string {
    return `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Classes
ex:User rdf:type rdfs:Class ;
        rdfs:label "User" ;
        rdfs:comment "A user in the system" .

ex:Profile rdf:type rdfs:Class ;
           rdfs:label "Profile" ;
           rdfs:comment "User profile information" .

ex:Address rdf:type rdfs:Class ;
           rdfs:label "Address" ;
           rdfs:comment "User address information" .

# Properties
ex:firstName rdf:type rdf:Property ;
             rdfs:label "First Name" ;
             rdfs:domain ex:User ;
             rdfs:range xsd:string .

ex:lastName rdf:type rdf:Property ;
            rdfs:label "Last Name" ;
            rdfs:domain ex:User ;
            rdfs:range xsd:string .

ex:email rdf:type rdf:Property ;
         rdfs:label "Email" ;
         rdfs:domain ex:User ;
         rdfs:range xsd:string .

ex:age rdf:type rdf:Property ;
       rdfs:label "Age" ;
       rdfs:domain ex:User ;
       rdfs:range xsd:integer .

ex:hasProfile rdf:type rdf:Property ;
              rdfs:label "Has Profile" ;
              rdfs:domain ex:User ;
              rdfs:range ex:Profile .

ex:hasAddress rdf:type rdf:Property ;
              rdfs:label "Has Address" ;
              rdfs:domain ex:Profile ;
              rdfs:range ex:Address .

# Sample data
ex:john rdf:type ex:User ;
        ex:firstName "John" ;
        ex:lastName "Doe" ;
        ex:email "john.doe@example.com" ;
        ex:age 30 ;
        ex:hasProfile ex:johnProfile .

ex:johnProfile rdf:type ex:Profile ;
               foaf:name "John Doe's Profile" ;
               ex:hasAddress ex:johnAddress .

ex:johnAddress rdf:type ex:Address ;
               ex:street "123 Main St" ;
               ex:city "Anytown" ;
               ex:state "CA" ;
               ex:zipCode "12345" .
    `.trim();
  }

  /**
   * Generate an invalid RDF schema with syntax errors
   */
  generateInvalidSchema(): string {
    return `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

# Missing closing bracket and dot
ex:User rdf:type rdfs:Class [
        rdfs:label "User"

# Double semicolon error
ex:name rdf:type rdf:Property ;;
        rdfs:domain ex:User .

# Missing rdf:type
ex:john ex:name "John Doe" .

# Invalid URI
ex:invalid<space> rdf:type ex:User .
    `.trim();
  }

  /**
   * Generate SHACL validation rules
   */
  generateShaclRules(): string {
    return `
@prefix ex: <http://example.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:UserShape
    a sh:NodeShape ;
    sh:targetClass ex:User ;
    sh:property [
        sh:path ex:firstName ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:maxLength 50 ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:lastName ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:maxLength 50 ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:email ;
        sh:datatype xsd:string ;
        sh:pattern "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:age ;
        sh:datatype xsd:integer ;
        sh:minInclusive 0 ;
        sh:maxInclusive 150 ;
        sh:maxCount 1 ;
    ] .

ex:ProfileShape
    a sh:NodeShape ;
    sh:targetClass ex:Profile ;
    sh:property [
        sh:path ex:hasAddress ;
        sh:class ex:Address ;
        sh:maxCount 1 ;
    ] .
    `.trim();
  }

  /**
   * Generate a semantic template with RDF annotations
   */
  generateSemanticTemplate(className: string): string {
    return `
---
to: src/models/{{ className | kebabCase }}.ts
semantic:
  rdf_type: "http://example.org/{{ className }}"
  properties:
    - name: "http://example.org/firstName"
    - email: "http://example.org/email"
    - age: "http://example.org/age"
inject: true
skipIf: "class {{ className }}"
---
/**
 * {{ className }} model with semantic RDF annotations
 * @rdf:type http://example.org/{{ className }}
 */
export class {{ className }} {
  /**
   * @rdf:property http://example.org/firstName
   */
  public firstName: string;
  
  /**
   * @rdf:property http://example.org/lastName  
   */
  public lastName: string;
  
  /**
   * @rdf:property http://example.org/email
   */
  public email: string;
  
  /**
   * @rdf:property http://example.org/age
   */
  public age?: number;
  
  constructor(
    firstName: string, 
    lastName: string, 
    email: string, 
    age?: number
  ) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.age = age;
  }

  /**
   * Convert to RDF representation
   */
  toRDF(): string {
    const id = this.email.replace('@', '_at_').replace('.', '_dot_');
    return \`
@prefix ex: <http://example.org/> .

ex:\${id} a ex:{{ className }} ;
    ex:firstName "\${this.firstName}" ;
    ex:lastName "\${this.lastName}" ;
    ex:email "\${this.email}"\${this.age ? \` ;
    ex:age \${this.age}\` : ''} .
    \`.trim();
  }

  /**
   * Validate against semantic constraints
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.firstName || this.firstName.length < 1) {
      errors.push('firstName is required and must be at least 1 character');
    }

    if (!this.lastName || this.lastName.length < 1) {
      errors.push('lastName is required and must be at least 1 character');
    }

    if (!this.email || !/^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$/.test(this.email)) {
      errors.push('email must be a valid email address');
    }

    if (this.age !== undefined && (this.age < 0 || this.age > 150)) {
      errors.push('age must be between 0 and 150');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
    `.trim();
  }

  /**
   * Generate a sample RDF dataset for testing
   */
  generateSampleDataset(): string {
    return `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a ex:User ;
    ex:firstName "Alice" ;
    ex:lastName "Johnson" ;
    ex:email "alice@example.com" ;
    ex:age 28 .

ex:bob a ex:User ;
    ex:firstName "Bob" ;
    ex:lastName "Smith" ;
    ex:email "bob@example.com" ;
    ex:age 35 .

ex:charlie a ex:User ;
    ex:firstName "Charlie" ;
    ex:lastName "Brown" ;
    ex:email "charlie@example.com" .
    `.trim();
  }

  /**
   * Generate expected validation results for testing
   */
  generateExpectedValidationResults(): any {
    return {
      valid: true,
      format: 'turtle',
      triples: 12,
      classes: 1,
      properties: 4,
      warnings: [],
      errors: [],
      shaclResults: {
        conforms: true,
        validationReport: []
      },
      statistics: {
        subjects: 3,
        predicates: 4,
        objects: 9,
        literals: 6,
        resources: 3
      }
    };
  }

  /**
   * Generate expected error results for invalid RDF
   */
  generateExpectedErrorResults(): any {
    return {
      valid: false,
      errors: [
        {
          line: 5,
          column: 25,
          message: 'Expected "." but found end of input',
          severity: 'error'
        },
        {
          line: 8,
          column: 33,
          message: 'Expected "." but found ";;"',
          severity: 'error'
        },
        {
          line: 11,
          column: 1,
          message: 'Missing rdf:type declaration',
          severity: 'warning'
        },
        {
          line: 14,
          column: 12,
          message: 'Invalid URI: contains space character',
          severity: 'error'
        }
      ],
      warnings: [
        {
          line: 11,
          message: 'Property used without domain declaration',
          severity: 'warning'
        }
      ],
      shaclResults: {
        conforms: false,
        validationReport: [
          {
            severity: 'Violation',
            focusNode: 'ex:john',
            resultPath: 'rdf:type',
            message: 'Missing required rdf:type'
          }
        ]
      }
    };
  }

  /**
   * Validate RDF content structure
   */
  validateRDFStructure(content: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const lines = content.split('\n');

    // Basic structure checks
    if (!content.includes('@prefix')) {
      issues.push('Missing @prefix declarations');
    }

    if (!content.includes('rdf:type')) {
      issues.push('No rdf:type declarations found');
    }

    // Check for common syntax errors
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('@prefix')) {
        // Check for missing dots at end of statements
        if (!trimmedLine.endsWith('.') && !trimmedLine.endsWith(';') && !trimmedLine.endsWith(',')) {
          issues.push(`Line ${index + 1}: Statement may be missing terminator`);
        }
        
        // Check for double semicolons
        if (trimmedLine.includes(';;')) {
          issues.push(`Line ${index + 1}: Double semicolon found`);
        }
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Extract semantic annotations from template
   */
  extractSemanticAnnotations(templateContent: string): any {
    const frontmatterMatch = templateContent.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      return null;
    }

    try {
      // Simple YAML parsing for semantic section
      const frontmatter = frontmatterMatch[1];
      const semanticMatch = frontmatter.match(/semantic:\s*\n([\s\S]*?)(?=\n\w|$)/);
      
      if (!semanticMatch) {
        return null;
      }

      const semanticYaml = semanticMatch[1];
      const annotations: any = {};

      // Extract rdf_type
      const rdfTypeMatch = semanticYaml.match(/rdf_type:\s*"([^"]+)"/);
      if (rdfTypeMatch) {
        annotations.rdf_type = rdfTypeMatch[1];
      }

      // Extract properties
      const propertiesMatch = semanticYaml.match(/properties:\s*\n([\s\S]*?)(?=\n[^\s]|$)/);
      if (propertiesMatch) {
        annotations.properties = {};
        const propertyLines = propertiesMatch[1].split('\n');
        
        propertyLines.forEach(line => {
          const propMatch = line.match(/- (\w+):\s*"([^"]+)"/);
          if (propMatch) {
            annotations.properties[propMatch[1]] = propMatch[2];
          }
        });
      }

      return annotations;
    } catch (error) {
      return null;
    }
  }
}