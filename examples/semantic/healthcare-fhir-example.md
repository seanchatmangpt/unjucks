# Healthcare FHIR Semantic Generation Example

## Overview

This example demonstrates generating TypeScript interfaces and validation schemas from HL7 FHIR (Fast Healthcare Interoperability Resources) semantic data using Unjucks templates.

## FHIR RDF/Turtle Input

```turtle
@prefix fhir: <http://hl7.org/fhir/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

fhir:Patient a fhir:Resource ;
    rdfs:label "Patient" ;
    fhir:definition "Demographics and administrative information about an individual receiving care" ;
    fhir:element [
        fhir:name "identifier" ;
        fhir:type fhir:Identifier ;
        fhir:cardinality "0..*"
    ] ,
    [
        fhir:name "name" ;
        fhir:type fhir:HumanName ;
        fhir:cardinality "0..*"
    ] ,
    [
        fhir:name "birthDate" ;
        fhir:type fhir:date ;
        fhir:cardinality "0..1"
    ] .

fhir:Observation a fhir:Resource ;
    rdfs:label "Observation" ;
    fhir:definition "Measurements and assertions about a patient, device or other subject" ;
    fhir:element [
        fhir:name "status" ;
        fhir:type fhir:code ;
        fhir:cardinality "1..1" ;
        fhir:binding fhir:ObservationStatus
    ] ,
    [
        fhir:name "code" ;
        fhir:type fhir:CodeableConcept ;
        fhir:cardinality "1..1"
    ] ,
    [
        fhir:name "subject" ;
        fhir:type fhir:Reference ;
        fhir:cardinality "0..1" ;
        fhir:targetProfile fhir:Patient
    ] .
```

## Generation Command

```bash
# Generate TypeScript FHIR models from R4 specification
unjucks generate fhir-resources healthcare \
  --fhirVersion R4 \
  --specFile ./data/fhir-r4-spec.ttl \
  --resources Patient,Observation,DiagnosticReport \
  --outputDir ./src/models/fhir \
  --generateValidators true \
  --includeSearchParams true \
  --format typescript
```

## Generated Output

### `src/models/fhir/Patient.ts`

```typescript
/**
 * Patient - Demographics and administrative information about an individual receiving care
 * FHIR R4 Resource: http://hl7.org/fhir/Patient
 */
export interface Patient extends FhirResource {
  readonly resourceType: 'Patient';
  
  /** Business identifiers for this patient */
  identifier?: Identifier[];
  
  /** Whether this patient record is in active use */
  active?: boolean;
  
  /** A name associated with the patient */
  name?: HumanName[];
  
  /** A contact detail for the individual */
  telecom?: ContactPoint[];
  
  /** Administrative gender */
  gender?: PatientGender;
  
  /** The date of birth for the individual */
  birthDate?: string; // FHIR date format: YYYY-MM-DD
  
  /** Indicates if the individual is deceased */
  deceased?: boolean | string; // boolean or dateTime
  
  /** An address for the individual */
  address?: Address[];
  
  /** Marital (civil) status of a patient */
  maritalStatus?: CodeableConcept;
  
  /** Image of the patient */
  photo?: Attachment[];
  
  /** A contact party for the patient */
  contact?: PatientContact[];
  
  /** A language which may be used to communicate with the patient */
  communication?: PatientCommunication[];
}

export enum PatientGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  UNKNOWN = 'unknown'
}

export interface PatientContact {
  /** The kind of relationship */
  relationship?: CodeableConcept[];
  
  /** A name associated with the contact person */
  name?: HumanName;
  
  /** A contact detail for the person */
  telecom?: ContactPoint[];
  
  /** Address for the contact person */
  address?: Address;
  
  /** Administrative gender */
  gender?: PatientGender;
  
  /** Organization that is associated with the contact */
  organization?: Reference<Organization>;
  
  /** The period during which this contact person is valid */
  period?: Period;
}
```

### `src/models/fhir/Observation.ts`

```typescript
/**
 * Observation - Measurements and assertions about a patient, device or other subject
 * FHIR R4 Resource: http://hl7.org/fhir/Observation
 */
export interface Observation extends FhirResource {
  readonly resourceType: 'Observation';
  
  /** Business identifiers for this observation */
  identifier?: Identifier[];
  
  /** Fulfills plan, proposal or order */
  basedOn?: Reference<ServiceRequest | MedicationRequest>[];
  
  /** Part of referenced event */
  partOf?: Reference<Procedure | Immunization>[];
  
  /** Status of the result value */
  status: ObservationStatus; // Required field
  
  /** Classification of type of observation */
  category?: CodeableConcept[];
  
  /** Type of observation (code / type) */
  code: CodeableConcept; // Required field
  
  /** Who and/or what the observation is about */
  subject?: Reference<Patient | Group | Device | Location>;
  
  /** Healthcare encounter during which observation was made */
  encounter?: Reference<Encounter>;
  
  /** Clinically relevant time/time-period for observation */
  effective?: string | Period; // dateTime or Period
  
  /** Date/time observation was recorded */
  issued?: string; // instant
  
  /** Who is responsible for the observation */
  performer?: Reference<Practitioner | PractitionerRole | Organization>[];
  
  /** Actual result */
  value?: ObservationValue;
}

export enum ObservationStatus {
  REGISTERED = 'registered',
  PRELIMINARY = 'preliminary',
  FINAL = 'final',
  AMENDED = 'amended',
  CORRECTED = 'corrected',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown'
}

export type ObservationValue = 
  | Quantity 
  | CodeableConcept 
  | string 
  | boolean 
  | number 
  | Range 
  | Ratio 
  | SampledData 
  | string // time
  | string // dateTime
  | Period;
```

### `src/validators/fhir/PatientValidator.ts`

```typescript
import { z } from 'zod';
import { Patient, PatientGender } from '../models/fhir/Patient';

export const PatientSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string().optional(),
  meta: z.object({}).optional(),
  identifier: z.array(IdentifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(HumanNameSchema).optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  deceased: z.union([z.boolean(), z.string()]).optional(),
  address: z.array(AddressSchema).optional(),
  telecom: z.array(ContactPointSchema).optional(),
  maritalStatus: CodeableConceptSchema.optional(),
  photo: z.array(AttachmentSchema).optional(),
  contact: z.array(PatientContactSchema).optional(),
  communication: z.array(PatientCommunicationSchema).optional()
});

export function validatePatient(data: unknown): Patient {
  return PatientSchema.parse(data);
}

export function isValidPatient(data: unknown): data is Patient {
  return PatientSchema.safeParse(data).success;
}
```

## Template Structure

```
templates/fhir-resources/
├── _shared/
│   ├── base-types.ts.njk     # Common FHIR types
│   ├── primitives.ts.njk     # FHIR primitive types
│   └── search-params.ts.njk  # Search parameter definitions
├── resource.ts.njk           # Main resource template
├── validator.ts.njk          # Zod validation schemas
├── search-client.ts.njk      # FHIR search client
└── index.ts.njk             # Barrel exports
```

## Usage in Healthcare Application

```typescript
import { Patient, Observation, validatePatient } from './models/fhir';
import { FhirClient } from './clients/FhirClient';

// Create a patient record
const patient: Patient = {
  resourceType: 'Patient',
  identifier: [{
    system: 'http://hospital.example.org/patients',
    value: 'P12345'
  }],
  name: [{
    family: 'Smith',
    given: ['John', 'Michael']
  }],
  gender: PatientGender.MALE,
  birthDate: '1985-06-15',
  active: true
};

// Validate patient data
try {
  const validatedPatient = validatePatient(patient);
  console.log('Patient is valid:', validatedPatient.id);
} catch (error) {
  console.error('Patient validation failed:', error);
}

// Search for patients
const client = new FhirClient('https://fhir.example.org');
const searchResults = await client.search('Patient', {
  family: 'Smith',
  gender: 'male',
  birthdate: 'ge1980-01-01'
});
```

## Benefits

- **FHIR Compliance**: Generated models conform to HL7 FHIR R4 specification
- **Interoperability**: Standard format enables healthcare system integration
- **Type Safety**: Full TypeScript support for FHIR resources
- **Validation**: Built-in data validation using Zod schemas
- **Search Support**: Generated search parameter definitions
- **Documentation**: Auto-generated from FHIR specification descriptions