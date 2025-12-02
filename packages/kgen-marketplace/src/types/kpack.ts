/**
 * @fileoverview TypeScript interfaces for KGEN Marketplace KPack structure
 * @version 1.0.0
 * @description Defines the KPack manifest structure and related types for the marketplace
 */

import { z } from 'zod';

// ==============================================================================
// Content Addressing Types
// ==============================================================================

/**
 * Content address types supported by the marketplace
 */
export type ContentAddressType = 
  | 'cid'      // IPFS Content Identifier
  | 'sha256'   // SHA-256 hash
  | 'sha512'   // SHA-512 hash
  | 'blake2b'  // BLAKE2b hash
  | 'blake3';  // BLAKE3 hash

/**
 * Content-addressed identifier for immutable artifacts
 */
export interface ContentAddress {
  type: ContentAddressType;
  value: string;
  size: number;
  mediaType?: string;
}

/**
 * Reference to a content-addressed artifact within a KPack
 */
export interface ArtifactReference {
  path: string;
  contentAddress: ContentAddress;
  mediaType: string;
  executable?: boolean;
  metadata?: Record<string, any>;
}

// ==============================================================================
// Facet Classification Types
// ==============================================================================

/**
 * Domain classification facets
 */
export type Domain = 
  | 'finance'
  | 'healthcare'
  | 'retail'
  | 'manufacturing'
  | 'government'
  | 'education'
  | 'technology'
  | 'energy'
  | 'transportation'
  | 'media';

/**
 * Artifact type classification facets
 */
export type ArtifactType = 
  | 'api'
  | 'schema'
  | 'template'
  | 'configuration'
  | 'documentation'
  | 'test'
  | 'example'
  | 'library'
  | 'tool'
  | 'data';

/**
 * Compliance level classification facets
 */
export type ComplianceLevel = 
  | 'sox'
  | 'gdpr'
  | 'hipaa'
  | 'pci-dss'
  | 'iso-27001'
  | 'nist'
  | 'fedramp'
  | 'none';

/**
 * Maturity level classification facets
 */
export type MaturityLevel = 
  | 'experimental'
  | 'alpha'
  | 'beta'
  | 'stable'
  | 'mature'
  | 'deprecated';

/**
 * License type classification facets
 */
export type LicenseType = 
  | 'mit'
  | 'apache-2.0'
  | 'gpl-3.0'
  | 'bsd-3-clause'
  | 'mpl-2.0'
  | 'commercial'
  | 'proprietary'
  | 'custom';

/**
 * N-dimensional facet classification
 */
export interface FacetClassification {
  domain: Domain[];
  artifactType: ArtifactType[];
  compliance: ComplianceLevel[];
  maturity: MaturityLevel;
  license: LicenseType;
  customFacets?: Record<string, string[]>;
}

/**
 * Facet with weight and confidence scores
 */
export interface WeightedFacet {
  facet: string;
  weight: number;      // 0.0 - 1.0
  confidence: number;  // 0.0 - 1.0
  source?: string;     // automated | manual | ml-inferred
}

// ==============================================================================
// Payment and Value Types
// ==============================================================================

/**
 * Supported currency types
 */
export type CurrencyType = 'fiat' | 'crypto' | 'token';

/**
 * Currency definition
 */
export interface Currency {
  code: string;
  name: string;
  type: CurrencyType;
  symbol?: string;
  decimals: number;
  exchangeRate?: number; // Rate to USD
}

/**
 * Pricing model types
 */
export type PricingModelType = 
  | 'free'
  | 'fixed'
  | 'subscription'
  | 'usage'
  | 'tiered'
  | 'auction';

/**
 * Base pricing model interface
 */
export interface BasePricingModel {
  type: PricingModelType;
  currency: Currency;
  description?: string;
}

/**
 * Fixed price model
 */
export interface FixedPricing extends BasePricingModel {
  type: 'fixed';
  price: number;
}

/**
 * Subscription pricing model
 */
export interface SubscriptionPricing extends BasePricingModel {
  type: 'subscription';
  price: number;
  period: 'monthly' | 'yearly' | 'weekly';
  trialPeriod?: number; // days
}

/**
 * Usage-based pricing model
 */
export interface UsagePricing extends BasePricingModel {
  type: 'usage';
  pricePerUnit: number;
  unit: string; // 'download', 'mb', 'request', etc.
  minimumUnits?: number;
  includedUnits?: number;
}

/**
 * Tiered pricing model
 */
export interface TieredPricing extends BasePricingModel {
  type: 'tiered';
  tiers: Array<{
    min: number;
    max?: number;
    price: number;
  }>;
  unit: string;
}

/**
 * Auction pricing model
 */
export interface AuctionPricing extends BasePricingModel {
  type: 'auction';
  startingBid: number;
  reservePrice?: number;
  duration: number; // hours
}

/**
 * Union type for all pricing models
 */
export type PricingModel = 
  | { type: 'free' }
  | FixedPricing
  | SubscriptionPricing
  | UsagePricing
  | TieredPricing
  | AuctionPricing;

/**
 * Multi-dimensional value vector
 */
export interface ValueVector {
  pricing: PricingModel[];
  paymentTerms?: {
    net: number; // Net payment terms in days
    discount?: {
      rate: number;
      days: number;
    };
  };
  refundPolicy?: string;
  supportLevel?: 'community' | 'standard' | 'premium' | 'enterprise';
  sla?: {
    uptime: number;   // Percentage
    responseTime: number; // Hours
  };
}

// ==============================================================================
// Attestation and Trust Types
// ==============================================================================

/**
 * Cryptographic attestation requirements
 */
export interface AttestationRequirements {
  required: boolean;
  algorithms: string[]; // ['ed25519', 'ecdsa-p256', 'rsa-2048']
  keyRequirements?: {
    minBits?: number;
    curve?: string;
    certificationRequired?: boolean;
  };
  timestampRequired?: boolean;
  nonceRequired?: boolean;
}

/**
 * Trust indicators for the KPack
 */
export interface TrustIndicators {
  publisherVerified: boolean;
  codeReviewed: boolean;
  securityScanned: boolean;
  reproductibleBuild: boolean;
  attestations?: string[]; // Array of attestation hashes
  certifications?: string[]; // Array of certification names
}

// ==============================================================================
// KPack Manifest Types
// ==============================================================================

/**
 * Publisher information
 */
export interface Publisher {
  id: string;
  name: string;
  email?: string;
  website?: string;
  publicKey?: string;
  verified: boolean;
  reputation?: {
    score: number;
    reviewCount: number;
    lastUpdated: string;
  };
}

/**
 * KPack metadata
 */
export interface KPackMetadata {
  keywords: string[];
  tags: string[];
  category?: string;
  readme?: string;
  changelog?: string;
  documentation?: string;
  repository?: {
    type: string;
    url: string;
    directory?: string;
  };
  issues?: string;
  homepage?: string;
}

/**
 * Search criteria for marketplace queries
 */
export interface SearchCriteria {
  query?: string;
  facets?: Partial<FacetClassification>;
  authors?: string[];
  licenses?: string[];
  types?: ArtifactType[];
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'created' | 'modified' | 'downloads';
  sortOrder?: 'asc' | 'desc';
  priceRange?: {
    min?: number;
    max?: number;
  };
  maturityLevel?: MaturityLevel[];
  domain?: Domain[];
}

/**
 * Search result from marketplace queries
 */
export interface SearchResult {
  packs: KPackManifest[];
  total: number;
  facets: {
    [key: string]: { [value: string]: number };
  };
  suggestions?: string[];
  aggregations?: {
    priceRange: { min: number; max: number };
    avgPrice: number;
    popularLicenses: string[];
    topAuthors: string[];
  };
}

/**
 * Dependency specification
 */
export interface Dependency {
  name: string;
  version: string;
  contentAddress?: ContentAddress;
  registry?: string;
  optional?: boolean;
}

/**
 * KPack manifest schema (kpack.json)
 */
export interface KPackManifest {
  // Core identification
  id: string;
  name: string;
  version: string;
  description: string;
  
  // Content and artifacts
  contentAddress: ContentAddress;
  artifacts: ArtifactReference[];
  
  // Classification and metadata
  facets: FacetClassification;
  metadata: KPackMetadata;
  
  // Value and payment
  value: ValueVector;
  
  // Trust and security
  attestation: AttestationRequirements;
  trustIndicators: TrustIndicators;
  
  // Publishing and provenance
  publisher: Publisher;
  publishedAt: string; // ISO 8601 timestamp
  
  // Dependencies and requirements
  dependencies?: Dependency[];
  peerDependencies?: Dependency[];
  engines?: Record<string, string>;
  
  // Distribution and registry
  registry?: {
    type: 'npm' | 'oci' | 'git';
    url?: string;
    namespace?: string;
  };
  
  // Compatibility and requirements
  compatibility?: {
    kgenVersion: string;
    nodeVersion?: string;
    platforms?: string[];
  };
  
  // Additional metadata
  custom?: Record<string, any>;
}

// ==============================================================================
// Validation Schemas
// ==============================================================================


/**
 * Zod schema for content address validation
 */
export const ContentAddressSchema = z.object({
  type: z.enum(['cid', 'sha256', 'sha512', 'blake2b', 'blake3']),
  value: z.string().min(1),
  size: z.number().int().min(0),
  mediaType: z.string().optional()
});

/**
 * Zod schema for artifact reference validation
 */
export const ArtifactReferenceSchema = z.object({
  path: z.string().min(1),
  contentAddress: ContentAddressSchema,
  mediaType: z.string(),
  executable: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Zod schema for facet classification validation
 */
export const FacetClassificationSchema = z.object({
  domain: z.array(z.enum(['finance', 'healthcare', 'retail', 'manufacturing', 'government', 'education', 'technology', 'energy', 'transportation', 'media'])),
  artifactType: z.array(z.enum(['api', 'schema', 'template', 'configuration', 'documentation', 'test', 'example', 'library', 'tool', 'data'])),
  compliance: z.array(z.enum(['sox', 'gdpr', 'hipaa', 'pci-dss', 'iso-27001', 'nist', 'fedramp', 'none'])),
  maturity: z.enum(['experimental', 'alpha', 'beta', 'stable', 'mature', 'deprecated']),
  license: z.enum(['mit', 'apache-2.0', 'gpl-3.0', 'bsd-3-clause', 'mpl-2.0', 'commercial', 'proprietary', 'custom']),
  customFacets: z.record(z.array(z.string())).optional()
});

/**
 * Zod schema for KPack manifest validation
 */
export const KPackManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/), // Semantic versioning
  description: z.string().min(1),
  contentAddress: ContentAddressSchema,
  artifacts: z.array(ArtifactReferenceSchema),
  facets: FacetClassificationSchema,
  metadata: z.object({
    keywords: z.array(z.string()),
    tags: z.array(z.string()),
    category: z.string().optional(),
    readme: z.string().optional(),
    changelog: z.string().optional(),
    documentation: z.string().optional(),
    repository: z.object({
      type: z.string(),
      url: z.string().url(),
      directory: z.string().optional()
    }).optional(),
    issues: z.string().url().optional(),
    homepage: z.string().url().optional()
  }),
  value: z.object({
    pricing: z.array(z.any()), // Complex union type, validated separately
    paymentTerms: z.object({
      net: z.number().int().min(0),
      discount: z.object({
        rate: z.number().min(0).max(1),
        days: z.number().int().min(0)
      }).optional()
    }).optional(),
    refundPolicy: z.string().optional(),
    supportLevel: z.enum(['community', 'standard', 'premium', 'enterprise']).optional(),
    sla: z.object({
      uptime: z.number().min(0).max(100),
      responseTime: z.number().min(0)
    }).optional()
  }),
  attestation: z.object({
    required: z.boolean(),
    algorithms: z.array(z.string()),
    keyRequirements: z.object({
      minBits: z.number().int().min(256).optional(),
      curve: z.string().optional(),
      certificationRequired: z.boolean().optional()
    }).optional(),
    timestampRequired: z.boolean().optional(),
    nonceRequired: z.boolean().optional()
  }),
  trustIndicators: z.object({
    publisherVerified: z.boolean(),
    codeReviewed: z.boolean(),
    securityScanned: z.boolean(),
    reproductibleBuild: z.boolean(),
    attestations: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional()
  }),
  publisher: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    publicKey: z.string().optional(),
    verified: z.boolean(),
    reputation: z.object({
      score: z.number().min(0).max(1),
      reviewCount: z.number().int().min(0),
      lastUpdated: z.string().datetime()
    }).optional()
  }),
  publishedAt: z.string().datetime(),
  dependencies: z.array(z.object({
    name: z.string(),
    version: z.string(),
    contentAddress: ContentAddressSchema.optional(),
    registry: z.string().optional(),
    optional: z.boolean().optional()
  })).optional(),
  peerDependencies: z.array(z.object({
    name: z.string(),
    version: z.string(),
    contentAddress: ContentAddressSchema.optional(),
    registry: z.string().optional(),
    optional: z.boolean().optional()
  })).optional(),
  engines: z.record(z.string()).optional(),
  registry: z.object({
    type: z.enum(['npm', 'oci', 'git']),
    url: z.string().url().optional(),
    namespace: z.string().optional()
  }).optional(),
  compatibility: z.object({
    kgenVersion: z.string(),
    nodeVersion: z.string().optional(),
    platforms: z.array(z.string()).optional()
  }).optional(),
  custom: z.record(z.any()).optional()
});

// ==============================================================================
// Type Guards and Utilities
// ==============================================================================

/**
 * Type guard to check if an object is a valid KPack manifest
 */
export function isKPackManifest(obj: any): obj is KPackManifest {
  try {
    KPackManifestSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a KPack manifest and returns validation errors
 */
export function validateKPackManifest(manifest: any): { valid: boolean; errors?: string[] } {
  try {
    KPackManifestSchema.parse(manifest);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      valid: false,
      errors: ['Unknown validation error']
    };
  }
}

/**
 * Creates a content address from data
 */
export async function createContentAddress(
  data: Buffer | string,
  type: ContentAddressType = 'sha256'
): Promise<ContentAddress> {
  const { createHash } = await import('crypto');
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  
  const hash = createHash(type === 'cid' ? 'sha256' : type)
    .update(buffer)
    .digest('hex');
  
  return {
    type,
    value: type === 'cid' ? `bafkreie${hash.slice(0, 52)}` : hash, // Simplified CID
    size: buffer.length
  };
}

/**
 * Example KPack manifest for reference
 */
export const exampleKPackManifest: KPackManifest = {
  id: 'com.example.api-toolkit',
  name: 'Enterprise API Toolkit',
  version: '1.0.0',
  description: 'Comprehensive API development toolkit for enterprise applications',
  contentAddress: {
    type: 'sha256',
    value: '7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730',
    size: 1048576
  },
  artifacts: [
    {
      path: 'templates/api-controller.njk',
      contentAddress: {
        type: 'sha256',
        value: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        size: 2048
      },
      mediaType: 'text/template'
    }
  ],
  facets: {
    domain: ['finance', 'technology'],
    artifactType: ['api', 'template'],
    compliance: ['sox', 'gdpr'],
    maturity: 'stable',
    license: 'commercial'
  },
  metadata: {
    keywords: ['api', 'enterprise', 'toolkit', 'rest'],
    tags: ['backend', 'development', 'enterprise'],
    category: 'development-tools',
    repository: {
      type: 'git',
      url: 'https://github.com/example/api-toolkit'
    }
  },
  value: {
    pricing: [
      {
        type: 'fixed',
        currency: {
          code: 'USD',
          name: 'US Dollar',
          type: 'fiat',
          decimals: 2
        },
        price: 99.99
      }
    ]
  },
  attestation: {
    required: true,
    algorithms: ['ed25519', 'ecdsa-p256']
  },
  trustIndicators: {
    publisherVerified: true,
    codeReviewed: true,
    securityScanned: true,
    reproductibleBuild: true
  },
  publisher: {
    id: 'example-corp',
    name: 'Example Corporation',
    email: 'dev@example.com',
    website: 'https://example.com',
    verified: true,
    reputation: {
      score: 0.95,
      reviewCount: 150,
      lastUpdated: '2025-09-12T16:00:00Z'
    }
  },
  publishedAt: '2025-09-12T16:00:00Z',
  compatibility: {
    kgenVersion: '^1.0.0',
    nodeVersion: '>=18.0.0'
  }
};