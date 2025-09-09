/**
 * Enterprise REST API with Versioning Strategy
 * Supports multiple versioning strategies: URL path, headers, content negotiation
 */

import { Router } from 'express';
import semver from 'semver';
import logger from '../../lib/observability/logger.js';

export class RestApiVersioning {
  constructor(config = {}) {
    this.config = {
      defaultVersion: '1.0.0',
      supportedVersions: ['1.0.0', '1.1.0', '2.0.0'],
      versioningStrategy: 'url', // url, header, content-negotiation
      deprecationWarningPeriod: 90, // days
      headerName: 'API-Version',
      ...config
    };
    
    this.routes = new Map();
    this.middleware = new Map();
    this.deprecatedVersions = new Map();
    this.router = Router();
    
    this.setupVersioningMiddleware();
  }

  setupVersioningMiddleware() {
    // Version detection middleware
    this.router.use((req, res, next) => {
      const version = this.detectVersion(req);
      req.apiVersion = this.resolveVersion(version);
      
      // Add version info to response headers
      res.set('API-Version', req.apiVersion);
      res.set('Supported-Versions', this.config.supportedVersions.join(', '));
      
      // Check for deprecated version
      this.checkDeprecation(req, res);
      
      next();
    });

    // Request/Response transformation middleware
    this.router.use((req, res, next) => {
      this.transformRequest(req);
      this.setupResponseTransformation(req, res);
      next();
    });
  }

  detectVersion(req) {
    switch (this.config.versioningStrategy) {
      case 'url':
        return this.extractVersionFromUrl(req);
      case 'header':
        return req.headers[this.config.headerName.toLowerCase()];
      case 'content-negotiation':
        return this.extractVersionFromAcceptHeader(req);
      default:
        return this.config.defaultVersion;
    }
  }

  extractVersionFromUrl(req) {
    // Extract version from URL patterns like /api/v1/ or /api/v2.1/
    const match = req.path.match(/\/api\/v(\d+(?:\.\d+)?(?:\.\d+)?)/);
    return match ? this.normalizeVersion(match[1]) : this.config.defaultVersion;
  }

  extractVersionFromAcceptHeader(req) {
    const accept = req.headers.accept || '';
    const match = accept.match(/application\/vnd\.unjucks\.v(\d+(?:\.\d+)?(?:\.\d+)?)\+json/);
    return match ? this.normalizeVersion(match[1]) : this.config.defaultVersion;
  }

  normalizeVersion(version) {
    // Ensure version follows semver format
    if (!version.includes('.')) {
      return `${version}.0.0`;
    }
    const parts = version.split('.');
    while (parts.length < 3) {
      parts.push('0');
    }
    return parts.join('.');
  }

  resolveVersion(requestedVersion) {
    if (!requestedVersion) {
      return this.config.defaultVersion;
    }

    // Find the best matching supported version
    const normalized = this.normalizeVersion(requestedVersion);
    
    // Exact match
    if (this.config.supportedVersions.includes(normalized)) {
      return normalized;
    }

    // Find compatible version (same major version, highest minor)
    const major = semver.major(normalized);
    const compatibleVersions = this.config.supportedVersions
      .filter(v => semver.major(v) === major)
      .sort(semver.rcompare);

    return compatibleVersions[0] || this.config.defaultVersion;
  }

  checkDeprecation(req, res) {
    const version = req.apiVersion;
    const deprecation = this.deprecatedVersions.get(version);
    
    if (deprecation) {
      const daysUntilRemoval = Math.ceil(
        (deprecation.removalDate - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      res.set('Deprecation', deprecation.deprecationDate.toISOString());
      res.set('Sunset', deprecation.removalDate.toISOString());
      res.set('Warning', `299 - "API version ${version} is deprecated. ` +
        `It will be removed in ${daysUntilRemoval} days. ` +
        `Please migrate to version ${this.getLatestVersion()}"`);
      
      logger.warn('Deprecated API version used', {
        version,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        daysUntilRemoval
      });
    }
  }

  transformRequest(req) {
    const version = req.apiVersion;
    const transformer = this.middleware.get(`request:${version}`);
    
    if (transformer) {
      transformer(req);
    }
  }

  setupResponseTransformation(req, res) {
    const version = req.apiVersion;
    const originalJson = res.json;
    
    res.json = (data) => {
      const transformer = this.middleware.get(`response:${version}`);
      if (transformer) {
        data = transformer(data, req);
      }
      
      return originalJson.call(res, data);
    };
  }

  // Route registration with version-specific handlers
  get(path, ...handlers) {
    return this.registerRoute('GET', path, handlers);
  }

  post(path, ...handlers) {
    return this.registerRoute('POST', path, handlers);
  }

  put(path, ...handlers) {
    return this.registerRoute('PUT', path, handlers);
  }

  patch(path, ...handlers) {
    return this.registerRoute('PATCH', path, handlers);
  }

  delete(path, ...handlers) {
    return this.registerRoute('DELETE', path, handlers);
  }

  registerRoute(method, path, handlers) {
    const versionedPath = this.buildVersionedPath(path);
    
    // Register route for each supported version
    this.config.supportedVersions.forEach(version => {
      const routeKey = `${method}:${versionedPath}:${version}`;
      this.routes.set(routeKey, handlers);
    });

    // Set up actual Express route
    this.router[method.toLowerCase()](versionedPath, (req, res, next) => {
      const routeKey = `${method}:${versionedPath}:${req.apiVersion}`;
      const versionHandlers = this.routes.get(routeKey) || handlers;
      
      // Execute handlers in sequence
      this.executeHandlers(versionHandlers, req, res, next);
    });

    return this;
  }

  buildVersionedPath(path) {
    if (this.config.versioningStrategy === 'url') {
      return path.replace(/^\/api\//, '/api/v:version/');
    }
    return path;
  }

  executeHandlers(handlers, req, res, next) {
    let index = 0;
    
    const nextHandler = (error) => {
      if (error) return next(error);
      
      if (index >= handlers.length) {
        return next();
      }
      
      const handler = handlers[index++];
      try {
        handler(req, res, nextHandler);
      } catch (error) {
        next(error);
      }
    };
    
    nextHandler();
  }

  // Version-specific middleware registration
  use(version, middleware) {
    if (typeof version === 'function') {
      // Global middleware
      this.router.use(version);
    } else {
      // Version-specific middleware
      this.middleware.set(`middleware:${version}`, middleware);
    }
    return this;
  }

  // Request/Response transformers for version compatibility
  addRequestTransformer(version, transformer) {
    this.middleware.set(`request:${version}`, transformer);
    return this;
  }

  addResponseTransformer(version, transformer) {
    this.middleware.set(`response:${version}`, transformer);
    return this;
  }

  // Deprecation management
  deprecateVersion(version, removalDate = null) {
    const deprecationDate = new Date();
    const removal = removalDate || new Date(
      Date.now() + (this.config.deprecationWarningPeriod * 24 * 60 * 60 * 1000)
    );
    
    this.deprecatedVersions.set(version, {
      deprecationDate,
      removalDate: removal
    });
    
    logger.info(`API version ${version} deprecated`, {
      deprecationDate,
      removalDate: removal
    });
    
    return this;
  }

  removeVersion(version) {
    const index = this.config.supportedVersions.indexOf(version);
    if (index > -1) {
      this.config.supportedVersions.splice(index, 1);
      this.deprecatedVersions.delete(version);
      
      // Remove all routes for this version
      for (const [key] of this.routes) {
        if (key.endsWith(`:${version}`)) {
          this.routes.delete(key);
        }
      }
      
      logger.info(`API version ${version} removed`);
    }
    return this;
  }

  getLatestVersion() {
    return this.config.supportedVersions
      .sort(semver.rcompare)[0];
  }

  getVersionInfo() {
    return {
      supportedVersions: this.config.supportedVersions,
      defaultVersion: this.config.defaultVersion,
      latestVersion: this.getLatestVersion(),
      deprecatedVersions: Object.fromEntries(this.deprecatedVersions),
      versioningStrategy: this.config.versioningStrategy
    };
  }

  // Metrics and monitoring
  getMetrics() {
    const versionUsage = new Map();
    
    // This would be populated by actual usage tracking
    this.config.supportedVersions.forEach(version => {
      versionUsage.set(version, {
        requestCount: 0,
        errorCount: 0,
        lastUsed: null
      });
    });
    
    return {
      supportedVersions: this.config.supportedVersions.length,
      deprecatedVersions: this.deprecatedVersions.size,
      totalRoutes: this.routes.size,
      versionUsage: Object.fromEntries(versionUsage)
    };
  }

  getRouter() {
    return this.router;
  }
}

// Example usage and version-specific transformers
export class ApiTransformers {
  static createV1ToV2RequestTransformer() {
    return (req) => {
      // Transform v1 request format to internal format
      if (req.body && req.body.data) {
        req.body = { ...req.body.data, _v1Format: true };
      }
    };
  }

  static createV2ToV1ResponseTransformer() {
    return (data, req) => {
      // Transform internal format to v1 response format
      if (req.body && req.body._v1Format) {
        return { data, version: '1.0.0' };
      }
      return data;
    };
  }

  static createV2RequestTransformer() {
    return (req) => {
      // v2 specific transformations
      if (req.body && req.body.filters) {
        req.body.where = req.body.filters;
        delete req.body.filters;
      }
    };
  }
}

export default RestApiVersioning;