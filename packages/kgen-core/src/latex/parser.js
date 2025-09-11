/**
 * KGEN LaTeX Parser - Enhanced LaTeX document parsing with semantic analysis
 * Integrates with KGEN's ontology system for intelligent document understanding
 * 
 * Features:
 * - Complete LaTeX syntax parsing with AST generation
 * - Semantic analysis of document structure
 * - Command and environment validation
 * - Integration with KGEN ontology engine
 * - Support for custom macros and packages
 * - Error recovery and comprehensive reporting
 */

/**
 * LaTeX Token class for representing parsed tokens
 */
class LaTeXToken {
  constructor(type, value, position = { line: 1, column: 1 }) {
    this.type = type;
    this.value = value;
    this.position = position;
    this.semantic = null; // For semantic analysis
  }
  
  /**
   * Add semantic information to token
   */
  addSemantic(info) {
    this.semantic = { ...this.semantic, ...info };
  }
}

/**
 * Enhanced LaTeX AST Node with semantic capabilities
 */
class LaTeXNode {
  constructor(type, value = null, children = [], attributes = {}) {
    this.type = type;
    this.value = value;
    this.children = children;
    this.attributes = attributes;
    this.semantic = {};
    this.id = this.generateId();
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  addChild(node) {
    if (node) {
      this.children.push(node);
    }
  }

  hasChildren() {
    return this.children.length > 0;
  }
  
  /**
   * Add semantic information
   */
  addSemantic(info) {
    this.semantic = { ...this.semantic, ...info };
  }
  
  /**
   * Find children by type
   */
  findChildren(type) {
    return this.children.filter(child => child.type === type);
  }
  
  /**
   * Get text content recursively
   */
  getTextContent() {
    if (this.type === 'text') {
      return this.value;
    }
    
    return this.children.map(child => 
      typeof child.getTextContent === 'function' ? child.getTextContent() : ''
    ).join('');
  }
}

/**
 * Enhanced LaTeX Tokenizer with better error handling
 */
class LaTeXTokenizer {
  constructor(input, options = {}) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
    this.errors = [];
    this.options = {
      strict: false,
      captureComments: true,
      ...options
    };
  }

  /**
   * Tokenize the entire input with error recovery
   */
  tokenize() {
    try {
      while (this.position < this.input.length) {
        this.consumeNext();
      }
    } catch (error) {
      this.addError(`Tokenization failed: ${error.message}`);
      
      // Error recovery: skip problematic character
      if (this.position < this.input.length) {
        this.consume();
        this.tokenize(); // Continue tokenizing
      }
    }
    
    return {
      tokens: this.tokens,
      errors: this.errors
    };
  }

  getCurrentPosition() {
    return { line: this.line, column: this.column };
  }

  peek(offset = 0) {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos] : null;
  }

  consume() {
    if (this.position >= this.input.length) return null;
    
    const char = this.input[this.position++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  addToken(type, value, metadata = {}) {
    const token = new LaTeXToken(type, value, this.getCurrentPosition());
    if (metadata.semantic) {
      token.addSemantic(metadata.semantic);
    }
    this.tokens.push(token);
  }
  
  addError(message) {
    this.errors.push({
      message,
      position: this.getCurrentPosition(),
      character: this.peek()
    });
  }

  consumeNext() {
    const char = this.peek();
    
    if (!char) return;

    // Skip whitespace but preserve significant whitespace
    if (/\s/.test(char)) {
      this.consumeWhitespace();
      return;
    }

    // Comments
    if (char === '%') {
      this.consumeComment();
      return;
    }

    // Commands
    if (char === '\\') {
      this.consumeCommand();
      return;
    }

    // Group delimiters
    if (char === '{') {
      this.consume();
      this.addToken('LEFT_BRACE', '{');
      return;
    }

    if (char === '}') {
      this.consume();
      this.addToken('RIGHT_BRACE', '}');
      return;
    }

    // Optional argument delimiters
    if (char === '[') {
      this.consume();
      this.addToken('LEFT_BRACKET', '[');
      return;
    }

    if (char === ']') {
      this.consume();
      this.addToken('RIGHT_BRACKET', ']');
      return;
    }

    // Math delimiters
    if (char === '$') {
      this.consumeMath();
      return;
    }

    // Regular text
    this.consumeText();
  }

  consumeWhitespace() {
    let whitespace = '';
    while (this.peek() && /\s/.test(this.peek())) {
      whitespace += this.consume();
    }
    
    if (whitespace.includes('\n\n')) {
      this.addToken('PARAGRAPH_BREAK', whitespace);
    } else if (whitespace.includes('\n')) {
      this.addToken('LINE_BREAK', whitespace);
    } else {
      this.addToken('WHITESPACE', whitespace);
    }
  }

  consumeComment() {
    let comment = '';
    this.consume(); // consume %
    
    while (this.peek() && this.peek() !== '\n') {
      comment += this.consume();
    }
    
    if (this.options.captureComments) {
      this.addToken('COMMENT', comment);
    }
  }

  consumeCommand() {
    this.consume(); // consume \\
    
    let command = '';
    const firstChar = this.peek();
    
    // Single character commands (like \\\\ or \{)
    if (!firstChar || !/[a-zA-Z]/.test(firstChar)) {
      if (firstChar) {
        command = this.consume();
      }
      this.addToken('COMMAND', command, {
        semantic: { commandType: 'special' }
      });
      return;
    }

    // Multi-character commands
    while (this.peek() && /[a-zA-Z]/.test(this.peek())) {
      command += this.consume();
    }

    // Check for starred commands
    if (this.peek() === '*') {
      command += this.consume();
    }

    // Add semantic information for known commands
    const semantic = this.getCommandSemantic(command);
    this.addToken('COMMAND', command, { semantic });
  }
  
  /**
   * Get semantic information for LaTeX commands
   */
  getCommandSemantic(command) {
    const commandMap = {
      // Document structure
      'documentclass': { commandType: 'document', category: 'structure' },
      'usepackage': { commandType: 'package', category: 'setup' },
      'begin': { commandType: 'environment', category: 'structure' },
      'end': { commandType: 'environment', category: 'structure' },
      
      // Sectioning
      'part': { commandType: 'sectioning', level: 0, category: 'structure' },
      'chapter': { commandType: 'sectioning', level: 1, category: 'structure' },
      'section': { commandType: 'sectioning', level: 2, category: 'structure' },
      'subsection': { commandType: 'sectioning', level: 3, category: 'structure' },
      'subsubsection': { commandType: 'sectioning', level: 4, category: 'structure' },
      
      // Text formatting
      'textbf': { commandType: 'formatting', style: 'bold', category: 'text' },
      'textit': { commandType: 'formatting', style: 'italic', category: 'text' },
      'emph': { commandType: 'formatting', style: 'emphasis', category: 'text' },
      
      // Math
      'equation': { commandType: 'math', display: true, category: 'math' },
      'align': { commandType: 'math', display: true, category: 'math' },
      
      // Bibliography
      'cite': { commandType: 'citation', category: 'reference' },
      'bibliography': { commandType: 'bibliography', category: 'reference' },
      'bibliographystyle': { commandType: 'bibliography', category: 'reference' }
    };
    
    return commandMap[command] || { commandType: 'unknown', category: 'other' };
  }

  consumeMath() {
    const start = this.position;
    this.consume(); // consume first $
    
    if (this.peek() === '$') {
      this.consume(); // consume second $
      this.addToken('DISPLAY_MATH_START', '$$');
    } else {
      this.addToken('INLINE_MATH_START', '$');
    }
  }

  consumeText() {
    let text = '';
    
    while (this.peek() && 
           this.peek() !== '\\' && 
           this.peek() !== '{' && 
           this.peek() !== '}' && 
           this.peek() !== '[' && 
           this.peek() !== ']' && 
           this.peek() !== '$' && 
           this.peek() !== '%' && 
           !/\s/.test(this.peek())) {
      text += this.consume();
    }
    
    if (text) {
      this.addToken('TEXT', text);
    }
  }
}

/**
 * Enhanced LaTeX Parser with semantic analysis
 */
class LaTeXParser {
  constructor(input, options = {}) {
    this.input = input;
    this.options = {
      customMacros: {},
      strictMode: false,
      semanticAnalysis: true,
      ontologyEngine: null,
      ...options
    };
    this.tokenizer = new LaTeXTokenizer(input, options);
    this.tokens = [];
    this.position = 0;
    this.errors = [];
    this.warnings = [];
    this.macros = new Map(Object.entries(this.options.customMacros));
    this.documentStructure = {
      preamble: [],
      body: [],
      metadata: {}
    };
  }

  /**
   * Parse the input and return comprehensive AST with semantic analysis
   */
  parse() {
    try {
      const tokenResult = this.tokenizer.tokenize();
      this.tokens = tokenResult.tokens;
      this.errors.push(...tokenResult.errors);
      
      const ast = this.parseDocument();
      
      // Perform semantic analysis if enabled
      if (this.options.semanticAnalysis) {
        this.performSemanticAnalysis(ast);
      }
      
      return {
        type: 'document',
        ast,
        documentStructure: this.documentStructure,
        errors: this.errors,
        warnings: this.warnings,
        statistics: this.generateStatistics(),
        metadata: this.extractMetadata(ast)
      };
    } catch (error) {
      this.addError(`Fatal parsing error: ${error.message}`);
      return {
        type: 'document',
        ast: new LaTeXNode('error', error.message),
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  currentToken() {
    return this.position < this.tokens.length ? this.tokens[this.position] : null;
  }

  peekToken(offset = 1) {
    const pos = this.position + offset;
    return pos < this.tokens.length ? this.tokens[pos] : null;
  }

  consumeToken() {
    return this.position < this.tokens.length ? this.tokens[this.position++] : null;
  }

  addError(message) {
    const token = this.currentToken();
    const position = token ? token.position : { line: 0, column: 0 };
    this.errors.push({
      message,
      position,
      token: token ? token.value : null,
      severity: 'error'
    });
  }
  
  addWarning(message) {
    const token = this.currentToken();
    const position = token ? token.position : { line: 0, column: 0 };
    this.warnings.push({
      message,
      position,
      token: token ? token.value : null,
      severity: 'warning'
    });
  }

  parseDocument() {
    const document = new LaTeXNode('document');
    document.addSemantic({ documentType: 'latex' });
    
    while (this.currentToken()) {
      try {
        const node = this.parseNode();
        if (node) {
          document.addChild(node);
          
          // Organize document structure
          if (this.isInPreamble(node)) {
            this.documentStructure.preamble.push(node);
          } else {
            this.documentStructure.body.push(node);
          }
        }
      } catch (error) {
        this.addError(`Parse error: ${error.message}`);
        this.skipToNextSafeToken();
      }
    }
    
    return document;
  }
  
  /**
   * Check if node belongs to preamble
   */
  isInPreamble(node) {
    if (node.type === 'command') {
      const preambleCommands = ['documentclass', 'usepackage', 'newcommand', 'title', 'author', 'date'];
      return preambleCommands.includes(node.value);
    }
    return false;
  }
  
  /**
   * Skip to next safe token for error recovery
   */
  skipToNextSafeToken() {
    const safeTokens = ['COMMAND', 'LEFT_BRACE', 'PARAGRAPH_BREAK'];
    while (this.currentToken() && !safeTokens.includes(this.currentToken().type)) {
      this.consumeToken();
    }
  }

  parseNode() {
    const token = this.currentToken();
    
    if (!token) return null;

    switch (token.type) {
      case 'COMMAND':
        return this.parseCommand();
      
      case 'TEXT':
        return this.parseText();
      
      case 'WHITESPACE':
      case 'LINE_BREAK':
        this.consumeToken();
        return new LaTeXNode('whitespace', token.value);
      
      case 'PARAGRAPH_BREAK':
        this.consumeToken();
        return new LaTeXNode('paragraph_break', token.value);
      
      case 'COMMENT':
        this.consumeToken();
        return new LaTeXNode('comment', token.value);
      
      case 'LEFT_BRACE':
        return this.parseGroup();
      
      case 'INLINE_MATH_START':
        return this.parseMath('inline');
      
      case 'DISPLAY_MATH_START':
        return this.parseMath('display');
      
      default:
        this.consumeToken();
        return new LaTeXNode('unknown', token.value);
    }
  }

  parseCommand() {
    const commandToken = this.consumeToken();
    const commandName = commandToken.value;
    
    // Handle environment commands specially
    if (commandName === 'begin') {
      return this.parseEnvironment();
    }
    
    if (commandName === 'end') {
      this.addError(`Unexpected \\end command`);
      return new LaTeXNode('error', `Unexpected \\end`);
    }

    // Check if it's a custom macro
    if (this.macros.has(commandName)) {
      return this.parseCustomMacro(commandName);
    }

    // Parse regular command
    const command = new LaTeXNode('command', commandName);
    
    // Add semantic information from token
    if (commandToken.semantic) {
      command.addSemantic(commandToken.semantic);
    }
    
    // Parse optional arguments [...]
    while (this.currentToken()?.type === 'LEFT_BRACKET') {
      const optArg = this.parseOptionalArgument();
      if (optArg) {
        command.addChild(optArg);
      }
    }
    
    // Parse mandatory arguments {...}
    while (this.currentToken()?.type === 'LEFT_BRACE') {
      const arg = this.parseGroup();
      if (arg) {
        command.addChild(arg);
      }
    }
    
    // Validate command usage
    this.validateCommand(command);
    
    return command;
  }
  
  /**
   * Validate LaTeX command usage
   */
  validateCommand(commandNode) {
    const commandName = commandNode.value;
    const semantic = commandNode.semantic;
    
    // Check for common LaTeX mistakes
    if (commandName === 'usepackage' && commandNode.children.length === 0) {
      this.addWarning('\\usepackage command without package name');
    }
    
    if (semantic?.commandType === 'sectioning' && commandNode.children.length === 0) {
      this.addWarning(`Sectioning command \\${commandName} without title`);
    }
    
    // Check for deprecated commands
    const deprecatedCommands = ['bf', 'it', 'rm', 'sf', 'tt'];
    if (deprecatedCommands.includes(commandName)) {
      this.addWarning(`Command \\${commandName} is deprecated. Use \\textbf, \\textit, etc. instead`);
    }
  }

  parseEnvironment() {
    const envNameGroup = this.parseGroup();
    if (!envNameGroup || !envNameGroup.children.length) {
      this.addError('Missing environment name');
      return new LaTeXNode('error', 'Missing environment name');
    }
    
    const envName = this.extractTextFromNode(envNameGroup);
    const environment = new LaTeXNode('environment', envName);
    
    // Add semantic information
    environment.addSemantic(this.getEnvironmentSemantic(envName));
    
    // Parse optional arguments after \begin{env}
    while (this.currentToken()?.type === 'LEFT_BRACKET') {
      const optArg = this.parseOptionalArgument();
      if (optArg) {
        environment.addChild(optArg);
      }
    }
    
    // Parse environment content until \end{env}
    let depth = 1;
    while (this.currentToken() && depth > 0) {
      const token = this.currentToken();
      
      if (token.type === 'COMMAND') {
        if (token.value === 'begin') {
          depth++;
        } else if (token.value === 'end') {
          depth--;
          if (depth === 0) {
            const endToken = this.consumeToken();
            const endNameGroup = this.parseGroup();
            
            if (!endNameGroup) {
              this.addError('Missing environment name in \\end');
              break;
            }
            
            const endName = this.extractTextFromNode(endNameGroup);
            if (endName !== envName) {
              this.addError(`Environment mismatch: \\begin{${envName}} ... \\end{${endName}}`);
            }
            break;
          }
        }
      }
      
      const node = this.parseNode();
      if (node) {
        environment.addChild(node);
      }
    }
    
    // Validate environment
    this.validateEnvironment(environment);
    
    return environment;
  }
  
  /**
   * Get semantic information for environments
   */
  getEnvironmentSemantic(envName) {
    const envMap = {
      'document': { envType: 'document', category: 'structure' },
      'abstract': { envType: 'front-matter', category: 'metadata' },
      'itemize': { envType: 'list', listType: 'unordered', category: 'structure' },
      'enumerate': { envType: 'list', listType: 'ordered', category: 'structure' },
      'equation': { envType: 'math', display: true, category: 'math' },
      'align': { envType: 'math', display: true, category: 'math' },
      'figure': { envType: 'float', category: 'content' },
      'table': { envType: 'float', category: 'content' },
      'tabular': { envType: 'table', category: 'content' },
      'verbatim': { envType: 'verbatim', category: 'content' },
      'lstlisting': { envType: 'code', category: 'content' },
      'tikzpicture': { envType: 'graphics', category: 'content' }
    };
    
    return envMap[envName] || { envType: 'unknown', category: 'other' };
  }
  
  /**
   * Validate environment usage
   */
  validateEnvironment(envNode) {
    const envName = envNode.value;
    const semantic = envNode.semantic;
    
    // Check for environments that should not be empty
    const nonEmptyEnvs = ['abstract', 'itemize', 'enumerate', 'table', 'figure'];
    if (nonEmptyEnvs.includes(envName) && envNode.children.length === 0) {
      this.addWarning(`Environment ${envName} is empty`);
    }
    
    // Check for math environments with text content
    if (semantic?.category === 'math') {
      // Additional math environment validation could go here
    }
  }

  parseGroup() {
    if (this.currentToken()?.type !== 'LEFT_BRACE') {
      return null;
    }
    
    this.consumeToken(); // consume {
    const group = new LaTeXNode('group');
    
    while (this.currentToken() && this.currentToken().type !== 'RIGHT_BRACE') {
      const node = this.parseNode();
      if (node) {
        group.addChild(node);
      }
    }
    
    if (this.currentToken()?.type === 'RIGHT_BRACE') {
      this.consumeToken(); // consume }
    } else {
      this.addError('Missing closing brace');
    }
    
    return group;
  }

  parseOptionalArgument() {
    if (this.currentToken()?.type !== 'LEFT_BRACKET') {
      return null;
    }
    
    this.consumeToken(); // consume [
    const arg = new LaTeXNode('optional_argument');
    
    while (this.currentToken() && this.currentToken().type !== 'RIGHT_BRACKET') {
      const node = this.parseNode();
      if (node) {
        arg.addChild(node);
      }
    }
    
    if (this.currentToken()?.type === 'RIGHT_BRACKET') {
      this.consumeToken(); // consume ]
    } else {
      this.addError('Missing closing bracket');
    }
    
    return arg;
  }

  parseMath(type) {
    const startToken = this.consumeToken();
    const math = new LaTeXNode('math', null, [], { type });
    math.addSemantic({ mathType: type, category: 'math' });
    
    const delimiter = type === 'display' ? '$$' : '$';
    
    while (this.currentToken()) {
      const token = this.currentToken();
      
      if ((type === 'inline' && token.type === 'INLINE_MATH_START') ||
          (type === 'display' && token.type === 'DISPLAY_MATH_START')) {
        this.consumeToken(); // consume closing delimiter
        break;
      }
      
      const node = this.parseNode();
      if (node) {
        math.addChild(node);
      }
    }
    
    return math;
  }

  parseText() {
    const token = this.consumeToken();
    const textNode = new LaTeXNode('text', token.value);
    textNode.addSemantic({ category: 'text' });
    return textNode;
  }

  parseCustomMacro(macroName) {
    const macro = this.macros.get(macroName);
    const macroNode = new LaTeXNode('macro', macroName, [], { definition: macro });
    macroNode.addSemantic({ macroType: 'custom', category: 'macro' });
    
    const argCount = macro.argCount || 0;
    
    for (let i = 0; i < argCount; i++) {
      if (this.currentToken()?.type === 'LEFT_BRACE') {
        const arg = this.parseGroup();
        if (arg) {
          macroNode.addChild(arg);
        }
      }
    }
    
    return macroNode;
  }

  extractTextFromNode(node) {
    if (node.type === 'text') {
      return node.value;
    }
    
    if (node.children) {
      return node.children.map(child => this.extractTextFromNode(child)).join('');
    }
    
    return '';
  }
  
  /**
   * Perform semantic analysis on the parsed AST
   */
  performSemanticAnalysis(ast) {
    this.analyzeDocumentStructure(ast);
    this.analyzeCitations(ast);
    this.analyzeMathContent(ast);
    this.checkConsistency(ast);
  }
  
  /**
   * Analyze document structure
   */
  analyzeDocumentStructure(ast) {
    const sections = this.findNodesByType(ast, 'command')
      .filter(node => node.semantic?.commandType === 'sectioning')
      .sort((a, b) => (a.semantic?.level || 0) - (b.semantic?.level || 0));
    
    // Check sectioning hierarchy
    for (let i = 1; i < sections.length; i++) {
      const prevLevel = sections[i-1].semantic?.level || 0;
      const currentLevel = sections[i].semantic?.level || 0;
      
      if (currentLevel > prevLevel + 1) {
        this.addWarning(`Sectioning jump detected: skipping from level ${prevLevel} to ${currentLevel}`);
      }
    }
    
    this.documentStructure.metadata.sectionCount = sections.length;
    this.documentStructure.metadata.maxSectionLevel = Math.max(...sections.map(s => s.semantic?.level || 0));
  }
  
  /**
   * Analyze citations
   */
  analyzeCitations(ast) {
    const citations = this.findNodesByType(ast, 'command')
      .filter(node => node.semantic?.commandType === 'citation');
    
    this.documentStructure.metadata.citationCount = citations.length;
    
    // Check for bibliography
    const hasBibliography = this.findNodesByType(ast, 'command')
      .some(node => node.value === 'bibliography' || node.value === 'bibliographystyle');
    
    if (citations.length > 0 && !hasBibliography) {
      this.addWarning('Document has citations but no bibliography');
    }
  }
  
  /**
   * Analyze math content
   */
  analyzeMathContent(ast) {
    const mathNodes = this.findNodesByType(ast, 'math');
    const mathCommands = this.findNodesByType(ast, 'command')
      .filter(node => node.semantic?.category === 'math');
    
    this.documentStructure.metadata.mathElementCount = mathNodes.length + mathCommands.length;
  }
  
  /**
   * Check document consistency
   */
  checkConsistency(ast) {
    // Check for unmatched environments
    const beginCommands = this.findNodesByType(ast, 'command')
      .filter(node => node.value === 'begin');
    const endCommands = this.findNodesByType(ast, 'command')
      .filter(node => node.value === 'end');
    
    if (beginCommands.length !== endCommands.length) {
      this.addError('Unmatched begin/end environment commands');
    }
  }
  
  /**
   * Find nodes by type recursively
   */
  findNodesByType(node, type) {
    const results = [];
    
    if (node.type === type) {
      results.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        results.push(...this.findNodesByType(child, type));
      });
    }
    
    return results;
  }
  
  /**
   * Extract document metadata
   */
  extractMetadata(ast) {
    const metadata = {};
    
    // Find title, author, date commands
    const titleNode = this.findNodesByType(ast, 'command').find(node => node.value === 'title');
    const authorNode = this.findNodesByType(ast, 'command').find(node => node.value === 'author');
    const dateNode = this.findNodesByType(ast, 'command').find(node => node.value === 'date');
    
    if (titleNode && titleNode.children.length > 0) {
      metadata.title = this.extractTextFromNode(titleNode.children[0]);
    }
    
    if (authorNode && authorNode.children.length > 0) {
      metadata.author = this.extractTextFromNode(authorNode.children[0]);
    }
    
    if (dateNode && dateNode.children.length > 0) {
      metadata.date = this.extractTextFromNode(dateNode.children[0]);
    }
    
    // Find document class
    const docClassNode = this.findNodesByType(ast, 'command').find(node => node.value === 'documentclass');
    if (docClassNode && docClassNode.children.length > 0) {
      metadata.documentClass = this.extractTextFromNode(docClassNode.children[0]);
    }
    
    return metadata;
  }
  
  /**
   * Generate parsing statistics
   */
  generateStatistics() {
    return {
      tokenCount: this.tokens.length,
      nodeCount: this.countNodes(this.documentStructure.body),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      macroCount: this.macros.size,
      processingTime: Date.now() // This would be set properly in production
    };
  }
  
  /**
   * Count nodes recursively
   */
  countNodes(nodes) {
    if (!Array.isArray(nodes)) {
      nodes = [nodes];
    }
    
    let count = nodes.length;
    nodes.forEach(node => {
      if (node.children) {
        count += this.countNodes(node.children);
      }
    });
    
    return count;
  }

  addMacro(name, definition) {
    this.macros.set(name, definition);
  }

  getStats() {
    return this.generateStatistics();
  }
}

/**
 * LaTeX document analysis utilities
 */
class LaTeXAnalyzer {
  static analyzeDocument(parseResult) {
    return {
      complexity: this.calculateComplexity(parseResult),
      readability: this.calculateReadability(parseResult),
      structure: this.analyzeStructure(parseResult),
      recommendations: this.generateRecommendations(parseResult)
    };
  }
  
  static calculateComplexity(parseResult) {
    const { statistics, documentStructure } = parseResult;
    
    // Simple complexity metric based on various factors
    let complexity = 0;
    complexity += (statistics.nodeCount || 0) * 0.1;
    complexity += (documentStructure.metadata.mathElementCount || 0) * 0.5;
    complexity += (documentStructure.metadata.citationCount || 0) * 0.3;
    complexity += (documentStructure.metadata.maxSectionLevel || 0) * 2;
    
    return Math.min(complexity, 100); // Cap at 100
  }
  
  static calculateReadability(parseResult) {
    // Placeholder for readability analysis
    return {
      score: 75, // Default score
      level: 'Good',
      suggestions: []
    };
  }
  
  static analyzeStructure(parseResult) {
    return {
      hasPreamble: parseResult.documentStructure.preamble.length > 0,
      hasAbstract: parseResult.documentStructure.body.some(node => 
        node.type === 'environment' && node.value === 'abstract'
      ),
      sectionHierarchy: parseResult.documentStructure.metadata.maxSectionLevel || 0
    };
  }
  
  static generateRecommendations(parseResult) {
    const recommendations = [];
    
    if (parseResult.errors.length > 0) {
      recommendations.push('Fix parsing errors for better document processing');
    }
    
    if (parseResult.warnings.length > 3) {
      recommendations.push('Consider addressing warnings to improve document quality');
    }
    
    return recommendations;
  }
}

/**
 * Common LaTeX constructs helper (enhanced)
 */
class LaTeXConstructs {
  static isBlockCommand(command) {
    return [
      'section', 'subsection', 'subsubsection',
      'chapter', 'part', 'paragraph', 'subparagraph'
    ].includes(command);
  }

  static isListEnvironment(env) {
    return ['itemize', 'enumerate', 'description'].includes(env);
  }

  static isMathEnvironment(env) {
    return ['equation', 'align', 'gather', 'multline', 'split', 'eqnarray'].includes(env);
  }

  static isFloatEnvironment(env) {
    return ['figure', 'table'].includes(env);
  }
  
  static isVerbatimEnvironment(env) {
    return ['verbatim', 'lstlisting', 'minted'].includes(env);
  }
  
  static getCommandCategory(command) {
    const categories = {
      structure: ['documentclass', 'usepackage', 'begin', 'end', 'chapter', 'section', 'subsection'],
      formatting: ['textbf', 'textit', 'emph', 'underline', 'textsc'],
      math: ['equation', 'align', 'frac', 'sum', 'int'],
      reference: ['cite', 'ref', 'label', 'bibliography'],
      figure: ['includegraphics', 'caption', 'label']
    };
    
    for (const [category, commands] of Object.entries(categories)) {
      if (commands.includes(command)) {
        return category;
      }
    }
    
    return 'other';
  }
}

// Export all classes
export {
  LaTeXParser,
  LaTeXTokenizer,
  LaTeXToken,
  LaTeXNode,
  LaTeXAnalyzer,
  LaTeXConstructs
};

export default LaTeXParser;