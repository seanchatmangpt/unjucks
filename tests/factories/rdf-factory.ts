import { faker } from '@faker-js/faker';
import type { 
  TurtleDataset, 
  TurtleTriple, 
  TurtlePrefixes 
} from '../../src/lib/types/turtle-types.js';

export interface RDFNode {
  type: 'uri' | 'literal' | 'blank';
  value: string;
  datatype?: string;
  language?: string;
}

export interface TestOntology {
  prefixes: TurtlePrefixes;
  classes: string[];
  properties: string[];
  individuals: string[];
}

export class RDFFactory {
  /**
   * Create RDF node
   */
  static createNode(type?: 'uri' | 'literal' | 'blank'): RDFNode {
    const nodeType = type || faker.helpers.arrayElement(['uri', 'literal', 'blank']);
    
    switch (nodeType) {
      case 'uri':
        return {
          type: 'uri',
          value: `http://example.org/${faker.hacker.noun()}`
        };
      
      case 'literal':
        return {
          type: 'literal',
          value: faker.lorem.sentence(),
          datatype: faker.helpers.arrayElement([
            'http://www.w3.org/2001/XMLSchema#string',
            'http://www.w3.org/2001/XMLSchema#integer',
            'http://www.w3.org/2001/XMLSchema#boolean',
            'http://www.w3.org/2001/XMLSchema#dateTime'
          ])
        };
      
      case 'blank':
        return {
          type: 'blank',
          value: `_:blank${faker.string.alphanumeric(8)}`
        };
    }
  }

  /**
   * Create Turtle triple
   */
  static createTriple(overrides: Partial<TurtleTriple> = {}): TurtleTriple {
    return {
      subject: overrides.subject || this.createNode('uri'),
      predicate: overrides.predicate || this.createNode('uri'),
      object: overrides.object || this.createNode(),
      ...overrides
    };
  }

  /**
   * Create Turtle prefixes
   */
  static createPrefixes(overrides: Partial<TurtlePrefixes> = {}): TurtlePrefixes {
    return {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      ex: 'http://example.org/',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dc: 'http://purl.org/dc/elements/1.1/',
      ...overrides
    };
  }

  /**
   * Create Turtle dataset
   */
  static createDataset(overrides: Partial<TurtleDataset> = {}): TurtleDataset {
    return {
      prefixes: overrides.prefixes || this.createPrefixes(),
      triples: overrides.triples || Array.from({ length: 10 }, () => this.createTriple()),
      metadata: overrides.metadata || {
        created: faker.date.past(),
        modified: faker.date.recent(),
        source: faker.internet.url()
      },
      ...overrides
    };
  }

  /**
   * Create test ontology
   */
  static createOntology(overrides: Partial<TestOntology> = {}): TestOntology {
    return {
      prefixes: overrides.prefixes || this.createPrefixes(),
      classes: overrides.classes || [
        'ex:Person',
        'ex:Organization',
        'ex:Event',
        'ex:Place',
        'ex:Document'
      ],
      properties: overrides.properties || [
        'ex:name',
        'ex:description',
        'ex:createdAt',
        'ex:hasAuthor',
        'ex:relatedTo'
      ],
      individuals: overrides.individuals || [
        'ex:JohnDoe',
        'ex:CompanyABC',
        'ex:Event123'
      ],
      ...overrides
    };
  }

  /**
   * Generate Turtle document string
   */
  static generateTurtleDocument(dataset: TurtleDataset): string {
    const lines: string[] = [];
    
    // Add prefixes
    Object.entries(dataset.prefixes).forEach(([prefix, uri]) => {
      lines.push(`@prefix ${prefix}: <${uri}> .`);
    });
    
    lines.push(''); // Empty line after prefixes
    
    // Add triples
    dataset.triples.forEach(triple => {
      const subject = this.formatNode(triple.subject, dataset.prefixes);
      const predicate = this.formatNode(triple.predicate, dataset.prefixes);
      const object = this.formatNode(triple.object, dataset.prefixes);
      
      lines.push(`${subject} ${predicate} ${object} .`);
    });
    
    return lines.join('\n');
  }

  /**
   * Format RDF node for Turtle serialization
   */
  private static formatNode(node: RDFNode, prefixes: TurtlePrefixes): string {
    switch (node.type) {
      case 'uri':
        // Try to use prefixes
        for (const [prefix, namespace] of Object.entries(prefixes)) {
          if (node.value.startsWith(namespace)) {
            return `${prefix}:${node.value.substring(namespace.length)}`;
          }
        }
        return `<${node.value}>`;
      
      case 'literal':
        let literal = `"${node.value}"`;
        if (node.language) {
          literal += `@${node.language}`;
        } else if (node.datatype) {
          // Try to use prefixes for datatype
          let datatype = `<${node.datatype}>`;
          for (const [prefix, namespace] of Object.entries(prefixes)) {
            if (node.datatype.startsWith(namespace)) {
              datatype = `${prefix}:${node.datatype.substring(namespace.length)}`;
              break;
            }
          }
          literal += `^^${datatype}`;
        }
        return literal;
      
      case 'blank':
        return node.value;
    }
  }

  /**
   * Create RDF scenarios for testing
   */
  static createRDFScenarios() {
    return {
      simple: {
        dataset: this.createDataset({
          triples: [
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/person1' },
              predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
              object: { type: 'literal', value: 'John Doe' }
            })
          ]
        }),
        expected: {
          tripleCount: 1,
          subjectCount: 1,
          predicateCount: 1
        }
      },

      complex: {
        dataset: this.createDataset({
          triples: [
            // Person with multiple properties
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/person1' },
              predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
              object: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/Person' }
            }),
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/person1' },
              predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
              object: { type: 'literal', value: 'John Doe' }
            }),
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/person1' },
              predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/age' },
              object: { 
                type: 'literal', 
                value: '30', 
                datatype: 'http://www.w3.org/2001/XMLSchema#integer' 
              }
            })
          ]
        }),
        expected: {
          tripleCount: 3,
          subjectCount: 1,
          predicateCount: 3
        }
      },

      multilingual: {
        dataset: this.createDataset({
          triples: [
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/book1' },
              predicate: { type: 'uri', value: 'http://purl.org/dc/elements/1.1/title' },
              object: { 
                type: 'literal', 
                value: 'The Great Book', 
                language: 'en' 
              }
            }),
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/book1' },
              predicate: { type: 'uri', value: 'http://purl.org/dc/elements/1.1/title' },
              object: { 
                type: 'literal', 
                value: 'Le Grand Livre', 
                language: 'fr' 
              }
            })
          ]
        }),
        expected: {
          languages: ['en', 'fr'],
          titleCount: 2
        }
      },

      blankNodes: {
        dataset: this.createDataset({
          triples: [
            this.createTriple({
              subject: { type: 'uri', value: 'http://example.org/person1' },
              predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/address' },
              object: { type: 'blank', value: '_:addr1' }
            }),
            this.createTriple({
              subject: { type: 'blank', value: '_:addr1' },
              predicate: { type: 'uri', value: 'http://example.org/street' },
              object: { type: 'literal', value: '123 Main St' }
            }),
            this.createTriple({
              subject: { type: 'blank', value: '_:addr1' },
              predicate: { type: 'uri', value: 'http://example.org/city' },
              object: { type: 'literal', value: 'Anytown' }
            })
          ]
        }),
        expected: {
          blankNodeCount: 1,
          tripleCount: 3
        }
      }
    };
  }

  /**
   * Create performance test scenarios
   */
  static createPerformanceScenarios() {
    return {
      largeTurtle: this.createDataset({
        triples: Array.from({ length: 10000 }, (_, i) => 
          this.createTriple({
            subject: { type: 'uri', value: `http://example.org/item${i}` },
            predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
            object: { type: 'literal', value: `Item ${i}` }
          })
        )
      }),

      deepNesting: (() => {
        const triples: TurtleTriple[] = [];
        let currentSubject = 'http://example.org/root';
        
        for (let i = 0; i < 100; i++) {
          const nextSubject = `http://example.org/node${i}`;
          triples.push(this.createTriple({
            subject: { type: 'uri', value: currentSubject },
            predicate: { type: 'uri', value: 'http://example.org/hasChild' },
            object: { type: 'uri', value: nextSubject }
          }));
          currentSubject = nextSubject;
        }
        
        return this.createDataset({ triples });
      })(),

      wideBranching: (() => {
        const triples: TurtleTriple[] = [];
        const rootSubject = 'http://example.org/root';
        
        for (let i = 0; i < 1000; i++) {
          triples.push(this.createTriple({
            subject: { type: 'uri', value: rootSubject },
            predicate: { type: 'uri', value: `http://example.org/property${i}` },
            object: { type: 'literal', value: `Value ${i}` }
          }));
        }
        
        return this.createDataset({ triples });
      })()
    };
  }

  /**
   * Create malformed RDF for error testing
   */
  static createMalformedRDF() {
    return {
      invalidTriple: {
        turtle: `@prefix ex: <http://example.org/> .
        ex:subject ex:predicate . # Missing object`,
        expectedError: 'Missing object'
      },

      invalidPrefixDeclaration: {
        turtle: `@prefix : <http://example.org/ . # Missing closing bracket
        :subject :predicate :object .`,
        expectedError: 'Invalid prefix declaration'
      },

      invalidURI: {
        turtle: `@prefix ex: <http://example.org/> .
        <http://invalid uri with spaces> ex:predicate ex:object .`,
        expectedError: 'Invalid URI'
      },

      invalidLiteral: {
        turtle: `@prefix ex: <http://example.org/> .
        ex:subject ex:predicate "unclosed literal .`,
        expectedError: 'Unclosed literal'
      }
    };
  }

  /**
   * Create SPARQL query scenarios
   */
  static createSPARQLScenarios() {
    return {
      selectAll: {
        query: 'SELECT * WHERE { ?s ?p ?o }',
        dataset: this.createDataset(),
        expectedResultType: 'bindings'
      },

      selectPersons: {
        query: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
                SELECT ?person ?name WHERE {
                  ?person a foaf:Person ;
                          foaf:name ?name .
                }`,
        dataset: this.createDataset(),
        expectedResultType: 'bindings'
      },

      construct: {
        query: `PREFIX ex: <http://example.org/>
                CONSTRUCT { ?s ex:simplified ?o }
                WHERE { ?s ?p ?o }`,
        dataset: this.createDataset(),
        expectedResultType: 'graph'
      },

      ask: {
        query: `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
                ASK { ?person a foaf:Person }`,
        dataset: this.createDataset(),
        expectedResultType: 'boolean'
      }
    };
  }
}

// Convenience exports
export const {
  createNode,
  createTriple,
  createPrefixes,
  createDataset,
  createOntology,
  generateTurtleDocument,
  createRDFScenarios,
  createPerformanceScenarios,
  createMalformedRDF,
  createSPARQLScenarios
} = RDFFactory;