# Financial Ontology (FIBO) Semantic Generation Example

## Overview

This example demonstrates generating TypeScript interfaces and data models from Financial Industry Business Ontology (FIBO) semantic data using Unjucks templates.

## FIBO RDF/Turtle Input

```turtle
@prefix fibo-be-le-fbo: <https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/FormalBusinessOrganizations/> .
@prefix fibo-fbc-fct-fse: <https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/FinancialServicesEntities/> .
@prefix fibo-fbc-fi-fi: <https://spec.edmcouncil.org/fibo/ontology/FBC/FinancialInstruments/FinancialInstruments/> .

fibo-be-le-fbo:Corporation a owl:Class ;
    rdfs:label "Corporation" ;
    rdfs:subClassOf fibo-be-le-fbo:FormalOrganization ;
    fibo:definition "A legal entity that is incorporated under the laws of some jurisdiction" .

fibo-fbc-fct-fse:FinancialInstitution a owl:Class ;
    rdfs:label "Financial Institution" ;
    rdfs:subClassOf fibo-be-le-fbo:Corporation ;
    fibo:definition "An organization that provides financial services to clients or members" .

fibo-fbc-fi-fi:FinancialInstrument a owl:Class ;
    rdfs:label "Financial Instrument" ;
    fibo:definition "A tradable asset of any kind, either cash, evidence of an ownership interest in an entity, or a contractual right" .
```

## Generation Command

```bash
# Generate TypeScript financial models from FIBO ontology
unjucks generate fibo-models financial \
  --ontologyFile ./data/fibo-sample.ttl \
  --namespace "https://spec.edmcouncil.org/fibo/ontology/" \
  --outputDir ./src/models/financial \
  --generateValidators true \
  --includeDocumentation true
```

## Generated Output

### `src/models/financial/Corporation.ts`

```typescript
/**
 * Corporation - A legal entity that is incorporated under the laws of some jurisdiction
 * Generated from FIBO ontology: https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/FormalBusinessOrganizations/Corporation
 */
export interface Corporation extends FormalOrganization {
  readonly type: 'Corporation';
  
  /** Jurisdiction under which the corporation is incorporated */
  jurisdictionOfIncorporation: string;
  
  /** Legal entity identifier */
  lei?: string;
  
  /** Registration date */
  incorporationDate: Date;
  
  /** Corporate structure type */
  corporateForm: CorporateForm;
}

export enum CorporateForm {
  LLC = 'LLC',
  INC = 'INC',
  CORP = 'CORP',
  LTD = 'LTD'
}
```

### `src/models/financial/FinancialInstitution.ts`

```typescript
/**
 * Financial Institution - An organization that provides financial services to clients or members
 * Generated from FIBO ontology
 */
export interface FinancialInstitution extends Corporation {
  readonly type: 'FinancialInstitution';
  
  /** Financial services provided */
  services: FinancialService[];
  
  /** Regulatory licenses held */
  licenses: RegulatoryLicense[];
  
  /** Primary regulatory authority */
  primaryRegulator: string;
  
  /** Capital adequacy ratio */
  capitalRatio?: number;
}

export interface FinancialService {
  serviceType: string;
  description: string;
  regulatoryCode?: string;
}

export interface RegulatoryLicense {
  licenseType: string;
  issuer: string;
  validFrom: Date;
  validTo?: Date;
  licenseNumber: string;
}
```

## Template Structure

```
templates/fibo-models/
├── _shared/
│   ├── types.ts.njk          # Common type definitions
│   └── validators.ts.njk     # Validation functions
├── interface.ts.njk          # Main interface template
├── enum.ts.njk              # Enum generation template
└── index.ts.njk             # Barrel exports
```

## Usage in Application

```typescript
import { Corporation, FinancialInstitution } from './models/financial';

// Create a financial institution instance
const bank: FinancialInstitution = {
  type: 'FinancialInstitution',
  name: 'Example Bank Corp',
  jurisdictionOfIncorporation: 'Delaware, USA',
  incorporationDate: new Date('2010-01-15'),
  corporateForm: CorporateForm.CORP,
  services: [
    {
      serviceType: 'Commercial Banking',
      description: 'Business lending and deposits',
      regulatoryCode: 'CB001'
    }
  ],
  licenses: [
    {
      licenseType: 'Banking License',
      issuer: 'Federal Reserve',
      validFrom: new Date('2010-03-01'),
      licenseNumber: 'BL-12345'
    }
  ],
  primaryRegulator: 'Federal Reserve System',
  capitalRatio: 12.5
};
```

## Benefits

- **Standards Compliance**: Generated models follow FIBO ontology standards
- **Type Safety**: Full TypeScript type checking for financial data
- **Documentation**: Auto-generated JSDoc from ontology definitions
- **Validation**: Built-in data validation based on ontology constraints
- **Regulatory Alignment**: Models align with financial industry regulations