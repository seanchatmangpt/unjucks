/**
 * Test Document Generation for Export Quality Validation
 * Creates comprehensive test documents with various content types for validating export quality
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test Document Builder - Creates various types of test content
 */
export class TestDocumentBuilder {
  constructor() {
    this.testData = {
      // Basic text elements
      texts: {
        simple: 'This is a simple paragraph with plain text.',
        withSpecialChars: 'This text contains special characters: áéíóú, çñü, ñ, ß, œ, €, £, ¥, ©, ®, ™',
        withEmoji: 'This text contains emoji: 🚀 🎉 ✅ ❌ 📊 💡 🔥 ⭐ 🌟 💯',
        longText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
      },
      
      // Code samples
      code: {
        javascript: `function testFunction(param) {
  // This is a comment
  const result = param * 2;
  return result;
}

const arrow = (x) => x + 1;
console.log('Hello, World!');`,
        
        python: `def test_function(param):
    """This is a docstring"""
    result = param * 2
    return result

# This is a comment
lambda_func = lambda x: x + 1
print("Hello, World!")`,
        
        html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Test Document</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>This is a test.</p>
</body>
</html>`,
        
        css: `.test-class {
  color: #333;
  font-size: 16px;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
}

#test-id:hover {
  transform: scale(1.1);
  transition: all 0.3s ease;
}`,
        
        sql: `SELECT u.name, u.email, p.title
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE u.active = true
  AND p.published_at > '2024-01-01'
ORDER BY p.created_at DESC
LIMIT 10;`
      },
      
      // Mathematical content
      math: {
        inline: '$E = mc^2$',
        block: '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$',
        complex: '$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$'
      },
      
      // Table data
      tables: {
        simple: {
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['John Doe', '30', 'New York'],
            ['Jane Smith', '25', 'Los Angeles'],
            ['Bob Johnson', '35', 'Chicago']
          ]
        },
        
        complex: {
          headers: ['Product', 'Price ($)', 'Quantity', 'Total ($)', 'Status'],
          rows: [
            ['Laptop', '999.99', '5', '4,999.95', '✅ Available'],
            ['Mouse', '29.99', '20', '599.80', '⚠️ Low Stock'],
            ['Keyboard', '79.99', '0', '0.00', '❌ Out of Stock'],
            ['Monitor', '299.99', '8', '2,399.92', '✅ Available'],
            ['Webcam', '149.99', '3', '449.97', '⚠️ Low Stock']
          ]
        },
        
        withSpecialContent: {
          headers: ['HTML', 'Markdown', 'Unicode', 'Numbers'],
          rows: [
            ['<b>Bold</b>', '**Bold**', '🔥 Fire', '1,234.56'],
            ['<i>Italic</i>', '*Italic*', '⭐ Star', '€123.45'],
            ['<code>Code</code>', '`Code`', '♠ Spade', '¥9,876'],
            ['<a>Link</a>', '[Link](url)', '∑ Sigma', '√144 = 12']
          ]
        }
      },
      
      // List data
      lists: {
        unordered: [
          'First item',
          'Second item with **bold** text',
          'Third item with `code`',
          'Fourth item with special chars: áéíóú'
        ],
        
        ordered: [
          'Step one: Initialize the system',
          'Step two: Process the data',
          'Step three: Generate output',
          'Step four: Validate results'
        ],
        
        nested: [
          'Parent item 1',
          ['Child 1.1', 'Child 1.2 with *emphasis*'],
          'Parent item 2',
          ['Child 2.1', ['Grandchild 2.1.1', 'Grandchild 2.1.2'], 'Child 2.2']
        ]
      },
      
      // Image references (for testing image handling)
      images: [
        { src: 'test-chart.png', alt: 'Test Chart', caption: 'Figure 1: Sample chart showing data trends' },
        { src: 'test-diagram.svg', alt: 'Test Diagram', caption: 'Figure 2: System architecture diagram' },
        { src: 'test-photo.jpg', alt: 'Test Photo', caption: 'Figure 3: Sample photograph' }
      ],
      
      // Document metadata
      metadata: {
        title: 'Export Quality Validation Test Document',
        author: 'Export Quality Validator',
        subject: 'Comprehensive test of export functionality',
        keywords: ['export', 'quality', 'test', 'validation'],
        created: this.getDeterministicDate().toISOString(),
        modified: this.getDeterministicDate().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Generate a comprehensive test document structure
   */
  generateTestDocument() {
    return {
      metadata: this.testData.metadata,
      sections: [
        {
          type: 'title',
          content: this.testData.metadata.title,
          level: 0
        },
        
        // Table of Contents placeholder
        {
          type: 'section',
          content: 'Table of Contents',
          level: 1
        },
        
        // Text formatting tests
        {
          type: 'section',
          content: 'Text Formatting Tests',
          level: 1
        },
        {
          type: 'subsection',
          content: 'Basic Text Elements',
          level: 2
        },
        {
          type: 'paragraph',
          content: this.testData.texts.simple
        },
        {
          type: 'paragraph',
          content: `**Bold text**, *italic text*, \`inline code\`, and regular text mixed together.`
        },
        {
          type: 'paragraph',
          content: this.testData.texts.withSpecialChars
        },
        {
          type: 'paragraph',
          content: this.testData.texts.withEmoji
        },
        
        // Long text test
        {
          type: 'subsection',
          content: 'Long Text Handling',
          level: 2
        },
        {
          type: 'paragraph',
          content: this.testData.texts.longText
        },
        
        // Code blocks
        {
          type: 'section',
          content: 'Code Block Tests',
          level: 1
        },
        {
          type: 'subsection',
          content: 'JavaScript Code',
          level: 2
        },
        {
          type: 'codeblock',
          content: this.testData.code.javascript,
          language: 'javascript'
        },
        
        {
          type: 'subsection',
          content: 'Python Code',
          level: 2
        },
        {
          type: 'codeblock',
          content: this.testData.code.python,
          language: 'python'
        },
        
        {
          type: 'subsection',
          content: 'HTML Code',
          level: 2
        },
        {
          type: 'codeblock',
          content: this.testData.code.html,
          language: 'html'
        },
        
        {
          type: 'subsection',
          content: 'CSS Code',
          level: 2
        },
        {
          type: 'codeblock',
          content: this.testData.code.css,
          language: 'css'
        },
        
        // Lists
        {
          type: 'section',
          content: 'List Formatting Tests',
          level: 1
        },
        {
          type: 'subsection',
          content: 'Unordered List',
          level: 2
        },
        {
          type: 'list',
          items: this.testData.lists.unordered,
          ordered: false
        },
        
        {
          type: 'subsection',
          content: 'Ordered List',
          level: 2
        },
        {
          type: 'list',
          items: this.testData.lists.ordered,
          ordered: true
        },
        
        // Tables
        {
          type: 'section',
          content: 'Table Formatting Tests',
          level: 1
        },
        {
          type: 'subsection',
          content: 'Simple Table',
          level: 2
        },
        {
          type: 'table',
          data: this.testData.tables.simple,
          caption: 'Table 1: Simple data table'
        },
        
        {
          type: 'subsection',
          content: 'Complex Table with Special Characters',
          level: 2
        },
        {
          type: 'table',
          data: this.testData.tables.complex,
          caption: 'Table 2: Product inventory with status indicators'
        },
        
        {
          type: 'subsection',
          content: 'Table with Mixed Content',
          level: 2
        },
        {
          type: 'table',
          data: this.testData.tables.withSpecialContent,
          caption: 'Table 3: Mixed content including HTML, Markdown, and Unicode'
        },
        
        // Mathematical content
        {
          type: 'section',
          content: 'Mathematical Content Tests',
          level: 1
        },
        {
          type: 'paragraph',
          content: `Inline math: ${this.testData.math.inline}`
        },
        {
          type: 'paragraph',
          content: 'Block math:'
        },
        {
          type: 'math',
          content: this.testData.math.block
        },
        {
          type: 'paragraph',
          content: 'Complex equation:'
        },
        {
          type: 'math',
          content: this.testData.math.complex
        },
        
        // Image placeholders
        {
          type: 'section',
          content: 'Image Handling Tests',
          level: 1
        },
        ...this.testData.images.map(img => ({
          type: 'image',
          src: img.src,
          alt: img.alt,
          caption: img.caption
        })),
        
        // Quote blocks
        {
          type: 'section',
          content: 'Quote Blocks',
          level: 1
        },
        {
          type: 'quote',
          content: 'This is a blockquote to test quote formatting. It should be properly indented and styled differently from regular paragraphs.'
        },
        {
          type: 'quote',
          content: 'This is another quote with **bold text** and *italic text* to test inline formatting within quotes.'
        },
        
        // Page break test
        {
          type: 'pagebreak'
        },
        
        // Conclusion section
        {
          type: 'section',
          content: 'Conclusion',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'This document contains comprehensive test cases for validating export quality across different formats. It includes text formatting, code blocks, lists, tables, mathematical content, images, and special characters.'
        }
      ]
    };
  }

  /**
   * Generate test document variations for different export scenarios
   */
  generateTestVariations() {
    return {
      minimal: this.generateMinimalDocument(),
      comprehensive: this.generateTestDocument(),
      legal: this.generateLegalDocument(),
      technical: this.generateTechnicalDocument(),
      academic: this.generateAcademicDocument(),
      multilingual: this.generateMultilingualDocument()
    };
  }

  /**
   * Generate minimal test document
   */
  generateMinimalDocument() {
    return {
      metadata: {
        title: 'Minimal Test Document',
        author: 'Test Suite'
      },
      sections: [
        {
          type: 'title',
          content: 'Minimal Test Document'
        },
        {
          type: 'paragraph',
          content: 'This is a minimal test document with basic content.'
        },
        {
          type: 'list',
          items: ['Item 1', 'Item 2', 'Item 3'],
          ordered: false
        }
      ]
    };
  }

  /**
   * Generate legal document format test
   */
  generateLegalDocument() {
    return {
      metadata: {
        title: 'Legal Document Format Test',
        documentType: 'contract',
        jurisdiction: 'US'
      },
      sections: [
        {
          type: 'title',
          content: 'SAMPLE LEGAL AGREEMENT'
        },
        {
          type: 'section',
          content: '1. DEFINITIONS',
          level: 1
        },
        {
          type: 'paragraph',
          content: '1.1 "Agreement" means this legal document and all amendments.'
        },
        {
          type: 'paragraph',
          content: '1.2 "Party" means each signatory to this Agreement.'
        },
        {
          type: 'section',
          content: '2. TERMS AND CONDITIONS',
          level: 1
        },
        {
          type: 'paragraph',
          content: '2.1 Each Party agrees to comply with all applicable laws and regulations.'
        }
      ]
    };
  }

  /**
   * Generate technical document
   */
  generateTechnicalDocument() {
    return {
      metadata: {
        title: 'Technical Specification Test',
        documentType: 'technical',
        version: '1.0.0'
      },
      sections: [
        {
          type: 'title',
          content: 'API Technical Specification'
        },
        {
          type: 'section',
          content: 'Overview',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'This API provides RESTful endpoints for data management.'
        },
        {
          type: 'section',
          content: 'Endpoints',
          level: 1
        },
        {
          type: 'subsection',
          content: 'GET /api/users',
          level: 2
        },
        {
          type: 'codeblock',
          content: `curl -X GET "https://api.example.com/users" \\
  -H "Accept: application/json" \\
  -H "Authorization: Bearer token"`,
          language: 'bash'
        }
      ]
    };
  }

  /**
   * Generate academic document
   */
  generateAcademicDocument() {
    return {
      metadata: {
        title: 'Academic Paper Format Test',
        author: 'Dr. Test Author',
        institution: 'Test University'
      },
      sections: [
        {
          type: 'title',
          content: 'The Impact of Export Quality on Document Processing'
        },
        {
          type: 'section',
          content: 'Abstract',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'This paper examines the importance of export quality validation in document processing systems.'
        },
        {
          type: 'section',
          content: 'Introduction',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'Document export quality is crucial for maintaining information integrity across different formats.'
        }
      ]
    };
  }

  /**
   * Generate multilingual document
   */
  generateMultilingualDocument() {
    return {
      metadata: {
        title: 'Multilingual Test Document',
        language: 'multiple'
      },
      sections: [
        {
          type: 'title',
          content: 'Multilingual Export Test / Test d\'exportation multilingue / Mehrsprachiger Export-Test'
        },
        {
          type: 'section',
          content: 'English Section',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'This is text in English with various characters: café, résumé, naïve.'
        },
        {
          type: 'section',
          content: 'Section Française',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'Ceci est du texte en français avec des accents: café, résumé, naïve, cœur.'
        },
        {
          type: 'section',
          content: 'Deutsche Sektion',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'Dies ist deutscher Text mit Umlauten: Müller, Größe, weiß, Straße.'
        },
        {
          type: 'section',
          content: 'Sección Española',
          level: 1
        },
        {
          type: 'paragraph',
          content: 'Este es texto en español con caracteres especiales: niño, señor, corazón.'
        }
      ]
    };
  }

  /**
   * Generate test documents and save to file system
   */
  async generateTestFiles(outputDir = './tests/export-quality/test-data') {
    await fs.ensureDir(outputDir);
    
    const variations = this.generateTestVariations();
    const results = {};

    for (const [name, document] of Object.entries(variations)) {
      const filePath = path.join(outputDir, `${name}-test-document.json`);
      await fs.writeJSON(filePath, document, { spaces: 2 });
      results[name] = filePath;
    }

    return results;
  }
}

export default TestDocumentBuilder;