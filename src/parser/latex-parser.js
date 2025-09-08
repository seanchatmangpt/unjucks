/**
 * LaTeX Parser - Core implementation for parsing LaTeX documents
 * 
 * Features:
 * - Tokenization of LaTeX commands, environments, and text
 * - AST generation with proper nesting
 * - Support for common LaTeX constructs
 * - Custom macro and command handling
 * - Error recovery and reporting
 */

class LaTeXToken {
  constructor(type, value, position = { line: 1, column: 1 }) {
    this.type = type;
    this.value = value;
    this.position = position;
  }
}

class LaTeXNode {
  constructor(type, value = null, children = [], attributes = {}) {
    this.type = type;
    this.value = value;
    this.children = children;
    this.attributes = attributes;
  }

  addChild(node) {
    this.children.push(node);
  }

  hasChildren() {
    return this.children.length > 0;
  }
}

class LaTeXTokenizer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  /**
   * Tokenize the entire input
   */
  tokenize() {
    while (this.position < this.input.length) {
      this.consumeNext();
    }
    return this.tokens;
  }

  /**
   * Get current position info
   */
  getCurrentPosition() {
    return { line: this.line, column: this.column };
  }

  /**
   * Peek at the next character without consuming it
   */
  peek(offset = 0) {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos] : null;
  }

  /**
   * Consume and return the next character
   */
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

  /**
   * Add a token to the tokens array
   */
  addToken(type, value) {
    this.tokens.push(new LaTeXToken(type, value, this.getCurrentPosition()));
  }

  /**
   * Consume the next token
   */
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

  /**
   * Consume whitespace
   */
  consumeWhitespace() {
    let whitespace = '';
    while (this.peek() && /\s/.test(this.peek())) {
      whitespace += this.consume();
    }
    
    // Only add significant whitespace tokens
    if (whitespace.includes('\n\n')) {
      this.addToken('PARAGRAPH_BREAK', whitespace);
    } else if (whitespace.includes('\n')) {
      this.addToken('LINE_BREAK', whitespace);
    } else {
      this.addToken('WHITESPACE', whitespace);
    }
  }

  /**
   * Consume a comment (% to end of line)
   */
  consumeComment() {
    let comment = '';
    this.consume(); // consume %
    
    while (this.peek() && this.peek() !== '\n') {
      comment += this.consume();
    }
    
    this.addToken('COMMENT', comment);
  }

  /**
   * Consume a LaTeX command
   */
  consumeCommand() {
    this.consume(); // consume \
    
    let command = '';
    const firstChar = this.peek();
    
    // Single character commands (like \\ or \{)
    if (!firstChar || !/[a-zA-Z]/.test(firstChar)) {
      if (firstChar) {
        command = this.consume();
      }
      this.addToken('COMMAND', command);
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

    this.addToken('COMMAND', command);
  }

  /**
   * Consume math delimiters
   */
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

  /**
   * Consume regular text
   */
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

class LaTeXParser {
  constructor(input, options = {}) {
    this.input = input;
    this.options = {
      customMacros: {},
      strictMode: false,
      ...options
    };
    this.tokenizer = new LaTeXTokenizer(input);
    this.tokens = [];
    this.position = 0;
    this.errors = [];
    this.macros = new Map(Object.entries(this.options.customMacros));
  }

  /**
   * Parse the input and return AST
   */
  parse() {
    try {
      this.tokens = this.tokenizer.tokenize();
      const ast = this.parseDocument();
      return {
        type: 'document',
        ast,
        errors: this.errors
      };
    } catch (error) {
      this.addError(`Fatal parsing error: ${error.message}`);
      return {
        type: 'document',
        ast: new LaTeXNode('error', error.message),
        errors: this.errors
      };
    }
  }

  /**
   * Get current token
   */
  currentToken() {
    return this.position < this.tokens.length ? this.tokens[this.position] : null;
  }

  /**
   * Peek at next token
   */
  peekToken(offset = 1) {
    const pos = this.position + offset;
    return pos < this.tokens.length ? this.tokens[pos] : null;
  }

  /**
   * Consume current token and advance
   */
  consumeToken() {
    return this.position < this.tokens.length ? this.tokens[this.position++] : null;
  }

  /**
   * Add parsing error
   */
  addError(message) {
    const token = this.currentToken();
    const position = token ? token.position : { line: 0, column: 0 };
    this.errors.push({
      message,
      position,
      token: token ? token.value : null
    });
  }

  /**
   * Parse the entire document
   */
  parseDocument() {
    const document = new LaTeXNode('document');
    
    while (this.currentToken()) {
      try {
        const node = this.parseNode();
        if (node) {
          document.addChild(node);
        }
      } catch (error) {
        this.addError(`Parse error: ${error.message}`);
        // Skip problematic token and continue
        this.consumeToken();
      }
    }
    
    return document;
  }

  /**
   * Parse a single node
   */
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

  /**
   * Parse a LaTeX command
   */
  parseCommand() {
    const commandToken = this.consumeToken();
    const commandName = commandToken.value;
    
    // Handle environment commands specially
    if (commandName === 'begin') {
      return this.parseEnvironment();
    }
    
    if (commandName === 'end') {
      // This should be handled by parseEnvironment
      this.addError(`Unexpected \\end command`);
      return new LaTeXNode('error', `Unexpected \\end`);
    }

    // Check if it's a custom macro
    if (this.macros.has(commandName)) {
      return this.parseCustomMacro(commandName);
    }

    // Parse regular command
    const command = new LaTeXNode('command', commandName);
    
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
    
    return command;
  }

  /**
   * Parse a LaTeX environment
   */
  parseEnvironment() {
    // Consume 'begin' command
    const envNameGroup = this.parseGroup();
    if (!envNameGroup || !envNameGroup.children.length) {
      this.addError('Missing environment name');
      return new LaTeXNode('error', 'Missing environment name');
    }
    
    const envName = this.extractTextFromNode(envNameGroup);
    const environment = new LaTeXNode('environment', envName);
    
    // Parse optional arguments after \begin{env}
    while (this.currentToken()?.type === 'LEFT_BRACKET') {
      const optArg = this.parseOptionalArgument();
      if (optArg) {
        environment.addChild(optArg);
      }
    }
    
    // Parse environment content until \end{env}
    while (this.currentToken()) {
      const token = this.currentToken();
      
      if (token.type === 'COMMAND' && token.value === 'end') {
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
      
      const node = this.parseNode();
      if (node) {
        environment.addChild(node);
      }
    }
    
    return environment;
  }

  /**
   * Parse a group {...}
   */
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

  /**
   * Parse optional argument [...]
   */
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

  /**
   * Parse math content
   */
  parseMath(type) {
    const startToken = this.consumeToken();
    const math = new LaTeXNode('math', null, [], { type });
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

  /**
   * Parse regular text
   */
  parseText() {
    const token = this.consumeToken();
    return new LaTeXNode('text', token.value);
  }

  /**
   * Parse custom macro
   */
  parseCustomMacro(macroName) {
    const macro = this.macros.get(macroName);
    const macroNode = new LaTeXNode('macro', macroName, [], { definition: macro });
    
    // Parse arguments based on macro definition
    // This is a simplified implementation
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

  /**
   * Extract text content from a node
   */
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
   * Add custom macro
   */
  addMacro(name, definition) {
    this.macros.set(name, definition);
  }

  /**
   * Get parsing statistics
   */
  getStats() {
    return {
      tokenCount: this.tokens.length,
      errorCount: this.errors.length,
      macroCount: this.macros.size
    };
  }
}

// Common LaTeX constructs helper
class LaTeXConstructs {
  static isBlockCommand(command) {
    return [
      'section', 'subsection', 'subsubsection',
      'chapter', 'part',
      'paragraph', 'subparagraph'
    ].includes(command);
  }

  static isListEnvironment(env) {
    return ['itemize', 'enumerate', 'description'].includes(env);
  }

  static isMathEnvironment(env) {
    return ['equation', 'align', 'gather', 'multline', 'split'].includes(env);
  }

  static isFloatEnvironment(env) {
    return ['figure', 'table'].includes(env);
  }
}

export {
  LaTeXParser,
  LaTeXTokenizer,
  LaTeXToken,
  LaTeXNode,
  LaTeXConstructs
};