/**
 * Advanced Equation Caching System
 * Provides intelligent caching with LRU eviction and performance metrics
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const { LRUCache } = require('../../kgen/cache/lru-cache.js');

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
        
        // Enhanced LRU cache storage
        this.cache = new LRUCache({
            maxSize: this.options.maxSize,
            ttl: this.options.ttl,
            enableStats: true,
            namespace: 'equation-cache'
        });
        
        // Additional equation-specific tracking
        this.renderTimes = [];
        this.maxRenderTimeHistory = 1000;
        
        // Additional metrics beyond LRU cache stats
        this.renderTimeStats = {
            averageRenderTime: 0,
            totalRenderTime: 0,
            renderCount: 0
        };
        
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
        const cacheKey = this._generateKey(key, latex, options);
        const entry = this.cache.get(cacheKey);
        
        if (entry) {
            this.emit('hit', { key: cacheKey, latex });
            return entry.html;
        } else {
            this.emit('miss', { key: cacheKey, latex });
            return null;
        }
    }
    
    /**
     * Store rendered equation in cache
     */
    set(key, html, latex = null, options = null, renderTime = 0) {
        const cacheKey = this._generateKey(key, latex, options);
        
        const entry = {
            html,
            latex,
            options,
            renderTime,
            size: this._calculateSize(html)
        };
        
        // Store in LRU cache
        this.cache.set(cacheKey, entry);
        
        // Update render time statistics
        this._updateRenderTimeStats(renderTime);
        
        this.emit('set', { key: cacheKey, latex, size: entry.size, renderTime });
    }
    
    /**
     * Check if key exists in cache
     */
    has(key, latex = null, options = null) {
        const cacheKey = this._generateKey(key, latex, options);
        return this.cache.has(cacheKey);
    }
    
    /**
     * Delete entry from cache
     */
    delete(key, latex = null, options = null) {
        const cacheKey = this._generateKey(key, latex, options);
        const existed = this.cache.delete(cacheKey);
        
        if (existed) {
            this.emit('delete', { key: cacheKey });
        }
        
        return existed;
    }
    
    /**
     * Clear all cached entries
     */
    clear() {
        const size = this.cache.size();
        this.cache.clear();
        this.renderTimes = [];
        this.renderTimeStats = {
            averageRenderTime: 0,
            totalRenderTime: 0,
            renderCount: 0
        };
        this.emit('clear', { entriesCleared: size });
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const lruStats = this.cache.getStats();
        
        return {
            ...lruStats,
            renderStats: this.renderTimeStats,
            memoryUsageMB: (lruStats.memoryUsage / (1024 * 1024)).toFixed(2),
            averageEntrySize: lruStats.size > 0 
                ? Math.round(lruStats.memoryUsage / lruStats.size)
                : 0
        };
    }
    
    /**
     * Get recent render performance data
     */
    getRenderPerformance() {
        return {
            averageRenderTime: this.renderTimeStats.averageRenderTime,
            totalRenderTime: this.renderTimeStats.totalRenderTime,
            renderCount: this.renderTimeStats.renderCount,
            recentRenderTimes: this.renderTimes.slice(-10) // Last 10 renders
        };
    }
    
    /**
     * Preload equations for better performance
     */
    async preload(equations, renderer) {
        const results = [];
        
        for (const equation of equations) {
            try {
                const startTime = this.getDeterministicTimestamp();
                const html = await renderer._renderSingle(equation.latex, equation.options || {});
                const renderTime = this.getDeterministicTimestamp() - startTime;
                
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
            timestamp: this.getDeterministicTimestamp(),
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
     * Update render time statistics
     */
    _updateRenderTimeStats(renderTime) {
        this.renderTimes.push(renderTime);
        
        // Keep only recent render times
        if (this.renderTimes.length > this.maxRenderTimeHistory) {
            this.renderTimes = this.renderTimes.slice(-this.maxRenderTimeHistory);
        }
        
        // Update cumulative stats
        this.renderTimeStats.renderCount++;
        this.renderTimeStats.totalRenderTime += renderTime;
        this.renderTimeStats.averageRenderTime = 
            this.renderTimeStats.totalRenderTime / this.renderTimeStats.renderCount;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.cache.destroy();
        this.renderTimes = [];
        this.removeAllListeners();
    }
}

module.exports = { EquationCache };