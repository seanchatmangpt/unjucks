# Word Document Processor

A comprehensive Word document processor for the Unjucks template system, providing advanced DOCX template processing with variable replacement, image handling, batch processing, and content injection capabilities.

## Features

- **Variable Replacement**: Support for `{{variable}}` and `{variable}` syntax
- **Advanced Templating**: Loops, conditionals, and nested object access
- **Image Processing**: Insert and replace images in documents
- **Table Processing**: Dynamic table generation and data population  
- **Headers & Footers**: Process variables in headers and footers
- **Content Injection**: Inject content at bookmarks and markers
- **Batch Processing**: Process multiple documents concurrently
- **Error Handling**: Comprehensive error handling and validation
- **Performance**: Template caching and performance monitoring
- **Events**: Real-time processing events and progress tracking

## Installation

### Required Dependencies

```bash
# Core dependencies (required)
npm install docxtemplater pizzip

# Optional dependencies for enhanced features
npm install docxtemplater-image-module-free  # Image processing
npm install docxtemplater-loop-module        # Advanced loops
```

### Fallback Mode

The processor can run in fallback mode without `docxtemplater`, but with limited functionality. Install the full dependencies for production use.

## Quick Start

```javascript
import { WordProcessor } from '../src/office/processors/word-processor.js';

// Create processor instance
const processor = new WordProcessor({
  enableImages: true,
  enableLoops: true
});

// Process a document
const result = await processor.processDocument(
  'template.docx',
  {
    customerName: 'John Doe',
    companyName: 'Acme Corp',
    date: new Date()
  },
  {
    outputPath: 'output.docx'
  }
);

if (result.success) {
  console.log('Document processed successfully!');
} else {
  console.error('Processing failed:', result.error.message);
}
```

## API Reference

### Constructor Options

```javascript
const processor = new WordProcessor({
  enableImages: true,        // Enable image processing
  enableLoops: true,         // Enable advanced loop processing
  strictMode: false,         // Enable strict validation mode
  delimiters: {              // Custom variable delimiters
    start: '{{',
    end: '}}'
  },
  logger: console            // Custom logger
});
```

### Core Methods

#### `processDocument(template, data, options)`

Process a Word document template with provided data.

**Parameters:**
- `template` (string|Buffer): Template file path or buffer
- `data` (Object): Data for variable replacement
- `options` (Object): Processing options
  - `outputPath` (string): Output file path
  - `preserveFormatting` (boolean): Preserve original formatting
  - `images` (Object): Image data for replacement
  - `injectionPoints` (Array): Content injection points

**Returns:** Promise<Object> - Processing result

```javascript
const result = await processor.processDocument('template.docx', {
  name: 'John Doe',
  items: [
    { product: 'Widget', price: 10.99 },
    { product: 'Gadget', price: 25.50 }
  ]
}, {
  outputPath: 'output.docx',
  images: {
    logo: './company-logo.png'
  }
});
```

#### `batchProcess(templates, globalData, options)`

Process multiple documents in batch with shared configuration.

**Parameters:**
- `templates` (Array): Array of template configurations
- `globalData` (Object): Global data applied to all templates
- `options` (Object): Batch processing options
  - `concurrency` (number): Maximum concurrent processing
  - `continueOnError` (boolean): Continue if one fails
  - `progressCallback` (Function): Progress update callback

**Returns:** Promise<Array> - Array of processing results

```javascript
const results = await processor.batchProcess([
  { 
    template: 'invoice.docx', 
    data: { invoiceId: '001' }, 
    options: { outputPath: 'invoice-001.docx' }
  },
  { 
    template: 'invoice.docx', 
    data: { invoiceId: '002' }, 
    options: { outputPath: 'invoice-002.docx' }
  }
], { 
  company: 'Acme Corp' 
}, { 
  concurrency: 2 
});
```

#### `extractVariables(template, options)`

Extract variables from a Word document template.

**Parameters:**
- `template` (string|Buffer): Template file path or buffer
- `options` (Object): Extraction options

**Returns:** Promise<Array> - Array of found variables

```javascript
const variables = await processor.extractVariables('template.docx');
// Returns: [{ name: 'customerName', type: 'simple', location: 'paragraph' }, ...]
```

#### `validateTemplate(template, sampleData)`

Validate Word document template structure and variables.

**Parameters:**
- `template` (string|Buffer): Template file path or buffer
- `sampleData` (Object): Sample data for validation

**Returns:** Promise<Object> - Validation result

```javascript
const validation = await processor.validateTemplate('template.docx', {
  name: 'Test',
  company: 'Test Corp'
});

console.log('Valid:', validation.isValid);
console.log('Missing variables:', validation.missingVariables);
console.log('Unused variables:', validation.unusedVariables);
```

#### `getStats()`

Get processing statistics and performance metrics.

**Returns:** Object - Current statistics

```javascript
const stats = processor.getStats();
console.log('Documents processed:', stats.documentsProcessed);
console.log('Cache size:', stats.cacheSize);
console.log('Dependency status:', stats.dependencyStatus);
```

#### `clear(resetStats)`

Clear template cache and optionally reset statistics.

**Parameters:**
- `resetStats` (boolean): Whether to reset statistics

```javascript
processor.clear(true); // Clear cache and reset stats
```

### Utility Functions

#### `createWordProcessor(options)`

Factory function to create Word processor instance.

```javascript
import { createWordProcessor } from '../src/office/processors/word-processor.js';

const processor = createWordProcessor({
  enableImages: true,
  logger: customLogger
});
```

#### `getCapabilities()`

Check Word processor capabilities and dependencies.

```javascript
import { getCapabilities } from '../src/office/processors/word-processor.js';

const capabilities = getCapabilities();
console.log('Fallback mode:', capabilities.fallbackMode);
```

## Template Syntax

### Basic Variables

```
Hello {{customerName}}!
Your order total is {{orderTotal}}.
```

### Nested Objects

```
Customer: {{customer.name}}
Address: {{customer.address.street}}, {{customer.address.city}}
```

### Conditionals

```
{{#if hasDiscount}}
  Discount applied: {{discountAmount}}
{{/if}}

{{#unless isPaid}}
  Payment required: {{amountDue}}
{{/unless}}
```

### Loops

```
Items:
{{#each items}}
  - {{name}}: {{price}}
{{/each}}

{{#each departments}}
  Department: {{name}}
  {{#each employees}}
    - {{name}} ({{role}})
  {{/each}}
{{/each}}
```

### Images

```
Company Logo: {{%companyLogo}}
Product Image: {{%productImage}}
```

### Bookmarks

Use Word bookmarks for content injection:

```
[BOOKMARK:terms_section]
[BOOKMARK:signature_block]
```

## Advanced Features

### Image Processing

```javascript
const result = await processor.processDocument('template.docx', data, {
  images: {
    companyLogo: './logo.png',           // File path
    signature: signatureBuffer,          // Buffer
    productImage: './product.jpg'        // Multiple images
  }
});
```

### Content Injection

```javascript
const injectionPoints = [
  {
    bookmark: 'TERMS_SECTION',
    content: '<p>Terms and conditions content...</p>',
    position: 'replace'  // 'replace', 'before', 'after'
  }
];

await processor.processDocument('template.docx', data, {
  injectionPoints
});
```

### Batch Processing with Progress

```javascript
const progressCallback = (progress) => {
  console.log(`Progress: ${progress.completed}/${progress.total}`);
  if (progress.result.success) {
    console.log('✅ Success');
  } else {
    console.log('❌ Failed:', progress.result.error.message);
  }
};

await processor.batchProcess(templates, globalData, {
  concurrency: 3,
  progressCallback
});
```

### Error Handling

```javascript
// Graceful error handling (default)
const processor = new WordProcessor({ strictMode: false });

const result = await processor.processDocument('template.docx', data);
if (!result.success) {
  console.error('Processing failed:', result.error.message);
}

// Strict mode - throws errors
const strictProcessor = new WordProcessor({ strictMode: true });

try {
  await strictProcessor.processDocument('template.docx', data);
} catch (error) {
  console.error('Strict mode error:', error.message);
}
```

### Event Handling

```javascript
processor.on('processingStarted', (data) => {
  console.log('Processing started:', data.sessionId);
});

processor.on('processingCompleted', (result) => {
  console.log('Processing completed:', result.processingTime + 'ms');
});

processor.on('processingError', (error) => {
  console.error('Processing error:', error.error.message);
});

processor.on('batchStarted', (data) => {
  console.log('Batch started:', data.count + ' documents');
});

processor.on('batchCompleted', (result) => {
  console.log('Batch completed:', result.successCount + ' successful');
});
```

## Error Codes and Troubleshooting

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `MISSING_DEPENDENCIES` | docxtemplater not installed | `npm install docxtemplater pizzip` |
| `INVALID_TEMPLATE` | Template file is not valid DOCX | Check file format and integrity |
| `TEMPLATE_NOT_FOUND` | Template file doesn't exist | Verify file path |
| `PROCESSING_ERROR` | General processing error | Check template syntax and data |
| `VALIDATION_ERROR` | Template validation failed | Review template structure |

### Dependency Issues

If you see warnings about missing dependencies:

```bash
# Install core dependencies
npm install docxtemplater pizzip

# Install optional features
npm install docxtemplater-image-module-free
npm install docxtemplater-loop-module
```

### Performance Tips

1. **Enable Caching**: Templates are cached automatically for better performance
2. **Use Batch Processing**: Process multiple documents concurrently
3. **Optimize Images**: Use appropriate image sizes and formats
4. **Monitor Stats**: Use `getStats()` to monitor performance

```javascript
// Check performance
const stats = processor.getStats();
console.log('Average processing time:', 
  stats.processingTime / stats.documentsProcessed + 'ms');
```

### Memory Management

```javascript
// Clear cache periodically for long-running processes
if (processor.getStats().cacheSize > 100) {
  processor.clear(false); // Clear cache but keep stats
}

// Full cleanup
processor.clear(true); // Clear cache and reset stats
```

## Examples

See the [examples directory](../examples/office/word-processor-examples.js) for comprehensive usage examples including:

- Basic document processing
- Advanced templating with loops and conditions
- Image processing and replacement
- Bookmark-based content injection
- Batch processing multiple documents
- Template validation and variable extraction
- Error handling and recovery
- Performance monitoring

## Integration with Unjucks

The Word processor integrates seamlessly with the Unjucks template system:

```javascript
// In your Unjucks template configuration
export default {
  processors: {
    word: new WordProcessor({
      enableImages: true,
      enableLoops: true
    })
  }
};
```

## Browser Support

This processor is designed for Node.js environments. For browser usage, consider using the web-compatible version or processing documents server-side.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Changelog

### Version 2.0.0
- Complete rewrite in JavaScript
- Enhanced error handling
- Batch processing capabilities
- Event-driven architecture
- Performance improvements
- Comprehensive test coverage

### Version 1.0.0
- Initial TypeScript implementation
- Basic template processing
- Variable replacement
- Image support