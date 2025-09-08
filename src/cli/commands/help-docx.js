/**
 * DOCX Export Help Documentation
 */

export const docxHelpText = {
  command: 'export-docx',
  description: 'Export content to Microsoft Word (DOCX) format',
  
  usage: [
    'unjucks export-docx [options]',
    'unjucks export-docx --input file.html --output document',
    'unjucks export-docx --template academic-paper --data data.json',
    'unjucks export-docx --batch batch-config.json'
  ],

  examples: [
    {
      command: 'unjucks export-docx --input content.html --output report',
      description: 'Convert HTML file to DOCX'
    },
    {
      command: 'unjucks export-docx --template legal-contract --data contract.json',
      description: 'Generate legal contract from template'
    },
    {
      command: 'unjucks export-docx --input paper.md --format markdown --theme academic',
      description: 'Convert Markdown to academic-styled DOCX'
    },
    {
      command: 'unjucks export-docx --list',
      description: 'List available DOCX templates'
    },
    {
      command: 'unjucks export-docx --validate academic-paper',
      description: 'Validate a template file'
    },
    {
      command: 'unjucks export-docx --batch reports.json --verbose',
      description: 'Batch export multiple documents'
    }
  ],

  options: [
    {
      flag: '--input, -i <file>',
      description: 'Input file or content to convert'
    },
    {
      flag: '--template, -t <name>',
      description: 'Template name for generation (legal-contract, academic-paper, business-report)'
    },
    {
      flag: '--output, -o <name>',
      description: 'Output filename without extension (default: document)'
    },
    {
      flag: '--format, -f <type>',
      description: 'Input format: html, latex, markdown, nunjucks, structured, auto (default: auto)'
    },
    {
      flag: '--theme <name>',
      description: 'Document theme: professional, academic, legal, modern (default: professional)'
    },
    {
      flag: '--data, -d <file>',
      description: 'JSON data file for template variables'
    },
    {
      flag: '--template-dir <path>',
      description: 'Directory containing DOCX templates (default: ./templates/docx)'
    },
    {
      flag: '--output-dir <path>',
      description: 'Output directory for generated documents (default: ./output)'
    },
    {
      flag: '--use-pandoc',
      description: 'Use Pandoc for conversion when available (default: true)'
    },
    {
      flag: '--dry-run',
      description: 'Show what would be generated without creating files'
    },
    {
      flag: '--batch <file>',
      description: 'JSON file with batch export configuration'
    },
    {
      flag: '--list',
      description: 'List available templates'
    },
    {
      flag: '--validate <template>',
      description: 'Validate a template file'
    },
    {
      flag: '--verbose, -v',
      description: 'Show detailed output'
    }
  ],

  templates: [
    {
      name: 'legal-contract',
      description: 'Professional legal contract template',
      variables: ['title', 'parties', 'effective_date', 'terms', 'signatures']
    },
    {
      name: 'academic-paper',
      description: 'Standard academic paper with citations',
      variables: ['title', 'author', 'institution', 'abstract', 'sections', 'references']
    },
    {
      name: 'business-report',
      description: 'Professional business report with charts',
      variables: ['title', 'company', 'author', 'executive_summary', 'sections']
    }
  ],

  formats: [
    {
      name: 'html',
      description: 'HTML documents with tags and styling'
    },
    {
      name: 'latex',
      description: 'LaTeX documents with mathematical notation'
    },
    {
      name: 'markdown',
      description: 'Markdown documents with simple formatting'
    },
    {
      name: 'nunjucks',
      description: 'Nunjucks templates with variables and logic'
    },
    {
      name: 'structured',
      description: 'JSON structured content with document elements'
    },
    {
      name: 'auto',
      description: 'Automatically detect format from content'
    }
  ],

  themes: [
    {
      name: 'professional',
      description: 'Modern business theme with Calibri fonts and blue accents'
    },
    {
      name: 'academic',
      description: 'Academic theme with Times New Roman and double spacing'
    },
    {
      name: 'legal',
      description: 'Legal document theme with formal styling'
    },
    {
      name: 'modern',
      description: 'Contemporary theme with clean design and modern fonts'
    }
  ],

  batchConfig: {
    description: 'JSON configuration for batch export',
    example: {
      concurrency: 3,
      documents: [
        {
          content: 'Document 1 content',
          filename: 'doc1',
          format: 'html',
          theme: 'professional'
        },
        {
          template: 'academic-paper',
          data: {
            title: 'Research Paper',
            author: 'John Doe'
          },
          filename: 'research-paper'
        }
      ]
    }
  },

  troubleshooting: [
    {
      issue: 'Pandoc not found',
      solution: 'Install Pandoc from https://pandoc.org/installing.html or use --use-pandoc=false'
    },
    {
      issue: 'docx library not installed',
      solution: 'Install with: npm install docx'
    },
    {
      issue: 'Template not found',
      solution: 'Check template directory path or use --list to see available templates'
    },
    {
      issue: 'Invalid JSON data',
      solution: 'Validate JSON syntax in data file'
    },
    {
      issue: 'Permission denied',
      solution: 'Check write permissions for output directory'
    }
  ]
};

export default docxHelpText;