# Supply Chain GS1 Semantic Generation Example

## Overview

This example demonstrates generating TypeScript interfaces and data models from GS1 (Global Standards One) semantic data for supply chain management using Unjucks templates.

## GS1 RDF/Turtle Input

```turtle
@prefix gs1: <https://gs1.org/voc/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

gs1:Product a owl:Class ;
    rdfs:label "Product" ;
    gs1:definition "Any item (product or service) upon which there is a need to retrieve predefined information" ;
    gs1:hasProperty gs1:gtin, gs1:productName, gs1:brand, gs1:netContent .

gs1:TradeItem a owl:Class ;
    rdfs:label "Trade Item" ;
    rdfs:subClassOf gs1:Product ;
    gs1:definition "Any item (product or service) upon which there is a need to retrieve predefined information that can be priced, or ordered, or invoiced at any point in any supply chain" .

gs1:GTIN a owl:Class ;
    rdfs:label "Global Trade Item Number" ;
    gs1:definition "The GS1 Identification Key used to identify trade items" ;
    gs1:format "14 digits" .

gs1:Location a owl:Class ;
    rdfs:label "Location" ;
    gs1:definition "A physical location or place" ;
    gs1:hasProperty gs1:gln, gs1:locationName, gs1:address .

gs1:LogisticsUnit a owl:Class ;
    rdfs:label "Logistics Unit" ;
    gs1:definition "Any composition of trade items and/or other logistics units for transport and/or storage which needs to be managed through the supply chain" ;
    gs1:hasProperty gs1:sscc, gs1:containedTradeItem .
```

## Generation Command

```bash
# Generate TypeScript supply chain models from GS1 ontology
unjucks generate gs1-supply-chain logistics \
  --ontologyFile ./data/gs1-ontology.ttl \
  --namespace "https://gs1.org/voc/" \
  --outputDir ./src/models/supply-chain \
  --generateBarcodeMethods true \
  --includeValidation true \
  --generateTrackingEvents true
```

## Generated Output

### `src/models/supply-chain/TradeItem.ts`

```typescript
/**
 * Trade Item - Any item (product or service) upon which there is a need to retrieve 
 * predefined information that can be priced, or ordered, or invoiced at any point 
 * in any supply chain
 * Generated from GS1 ontology: https://gs1.org/voc/TradeItem
 */
export interface TradeItem extends Product {
  readonly type: 'TradeItem';
  
  /** Global Trade Item Number - 14 digit identifier */
  gtin: GTIN;
  
  /** Brand name of the trade item */
  brand: Brand;
  
  /** Net content information */
  netContent: NetContent[];
  
  /** Packaging information */
  packaging: PackagingInformation[];
  
  /** Nutritional information (if applicable) */
  nutritionalInformation?: NutritionalInformation;
  
  /** Allergen information */
  allergenInformation?: AllergenInformation[];
  
  /** Country of origin */
  countryOfOrigin?: CountryCode[];
  
  /** Dimensions and weight */
  measurements: TradeItemMeasurements;
  
  /** Temperature storage requirements */
  storageInstructions?: StorageInstructions;
}

export interface GTIN {
  /** 14-digit GTIN value */
  value: string;
  
  /** GTIN type (GTIN-14, GTIN-13, etc.) */
  type: GTINType;
  
  /** Check digit validation */
  isValid(): boolean;
  
  /** Generate barcode data */
  toBarcodeData(): BarcodeData;
}

export enum GTINType {
  GTIN_8 = 'GTIN-8',
  GTIN_12 = 'GTIN-12', 
  GTIN_13 = 'GTIN-13',
  GTIN_14 = 'GTIN-14'
}

export interface NetContent {
  /** Measurement value */
  value: number;
  
  /** Unit of measure */
  unitOfMeasure: UnitOfMeasure;
  
  /** Content type (net, gross, drained) */
  contentType: ContentType;
}

export enum UnitOfMeasure {
  GRAM = 'GRM',
  KILOGRAM = 'KGM',
  LITER = 'LTR',
  MILLILITER = 'MLT',
  METER = 'MTR',
  CENTIMETER = 'CMT',
  PIECE = 'PCE'
}
```

### `src/models/supply-chain/LogisticsUnit.ts`

```typescript
/**
 * Logistics Unit - Any composition of trade items and/or other logistics units 
 * for transport and/or storage which needs to be managed through the supply chain
 * Generated from GS1 ontology
 */
export interface LogisticsUnit {
  readonly type: 'LogisticsUnit';
  
  /** Serial Shipping Container Code - 18 digit identifier */
  sscc: SSCC;
  
  /** Trade items contained in this logistics unit */
  containedTradeItems: ContainedTradeItem[];
  
  /** Child logistics units (for hierarchical packaging) */
  childLogisticsUnits?: LogisticsUnit[];
  
  /** Parent logistics unit reference */
  parentLogisticsUnit?: string; // SSCC reference
  
  /** Logistics unit dimensions and weight */
  measurements: LogisticsUnitMeasurements;
  
  /** Creation timestamp */
  createdDateTime: Date;
  
  /** Current location */
  currentLocation?: Location;
  
  /** Packaging type */
  packagingType: PackagingType;
}

export interface SSCC {
  /** 18-digit SSCC value */
  value: string;
  
  /** Extension digit */
  extensionDigit: string;
  
  /** Company prefix */
  companyPrefix: string;
  
  /** Serial reference */
  serialReference: string;
  
  /** Check digit */
  checkDigit: string;
  
  /** Validate SSCC format and check digit */
  isValid(): boolean;
  
  /** Generate GS1-128 barcode */
  toGS1128(): string;
}

export interface ContainedTradeItem {
  /** Reference to trade item */
  tradeItem: TradeItem | string; // GTIN
  
  /** Quantity contained */
  quantity: number;
  
  /** Unit of measure for quantity */
  quantityUnit: UnitOfMeasure;
  
  /** Batch/lot information */
  batchLot?: BatchLotInformation[];
  
  /** Expiration dates */
  expirationDates?: ExpirationDate[];
}
```

### `src/models/supply-chain/Location.ts`

```typescript
/**
 * Location - A physical location or place in the supply chain
 * Generated from GS1 ontology
 */
export interface Location {
  readonly type: 'Location';
  
  /** Global Location Number - 13 digit identifier */
  gln: GLN;
  
  /** Location name */
  locationName: string;
  
  /** Physical address */
  address: Address;
  
  /** Location type */
  locationType: LocationType[];
  
  /** Operating hours */
  operatingHours?: OperatingHours[];
  
  /** Contact information */
  contact?: ContactInformation[];
  
  /** Geographic coordinates */
  coordinates?: GeographicCoordinates;
  
  /** Parent location (for hierarchical locations) */
  parentLocation?: string; // GLN reference
}

export interface GLN {
  /** 13-digit GLN value */
  value: string;
  
  /** Company prefix */
  companyPrefix: string;
  
  /** Location reference */
  locationReference: string;
  
  /** Check digit */
  checkDigit: string;
  
  /** Validate GLN format and check digit */
  isValid(): boolean;
}

export enum LocationType {
  WAREHOUSE = 'WAREHOUSE',
  DISTRIBUTION_CENTER = 'DISTRIBUTION_CENTER',
  RETAIL_STORE = 'RETAIL_STORE',
  MANUFACTURING_FACILITY = 'MANUFACTURING_FACILITY',
  LOGISTICS_HUB = 'LOGISTICS_HUB',
  CUSTOMS_OFFICE = 'CUSTOMS_OFFICE'
}
```

### `src/services/SupplyChainTracker.ts`

```typescript
/**
 * Supply Chain Tracking Service
 * Provides traceability and event tracking for supply chain entities
 */
export class SupplyChainTracker {
  constructor(private eventStore: SupplyChainEventStore) {}
  
  /**
   * Track a logistics unit movement
   */
  async trackMovement(sscc: string, from: Location, to: Location): Promise<MovementEvent> {
    const event: MovementEvent = {
      eventType: 'MOVEMENT',
      eventId: generateEventId(),
      eventTimestamp: new Date(),
      logisticsUnit: sscc,
      fromLocation: from.gln.value,
      toLocation: to.gln.value,
      transportDetails: await this.getTransportDetails(sscc)
    };
    
    await this.eventStore.recordEvent(event);
    return event;
  }
  
  /**
   * Track trade item transformation (manufacturing, packaging)
   */
  async trackTransformation(
    inputItems: ContainedTradeItem[], 
    outputItems: ContainedTradeItem[],
    process: TransformationProcess
  ): Promise<TransformationEvent> {
    const event: TransformationEvent = {
      eventType: 'TRANSFORMATION',
      eventId: generateEventId(),
      eventTimestamp: new Date(),
      inputTradeItems: inputItems.map(item => ({
        gtin: typeof item.tradeItem === 'string' ? item.tradeItem : item.tradeItem.gtin.value,
        quantity: item.quantity
      })),
      outputTradeItems: outputItems.map(item => ({
        gtin: typeof item.tradeItem === 'string' ? item.tradeItem : item.tradeItem.gtin.value,
        quantity: item.quantity
      })),
      processType: process.type,
      location: process.location.gln.value
    };
    
    await this.eventStore.recordEvent(event);
    return event;
  }
  
  /**
   * Get complete traceability chain for a trade item
   */
  async getTraceabilityChain(gtin: string): Promise<TraceabilityChain> {
    const events = await this.eventStore.getEventsByGTIN(gtin);
    
    return {
      tradeItem: gtin,
      events: events.sort((a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime()),
      currentLocation: await this.getCurrentLocation(gtin),
      traceabilityStatus: this.calculateTraceabilityStatus(events)
    };
  }
}
```

## Template Structure

```
templates/gs1-supply-chain/
├── _shared/
│   ├── identifiers.ts.njk    # GS1 identifier classes (GTIN, SSCC, GLN)
│   ├── measurements.ts.njk   # Measurement and dimension types
│   └── events.ts.njk         # Supply chain event types
├── trade-item.ts.njk         # Trade item interface template
├── logistics-unit.ts.njk     # Logistics unit template
├── location.ts.njk           # Location template
├── tracker.ts.njk            # Tracking service template
└── validators.ts.njk         # GS1 validation functions
```

## Usage in Supply Chain Application

```typescript
import { TradeItem, LogisticsUnit, SupplyChainTracker } from './models/supply-chain';

// Create a trade item
const cereal: TradeItem = {
  type: 'TradeItem',
  gtin: {
    value: '01234567890123',
    type: GTINType.GTIN_14,
    isValid: () => true,
    toBarcodeData: () => ({ format: 'EAN-128', data: '01234567890123' })
  },
  productName: 'Organic Oat Cereal',
  brand: { name: 'Nature\'s Best' },
  netContent: [{
    value: 500,
    unitOfMeasure: UnitOfMeasure.GRAM,
    contentType: ContentType.NET
  }],
  packaging: [],
  measurements: {
    height: { value: 25, unit: UnitOfMeasure.CENTIMETER },
    width: { value: 18, unit: UnitOfMeasure.CENTIMETER },
    depth: { value: 8, unit: UnitOfMeasure.CENTIMETER },
    weight: { value: 520, unit: UnitOfMeasure.GRAM }
  }
};

// Create a logistics unit containing the trade item
const pallet: LogisticsUnit = {
  type: 'LogisticsUnit',
  sscc: {
    value: '123456789012345678',
    extensionDigit: '1',
    companyPrefix: '234567',
    serialReference: '890123456',
    checkDigit: '8',
    isValid: () => true,
    toGS1128: () => '00123456789012345678'
  },
  containedTradeItems: [{
    tradeItem: cereal,
    quantity: 48,
    quantityUnit: UnitOfMeasure.PIECE
  }],
  measurements: {
    height: { value: 120, unit: UnitOfMeasure.CENTIMETER },
    width: { value: 80, unit: UnitOfMeasure.CENTIMETER },
    depth: { value: 120, unit: UnitOfMeasure.CENTIMETER },
    weight: { value: 25, unit: UnitOfMeasure.KILOGRAM }
  },
  createdDateTime: new Date(),
  packagingType: PackagingType.PALLET
};

// Track supply chain events
const tracker = new SupplyChainTracker(eventStore);

// Track movement from warehouse to distribution center
await tracker.trackMovement(
  pallet.sscc.value,
  warehouseLocation,
  distributionCenter
);

// Get complete traceability
const traceability = await tracker.getTraceabilityChain(cereal.gtin.value);
console.log('Traceability events:', traceability.events.length);
```

## Benefits

- **GS1 Standards Compliance**: Generated models follow GS1 global standards
- **Supply Chain Visibility**: Complete traceability from source to consumer  
- **Barcode Integration**: Built-in support for GS1 barcode generation
- **Identifier Validation**: Automatic validation of GTINs, SSCCs, and GLNs
- **Event Tracking**: Comprehensive supply chain event management
- **Interoperability**: Standard format enables system integration across supply chain partners