# Healthcare Service Generation from FHIR Ontology

This example demonstrates generating a HIPAA-compliant healthcare service using the FHIR R4 ontology.

## Prerequisites

```bash
# Install required ontology files
mkdir -p ./ontologies
curl -o ./ontologies/fhir-r4.ttl "http://hl7.org/fhir/fhir.ttl"
curl -o ./ontologies/snomed-ct.ttl "http://snomed.info/sct/snomed-ct.ttl"
```

## Basic Usage

```bash
# Generate a patient management service
unjucks generate semantic/healthcare-service \
  --serviceName "PatientManagement" \
  --withHealthcare true \
  --withPatientManagement true \
  --withObservations true \
  --withEncounters true \
  --to "./src/services/patient-management.service.ts"
```

## Advanced Usage with Custom Ontology

```bash
# Generate with custom FHIR profile
unjucks generate semantic/healthcare-service \
  --serviceName "CardiacCareService" \
  --withHealthcare true \
  --withPatientManagement true \
  --withObservations true \
  --ontology "./ontologies/cardiac-care-profile.ttl" \
  --compliance.framework "HIPAA" \
  --compliance.version "2023" \
  --semanticValidation true \
  --reasoning "rdfs"
```

## Generated Service Features

The generated healthcare service includes:

### 1. FHIR R4 Resource Management
- Patient resource CRUD operations
- Observation recording and retrieval
- Encounter management
- Diagnostic report handling

### 2. HIPAA Compliance
- Minimum necessary principle implementation
- Comprehensive audit logging
- Access control validation
- Encryption of sensitive data fields

### 3. Semantic Validation
- RDF-based type checking
- Ontology constraint validation
- Cross-resource relationship validation
- FHIR profile compliance

### 4. Example Generated Code

```typescript
/**
 * PatientManagement Healthcare Service
 * 
 * Generated from FHIR R4 ontology with HIPAA compliance
 * Semantic validation: {"typeChecking": true, "profileCompliance": true}
 * 
 * @ontology FHIR R4 (http://hl7.org/fhir)
 * @compliance HIPAA 2023
 * @generated 2024-01-15T10:30:00.000Z
 */

export class PatientManagementService {
  async createPatient(
    patientData: Partial<Patient>,
    requesterContext: { userId: string; role: string; purpose: string }
  ): Promise<Patient> {
    // Access control validation
    await this.accessControl.validateAccess(
      requesterContext,
      'patient:create',
      { purpose: requesterContext.purpose }
    );

    // Audit log the access attempt
    await this.auditLogger.logAccess({
      action: 'CREATE',
      resourceType: 'Patient',
      userId: requesterContext.userId,
      timestamp: new Date(),
      purpose: requesterContext.purpose,
      minimumNecessary: true
    });

    // Create FHIR-compliant patient resource
    const patient: Patient = {
      resourceType: 'Patient',
      id: uuidv4(),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        security: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
            code: 'HCOMPL',
            display: 'HIPAA Compliant'
          }
        ]
      },
      // ... encrypted patient data
    };

    return patient;
  }
}
```

## Ontology-Driven Features

### Semantic Validation
The generated service validates against FHIR ontology constraints:
- Required fields based on FHIR resource definitions
- Data type validation using RDF schemas
- Cardinality constraints from ontology
- Terminology binding validation

### Compliance Rules
HIPAA compliance rules are derived from regulatory ontologies:
- Minimum necessary access controls
- Audit logging requirements
- Encryption mandates
- Access purpose validation

### Performance Optimization
The semantic renderer optimizes based on ontology analysis:
- Caches frequently accessed ontology patterns
- Pre-validates common constraint patterns
- Optimizes SPARQL queries for template variables
- Monitors semantic reasoning performance

## Template Variables from Ontology

The FHIR ontology automatically provides these template variables:
- `$ontologies.fhir.classes` - All FHIR resource types
- `$ontologies.fhir.properties` - FHIR element properties
- `$compliance.framework` - Regulatory framework
- `$compliance.validationResults` - Compliance check results
- `$performance.ontologyLoadTime` - Semantic processing metrics

## Custom Extensions

Extend the template with custom FHIR profiles:

```yaml
---
ontologies:
  fhir:
    uri: "http://hl7.org/fhir"
    local: "./ontologies/fhir-r4.ttl"
  cardiacProfile:
    uri: "http://example.org/fhir/cardiac-profile"
    local: "./ontologies/cardiac-care-profile.ttl"
semanticValidation: true
reasoning: "owl"
compliance:
  framework: "HIPAA"
  rules: ["minimum_necessary", "access_controls"]
---
```

This example shows how semantic templates convert domain knowledge into production-ready, compliant code with built-in validation and performance optimization.