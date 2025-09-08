/**
 * Traceability Tracker - Maintains traceability from spec to generated code
 */

import type {
  Specification,
  GeneratedFile,
  TemplateMapping,
  TraceabilityRecord,
  LineRange
} from '../types/index.js';

export class TraceabilityTracker {
  private records: Map<string, TraceabilityRecord[]> = new Map();

  /**
   * Create traceability records for generated file
   */
  createRecords(
    spec: Specification,
    generatedFile: GeneratedFile,
    mapping: TemplateMapping
  ): TraceabilityRecord[] {
    const records: TraceabilityRecord[] = [];

    // Analyze generated content to find spec element references
    const contentAnalysis = this.analyzeGeneratedContent(generatedFile.content, spec);

    // Create records for each spec element found in the generated content
    for (const elementRef of contentAnalysis.elementReferences) {
      const record: TraceabilityRecord = {
        id: this.generateTraceabilityId(),
        specElementId: elementRef.elementId,
        specElementType: elementRef.elementType,
        generatedFilePath: generatedFile.path,
        generatedLineRange: elementRef.lineRange,
        transformationRules: this.extractTransformationRules(mapping, elementRef),
        timestamp: new Date()
      };

      records.push(record);
    }

    // Store records for later retrieval
    this.storeRecords(generatedFile.path, records);

    return records;
  }

  /**
   * Get traceability records for a generated file
   */
  getRecordsForFile(filePath: string): TraceabilityRecord[] {
    return this.records.get(filePath) || [];
  }

  /**
   * Get traceability records for a spec element
   */
  getRecordsForSpecElement(specElementId: string): TraceabilityRecord[] {
    const allRecords: TraceabilityRecord[] = [];
    
    for (const records of this.records.values()) {
      allRecords.push(...records.filter(r => r.specElementId === specElementId));
    }

    return allRecords;
  }

  /**
   * Find which generated files contain references to a spec element
   */
  findGeneratedFilesForSpecElement(specElementId: string): string[] {
    const filePaths = new Set<string>();
    
    for (const [filePath, records] of this.records.entries()) {
      if (records.some(r => r.specElementId === specElementId)) {
        filePaths.add(filePath);
      }
    }

    return Array.from(filePaths);
  }

  /**
   * Find which spec elements contributed to a generated file
   */
  findSpecElementsForGeneratedFile(filePath: string): string[] {
    const records = this.records.get(filePath) || [];
    return records.map(r => r.specElementId);
  }

  /**
   * Generate traceability report
   */
  generateTraceabilityReport(spec: Specification): TraceabilityReport {
    const report: TraceabilityReport = {
      specificationId: spec.id,
      timestamp: new Date(),
      coverage: {
        totalSpecElements: this.countSpecElements(spec),
        tracedElements: 0,
        coveragePercentage: 0
      },
      elementTraceability: [],
      orphanedFiles: [],
      summary: {
        totalGeneratedFiles: 0,
        totalTraceabilityRecords: 0,
        mostReferencedElements: [],
        leastReferencedElements: []
      }
    };

    // Analyze coverage
    const tracedElements = new Set<string>();
    let totalRecords = 0;

    for (const records of this.records.values()) {
      totalRecords += records.length;
      records.forEach(record => tracedElements.add(record.specElementId));
    }

    report.coverage.tracedElements = tracedElements.size;
    report.coverage.coveragePercentage = 
      (report.coverage.tracedElements / report.coverage.totalSpecElements) * 100;

    // Generate element traceability info
    report.elementTraceability = this.generateElementTraceability(spec);

    // Find orphaned files (generated files with no traceability)
    report.orphanedFiles = this.findOrphanedFiles();

    // Generate summary
    report.summary.totalGeneratedFiles = this.records.size;
    report.summary.totalTraceabilityRecords = totalRecords;
    report.summary.mostReferencedElements = this.findMostReferencedElements();
    report.summary.leastReferencedElements = this.findLeastReferencedElements(spec);

    return report;
  }

  /**
   * Export traceability data
   */
  exportTraceabilityData(): TraceabilityExport {
    const allRecords: TraceabilityRecord[] = [];
    const fileMap: Record<string, TraceabilityRecord[]> = {};

    for (const [filePath, records] of this.records.entries()) {
      allRecords.push(...records);
      fileMap[filePath] = records;
    }

    return {
      exportTimestamp: new Date(),
      totalRecords: allRecords.length,
      records: allRecords,
      fileMap,
      version: '1.0.0'
    };
  }

  /**
   * Import traceability data
   */
  importTraceabilityData(exportData: TraceabilityExport): void {
    this.records.clear();
    
    for (const [filePath, records] of Object.entries(exportData.fileMap)) {
      this.records.set(filePath, records);
    }
  }

  /**
   * Clear all traceability records
   */
  clearAllRecords(): void {
    this.records.clear();
  }

  /**
   * Clear records for specific file
   */
  clearRecordsForFile(filePath: string): void {
    this.records.delete(filePath);
  }

  /**
   * Analyze generated content to find spec element references
   */
  private analyzeGeneratedContent(
    content: string, 
    spec: Specification
  ): ContentAnalysis {
    const elementReferences: ElementReference[] = [];
    const lines = content.split('\n');

    // Analyze each line for references to spec elements
    lines.forEach((line, lineIndex) => {
      // Check for entity references
      spec.entities.forEach(entity => {
        if (line.includes(entity.name)) {
          elementReferences.push({
            elementId: entity.id,
            elementType: 'entity',
            lineRange: { start: lineIndex + 1, end: lineIndex + 1 },
            context: line.trim()
          });
        }

        // Check property references
        entity.properties.forEach(property => {
          if (line.includes(property.name)) {
            elementReferences.push({
              elementId: `${entity.id}.${property.name}`,
              elementType: 'property',
              lineRange: { start: lineIndex + 1, end: lineIndex + 1 },
              context: line.trim()
            });
          }
        });

        // Check method references
        entity.methods?.forEach(method => {
          if (line.includes(method.name)) {
            elementReferences.push({
              elementId: `${entity.id}.${method.name}`,
              elementType: 'method',
              lineRange: { start: lineIndex + 1, end: lineIndex + 1 },
              context: line.trim()
            });
          }
        });
      });

      // Check for relationship references
      spec.relationships.forEach(relationship => {
        if (line.includes(relationship.type)) {
          elementReferences.push({
            elementId: relationship.id,
            elementType: 'relationship',
            lineRange: { start: lineIndex + 1, end: lineIndex + 1 },
            context: line.trim()
          });
        }
      });
    });

    return {
      elementReferences,
      totalLines: lines.length,
      codeBlocks: this.extractCodeBlocks(content),
      imports: this.extractImports(content)
    };
  }

  /**
   * Extract transformation rules from mapping
   */
  private extractTransformationRules(
    mapping: TemplateMapping, 
    elementRef: ElementReference
  ): string[] {
    const rules: string[] = [];

    // Add template-based rule
    rules.push(`template:${mapping.templatePath}`);

    // Add variable mapping rules
    mapping.variables.forEach(varMapping => {
      if (varMapping.transformer) {
        rules.push(`transform:${varMapping.transformer}`);
      }
    });

    // Add pattern-based rules
    if (mapping.specPattern.entityTypes.length > 0) {
      rules.push(`pattern:entity-types:${mapping.specPattern.entityTypes.join(',')}`);
    }

    if (mapping.specPattern.relationshipTypes.length > 0) {
      rules.push(`pattern:relationship-types:${mapping.specPattern.relationshipTypes.join(',')}`);
    }

    return rules;
  }

  /**
   * Store traceability records
   */
  private storeRecords(filePath: string, records: TraceabilityRecord[]): void {
    const existingRecords = this.records.get(filePath) || [];
    this.records.set(filePath, [...existingRecords, ...records]);
  }

  /**
   * Count total spec elements
   */
  private countSpecElements(spec: Specification): number {
    let count = spec.entities.length + spec.relationships.length + spec.constraints.length;
    
    // Add properties and methods
    spec.entities.forEach(entity => {
      count += entity.properties.length;
      count += entity.methods?.length || 0;
    });

    return count;
  }

  /**
   * Generate element traceability info
   */
  private generateElementTraceability(spec: Specification): ElementTraceabilityInfo[] {
    const elementInfo: ElementTraceabilityInfo[] = [];

    // Process entities
    spec.entities.forEach(entity => {
      const records = this.getRecordsForSpecElement(entity.id);
      elementInfo.push({
        elementId: entity.id,
        elementType: 'entity',
        elementName: entity.name,
        isTraced: records.length > 0,
        generatedFiles: records.map(r => r.generatedFilePath),
        referenceCount: records.length
      });
    });

    // Process relationships
    spec.relationships.forEach(relationship => {
      const records = this.getRecordsForSpecElement(relationship.id);
      elementInfo.push({
        elementId: relationship.id,
        elementType: 'relationship',
        elementName: relationship.type,
        isTraced: records.length > 0,
        generatedFiles: records.map(r => r.generatedFilePath),
        referenceCount: records.length
      });
    });

    return elementInfo;
  }

  /**
   * Find orphaned files (no traceability records)
   */
  private findOrphanedFiles(): string[] {
    return Array.from(this.records.entries())
      .filter(([_, records]) => records.length === 0)
      .map(([filePath]) => filePath);
  }

  /**
   * Find most referenced elements
   */
  private findMostReferencedElements(): ElementReferenceCount[] {
    const elementCounts = new Map<string, ElementReferenceCount>();

    for (const records of this.records.values()) {
      records.forEach(record => {
        const existing = elementCounts.get(record.specElementId);
        if (existing) {
          existing.count++;
        } else {
          elementCounts.set(record.specElementId, {
            elementId: record.specElementId,
            elementType: record.specElementType,
            count: 1
          });
        }
      });
    }

    return Array.from(elementCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Find least referenced elements
   */
  private findLeastReferencedElements(spec: Specification): ElementReferenceCount[] {
    const allElements = [
      ...spec.entities.map(e => ({ elementId: e.id, elementType: 'entity' as const, count: 0 })),
      ...spec.relationships.map(r => ({ elementId: r.id, elementType: 'relationship' as const, count: 0 }))
    ];

    // Count references
    for (const records of this.records.values()) {
      records.forEach(record => {
        const element = allElements.find(e => e.elementId === record.specElementId);
        if (element) {
          element.count++;
        }
      });
    }

    return allElements
      .sort((a, b) => a.count - b.count)
      .slice(0, 10);
  }

  /**
   * Extract code blocks from content
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = content.split('\n');
    let currentBlock: Partial<CodeBlock> | null = null;

    lines.forEach((line, index) => {
      // Simple detection of code blocks (can be enhanced)
      if (line.match(/^(class|function|interface|type|const|let|var)\s/)) {
        if (currentBlock) {
          blocks.push(currentBlock as CodeBlock);
        }
        currentBlock = {
          type: this.detectBlockType(line),
          startLine: index + 1,
          endLine: index + 1,
          content: [line]
        };
      } else if (currentBlock && line.trim()) {
        currentBlock.endLine = index + 1;
        currentBlock.content!.push(line);
      } else if (currentBlock && !line.trim()) {
        blocks.push(currentBlock as CodeBlock);
        currentBlock = null;
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock as CodeBlock);
    }

    return blocks;
  }

  /**
   * Extract imports from content
   */
  private extractImports(content: string): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const importMatch = line.match(/^import\s+(.*?)\s+from\s+['"](.+?)['"]/);
      if (importMatch) {
        imports.push({
          lineNumber: index + 1,
          importedItems: importMatch[1],
          source: importMatch[2],
          isDefault: !importMatch[1].includes('{')
        });
      }
    });

    return imports;
  }

  /**
   * Detect block type from line
   */
  private detectBlockType(line: string): string {
    if (line.startsWith('class ')) return 'class';
    if (line.startsWith('function ')) return 'function';
    if (line.startsWith('interface ')) return 'interface';
    if (line.startsWith('type ')) return 'type';
    if (line.match(/^(const|let|var)\s/)) return 'variable';
    return 'unknown';
  }

  /**
   * Generate unique traceability ID
   */
  private generateTraceabilityId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Additional types for traceability
interface ContentAnalysis {
  elementReferences: ElementReference[];
  totalLines: number;
  codeBlocks: CodeBlock[];
  imports: ImportStatement[];
}

interface ElementReference {
  elementId: string;
  elementType: string;
  lineRange: LineRange;
  context: string;
}

interface TraceabilityReport {
  specificationId: string;
  timestamp: Date;
  coverage: {
    totalSpecElements: number;
    tracedElements: number;
    coveragePercentage: number;
  };
  elementTraceability: ElementTraceabilityInfo[];
  orphanedFiles: string[];
  summary: {
    totalGeneratedFiles: number;
    totalTraceabilityRecords: number;
    mostReferencedElements: ElementReferenceCount[];
    leastReferencedElements: ElementReferenceCount[];
  };
}

interface ElementTraceabilityInfo {
  elementId: string;
  elementType: string;
  elementName: string;
  isTraced: boolean;
  generatedFiles: string[];
  referenceCount: number;
}

interface ElementReferenceCount {
  elementId: string;
  elementType: string;
  count: number;
}

interface TraceabilityExport {
  exportTimestamp: Date;
  totalRecords: number;
  records: TraceabilityRecord[];
  fileMap: Record<string, TraceabilityRecord[]>;
  version: string;
}

interface CodeBlock {
  type: string;
  startLine: number;
  endLine: number;
  content: string[];
}

interface ImportStatement {
  lineNumber: number;
  importedItems: string;
  source: string;
  isDefault: boolean;
}

export { TraceabilityTracker };