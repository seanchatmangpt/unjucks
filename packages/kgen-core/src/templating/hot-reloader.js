/**
 * KGEN Hot Template Reloader
 * 
 * Provides hot reloading capabilities for templates with live updates,
 * change detection, and seamless development experience.
 * 
 * @author KGEN Advanced Enhancement Swarm - Agent #7
 * @version 2.0.0
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, relative, dirname } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Hot reload modes
 */
export const ReloadMode = {
  FULL: 'full',         // Full page/template reload
  PARTIAL: 'partial',   // Partial template updates
  INCREMENTAL: 'incremental', // Incremental changes only
  SMART: 'smart'        // Smart reloading based on change analysis
};

/**
 * File change types
 */
export const FileChangeType = {
  ADDED: 'added',
  MODIFIED: 'modified',
  DELETED: 'deleted',
  RENAMED: 'renamed'
};

/**
 * Hot reload strategies
 */
export const ReloadStrategy = {
  IMMEDIATE: 'immediate', // Reload immediately on change
  DEBOUNCED: 'debounced', // Debounce changes
  BATCH: 'batch',         // Batch multiple changes
  SMART_DEBOUNCE: 'smart_debounce' // Smart debouncing based on change type
};

/**
 * Hot Template Reloader
 */
export class HotTemplateReloader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      templatesDir: options.templatesDir || '_templates',
      watchPatterns: options.watchPatterns || ['**/*.njk', '**/*.j2', '**/*.html'],
      ignorePatterns: options.ignorePatterns || ['**/node_modules/**', '**/.git/**'],
      reloadMode: options.reloadMode || ReloadMode.SMART,
      strategy: options.strategy || ReloadStrategy.SMART_DEBOUNCE,
      debounceTime: options.debounceTime || 300,
      batchTime: options.batchTime || 1000,
      maxRetries: options.maxRetries || 3,
      enableSourceMaps: options.enableSourceMaps !== false,
      enableLiveEdit: options.enableLiveEdit !== false,
      preserveState: options.preserveState !== false,
      ...options
    };

    // File watching
    this.watcher = null;
    this.watchedFiles = new Map();
    this.fileHashes = new Map();
    
    // Change management
    this.pendingChanges = new Map();
    this.changeQueue = [];
    this.debounceTimers = new Map();
    this.batchTimer = null;
    
    // Dependencies
    this.dependencyGraph = options.dependencyGraph;
    this.compiler = options.compiler;
    this.incrementalProcessor = options.incrementalProcessor;
    
    // Live edit state
    this.liveEditSessions = new Map();
    this.sourceMapCache = new Map();
    
    // Statistics
    this.stats = {
      reloads: 0,
      partialReloads: 0,
      fullReloads: 0,
      errors: 0,
      averageReloadTime: 0,
      totalReloadTime: 0,
      filesWatched: 0,
      changesProcessed: 0
    };

    // Server connection (for websocket communication)
    this.server = null;
    this.clients = new Set();
    
    this.isActive = false;
  }

  /**
   * Start hot reloading
   */
  async start() {
    if (this.isActive) {
      return;
    }

    try {
      // Initialize file watching
      await this.initializeWatcher();
      
      // Start WebSocket server if needed
      if (this.options.enableWebSocket) {
        await this.startWebSocketServer();
      }
      
      // Initialize file hashes
      await this.buildInitialHashes();
      
      this.isActive = true;
      this.emit('started', { watchedFiles: this.watchedFiles.size });
      
      console.log(`🔥 Hot reloader started - watching ${this.watchedFiles.size} files`);

    } catch (error) {
      this.emit('error', { phase: 'startup', error });
      throw new Error(`Hot reloader startup failed: ${error.message}`);
    }
  }

  /**
   * Stop hot reloading
   */
  async stop() {
    if (!this.isActive) {
      return;
    }

    try {
      // Stop file watcher
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      // Clear timers
      this.clearAllTimers();

      // Close WebSocket server
      if (this.server) {
        await new Promise(resolve => this.server.close(resolve));
        this.server = null;
      }

      // Clear state
      this.watchedFiles.clear();
      this.fileHashes.clear();
      this.pendingChanges.clear();
      this.liveEditSessions.clear();
      this.clients.clear();

      this.isActive = false;
      this.emit('stopped');
      
      console.log('🔥 Hot reloader stopped');

    } catch (error) {
      this.emit('error', { phase: 'shutdown', error });
      throw new Error(`Hot reloader shutdown failed: ${error.message}`);
    }
  }

  /**
   * Initialize file watcher
   */
  async initializeWatcher() {
    const chokidar = await import('chokidar');
    
    const watchPaths = this.options.watchPatterns.map(pattern => 
      join(this.options.templatesDir, pattern)
    );

    this.watcher = chokidar.watch(watchPaths, {
      ignored: this.options.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      usePolling: this.options.usePolling || false,
      interval: this.options.pollInterval || 1000,
      binaryInterval: this.options.binaryPollInterval || 300
    });

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, FileChangeType.ADDED))
      .on('change', (filePath) => this.handleFileChange(filePath, FileChangeType.MODIFIED))
      .on('unlink', (filePath) => this.handleFileChange(filePath, FileChangeType.DELETED))
      .on('error', (error) => this.emit('watcherError', { error }));

    // Wait for initial scan
    await new Promise(resolve => {
      this.watcher.on('ready', () => {
        this.stats.filesWatched = Object.keys(this.watcher.getWatched()).length;
        resolve();
      });
    });
  }

  /**
   * Build initial file hashes
   */
  async buildInitialHashes() {
    const watched = this.watcher.getWatched();
    
    for (const [dir, files] of Object.entries(watched)) {
      for (const file of files) {
        const filePath = join(dir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const hash = this.createHash(content);
          const relativePath = relative(this.options.templatesDir, filePath);
          
          this.fileHashes.set(relativePath, hash);
          this.watchedFiles.set(relativePath, {
            fullPath: filePath,
            lastModified: this.getDeterministicTimestamp(),
            hash,
            dependencies: []
          });
        } catch (error) {
          // Skip files we can't read
          console.warn(`Could not read ${filePath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Handle file change
   */
  async handleFileChange(filePath, changeType) {
    const relativePath = relative(this.options.templatesDir, filePath);
    const startTime = performance.now();
    
    this.stats.changesProcessed++;

    try {
      // Create change object
      const change = {
        filePath: relativePath,
        fullPath: filePath,
        changeType,
        timestamp: this.getDeterministicTimestamp(),
        hash: null
      };

      // Calculate new hash for modified files
      if (changeType === FileChangeType.MODIFIED || changeType === FileChangeType.ADDED) {
        if (existsSync(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          change.hash = this.createHash(content);
          change.content = content;

          // Check if content actually changed
          const oldHash = this.fileHashes.get(relativePath);
          if (oldHash === change.hash) {
            return; // No actual change
          }
        }
      }

      // Update tracking
      this.updateFileTracking(change);

      // Process change based on strategy
      await this.processChange(change);

      const processingTime = performance.now() - startTime;
      this.updateStats(processingTime);

      this.emit('fileChanged', { change, processingTime });

    } catch (error) {
      this.stats.errors++;
      this.emit('error', { 
        phase: 'fileChange', 
        filePath: relativePath, 
        changeType, 
        error 
      });
    }
  }

  /**
   * Process file change based on strategy
   */
  async processChange(change) {
    switch (this.options.strategy) {
      case ReloadStrategy.IMMEDIATE:
        await this.processImmediate(change);
        break;
        
      case ReloadStrategy.DEBOUNCED:
        this.processDebounced(change);
        break;
        
      case ReloadStrategy.BATCH:
        this.processBatch(change);
        break;
        
      case ReloadStrategy.SMART_DEBOUNCE:
        this.processSmartDebounce(change);
        break;
    }
  }

  /**
   * Process change immediately
   */
  async processImmediate(change) {
    await this.executeReload([change]);
  }

  /**
   * Process change with debouncing
   */
  processDebounced(change) {
    const { filePath } = change;
    
    // Clear existing timer for this file
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath));
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      await this.executeReload([change]);
    }, this.options.debounceTime);

    this.debounceTimers.set(filePath, timer);
    this.pendingChanges.set(filePath, change);
  }

  /**
   * Process change in batch
   */
  processBatch(change) {
    this.changeQueue.push(change);
    this.pendingChanges.set(change.filePath, change);

    // Set batch timer if not already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(async () => {
        const changes = [...this.changeQueue];
        this.changeQueue = [];
        this.batchTimer = null;
        
        await this.executeReload(changes);
      }, this.options.batchTime);
    }
  }

  /**
   * Process change with smart debouncing
   */
  processSmartDebounce(change) {
    // Determine debounce time based on change type
    let debounceTime = this.options.debounceTime;
    
    switch (change.changeType) {
      case FileChangeType.ADDED:
      case FileChangeType.DELETED:
        debounceTime = this.options.debounceTime * 0.5; // Faster for structural changes
        break;
      case FileChangeType.MODIFIED:
        debounceTime = this.options.debounceTime; // Normal for modifications
        break;
    }

    // Check if file has dependencies - slower debounce for files with many dependents
    if (this.dependencyGraph) {
      const dependents = this.dependencyGraph.getDependents(change.filePath);
      if (dependents.length > 10) {
        debounceTime *= 1.5;
      }
    }

    // Use debounced processing with calculated time
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(change.filePath);
      await this.executeReload([change]);
    }, debounceTime);

    // Clear existing timer
    if (this.debounceTimers.has(change.filePath)) {
      clearTimeout(this.debounceTimers.get(change.filePath));
    }

    this.debounceTimers.set(change.filePath, timer);
    this.pendingChanges.set(change.filePath, change);
  }

  /**
   * Execute reload for changes
   */
  async executeReload(changes) {
    const startTime = performance.now();

    try {
      // Analyze changes to determine reload strategy
      const reloadStrategy = await this.analyzeReloadStrategy(changes);
      
      // Execute appropriate reload
      switch (reloadStrategy.mode) {
        case ReloadMode.FULL:
          await this.executeFullReload(changes, reloadStrategy);
          break;
          
        case ReloadMode.PARTIAL:
          await this.executePartialReload(changes, reloadStrategy);
          break;
          
        case ReloadMode.INCREMENTAL:
          await this.executeIncrementalReload(changes, reloadStrategy);
          break;
          
        case ReloadMode.SMART:
          await this.executeSmartReload(changes, reloadStrategy);
          break;
      }

      const reloadTime = performance.now() - startTime;
      this.updateReloadStats(reloadStrategy.mode, reloadTime);

      // Clean up pending changes
      for (const change of changes) {
        this.pendingChanges.delete(change.filePath);
      }

      this.emit('reloadCompleted', { 
        changes, 
        strategy: reloadStrategy, 
        reloadTime 
      });

    } catch (error) {
      this.stats.errors++;
      this.emit('reloadError', { changes, error });
      throw error;
    }
  }

  /**
   * Analyze changes to determine optimal reload strategy
   */
  async analyzeReloadStrategy(changes) {
    const analysis = {
      mode: ReloadMode.INCREMENTAL,
      affectedTemplates: new Set(),
      requiresFullRebuild: false,
      priority: 'normal'
    };

    for (const change of changes) {
      // Add changed template
      analysis.affectedTemplates.add(change.filePath);

      // Check if change requires full rebuild
      if (change.changeType === FileChangeType.ADDED || 
          change.changeType === FileChangeType.DELETED) {
        analysis.requiresFullRebuild = true;
        analysis.mode = ReloadMode.FULL;
      }

      // Get dependent templates
      if (this.dependencyGraph) {
        const dependents = this.dependencyGraph.getDependents(change.filePath);
        for (const dependent of dependents) {
          analysis.affectedTemplates.add(dependent);
        }

        // Many dependents = full reload
        if (dependents.length > 20) {
          analysis.mode = ReloadMode.FULL;
        } else if (dependents.length > 5) {
          analysis.mode = ReloadMode.PARTIAL;
        }
      }

      // Check for structural changes
      if (change.content && this.hasStructuralChanges(change.content)) {
        analysis.requiresFullRebuild = true;
        analysis.mode = ReloadMode.FULL;
      }
    }

    return analysis;
  }

  /**
   * Check if content has structural changes
   */
  hasStructuralChanges(content) {
    const structuralPatterns = [
      /\{\%\s*extends\s+/,
      /\{\%\s*include\s+/,
      /\{\%\s*import\s+/,
      /\{\%\s*block\s+/,
      /\{\%\s*macro\s+/
    ];

    return structuralPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Execute full reload
   */
  async executeFullReload(changes, strategy) {
    this.stats.fullReloads++;

    // Process all affected templates
    if (this.incrementalProcessor) {
      await this.incrementalProcessor.processChanges(changes.map(change => ({
        templatePath: change.filePath,
        changeType: change.changeType,
        currentHash: change.hash
      })));
    }

    // Notify all clients
    this.broadcastToClients({
      type: 'fullReload',
      changes: changes.map(c => ({
        path: c.filePath,
        type: c.changeType
      })),
      timestamp: this.getDeterministicTimestamp()
    });
  }

  /**
   * Execute partial reload
   */
  async executePartialReload(changes, strategy) {
    this.stats.partialReloads++;

    const updates = [];

    for (const change of changes) {
      if (change.changeType === FileChangeType.MODIFIED && change.content) {
        // Generate source map if enabled
        let sourceMap = null;
        if (this.options.enableSourceMaps) {
          sourceMap = await this.generateSourceMap(change);
        }

        updates.push({
          path: change.filePath,
          content: change.content,
          sourceMap,
          hash: change.hash
        });
      }
    }

    // Notify clients about partial updates
    this.broadcastToClients({
      type: 'partialReload',
      updates,
      timestamp: this.getDeterministicTimestamp()
    });
  }

  /**
   * Execute incremental reload
   */
  async executeIncrementalReload(changes, strategy) {
    // Process only changed parts
    const patches = [];

    for (const change of changes) {
      if (change.changeType === FileChangeType.MODIFIED) {
        const patch = await this.generateIncrementalPatch(change);
        if (patch) {
          patches.push(patch);
        }
      }
    }

    // Apply patches
    if (patches.length > 0) {
      this.broadcastToClients({
        type: 'incrementalReload',
        patches,
        timestamp: this.getDeterministicTimestamp()
      });
    }
  }

  /**
   * Execute smart reload
   */
  async executeSmartReload(changes, strategy) {
    // Combine multiple strategies based on analysis
    const criticalChanges = changes.filter(c => 
      c.changeType !== FileChangeType.MODIFIED
    );
    
    const modificationChanges = changes.filter(c => 
      c.changeType === FileChangeType.MODIFIED
    );

    // Handle critical changes with full reload
    if (criticalChanges.length > 0) {
      await this.executeFullReload(criticalChanges, strategy);
    }

    // Handle modifications with partial reload
    if (modificationChanges.length > 0) {
      await this.executePartialReload(modificationChanges, strategy);
    }
  }

  /**
   * Generate source map for debugging
   */
  async generateSourceMap(change) {
    // Generate source map for template debugging
    // This is a simplified implementation
    return {
      version: 3,
      file: change.filePath,
      sources: [change.filePath],
      names: [],
      mappings: '', // Would contain actual mapping data
      sourcesContent: [change.content]
    };
  }

  /**
   * Generate incremental patch
   */
  async generateIncrementalPatch(change) {
    const oldContent = this.watchedFiles.get(change.filePath)?.content || '';
    const newContent = change.content || '';

    // Simple diff - in production, use a proper diff library
    if (oldContent === newContent) {
      return null;
    }

    return {
      path: change.filePath,
      type: 'replace',
      content: newContent,
      hash: change.hash
    };
  }

  /**
   * Start WebSocket server for live updates
   */
  async startWebSocketServer() {
    const WebSocket = await import('ws');
    const { WebSocketServer } = WebSocket.default || WebSocket;

    this.server = new WebSocketServer({ 
      port: this.options.websocketPort || 0,
      host: this.options.websocketHost || 'localhost'
    });

    this.server.on('connection', (ws) => {
      this.clients.add(ws);
      
      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.warn('Invalid WebSocket message:', error.message);
        }
      });

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: this.getDeterministicTimestamp(),
        stats: this.getStats()
      }));
    });

    const address = this.server.address();
    console.log(`🌐 Hot reload WebSocket server listening on ws://${address.address}:${address.port}`);
  }

  /**
   * Handle client message
   */
  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: this.getDeterministicTimestamp() }));
        break;
        
      case 'getStats':
        ws.send(JSON.stringify({ 
          type: 'stats', 
          stats: this.getStats(),
          timestamp: this.getDeterministicTimestamp()
        }));
        break;
        
      case 'requestReload':
        // Manual reload request
        this.emit('manualReload', data);
        break;
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(messageStr);
        } catch (error) {
          // Remove failed client
          this.clients.delete(client);
        }
      }
    }
  }

  /**
   * Update file tracking
   */
  updateFileTracking(change) {
    const { filePath, changeType, hash, content } = change;

    switch (changeType) {
      case FileChangeType.ADDED:
      case FileChangeType.MODIFIED:
        this.fileHashes.set(filePath, hash);
        this.watchedFiles.set(filePath, {
          fullPath: change.fullPath,
          lastModified: this.getDeterministicTimestamp(),
          hash,
          content,
          dependencies: []
        });
        break;
        
      case FileChangeType.DELETED:
        this.fileHashes.delete(filePath);
        this.watchedFiles.delete(filePath);
        break;
    }
  }

  /**
   * Clear all timers
   */
  clearAllTimers() {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Create content hash
   */
  createHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Update statistics
   */
  updateStats(processingTime) {
    // Update general stats in the base class if needed
  }

  /**
   * Update reload statistics
   */
  updateReloadStats(mode, reloadTime) {
    this.stats.reloads++;
    this.stats.totalReloadTime += reloadTime;
    this.stats.averageReloadTime = this.stats.totalReloadTime / this.stats.reloads;

    switch (mode) {
      case ReloadMode.PARTIAL:
        this.stats.partialReloads++;
        break;
      case ReloadMode.FULL:
        this.stats.fullReloads++;
        break;
    }
  }

  /**
   * Get hot reloader statistics
   */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      watchedFiles: this.watchedFiles.size,
      connectedClients: this.clients.size,
      pendingChanges: this.pendingChanges.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Get client injection script
   */
  getClientScript() {
    const { websocketPort, websocketHost } = this.options;
    const port = websocketPort || (this.server && this.server.address().port) || 0;
    const host = websocketHost || 'localhost';

    return `
      (function() {
        const ws = new WebSocket('ws://${host}:${port}');
        
        ws.onopen = () => {
          console.log('🔥 Hot reload connected');
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'fullReload':
              location.reload();
              break;
              
            case 'partialReload':
              // Handle partial updates
              for (const update of data.updates) {
                updateTemplate(update);
              }
              break;
              
            case 'incrementalReload':
              // Handle incremental patches
              for (const patch of data.patches) {
                applyPatch(patch);
              }
              break;
          }
        };
        
        ws.onclose = () => {
          console.log('🔥 Hot reload disconnected');
          // Attempt to reconnect after a delay
          setTimeout(() => location.reload(), 1000);
        };
        
        function updateTemplate(update) {
          // Implementation depends on your frontend framework
          console.log('Template updated:', update.path);
        }
        
        function applyPatch(patch) {
          // Implementation depends on your frontend framework  
          console.log('Patch applied:', patch.path);
        }
      })();
    `;
  }
}

/**
 * Factory function to create hot reloader
 */
export function createHotReloader(options = {}) {
  return new HotTemplateReloader(options);
}

export default HotTemplateReloader;