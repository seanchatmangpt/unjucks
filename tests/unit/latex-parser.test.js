/**
 * Test suite for LaTeX Parser
 */

import { LaTeXParser, LaTeXTokenizer, LaTeXConstructs } from '../../src/parser/latex-parser.js';

describe('LaTeX Parser', () => {
  describe('LaTeXTokenizer', () => {
    test('should tokenize basic text', () => {
      const tokenizer = new LaTeXTokenizer('Hello World');
      const tokens = tokenizer.tokenize();
      
      expect(tokens).toHaveLength(3); // 'Hello', ' ', 'World'
      expect(tokens[0].type).toBe('TEXT');
      expect(tokens[0].value).toBe('Hello');
      expect(tokens[1].type).toBe('WHITESPACE');
      expect(tokens[2].type).toBe('TEXT');
      expect(tokens[2].value).toBe('World');
    });

    test('should tokenize LaTeX commands', () => {
      const tokenizer = new LaTeXTokenizer('\\section{Introduction}');
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0].type).toBe('COMMAND');
      expect(tokens[0].value).toBe('section');
      expect(tokens[1].type).toBe('LEFT_BRACE');
      expect(tokens[2].type).toBe('TEXT');
      expect(tokens[2].value).toBe('Introduction');
      expect(tokens[3].type).toBe('RIGHT_BRACE');
    });

    test('should tokenize starred commands', () => {
      const tokenizer = new LaTeXTokenizer('\\section*{Unnumbered}');
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0].type).toBe('COMMAND');
      expect(tokens[0].value).toBe('section*');
    });

    test('should tokenize single character commands', () => {
      const tokenizer = new LaTeXTokenizer('\\\\');
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0].type).toBe('COMMAND');
      expect(tokens[0].value).toBe('\\');
    });

    test('should tokenize math delimiters', () => {
      const tokenizer = new LaTeXTokenizer('$x^2$ and $$y = mx + b$$');
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0].type).toBe('INLINE_MATH_START');
      expect(tokens[4].type).toBe('INLINE_MATH_START'); // closing $
      expect(tokens[8].type).toBe('DISPLAY_MATH_START');
      expect(tokens[16].type).toBe('DISPLAY_MATH_START'); // closing $$
    });

    test('should tokenize comments', () => {
      const tokenizer = new LaTeXTokenizer('Text % this is a comment\nMore text');
      const tokens = tokenizer.tokenize();
      
      const commentToken = tokens.find(t => t.type === 'COMMENT');
      expect(commentToken).toBeDefined();
      expect(commentToken.value).toBe(' this is a comment');
    });

    test('should handle optional arguments', () => {
      const tokenizer = new LaTeXTokenizer('\\section[Short]{Long Title}');
      const tokens = tokenizer.tokenize();
      
      expect(tokens[1].type).toBe('LEFT_BRACKET');
      expect(tokens[2].type).toBe('TEXT');
      expect(tokens[2].value).toBe('Short');
      expect(tokens[3].type).toBe('RIGHT_BRACKET');
    });
  });

  describe('LaTeXParser', () => {
    test('should parse simple text', () => {
      const parser = new LaTeXParser('Hello World');
      const result = parser.parse();
      
      expect(result.ast.type).toBe('document');
      expect(result.ast.children).toHaveLength(3); // 'Hello', ' ', 'World'
      expect(result.ast.children[0].type).toBe('text');
      expect(result.ast.children[0].value).toBe('Hello');
    });

    test('should parse simple command with argument', () => {
      const parser = new LaTeXParser('\\textbf{bold text}');
      const result = parser.parse();
      
      expect(result.ast.children[0].type).toBe('command');
      expect(result.ast.children[0].value).toBe('textbf');
      expect(result.ast.children[0].children).toHaveLength(1);
      expect(result.ast.children[0].children[0].type).toBe('group');
    });

    test('should parse command with optional argument', () => {
      const parser = new LaTeXParser('\\section[Short]{Long Title}');
      const result = parser.parse();
      
      const command = result.ast.children[0];
      expect(command.type).toBe('command');
      expect(command.value).toBe('section');
      expect(command.children).toHaveLength(2); // optional arg + mandatory arg
      expect(command.children[0].type).toBe('optional_argument');
      expect(command.children[1].type).toBe('group');
    });

    test('should parse simple environment', () => {
      const parser = new LaTeXParser('\\begin{itemize}\\item First\\item Second\\end{itemize}');
      const result = parser.parse();
      
      const env = result.ast.children[0];
      expect(env.type).toBe('environment');
      expect(env.value).toBe('itemize');
      expect(env.children.length).toBeGreaterThan(0);
    });

    test('should parse nested environments', () => {
      const input = `
        \\begin{document}
          \\begin{itemize}
            \\item First item
          \\end{itemize}
        \\end{document}
      `;
      
      const parser = new LaTeXParser(input);
      const result = parser.parse();
      
      const docEnv = result.ast.children.find(child => 
        child.type === 'environment' && child.value === 'document'
      );
      
      expect(docEnv).toBeDefined();
      const itemizeEnv = docEnv.children.find(child => 
        child.type === 'environment' && child.value === 'itemize'
      );
      expect(itemizeEnv).toBeDefined();
    });

    test('should parse math environments', () => {
      const parser = new LaTeXParser('$x^2 + y^2 = z^2$');
      const result = parser.parse();
      
      const math = result.ast.children[0];
      expect(math.type).toBe('math');
      expect(math.attributes.type).toBe('inline');
    });

    test('should parse display math', () => {
      const parser = new LaTeXParser('$$\\int_{0}^{1} x^2 dx$$');
      const result = parser.parse();
      
      const math = result.ast.children[0];
      expect(math.type).toBe('math');
      expect(math.attributes.type).toBe('display');
    });

    test('should handle custom macros', () => {
      const parser = new LaTeXParser('\\mymacro{arg}', {
        customMacros: {
          mymacro: { argCount: 1, definition: 'custom macro' }
        }
      });
      
      const result = parser.parse();
      const macro = result.ast.children[0];
      
      expect(macro.type).toBe('macro');
      expect(macro.value).toBe('mymacro');
      expect(macro.children).toHaveLength(1);
    });

    test('should detect environment mismatches', () => {
      const parser = new LaTeXParser('\\begin{itemize}content\\end{enumerate}');
      const result = parser.parse();
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Environment mismatch');
    });

    test('should handle missing closing braces', () => {
      const parser = new LaTeXParser('\\textbf{unclosed');
      const result = parser.parse();
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Missing closing brace'))).toBe(true);
    });

    test('should parse comments correctly', () => {
      const parser = new LaTeXParser('Text % comment\nMore text');
      const result = parser.parse();
      
      const comment = result.ast.children.find(child => child.type === 'comment');
      expect(comment).toBeDefined();
      expect(comment.value).toBe(' comment');
    });

    test('should handle paragraph breaks', () => {
      const parser = new LaTeXParser('First paragraph.\n\nSecond paragraph.');
      const result = parser.parse();
      
      const paragraphBreak = result.ast.children.find(child => child.type === 'paragraph_break');
      expect(paragraphBreak).toBeDefined();
    });
  });

  describe('LaTeXConstructs', () => {
    test('should identify block commands', () => {
      expect(LaTeXConstructs.isBlockCommand('section')).toBe(true);
      expect(LaTeXConstructs.isBlockCommand('subsection')).toBe(true);
      expect(LaTeXConstructs.isBlockCommand('chapter')).toBe(true);
      expect(LaTeXConstructs.isBlockCommand('textbf')).toBe(false);
    });

    test('should identify list environments', () => {
      expect(LaTeXConstructs.isListEnvironment('itemize')).toBe(true);
      expect(LaTeXConstructs.isListEnvironment('enumerate')).toBe(true);
      expect(LaTeXConstructs.isListEnvironment('description')).toBe(true);
      expect(LaTeXConstructs.isListEnvironment('document')).toBe(false);
    });

    test('should identify math environments', () => {
      expect(LaTeXConstructs.isMathEnvironment('equation')).toBe(true);
      expect(LaTeXConstructs.isMathEnvironment('align')).toBe(true);
      expect(LaTeXConstructs.isMathEnvironment('itemize')).toBe(false);
    });

    test('should identify float environments', () => {
      expect(LaTeXConstructs.isFloatEnvironment('figure')).toBe(true);
      expect(LaTeXConstructs.isFloatEnvironment('table')).toBe(true);
      expect(LaTeXConstructs.isFloatEnvironment('equation')).toBe(false);
    });
  });

  describe('Parser Statistics and Error Handling', () => {
    test('should provide parsing statistics', () => {
      const parser = new LaTeXParser('\\section{Test} Some text');
      const result = parser.parse();
      const stats = parser.getStats();
      
      expect(stats.tokenCount).toBeGreaterThan(0);
      expect(stats.errorCount).toBe(result.errors.length);
      expect(stats.macroCount).toBe(0);
    });

    test('should handle malformed input gracefully', () => {
      const parser = new LaTeXParser('\\begin{document}\\section{Test');
      const result = parser.parse();
      
      // Should complete parsing despite errors
      expect(result.ast).toBeDefined();
      expect(result.ast.type).toBe('document');
    });

    test('should support adding macros dynamically', () => {
      const parser = new LaTeXParser('');
      parser.addMacro('newcommand', { argCount: 2, definition: 'define command' });
      
      const stats = parser.getStats();
      expect(stats.macroCount).toBe(1);
    });
  });

  describe('Complex LaTeX Documents', () => {
    test('should parse a complete document structure', () => {
      const input = `
        \\documentclass{article}
        \\usepackage{amsmath}
        
        \\begin{document}
        \\title{My Document}
        \\author{John Doe}
        \\maketitle
        
        \\section{Introduction}
        This is the introduction with some \\textbf{bold text}.
        
        \\subsection{Math Example}
        Here's an equation:
        \\begin{equation}
          E = mc^2
        \\end{equation}
        
        And some inline math: $x^2 + y^2 = r^2$.
        
        \\section{Lists}
        \\begin{itemize}
          \\item First item
          \\item Second item with \\emph{emphasis}
        \\end{itemize}
        
        \\end{document}
      `;
      
      const parser = new LaTeXParser(input);
      const result = parser.parse();
      
      expect(result.ast.type).toBe('document');
      expect(result.ast.children.length).toBeGreaterThan(10);
      
      // Find document environment
      const docEnv = result.ast.children.find(child => 
        child.type === 'environment' && child.value === 'document'
      );
      expect(docEnv).toBeDefined();
      
      // Find equation environment
      const eqEnv = findNodeRecursively(result.ast, 'environment', 'equation');
      expect(eqEnv).toBeDefined();
      
      // Find itemize environment
      const listEnv = findNodeRecursively(result.ast, 'environment', 'itemize');
      expect(listEnv).toBeDefined();
    });
  });
});

// Helper function to find nodes recursively
function findNodeRecursively(node, type, value = null) {
  if (node.type === type && (value === null || node.value === value)) {
    return node;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeRecursively(child, type, value);
      if (found) return found;
    }
  }
  
  return null;
}