/**
 * Advanced Math Equation Rendering System
 * Integrates KaTeX with fallback handling, caching, and performance optimizations
 */

const katex = require('katex');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class MathRenderer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // KaTeX options
            displayMode: false,
            throwOnError: false,
            errorColor: '#cc0000',
            macros: {},
            trust: false,
            strict: 'warn',
            output: 'html',
            fleqn: false,
            leqno: false,
            
            // Custom options
            enableCaching: true,
            cacheMaxSize: 1000,
            enableFallback: true,
            enableNumbering: true,
            mathEnvironments: ['equation', 'align', 'matrix', 'cases', 'split'],
            
            // Performance options
            lazyLoading: true,
            batchRendering: true,
            maxConcurrent: 10,
            
            ...options
        };
        
        this.cache = new Map();
        this.equationCounter = 0;
        this.equations = new Map(); // For numbered equations
        this.references = new Map(); // For equation references
        this.renderQueue = [];
        this.isProcessing = false;
        
        // Initialize fallback symbols
        this.fallbackSymbols = this._initializeFallbackSymbols();
        
        // Initialize math environments
        this.environments = this._initializeMathEnvironments();
    }
    
    /**
     * Main rendering method - handles both inline and display math
     */
    async render(input, options = {}) {
        try {
            const renderOptions = { ...this.options, ...options };
            
            if (typeof input !== 'string') {
                throw new Error('Input must be a string');
            }
            
            // Parse and identify math expressions
            const mathExpressions = this._parseMathExpressions(input);
            
            if (mathExpressions.length === 0) {
                return input; // No math found
            }
            
            // Process expressions
            const results = await this._processExpressions(mathExpressions, renderOptions);
            
            // Replace in original text
            return this._replaceMathInText(input, results);
            
        } catch (error) {
            this.emit('error', error);
            return this._handleRenderError(input, error);
        }
    }
    
    /**
     * Render inline math
     */
    async renderInline(latex, options = {}) {
        const renderOptions = { 
            ...this.options, 
            ...options, 
            displayMode: false 
        };
        
        return this._renderSingle(latex, renderOptions);
    }
    
    /**
     * Render display math
     */
    async renderDisplay(latex, options = {}) {
        const renderOptions = { 
            ...this.options, 
            ...options, 
            displayMode: true 
        };
        
        return this._renderSingle(latex, renderOptions);
    }
    
    /**
     * Render math environments (equation, align, matrix, etc.)
     */
    async renderEnvironment(environment, content, options = {}) {
        try {
            const handler = this.environments[environment];
            if (!handler) {
                throw new Error(`Unsupported math environment: ${environment}`);
            }
            
            return await handler.call(this, content, options);
            
        } catch (error) {
            this.emit('error', error);
            return this._createErrorElement(error.message);
        }
    }
    
    /**
     * Batch rendering for performance
     */
    async renderBatch(expressions, options = {}) {
        if (!Array.isArray(expressions)) {
            throw new Error('Expressions must be an array');
        }
        
        const results = [];
        const chunks = this._chunkArray(expressions, this.options.maxConcurrent);
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(expr => this._renderSingle(expr.latex, {
                ...this.options,
                ...options,
                ...expr.options
            }));
            
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }
        
        return results;
    }
    
    /**
     * Parse math expressions from text
     */
    _parseMathExpressions(text) {
        const expressions = [];
        
        // Patterns for different math modes
        const patterns = {
            // Display math: $$...$$
            displayBlock: /\$\$([\s\S]*?)\$\$/g,
            // Inline math: $...$
            inline: /\$([^$\n]*?)\$/g,
            // LaTeX environments: \begin{env}...\end{env}
            environment: /\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g,
            // Numbered equations: \begin{equation}...\end{equation}
            numberedEquation: /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g
        };
        
        // Parse display math blocks
        let match;
        while ((match = patterns.displayBlock.exec(text)) !== null) {
            expressions.push({
                type: 'display',
                latex: match[1].trim(),
                original: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        // Parse inline math
        patterns.inline.lastIndex = 0;
        while ((match = patterns.inline.exec(text)) !== null) {
            // Skip if inside display math
            const inDisplayMath = expressions.some(expr => 
                match.index >= expr.start && match.index < expr.end
            );
            
            if (!inDisplayMath) {
                expressions.push({
                    type: 'inline',
                    latex: match[1].trim(),
                    original: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        }
        
        // Parse environments
        patterns.environment.lastIndex = 0;
        while ((match = patterns.environment.exec(text)) !== null) {
            const environment = match[1];
            const content = match[2].trim();
            
            expressions.push({
                type: 'environment',
                environment,
                latex: content,
                original: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        // Sort by position (start index)
        return expressions.sort((a, b) => a.start - b.start);
    }
    
    /**
     * Process all math expressions
     */
    async _processExpressions(expressions, options) {
        const results = [];
        
        for (const expr of expressions) {
            try {
                let rendered;
                
                if (expr.type === 'environment') {
                    rendered = await this.renderEnvironment(expr.environment, expr.latex, options);
                } else {
                    const renderOptions = {
                        ...options,
                        displayMode: expr.type === 'display'
                    };
                    rendered = await this._renderSingle(expr.latex, renderOptions);
                }
                
                results.push({
                    ...expr,
                    rendered
                });
                
            } catch (error) {
                this.emit('error', error);
                results.push({
                    ...expr,
                    rendered: this._createErrorElement(error.message),
                    error
                });
            }
        }
        
        return results;
    }
    
    /**
     * Core rendering function with caching and fallback
     */
    async _renderSingle(latex, options = {}) {
        if (!latex || typeof latex !== 'string') {
            return '';
        }
        
        // Generate cache key
        const cacheKey = this._generateCacheKey(latex, options);
        
        // Check cache first
        if (this.options.enableCaching && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            // Preprocess LaTeX for fallback symbols
            const processedLatex = this.options.enableFallback 
                ? this._applyFallbacks(latex)
                : latex;
            
            // Render with KaTeX
            const html = katex.renderToString(processedLatex, options);
            
            // Cache result
            if (this.options.enableCaching) {
                this._addToCache(cacheKey, html);
            }
            
            this.emit('rendered', { latex, html, cached: false });
            return html;
            
        } catch (error) {
            // Try fallback rendering
            if (this.options.enableFallback) {
                return this._renderWithFallback(latex, options, error);
            }
            
            throw error;
        }
    }
    
    /**
     * Fallback rendering for unsupported symbols/commands
     */
    _renderWithFallback(latex, options, originalError) {
        try {
            // Apply more aggressive fallbacks
            const fallbackLatex = this._applyAggressiveFallbacks(latex);
            
            if (fallbackLatex !== latex) {
                const html = katex.renderToString(fallbackLatex, options);
                
                this.emit('fallback', { 
                    original: latex, 
                    fallback: fallbackLatex, 
                    error: originalError 
                });
                
                return html;
            }
            
            // Ultimate fallback - return formatted text
            return this._createFallbackElement(latex, originalError);
            
        } catch (fallbackError) {
            this.emit('fallbackFailed', { 
                latex, 
                originalError, 
                fallbackError 
            });
            
            return this._createErrorElement(originalError.message);
        }
    }
    
    /**
     * Initialize fallback symbol mappings
     */
    _initializeFallbackSymbols() {
        return {
            // Common symbols that might not be supported
            '\\varnothing': '\\emptyset',
            '\\mathbbm': '\\mathbb',
            '\\mathscr': '\\mathcal',
            '\\mathfrak': '\\mathcal',
            
            // Custom commands to standard equivalents
            '\\RR': '\\mathbb{R}',
            '\\CC': '\\mathbb{C}',
            '\\ZZ': '\\mathbb{Z}',
            '\\QQ': '\\mathbb{Q}',
            '\\NN': '\\mathbb{N}',
            
            // Physics symbols
            '\\hbar': '\\hslash',
            '\\degree': '^\\circ',
            
            // Additional fallbacks can be added here
        };
    }
    
    /**
     * Apply fallback symbol replacements
     */
    _applyFallbacks(latex) {
        let result = latex;
        
        for (const [original, replacement] of Object.entries(this.fallbackSymbols)) {
            result = result.replace(new RegExp(original.replace(/\\/g, '\\\\'), 'g'), replacement);
        }
        
        return result;
    }
    
    /**
     * Apply more aggressive fallbacks for problematic expressions
     */
    _applyAggressiveFallbacks(latex) {
        let result = latex;
        
        // Remove unsupported packages/commands
        result = result.replace(/\\usepackage\{[^}]*\}/g, '');
        result = result.replace(/\\newcommand\{[^}]*\}\{[^}]*\}/g, '');
        
        // Replace complex constructs with simpler ones
        result = result.replace(/\\substack\{([^}]*)\}/g, '\\begin{smallmatrix}$1\\end{smallmatrix}');
        
        // Handle custom environments
        result = result.replace(/\\begin\{([^}]*)\}/g, (match, env) => {
            const standardEnv = this._mapToStandardEnvironment(env);
            return standardEnv ? `\\begin{${standardEnv}}` : match;
        });
        
        result = result.replace(/\\end\{([^}]*)\}/g, (match, env) => {
            const standardEnv = this._mapToStandardEnvironment(env);
            return standardEnv ? `\\end{${standardEnv}}` : match;
        });
        
        return result;
    }
    
    /**
     * Map custom environments to standard ones
     */
    _mapToStandardEnvironment(env) {
        const mapping = {
            'gather': 'align',
            'multline': 'align',
            'flalign': 'align',
            'alignat': 'align',
            'eqnarray': 'align'
        };
        
        return mapping[env] || null;
    }
    
    /**
     * Initialize math environment handlers
     */
    _initializeMathEnvironments() {
        return {
            equation: this._renderEquationEnvironment.bind(this),
            align: this._renderAlignEnvironment.bind(this),
            matrix: this._renderMatrixEnvironment.bind(this),
            cases: this._renderCasesEnvironment.bind(this),
            split: this._renderSplitEnvironment.bind(this)
        };
    }
    
    /**
     * Render equation environment with numbering
     */
    async _renderEquationEnvironment(content, options = {}) {
        const numbered = !content.includes('*') && this.options.enableNumbering;
        
        let equationNumber = '';
        let equationId = '';
        
        if (numbered) {
            this.equationCounter++;
            equationNumber = this.equationCounter.toString();
            equationId = `eq:${equationNumber}`;
            
            // Store equation reference
            this.equations.set(equationId, {
                number: equationNumber,
                latex: content
            });
        }
        
        const html = await this._renderSingle(content, {
            ...options,
            displayMode: true
        });
        
        if (numbered) {
            return this._wrapWithEquationNumber(html, equationNumber, equationId);
        }
        
        return `<div class="math-display">${html}</div>`;
    }
    
    /**
     * Render align environment
     */
    async _renderAlignEnvironment(content, options = {}) {
        // Split align content by \\
        const lines = content.split('\\\\').map(line => line.trim()).filter(line => line);
        
        const renderedLines = [];
        for (const line of lines) {
            // Handle alignment points (&)
            const parts = line.split('&');
            const alignedLine = parts.join('\\quad');
            
            const html = await this._renderSingle(alignedLine, {
                ...options,
                displayMode: true
            });
            
            renderedLines.push(html);
        }
        
        return `<div class="math-align">${renderedLines.join('<br>')}</div>`;
    }
    
    /**
     * Render matrix environment
     */
    async _renderMatrixEnvironment(content, options = {}) {
        const matrixTypes = {
            'matrix': '',
            'pmatrix': '()',
            'bmatrix': '[]',
            'Bmatrix': '{}',
            'vmatrix': '||',
            'Vmatrix': '||||'
        };
        
        const matrixLatex = `\\begin{${options.matrixType || 'matrix'}}${content}\\end{${options.matrixType || 'matrix'}}`;
        
        return await this._renderSingle(matrixLatex, {
            ...options,
            displayMode: true
        });
    }
    
    /**
     * Render cases environment
     */
    async _renderCasesEnvironment(content, options = {}) {
        const casesLatex = `\\begin{cases}${content}\\end{cases}`;
        
        return await this._renderSingle(casesLatex, {
            ...options,
            displayMode: true
        });
    }
    
    /**
     * Render split environment
     */
    async _renderSplitEnvironment(content, options = {}) {
        const splitLatex = `\\begin{split}${content}\\end{split}`;
        
        return await this._renderSingle(splitLatex, {
            ...options,
            displayMode: true
        });
    }
    
    /**
     * Wrap equation with number
     */
    _wrapWithEquationNumber(html, number, id) {
        return `
            <div class="math-equation" id="${id}">
                <div class="math-content">${html}</div>
                <div class="math-number">(${number})</div>
            </div>
        `;
    }
    
    /**
     * Replace math expressions in original text
     */
    _replaceMathInText(text, results) {
        // Sort results by start position in reverse order
        const sortedResults = results.sort((a, b) => b.start - a.start);
        
        let result = text;
        for (const expr of sortedResults) {
            result = result.substring(0, expr.start) + 
                    expr.rendered + 
                    result.substring(expr.end);
        }
        
        return result;
    }
    
    /**
     * Generate cache key
     */
    _generateCacheKey(latex, options) {
        const key = JSON.stringify({ latex, options });
        return crypto.createHash('md5').update(key).digest('hex');
    }
    
    /**
     * Add to cache with size management
     */
    _addToCache(key, value) {
        if (this.cache.size >= this.options.cacheMaxSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }
    
    /**
     * Create error element
     */
    _createErrorElement(message) {
        return `<span class="math-error" style="color: ${this.options.errorColor};" title="${message}">Math Error</span>`;
    }
    
    /**
     * Create fallback element
     */
    _createFallbackElement(latex, error) {
        return `<code class="math-fallback" title="Fallback rendering - ${error.message}">${latex}</code>`;
    }
    
    /**
     * Handle render error
     */
    _handleRenderError(input, error) {
        if (this.options.throwOnError) {
            throw error;
        }
        
        return this._createErrorElement(error.message);
    }
    
    /**
     * Chunk array for batch processing
     */
    _chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    /**
     * Get equation by reference
     */
    getEquation(id) {
        return this.equations.get(id);
    }
    
    /**
     * Get all equations
     */
    getAllEquations() {
        return Array.from(this.equations.entries()).map(([id, eq]) => ({ id, ...eq }));
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.emit('cacheCleared');
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.options.cacheMaxSize,
            hitRate: this._calculateCacheHitRate()
        };
    }
    
    /**
     * Calculate cache hit rate
     */
    _calculateCacheHitRate() {
        // This would need to be tracked during rendering
        // For now, return a placeholder
        return 0;
    }
    
    /**
     * Reset equation counter and references
     */
    resetEquations() {
        this.equationCounter = 0;
        this.equations.clear();
        this.references.clear();
    }
}

module.exports = { MathRenderer };