/**
 * @fileoverview KGEN Marketplace - Main entry point
 * @version 1.0.0
 * @description Exports all public APIs for the KGEN Marketplace system
 */

// Core marketplace service
export { MarketplaceService } from './marketplace-service.js';
export type {
  MarketplaceConfig,
  MarketplaceListing,
  ListingStatus,
  DownloadResult,
  PublicationResult,
  MarketplaceStats
} from './marketplace-service.js';

// Type definitions
export type {
  // Core KPack types
  KPackManifest,
  ContentAddress,
  ContentAddressType,
  ArtifactReference,
  
  // Facet classification
  FacetClassification,
  Domain,
  ArtifactType,
  ComplianceLevel,
  MaturityLevel,
  LicenseType,
  WeightedFacet,
  
  // Payment and value types
  Currency,
  CurrencyType,
  PricingModel,
  PricingModelType,
  FixedPricing,
  SubscriptionPricing,
  UsagePricing,
  TieredPricing,
  AuctionPricing,
  ValueVector,
  
  // Trust and attestation
  AttestationRequirements,
  TrustIndicators,
  Publisher,
  KPackMetadata,
  Dependency,
  
  // Search and discovery
  SearchCriteria,
  SearchResult
} from './types/kpack.js';

export {
  // Validation utilities
  KPackManifestSchema,
  ContentAddressSchema,
  ArtifactReferenceSchema,
  FacetClassificationSchema,
  isKPackManifest,
  validateKPackManifest,
  createContentAddress,
  exampleKPackManifest
} from './types/kpack.js';

// Registry abstraction
export {
  RegistryAdapter,
  RegistryFactory,
  RegistryManager
} from './registry/registry-abstraction.js';

export type {
  RegistryConfig,
  PackageMetadata,
  RegistryResult,
  DownloadInfo,
  RegistryStats
} from './registry/registry-abstraction.js';

export {
  validateRegistryConfig,
  buildRegistryUrl,
  parseRegistryUrl,
  createConfigFromEnv
} from './registry/registry-abstraction.js';

// Payment system
export {
  PaymentProvider,
  PaymentSystem,
  CurrencyExchangeService
} from './payments/payment-system.js';

export type {
  PaymentStatus,
  PaymentMethodType,
  PaymentMethod,
  PaymentIntent,
  PaymentTransaction,
  PaymentReceipt,
  PaymentPolicy,
  ExchangeRate
} from './payments/payment-system.js';

// Trust and attestation
export {
  KeyManagementService,
  AttestationService,
  TrustRegistry
} from './trust/attestation-service.js';

export type {
  SignatureAlgorithm,
  HashAlgorithm,
  AttestationType,
  TrustLevel,
  KeyPair,
  DigitalSignature,
  AttestationStatement,
  SignedAttestation,
  TrustScore,
  SecurityScanResult,
  CodeReviewAttestation
} from './trust/attestation-service.js';

// Version information
export const VERSION = '1.0.0';

// Feature flags
export const FEATURES = {
  CONTENT_ADDRESSING: true,
  CRYPTOGRAPHIC_ATTESTATION: true,
  MULTI_CURRENCY_PAYMENTS: true,
  TRUST_SCORING: true,
  FACETED_SEARCH: true,
  REGISTRY_ABSTRACTION: true,
  REPRODUCIBLE_BUILDS: true,
  SUPPLY_CHAIN_SECURITY: true
} as const;

// Default configurations
export const DEFAULT_MARKETPLACE_CONFIG: Partial<MarketplaceConfig> = {
  features: {
    payments: true,
    attestations: true,
    trustScoring: true,
    contentAddressing: true
  },
  policies: {
    requireAttestation: false,
    minimumTrustScore: 0.5,
    allowedLicenses: ['mit', 'apache-2.0', 'bsd-3-clause', 'commercial'],
    moderationEnabled: true
  },
  limits: {
    maxPackageSize: 100 * 1024 * 1024, // 100MB
    maxArtifacts: 1000,
    rateLimits: {
      publishPerHour: 10,
      downloadPerHour: 1000,
      searchPerMinute: 100
    }
  }
};

export const DEFAULT_REGISTRY_CONFIG: Partial<RegistryConfig> = {
  type: 'npm',
  options: {
    timeout: 30000,
    retries: 3,
    compressionEnabled: true
  }
};

// Utility functions for common operations
export const MarketplaceUtils = {
  /**
   * Create a minimal KPack manifest
   */
  createMinimalManifest(
    id: string,
    name: string,
    version: string,
    description: string
  ): Partial<KPackManifest> {
    return {
      id,
      name,
      version,
      description,
      facets: {
        domain: ['technology'],
        artifactType: ['library'],
        compliance: ['none'],
        maturity: 'stable',
        license: 'mit'
      },
      metadata: {
        keywords: [],
        tags: []
      },
      value: {
        pricing: [{ type: 'free' }]
      },
      attestation: {
        required: false,
        algorithms: ['ed25519']
      },
      trustIndicators: {
        publisherVerified: false,
        codeReviewed: false,
        securityScanned: false,
        reproductibleBuild: false
      },
      publishedAt: new Date().toISOString()
    };
  },

  /**
   * Generate a content address for data
   */
  async generateContentAddress(
    data: string | Buffer,
    algorithm: ContentAddressType = 'sha256'
  ): Promise<ContentAddress> {
    return createContentAddress(data, algorithm);
  },

  /**
   * Validate a facet classification
   */
  validateFacets(facets: FacetClassification): { valid: boolean; errors: string[] } {
    try {
      FacetClassificationSchema.parse(facets);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: error instanceof Error ? [error.message] : ['Invalid facets']
      };
    }
  }
} as const;