# Supply Chain Tracking with GS1 Digital Standards

This example demonstrates generating GS1-compliant supply chain tracking services using EPCIS and GS1 Digital Link ontologies.

## Prerequisites

```bash
# Install required ontology files
mkdir -p ./ontologies
curl -o ./ontologies/gs1-digital-link.ttl "https://gs1.org/voc/gs1-digital-link.ttl"
curl -o ./ontologies/epcis-2.0.ttl "https://ref.gs1.org/epcis/epcis-2.0.ttl"
curl -o ./ontologies/cbv-2.0.ttl "https://ref.gs1.org/cbv/cbv-2.0.ttl"
```

## Basic Usage

```bash
# Generate a supply chain tracking service
unjucks generate semantic/supply-chain \
  --serviceName "ProductTracing" \
  --withSupplyChain true \
  --withProductTracking true \
  --withMovementTracking true \
  --withAggregation true \
  --to "./src/services/product-tracing.service.ts"
```

## Advanced Multi-Standard Integration

```bash
# Generate with GS1, EPCIS, and blockchain integration
unjucks generate semantic/supply-chain \
  --serviceName "GlobalSupplyChain" \
  --withSupplyChain true \
  --withProductTracking true \
  --withMovementTracking true \
  --withAggregation true \
  --ontologies.gs1.uri "https://gs1.org/voc/" \
  --ontologies.epcis.uri "https://ref.gs1.org/epcis/" \
  --ontologies.cbv.uri "https://ref.gs1.org/cbv/" \
  --compliance.framework "GS1" \
  --compliance.version "2023" \
  --semanticValidation true \
  --reasoning "rdfs"
```

## Generated Service Features

The generated supply chain service includes:

### 1. GS1 Digital Standards Compliance
- Global Trade Item Numbers (GTIN) validation
- Global Location Numbers (GLN) validation
- Serial Shipping Container Codes (SSCC) generation
- Electronic Product Codes (EPC) management
- Digital Link URL generation

### 2. EPCIS 2.0 Event Management
- Object Events (product creation, observation, destruction)
- Aggregation Events (palletization, case packing)
- Transaction Events (business process tracking)
- Transformation Events (manufacturing processes)
- Error Declaration Events (corrections and recalls)

### 3. Core Business Vocabulary (CBV) Integration
- Standard business step definitions
- Disposition status tracking
- Business transaction types
- Measurement unit codes
- Standard vocabulary terms

### 4. Example Generated Code

```typescript
/**
 * ProductTracing Supply Chain Service
 * 
 * Generated from GS1 Digital Standards with EPCIS compliance
 * Semantic validation: {"uniqueIdentification": true, "interoperability": true}
 * 
 * @ontology GS1 Digital Standards (https://gs1.org/voc/)
 * @compliance GS1 2023, EPCIS 2.0
 * @generated 2024-01-15T10:30:00.000Z
 */

export class ProductTracingService {
  async registerProduct(productData: {
    gtin: string;
    productName: string;
    manufacturer: { gln: string; name: string; };
    lotNumber?: string;
    serialNumber?: string;
    productionDate?: Date;
  }): Promise<{
    digitalLink: string;
    epcisEventId: string;
    blockchainTxId?: string;
  }> {
    // Validate GTIN format with check digit
    if (!this.validateGTIN(productData.gtin)) {
      throw new Error(`Invalid GTIN format: ${productData.gtin}`);
    }

    // Generate EPC (Electronic Product Code)
    const epc = this.generateEPC({
      gtin: productData.gtin,
      lotNumber: productData.lotNumber,
      serialNumber: productData.serialNumber
    });

    // Generate GS1 Digital Link
    const digitalLink = await this.digitalLink.generateProductLink({
      gtin: productData.gtin,
      lot: productData.lotNumber,
      ser: productData.serialNumber,
      manufacturerGln: productData.manufacturer.gln
    });

    // Create EPCIS Object Event
    const objectEvent: ObjectEvent = {
      eventType: 'ObjectEvent',
      eventTime: new Date(),
      eventID: `urn:uuid:${this.generateUUID()}`,
      epcList: [epc],
      action: 'ADD',
      bizStep: 'urn:epcglobal:cbv:bizstep:commissioning',
      disposition: 'urn:epcglobal:cbv:disp:active',
      readPoint: {
        id: `urn:epc:id:sgln:${productData.manufacturer.gln}.0`
      }
    };

    await this.recordEPCISEvent(objectEvent);
    
    return {
      digitalLink,
      epcisEventId: objectEvent.eventID
    };
  }
}
```

## Ontology-Driven Features

### GS1 Identifier Validation
The generated service validates GS1 identifiers against ontology constraints:
- GTIN check digit validation using modulo-10 algorithm
- GLN structure and check digit validation
- SSCC format validation with extension digits
- EPC URI scheme compliance

### EPCIS Event Semantics
Events are validated against EPCIS ontology:
- Required fields based on event type
- Business step vocabulary validation
- Disposition state transitions
- Timestamp and timezone requirements

### CBV Vocabulary Compliance
Standard vocabulary terms from CBV:
- Business steps (commissioning, shipping, receiving, etc.)
- Dispositions (active, in_transit, sold, etc.)
- Business transaction types (purchase orders, invoices, etc.)

## Template Variables from Ontology

The GS1 ontologies provide these semantic variables:

```javascript
// Available in templates
$ontologies.gs1.classes = [
  { uri: 'https://gs1.org/voc/Product' },
  { uri: 'https://gs1.org/voc/Location' },
  { uri: 'https://gs1.org/voc/Organization' }
];

$ontologies.epcis.classes = [
  { uri: 'https://ref.gs1.org/epcis/ObjectEvent' },
  { uri: 'https://ref.gs1.org/epcis/AggregationEvent' },
  { uri: 'https://ref.gs1.org/epcis/TransactionEvent' }
];

$compliance.validationResults = {
  "unique_identification": true,
  "interoperability": true,
  "data_quality": true
};
```

## Real-World Integration Examples

### Food Traceability
```typescript
// Track food products from farm to table
const foodService = new ProductTracingService();

const registration = await foodService.registerProduct({
  gtin: '01234567890123',
  productName: 'Organic Apples',
  manufacturer: {
    gln: '1234567890123',
    name: 'Fresh Farms Inc.'
  },
  lotNumber: 'LOT2024001',
  productionDate: new Date('2024-01-15'),
  expirationDate: new Date('2024-02-15')
});

// Track movement through supply chain
await foodService.trackMovement({
  epcs: [registration.epc],
  action: 'OBSERVE',
  bizStep: 'urn:epcglobal:cbv:bizstep:shipping',
  toLocation: {
    gln: '9876543210987',
    name: 'Distribution Center'
  },
  temperature: { value: 4, unit: 'CELSIUS' }
});
```

### Pharmaceutical Supply Chain
```typescript
// Track medications with serialization
const pharmaService = new ProductTracingService();

const drugRegistration = await pharmaService.registerProduct({
  gtin: '03456789012345',
  productName: 'Generic Medicine XYZ',
  manufacturer: {
    gln: '5555555555555',
    name: 'Pharma Corp'
  },
  serialNumber: 'SN123456789',
  lotNumber: 'BATCH2024A',
  expirationDate: new Date('2026-12-31')
});

// Create aggregation for shipping container
await pharmaService.aggregateProducts({
  childEPCs: [drugRegistration.epc],
  action: 'ADD',
  bizStep: 'urn:epcglobal:cbv:bizstep:packing',
  location: pharmaService.manufacturer,
  aggregationType: 'CONTAINER'
});
```

### Blockchain Integration
```typescript
// Enable blockchain traceability
const blockchainService = new ProductTracingService({
  blockchainEnabled: true,
  qualityControlLevel: 'enhanced'
});

const registration = await blockchainService.registerProduct({
  // ... product data
});

// Blockchain transaction ID is automatically generated
console.log(`Blockchain TX: ${registration.blockchainTxId}`);

// Query full supply chain history
const history = await blockchainService.getSupplyChainHistory(
  registration.epc,
  { includeChildren: true, includeParents: true }
);
```

## Compliance and Quality Assurance

### Automatic Quality Monitoring
```yaml
---
ontologies:
  gs1:
    uri: "https://gs1.org/voc/"
  epcis:
    uri: "https://ref.gs1.org/epcis/"
compliance:
  framework: "GS1"
  rules:
    - "unique_identification"
    - "interoperability"
    - "data_quality"
    - "authenticity"
    - "privacy_protection"
---

<!-- Template includes automatic quality checks -->
<% if (context.qualityControlLevel === 'enhanced') { %>
// Enhanced quality control with environmental monitoring
const qualityCheck = await this.qualityAssurance.checkEnvironmentalConditions({
  temperature: movementData.temperature,
  humidity: movementData.humidity,
  location: movementData.toLocation.gln,
  products: movementData.epcs
});

if (qualityCheck.overallStatus === 'FAIL') {
  // Create error declaration event
  const errorEvent = {
    ...objectEvent,
    errorDeclaration: {
      declarationTime: new Date(),
      reason: 'Quality control failure',
      correctiveEventIDs: [objectEvent.eventID]
    }
  };
}
<% } %>
```

### Sustainability Metrics
```typescript
// Automatic sustainability tracking
const sustainabilityMetrics = await service.calculateSustainabilityMetrics(
  productEPC,
  events
);

console.log({
  carbonFootprint: sustainabilityMetrics.carbonFootprint,
  recyclingRate: sustainabilityMetrics.recyclingRate,
  ethicalSourcing: sustainabilityMetrics.ethicalSourcing
});
```

## Performance Optimizations

The semantic renderer optimizes supply chain processing:

### GS1 Identifier Caching
- Pre-validates common GTIN patterns
- Caches GLN lookups for known locations
- Optimizes check digit calculations

### EPCIS Event Processing
- Batches event storage operations
- Caches vocabulary lookups
- Optimizes EPC URI generation

### Digital Link Generation
- Template-based URL construction
- Cached resolver configurations
- Compressed QR code generation

This comprehensive example shows how semantic templates transform supply chain domain knowledge into production-ready, standards-compliant tracking services with built-in validation, quality control, and performance optimization.