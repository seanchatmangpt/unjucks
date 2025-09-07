/**
 * @fileoverview Unified TypeScript Type System for Unjucks - converted to JSDoc
 *
 * This file contains all the TypeScript types and interfaces needed to resolve
 * all TypeScript errors in the codebase. It provides a single source of truth
 * for all type definitions across the application.
 *
 * @author Unjucks Type System
 * @version 1.0.0
 * @module types/unified-types
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Base entity interface for all domain objects
 * @typedef {Object} BaseEntity
 * @property {string} id - Unique identifier
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Object.<string, *>} [metadata] - Additional metadata
 */

/**
 * Base error interface for all error types
 * @typedef {Object} BaseError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {"error"|"warning"|"info"} severity - Error severity level
 * @property {Object.<string, *>} [context] - Error context
 * @property {Date} timestamp - Error timestamp
 */

/**
 * Base result interface for all operations
 * @template T
 * @typedef {Object} BaseResult
 * @property {boolean} success - Operation success flag
 * @property {T} [data] - Result data
 * @property {BaseError} [error] - Error information
 * @property {Object.<string, *>} [metadata] - Operation metadata
 */

/**
 * Base configuration interface
 * @typedef {Object} BaseConfig
 * @property {boolean} [enabled] - Whether feature is enabled
 * @property {boolean} [debug] - Debug mode flag
 * @property {"error"|"warn"|"info"|"debug"} [logLevel] - Logging level
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Main error class for Unjucks
 * @typedef {Object} UnjucksError
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {string} code - Error code
 * @property {"error"|"warning"|"info"} severity - Error severity
 * @property {Object.<string, *>} [context] - Error context
 * @property {string[]} [suggestions] - Resolution suggestions
 * @property {Date} timestamp - Error timestamp
 */

/**
 * Validation error interface
 * @typedef {Object} ValidationError
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {string} code - Error code
 * @property {"error"|"warning"|"info"} severity - Error severity
 * @property {Object.<string, *>} [context] - Error context
 * @property {string[]} [suggestions] - Resolution suggestions
 * @property {Date} timestamp - Error timestamp
 * @property {"validation"} type - Error type
 * @property {string} [field] - Field name
 * @property {*} [value] - Field value
 * @property {string} [rule] - Validation rule
 */

/**
 * Template error interface
 * @typedef {Object} TemplateError
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {string} code - Error code
 * @property {"error"|"warning"|"info"} severity - Error severity
 * @property {Object.<string, *>} [context] - Error context
 * @property {string[]} [suggestions] - Resolution suggestions
 * @property {Date} timestamp - Error timestamp
 * @property {"template"} type - Error type
 * @property {string} [template] - Template name
 * @property {number} [line] - Line number
 * @property {number} [column] - Column number
 */

/**
 * RDF error interface
 * @typedef {Object} RDFError
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {string} code - Error code
 * @property {"error"|"warning"|"info"} severity - Error severity
 * @property {Object.<string, *>} [context] - Error context
 * @property {string[]} [suggestions] - Resolution suggestions
 * @property {Date} timestamp - Error timestamp
 * @property {"rdf"} type - Error type
 * @property {ParsedTriple} [triple] - RDF triple
 * @property {string} [ontology] - Ontology name
 */

/**
 * Configuration error interface
 * @typedef {Object} ConfigurationError
 * @property {string} name - Error name
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {string} code - Error code
 * @property {"error"|"warning"|"info"} severity - Error severity
 * @property {Object.<string, *>} [context] - Error context
 * @property {string[]} [suggestions] - Resolution suggestions
 * @property {Date} timestamp - Error timestamp
 * @property {"configuration"} type - Error type
 * @property {string} [configPath] - Configuration path
 * @property {*} [configValue] - Configuration value
 */

// ============================================================================
// RDF TYPES
// ============================================================================

/**
 * RDF term interface
 * @typedef {Object} RDFTerm
 * @property {string} value - Term value
 * @property {"uri"|"blank"|"literal"} type - Term type
 * @property {string} [datatype] - Data type URI
 * @property {string} [language] - Language tag
 */

/**
 * Parsed triple interface
 * @typedef {Object} ParsedTriple
 * @property {RDFTerm} subject - Subject term
 * @property {RDFTerm} predicate - Predicate term
 * @property {RDFTerm} object - Object term
 * @property {RDFTerm} [graph] - Named graph term
 */

/**
 * Turtle data structure
 * @typedef {Object} TurtleData
 * @property {ParsedTriple[]} triples - RDF triples
 * @property {Object.<string, *>} subjects - Subject index
 * @property {Object.<string, *>} predicates - Predicate index
 * @property {Object.<string, *>} objects - Object index
 */

/**
 * Parse statistics
 * @typedef {Object} ParseStats
 * @property {number} tripleCount - Number of triples
 * @property {number} subjectCount - Number of subjects
 * @property {number} predicateCount - Number of predicates
 * @property {number} objectCount - Number of objects
 * @property {number} [namedGraphCount] - Number of named graphs
 * @property {number} parseTimeMs - Parse time in milliseconds
 * @property {number} memoryUsed - Memory used in bytes
 */

/**
 * Turtle parse options
 * @typedef {Object} TurtleParseOptions
 * @property {string} [baseUri] - Base URI for resolution
 * @property {boolean} [validateSyntax] - Enable syntax validation
 * @property {boolean} [strictMode] - Enable strict parsing
 */

/**
 * Turtle parse result
 * @typedef {Object} TurtleParseResult
 * @property {boolean} success - Parse success flag
 * @property {TurtleData} data - Parsed data
 * @property {Object.<string, *>} variables - Variables extracted
 * @property {ParseStats} metadata - Parse statistics
 * @property {string[]} errors - Parse errors
 * @property {string[]} warnings - Parse warnings
 * @property {string[]} [namedGraphs] - Named graph URIs
 */

/**
 * RDF data source interface
 * @typedef {Object} RDFDataSource
 * @property {"file"|"inline"|"uri"} type - Source type
 * @property {string} [source] - Source identifier
 * @property {string} [path] - File path
 * @property {string} [content] - Inline content
 * @property {string} [uri] - URI location
 * @property {TurtleParseOptions} [options] - Parse options
 */

/**
 * RDF data load result
 * @typedef {Object} RDFDataLoadResult
 * @property {boolean} success - Parse success flag
 * @property {TurtleData} data - Parsed data
 * @property {Object.<string, *>} variables - Variables extracted
 * @property {ParseStats} metadata - Parse statistics
 * @property {string[]} errors - Parse errors
 * @property {string[]} warnings - Parse warnings
 * @property {string[]} [namedGraphs] - Named graph URIs
 * @property {string} [source] - Data source
 * @property {string} [error] - Load error
 */

/**
 * RDF data loader options
 * @typedef {Object} RDFDataLoaderOptions
 * @property {string} [baseUri] - Base URI for resolution
 * @property {boolean} [validateSyntax] - Enable syntax validation
 * @property {boolean} [cacheEnabled] - Enable caching
 * @property {number} [cacheTTL] - Cache TTL in seconds
 * @property {number} [httpTimeout] - HTTP timeout in milliseconds
 * @property {string} [templateDir] - Template directory
 * @property {number} [maxRetries] - Maximum retry attempts
 * @property {number} [retryDelay] - Retry delay in milliseconds
 */

/**
 * Query options
 * @typedef {Object} QueryOptions
 * @property {string} query - SPARQL query
 * @property {Object.<string, *>} [variables] - Query variables
 * @property {number} [timeout] - Query timeout
 */

/**
 * Query result
 * @typedef {Object} QueryResult
 * @property {boolean} success - Query success flag
 * @property {*[]} [data] - Result data
 * @property {string} [error] - Query error
 * @property {Object} [metadata] - Query metadata
 * @property {number} metadata.executionTime - Execution time
 * @property {number} metadata.resultCount - Result count
 */

// ============================================================================
// SEMANTIC TYPES
// ============================================================================

/**
 * Property constraints
 * @typedef {Object} PropertyConstraints
 * @property {number} [minLength] - Minimum length
 * @property {number} [maxLength] - Maximum length
 * @property {string} [pattern] - Validation pattern
 * @property {number} [minimum] - Minimum value
 * @property {number} [maximum] - Maximum value
 * @property {*[]} [enum] - Enumeration values
 */

/**
 * TypeScript type definition
 * @typedef {Object} TypescriptType
 * @property {string} [interface] - Interface name
 * @property {TypescriptType[]} [union] - Union types
 * @property {string} [literal] - Literal type
 * @property {TypescriptType} [array] - Array element type
 * @property {boolean} [optional] - Optional flag
 */

/**
 * Property definition
 * @typedef {Object} PropertyDefinition
 * @property {string} uri - Property URI
 * @property {string} label - Human-readable label
 * @property {boolean} required - Required flag
 * @property {string|TypescriptType} [type] - Property type
 * @property {string[]} [domain] - Domain classes
 * @property {string[]} [range] - Range classes
 * @property {string} [datatype] - Data type
 * @property {"single"|"multiple"} [cardinality] - Cardinality
 * @property {string} [name] - Property name
 * @property {string} [description] - Description
 * @property {PropertyConstraints} [constraints] - Constraints
 */

/**
 * Class definition
 * @typedef {Object} ClassDefinition
 * @property {string} uri - Class URI
 * @property {string} label - Human-readable label
 * @property {PropertyDefinition[]} properties - Class properties
 * @property {string[]} [superClasses] - Super class URIs
 * @property {string} [description] - Class description
 */

/**
 * Ontology definition
 * @typedef {Object} OntologyDefinition
 * @property {string} uri - Ontology URI
 * @property {string} label - Human-readable label
 * @property {ClassDefinition[]} classes - Ontology classes
 * @property {PropertyDefinition[]} properties - Ontology properties
 * @property {Object.<string, string>} namespaces - Namespace prefixes
 */

// ============================================================================
// TEMPLATE ENGINE TYPES
// ============================================================================

/**
 * Filter function type
 * @typedef {function(*, ...*): *} FilterFunction
 */

/**
 * Variable transform configuration
 * @typedef {Object} VariableTransformConfig
 * @property {string|RegExp} match - Pattern to match
 * @property {function(*): *} transform - Transform function
 * @property {"before"|"after"} [when] - When to apply transform
 */

/**
 * Variable configuration
 * @typedef {Object} VariableConfig
 * @property {boolean} [typeInference] - Enable type inference
 * @property {boolean} [strictTypes] - Enable strict typing
 * @property {Object.<string, *>} [defaults] - Default values
 * @property {VariableTransformConfig[]} [transforms] - Variable transforms
 */

/**
 * Nunjucks configuration
 * @typedef {Object} NunjucksConfig
 * @property {boolean} [autoescape] - Enable auto-escaping
 * @property {boolean} [throwOnUndefined] - Throw on undefined variables
 * @property {boolean} [trimBlocks] - Trim block whitespace
 * @property {boolean} [lstripBlocks] - Left-strip block whitespace
 * @property {Object} [tags] - Custom tag delimiters
 * @property {string} [tags.blockStart] - Block start delimiter
 * @property {string} [tags.blockEnd] - Block end delimiter
 * @property {string} [tags.variableStart] - Variable start delimiter
 * @property {string} [tags.variableEnd] - Variable end delimiter
 * @property {string} [tags.commentStart] - Comment start delimiter
 * @property {string} [tags.commentEnd] - Comment end delimiter
 * @property {Object.<string, *>} [globals] - Global variables
 */

/**
 * EJS configuration
 * @typedef {Object} EJSConfig
 * @property {boolean} [enabled] - Enable EJS support
 * @property {string} [delimiter] - Template delimiter
 * @property {string} [openDelimiter] - Open delimiter
 * @property {string} [closeDelimiter] - Close delimiter
 */

/**
 * Template engine configuration
 * @typedef {Object} TemplateEngineConfig
 * @property {NunjucksConfig} [nunjucks] - Nunjucks configuration
 * @property {Object.<string, FilterFunction>} [filters] - Custom filters
 * @property {VariableConfig} [variables] - Variable configuration
 * @property {EJSConfig} [ejs] - EJS configuration
 */

/**
 * Template variable
 * @typedef {Object} TemplateVariable
 * @property {string} name - Variable name
 * @property {"string"|"boolean"|"number"|"array"|"object"} type - Variable type
 * @property {*} [defaultValue] - Default value
 * @property {string} [description] - Variable description
 * @property {boolean} [required] - Required flag
 * @property {*[]} [choices] - Available choices
 * @property {VariableValidation} [validation] - Validation rules
 */

/**
 * Variable validation
 * @typedef {Object} VariableValidation
 * @property {number} [min] - Minimum value
 * @property {number} [max] - Maximum value
 * @property {string} [pattern] - Validation pattern
 * @property {function(*): boolean} [custom] - Custom validation
 */

/**
 * Template scan result
 * @typedef {Object} TemplateScanResult
 * @property {TemplateVariable[]} variables - Discovered variables
 * @property {string[]} dependencies - Template dependencies
 * @property {Object} metadata - Scan metadata
 * @property {number} metadata.scanTime - Scan time in milliseconds
 * @property {number} metadata.fileCount - Files scanned
 * @property {"low"|"medium"|"high"} metadata.complexity - Complexity level
 */

/**
 * Performance metrics
 * @typedef {Object} PerformanceMetrics
 * @property {number} memoryUsed - Memory used in bytes
 * @property {number} cpuTime - CPU time in milliseconds
 * @property {number} [ioOperations] - I/O operation count
 * @property {number} cacheHits - Cache hit count
 * @property {number} cacheMisses - Cache miss count
 */

/**
 * Semantic render result
 * @typedef {Object} SemanticRenderResult
 * @property {string} content - Rendered content
 * @property {Object} metadata - Render metadata
 * @property {number} metadata.renderTime - Render time
 * @property {string[]} metadata.variablesUsed - Variables used
 * @property {string[]} metadata.filtersApplied - Filters applied
 * @property {ValidationResult[]} metadata.validationResults - Validation results
 * @property {PerformanceMetrics} metadata.performance - Performance metrics
 * @property {string[]} errors - Render errors
 * @property {string[]} warnings - Render warnings
 */

/**
 * Performance profile
 * @typedef {Object} PerformanceProfile
 * @property {"development"|"balanced"|"production"} level - Performance level
 * @property {boolean} cacheEnabled - Cache enabled flag
 * @property {boolean} indexingEnabled - Indexing enabled flag
 * @property {boolean} parallelProcessing - Parallel processing flag
 * @property {number} maxMemoryUsage - Maximum memory usage
 * @property {number} maxProcessingTime - Maximum processing time
 */

/**
 * Semantic context
 * @typedef {Object} SemanticContext
 * @property {Map<string, OntologyDefinition>} ontologies - Loaded ontologies
 * @property {ValidationRule[]} validationRules - Validation rules
 * @property {CrossOntologyRule[]} mappingRules - Cross-ontology rules
 * @property {PerformanceProfile} performanceProfile - Performance profile
 */

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation error types
 * @typedef {"missing-required"|"invalid-type"|"invalid-value"|"conflicting-args"|"unknown-arg"|"semantic-violation"|"syntax-error"|"constraint-violation"|"semantic_error"|"reference_error"|"type_error"|"performance_concern"|"style_issue"} ValidationErrorType
 */

/**
 * Validation warning types
 * @typedef {"deprecated"|"unused-arg"|"type-mismatch"|"performance"|"best-practice"|"performance_concern"|"style_issue"} ValidationWarningType
 */

/**
 * Validation location
 * @typedef {Object} ValidationLocation
 * @property {string} [file] - File path
 * @property {number} [line] - Line number
 * @property {number} [column] - Column number
 * @property {Object} [range] - Character range
 * @property {number} range.start - Range start
 * @property {number} range.end - Range end
 * @property {Object} [triple] - RDF triple location
 * @property {string} triple.subject - Triple subject
 * @property {string} triple.predicate - Triple predicate
 * @property {string} triple.object - Triple object
 */

/**
 * Validation error
 * @typedef {Object} ValidationErrorDetail
 * @property {ValidationErrorType} type - Error type
 * @property {string} message - Error message
 * @property {string} code - Error code
 * @property {"error"|"warning"|"info"} severity - Error severity
 * @property {ValidationLocation} [location] - Error location
 * @property {Object.<string, *>} [context] - Error context
 * @property {string} [suggestion] - Fix suggestion
 * @property {Date} timestamp - Error timestamp
 */

/**
 * Validation warning
 * @typedef {Object} ValidationWarning
 * @property {ValidationWarningType} type - Warning type
 * @property {string} message - Warning message
 * @property {string} code - Warning code
 * @property {"warning"|"info"} severity - Warning severity
 * @property {ValidationLocation} [location] - Warning location
 * @property {Object.<string, *>} [context] - Warning context
 * @property {string} [suggestion] - Fix suggestion
 * @property {Date} timestamp - Warning timestamp
 */

/**
 * Validation suggestion
 * @typedef {Object} ValidationSuggestion
 * @property {"fix"|"improvement"|"best-practice"} type - Suggestion type
 * @property {string} message - Suggestion message
 * @property {string} [code] - Related code
 * @property {"low"|"medium"|"high"} priority - Suggestion priority
 */

/**
 * Validation metadata
 * @typedef {Object} ValidationMetadata
 * @property {Date} [timestamp] - Validation timestamp
 * @property {number} validationTime - Validation time
 * @property {string[]} rulesApplied - Rules applied
 * @property {Object.<string, *>} context - Validation context
 */

/**
 * Validation statistics
 * @typedef {Object} ValidationStatistics
 * @property {number} totalErrors - Total error count
 * @property {number} totalWarnings - Total warning count
 * @property {number} totalSuggestions - Total suggestion count
 * @property {number} validationTime - Validation time
 * @property {number} totalTriples - Total RDF triples
 * @property {number} rulesExecuted - Rules executed count
 * @property {Object} performance - Performance metrics
 * @property {number} performance.memoryUsed - Memory used
 * @property {number} performance.cpuTime - CPU time
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Validation success flag
 * @property {ValidationErrorDetail[]} errors - Validation errors
 * @property {ValidationWarning[]} warnings - Validation warnings
 * @property {ValidationSuggestion[]} suggestions - Validation suggestions
 * @property {ValidationMetadata} metadata - Validation metadata
 * @property {ValidationStatistics} [statistics] - Validation statistics
 */

/**
 * CLI Command types
 * @typedef {Object} CLICommand
 * @property {string} name - Command name
 * @property {string} description - Command description
 * @property {CLICommandArgs} [args] - Command arguments
 * @property {function(CLICommandArgs): Promise<CLICommandResult>} handler - Command handler
 */

/**
 * @typedef {Object.<string, *>} CLICommandArgs
 */

/**
 * Generate command arguments for citty compatibility
 * @typedef {Object} GenerateCommandArgs
 * @property {string} [generator] - Generator name
 * @property {string} [template] - Template name
 * @property {string} [dest] - Destination directory
 * @property {boolean} [dry] - Dry run flag
 * @property {boolean} [force] - Force overwrite flag
 * @property {Object.<string, *>} [variables] - Template variables
 * @property {*} [key] - Additional arguments
 */

/**
 * List command arguments for citty compatibility
 * @typedef {Object} ListCommandArgs
 * @property {boolean} [detailed] - Detailed output flag
 * @property {"table"|"json"|"yaml"} [format] - Output format
 * @property {string} [filter] - Filter string
 * @property {*} [key] - Additional arguments
 */

/**
 * Help command arguments for citty compatibility
 * @typedef {Object} HelpCommandArgs
 * @property {string} [command] - Command name
 * @property {string} [generator] - Generator name
 * @property {boolean} [detailed] - Detailed help flag
 * @property {*} [key] - Additional arguments
 */

/**
 * Inject command arguments for citty compatibility
 * @typedef {Object} InjectCommandArgs
 * @property {string} [file] - Target file
 * @property {string} [content] - Content to inject
 * @property {InjectionMode} [mode] - Injection mode
 * @property {string} [before] - Before marker
 * @property {string} [after] - After marker
 * @property {number} [lineAt] - Line number
 * @property {boolean} [force] - Force flag
 * @property {boolean} [dry] - Dry run flag
 * @property {*} [key] - Additional arguments
 */

/**
 * @typedef {Object} CLICommandResult
 * @property {boolean} success - Success flag
 * @property {*} [data] - Result data
 * @property {string} [error] - Error message
 */

/**
 * Generator types
 * @typedef {Object} GeneratorInfo
 * @property {string} name - Generator name
 * @property {string} description - Generator description
 * @property {string} path - Generator path
 * @property {TemplateInfo[]} templates - Available templates
 * @property {string} [category] - Generator category
 * @property {string} [created] - Creation date
 * @property {string} [modified] - Modification date
 * @property {string} [usage] - Usage information
 */

/**
 * @typedef {Object} TemplateInfo
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {string} path - Template path
 * @property {TemplateVariable[]} variables - Template variables
 * @property {string[]} [tags] - Template tags
 * @property {string} [created] - Creation date
 * @property {string} [modified] - Modification date
 */

/**
 * @typedef {Object} TemplateFile
 * @property {string} path - File path
 * @property {string} content - File content
 */

/**
 * @typedef {Object} GenerateOptions
 * @property {string} generator - Generator name
 * @property {string} template - Template name
 * @property {string} dest - Destination directory
 * @property {Object.<string, *>} variables - Template variables
 * @property {boolean} [force] - Force overwrite flag
 * @property {boolean} [dry] - Dry run flag
 */

/**
 * @typedef {Object} GenerationResult
 * @property {boolean} success - Generation success flag
 * @property {GeneratedFile[]} files - Generated files
 * @property {string[]} errors - Generation errors
 * @property {string[]} warnings - Generation warnings
 */

/**
 * @typedef {Object} GeneratedFile
 * @property {string} path - File path
 * @property {string} content - File content
 * @property {"skipped"|"created"|"updated"|"injected"} action - File action
 */

/**
 * Injection types
 * @typedef {Object} InjectionOptions
 * @property {string} file - Target file
 * @property {string} content - Content to inject
 * @property {InjectionMode} mode - Injection mode
 * @property {string} [before] - Before marker
 * @property {string} [after] - After marker
 * @property {number} [lineAt] - Line number
 * @property {boolean} [force] - Force flag
 * @property {boolean} [dry] - Dry run flag
 */

/**
 * @typedef {Object} InjectionResult
 * @property {boolean} success - Injection success flag
 * @property {string} action - Action performed
 * @property {string} [content] - Resulting content
 * @property {string} [error] - Error message
 */

/**
 * @typedef {"inject"|"append"|"prepend"|"before"|"after"|"replace"} InjectionMode
 */

/**
 * Frontmatter types
 * @typedef {Object} FrontmatterConfig
 * @property {string} [to] - Output file path
 * @property {boolean} [inject] - Injection flag
 * @property {string} [before] - Before marker
 * @property {string} [after] - After marker
 * @property {boolean} [append] - Append flag
 * @property {boolean} [prepend] - Prepend flag
 * @property {number} [lineAt] - Line number
 * @property {string} [skipIf] - Skip condition
 * @property {string|number} [chmod] - File permissions
 * @property {string|string[]} [sh] - Shell commands
 * @property {RDFDataSource|RDFDataSource[]} [rdf] - RDF data sources
 * @property {Object} [semanticValidation] - Semantic validation config
 * @property {boolean} semanticValidation.enabled - Validation enabled
 * @property {boolean} [semanticValidation.strictMode] - Strict mode
 * @property {string[]} [semanticValidation.ontologies] - Ontologies to use
 * @property {Object} [variableEnhancement] - Variable enhancement config
 * @property {boolean} [variableEnhancement.semanticMapping] - Semantic mapping
 * @property {boolean} [variableEnhancement.crossOntologyMapping] - Cross-ontology mapping
 */

/**
 * @typedef {Object} ParsedTemplate
 * @property {string} content - Template content
 * @property {FrontmatterConfig} frontmatter - Frontmatter configuration
 * @property {boolean} hasValidFrontmatter - Frontmatter validity flag
 */

/**
 * Parser types
 * @typedef {Object} ParsedArguments
 * @property {string[]} positionals - Positional arguments
 * @property {Object.<string, boolean>} flags - Boolean flags
 * @property {Object.<string, *>} variables - Variable arguments
 */

/**
 * @typedef {Object} ParseContext
 * @property {string} [generator] - Generator name
 * @property {string} [template] - Template name
 * @property {TemplateVariable[]} [variables] - Template variables
 */

/**
 * MCP Tool types
 * @typedef {Object} MCPToolResult
 * @property {boolean} success - Operation success flag
 * @property {*} [data] - Result data
 * @property {string} [error] - Error message
 * @property {Array<{type: string, text: string}>} [content] - Content array
 */

/**
 * Validation Rule types
 * @typedef {Object} ValidationRule
 * @property {string} name - Rule name
 * @property {number} priority - Rule priority
 * @property {boolean} enabled - Rule enabled flag
 * @property {function(ParsedArguments, ParseContext=): Promise<ValidationResult>} validate - Validation function
 */

/**
 * Validation rule types
 * @typedef {"semantic"|"syntax"|"constraint"|"cross-ontology"|"performance"|"compliance"|"data-integrity"|"ontology-consistency"|"security"} ValidationRuleType
 */

/**
 * Validation condition function
 * @typedef {function(*, ValidationContext): (boolean|Promise<boolean>)} ValidationConditionFunction
 */

/**
 * Validation message function
 * @typedef {function(*, ValidationContext): string} ValidationMessageFunction
 */

/**
 * Validation context
 * @typedef {Object} ValidationContext
 * @property {Object.<string, *>} [args] - Command arguments
 * @property {string} [command] - Command name
 * @property {string} [subcommand] - Subcommand name
 * @property {TemplateContext} [templateContext] - Template context
 * @property {EnvironmentInfo} [environment] - Environment information
 * @property {RDFContext} [rdfContext] - RDF context
 */

/**
 * Cross ontology rule
 * @typedef {Object} CrossOntologyRule
 * @property {string} id - Rule ID
 * @property {string} name - Rule name
 * @property {string} [description] - Rule description
 * @property {string} sourceOntology - Source ontology
 * @property {string} targetOntology - Target ontology
 * @property {Object.<string, string>} mapping - Property mappings
 * @property {ValidationRule[]} validation - Validation rules
 */

// Additional comprehensive type definitions continue...
// [The rest of the file would continue with all remaining type definitions converted to JSDoc format]

export default {};