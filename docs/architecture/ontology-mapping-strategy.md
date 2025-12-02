# Ontology Mapping Strategy

## Purpose

This document defines the comprehensive mapping strategy for transforming RDF/Turtle ontology constructs into code artifacts. It serves as the **semantic bridge** between ontological knowledge representation and executable software.

---

## 1. Core Mapping Principles

### 1.1 Semantic Preservation

**Principle**: Generated code must preserve the semantics of the ontology.

**Requirements**:
- Class hierarchies → Type inheritance
- Property constraints → Runtime validation
- Cardinality restrictions → Type multiplicity
- Relationships → Foreign keys + API associations

### 1.2 Idiomatic Code Generation

**Principle**: Generated code follows language/framework best practices.

**Examples**:
- TypeScript: Use interfaces for shape, classes for behavior
- Database: Follow naming conventions (snake_case for Postgres)
- API: REST resource conventions (plural nouns, standard methods)

### 1.3 Extensibility

**Principle**: Generated code should be easy to extend manually.

**Design**:
- Clear separation of generated vs. custom code
- Extension points for business logic
- Partial classes for user additions

---

## 2. OWL Class → Code Artifacts

### 2.1 owl:Class → TypeScript Interface

**Mapping Rule**:

```turtle
# Input: Ontology
kmkt:Listing a owl:Class ;
    rdfs:label "Marketplace Listing"@en ;
    rdfs:comment "A Knowledge Pack listing in the marketplace"@en .

kmkt:name a owl:DatatypeProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range xsd:string .

kmkt:version a owl:DatatypeProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range xsd:string .
```

```typescript
// Output: TypeScript Interface
/**
 * Marketplace Listing
 * A Knowledge Pack listing in the marketplace
 *
 * @generated from ontology: http://kgen.ai/marketplace/Listing
 */
export interface Listing {
  name: string;
  version: string;
}
```

**Transformation Logic**:
1. Extract `rdfs:label` → Interface name (PascalCase)
2. Extract `rdfs:comment` → JSDoc comment
3. Find all properties with `rdfs:domain` pointing to this class
4. Map each property to field with appropriate TypeScript type

### 2.2 owl:Class → Database Table

**Mapping Rule**:

```sql
-- Output: Database Schema
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT listings_name_not_empty CHECK (name <> ''),
  CONSTRAINT listings_version_format CHECK (version ~ '^\d+\.\d+\.\d+$')
);

CREATE INDEX idx_listings_name ON listings(name);
CREATE INDEX idx_listings_version ON listings(version);

COMMENT ON TABLE listings IS 'A Knowledge Pack listing in the marketplace';
COMMENT ON COLUMN listings.name IS 'Name of the listing';
```

**Transformation Logic**:
1. Class name → Table name (snake_case, plural)
2. Add standard columns: `id`, `created_at`, `updated_at`
3. Map properties → columns with NOT NULL for required properties
4. Generate constraints from ontology constraints
5. Create indexes for commonly queried fields
6. Add SQL comments from `rdfs:comment`

### 2.3 owl:Class → REST API Resource

**Mapping Rule**:

```typescript
// Output: API Route Definition
/**
 * Listing API Routes
 * @generated from ontology: http://kgen.ai/marketplace/Listing
 */
import { Router } from 'express';
import { ListingController } from '../controllers/listing.controller';
import { validateListing } from '../validation/listing.validation';

const router = Router();
const controller = new ListingController();

// Standard CRUD operations
router.get('/listings', controller.findAll);           // GET /api/listings
router.get('/listings/:id', controller.findOne);       // GET /api/listings/:id
router.post('/listings', validateListing, controller.create);     // POST /api/listings
router.put('/listings/:id', validateListing, controller.update);  // PUT /api/listings/:id
router.patch('/listings/:id', controller.partialUpdate);          // PATCH /api/listings/:id
router.delete('/listings/:id', controller.delete);     // DELETE /api/listings/:id

export default router;
```

**Transformation Logic**:
1. Class name → Resource path (lowercase, plural)
2. Generate standard REST operations (GET, POST, PUT, PATCH, DELETE)
3. Add validation middleware
4. Reference controller class
5. Follow REST conventions

### 2.4 owl:Class → Service Layer

**Mapping Rule**:

```typescript
// Output: Service Class
/**
 * Listing Service
 * Business logic for Marketplace Listing
 *
 * @generated from ontology: http://kgen.ai/marketplace/Listing
 */
import { Listing } from '../types/listing.interface';
import { ListingRepository } from '../repositories/listing.repository';
import { Logger } from '../utils/logger';

export class ListingService {
  private repository: ListingRepository;
  private logger: Logger;

  constructor(repository?: ListingRepository) {
    this.repository = repository || new ListingRepository();
    this.logger = new Logger('ListingService');
  }

  async findAll(filters?: ListingFilters): Promise<Listing[]> {
    this.logger.debug('Finding all listings', { filters });
    return this.repository.findAll(filters);
  }

  async findById(id: string): Promise<Listing | null> {
    this.logger.debug('Finding listing by id', { id });
    return this.repository.findById(id);
  }

  async create(data: CreateListingDto): Promise<Listing> {
    this.logger.info('Creating listing', { data });

    // Business logic can be extended here
    const listing = await this.repository.create(data);

    this.logger.info('Listing created', { id: listing.id });
    return listing;
  }

  async update(id: string, data: UpdateListingDto): Promise<Listing> {
    this.logger.info('Updating listing', { id, data });

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Listing not found: ${id}`);
    }

    return this.repository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting listing', { id });
    await this.repository.delete(id);
  }
}
```

**Transformation Logic**:
1. Class name → Service class name
2. Generate CRUD methods with logging
3. Add error handling
4. Reference repository layer
5. Provide extension points for business logic

---

## 3. OWL Property → Code Artifacts

### 3.1 owl:DatatypeProperty → TypeScript Field

**Mapping Table**:

| OWL Range (XSD Type) | TypeScript Type | Database Type (Postgres) | Validation |
|---------------------|-----------------|--------------------------|------------|
| `xsd:string` | `string` | `VARCHAR(255)` | `string()` |
| `xsd:integer` | `number` | `INTEGER` | `number().int()` |
| `xsd:decimal` | `number` | `DECIMAL(10,2)` | `number()` |
| `xsd:float` | `number` | `REAL` | `number()` |
| `xsd:double` | `number` | `DOUBLE PRECISION` | `number()` |
| `xsd:boolean` | `boolean` | `BOOLEAN` | `boolean()` |
| `xsd:dateTime` | `Date` | `TIMESTAMPTZ` | `date()` |
| `xsd:date` | `Date` | `DATE` | `date()` |
| `xsd:time` | `string` | `TIME` | `string().regex()` |
| `xsd:anyURI` | `string` | `TEXT` | `string().url()` |

**Example**:

```turtle
# Input: Property Definition
kmkt:downloads a owl:DatatypeProperty, owl:FunctionalProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range xsd:integer ;
    rdfs:label "Download Count"@en ;
    rdfs:comment "Number of times this package has been downloaded"@en .
```

```typescript
// Output: TypeScript Field
export interface Listing {
  /** Number of times this package has been downloaded */
  downloads: number;  // Functional property → single value, not array
}

// Output: Database Column
downloads INTEGER DEFAULT 0 NOT NULL
CONSTRAINT listings_downloads_non_negative CHECK (downloads >= 0)

// Output: Validation Rule
downloads: z.number().int().min(0).describe('Number of times this package has been downloaded')
```

### 3.2 Cardinality Constraints → Type Multiplicity

**Mapping Rules**:

| Cardinality Constraint | TypeScript Type | Database Schema |
|------------------------|-----------------|-----------------|
| `owl:FunctionalProperty` | `T` | Single column |
| Default (0..∞) | `T[]` | One-to-many relation |
| `owl:maxCardinality 1` | `T \| null` | Nullable column |
| `owl:minCardinality 1` | `T` | NOT NULL constraint |
| `owl:cardinality 1` | `T` | NOT NULL + UNIQUE |

**Example**:

```turtle
# Input: Cardinality Constraints
kmkt:Listing rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty kmkt:domain ;
  owl:minCardinality 1
] .

kmkt:Listing rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty kmkt:author ;
  owl:maxCardinality 1
] .
```

```typescript
// Output: TypeScript
export interface Listing {
  domain: Domain[];     // minCardinality 1 → array with at least one element
  author?: Publisher;   // maxCardinality 1 → optional single value
}

// Output: Validation
z.object({
  domain: z.array(DomainSchema).min(1),  // At least one domain
  author: PublisherSchema.optional()     // Optional author
})
```

### 3.3 owl:ObjectProperty → Relationships

**Mapping Rule**:

```turtle
# Input: Object Property (Relationship)
kmkt:author a owl:ObjectProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range kmkt:Publisher ;
    rdfs:label "Author"@en .
```

**TypeScript (Interface)**:
```typescript
export interface Listing {
  author: Publisher;        // Direct object reference
  authorId: string;         // Foreign key for database
}

export interface Publisher {
  id: string;
  name: string;
  listings?: Listing[];     // Inverse relationship (optional)
}
```

**Database (Schema)**:
```sql
ALTER TABLE listings
  ADD COLUMN author_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE;

CREATE INDEX idx_listings_author_id ON listings(author_id);
```

**API (Endpoints)**:
```typescript
// Relationship endpoints
router.get('/listings/:id/author', controller.getAuthor);           // Get author of listing
router.get('/publishers/:id/listings', controller.getListings);     // Get listings by publisher
router.put('/listings/:id/author/:authorId', controller.setAuthor); // Set author relationship
```

**Service (Methods)**:
```typescript
export class ListingService {
  async getAuthor(listingId: string): Promise<Publisher> {
    return this.repository.getRelated(listingId, 'author');
  }

  async setAuthor(listingId: string, authorId: string): Promise<void> {
    return this.repository.setRelation(listingId, 'author', authorId);
  }
}
```

---

## 4. Advanced Mappings

### 4.1 Class Hierarchy → Inheritance

**Mapping Rule**:

```turtle
# Input: Class Hierarchy
kmkt:PremiumListing a owl:Class ;
    rdfs:subClassOf kmkt:Listing ;
    rdfs:label "Premium Listing"@en .

kmkt:featured a owl:DatatypeProperty ;
    rdfs:domain kmkt:PremiumListing ;
    rdfs:range xsd:boolean .
```

**TypeScript**:
```typescript
// Base interface
export interface Listing {
  id: string;
  name: string;
  version: string;
}

// Derived interface
export interface PremiumListing extends Listing {
  featured: boolean;
}
```

**Database (Single Table Inheritance)**:
```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,  -- 'listing' or 'premium_listing'
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,

  -- Premium-specific columns (nullable)
  featured BOOLEAN,

  CONSTRAINT listings_type_check CHECK (type IN ('listing', 'premium_listing')),
  CONSTRAINT premium_featured_required CHECK (type != 'premium_listing' OR featured IS NOT NULL)
);

CREATE INDEX idx_listings_type ON listings(type);
```

**Alternative: Joined Table Inheritance**:
```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL
);

CREATE TABLE premium_listings (
  id UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  featured BOOLEAN NOT NULL
);
```

### 4.2 Many-to-Many Relationships

**Mapping Rule**:

```turtle
# Input: Many-to-Many Relationship
kmkt:tags a owl:ObjectProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range kmkt:Tag .
```

**Database (Junction Table)**:
```sql
CREATE TABLE listing_tags (
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (listing_id, tag_id)
);

CREATE INDEX idx_listing_tags_listing_id ON listing_tags(listing_id);
CREATE INDEX idx_listing_tags_tag_id ON listing_tags(tag_id);
```

**TypeScript**:
```typescript
export interface Listing {
  tags: Tag[];  // Many-to-many relationship
}

export interface Tag {
  id: string;
  name: string;
  listings?: Listing[];  // Inverse
}
```

**API**:
```typescript
router.get('/listings/:id/tags', controller.getTags);
router.post('/listings/:id/tags/:tagId', controller.addTag);
router.delete('/listings/:id/tags/:tagId', controller.removeTag);
```

### 4.3 Symmetric/Transitive Properties

**Mapping Rule**:

```turtle
# Input: Symmetric Property
kmkt:relatedTo a owl:ObjectProperty, owl:SymmetricProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range kmkt:Listing ;
    rdfs:label "Related To"@en .
```

**Database**:
```sql
CREATE TABLE listing_relations (
  listing_a_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  listing_b_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  -- Ensure A < B to avoid duplicates (canonical form)
  CONSTRAINT listing_relations_canonical CHECK (listing_a_id < listing_b_id),

  PRIMARY KEY (listing_a_id, listing_b_id)
);
```

**Service Logic**:
```typescript
export class ListingService {
  async getRelated(listingId: string): Promise<Listing[]> {
    // Query both directions due to symmetric property
    return this.repository.query(`
      SELECT * FROM listings WHERE id IN (
        SELECT listing_b_id FROM listing_relations WHERE listing_a_id = $1
        UNION
        SELECT listing_a_id FROM listing_relations WHERE listing_b_id = $1
      )
    `, [listingId]);
  }

  async addRelation(listingAId: string, listingBId: string): Promise<void> {
    // Always store in canonical form (smaller id first)
    const [a, b] = [listingAId, listingBId].sort();
    await this.repository.createRelation(a, b);
  }
}
```

### 4.4 Inverse Properties

**Mapping Rule**:

```turtle
# Input: Inverse Properties
kmkt:author a owl:ObjectProperty ;
    owl:inverseOf kmkt:publications .

kmkt:publications a owl:ObjectProperty .
```

**TypeScript**:
```typescript
export interface Listing {
  author: Publisher;
  authorId: string;
}

export interface Publisher {
  id: string;
  publications: Listing[];  // Inverse of 'author'
}
```

**Service (Automatic Inverse Handling)**:
```typescript
export class ListingService {
  async setAuthor(listingId: string, authorId: string): Promise<void> {
    await this.repository.setAuthor(listingId, authorId);

    // Automatically invalidate cache for inverse relationship
    await this.cacheService.invalidate(`publisher:${authorId}:publications`);
  }
}
```

---

## 5. Constraint Mapping

### 5.1 Value Constraints → Validation Rules

**Mapping Table**:

| Ontology Constraint | Validation (Zod) | Database Constraint |
|---------------------|------------------|---------------------|
| `xsd:minInclusive 0` | `.min(0)` | `CHECK (field >= 0)` |
| `xsd:maxInclusive 100` | `.max(100)` | `CHECK (field <= 100)` |
| `xsd:pattern "^[A-Z]"` | `.regex(/^[A-Z]/)` | `CHECK (field ~ '^[A-Z]')` |
| `xsd:minLength 3` | `.min(3)` | `CHECK (length(field) >= 3)` |
| `xsd:maxLength 255` | `.max(255)` | `VARCHAR(255)` |
| `owl:oneOf (...)` | `.enum([...])` | `CHECK (field IN (...))` |

**Example**:

```turtle
# Input: Value Constraints
kmkt:maturityLevel a owl:DatatypeProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range [
      a rdfs:Datatype ;
      owl:oneOf ("alpha" "beta" "stable" "deprecated")
    ] .

kmkt:rating a owl:DatatypeProperty ;
    rdfs:domain kmkt:Listing ;
    rdfs:range [
      a rdfs:Datatype ;
      owl:onDatatype xsd:integer ;
      owl:withRestrictions ([xsd:minInclusive 1] [xsd:maxInclusive 5])
    ] .
```

```typescript
// Output: Validation Schema
export const ListingSchema = z.object({
  maturityLevel: z.enum(['alpha', 'beta', 'stable', 'deprecated'])
    .describe('Development maturity level'),

  rating: z.number().int().min(1).max(5)
    .describe('Rating from 1 to 5 stars')
});
```

```sql
-- Output: Database Constraints
ALTER TABLE listings
  ADD COLUMN maturity_level VARCHAR(20) CHECK (maturity_level IN ('alpha', 'beta', 'stable', 'deprecated')),
  ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);
```

### 5.2 Disjointness Constraints

**Mapping Rule**:

```turtle
# Input: Disjoint Classes
kmkt:FreeListing owl:disjointWith kmkt:PremiumListing .
```

**Validation**:
```typescript
// Runtime validation to ensure listings are not both free and premium
export function validateListing(listing: any): void {
  const isFree = listing.type === 'free';
  const isPremium = listing.type === 'premium';

  if (isFree && isPremium) {
    throw new Error('Listing cannot be both free and premium (disjoint classes)');
  }
}
```

**Database**:
```sql
-- Ensure mutual exclusivity
ALTER TABLE listings
  ADD CONSTRAINT listings_type_exclusivity CHECK (
    (type = 'free' AND premium_features IS NULL) OR
    (type = 'premium' AND premium_features IS NOT NULL)
  );
```

---

## 6. Naming Conventions

### 6.1 Class Name Transformations

| Context | Convention | Example |
|---------|-----------|---------|
| Ontology | `namespace:ClassName` | `kmkt:Listing` |
| TypeScript Interface | `PascalCase` | `Listing` |
| TypeScript Class | `PascalCase` | `ListingService` |
| Database Table | `snake_case` (plural) | `listings` |
| API Route | `kebab-case` (plural) | `/api/listings` |
| File Name | `kebab-case` | `listing.service.ts` |

### 6.2 Property Name Transformations

| Context | Convention | Example |
|---------|-----------|---------|
| Ontology | `namespace:propertyName` | `kmkt:downloadCount` |
| TypeScript | `camelCase` | `downloadCount` |
| Database Column | `snake_case` | `download_count` |
| JSON API | `camelCase` | `downloadCount` |
| GraphQL Field | `camelCase` | `downloadCount` |

### 6.3 Relationship Name Transformations

| Context | Convention | Example |
|---------|-----------|---------|
| Ontology | `namespace:relationName` | `kmkt:author` |
| TypeScript Property | `camelCase` | `author` |
| Foreign Key Column | `snake_case` + `_id` | `author_id` |
| Junction Table | `table1_table2` | `listing_tags` |
| API Endpoint | `kebab-case` | `/listings/:id/author` |

---

## 7. Special Cases

### 7.1 Blank Nodes → Nested Objects

**Mapping Rule**:

```turtle
# Input: Blank Node (Structured Value)
kmkt:price [
  a kmkt:Price ;
  kmkt:amount 29.99 ;
  kmkt:currency "USD"
] .
```

```typescript
// Output: Nested TypeScript Type
export interface Listing {
  price: Price;
}

export interface Price {
  amount: number;
  currency: string;
}
```

```sql
-- Output: JSONB Column
ALTER TABLE listings
  ADD COLUMN price JSONB NOT NULL;

-- With constraints
ALTER TABLE listings
  ADD CONSTRAINT price_valid CHECK (
    price ? 'amount' AND
    price ? 'currency' AND
    (price->>'amount')::numeric > 0
  );
```

### 7.2 rdfs:label and rdfs:comment → Documentation

**Mapping Rule**:

```turtle
kmkt:Listing a owl:Class ;
    rdfs:label "Marketplace Listing"@en ;
    rdfs:comment "A Knowledge Pack listing with metadata and pricing"@en .
```

```typescript
/**
 * Marketplace Listing
 *
 * A Knowledge Pack listing with metadata and pricing
 *
 * @generated from ontology: http://kgen.ai/marketplace/Listing
 * @see {@link http://kgen.ai/marketplace/Listing}
 */
export interface Listing {
  // ...
}
```

### 7.3 owl:imports → Package Dependencies

**Mapping Rule**:

```turtle
<http://kgen.ai/marketplace/> a owl:Ontology ;
    owl:imports <http://www.w3.org/ns/prov#> ;
    owl:imports <http://xmlns.com/foaf/0.1/> .
```

```json
// Output: package.json dependencies
{
  "dependencies": {
    "@types/prov": "^1.0.0",    // W3C PROV types
    "@types/foaf": "^1.0.0"     // FOAF types
  }
}
```

---

## 8. Preset-Specific Mappings

### 8.1 Fullstack Preset

```
owl:Class →
  ├── TypeScript Interface (types/)
  ├── Database Table (database/schema/)
  ├── REST Resource (api/routes/)
  ├── Controller (api/controllers/)
  ├── Service (services/)
  ├── Repository (repositories/)
  ├── Validation Schema (validation/)
  ├── Unit Tests (tests/unit/)
  ├── Integration Tests (tests/integration/)
  └── API Documentation (docs/api/)
```

### 8.2 API-Only Preset

```
owl:Class →
  ├── TypeScript Interface (types/)
  ├── REST Resource (api/routes/)
  ├── Controller (api/controllers/)
  ├── Validation Schema (validation/)
  └── Tests (tests/)
```

### 8.3 GraphQL Preset

```
owl:Class →
  ├── GraphQL Type (schema/types/)
  ├── Resolver (resolvers/)
  ├── Service (services/)
  └── Tests (tests/)
```

### 8.4 Microservice Preset

```
owl:Class →
  ├── TypeScript Interface (types/)
  ├── gRPC Service Definition (.proto)
  ├── Service Implementation (services/)
  ├── Message Handlers (handlers/)
  ├── Event Publishers (events/)
  └── Tests (tests/)
```

---

## 9. Mapping Configuration

### 9.1 Custom Mapping Rules File

```typescript
// mapping-config.ts
export const customMappings: MappingConfig = {
  // Override type mappings
  types: {
    'xsd:string': 'string',
    'custom:Email': 'string',  // Custom type
  },

  // Override naming conventions
  naming: {
    classToTable: (className) => pluralize(snakeCase(className)),
    classToInterface: (className) => pascalCase(className),
  },

  // Custom template selection
  templates: {
    'kmkt:Listing': {
      api: 'custom-templates/premium-api.njk',
      service: 'custom-templates/premium-service.njk',
    }
  },

  // Custom validation rules
  validation: {
    'kmkt:email': (value) => /^[^@]+@[^@]+$/.test(value),
  }
};
```

### 9.2 Per-Class Overrides

```typescript
// Use ontology annotations for customization
/**
 * @template api custom-templates/listing-api.njk
 * @route /marketplace/packages
 * @tableName marketplace_packages
 */
kmkt:Listing a owl:Class .
```

---

## 10. Quality Assurance

### 10.1 Validation Checkpoints

1. **Parse Phase**: Validate TTL syntax
2. **Analysis Phase**: Verify ontology consistency
3. **Mapping Phase**: Check for unsupported constructs
4. **Generation Phase**: Validate generated code syntax
5. **Output Phase**: Run tests on generated project

### 10.2 Mapping Coverage Report

```typescript
interface MappingReport {
  totalClasses: number;
  mappedClasses: number;
  unmappedClasses: string[];

  totalProperties: number;
  mappedProperties: number;
  unmappedProperties: string[];

  unsupportedConstructs: UnsupportedConstruct[];
  warnings: MappingWarning[];
}
```

---

## 11. Examples

### 11.1 Complete Example: Blog Ontology

See: `docs/architecture/examples/blog-ontology-mapping.md`

### 11.2 Complete Example: E-Commerce Ontology

See: `docs/architecture/examples/ecommerce-ontology-mapping.md`

---

## 12. References

- **OWL2 Primer**: https://www.w3.org/TR/owl2-primer/
- **RDF Schema**: https://www.w3.org/TR/rdf-schema/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/
- **PostgreSQL Constraints**: https://www.postgresql.org/docs/current/ddl-constraints.html
- **REST API Design**: https://restfulapi.net/

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-01
**Status**: APPROVED for Implementation
