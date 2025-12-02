/**
 * @fileoverview Core marketplace service orchestrating all components
 * @version 1.0.0
 * @description Main service class that coordinates registry, payments, and trust
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { KPackManifest, SearchCriteria, SearchResult } from './types/kpack.js';
import { RegistryManager, RegistryConfig } from './registry/registry-abstraction.js';
import { PaymentSystem, PaymentMethod, PaymentReceipt } from './payments/payment-system.js';
import { AttestationService, TrustRegistry, TrustScore } from './trust/attestation-service.js';

// ==============================================================================
// Marketplace Types
// ==============================================================================

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  name: string;
  url: string;
  registries: RegistryConfig[];
  features: {
    payments: boolean;
    attestations: boolean;
    trustScoring: boolean;
    contentAddressing: boolean;
  };
  policies: {
    requireAttestation: boolean;
    minimumTrustScore?: number;
    allowedLicenses: string[];
    moderationEnabled: boolean;
  };
  limits: {
    maxPackageSize: number; // bytes
    maxArtifacts: number;
    rateLimits: {
      publishPerHour: number;
      downloadPerHour: number;
      searchPerMinute: number;
    };
  };
}

/**
 * Listing status in the marketplace
 */
export type ListingStatus = 
  | 'draft'
  | 'pending-review'
  | 'published'
  | 'suspended'
  | 'removed'
  | 'deprecated';

/**
 * Marketplace listing with enhanced metadata
 */
export interface MarketplaceListing {
  id: string;
  kpack: KPackManifest;
  status: ListingStatus;
  publisherId: string;
  registryInfo: {
    registry: string;
    url: string;
    namespace?: string;
  };
  trustScore?: TrustScore;
  moderation: {
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
    flags: string[];
    warnings: string[];
  };
  statistics: {
    downloads: number;
    ratings: {
      average: number;
      count: number;
      distribution: Record<string, number>;
    };
    createdAt: Date;
    updatedAt: Date;
    lastDownload?: Date;
  };
  metadata: {
    featured: boolean;
    categories: string[];
    tags: string[];
    searchTerms: string[];
  };
}

/**
 * Download result with access information
 */
export interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  receipt?: PaymentReceipt;
  accessToken?: string;
  artifacts?: Map<string, Buffer>;
  error?: string;
  requirements?: {
    payment: boolean;
    authentication: boolean;
    agreement: string[];
  };
}

/**
 * Publication result
 */
export interface PublicationResult {
  success: boolean;
  listingId?: string;
  registryUrl?: string;
  errors?: string[];
  warnings?: string[];
  trustScore?: TrustScore;
  moderationRequired?: boolean;
}

/**
 * Marketplace statistics
 */
export interface MarketplaceStats {
  listings: {
    total: number;
    published: number;
    pending: number;
    byCategory: Record<string, number>;
    byLicense: Record<string, number>;
  };
  downloads: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    topPackages: Array<{ name: string; downloads: number }>;
  };
  publishers: {
    total: number;
    verified: number;
    active: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    byCurrency: Record<string, number>;
  };
}

// ==============================================================================
// Core Marketplace Service
// ==============================================================================

/**
 * Main marketplace service coordinating all subsystems
 */
export class MarketplaceService extends EventEmitter {
  private config: MarketplaceConfig;
  private registryManager: RegistryManager;
  private paymentSystem: PaymentSystem;
  private attestationService: AttestationService;
  private trustRegistry: TrustRegistry;
  private listings = new Map<string, MarketplaceListing>();
  private downloadTokens = new Map<string, { listingId: string; expiresAt: Date; userId: string }>();

  constructor(config: MarketplaceConfig) {
    super();
    this.config = config;
    this.registryManager = new RegistryManager();
    this.paymentSystem = new PaymentSystem();
    this.attestationService = new AttestationService();
    this.trustRegistry = new TrustRegistry();

    this.setupEventHandlers();
  }

  /**
   * Initialize the marketplace service
   */
  async initialize(): Promise<void> {
    // Initialize registries
    for (const registryConfig of this.config.registries) {
      await this.registryManager.addRegistry(
        registryConfig.url,
        registryConfig,
        this.config.registries.indexOf(registryConfig) === 0
      );
    }

    this.emit('marketplace-initialized', this.config.name);
  }

  /**
   * Publish a KPack to the marketplace
   */
  async publishKPack(
    manifest: KPackManifest,
    artifacts: Map<string, Buffer>,
    publisherId: string,
    registryName?: string
  ): Promise<PublicationResult> {
    try {
      // Validate the manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Check publisher permissions
      const canPublish = await this.checkPublisherPermissions(publisherId, manifest);
      if (!canPublish.allowed) {
        return {
          success: false,
          errors: [canPublish.reason || 'Publication not allowed']
        };
      }

      // Calculate trust score
      let trustScore: TrustScore | undefined;
      if (this.config.features.trustScoring) {
        trustScore = await this.attestationService.calculateTrustScore(manifest.id, manifest);
        
        if (this.config.policies.minimumTrustScore && 
            trustScore.overall < this.config.policies.minimumTrustScore) {
          return {
            success: false,
            errors: [`Trust score ${trustScore.overall} below minimum ${this.config.policies.minimumTrustScore}`],
            trustScore
          };
        }
      }

      // Verify attestations if required
      if (this.config.policies.requireAttestation || manifest.attestation.required) {
        const attestationCheck = await this.attestationService.verifyKPackAttestations(
          manifest.id,
          manifest.attestation
        );
        
        if (!attestationCheck.compliant) {
          return {
            success: false,
            errors: [
              ...attestationCheck.missingAttestations.map(t => `Missing attestation: ${t}`),
              ...attestationCheck.invalidAttestations.map(id => `Invalid attestation: ${id}`)
            ],
            warnings: attestationCheck.warnings
          };
        }
      }

      // Publish to registry
      const registry = this.registryManager.getRegistry(registryName);
      const publishResult = await registry.publish(manifest, artifacts);
      
      if (!publishResult.success) {
        return {
          success: false,
          errors: [publishResult.error || 'Registry publication failed']
        };
      }

      // Create marketplace listing
      const listing: MarketplaceListing = {
        id: randomUUID(),
        kpack: manifest,
        status: this.config.policies.moderationEnabled ? 'pending-review' : 'published',
        publisherId,
        registryInfo: {
          registry: registryName || 'default',
          url: publishResult.data?.url || '',
          namespace: registry.getConfig().namespace
        },
        trustScore,
        moderation: {
          reviewed: !this.config.policies.moderationEnabled,
          flags: [],
          warnings: []
        },
        statistics: {
          downloads: 0,
          ratings: {
            average: 0,
            count: 0,
            distribution: {}
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        metadata: {
          featured: false,
          categories: manifest.facets.domain,
          tags: manifest.metadata.tags,
          searchTerms: this.generateSearchTerms(manifest)
        }
      };

      this.listings.set(listing.id, listing);
      this.emit('kpack-published', listing);

      return {
        success: true,
        listingId: listing.id,
        registryUrl: publishResult.data?.url,
        trustScore,
        moderationRequired: this.config.policies.moderationEnabled
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown publication error';
      this.emit('publication-error', manifest.id, errorMessage);
      
      return {
        success: false,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Search for KPacks in the marketplace
   */
  async searchKPacks(criteria: SearchCriteria): Promise<SearchResult> {
    // Apply rate limiting
    if (!this.checkRateLimit('search')) {
      throw new Error('Search rate limit exceeded');
    }

    // Search in local listings first
    const localResults = this.searchLocalListings(criteria);

    // If configured, also search in registries
    const registryResults = new Map<string, SearchResult>();
    if (criteria.query && this.config.registries.length > 0) {
      const searchResults = await this.registryManager.searchAll(criteria);
      
      for (const [registry, result] of searchResults) {
        if (result.success && result.data) {
          registryResults.set(registry, result.data);
        }
      }
    }

    // Merge and rank results
    const mergedResults = this.mergeSearchResults(localResults, registryResults);
    
    this.emit('search-performed', criteria, mergedResults.total);
    return mergedResults;
  }

  /**
   * Get a KPack listing by ID
   */
  getListing(listingId: string): MarketplaceListing | undefined {
    return this.listings.get(listingId);
  }

  /**
   * Download a KPack (with payment processing if required)
   */
  async downloadKPack(
    listingId: string,
    userId: string,
    paymentMethod?: PaymentMethod
  ): Promise<DownloadResult> {
    const listing = this.listings.get(listingId);
    if (!listing) {
      return {
        success: false,
        error: 'Listing not found'
      };
    }

    if (listing.status !== 'published') {
      return {
        success: false,
        error: `Cannot download ${listing.status} listing`
      };
    }

    // Check if payment is required
    const requiresPayment = this.doesRequirePayment(listing);
    
    if (requiresPayment && !paymentMethod) {
      return {
        success: false,
        error: 'Payment required',
        requirements: {
          payment: true,
          authentication: true,
          agreement: ['terms-of-service', 'license-agreement']
        }
      };
    }

    let receipt: PaymentReceipt | undefined;
    
    // Process payment if required
    if (requiresPayment && paymentMethod) {
      try {
        receipt = await this.paymentSystem.processPayment(
          listingId,
          listing.kpack.value,
          userId,
          listing.publisherId,
          paymentMethod
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Payment failed'
        };
      }
    }

    // Generate download token
    const accessToken = this.generateDownloadToken(listingId, userId);

    // Get download URL from registry
    const registry = this.registryManager.getRegistry(listing.registryInfo.registry);
    const downloadInfo = await registry.getDownloadUrl(
      listing.kpack.name,
      listing.kpack.version
    );

    if (!downloadInfo.success) {
      return {
        success: false,
        error: downloadInfo.error || 'Failed to get download URL'
      };
    }

    // Update download statistics
    this.updateDownloadStats(listingId);

    this.emit('kpack-downloaded', listingId, userId);

    return {
      success: true,
      downloadUrl: downloadInfo.data?.url,
      receipt,
      accessToken
    };
  }

  /**
   * Get marketplace statistics
   */
  getMarketplaceStats(): MarketplaceStats {
    const listings = Array.from(this.listings.values());
    const published = listings.filter(l => l.status === 'published');
    const pending = listings.filter(l => l.status === 'pending-review');

    const categoryCount = new Map<string, number>();
    const licenseCount = new Map<string, number>();
    
    for (const listing of published) {
      for (const category of listing.metadata.categories) {
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      }
      
      const license = listing.kpack.facets.license;
      licenseCount.set(license, (licenseCount.get(license) || 0) + 1);
    }

    const totalDownloads = published.reduce((sum, l) => sum + l.statistics.downloads, 0);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Simplified download calculations (would use proper analytics in production)
    const downloadsToday = Math.floor(totalDownloads * 0.01);
    const downloadsThisWeek = Math.floor(totalDownloads * 0.07);
    const downloadsThisMonth = Math.floor(totalDownloads * 0.3);

    const paymentStats = this.paymentSystem.getPaymentStats();

    return {
      listings: {
        total: listings.length,
        published: published.length,
        pending: pending.length,
        byCategory: Object.fromEntries(categoryCount),
        byLicense: Object.fromEntries(licenseCount)
      },
      downloads: {
        total: totalDownloads,
        today: downloadsToday,
        thisWeek: downloadsThisWeek,
        thisMonth: downloadsThisMonth,
        topPackages: published
          .sort((a, b) => b.statistics.downloads - a.statistics.downloads)
          .slice(0, 10)
          .map(l => ({ name: l.kpack.name, downloads: l.statistics.downloads }))
      },
      publishers: {
        total: new Set(listings.map(l => l.publisherId)).size,
        verified: new Set(
          listings.filter(l => l.kpack.publisher.verified).map(l => l.publisherId)
        ).size,
        active: new Set(
          listings.filter(l => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return l.statistics.updatedAt > weekAgo;
          }).map(l => l.publisherId)
        ).size
      },
      revenue: {
        total: Object.values(paymentStats.totalVolume).reduce((sum, vol) => sum + vol, 0),
        thisMonth: Object.values(paymentStats.totalVolume).reduce((sum, vol) => sum + vol * 0.3, 0),
        byCurrency: paymentStats.totalVolume
      }
    };
  }

  /**
   * Update a listing's status (for moderation)
   */
  async updateListingStatus(
    listingId: string,
    status: ListingStatus,
    moderatorId?: string,
    reason?: string
  ): Promise<boolean> {
    const listing = this.listings.get(listingId);
    if (!listing) {
      return false;
    }

    const oldStatus = listing.status;
    listing.status = status;
    listing.statistics.updatedAt = new Date();

    if (moderatorId) {
      listing.moderation.reviewed = true;
      listing.moderation.reviewedBy = moderatorId;
      listing.moderation.reviewedAt = new Date();
    }

    this.emit('listing-status-updated', listingId, oldStatus, status, reason);
    return true;
  }

  /**
   * Add a review/rating to a listing
   */
  addReview(
    listingId: string,
    userId: string,
    rating: number,
    review?: string
  ): boolean {
    const listing = this.listings.get(listingId);
    if (!listing || rating < 1 || rating > 5) {
      return false;
    }

    // Update rating statistics
    const stats = listing.statistics.ratings;
    const totalRating = stats.average * stats.count + rating;
    stats.count += 1;
    stats.average = totalRating / stats.count;
    
    const ratingKey = rating.toString();
    stats.distribution[ratingKey] = (stats.distribution[ratingKey] || 0) + 1;

    listing.statistics.updatedAt = new Date();

    this.emit('review-added', listingId, userId, rating, review);
    return true;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<MarketplaceConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MarketplaceConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Payment system events
    this.paymentSystem.on('payment-completed', (receipt) => {
      this.emit('payment-completed', receipt);
    });

    this.paymentSystem.on('payment-failed', (error) => {
      this.emit('payment-failed', error);
    });

    // Registry events
    this.registryManager.on('registry-error', (name, error) => {
      this.emit('registry-error', name, error);
    });

    // Attestation events
    this.attestationService.on('trust-score-calculated', (kpackId, score) => {
      this.emit('trust-score-calculated', kpackId, score);
    });
  }

  private validateManifest(manifest: KPackManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check license policy
    if (!this.config.policies.allowedLicenses.includes(manifest.facets.license)) {
      errors.push(`License ${manifest.facets.license} not allowed`);
    }

    // Check package size
    const totalSize = manifest.artifacts.reduce((sum, artifact) => sum + artifact.contentAddress.size, 0);
    if (totalSize > this.config.limits.maxPackageSize) {
      errors.push(`Package size ${totalSize} exceeds limit ${this.config.limits.maxPackageSize}`);
    }

    // Check artifact count
    if (manifest.artifacts.length > this.config.limits.maxArtifacts) {
      errors.push(`Artifact count ${manifest.artifacts.length} exceeds limit ${this.config.limits.maxArtifacts}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async checkPublisherPermissions(
    publisherId: string,
    manifest: KPackManifest
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check if publisher is banned
    if (this.trustRegistry.isRevoked(publisherId)) {
      return { allowed: false, reason: 'Publisher access revoked' };
    }

    // Check rate limits
    if (!this.checkRateLimit('publish', publisherId)) {
      return { allowed: false, reason: 'Publish rate limit exceeded' };
    }

    // Additional permission checks...
    return { allowed: true };
  }

  private checkRateLimit(operation: string, userId?: string): boolean {
    // Simplified rate limiting - would use Redis or similar in production
    return true;
  }

  private searchLocalListings(criteria: SearchCriteria): SearchResult {
    let results = Array.from(this.listings.values())
      .filter(listing => listing.status === 'published');

    // Apply filters
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      results = results.filter(listing => 
        listing.kpack.name.toLowerCase().includes(query) ||
        listing.kpack.description.toLowerCase().includes(query) ||
        listing.metadata.searchTerms.some(term => term.toLowerCase().includes(query))
      );
    }

    if (criteria.domain) {
      results = results.filter(listing =>
        criteria.domain!.some(domain => listing.kpack.facets.domain.includes(domain as any))
      );
    }

    if (criteria.artifactType) {
      results = results.filter(listing =>
        criteria.artifactType!.some(type => listing.kpack.facets.artifactType.includes(type as any))
      );
    }

    if (criteria.license) {
      results = results.filter(listing => listing.kpack.facets.license === criteria.license);
    }

    if (criteria.publisher) {
      results = results.filter(listing => listing.publisherId === criteria.publisher);
    }

    // Apply sorting
    if (criteria.sortBy) {
      results.sort((a, b) => {
        let comparison = 0;
        switch (criteria.sortBy) {
          case 'name':
            comparison = a.kpack.name.localeCompare(b.kpack.name);
            break;
          case 'downloads':
            comparison = b.statistics.downloads - a.statistics.downloads;
            break;
          case 'updated':
            comparison = b.statistics.updatedAt.getTime() - a.statistics.updatedAt.getTime();
            break;
          case 'created':
            comparison = b.statistics.createdAt.getTime() - a.statistics.createdAt.getTime();
            break;
          default:
            comparison = b.statistics.downloads - a.statistics.downloads; // Default to downloads
        }
        return criteria.sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 50;
    const paginatedResults = results.slice(offset, offset + limit);

    // Convert to SearchResult format
    const packages = paginatedResults.map(listing => ({
      name: listing.kpack.name,
      version: listing.kpack.version,
      description: listing.kpack.description,
      tags: listing.metadata.tags,
      publishedAt: listing.statistics.createdAt,
      size: listing.kpack.artifacts.reduce((sum, a) => sum + a.contentAddress.size, 0),
      checksum: listing.kpack.contentAddress.value,
      manifest: listing.kpack
    }));

    return {
      packages,
      total: results.length,
      offset,
      limit
    };
  }

  private mergeSearchResults(
    localResults: SearchResult,
    registryResults: Map<string, SearchResult>
  ): SearchResult {
    // For now, just return local results
    // In a full implementation, you'd merge and deduplicate results from all sources
    return localResults;
  }

  private generateSearchTerms(manifest: KPackManifest): string[] {
    const terms = [
      manifest.name,
      manifest.description,
      ...manifest.metadata.keywords,
      ...manifest.metadata.tags,
      ...manifest.facets.domain,
      ...manifest.facets.artifactType,
      manifest.publisher.name
    ];

    return [...new Set(terms.map(term => term.toLowerCase()))];
  }

  private doesRequirePayment(listing: MarketplaceListing): boolean {
    return listing.kpack.value.pricing.some(p => p.type !== 'free');
  }

  private generateDownloadToken(listingId: string, userId: string): string {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    this.downloadTokens.set(token, { listingId, expiresAt, userId });
    
    // Clean up expired tokens
    setTimeout(() => {
      this.downloadTokens.delete(token);
    }, 24 * 60 * 60 * 1000);
    
    return token;
  }

  private updateDownloadStats(listingId: string): void {
    const listing = this.listings.get(listingId);
    if (listing) {
      listing.statistics.downloads += 1;
      listing.statistics.lastDownload = new Date();
      listing.statistics.updatedAt = new Date();
    }
  }
}