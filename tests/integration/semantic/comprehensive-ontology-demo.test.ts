import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Unjucks } from '../../../src/index.js';
import { validateOwl } from '../../../src/lib/filters/semantic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Comprehensive Ontology Generation Demo', () => {
  let unjucks: Unjucks;
  let outputDir: string;

  beforeEach(async () => {
    outputDir = resolve(__dirname, '../../.tmp/ontology-demo-' + Date.now());
    await fs.mkdir(outputDir, { recursive: true });
    
    unjucks = new Unjucks({
      templateDirs: [resolve(__dirname, '../../fixtures/ontologies')],
      outputDir
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Semantic Web Application Ontologies', () => {
    it('should generate complete university domain ontology with all features', async () => {
      const universityOntology = {
        domain: 'university',
        nsPrefix: 'univ',
        namespace: 'http://university.example.org/ontology',
        description: 'Comprehensive university domain ontology with academic concepts, processes, and relationships',
        version: '2.1.0',
        createdDate: '2023-01-15T00:00:00.000Z',
        modifiedDate: '2023-12-15T00:00:00.000Z',
        
        entities: [
          {
            name: 'AcademicEntity',
            description: 'Base class for all academic entities',
            restrictions: [
              {
                property: 'hasIdentifier',
                type: 'cardinality',
                value: '1'
              }
            ]
          },
          {
            name: 'Person',
            description: 'Human individuals in university context',
            superClass: 'AcademicEntity',
            restrictions: [
              {
                property: 'hasName',
                type: 'someValuesFrom',
                value: 'PersonName'
              },
              {
                property: 'hasEmail',
                type: 'maxCardinality',
                value: '1'
              }
            ]
          },
          {
            name: 'Student',
            description: 'Person enrolled in academic programs',
            superClass: 'Person',
            restrictions: [
              {
                property: 'enrolledIn',
                type: 'someValuesFrom',
                value: 'AcademicProgram'
              },
              {
                property: 'hasStudentId',
                type: 'cardinality',
                value: '1'
              }
            ]
          },
          {
            name: 'Faculty',
            description: 'Academic staff members',
            superClass: 'Person',
            restrictions: [
              {
                property: 'teachesIn',
                type: 'someValuesFrom',
                value: 'Department'
              },
              {
                property: 'hasFacultyRank',
                type: 'cardinality',
                value: '1'
              }
            ]
          },
          {
            name: 'Course',
            description: 'Educational offering in specific subject',
            superClass: 'AcademicEntity',
            restrictions: [
              {
                property: 'hasCredits',
                type: 'cardinality',
                value: '1'
              },
              {
                property: 'offeredBy',
                type: 'someValuesFrom',
                value: 'Department'
              }
            ]
          },
          {
            name: 'Department',
            description: 'Academic administrative unit',
            superClass: 'AcademicEntity',
            restrictions: [
              {
                property: 'partOf',
                type: 'someValuesFrom',
                value: 'College'
              }
            ]
          }
        ],
        
        relations: [
          {
            name: 'hasIdentifier',
            type: 'datatype',
            description: 'Unique identifier for academic entity',
            domain: 'AcademicEntity',
            range: 'string',
            characteristics: ['Functional', 'InverseFunctional']
          },
          {
            name: 'hasName',
            type: 'datatype',
            description: 'Full name of person',
            domain: 'Person',
            range: 'string',
            characteristics: ['Functional']
          },
          {
            name: 'hasEmail',
            type: 'datatype',
            description: 'Email address',
            domain: 'Person',
            range: 'string',
            characteristics: ['Functional', 'InverseFunctional']
          },
          {
            name: 'enrolledIn',
            type: 'object',
            description: 'Student enrollment relationship',
            domain: 'Student',
            range: 'AcademicProgram'
          },
          {
            name: 'teachesIn',
            type: 'object',
            description: 'Faculty teaching assignment',
            domain: 'Faculty',
            range: 'Department'
          },
          {
            name: 'teaches',
            type: 'object',
            description: 'Faculty course instruction',
            domain: 'Faculty',
            range: 'Course',
            inverseOf: 'taughtBy'
          },
          {
            name: 'takes',
            type: 'object',
            description: 'Student course enrollment',
            domain: 'Student',
            range: 'Course',
            inverseOf: 'takenBy'
          },
          {
            name: 'hasGrade',
            type: 'datatype',
            description: 'Academic grade received',
            domain: 'Enrollment',
            range: 'string'
          },
          {
            name: 'hasCredits',
            type: 'datatype',
            description: 'Credit hours for course',
            domain: 'Course',
            range: 'nonNegativeInteger',
            characteristics: ['Functional']
          }
        ],
        
        enumerations: [
          {
            name: 'FacultyRank',
            values: ['AssistantProfessor', 'AssociateProfessor', 'Professor', 'Emeritus']
          },
          {
            name: 'StudentStatus',
            values: ['Active', 'OnLeave', 'Graduated', 'Withdrawn']
          },
          {
            name: 'GradeLevel',
            values: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
          },
          {
            name: 'Semester',
            values: ['Fall', 'Spring', 'Summer']
          }
        ]
      };

      const result = await unjucks.render('domain-ontology.owl.njk', universityOntology);
      
      // Validate ontology structure
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test all semantic filters are working correctly
      expect(result).toContain('univ:AcademicEntity rdf:type owl:Class');
      expect(result).toContain('univ:Student rdf:type owl:Class');
      expect(result).toContain('rdfs:subClassOf univ:Person');
      expect(result).toContain('rdfs:subClassOf univ:AcademicEntity');
      
      // Test restrictions with all types
      expect(result).toContain('owl:onProperty univ:hasIdentifier');
      expect(result).toContain('owl:cardinality "1"^^xsd:nonNegativeInteger');
      expect(result).toContain('owl:someValuesFrom univ:PersonName');
      expect(result).toContain('owl:maxCardinality "1"^^xsd:nonNegativeInteger');
      
      // Test property characteristics
      expect(result).toContain('rdf:type owl:FunctionalProperty');
      expect(result).toContain('rdf:type owl:InverseFunctionalProperty');
      expect(result).toContain('owl:inverseOf univ:taughtBy');
      
      // Test enumerations with individuals
      expect(result).toContain('univ:FacultyRank rdf:type owl:Class');
      expect(result).toContain('owl:oneOf ( univ:AssistantProfessor univ:AssociateProfessor univ:Professor univ:Emeritus )');
      expect(result).toContain('univ:AssistantProfessor rdf:type owl:NamedIndividual');
      
      // Test datatype properties
      expect(result).toContain('rdfs:range xsd:string');
      expect(result).toContain('rdfs:range xsd:nonNegativeInteger');
      
      // Test Dublin Core metadata
      expect(result).toContain('dcterms:created "2023-01-15T00:00:00.000Z"^^xsd:dateTime');
      expect(result).toContain('dcterms:modified "2023-12-15T00:00:00.000Z"^^xsd:dateTime');
      
      console.log('✅ University domain ontology validation passed');
    });

    it('should generate complete healthcare application ontology', async () => {
      const healthcareApp = {
        appName: 'HealthcareSystem',
        nsPrefix: 'health',
        namespace: 'http://healthcare.example.org/app',
        description: 'Healthcare management application ontology with clinical workflows',
        version: '1.3.0',
        createdDate: '2023-03-01T00:00:00.000Z',
        modifiedDate: '2023-12-20T00:00:00.000Z',
        creator: 'Healthcare IT Team',
        generationTool: 'Unjucks Semantic Generator',
        generationTime: '2023-12-25T12:00:00.000Z',
        baseOntology: 'http://purl.obolibrary.org/obo/hl7-fhir',
        
        modules: [
          {
            name: 'Clinical',
            entities: [
              {
                name: 'Patient',
                description: 'Individual receiving medical care',
                altLabels: ['Client', 'Individual', 'Subject'],
                businessRules: [
                  {
                    property: 'hasPatientId',
                    type: 'required',
                    valueClass: 'PatientIdentifier',
                    description: 'Every patient must have unique identifier'
                  },
                  {
                    property: 'hasPrimaryPhysician',
                    type: 'unique',
                    description: 'Patient can have only one primary physician'
                  }
                ],
                lifecycle: 'patient'
              },
              {
                name: 'Physician',
                description: 'Licensed medical practitioner',
                interfaces: ['ClinicalProvider', 'Prescriber'],
                businessRules: [
                  {
                    property: 'hasLicense',
                    type: 'required',
                    valueClass: 'MedicalLicense',
                    description: 'Physician must have valid medical license'
                  }
                ]
              },
              {
                name: 'Diagnosis',
                description: 'Medical condition identification',
                businessRules: [
                  {
                    property: 'hasICD10Code',
                    type: 'required',
                    valueClass: 'ICD10Code',
                    description: 'Diagnosis must have ICD-10 classification'
                  }
                ]
              },
              {
                name: 'Treatment',
                description: 'Medical intervention or therapy',
                businessRules: [
                  {
                    property: 'prescribedBy',
                    type: 'required',
                    valueClass: 'Physician',
                    description: 'Treatment must be prescribed by physician'
                  }
                ]
              }
            ]
          },
          {
            name: 'Administrative',
            entities: [
              {
                name: 'Appointment',
                description: 'Scheduled medical consultation',
                businessRules: [
                  {
                    property: 'scheduledFor',
                    type: 'required',
                    description: 'Appointment must have scheduled time'
                  },
                  {
                    property: 'withPhysician',
                    type: 'required',
                    valueClass: 'Physician',
                    description: 'Appointment must be with specific physician'
                  }
                ]
              }
            ]
          }
        ],
        
        propertyGroups: [
          {
            name: 'Identification',
            properties: [
              {
                name: 'hasPatientId',
                type: 'datatype',
                description: 'Unique patient identifier',
                domain: 'Patient',
                range: 'string',
                characteristics: ['Functional', 'InverseFunctional'],
                validation: {
                  pattern: '^PAT[0-9]{8}$',
                  minLength: 11,
                  maxLength: 11
                },
                businessContext: 'Patient Management'
              },
              {
                name: 'hasLicenseNumber',
                type: 'datatype',
                description: 'Medical license number',
                domain: 'Physician',
                range: 'string',
                characteristics: ['Functional', 'InverseFunctional'],
                validation: {
                  pattern: '^MD[A-Z]{2}[0-9]{6}$'
                }
              }
            ]
          },
          {
            name: 'Clinical',
            properties: [
              {
                name: 'diagnosedWith',
                type: 'object',
                description: 'Patient diagnosis relationship',
                domain: 'Patient',
                range: 'Diagnosis',
                businessContext: 'Clinical Assessment'
              },
              {
                name: 'treatedWith',
                type: 'object',
                description: 'Patient treatment relationship',
                domain: 'Patient',
                range: 'Treatment',
                businessContext: 'Treatment Planning'
              }
            ]
          }
        ],
        
        businessProcesses: [
          {
            name: 'PatientAdmission',
            description: 'Process of admitting new patient',
            steps: [
              {
                name: 'VerifyInsurance',
                description: 'Verify patient insurance coverage',
                preconditions: ['InsuranceCardProvided'],
                postconditions: ['InsuranceVerified']
              },
              {
                name: 'CreatePatientRecord',
                description: 'Create new patient medical record',
                preconditions: ['InsuranceVerified', 'ConsentSigned'],
                postconditions: ['PatientRecordCreated']
              },
              {
                name: 'ScheduleInitialConsultation',
                description: 'Schedule first appointment with physician',
                preconditions: ['PatientRecordCreated'],
                postconditions: ['AppointmentScheduled']
              }
            ],
            triggers: ['PatientArrival', 'EmergencyAdmission']
          }
        ],
        
        integrations: [
          {
            name: 'EHRSystem',
            description: 'Electronic Health Records integration',
            externalOntology: 'http://hl7.org/fhir',
            mappings: [
              { externalClass: 'Patient' },
              { externalClass: 'Practitioner' },
              { externalClass: 'Encounter' }
            ]
          },
          {
            name: 'LabSystem',
            description: 'Laboratory information system integration',
            externalOntology: 'http://loinc.org',
            mappings: [
              { externalClass: 'Observation' },
              { externalClass: 'DiagnosticReport' }
            ]
          }
        ],
        
        individuals: [
          {
            name: 'EmergencyDepartment',
            type: 'Department',
            description: 'Emergency medical services department',
            properties: {
              departmentCode: 'EMRG',
              isEmergencyDept: 'true'
            }
          },
          {
            name: 'DefaultInsuranceProvider',
            type: 'InsuranceProvider',
            description: 'Default insurance for uninsured patients',
            properties: {
              providerName: 'State Healthcare Fund',
              coverageType: 'Basic'
            }
          }
        ]
      };

      const result = await unjucks.render('application-ontology.owl.njk', healthcareApp);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Test healthcare-specific elements
      expect(result).toContain('health:Patient rdf:type owl:Class');
      expect(result).toContain('health:Physician rdf:type owl:Class');
      expect(result).toContain('skos:altLabel "Client"@en');
      expect(result).toContain('skos:altLabel "Individual"@en');
      
      // Test business rules as restrictions
      expect(result).toContain('owl:someValuesFrom health:PatientIdentifier');
      expect(result).toContain('owl:maxCardinality "1"^^xsd:nonNegativeInteger');
      expect(result).toContain('"Every patient must have unique identifier"@en');
      
      // Test property validation patterns
      expect(result).toContain('owl:withRestrictions ( [ xsd:pattern "^PAT[0-9]{8}$" ] )');
      expect(result).toContain('owl:withRestrictions ( [ xsd:minLength 11 ] )');
      expect(result).toContain('owl:withRestrictions ( [ xsd:maxLength 11 ] )');
      
      // Test business processes
      expect(result).toContain('health:PatientAdmissionProcess rdf:type owl:Class');
      expect(result).toContain('health:VerifyInsuranceStep rdf:type owl:Class');
      expect(result).toContain('health:hasPrecondition health:InsuranceCardProvidedCondition');
      
      // Test integrations
      expect(result).toContain('health:EHRSystemIntegration rdf:type owl:Class');
      expect(result).toContain('health:integratesWith <http://hl7.org/fhir>');
      expect(result).toContain('owl:equivalentClass <http://hl7.org/fhir#Patient>');
      
      // Test individuals
      expect(result).toContain('health:EmergencyDepartment rdf:type owl:NamedIndividual');
      expect(result).toContain('health:departmentCode "EMRG"@en');
      
      // Test provenance
      expect(result).toContain('prov:wasGeneratedBy [');
      expect(result).toContain('prov:used "Unjucks Semantic Generator"@en');
      
      console.log('✅ Healthcare application ontology validation passed');
    });

    it('should generate complex cross-vocabulary mapping with transformations', async () => {
      const complexMapping = {
        mappingName: 'HealthcareFHIRMapping',
        nsPrefix: 'map',
        namespace: 'http://healthcare.example.org/mapping',
        description: 'Complex mapping between healthcare ontologies and HL7 FHIR',
        version: '1.1.0',
        externalPrefixes: [
          { name: 'fhir', uri: 'http://hl7.org/fhir/' },
          { name: 'snomed', uri: 'http://snomed.info/sct/' },
          { name: 'loinc', uri: 'http://loinc.org/' },
          { name: 'icd10', uri: 'http://id.who.int/icd10/' }
        ],
        sourceOntologies: ['http://healthcare.example.org/app'],
        targetOntologies: ['http://hl7.org/fhir/', 'http://snomed.info/sct/'],
        
        classMappings: [
          {
            sourceClass: 'Patient',
            sourcePrefix: 'health',
            targetClass: 'Patient',
            targetPrefix: 'fhir',
            relation: 'equivalent',
            confidence: 0.98,
            notes: 'Direct mapping with same semantics'
          },
          {
            sourceClass: 'Physician',
            sourcePrefix: 'health',
            targetClass: 'Practitioner',
            targetPrefix: 'fhir',
            relation: 'closeMatch',
            confidence: 0.85,
            notes: 'Physician is specialized type of Practitioner'
          },
          {
            sourceClass: 'Diagnosis',
            sourcePrefix: 'health',
            targetClass: 'Condition',
            targetPrefix: 'fhir',
            relation: 'broadMatch',
            confidence: 0.80,
            notes: 'Diagnosis maps to broader FHIR Condition concept'
          }
        ],
        
        propertyMappings: [
          {
            sourceProperty: 'hasPatientId',
            sourcePrefix: 'health',
            targetProperty: 'identifier',
            targetPrefix: 'fhir',
            relation: 'equivalent',
            transformation: {
              type: 'format',
              pattern: '^PAT([0-9]{8})$',
              function: 'extractPatientNumber'
            }
          },
          {
            sourceProperty: 'diagnosedWith',
            sourcePrefix: 'health',
            targetProperty: 'condition',
            targetPrefix: 'fhir',
            relation: 'closeMatch',
            transformation: {
              type: 'encoding',
              pattern: 'ICD10',
              function: 'mapToSNOMED'
            }
          },
          {
            sourceProperty: 'birthDate',
            sourcePrefix: 'health',
            targetProperty: 'birthDate',
            targetPrefix: 'fhir',
            relation: 'equivalent',
            transformation: {
              type: 'format',
              pattern: 'yyyy-MM-dd',
              function: 'dateFormat'
            }
          }
        ],
        
        complexMappings: [
          {
            name: 'MedicalPractitioner',
            description: 'Medical practitioner with valid license',
            type: 'intersection',
            sourcePrefix: 'health',
            targetPrefix: 'fhir',
            classes: ['Physician', 'LicensedPractitioner'],
            targetEquivalent: 'Practitioner'
          },
          {
            name: 'ActivePatient',
            description: 'Patient with active status restriction',
            type: 'restriction',
            sourcePrefix: 'health',
            targetPrefix: 'fhir',
            property: 'hasStatus',
            restrictionType: 'hasValue',
            valueClass: 'ActiveStatus'
          },
          {
            name: 'ClinicalEncounter',
            description: 'Union of appointments and consultations',
            type: 'union',
            sourcePrefix: 'health',
            targetPrefix: 'fhir',
            classes: ['Appointment', 'Consultation'],
            targetEquivalent: 'Encounter'
          }
        ],
        
        bridgeAxioms: [
          {
            name: 'PatientIdentity',
            subject: 'health:Patient',
            predicate: 'owl:equivalentClass',
            object: 'fhir:Patient',
            type: 'equivalence',
            confidence: 1.0,
            conditions: 'Both represent individual receiving healthcare',
            justification: 'Semantic equivalence confirmed by domain experts'
          },
          {
            name: 'DiagnosisMapping',
            subject: 'health:hasICD10Code',
            predicate: 'skos:closeMatch',
            object: 'snomed:hasCode',
            type: 'property_alignment',
            confidence: 0.75,
            conditions: 'When diagnosis codes are standardized',
            justification: 'ICD-10 can be mapped to SNOMED CT with some loss of granularity'
          }
        ]
      };

      const result = await unjucks.render('mapping-ontology.owl.njk', complexMapping);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Test complex namespace handling
      expect(result).toContain('@prefix fhir: <http://hl7.org/fhir/> .');
      expect(result).toContain('@prefix snomed: <http://snomed.info/sct/> .');
      expect(result).toContain('@prefix loinc: <http://loinc.org/> .');
      expect(result).toContain('@prefix icd10: <http://id.who.int/icd10/> .');
      
      // Test class mappings with confidence scores
      expect(result).toContain('health:Patient owl:equivalentClass fhir:Patient');
      expect(result).toContain('map:mappingConfidence "0.98"^^xsd:float');
      expect(result).toContain('health:Physician skos:closeMatch fhir:Practitioner');
      expect(result).toContain('health:Diagnosis skos:broadMatch fhir:Condition');
      
      // Test property mappings with complex transformations
      expect(result).toContain('health:hasPatientId owl:equivalentProperty fhir:identifier');
      expect(result).toContain('map:hasTransformation [');
      expect(result).toContain('map:transformationType "format"');
      expect(result).toContain('map:transformationPattern "^PAT([0-9]{8})$"');
      expect(result).toContain('map:transformationFunction "extractPatientNumber"');
      
      // Test complex class expressions
      expect(result).toContain('map:MedicalPractitioner rdf:type owl:Class');
      expect(result).toContain('owl:intersectionOf (');
      expect(result).toContain('health:Physician health:LicensedPractitioner');
      expect(result).toContain('owl:equivalentClass fhir:Practitioner');
      
      expect(result).toContain('map:ActivePatient');
      expect(result).toContain('owl:onProperty health:hasStatus');
      expect(result).toContain('owl:hasValue health:ActiveStatus');
      
      expect(result).toContain('map:ClinicalEncounter');
      expect(result).toContain('owl:unionOf (');
      expect(result).toContain('health:Appointment health:Consultation');
      
      // Test bridge axioms with detailed annotations
      expect(result).toContain('owl:annotatedSource health:Patient');
      expect(result).toContain('owl:annotatedProperty owl:equivalentClass');
      expect(result).toContain('owl:annotatedTarget fhir:Patient');
      expect(result).toContain('map:bridgeConditions "Both represent individual receiving healthcare"@en');
      expect(result).toContain('map:bridgeConfidence "1"^^xsd:float');
      
      // Test SKOS alignment relations
      expect(result).toContain('skos:closeMatch');
      expect(result).toContain('skos:broadMatch');
      
      console.log('✅ Complex cross-vocabulary mapping validation passed');
    });
  });

  describe('Real-World Ontology Generation Performance', () => {
    it('should generate enterprise-scale ontology efficiently', async () => {
      // Generate a realistic enterprise ontology
      const enterpriseClasses = Array.from({ length: 200 }, (_, i) => {
        const categoryIndex = Math.floor(i / 40);
        const categories = ['Person', 'Document', 'Process', 'Resource', 'Event'];
        const category = categories[categoryIndex];
        
        return {
          name: `${category}${i}`,
          description: `Enterprise ${category.toLowerCase()} entity ${i}`,
          parentClass: i % 10 === 0 ? undefined : `${category}${Math.floor(i / 10) * 10}`,
          restrictions: i % 5 === 0 ? [
            {
              property: `has${category}Id`,
              type: 'cardinality',
              value: '1'
            }
          ] : undefined
        };
      });

      const enterpriseProperties = Array.from({ length: 400 }, (_, i) => ({
        name: `property${i}`,
        type: i % 3 === 0 ? 'datatype' : 'object',
        description: `Enterprise property ${i}`,
        domain: enterpriseClasses[i % enterpriseClasses.length].name,
        range: i % 3 === 0 ? ['string', 'integer', 'dateTime'][i % 3] : enterpriseClasses[(i + 1) % enterpriseClasses.length].name,
        characteristics: i % 4 === 0 ? ['Functional'] : undefined
      }));

      const enterpriseOntology = {
        domain: 'enterprise',
        nsPrefix: 'ent',
        namespace: 'http://enterprise.example.org/ontology',
        description: 'Large-scale enterprise domain ontology',
        version: '3.0.0',
        createdDate: '2023-01-01T00:00:00.000Z',
        modifiedDate: '2023-12-25T00:00:00.000Z',
        entities: enterpriseClasses,
        relations: enterpriseProperties,
        enumerations: [
          {
            name: 'Priority',
            values: ['Low', 'Medium', 'High', 'Critical', 'Urgent']
          },
          {
            name: 'Status',
            values: ['Draft', 'InReview', 'Approved', 'Published', 'Archived']
          }
        ]
      };

      const startTime = performance.now();
      const result = await unjucks.render('domain-ontology.owl.njk', enterpriseOntology);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      const ontologySize = result.length;
      
      // Validate performance metrics
      expect(renderTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(ontologySize).toBeGreaterThan(100000); // Should be substantial size
      
      // Validate structure
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Count generated elements
      const classCount = (result.match(/ent:\w+ rdf:type owl:Class/g) || []).length;
      const propertyCount = (result.match(/ent:property\d+ rdf:type owl:\w+Property/g) || []).length;
      const restrictionCount = (result.match(/owl:Restriction/g) || []).length;
      const enumerationCount = (result.match(/owl:oneOf/g) || []).length;
      
      expect(classCount).toBe(200);
      expect(propertyCount).toBe(400);
      expect(restrictionCount).toBeGreaterThan(35); // ~40 classes with restrictions
      expect(enumerationCount).toBe(2);
      
      console.log(`✅ Enterprise ontology generated: ${classCount} classes, ${propertyCount} properties in ${renderTime.toFixed(2)}ms (${(ontologySize / 1024).toFixed(1)}KB)`);
    });
  });

  describe('Ontology Quality Metrics', () => {
    it('should generate ontologies with high semantic quality', async () => {
      const qualityTestData = {
        name: 'QualityTest',
        nsPrefix: 'qual',
        namespace: 'http://example.org/quality',
        title: 'Quality Validation Ontology',
        description: 'Ontology designed to test semantic quality metrics',
        classes: [
          {
            name: 'Animal',
            description: 'Living biological organism',
            equivalentClasses: ['LivingOrganism'],
            disjointWith: ['Plant', 'Mineral']
          },
          {
            name: 'Mammal',
            description: 'Warm-blooded vertebrate animal',
            parentClass: 'Animal',
            disjointWith: ['Bird', 'Reptile']
          },
          {
            name: 'Dog',
            description: 'Domesticated carnivorous mammal',
            parentClass: 'Mammal'
          }
        ],
        properties: [
          {
            name: 'hasParent',
            type: 'object',
            description: 'Biological parentage relation',
            domain: 'Animal',
            range: 'Animal',
            characteristics: ['Irreflexive', 'Asymmetric']
          },
          {
            name: 'hasOffspring',
            type: 'object',
            description: 'Biological offspring relation',
            domain: 'Animal',
            range: 'Animal',
            inverseOf: 'hasParent'
          },
          {
            name: 'age',
            type: 'datatype',
            description: 'Age in years',
            domain: 'Animal',
            range: 'nonNegativeInteger',
            characteristics: ['Functional']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', qualityTestData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Test semantic quality indicators
      
      // 1. Class hierarchy consistency
      expect(result).toContain('qual:Mammal rdf:type owl:Class');
      expect(result).toContain('rdfs:subClassOf qual:Animal');
      expect(result).toContain('qual:Dog rdf:type owl:Class');
      expect(result).toContain('rdfs:subClassOf qual:Mammal');
      
      // 2. Disjointness axioms for semantic clarity
      expect(result).toContain('owl:disjointWith qual:Plant');
      expect(result).toContain('owl:disjointWith qual:Mineral');
      expect(result).toContain('owl:disjointWith qual:Bird');
      
      // 3. Property characteristics for logical consistency
      expect(result).toContain('rdf:type owl:IrreflexiveProperty'); // hasParent cannot be reflexive
      expect(result).toContain('rdf:type owl:AsymmetricProperty'); // hasParent is asymmetric
      expect(result).toContain('owl:inverseOf qual:hasParent'); // Proper inverse relationships
      
      // 4. Functional properties for data integrity
      expect(result).toContain('rdf:type owl:FunctionalProperty'); // age is functional
      
      // 5. Proper datatype usage
      expect(result).toContain('rdfs:range xsd:nonNegativeInteger'); // Age cannot be negative
      
      // 6. Equivalent classes for interoperability
      expect(result).toContain('owl:equivalentClass qual:LivingOrganism');
      
      console.log('✅ Ontology quality metrics validation passed');
    });
  });
});