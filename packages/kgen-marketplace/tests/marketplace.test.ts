/**
 * @fileoverview Tests for marketplace core functionality
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceService } from '../src/marketplace-service.js';
import { exampleKPackManifest } from '../src/types/kpack.js';
import type { MarketplaceConfig } from '../src/marketplace-service.js';

describe('MarketplaceService', () => {
  let marketplace: MarketplaceService;
  let config: MarketplaceConfig;

  beforeEach(() => {
    config = {
      name: 'Test Marketplace',
      url: 'https://test.marketplace.example.com',
      registries: [],
      features: {
        payments: true,
        attestations: true,
        trustScoring: true,
        contentAddressing: true
      },
      policies: {
        requireAttestation: false,
        allowedLicenses: ['mit', 'apache-2.0', 'commercial'],
        moderationEnabled: false
      },
      limits: {
        maxPackageSize: 100 * 1024 * 1024,
        maxArtifacts: 1000,
        rateLimits: {
          publishPerHour: 10,
          downloadPerHour: 1000,
          searchPerMinute: 100
        }
      }
    };

    marketplace = new MarketplaceService(config);
  });

  describe('initialization', () => {
    it('should create marketplace with config', () => {
      expect(marketplace.getConfig()).toEqual(config);
    });

    it('should emit initialization event', async () => {
      const initSpy = vi.fn();
      marketplace.on('marketplace-initialized', initSpy);

      await marketplace.initialize();
      
      expect(initSpy).toHaveBeenCalledWith(config.name);
    });
  });

  describe('KPack publication', () => {
    it('should publish valid KPack', async () => {
      const artifacts = new Map([
        ['template.njk', Buffer.from('test template content')],
        ['schema.json', Buffer.from('{"type": "object"}')]
      ]);

      const publisherId = 'test-publisher';
      
      // Mock registry manager to avoid actual network calls
      vi.spyOn(marketplace['registryManager'], 'getRegistry').mockReturnValue({
        publish: vi.fn().mockResolvedValue({
          success: true,
          data: { url: 'https://registry.example.com/test-package', version: '1.0.0' }
        }),
        getConfig: vi.fn().mockReturnValue({ namespace: 'test' })
      } as any);

      const result = await marketplace.publishKPack(
        exampleKPackManifest,
        artifacts,
        publisherId
      );

      expect(result.success).toBe(true);
      expect(result.listingId).toBeDefined();
      expect(result.registryUrl).toBeDefined();
    });

    it('should reject KPack with invalid license', async () => {
      const invalidManifest = {
        ...exampleKPackManifest,
        facets: {
          ...exampleKPackManifest.facets,
          license: 'invalid-license' as any
        }
      };

      const result = await marketplace.publishKPack(
        invalidManifest,
        new Map(),
        'test-publisher'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('License invalid-license not allowed');
    });

    it('should reject oversized package', async () => {
      const oversizedManifest = {
        ...exampleKPackManifest,
        artifacts: [
          {
            path: 'large-file.bin',
            contentAddress: {
              type: 'sha256' as const,
              value: 'hash',
              size: 200 * 1024 * 1024 // 200MB, exceeds 100MB limit
            },
            mediaType: 'application/octet-stream'
          }
        ]
      };

      const result = await marketplace.publishKPack(
        oversizedManifest,
        new Map(),
        'test-publisher'
      );

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toMatch(/Package size .* exceeds limit/);
    });
  });

  describe('search functionality', () => {
    it('should search published listings', async () => {
      // First publish a KPack
      const artifacts = new Map([['test.txt', Buffer.from('test')]]);
      
      vi.spyOn(marketplace['registryManager'], 'getRegistry').mockReturnValue({
        publish: vi.fn().mockResolvedValue({
          success: true,
          data: { url: 'https://registry.example.com/test', version: '1.0.0' }
        }),
        getConfig: vi.fn().mockReturnValue({ namespace: 'test' })
      } as any);

      await marketplace.publishKPack(exampleKPackManifest, artifacts, 'publisher');

      // Now search for it
      const searchResult = await marketplace.searchKPacks({
        query: 'Enterprise API Toolkit',
        limit: 10,
        offset: 0
      });

      expect(searchResult.packages).toHaveLength(1);
      expect(searchResult.packages[0].name).toBe(exampleKPackManifest.name);
      expect(searchResult.total).toBe(1);
    });

    it('should filter by domain', async () => {
      const artifacts = new Map([['test.txt', Buffer.from('test')]]);
      
      vi.spyOn(marketplace['registryManager'], 'getRegistry').mockReturnValue({
        publish: vi.fn().mockResolvedValue({
          success: true,
          data: { url: 'https://registry.example.com/test', version: '1.0.0' }
        }),
        getConfig: vi.fn().mockReturnValue({ namespace: 'test' })
      } as any);

      await marketplace.publishKPack(exampleKPackManifest, artifacts, 'publisher');

      const searchResult = await marketplace.searchKPacks({
        domain: ['finance'],
        limit: 10
      });

      expect(searchResult.packages).toHaveLength(1);

      const wrongDomainResult = await marketplace.searchKPacks({
        domain: ['healthcare'],
        limit: 10
      });

      expect(wrongDomainResult.packages).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should provide marketplace statistics', () => {
      const stats = marketplace.getMarketplaceStats();

      expect(stats).toHaveProperty('listings');
      expect(stats).toHaveProperty('downloads');
      expect(stats).toHaveProperty('publishers');
      expect(stats).toHaveProperty('revenue');

      expect(stats.listings.total).toBe(0);
      expect(stats.downloads.total).toBe(0);
      expect(stats.publishers.total).toBe(0);
    });

    it('should update statistics after publication', async () => {
      const artifacts = new Map([['test.txt', Buffer.from('test')]]);
      
      vi.spyOn(marketplace['registryManager'], 'getRegistry').mockReturnValue({
        publish: vi.fn().mockResolvedValue({
          success: true,
          data: { url: 'https://registry.example.com/test', version: '1.0.0' }
        }),
        getConfig: vi.fn().mockReturnValue({ namespace: 'test' })
      } as any);

      await marketplace.publishKPack(exampleKPackManifest, artifacts, 'publisher');

      const stats = marketplace.getMarketplaceStats();
      expect(stats.listings.total).toBe(1);
      expect(stats.listings.published).toBe(1);
      expect(stats.publishers.total).toBe(1);
    });
  });

  describe('listing management', () => {
    it('should update listing status', async () => {
      const artifacts = new Map([['test.txt', Buffer.from('test')]]);
      
      vi.spyOn(marketplace['registryManager'], 'getRegistry').mockReturnValue({
        publish: vi.fn().mockResolvedValue({
          success: true,
          data: { url: 'https://registry.example.com/test', version: '1.0.0' }
        }),
        getConfig: vi.fn().mockReturnValue({ namespace: 'test' })
      } as any);

      const result = await marketplace.publishKPack(exampleKPackManifest, artifacts, 'publisher');
      const listingId = result.listingId!;

      const updated = await marketplace.updateListingStatus(
        listingId,
        'suspended',
        'moderator-1',
        'Policy violation'
      );

      expect(updated).toBe(true);

      const listing = marketplace.getListing(listingId);
      expect(listing?.status).toBe('suspended');
      expect(listing?.moderation.reviewedBy).toBe('moderator-1');
    });

    it('should add reviews and update ratings', async () => {
      const artifacts = new Map([['test.txt', Buffer.from('test')]]);
      
      vi.spyOn(marketplace['registryManager'], 'getRegistry').mockReturnValue({
        publish: vi.fn().mockResolvedValue({
          success: true,
          data: { url: 'https://registry.example.com/test', version: '1.0.0' }
        }),
        getConfig: vi.fn().mockReturnValue({ namespace: 'test' })
      } as any);

      const result = await marketplace.publishKPack(exampleKPackManifest, artifacts, 'publisher');
      const listingId = result.listingId!;

      // Add multiple reviews
      marketplace.addReview(listingId, 'user1', 5, 'Excellent package!');
      marketplace.addReview(listingId, 'user2', 4, 'Very good');
      marketplace.addReview(listingId, 'user3', 3, 'Okay');

      const listing = marketplace.getListing(listingId);
      expect(listing?.statistics.ratings.count).toBe(3);
      expect(listing?.statistics.ratings.average).toBe(4); // (5+4+3)/3 = 4
      expect(listing?.statistics.ratings.distribution['5']).toBe(1);
      expect(listing?.statistics.ratings.distribution['4']).toBe(1);
      expect(listing?.statistics.ratings.distribution['3']).toBe(1);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const updates = {
        policies: {
          ...config.policies,
          requireAttestation: true
        }
      };

      marketplace.updateConfig(updates);

      const updatedConfig = marketplace.getConfig();
      expect(updatedConfig.policies.requireAttestation).toBe(true);
    });

    it('should emit config-updated event', () => {
      const configSpy = vi.fn();
      marketplace.on('config-updated', configSpy);

      const updates = { name: 'Updated Marketplace' };
      marketplace.updateConfig(updates);

      expect(configSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Marketplace' })
      );
    });
  });
});