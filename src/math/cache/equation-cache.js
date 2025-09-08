/**
 * Advanced Equation Caching System
 * Provides intelligent caching with LRU eviction and performance metrics
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

class EquationCache extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxSize: 1000,
            maxMemory: 50 * 1024 * 1024, // 50MB
            ttl: 24 * 60 * 60 * 1000, // 24 hours
            enableMetrics: true,
            enablePersistence: false,
            persistenceFile: null,
            ...options
        };
        
        // Cache storage
        this.cache = new Map();
        this.accessTimes = new Map();
        this.sizes = new Map();
        
        // Metrics
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalRequests: 0,
            memoryUsage: 0,
            averageRenderTime: 0
        };
        
        // Performance tracking
        this.renderTimes = [];
        this.maxRenderTimeHistory = 1000;
        
        // Start cleanup timer if TTL is enabled
        if (this.options.ttl > 0) {
            this.cleanupInterval = setInterval(() => {
                this._cleanupExpired();
            }, Math.min(this.options.ttl / 10, 60000)); // Check every minute max
        }
    }
    
    /**
     * Get cached equation or return null
     */
    get(key, latex = null, options = null) {
        this.metrics.totalRequests++;
        
        const cacheKey = this._generateKey(key, latex, options);
        
        if (this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey);
            
            // Check if expired
            if (this._isExpired(entry)) {
                this.cache.delete(cacheKey);
                this.accessTimes.delete(cacheKey);
                this.sizes.delete(cacheKey);
                this._updateMemoryUsage();
                this.metrics.misses++;
                return null;
            }
            
            // Update access time for LRU
            this.accessTimes.set(cacheKey, Date.now());
            this.metrics.hits++;
            
            this.emit('hit', { key: cacheKey, latex });
            return entry.html;
        }
        
        this.metrics.misses++;
        this.emit('miss', { key: cacheKey, latex });
        return null;
    }
    
    /**
     * Store rendered equation in cache
     */
    set(key, html, latex = null, options = null, renderTime = 0) {
        const cacheKey = this._generateKey(key, latex, options);
        const size = this._calculateSize(html);
        const now = Date.now();
        
        const entry = {
            html,
            latex,
            options,
            timestamp: now,
            size,
            renderTime,
            accessCount: 1
        };
        
        // Check if we need to evict entries
        this._ensureCapacity(size);
        
        // Store entry
        this.cache.set(cacheKey, entry);
        this.accessTimes.set(cacheKey, now);
        this.sizes.set(cacheKey, size);
        
        // Update metrics
        this._updateMemoryUsage();
        this._updateRenderTimeStats(renderTime);
        
        this.emit('set', { key: cacheKey, latex, size, renderTime });
    }
    
    /**
     * Check if key exists in cache
     */
    has(key, latex = null, options = null) {
        const cacheKey = this._generateKey(key, latex, options);
        return this.cache.has(cacheKey) && !this._isExpired(this.cache.get(cacheKey));
    }
    
    /**
     * Delete entry from cache
     */
    delete(key, latex = null, options = null) {
        const cacheKey = this._generateKey(key, latex, options);
        
        if (this.cache.has(cacheKey)) {
            this.cache.delete(cacheKey);
            this.accessTimes.delete(cacheKey);
            this.sizes.delete(cacheKey);
            this._updateMemoryUsage();
            this.emit('delete', { key: cacheKey });
            return true;
        }
        
        return false;
    }
    
    /**
     * Clear all cached entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.accessTimes.clear();
        this.sizes.clear();
        this.metrics.memoryUsage = 0;
        this.emit('clear', { entriesCleared: size });
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.metrics.totalRequests > 0 
            ? (this.metrics.hits / this.metrics.totalRequests * 100).toFixed(2)
            : 0;
        
        return {
            ...this.metrics,
            hitRate: `${hitRate}%`,
            entryCount: this.cache.size,
            memoryUsageMB: (this.metrics.memoryUsage / (1024 * 1024)).toFixed(2),
            averageEntrySize: this.cache.size > 0 
                ? (this.metrics.memoryUsage / this.cache.size).toFixed(0)
                : 0
        };
    }
    
    /**
     * Get top equations by access frequency
     */
    getTopEquations(limit = 10) {
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                latex: entry.latex,
                accessCount: entry.accessCount,
                renderTime: entry.renderTime,
                size: entry.size
            }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);
        
        return entries;
    }
    
    /**
     * Preload equations for better performance
     */
    async preload(equations, renderer) {
        const results = [];
        
        for (const equation of equations) {
            try {
                const startTime = Date.now();
                const html = await renderer._renderSingle(equation.latex, equation.options || {});
                const renderTime = Date.now() - startTime;
                
                this.set(equation.key || equation.latex, html, equation.latex, equation.options, renderTime);
                
                results.push({
                    key: equation.key || equation.latex,
                    success: true,
                    renderTime
                });
                
            } catch (error) {
                results.push({
                    key: equation.key || equation.latex,
                    success: false,
                    error: error.message
                });
            }
        }
        
        this.emit('preload', { results });
        return results;
    }
    
    /**
     * Export cache to JSON for persistence
     */
    export() {
        const data = {
            version: '1.0.0',
            timestamp: Date.now(),
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                ...entry
            })),
            metrics: this.metrics
        };
        
        return JSON.stringify(data, null, 2);
    }
    
    /**
     * Import cache from JSON
     */
    import(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.version || !data.entries) {
                throw new Error('Invalid cache data format');
            }
            
            this.clear();
            
            for (const entry of data.entries) {
                const { key, ...entryData } = entry;
                this.cache.set(key, entryData);
                this.accessTimes.set(key, entryData.timestamp);
                this.sizes.set(key, entryData.size);
            }
            
            this._updateMemoryUsage();
            this.emit('import', { entriesImported: data.entries.length });
            
            return data.entries.length;
            
        } catch (error) {
            this.emit('error', { operation: 'import', error });
            throw error;
        }
    }
    
    /**
     * Generate cache key
     */
    _generateKey(key, latex, options) {
        if (typeof key === 'string' && !latex && !options) {
            return key;
        }
        
        const data = {
            key: key || '',
            latex: latex || '',
            options: options || {}
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex')
            .substring(0, 16);
    }
    
    /**
     * Calculate memory size of entry
     */
    _calculateSize(html) {
        return Buffer.byteLength(html, 'utf8');
    }
    
    /**
     * Check if entry is expired
     */
    _isExpired(entry) {
        if (this.options.ttl <= 0) return false;
        return (Date.now() - entry.timestamp) > this.options.ttl;
    }
    
    /**
     * Ensure cache has capacity for new entry
     */
    _ensureCapacity(newEntrySize) {
        // Check memory limit
        while (this.metrics.memoryUsage + newEntrySize > this.options.maxMemory && this.cache.size > 0) {
            this._evictLRU();
        }
        
        // Check size limit
        while (this.cache.size >= this.options.maxSize) {
            this._evictLRU();
        }
    }
    
    /**
     * Evict least recently used entry
     */
    _evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, time] of this.accessTimes.entries()) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            const entry = this.cache.get(oldestKey);
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
            this.sizes.delete(oldestKey);
            this.metrics.evictions++;
            this.emit('evict', { key: oldestKey, entry });
        }
    }
    
    /**
     * Clean up expired entries
     */
    _cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (this._isExpired(entry)) {
                this.cache.delete(key);
                this.accessTimes.delete(key);
                this.sizes.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this._updateMemoryUsage();
            this.emit('cleanup', { entriesRemoved: cleaned });
        }
    }
    
    /**
     * Update memory usage metrics
     */
    _updateMemoryUsage() {
        this.metrics.memoryUsage = Array.from(this.sizes.values())
            .reduce((total, size) => total + size, 0);
    }
    
    /**
     * Update render time statistics
     */
    _updateRenderTimeStats(renderTime) {
        this.renderTimes.push(renderTime);
        
        // Keep only recent render times
        if (this.renderTimes.length > this.maxRenderTimeHistory) {
            this.renderTimes = this.renderTimes.slice(-this.maxRenderTimeHistory);
        }
        
        // Calculate average
        this.metrics.averageRenderTime = this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.clear();
        this.removeAllListeners();
    }
}

module.exports = { EquationCache };