/**
 * Multi-Modal Schema Alignment Engine
 * Advanced alignment with textual, structural, and semantic analysis plus uncertainty quantification
 */

import { Store, Parser, Writer, DataFactory } from 'n3';
import { createHash } from 'crypto';

const { namedNode, literal, blankNode, quad } = DataFactory;

export class MultiModalAlignmentEngine {
  constructor(options = {}) {
    this.options = {
      textualWeight: options.textualWeight || 0.4,
      structuralWeight: options.structuralWeight || 0.3,
      semanticWeight: options.semanticWeight || 0.3,
      uncertaintyThreshold: options.uncertaintyThreshold || 0.2,
      conflictResolutionStrategy: options.conflictResolutionStrategy || 'stakeholder_preference',
      ...options
    };

    // Alignment state
    this.alignmentCache = new Map();
    this.uncertaintyModel = new Map();
    this.stakeholderPreferences = new Map();
    this.alignmentHistory = [];
    
    // Modality processors
    this.textualProcessor = new TextualAlignmentProcessor();
    this.structuralProcessor = new StructuralAlignmentProcessor();
    this.semanticProcessor = new SemanticAlignmentProcessor();
    
    // Uncertainty quantification
    this.uncertaintyQuantifier = new AlignmentUncertaintyQuantifier();
    
    // Conflict resolver
    this.conflictResolver = new AlignmentConflictResolver(this.options.conflictResolutionStrategy);
  }

  /**
   * Perform multi-modal alignment between two ontologies
   */
  async alignOntologies(sourceOntology, targetOntology, alignmentConfig = {}) {
    const alignmentId = this.generateAlignmentId(sourceOntology, targetOntology);
    
    // Check cache first
    if (this.alignmentCache.has(alignmentId) && !alignmentConfig.forceRefresh) {
      return this.alignmentCache.get(alignmentId);
    }
    
    const startTime = this.getDeterministicTimestamp();
    
    // Extract alignment features from both ontologies
    const sourceFeatures = await this.extractAlignmentFeatures(sourceOntology);
    const targetFeatures = await this.extractAlignmentFeatures(targetOntology);
    
    // Perform alignment in each modality
    const textualAlignment = await this.textualProcessor.align(
      sourceFeatures.textual, 
      targetFeatures.textual,
      alignmentConfig
    );
    
    const structuralAlignment = await this.structuralProcessor.align(
      sourceFeatures.structural,
      targetFeatures.structural,
      alignmentConfig
    );
    
    const semanticAlignment = await this.semanticProcessor.align(
      sourceFeatures.semantic,
      targetFeatures.semantic,
      alignmentConfig
    );
    
    // Combine alignments with weighted fusion
    const combinedAlignment = this.fuseAlignments({
      textual: textualAlignment,
      structural: structuralAlignment,
      semantic: semanticAlignment
    });
    
    // Quantify uncertainty for each alignment
    const alignmentWithUncertainty = await this.quantifyAlignmentUncertainty(combinedAlignment);
    
    // Detect and resolve conflicts
    const resolvedAlignment = await this.detectAndResolveConflicts(alignmentWithUncertainty);
    
    // Adapt based on usage patterns
    const adaptedAlignment = await this.adaptAlignmentToUsage(resolvedAlignment, alignmentConfig.usagePatterns);
    
    const result = {
      id: alignmentId,
      sourceOntology: sourceOntology.uri || 'source',
      targetOntology: targetOntology.uri || 'target',
      alignment: adaptedAlignment,
      confidence: this.calculateOverallConfidence(adaptedAlignment),
      uncertainty: this.calculateOverallUncertainty(adaptedAlignment),
      metadata: {
        processingTime: this.getDeterministicTimestamp() - startTime,
        modalityWeights: {
          textual: this.options.textualWeight,
          structural: this.options.structuralWeight,
          semantic: this.options.semanticWeight
        },
        alignmentCount: adaptedAlignment.length,
        highConfidenceCount: adaptedAlignment.filter(a => a.confidence > 0.8).length,
        uncertainAlignmentCount: adaptedAlignment.filter(a => a.uncertainty > this.options.uncertaintyThreshold).length
      },
      validation: await this.validateAlignment(adaptedAlignment, sourceOntology, targetOntology)
    };
    
    // Cache result
    this.alignmentCache.set(alignmentId, result);
    this.alignmentHistory.push(result);
    
    return result;
  }

  /**
   * Extract multi-modal features for alignment
   */
  async extractAlignmentFeatures(ontology) {
    const features = {
      textual: await this.extractTextualFeatures(ontology),
      structural: await this.extractStructuralFeatures(ontology),
      semantic: await this.extractSemanticFeatures(ontology)
    };
    
    return features;
  }

  /**
   * Extract textual features (labels, comments, descriptions)
   */
  async extractTextualFeatures(ontology) {
    const features = new Map();
    
    // Extract from labels and comments
    const labelQuads = ontology.getQuads(null, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), null);
    const commentQuads = ontology.getQuads(null, namedNode('http://www.w3.org/2000/01/rdf-schema#comment'), null);
    
    // Process labels
    for (const quad of labelQuads) {
      const entityUri = quad.subject.value;
      const label = quad.object.value;
      
      if (!features.has(entityUri)) {
        features.set(entityUri, {});
      }
      
      features.get(entityUri).label = label;
      features.get(entityUri).labelTokens = this.tokenizeText(label);
      features.get(entityUri).labelEmbedding = await this.generateTextEmbedding(label);
    }
    
    // Process comments
    for (const quad of commentQuads) {
      const entityUri = quad.subject.value;
      const comment = quad.object.value;
      
      if (!features.has(entityUri)) {
        features.set(entityUri, {});
      }
      
      features.get(entityUri).comment = comment;
      features.get(entityUri).commentTokens = this.tokenizeText(comment);
      features.get(entityUri).commentEmbedding = await this.generateTextEmbedding(comment);
    }
    
    // Extract from URIs
    const allSubjects = new Set();
    for (const quad of ontology.getQuads()) {
      allSubjects.add(quad.subject.value);
      if (quad.object.termType === 'NamedNode') {
        allSubjects.add(quad.object.value);
      }
    }
    
    for (const uri of allSubjects) {
      if (!features.has(uri)) {
        features.set(uri, {});
      }
      
      const localName = this.extractLocalName(uri);
      features.get(uri).localName = localName;
      features.get(uri).localNameTokens = this.tokenizeText(localName);
      features.get(uri).uriStructure = this.analyzeUriStructure(uri);
    }
    
    return features;
  }

  /**
   * Extract structural features (hierarchy, relationships, patterns)
   */
  async extractStructuralFeatures(ontology) {
    const features = new Map();
    
    // Extract class hierarchy
    const classHierarchy = await this.extractClassHierarchy(ontology);
    
    // Extract property structure
    const propertyStructure = await this.extractPropertyStructure(ontology);
    
    // Calculate structural metrics
    for (const [entity, _] of this.getAllEntities(ontology)) {
      const structuralFeatures = {
        incomingDegree: this.calculateIncomingDegree(ontology, entity),
        outgoingDegree: this.calculateOutgoingDegree(ontology, entity),
        depth: this.calculateHierarchyDepth(classHierarchy, entity),
        breadth: this.calculateHierarchyBreadth(classHierarchy, entity),
        centralityScore: this.calculateCentralityScore(ontology, entity),
        patternSignature: this.calculatePatternSignature(ontology, entity)
      };
      
      features.set(entity, structuralFeatures);
    }
    
    return features;
  }

  /**
   * Extract semantic features (meaning, context, relationships)
   */
  async extractSemanticFeatures(ontology) {
    const features = new Map();
    
    // Generate semantic embeddings
    const entities = this.getAllEntities(ontology);
    
    for (const [entity, entityData] of entities) {
      const semanticFeatures = {
        contextEmbedding: await this.generateContextEmbedding(ontology, entity),
        relationshipVector: this.generateRelationshipVector(ontology, entity),
        semanticRole: this.identifySemanticRole(ontology, entity),
        domainContext: this.extractDomainContext(ontology, entity),
        conceptualDistance: await this.calculateConceptualDistances(ontology, entity)
      };
      
      features.set(entity, semanticFeatures);
    }
    
    return features;
  }

  /**
   * Fuse alignments from different modalities using weighted combination
   */
  fuseAlignments(modalityAlignments) {
    const fusedAlignments = new Map();
    
    // Combine all candidate alignments
    const allCandidates = new Set();
    
    for (const [modality, alignments] of Object.entries(modalityAlignments)) {
      for (const alignment of alignments) {
        const key = `${alignment.source}|${alignment.target}`;
        allCandidates.add(key);
        
        if (!fusedAlignments.has(key)) {
          fusedAlignments.set(key, {
            source: alignment.source,
            target: alignment.target,
            modalityScores: {},
            evidence: {}
          });
        }
        
        fusedAlignments.get(key).modalityScores[modality] = alignment.confidence;
        fusedAlignments.get(key).evidence[modality] = alignment.evidence;
      }
    }
    
    // Calculate fused confidence scores
    const result = [];
    
    for (const [key, alignment] of fusedAlignments) {
      const textualScore = alignment.modalityScores.textual || 0;
      const structuralScore = alignment.modalityScores.structural || 0;
      const semanticScore = alignment.modalityScores.semantic || 0;
      
      const fusedConfidence = (
        textualScore * this.options.textualWeight +
        structuralScore * this.options.structuralWeight +
        semanticScore * this.options.semanticWeight
      );
      
      // Calculate modality agreement
      const modalityAgreement = this.calculateModalityAgreement(alignment.modalityScores);
      
      result.push({
        source: alignment.source,
        target: alignment.target,
        confidence: fusedConfidence,
        modalityAgreement,
        modalityScores: alignment.modalityScores,
        evidence: alignment.evidence,
        type: this.determineAlignmentType(alignment.source, alignment.target)
      });
    }
    
    return result.filter(a => a.confidence > 0.1); // Filter low-confidence alignments
  }

  /**
   * Quantify uncertainty for each alignment using probabilistic models
   */
  async quantifyAlignmentUncertainty(alignments) {
    const alignmentsWithUncertainty = [];
    
    for (const alignment of alignments) {
      const uncertainty = await this.uncertaintyQuantifier.quantify(alignment);
      
      alignmentsWithUncertainty.push({
        ...alignment,
        uncertainty: uncertainty.total,
        uncertaintyComponents: {
          epistemic: uncertainty.epistemic, // Model uncertainty
          aleatoric: uncertainty.aleatoric,  // Data uncertainty
          modalityConflict: uncertainty.modalityConflict
        },
        uncertaintyExplanation: uncertainty.explanation
      });
    }
    
    return alignmentsWithUncertainty;
  }

  /**
   * Detect and resolve alignment conflicts using stakeholder preferences
   */
  async detectAndResolveConflicts(alignments) {
    const conflicts = this.detectAlignmentConflicts(alignments);
    
    if (conflicts.length === 0) {
      return alignments;
    }
    
    const resolvedAlignments = [];
    const conflictGroups = this.groupConflicts(conflicts);
    
    for (const group of conflictGroups) {
      const resolution = await this.conflictResolver.resolve(group, {
        stakeholderPreferences: this.stakeholderPreferences,
        domainKnowledge: this.options.domainKnowledge,
        usagePatterns: this.options.usagePatterns
      });
      
      resolvedAlignments.push(...resolution.resolvedAlignments);
    }
    
    // Add non-conflicting alignments
    const nonConflicting = alignments.filter(a => 
      !conflicts.some(c => c.alignments.includes(a))
    );
    
    return [...resolvedAlignments, ...nonConflicting];
  }

  /**
   * Adapt alignment based on usage patterns and feedback
   */
  async adaptAlignmentToUsage(alignments, usagePatterns = []) {
    if (!usagePatterns.length) {
      return alignments;
    }
    
    const adaptedAlignments = [];
    
    for (const alignment of alignments) {
      // Find relevant usage patterns
      const relevantPatterns = usagePatterns.filter(pattern =>
        pattern.involves(alignment.source) || pattern.involves(alignment.target)
      );
      
      if (relevantPatterns.length > 0) {
        // Adjust confidence based on usage patterns
        const usageBoost = this.calculateUsageBoost(relevantPatterns);
        const adaptedConfidence = Math.min(1.0, alignment.confidence * (1 + usageBoost));
        
        adaptedAlignments.push({
          ...alignment,
          confidence: adaptedConfidence,
          usageAdaptation: {
            originalConfidence: alignment.confidence,
            usageBoost,
            relevantPatterns: relevantPatterns.length
          }
        });
      } else {
        adaptedAlignments.push(alignment);
      }
    }
    
    return adaptedAlignments;
  }

  /**
   * Generate alignment explanations for transparency
   */
  generateAlignmentExplanations(alignments) {
    return alignments.map(alignment => ({
      ...alignment,
      explanation: {
        whyAligned: this.generateWhyAlignedExplanation(alignment),
        confidenceFactors: this.explainConfidenceFactors(alignment),
        uncertaintyFactors: this.explainUncertaintyFactors(alignment),
        alternativeOptions: this.findAlternativeAlignments(alignment, alignments),
        recommendations: this.generateAlignmentRecommendations(alignment)
      }
    }));
  }

  /**
   * Validate alignment quality and consistency
   */
  async validateAlignment(alignments, sourceOntology, targetOntology) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      quality: {},
      consistency: {}
    };
    
    // Check alignment completeness
    validation.quality.completeness = this.calculateAlignmentCompleteness(alignments, sourceOntology, targetOntology);
    
    // Check alignment precision and recall
    validation.quality.precision = this.calculateAlignmentPrecision(alignments);
    validation.quality.recall = this.calculateAlignmentRecall(alignments, sourceOntology, targetOntology);
    
    // Check logical consistency
    validation.consistency = await this.checkAlignmentConsistency(alignments, sourceOntology, targetOntology);
    
    // Check for common alignment errors
    const commonErrors = this.checkCommonAlignmentErrors(alignments);
    validation.errors.push(...commonErrors.errors);
    validation.warnings.push(...commonErrors.warnings);
    
    validation.isValid = validation.errors.length === 0;
    
    return validation;
  }

  // Utility methods

  generateAlignmentId(sourceOntology, targetOntology) {
    const sourceId = sourceOntology.uri || JSON.stringify(sourceOntology);
    const targetId = targetOntology.uri || JSON.stringify(targetOntology);
    return createHash('sha256').update(`${sourceId}|${targetId}`).digest('hex').substring(0, 16);
  }

  tokenizeText(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  async generateTextEmbedding(text) {
    // Simplified text embedding - in production use proper NLP models
    const tokens = this.tokenizeText(text);
    const embedding = new Array(300).fill(0);
    
    // Simple hash-based embedding for demonstration
    for (const token of tokens) {
      const hash = createHash('md5').update(token).digest('hex');
      for (let i = 0; i < 300; i++) {
        embedding[i] += parseInt(hash[i % hash.length], 16) / 16.0;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  extractLocalName(uri) {
    const lastHash = uri.lastIndexOf('#');
    const lastSlash = uri.lastIndexOf('/');
    const index = Math.max(lastHash, lastSlash);
    return index >= 0 ? uri.substring(index + 1) : uri;
  }

  calculateModalityAgreement(modalityScores) {
    const scores = Object.values(modalityScores);
    if (scores.length < 2) return 1.0;
    
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    
    return Math.max(0, 1 - Math.sqrt(variance));
  }

  detectAlignmentConflicts(alignments) {
    const conflicts = [];
    const sourceMap = new Map();
    const targetMap = new Map();
    
    // Group alignments by source and target
    for (const alignment of alignments) {
      if (!sourceMap.has(alignment.source)) {
        sourceMap.set(alignment.source, []);
      }
      sourceMap.get(alignment.source).push(alignment);
      
      if (!targetMap.has(alignment.target)) {
        targetMap.set(alignment.target, []);
      }
      targetMap.get(alignment.target).push(alignment);
    }
    
    // Detect 1:n conflicts (one source to multiple targets)
    for (const [source, alignments] of sourceMap) {
      if (alignments.length > 1) {
        conflicts.push({
          type: 'one_to_many',
          source,
          alignments,
          severity: this.calculateConflictSeverity(alignments)
        });
      }
    }
    
    // Detect n:1 conflicts (multiple sources to one target)
    for (const [target, alignments] of targetMap) {
      if (alignments.length > 1) {
        conflicts.push({
          type: 'many_to_one',
          target,
          alignments,
          severity: this.calculateConflictSeverity(alignments)
        });
      }
    }
    
    return conflicts;
  }
}

// Supporting classes

class TextualAlignmentProcessor {
  async align(sourceFeatures, targetFeatures, config) {
    const alignments = [];
    
    for (const [sourceEntity, sourceData] of sourceFeatures) {
      for (const [targetEntity, targetData] of targetFeatures) {
        const similarity = this.calculateTextualSimilarity(sourceData, targetData);
        
        if (similarity > 0.3) { // Threshold
          alignments.push({
            source: sourceEntity,
            target: targetEntity,
            confidence: similarity,
            evidence: {
              labelSimilarity: this.calculateLabelSimilarity(sourceData, targetData),
              commentSimilarity: this.calculateCommentSimilarity(sourceData, targetData),
              uriSimilarity: this.calculateUriSimilarity(sourceData, targetData)
            }
          });
        }
      }
    }
    
    return alignments;
  }
  
  calculateTextualSimilarity(sourceData, targetData) {
    // Combine different textual similarity metrics
    let similarity = 0;
    let count = 0;
    
    if (sourceData.label && targetData.label) {
      similarity += this.calculateStringSimilarity(sourceData.label, targetData.label);
      count++;
    }
    
    if (sourceData.comment && targetData.comment) {
      similarity += this.calculateStringSimilarity(sourceData.comment, targetData.comment);
      count++;
    }
    
    if (sourceData.localName && targetData.localName) {
      similarity += this.calculateStringSimilarity(sourceData.localName, targetData.localName);
      count++;
    }
    
    return count > 0 ? similarity / count : 0;
  }
  
  calculateStringSimilarity(str1, str2) {
    // Simple Jaccard similarity for demonstration
    const set1 = new Set(str1.toLowerCase().split(''));
    const set2 = new Set(str2.toLowerCase().split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }
  
  calculateLabelSimilarity(sourceData, targetData) {
    if (!sourceData.label || !targetData.label) return 0;
    return this.calculateStringSimilarity(sourceData.label, targetData.label);
  }
  
  calculateCommentSimilarity(sourceData, targetData) {
    if (!sourceData.comment || !targetData.comment) return 0;
    return this.calculateStringSimilarity(sourceData.comment, targetData.comment);
  }
  
  calculateUriSimilarity(sourceData, targetData) {
    if (!sourceData.localName || !targetData.localName) return 0;
    return this.calculateStringSimilarity(sourceData.localName, targetData.localName);
  }
}

class StructuralAlignmentProcessor {
  async align(sourceFeatures, targetFeatures, config) {
    const alignments = [];
    
    for (const [sourceEntity, sourceData] of sourceFeatures) {
      for (const [targetEntity, targetData] of targetFeatures) {
        const similarity = this.calculateStructuralSimilarity(sourceData, targetData);
        
        if (similarity > 0.3) {
          alignments.push({
            source: sourceEntity,
            target: targetEntity,
            confidence: similarity,
            evidence: {
              degreesimilarity: this.calculateDegreeSimilarity(sourceData, targetData),
              hierarchySimilarity: this.calculateHierarchySimilarity(sourceData, targetData),
              patternSimilarity: this.calculatePatternSimilarity(sourceData, targetData)
            }
          });
        }
      }
    }
    
    return alignments;
  }
  
  calculateStructuralSimilarity(sourceData, targetData) {
    let similarity = 0;
    let count = 0;
    
    // Compare degree similarity
    const degreeSimJaccard = this.calculateDegreeSimilarity(sourceData, targetData);
    similarity += degreeSimJaccard;
    count++;
    
    // Compare hierarchy position
    const hierarchySim = this.calculateHierarchySimilarity(sourceData, targetData);
    similarity += hierarchySim;
    count++;
    
    // Compare pattern signatures
    const patternSim = this.calculatePatternSimilarity(sourceData, targetData);
    similarity += patternSim;
    count++;
    
    return count > 0 ? similarity / count : 0;
  }
  
  calculateDegreeSimilarity(sourceData, targetData) {
    const sourceDegree = (sourceData.incomingDegree || 0) + (sourceData.outgoingDegree || 0);
    const targetDegree = (targetData.incomingDegree || 0) + (targetData.outgoingDegree || 0);
    
    if (sourceDegree === 0 && targetDegree === 0) return 1;
    
    const maxDegree = Math.max(sourceDegree, targetDegree);
    const minDegree = Math.min(sourceDegree, targetDegree);
    
    return minDegree / maxDegree;
  }
  
  calculateHierarchySimilarity(sourceData, targetData) {
    const sourceDepth = sourceData.depth || 0;
    const targetDepth = targetData.depth || 0;
    
    if (sourceDepth === 0 && targetDepth === 0) return 1;
    
    const maxDepth = Math.max(sourceDepth, targetDepth);
    const minDepth = Math.min(sourceDepth, targetDepth);
    
    return minDepth / maxDepth;
  }
  
  calculatePatternSimilarity(sourceData, targetData) {
    // Compare pattern signatures if available
    if (!sourceData.patternSignature || !targetData.patternSignature) return 0;
    
    // Simple pattern signature comparison
    const sourcePattern = sourceData.patternSignature;
    const targetPattern = targetData.patternSignature;
    
    // Calculate similarity between pattern signatures
    return this.calculateVectorSimilarity(sourcePattern, targetPattern);
  }
  
  calculateVectorSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

class SemanticAlignmentProcessor {
  async align(sourceFeatures, targetFeatures, config) {
    const alignments = [];
    
    for (const [sourceEntity, sourceData] of sourceFeatures) {
      for (const [targetEntity, targetData] of targetFeatures) {
        const similarity = this.calculateSemanticSimilarity(sourceData, targetData);
        
        if (similarity > 0.3) {
          alignments.push({
            source: sourceEntity,
            target: targetEntity,
            confidence: similarity,
            evidence: {
              embeddingSimilarity: this.calculateEmbeddingSimilarity(sourceData, targetData),
              contextSimilarity: this.calculateContextSimilarity(sourceData, targetData),
              roleSimilarity: this.calculateRoleSimilarity(sourceData, targetData)
            }
          });
        }
      }
    }
    
    return alignments;
  }
  
  calculateSemanticSimilarity(sourceData, targetData) {
    let similarity = 0;
    let count = 0;
    
    // Context embedding similarity
    if (sourceData.contextEmbedding && targetData.contextEmbedding) {
      similarity += this.calculateEmbeddingSimilarity(sourceData, targetData);
      count++;
    }
    
    // Semantic role similarity
    if (sourceData.semanticRole && targetData.semanticRole) {
      similarity += this.calculateRoleSimilarity(sourceData, targetData);
      count++;
    }
    
    // Domain context similarity
    if (sourceData.domainContext && targetData.domainContext) {
      similarity += this.calculateContextSimilarity(sourceData, targetData);
      count++;
    }
    
    return count > 0 ? similarity / count : 0;
  }
  
  calculateEmbeddingSimilarity(sourceData, targetData) {
    if (!sourceData.contextEmbedding || !targetData.contextEmbedding) return 0;
    
    // Cosine similarity between embeddings
    return this.calculateCosineSimilarity(sourceData.contextEmbedding, targetData.contextEmbedding);
  }
  
  calculateContextSimilarity(sourceData, targetData) {
    if (!sourceData.domainContext || !targetData.domainContext) return 0;
    
    // Compare domain contexts
    const sourceContext = new Set(sourceData.domainContext);
    const targetContext = new Set(targetData.domainContext);
    
    const intersection = new Set([...sourceContext].filter(x => targetContext.has(x)));
    const union = new Set([...sourceContext, ...targetContext]);
    
    return intersection.size / union.size;
  }
  
  calculateRoleSimilarity(sourceData, targetData) {
    if (!sourceData.semanticRole || !targetData.semanticRole) return 0;
    
    return sourceData.semanticRole === targetData.semanticRole ? 1.0 : 0.0;
  }
  
  calculateCosineSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

class AlignmentUncertaintyQuantifier {
  async quantify(alignment) {
    const epistemic = this.calculateEpistemicUncertainty(alignment);
    const aleatoric = this.calculateAleatoricUncertainty(alignment);
    const modalityConflict = this.calculateModalityConflictUncertainty(alignment);
    
    const total = (epistemic + aleatoric + modalityConflict) / 3;
    
    return {
      total,
      epistemic,
      aleatoric,
      modalityConflict,
      explanation: this.generateUncertaintyExplanation(epistemic, aleatoric, modalityConflict)
    };
  }
  
  calculateEpistemicUncertainty(alignment) {
    // Model uncertainty - how confident we are in our alignment model
    const modalityCount = Object.keys(alignment.modalityScores || {}).length;
    const maxModalityCount = 3; // textual, structural, semantic
    
    // Higher uncertainty if fewer modalities contribute
    return 1 - (modalityCount / maxModalityCount);
  }
  
  calculateAleatoricUncertainty(alignment) {
    // Data uncertainty - inherent uncertainty in the data
    const modalityAgreement = alignment.modalityAgreement || 0;
    
    // Higher uncertainty if modalities disagree
    return 1 - modalityAgreement;
  }
  
  calculateModalityConflictUncertainty(alignment) {
    const scores = Object.values(alignment.modalityScores || {});
    if (scores.length < 2) return 0;
    
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // Higher uncertainty if there's a large spread in scores
    return maxScore - minScore;
  }
  
  generateUncertaintyExplanation(epistemic, aleatoric, modalityConflict) {
    const explanations = [];
    
    if (epistemic > 0.5) {
      explanations.push("Limited modality coverage reduces model confidence");
    }
    
    if (aleatoric > 0.5) {
      explanations.push("Low agreement between different alignment approaches");
    }
    
    if (modalityConflict > 0.5) {
      explanations.push("Significant disagreement between textual, structural, and semantic alignment");
    }
    
    return explanations.length > 0 ? explanations : ["Low uncertainty alignment"];
  }
}

class AlignmentConflictResolver {
  constructor(strategy = 'stakeholder_preference') {
    this.strategy = strategy;
  }
  
  async resolve(conflictGroup, context) {
    switch (this.strategy) {
      case 'stakeholder_preference':
        return this.resolveByStakeholderPreference(conflictGroup, context);
      case 'highest_confidence':
        return this.resolveByHighestConfidence(conflictGroup);
      case 'majority_vote':
        return this.resolveByMajorityVote(conflictGroup);
      case 'domain_knowledge':
        return this.resolveByDomainKnowledge(conflictGroup, context);
      default:
        return this.resolveByHighestConfidence(conflictGroup);
    }
  }
  
  resolveByStakeholderPreference(conflictGroup, context) {
    const preferences = context.stakeholderPreferences || new Map();
    const resolvedAlignments = [];
    
    // Sort alignments by stakeholder preference scores
    const sortedAlignments = conflictGroup.alignments.sort((a, b) => {
      const scoreA = this.getStakeholderScore(a, preferences);
      const scoreB = this.getStakeholderScore(b, preferences);
      return scoreB - scoreA;
    });
    
    // Select the top-preferred alignment
    if (sortedAlignments.length > 0) {
      resolvedAlignments.push({
        ...sortedAlignments[0],
        resolutionMethod: 'stakeholder_preference',
        resolutionConfidence: this.getStakeholderScore(sortedAlignments[0], preferences)
      });
    }
    
    return {
      resolvedAlignments,
      conflictResolution: {
        method: 'stakeholder_preference',
        originalCount: conflictGroup.alignments.length,
        resolvedCount: resolvedAlignments.length
      }
    };
  }
  
  resolveByHighestConfidence(conflictGroup) {
    // Simply select the alignment with highest confidence
    const bestAlignment = conflictGroup.alignments.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      resolvedAlignments: [{
        ...bestAlignment,
        resolutionMethod: 'highest_confidence',
        resolutionConfidence: bestAlignment.confidence
      }],
      conflictResolution: {
        method: 'highest_confidence',
        originalCount: conflictGroup.alignments.length,
        resolvedCount: 1
      }
    };
  }
  
  getStakeholderScore(alignment, preferences) {
    // Calculate score based on stakeholder preferences
    let score = alignment.confidence; // Base score
    
    // Apply preference multipliers
    for (const [preferenceKey, multiplier] of preferences) {
      if (this.alignmentMatchesPreference(alignment, preferenceKey)) {
        score *= multiplier;
      }
    }
    
    return score;
  }
  
  alignmentMatchesPreference(alignment, preferenceKey) {
    // Check if alignment matches a specific preference
    return alignment.source.includes(preferenceKey) || 
           alignment.target.includes(preferenceKey);
  }
}

export default MultiModalAlignmentEngine;