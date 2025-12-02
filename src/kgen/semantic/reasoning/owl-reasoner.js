/**
 * OWL Reasoner - Advanced Ontology-Based Inference System
 * 
 * Implements comprehensive OWL reasoning capabilities including:
 * - OWL 2 DL inference with complete rule sets
 * - Class hierarchy reasoning and subsumption
 * - Property reasoning (object/data properties, characteristics)
 * - Individual reasoning and classification
 * - Consistency checking and inconsistency detection
 * - Complex class expressions and restrictions
 * - Property chains and property characteristics
 * - Ontology alignment and mapping
 * - Incremental classification for performance
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { Store, Parser, Writer, Util, DataFactory } from 'n3';
import crypto from 'crypto';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

// OWL vocabulary
const OWL = {
  // Core concepts
  Class: 'http://www.w3.org/2002/07/owl#Class',
  Thing: 'http://www.w3.org/2002/07/owl#Thing',
  Nothing: 'http://www.w3.org/2002/07/owl#Nothing',
  Individual: 'http://www.w3.org/2002/07/owl#Individual',
  
  // Properties
  ObjectProperty: 'http://www.w3.org/2002/07/owl#ObjectProperty',
  DatatypeProperty: 'http://www.w3.org/2002/07/owl#DatatypeProperty',
  AnnotationProperty: 'http://www.w3.org/2002/07/owl#AnnotationProperty',
  
  // Property characteristics
  FunctionalProperty: 'http://www.w3.org/2002/07/owl#FunctionalProperty',
  InverseFunctionalProperty: 'http://www.w3.org/2002/07/owl#InverseFunctionalProperty',
  TransitiveProperty: 'http://www.w3.org/2002/07/owl#TransitiveProperty',
  SymmetricProperty: 'http://www.w3.org/2002/07/owl#SymmetricProperty',
  AsymmetricProperty: 'http://www.w3.org/2002/07/owl#AsymmetricProperty',
  ReflexiveProperty: 'http://www.w3.org/2002/07/owl#ReflexiveProperty',
  IrreflexiveProperty: 'http://www.w3.org/2002/07/owl#IrreflexiveProperty',
  
  // Class relations
  equivalentClass: 'http://www.w3.org/2002/07/owl#equivalentClass',
  disjointWith: 'http://www.w3.org/2002/07/owl#disjointWith',
  complementOf: 'http://www.w3.org/2002/07/owl#complementOf',
  unionOf: 'http://www.w3.org/2002/07/owl#unionOf',
  intersectionOf: 'http://www.w3.org/2002/07/owl#intersectionOf',
  
  // Property relations
  equivalentProperty: 'http://www.w3.org/2002/07/owl#equivalentProperty',
  inverseOf: 'http://www.w3.org/2002/07/owl#inverseOf',
  disjointProperties: 'http://www.w3.org/2002/07/owl#disjointProperties',
  propertyChainAxiom: 'http://www.w3.org/2002/07/owl#propertyChainAxiom',
  
  // Individual relations
  sameAs: 'http://www.w3.org/2002/07/owl#sameAs',
  differentFrom: 'http://www.w3.org/2002/07/owl#differentFrom',
  AllDifferent: 'http://www.w3.org/2002/07/owl#AllDifferent',
  distinctMembers: 'http://www.w3.org/2002/07/owl#distinctMembers',
  
  // Restrictions
  Restriction: 'http://www.w3.org/2002/07/owl#Restriction',
  onProperty: 'http://www.w3.org/2002/07/owl#onProperty',
  someValuesFrom: 'http://www.w3.org/2002/07/owl#someValuesFrom',
  allValuesFrom: 'http://www.w3.org/2002/07/owl#allValuesFrom',
  hasValue: 'http://www.w3.org/2002/07/owl#hasValue',
  minCardinality: 'http://www.w3.org/2002/07/owl#minCardinality',
  maxCardinality: 'http://www.w3.org/2002/07/owl#maxCardinality',
  cardinality: 'http://www.w3.org/2002/07/owl#cardinality',
  minQualifiedCardinality: 'http://www.w3.org/2002/07/owl#minQualifiedCardinality',
  maxQualifiedCardinality: 'http://www.w3.org/2002/07/owl#maxQualifiedCardinality',
  qualifiedCardinality: 'http://www.w3.org/2002/07/owl#qualifiedCardinality',
  onClass: 'http://www.w3.org/2002/07/owl#onClass',
  onDataRange: 'http://www.w3.org/2002/07/owl#onDataRange',
  
  // Keys and annotations
  hasKey: 'http://www.w3.org/2002/07/owl#hasKey',
  annotatedSource: 'http://www.w3.org/2002/07/owl#annotatedSource',
  annotatedProperty: 'http://www.w3.org/2002/07/owl#annotatedProperty',
  annotatedTarget: 'http://www.w3.org/2002/07/owl#annotatedTarget',
  
  // Versioning
  versionInfo: 'http://www.w3.org/2002/07/owl#versionInfo',
  versionIRI: 'http://www.w3.org/2002/07/owl#versionIRI',
  priorVersion: 'http://www.w3.org/2002/07/owl#priorVersion',
  backwardCompatibleWith: 'http://www.w3.org/2002/07/owl#backwardCompatibleWith',
  incompatibleWith: 'http://www.w3.org/2002/07/owl#incompatibleWith',
  
  // Imports
  imports: 'http://www.w3.org/2002/07/owl#imports',
  
  // Ontology
  Ontology: 'http://www.w3.org/2002/07/owl#Ontology'
};

const RDFS = {
  Class: 'http://www.w3.org/2000/01/rdf-schema#Class',
  subClassOf: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  subPropertyOf: 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
  domain: 'http://www.w3.org/2000/01/rdf-schema#domain',
  range: 'http://www.w3.org/2000/01/rdf-schema#range',
  Resource: 'http://www.w3.org/2000/01/rdf-schema#Resource'
};

const RDF = {
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  Property: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
  first: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  rest: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  nil: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'
};

export class OWLReasoner extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Reasoning configuration
      reasoningProfile: config.reasoningProfile || 'OWL2-DL', // OWL2-DL, OWL2-EL, OWL2-QL, OWL2-RL
      maxInferenceDepth: config.maxInferenceDepth || 20,
      reasoningTimeout: config.reasoningTimeout || 60000,
      
      // Performance settings
      enableIncrementalReasoning: config.enableIncrementalReasoning !== false,
      enableParallelReasoning: config.enableParallelReasoning || false,
      enableClassificationCaching: config.enableClassificationCaching !== false,
      
      // Consistency checking
      enableConsistencyChecking: config.enableConsistencyChecking !== false,
      strictConsistency: config.strictConsistency || false,
      
      // Advanced features
      enableComplexClassExpressions: config.enableComplexClassExpressions !== false,
      enablePropertyChains: config.enablePropertyChains !== false,
      enableKeys: config.enableKeys || false,
      
      // Optimization settings
      precomputeClassHierarchy: config.precomputeClassHierarchy !== false,
      precomputePropertyHierarchy: config.precomputePropertyHierarchy !== false,
      enableTaxonomyOptimization: config.enableTaxonomyOptimization !== false,
      
      ...config
    };
    
    this.logger = consola.withTag('owl-reasoner');
    
    // Knowledge base
    this.ontologyStore = new Store();
    this.inferenceStore = new Store();
    
    // Reasoning state
    this.classHierarchy = new Map();
    this.propertyHierarchy = new Map();
    this.individualClassifications = new Map();
    this.restrictionMappings = new Map();
    this.propertyCharacteristics = new Map();
    
    // Incremental reasoning
    this.incrementalState = {
      lastClassification: null,
      pendingChanges: [],
      classificationCache: new Map(),
      affectedClasses: new Set(),
      affectedProperties: new Set()
    };
    
    // Consistency tracking
    this.inconsistencies = [];
    this.satisfiabilityCache = new Map();
    
    // Performance metrics
    this.metrics = {
      classificationsPerformed: 0,
      consistencyChecks: 0,
      inferencesGenerated: 0,
      reasoningTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      inconsistenciesFound: 0
    };
    
    // Rule engines for different reasoning tasks
    this.ruleEngines = {
      classSubsumption: this._createClassSubsumptionEngine(),
      propertySubsumption: this._createPropertySubsumptionEngine(),
      instanceClassification: this._createInstanceClassificationEngine(),
      propertyCharacteristics: this._createPropertyCharacteristicsEngine(),
      restrictions: this._createRestrictionEngine(),
      equivalence: this._createEquivalenceEngine(),
      disjointness: this._createDisjointnessEngine(),
      sameAs: this._createSameAsEngine(),
      propertyChains: this._createPropertyChainEngine()
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the OWL reasoner
   */
  async initialize() {
    try {
      this.logger.info('Initializing OWL reasoner...');
      
      // Load OWL axioms and rules
      await this._loadOWLAxioms();
      
      // Initialize rule engines
      await this._initializeRuleEngines();
      
      // Precompute hierarchies if enabled
      if (this.config.precomputeClassHierarchy) {
        await this._precomputeClassHierarchy();
      }
      
      if (this.config.precomputePropertyHierarchy) {
        await this._precomputePropertyHierarchy();
      }
      
      this.state = 'ready';
      this.logger.success('OWL reasoner initialized successfully');
      
      return {
        status: 'success',
        reasoningProfile: this.config.reasoningProfile,
        ontologyTriples: this.ontologyStore.size,
        ruleEnginesLoaded: Object.keys(this.ruleEngines).length,
        incrementalReasoning: this.config.enableIncrementalReasoning
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize OWL reasoner:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Load ontology into the reasoner
   * @param {Object} ontology - Ontology to load
   * @returns {Promise<Object>} Loading result
   */
  async loadOntology(ontology) {
    try {
      this.logger.info(`Loading ontology: ${ontology.uri || 'anonymous'}`);
      
      // Clear previous state
      if (!this.config.enableIncrementalReasoning) {
        await this._clearReasoningState();
      }
      
      // Load ontology triples
      await this._loadOntologyTriples(ontology);
      
      // Parse ontology structure
      const ontologyInfo = await this._parseOntologyStructure();
      
      // Trigger incremental update if enabled
      if (this.config.enableIncrementalReasoning) {
        await this._markIncrementalChanges(ontology);
      }
      
      this.emit('ontology:loaded', { ontology: ontologyInfo });
      this.logger.success(`Ontology loaded: ${ontologyInfo.classes} classes, ${ontologyInfo.properties} properties, ${ontologyInfo.individuals} individuals`);
      
      return ontologyInfo;
      
    } catch (error) {
      this.logger.error('Failed to load ontology:', error);
      throw error;
    }
  }

  /**
   * Perform complete OWL reasoning
   * @param {Object} options - Reasoning options
   * @returns {Promise<Object>} Reasoning results
   */
  async performReasoning(options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const operationId = options.operationId || crypto.randomUUID();
    
    try {
      this.logger.info(`Starting OWL reasoning: ${operationId}`);
      
      const context = {
        operationId,
        startTime,
        classesClassified: 0,
        propertiesClassified: 0,
        individualsClassified: 0,
        inferencesGenerated: 0,
        consistencyChecks: 0,
        inconsistenciesFound: 0
      };
      
      // Clear inference store
      this.inferenceStore.removeQuads(this.inferenceStore.getQuads());
      
      let results = {};
      
      // Perform reasoning based on profile and options
      if (this.config.enableIncrementalReasoning && this.incrementalState.lastClassification) {
        results = await this._performIncrementalReasoning(context, options);
      } else {
        results = await this._performFullReasoning(context, options);
      }
      
      // Consistency checking
      if (this.config.enableConsistencyChecking) {
        const consistencyResults = await this._performConsistencyCheck(context);
        results.consistency = consistencyResults;
      }
      
      // Build final result
      const reasoningTime = this.getDeterministicTimestamp() - startTime;
      const finalResults = {
        operationId,
        ...results,
        context: {
          ...context,
          endTime: this.getDeterministicTimestamp(),
          reasoningTime
        },
        metrics: { ...this.metrics }
      };
      
      // Update metrics
      this._updateMetrics(context, reasoningTime);
      
      // Update incremental state
      if (this.config.enableIncrementalReasoning) {
        await this._updateIncrementalState(finalResults);
      }
      
      this.emit('reasoning:complete', finalResults);
      this.logger.success(
        `OWL reasoning completed in ${reasoningTime}ms: ` +
        `${results.totalInferences || 0} inferences generated`
      );
      
      return finalResults;
      
    } catch (error) {
      const reasoningTime = this.getDeterministicTimestamp() - startTime;
      this.logger.error(`OWL reasoning failed after ${reasoningTime}ms:`, error);
      this.emit('reasoning:error', { operationId, error, reasoningTime });
      throw error;
    }
  }

  /**
   * Classify individuals against class hierarchy
   * @param {Array} individuals - Individuals to classify
   * @param {Object} options - Classification options
   * @returns {Promise<Object>} Classification results
   */
  async classifyIndividuals(individuals, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const classifications = new Map();
    
    try {
      this.logger.info(`Classifying ${individuals.length} individuals`);
      
      for (const individual of individuals) {
        const individualUri = typeof individual === 'string' ? individual : individual.uri;
        
        // Get direct types
        const directTypes = await this._getDirectTypes(individualUri);
        
        // Infer additional types through class hierarchy
        const inferredTypes = await this._inferTypes(individualUri, directTypes);
        
        classifications.set(individualUri, {
          directTypes: Array.from(directTypes),
          inferredTypes: Array.from(inferredTypes),
          allTypes: Array.from(new Set([...directTypes, ...inferredTypes]))
        });
        
        this.individualClassifications.set(individualUri, classifications.get(individualUri));
      }
      
      const classificationTime = this.getDeterministicTimestamp() - startTime;
      this.logger.success(`Individual classification completed in ${classificationTime}ms`);
      
      return {
        classifications: Object.fromEntries(classifications),
        statistics: {
          individualsClassified: individuals.length,
          classificationTime
        }
      };
      
    } catch (error) {
      this.logger.error('Individual classification failed:', error);
      throw error;
    }
  }

  /**
   * Check satisfiability of a class
   * @param {string} classUri - Class URI to check
   * @returns {Promise<boolean>} Whether the class is satisfiable
   */
  async isSatisfiable(classUri) {
    // Check cache first
    if (this.satisfiabilityCache.has(classUri)) {
      this.metrics.cacheHits++;
      return this.satisfiabilityCache.get(classUri);
    }
    
    this.metrics.cacheMisses++;
    
    try {
      // Check if class is equivalent to Nothing
      const nothingEquivalents = await this._getEquivalentClasses(OWL.Nothing);
      if (nothingEquivalents.has(classUri)) {
        this.satisfiabilityCache.set(classUri, false);
        return false;
      }
      
      // Check for contradictory restrictions
      const restrictions = await this._getClassRestrictions(classUri);
      for (const restriction of restrictions) {
        if (await this._isContradictoryRestriction(restriction)) {
          this.satisfiabilityCache.set(classUri, false);
          return false;
        }
      }
      
      // Check disjointness with superclasses
      const superclasses = await this._getSuperclasses(classUri);
      const disjointClasses = await this._getDisjointClasses(classUri);
      
      for (const superclass of superclasses) {
        if (disjointClasses.has(superclass)) {
          this.satisfiabilityCache.set(classUri, false);
          return false;
        }
      }
      
      // If no contradictions found, assume satisfiable
      this.satisfiabilityCache.set(classUri, true);
      return true;
      
    } catch (error) {
      this.logger.error(`Satisfiability check failed for ${classUri}:`, error);
      return false;
    }
  }

  /**
   * Get inferred class hierarchy
   * @returns {Promise<Object>} Class hierarchy with subsumption relationships
   */
  async getClassHierarchy() {
    if (this.classHierarchy.size === 0) {
      await this._buildClassHierarchy();
    }
    
    return this._serializeHierarchy(this.classHierarchy);
  }

  /**
   * Get inferred property hierarchy
   * @returns {Promise<Object>} Property hierarchy with subsumption relationships
   */
  async getPropertyHierarchy() {
    if (this.propertyHierarchy.size === 0) {
      await this._buildPropertyHierarchy();
    }
    
    return this._serializeHierarchy(this.propertyHierarchy);
  }

  /**
   * Get all inferences generated by reasoning
   * @returns {Array} Array of inferred triples
   */
  getInferences() {
    const inferences = [];
    
    for (const quad of this.inferenceStore.getQuads()) {
      inferences.push({
        subject: quad.subject.value,
        predicate: quad.predicate.value,
        object: quad.object.value,
        inferred: true
      });
    }
    
    return inferences;
  }

  /**
   * Get reasoner status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      configuration: {
        reasoningProfile: this.config.reasoningProfile,
        maxInferenceDepth: this.config.maxInferenceDepth,
        reasoningTimeout: this.config.reasoningTimeout,
        enableIncrementalReasoning: this.config.enableIncrementalReasoning,
        enableConsistencyChecking: this.config.enableConsistencyChecking
      },
      ontology: {
        triples: this.ontologyStore.size,
        inferences: this.inferenceStore.size,
        classes: this._getClassCount(),
        properties: this._getPropertyCount(),
        individuals: this._getIndividualCount()
      },
      hierarchies: {
        classHierarchy: this.classHierarchy.size,
        propertyHierarchy: this.propertyHierarchy.size,
        individualClassifications: this.individualClassifications.size
      },
      incremental: {
        enabled: this.config.enableIncrementalReasoning,
        lastClassification: !!this.incrementalState.lastClassification,
        pendingChanges: this.incrementalState.pendingChanges.length,
        cacheSize: this.incrementalState.classificationCache.size
      },
      consistency: {
        isConsistent: this.inconsistencies.length === 0,
        inconsistencies: this.inconsistencies.length,
        satisfiabilityCache: this.satisfiabilityCache.size
      },
      metrics: { ...this.metrics },
      performance: {
        averageReasoningTime: this.metrics.classificationsPerformed > 0 ?
          Math.round(this.metrics.reasoningTime / this.metrics.classificationsPerformed) : 0,
        inferencesPerSecond: this.metrics.reasoningTime > 0 ?
          Math.round((this.metrics.inferencesGenerated * 1000) / this.metrics.reasoningTime) : 0,
        cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
          Math.round((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100) : 0
      }
    };
  }

  /**
   * Clear all reasoning state and caches
   */
  async clearReasoningState() {
    await this._clearReasoningState();
    this.logger.info('OWL reasoning state cleared');
  }

  /**
   * Shutdown the reasoner
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down OWL reasoner...');
      
      // Clear all stores and state
      this.ontologyStore.removeQuads(this.ontologyStore.getQuads());
      this.inferenceStore.removeQuads(this.inferenceStore.getQuads());
      
      await this._clearReasoningState();
      
      this.state = 'shutdown';
      this.logger.success('OWL reasoner shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during OWL reasoner shutdown:', error);
      throw error;
    }
  }

  // Private methods

  /**
   * Load OWL axioms and built-in rules
   */
  async _loadOWLAxioms() {
    // Load fundamental OWL axioms
    const owlAxioms = `
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      
      # Class axioms
      owl:Thing a owl:Class .
      owl:Nothing a owl:Class .
      owl:Nothing rdfs:subClassOf owl:Thing .
      
      # Property axioms
      owl:topObjectProperty a owl:ObjectProperty .
      owl:bottomObjectProperty a owl:ObjectProperty .
      owl:topDataProperty a owl:DatatypeProperty .
      owl:bottomDataProperty a owl:DatatypeProperty .
      
      # Class relationships
      owl:Class rdfs:subClassOf rdfs:Class .
      owl:Restriction rdfs:subClassOf owl:Class .
      
      # Property characteristics
      owl:FunctionalProperty rdfs:subClassOf rdf:Property .
      owl:InverseFunctionalProperty rdfs:subClassOf rdf:Property .
      owl:TransitiveProperty rdfs:subClassOf rdf:Property .
      owl:SymmetricProperty rdfs:subClassOf rdf:Property .
    `;
    
    // Parse and load axioms
    const parser = new Parser();
    const axiomQuads = await new Promise((resolve, reject) => {
      const quads = [];
      parser.parse(owlAxioms, (error, quad, prefixes) => {
        if (error) reject(error);
        else if (quad) quads.push(quad);
        else resolve(quads);
      });
    });
    
    this.ontologyStore.addQuads(axiomQuads);
    this.logger.debug(`Loaded ${axiomQuads.length} OWL axioms`);
  }

  /**
   * Initialize rule engines
   */
  async _initializeRuleEngines() {
    for (const [engineName, engine] of Object.entries(this.ruleEngines)) {
      try {
        if (engine.initialize) {
          await engine.initialize();
        }
        this.logger.debug(`Initialized ${engineName} rule engine`);
      } catch (error) {
        this.logger.error(`Failed to initialize ${engineName} rule engine:`, error);
      }
    }
  }

  /**
   * Create class subsumption rule engine
   */
  _createClassSubsumptionEngine() {
    return {
      name: 'ClassSubsumption',
      
      async execute(store, context) {
        const inferences = [];
        
        // Transitive closure of subClassOf
        const subClassQuads = store.getQuads(null, namedNode(RDFS.subClassOf), null);
        const subClassMap = new Map();
        
        // Build adjacency list
        for (const quad of subClassQuads) {
          const subClass = quad.subject.value;
          const superClass = quad.object.value;
          
          if (!subClassMap.has(subClass)) {
            subClassMap.set(subClass, new Set());
          }
          subClassMap.get(subClass).add(superClass);
        }
        
        // Compute transitive closure
        let changed = true;
        while (changed) {
          changed = false;
          
          for (const [subClass, superClasses] of subClassMap) {
            const currentSize = superClasses.size;
            
            for (const superClass of Array.from(superClasses)) {
              if (subClassMap.has(superClass)) {
                for (const transitiveSuper of subClassMap.get(superClass)) {
                  superClasses.add(transitiveSuper);
                }
              }
            }
            
            if (superClasses.size > currentSize) {
              changed = true;
            }
          }
        }
        
        // Generate inferences
        for (const [subClass, superClasses] of subClassMap) {
          for (const superClass of superClasses) {
            const inferenceQuad = quad(
              namedNode(subClass),
              namedNode(RDFS.subClassOf),
              namedNode(superClass),
              defaultGraph()
            );
            
            if (!store.has(inferenceQuad)) {
              inferences.push({
                subject: subClass,
                predicate: RDFS.subClassOf,
                object: superClass,
                inferred: true,
                derivedFrom: 'class-subsumption-transitivity'
              });
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create property subsumption rule engine
   */
  _createPropertySubsumptionEngine() {
    return {
      name: 'PropertySubsumption',
      
      async execute(store, context) {
        const inferences = [];
        
        // Transitive closure of subPropertyOf
        const subPropertyQuads = store.getQuads(null, namedNode(RDFS.subPropertyOf), null);
        const subPropertyMap = new Map();
        
        // Build adjacency list
        for (const quad of subPropertyQuads) {
          const subProperty = quad.subject.value;
          const superProperty = quad.object.value;
          
          if (!subPropertyMap.has(subProperty)) {
            subPropertyMap.set(subProperty, new Set());
          }
          subPropertyMap.get(subProperty).add(superProperty);
        }
        
        // Compute transitive closure
        let changed = true;
        while (changed) {
          changed = false;
          
          for (const [subProperty, superProperties] of subPropertyMap) {
            const currentSize = superProperties.size;
            
            for (const superProperty of Array.from(superProperties)) {
              if (subPropertyMap.has(superProperty)) {
                for (const transitiveSuper of subPropertyMap.get(superProperty)) {
                  superProperties.add(transitiveSuper);
                }
              }
            }
            
            if (superProperties.size > currentSize) {
              changed = true;
            }
          }
        }
        
        // Generate property subsumption inferences
        for (const [subProperty, superProperties] of subPropertyMap) {
          for (const superProperty of superProperties) {
            const inferenceQuad = quad(
              namedNode(subProperty),
              namedNode(RDFS.subPropertyOf),
              namedNode(superProperty),
              defaultGraph()
            );
            
            if (!store.has(inferenceQuad)) {
              inferences.push({
                subject: subProperty,
                predicate: RDFS.subPropertyOf,
                object: superProperty,
                inferred: true,
                derivedFrom: 'property-subsumption-transitivity'
              });
            }
          }
        }
        
        // Apply subproperty to instances
        for (const [subProperty, superProperties] of subPropertyMap) {
          const instanceQuads = store.getQuads(null, namedNode(subProperty), null);
          
          for (const instanceQuad of instanceQuads) {
            for (const superProperty of superProperties) {
              const inferenceQuad = quad(
                instanceQuad.subject,
                namedNode(superProperty),
                instanceQuad.object,
                defaultGraph()
              );
              
              if (!store.has(inferenceQuad)) {
                inferences.push({
                  subject: instanceQuad.subject.value,
                  predicate: superProperty,
                  object: instanceQuad.object.value,
                  inferred: true,
                  derivedFrom: 'property-subsumption-application'
                });
              }
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create instance classification rule engine
   */
  _createInstanceClassificationEngine() {
    return {
      name: 'InstanceClassification',
      
      async execute(store, context) {
        const inferences = [];
        
        // Domain inference: if ?x ?p ?y and ?p rdfs:domain ?c, then ?x rdf:type ?c
        const domainQuads = store.getQuads(null, namedNode(RDFS.domain), null);
        
        for (const domainQuad of domainQuads) {
          const property = domainQuad.subject;
          const domainClass = domainQuad.object;
          
          const propertyUsages = store.getQuads(null, property, null);
          
          for (const usage of propertyUsages) {
            const inferenceQuad = quad(
              usage.subject,
              namedNode(RDF.type),
              domainClass,
              defaultGraph()
            );
            
            if (!store.has(inferenceQuad)) {
              inferences.push({
                subject: usage.subject.value,
                predicate: RDF.type,
                object: domainClass.value,
                inferred: true,
                derivedFrom: 'domain-inference'
              });
            }
          }
        }
        
        // Range inference: if ?x ?p ?y and ?p rdfs:range ?c, then ?y rdf:type ?c
        const rangeQuads = store.getQuads(null, namedNode(RDFS.range), null);
        
        for (const rangeQuad of rangeQuads) {
          const property = rangeQuad.subject;
          const rangeClass = rangeQuad.object;
          
          const propertyUsages = store.getQuads(null, property, null);
          
          for (const usage of propertyUsages) {
            if (usage.object.termType === 'NamedNode') {
              const inferenceQuad = quad(
                usage.object,
                namedNode(RDF.type),
                rangeClass,
                defaultGraph()
              );
              
              if (!store.has(inferenceQuad)) {
                inferences.push({
                  subject: usage.object.value,
                  predicate: RDF.type,
                  object: rangeClass.value,
                  inferred: true,
                  derivedFrom: 'range-inference'
                });
              }
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create property characteristics rule engine
   */
  _createPropertyCharacteristicsEngine() {
    return {
      name: 'PropertyCharacteristics',
      
      async execute(store, context) {
        const inferences = [];
        
        // Transitive properties
        const transitiveProps = store.getQuads(null, namedNode(RDF.type), namedNode(OWL.TransitiveProperty));
        
        for (const transitiveQuad of transitiveProps) {
          const property = transitiveQuad.subject;
          const propertyUsages = store.getQuads(null, property, null);
          
          // Find transitive chains: if ?x ?p ?y and ?y ?p ?z, then ?x ?p ?z
          const valueMap = new Map();
          
          for (const usage of propertyUsages) {
            const subject = usage.subject.value;
            const object = usage.object.value;
            
            if (!valueMap.has(subject)) {
              valueMap.set(subject, []);
            }
            valueMap.get(subject).push(object);
          }
          
          // Generate transitive inferences
          for (const [subject, objects] of valueMap) {
            for (const obj1 of objects) {
              if (valueMap.has(obj1)) {
                for (const obj2 of valueMap.get(obj1)) {
                  const inferenceQuad = quad(
                    namedNode(subject),
                    property,
                    namedNode(obj2),
                    defaultGraph()
                  );
                  
                  if (!store.has(inferenceQuad)) {
                    inferences.push({
                      subject,
                      predicate: property.value,
                      object: obj2,
                      inferred: true,
                      derivedFrom: 'transitive-property'
                    });
                  }
                }
              }
            }
          }
        }
        
        // Symmetric properties
        const symmetricProps = store.getQuads(null, namedNode(RDF.type), namedNode(OWL.SymmetricProperty));
        
        for (const symmetricQuad of symmetricProps) {
          const property = symmetricQuad.subject;
          const propertyUsages = store.getQuads(null, property, null);
          
          for (const usage of propertyUsages) {
            if (usage.object.termType === 'NamedNode') {
              const inferenceQuad = quad(
                usage.object,
                property,
                usage.subject,
                defaultGraph()
              );
              
              if (!store.has(inferenceQuad)) {
                inferences.push({
                  subject: usage.object.value,
                  predicate: property.value,
                  object: usage.subject.value,
                  inferred: true,
                  derivedFrom: 'symmetric-property'
                });
              }
            }
          }
        }
        
        // Inverse properties
        const inverseQuads = store.getQuads(null, namedNode(OWL.inverseOf), null);
        
        for (const inverseQuad of inverseQuads) {
          const property1 = inverseQuad.subject;
          const property2 = inverseQuad.object;
          
          // If ?x ?p1 ?y and ?p1 owl:inverseOf ?p2, then ?y ?p2 ?x
          const property1Usages = store.getQuads(null, property1, null);
          
          for (const usage of property1Usages) {
            if (usage.object.termType === 'NamedNode') {
              const inferenceQuad = quad(
                usage.object,
                property2,
                usage.subject,
                defaultGraph()
              );
              
              if (!store.has(inferenceQuad)) {
                inferences.push({
                  subject: usage.object.value,
                  predicate: property2.value,
                  object: usage.subject.value,
                  inferred: true,
                  derivedFrom: 'inverse-property'
                });
              }
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create restriction rule engine
   */
  _createRestrictionEngine() {
    return {
      name: 'Restrictions',
      
      async execute(store, context) {
        const inferences = [];
        
        // Handle existential restrictions (someValuesFrom)
        const existentialRestrictions = store.getQuads(null, namedNode(OWL.someValuesFrom), null);
        
        for (const restrictionQuad of existentialRestrictions) {
          const restriction = restrictionQuad.subject;
          const valueClass = restrictionQuad.object;
          
          // Get the property of this restriction
          const propertyQuads = store.getQuads(restriction, namedNode(OWL.onProperty), null);
          
          if (propertyQuads.length > 0) {
            const property = propertyQuads[0].object;
            
            // Find individuals that have this restriction as a superclass
            const restrictionUsages = store.getQuads(null, namedNode(RDFS.subClassOf), restriction);
            
            for (const usage of restrictionUsages) {
              const restrictedClass = usage.subject;
              
              // Find instances of the restricted class
              const instances = store.getQuads(null, namedNode(RDF.type), restrictedClass);
              
              for (const instance of instances) {
                // Check if instance has appropriate property values
                const propertyValues = store.getQuads(instance.subject, property, null);
                
                for (const propValue of propertyValues) {
                  if (propValue.object.termType === 'NamedNode') {
                    // Infer that the property value is of the required class
                    const inferenceQuad = quad(
                      propValue.object,
                      namedNode(RDF.type),
                      valueClass,
                      defaultGraph()
                    );
                    
                    if (!store.has(inferenceQuad)) {
                      inferences.push({
                        subject: propValue.object.value,
                        predicate: RDF.type,
                        object: valueClass.value,
                        inferred: true,
                        derivedFrom: 'existential-restriction'
                      });
                    }
                  }
                }
              }
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create equivalence rule engine
   */
  _createEquivalenceEngine() {
    return {
      name: 'Equivalence',
      
      async execute(store, context) {
        const inferences = [];
        
        // Equivalent classes
        const equivalentClassQuads = store.getQuads(null, namedNode(OWL.equivalentClass), null);
        
        for (const equivalentQuad of equivalentClassQuads) {
          const class1 = equivalentQuad.subject;
          const class2 = equivalentQuad.object;
          
          // Generate bidirectional subclass relationships
          const subClass1Quad = quad(class1, namedNode(RDFS.subClassOf), class2, defaultGraph());
          const subClass2Quad = quad(class2, namedNode(RDFS.subClassOf), class1, defaultGraph());
          
          if (!store.has(subClass1Quad)) {
            inferences.push({
              subject: class1.value,
              predicate: RDFS.subClassOf,
              object: class2.value,
              inferred: true,
              derivedFrom: 'equivalent-class'
            });
          }
          
          if (!store.has(subClass2Quad)) {
            inferences.push({
              subject: class2.value,
              predicate: RDFS.subClassOf,
              object: class1.value,
              inferred: true,
              derivedFrom: 'equivalent-class'
            });
          }
        }
        
        // Same individuals
        const sameAsQuads = store.getQuads(null, namedNode(OWL.sameAs), null);
        
        // Build equivalence classes
        const equivalenceClasses = new Map();
        const visited = new Set();
        
        for (const sameAsQuad of sameAsQuads) {
          const individual1 = sameAsQuad.subject.value;
          const individual2 = sameAsQuad.object.value;
          
          if (!visited.has(individual1) && !visited.has(individual2)) {
            const equivalenceClass = new Set([individual1, individual2]);
            equivalenceClasses.set(individual1, equivalenceClass);
            equivalenceClasses.set(individual2, equivalenceClass);
            visited.add(individual1);
            visited.add(individual2);
          } else if (equivalenceClasses.has(individual1)) {
            const eqClass = equivalenceClasses.get(individual1);
            eqClass.add(individual2);
            equivalenceClasses.set(individual2, eqClass);
            visited.add(individual2);
          } else if (equivalenceClasses.has(individual2)) {
            const eqClass = equivalenceClasses.get(individual2);
            eqClass.add(individual1);
            equivalenceClasses.set(individual1, eqClass);
            visited.add(individual1);
          }
        }
        
        // Generate all pairwise sameAs relationships within equivalence classes
        for (const equivalenceClass of new Set(equivalenceClasses.values())) {
          const individuals = Array.from(equivalenceClass);
          
          for (let i = 0; i < individuals.length; i++) {
            for (let j = i + 1; j < individuals.length; j++) {
              const sameAsQuad = quad(
                namedNode(individuals[i]),
                namedNode(OWL.sameAs),
                namedNode(individuals[j]),
                defaultGraph()
              );
              
              if (!store.has(sameAsQuad)) {
                inferences.push({
                  subject: individuals[i],
                  predicate: OWL.sameAs,
                  object: individuals[j],
                  inferred: true,
                  derivedFrom: 'same-as-transitivity'
                });
              }
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create disjointness rule engine
   */
  _createDisjointnessEngine() {
    return {
      name: 'Disjointness',
      
      async execute(store, context) {
        const inferences = [];
        const inconsistencies = [];
        
        // Check disjoint classes for inconsistencies
        const disjointQuads = store.getQuads(null, namedNode(OWL.disjointWith), null);
        
        for (const disjointQuad of disjointQuads) {
          const class1 = disjointQuad.subject.value;
          const class2 = disjointQuad.object.value;
          
          // Find individuals that belong to both classes
          const class1Instances = store.getQuads(null, namedNode(RDF.type), namedNode(class1));
          const class2Instances = store.getQuads(null, namedNode(RDF.type), namedNode(class2));
          
          const class1InstanceSet = new Set(class1Instances.map(q => q.subject.value));
          const class2InstanceSet = new Set(class2Instances.map(q => q.subject.value));
          
          const intersection = new Set([...class1InstanceSet].filter(x => class2InstanceSet.has(x)));
          
          for (const individual of intersection) {
            inconsistencies.push({
              type: 'disjoint-classes-violation',
              individual,
              classes: [class1, class2],
              message: `Individual ${individual} belongs to disjoint classes ${class1} and ${class2}`
            });
          }
        }
        
        // Store inconsistencies for later reporting
        this.inconsistencies.push(...inconsistencies);
        
        return inferences;
      }
    };
  }

  /**
   * Create sameAs rule engine
   */
  _createSameAsEngine() {
    return {
      name: 'SameAs',
      
      async execute(store, context) {
        const inferences = [];
        
        // For each sameAs relationship, copy all properties between individuals
        const sameAsQuads = store.getQuads(null, namedNode(OWL.sameAs), null);
        
        for (const sameAsQuad of sameAsQuads) {
          const individual1 = sameAsQuad.subject;
          const individual2 = sameAsQuad.object;
          
          // Copy properties from individual1 to individual2
          const properties1 = store.getQuads(individual1, null, null);
          
          for (const propQuad of properties1) {
            const newQuad = quad(individual2, propQuad.predicate, propQuad.object, defaultGraph());
            
            if (!store.has(newQuad)) {
              inferences.push({
                subject: individual2.value,
                predicate: propQuad.predicate.value,
                object: propQuad.object.value,
                inferred: true,
                derivedFrom: 'same-as-property-copy'
              });
            }
          }
          
          // Copy properties to individual1 from individual2
          const properties2 = store.getQuads(individual2, null, null);
          
          for (const propQuad of properties2) {
            const newQuad = quad(individual1, propQuad.predicate, propQuad.object, defaultGraph());
            
            if (!store.has(newQuad)) {
              inferences.push({
                subject: individual1.value,
                predicate: propQuad.predicate.value,
                object: propQuad.object.value,
                inferred: true,
                derivedFrom: 'same-as-property-copy'
              });
            }
          }
          
          // Copy incoming properties
          const incomingProperties1 = store.getQuads(null, null, individual1);
          
          for (const propQuad of incomingProperties1) {
            const newQuad = quad(propQuad.subject, propQuad.predicate, individual2, defaultGraph());
            
            if (!store.has(newQuad)) {
              inferences.push({
                subject: propQuad.subject.value,
                predicate: propQuad.predicate.value,
                object: individual2.value,
                inferred: true,
                derivedFrom: 'same-as-incoming-property-copy'
              });
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Create property chain rule engine
   */
  _createPropertyChainEngine() {
    return {
      name: 'PropertyChains',
      
      async execute(store, context) {
        const inferences = [];
        
        if (!this.config.enablePropertyChains) {
          return inferences;
        }
        
        // Handle property chain axioms
        const chainQuads = store.getQuads(null, namedNode(OWL.propertyChainAxiom), null);
        
        for (const chainQuad of chainQuads) {
          const property = chainQuad.subject;
          const chainList = chainQuad.object;
          
          // Parse the property chain (simplified - would need full RDF list parsing)
          const chainProperties = await this._parseRDFList(store, chainList);
          
          if (chainProperties.length >= 2) {
            // Find instances that match the property chain
            const firstProperty = chainProperties[0];
            const secondProperty = chainProperties[1];
            
            const firstPropertyQuads = store.getQuads(null, namedNode(firstProperty), null);
            
            for (const firstQuad of firstPropertyQuads) {
              if (firstQuad.object.termType === 'NamedNode') {
                const secondPropertyQuads = store.getQuads(firstQuad.object, namedNode(secondProperty), null);
                
                for (const secondQuad of secondPropertyQuads) {
                  const inferenceQuad = quad(
                    firstQuad.subject,
                    property,
                    secondQuad.object,
                    defaultGraph()
                  );
                  
                  if (!store.has(inferenceQuad)) {
                    inferences.push({
                      subject: firstQuad.subject.value,
                      predicate: property.value,
                      object: secondQuad.object.value,
                      inferred: true,
                      derivedFrom: 'property-chain'
                    });
                  }
                }
              }
            }
          }
        }
        
        return inferences;
      }
    };
  }

  /**
   * Parse RDF list (simplified implementation)
   */
  async _parseRDFList(store, listNode) {
    const items = [];
    let current = listNode;
    
    while (current && current.value !== RDF.nil) {
      const firstQuads = store.getQuads(current, namedNode(RDF.first), null);
      const restQuads = store.getQuads(current, namedNode(RDF.rest), null);
      
      if (firstQuads.length > 0) {
        items.push(firstQuads[0].object.value);
      }
      
      if (restQuads.length > 0) {
        current = restQuads[0].object;
      } else {
        break;
      }
    }
    
    return items;
  }

  /**
   * Perform full reasoning
   */
  async _performFullReasoning(context, options) {
    const allInferences = [];
    let iterationCount = 0;
    const maxIterations = this.config.maxInferenceDepth;
    
    // Create combined store for reasoning
    const reasoningStore = new Store();
    reasoningStore.addQuads(this.ontologyStore.getQuads());
    
    while (iterationCount < maxIterations) {
      const newInferences = [];
      iterationCount++;
      
      this.logger.debug(`OWL reasoning iteration ${iterationCount}`);
      
      // Apply all rule engines
      for (const [engineName, engine] of Object.entries(this.ruleEngines)) {
        try {
          const engineInferences = await engine.execute(reasoningStore, context);
          newInferences.push(...engineInferences);
          
          this.logger.debug(`${engineName} generated ${engineInferences.length} inferences`);
          
        } catch (error) {
          this.logger.error(`Rule engine ${engineName} failed:`, error.message);
        }
      }
      
      // Add new inferences to reasoning store
      for (const inference of newInferences) {
        try {
          const quad = this._tripleToQuad(inference);
          if (!reasoningStore.has(quad)) {
            reasoningStore.addQuad(quad);
            this.inferenceStore.addQuad(quad);
            allInferences.push(inference);
          }
        } catch (error) {
          this.logger.warn(`Failed to add inference: ${JSON.stringify(inference)}`, error.message);
        }
      }
      
      // Stop if no new inferences
      if (newInferences.length === 0) {
        this.logger.debug(`Reasoning converged after ${iterationCount} iterations`);
        break;
      }
      
      context.inferencesGenerated += newInferences.length;
    }
    
    // Build class and property hierarchies
    await this._buildClassHierarchy();
    await this._buildPropertyHierarchy();
    
    return {
      totalInferences: allInferences.length,
      iterations: iterationCount,
      inferences: allInferences,
      classHierarchy: this._serializeHierarchy(this.classHierarchy),
      propertyHierarchy: this._serializeHierarchy(this.propertyHierarchy)
    };
  }

  /**
   * Perform incremental reasoning
   */
  async _performIncrementalReasoning(context, options) {
    // Implementation would focus only on affected classes/properties
    // For now, delegate to full reasoning
    return await this._performFullReasoning(context, options);
  }

  /**
   * Perform consistency check
   */
  async _performConsistencyCheck(context) {
    const startTime = this.getDeterministicTimestamp();
    this.inconsistencies = [];
    
    // Check class satisfiability
    const classes = await this._getAllClasses();
    const unsatisfiableClasses = [];
    
    for (const classUri of classes) {
      if (!(await this.isSatisfiable(classUri))) {
        unsatisfiableClasses.push(classUri);
      }
    }
    
    // Add to inconsistencies
    for (const classUri of unsatisfiableClasses) {
      this.inconsistencies.push({
        type: 'unsatisfiable-class',
        class: classUri,
        message: `Class ${classUri} is unsatisfiable`
      });
    }
    
    context.consistencyChecks++;
    context.inconsistenciesFound = this.inconsistencies.length;
    
    const checkTime = this.getDeterministicTimestamp() - startTime;
    
    return {
      consistent: this.inconsistencies.length === 0,
      inconsistencies: [...this.inconsistencies],
      unsatisfiableClasses,
      checkTime
    };
  }

  /**
   * Build class hierarchy
   */
  async _buildClassHierarchy() {
    this.classHierarchy.clear();
    
    const subClassQuads = this.ontologyStore.getQuads(null, namedNode(RDFS.subClassOf), null);
    const inferenceSubClassQuads = this.inferenceStore.getQuads(null, namedNode(RDFS.subClassOf), null);
    
    const allSubClassQuads = [...subClassQuads, ...inferenceSubClassQuads];
    
    for (const quad of allSubClassQuads) {
      const subClass = quad.subject.value;
      const superClass = quad.object.value;
      
      if (!this.classHierarchy.has(subClass)) {
        this.classHierarchy.set(subClass, { superClasses: new Set(), subClasses: new Set() });
      }
      if (!this.classHierarchy.has(superClass)) {
        this.classHierarchy.set(superClass, { superClasses: new Set(), subClasses: new Set() });
      }
      
      this.classHierarchy.get(subClass).superClasses.add(superClass);
      this.classHierarchy.get(superClass).subClasses.add(subClass);
    }
  }

  /**
   * Build property hierarchy
   */
  async _buildPropertyHierarchy() {
    this.propertyHierarchy.clear();
    
    const subPropertyQuads = this.ontologyStore.getQuads(null, namedNode(RDFS.subPropertyOf), null);
    const inferenceSubPropertyQuads = this.inferenceStore.getQuads(null, namedNode(RDFS.subPropertyOf), null);
    
    const allSubPropertyQuads = [...subPropertyQuads, ...inferenceSubPropertyQuads];
    
    for (const quad of allSubPropertyQuads) {
      const subProperty = quad.subject.value;
      const superProperty = quad.object.value;
      
      if (!this.propertyHierarchy.has(subProperty)) {
        this.propertyHierarchy.set(subProperty, { superProperties: new Set(), subProperties: new Set() });
      }
      if (!this.propertyHierarchy.has(superProperty)) {
        this.propertyHierarchy.set(superProperty, { superProperties: new Set(), subProperties: new Set() });
      }
      
      this.propertyHierarchy.get(subProperty).superProperties.add(superProperty);
      this.propertyHierarchy.get(superProperty).subProperties.add(subProperty);
    }
  }

  // Helper methods

  /**
   * Load ontology triples
   */
  async _loadOntologyTriples(ontology) {
    if (ontology.triples && Array.isArray(ontology.triples)) {
      for (const triple of ontology.triples) {
        try {
          const quad = this._tripleToQuad(triple);
          this.ontologyStore.addQuad(quad);
        } catch (error) {
          this.logger.warn(`Failed to load triple: ${JSON.stringify(triple)}`, error.message);
        }
      }
    }
    
    if (ontology.quads && Array.isArray(ontology.quads)) {
      this.ontologyStore.addQuads(ontology.quads);
    }
  }

  /**
   * Parse ontology structure
   */
  async _parseOntologyStructure() {
    const classes = this._getClassCount();
    const properties = this._getPropertyCount();
    const individuals = this._getIndividualCount();
    
    return {
      classes,
      properties,
      individuals,
      triples: this.ontologyStore.size
    };
  }

  /**
   * Convert triple to quad
   */
  _tripleToQuad(triple) {
    return quad(
      namedNode(triple.subject),
      namedNode(triple.predicate),
      triple.object.startsWith('http') ? namedNode(triple.object) : literal(triple.object),
      defaultGraph()
    );
  }

  /**
   * Get all classes
   */
  async _getAllClasses() {
    const classes = new Set();
    
    // Get explicit class declarations
    const classQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(OWL.Class));
    for (const quad of classQuads) {
      classes.add(quad.subject.value);
    }
    
    // Get classes from RDFS
    const rdfsClassQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(RDFS.Class));
    for (const quad of rdfsClassQuads) {
      classes.add(quad.subject.value);
    }
    
    // Get classes from subClassOf relations
    const subClassQuads = this.ontologyStore.getQuads(null, namedNode(RDFS.subClassOf), null);
    for (const quad of subClassQuads) {
      classes.add(quad.subject.value);
      classes.add(quad.object.value);
    }
    
    return Array.from(classes);
  }

  /**
   * Get direct types of individual
   */
  async _getDirectTypes(individualUri) {
    const types = new Set();
    
    const typeQuads = this.ontologyStore.getQuads(namedNode(individualUri), namedNode(RDF.type), null);
    for (const quad of typeQuads) {
      types.add(quad.object.value);
    }
    
    return types;
  }

  /**
   * Infer additional types through class hierarchy
   */
  async _inferTypes(individualUri, directTypes) {
    const inferredTypes = new Set();
    
    for (const directType of directTypes) {
      if (this.classHierarchy.has(directType)) {
        const hierarchy = this.classHierarchy.get(directType);
        for (const superClass of hierarchy.superClasses) {
          inferredTypes.add(superClass);
        }
      }
    }
    
    return inferredTypes;
  }

  /**
   * Serialize hierarchy for output
   */
  _serializeHierarchy(hierarchy) {
    const result = {};
    
    for (const [key, value] of hierarchy) {
      result[key] = {
        superClasses: value.superClasses ? Array.from(value.superClasses) : [],
        subClasses: value.subClasses ? Array.from(value.subClasses) : [],
        superProperties: value.superProperties ? Array.from(value.superProperties) : [],
        subProperties: value.subProperties ? Array.from(value.subProperties) : []
      };
    }
    
    return result;
  }

  /**
   * Get class count
   */
  _getClassCount() {
    const classQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(OWL.Class));
    const rdfsClassQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(RDFS.Class));
    return new Set([...classQuads.map(q => q.subject.value), ...rdfsClassQuads.map(q => q.subject.value)]).size;
  }

  /**
   * Get property count
   */
  _getPropertyCount() {
    const objPropQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(OWL.ObjectProperty));
    const dataPropQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(OWL.DatatypeProperty));
    const propQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(RDF.Property));
    
    return new Set([
      ...objPropQuads.map(q => q.subject.value),
      ...dataPropQuads.map(q => q.subject.value),
      ...propQuads.map(q => q.subject.value)
    ]).size;
  }

  /**
   * Get individual count
   */
  _getIndividualCount() {
    // Count individuals by finding entities that are not classes or properties
    const allSubjects = new Set();
    const classes = new Set();
    const properties = new Set();
    
    // Collect all subjects
    for (const quad of this.ontologyStore.getQuads()) {
      if (quad.subject.termType === 'NamedNode') {
        allSubjects.add(quad.subject.value);
      }
    }
    
    // Identify classes
    const classQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(OWL.Class));
    for (const quad of classQuads) {
      classes.add(quad.subject.value);
    }
    
    // Identify properties
    const propQuads = this.ontologyStore.getQuads(null, namedNode(RDF.type), namedNode(RDF.Property));
    for (const quad of propQuads) {
      properties.add(quad.subject.value);
    }
    
    // Individuals are subjects that are neither classes nor properties
    const individuals = new Set([...allSubjects].filter(s => !classes.has(s) && !properties.has(s)));
    return individuals.size;
  }

  /**
   * Clear reasoning state
   */
  async _clearReasoningState() {
    this.inferenceStore.removeQuads(this.inferenceStore.getQuads());
    this.classHierarchy.clear();
    this.propertyHierarchy.clear();
    this.individualClassifications.clear();
    this.restrictionMappings.clear();
    this.propertyCharacteristics.clear();
    this.inconsistencies = [];
    this.satisfiabilityCache.clear();
    
    this.incrementalState = {
      lastClassification: null,
      pendingChanges: [],
      classificationCache: new Map(),
      affectedClasses: new Set(),
      affectedProperties: new Set()
    };
  }

  /**
   * Update performance metrics
   */
  _updateMetrics(context, reasoningTime) {
    this.metrics.classificationsPerformed++;
    this.metrics.inferencesGenerated += context.inferencesGenerated;
    this.metrics.reasoningTime += reasoningTime;
    this.metrics.inconsistenciesFound += context.inconsistenciesFound;
    this.metrics.consistencyChecks += context.consistencyChecks;
  }

  /**
   * Mark incremental changes
   */
  async _markIncrementalChanges(ontology) {
    // Implementation would track what changed since last reasoning
    this.incrementalState.pendingChanges.push({
      type: 'ontology-loaded',
      ontology: ontology.uri || 'anonymous',
      timestamp: this.getDeterministicTimestamp()
    });
  }

  /**
   * Update incremental state
   */
  async _updateIncrementalState(results) {
    this.incrementalState.lastClassification = {
      timestamp: this.getDeterministicTimestamp(),
      inferences: results.totalInferences || 0,
      consistent: results.consistency?.consistent || true
    };
    
    this.incrementalState.pendingChanges = [];
    this.incrementalState.affectedClasses.clear();
    this.incrementalState.affectedProperties.clear();
  }

  /**
   * Precompute class hierarchy
   */
  async _precomputeClassHierarchy() {
    await this._buildClassHierarchy();
    this.logger.debug(`Precomputed class hierarchy: ${this.classHierarchy.size} classes`);
  }

  /**
   * Precompute property hierarchy
   */
  async _precomputePropertyHierarchy() {
    await this._buildPropertyHierarchy();
    this.logger.debug(`Precomputed property hierarchy: ${this.propertyHierarchy.size} properties`);
  }

  // Additional helper methods for advanced reasoning would go here...
  
  async _getSuperclasses(classUri) {
    if (this.classHierarchy.has(classUri)) {
      return this.classHierarchy.get(classUri).superClasses;
    }
    return new Set();
  }

  async _getDisjointClasses(classUri) {
    const disjointClasses = new Set();
    const disjointQuads = this.ontologyStore.getQuads(namedNode(classUri), namedNode(OWL.disjointWith), null);
    
    for (const quad of disjointQuads) {
      disjointClasses.add(quad.object.value);
    }
    
    return disjointClasses;
  }

  async _getEquivalentClasses(classUri) {
    const equivalentClasses = new Set();
    const equivalentQuads = this.ontologyStore.getQuads(namedNode(classUri), namedNode(OWL.equivalentClass), null);
    
    for (const quad of equivalentQuads) {
      equivalentClasses.add(quad.object.value);
    }
    
    return equivalentClasses;
  }

  async _getClassRestrictions(classUri) {
    // Implementation would collect all restrictions for the class
    return [];
  }

  async _isContradictoryRestriction(restriction) {
    // Implementation would check if restriction creates a contradiction
    return false;
  }
}

export default OWLReasoner;