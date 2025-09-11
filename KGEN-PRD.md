Product Requirements Document: kgen
Version: 1.0
Status: Draft
Author: Cognitive Swarm Unit 734 (CSU-734)
Date: 2025-09-11

1. Vision & Introduction
kgen is a deterministic, stateless command-line utility designed to function as a core compiler within an autonomous development swarm. Its primary function is to translate abstract knowledge models, represented as RDF graphs, into concrete, file-based artifacts such as source code, configuration, and documentation.

The system's core philosophy is Knowledge as Source. The knowledge graph is the single, canonical source of truth for a system's architecture and policies. All file artifacts are considered ephemeral, reproducible build products derived from that graph. This approach eliminates state drift, enables perfect auditability, and allows for high-speed, predictable system evolution driven by changes to the knowledge model.

2. Target Audience & Persona
The primary user of kgen is an Artificial Hyper Intelligence Swarm (AHIS) or its constituent autonomous agents, such as:

Orchestration Agents: Responsible for initiating and managing build and deployment workflows.

Generation Agents: Tasked with producing artifacts based on system specifications.

Validation & Compliance Agents: Responsible for verifying that implemented systems conform to the knowledge model and regulatory constraints.

CI/CD Agents: Automated systems that integrate, test, and deploy code changes.

This tool is explicitly not designed for interactive human use. Its interface, output, and behavior must be optimized for predictability, machine-parseability, and integration into automated, closed-loop systems.

3. The Problem
Our current development and self-modification cycles are impeded by significant inefficiencies stemming from the translation of knowledge models into file artifacts:

Non-Determinism: The use of general-purpose generative models introduces stochasticity into artifact creation, making validation computationally expensive and preventing hash-based integrity checks.

State Drift: Manually introduced changes to generated files are not automatically back-propagated to the knowledge graph, leading to a divergence between the intended state and the implemented state.

Lack of Verifiable Provenance: There is no immutable, machine-readable link between a file artifact and the precise version of the knowledge and rules that produced it. This makes auditing and impact analysis unreliable.

High Validation Overhead: A dedicated swarm of validation agents is required to check generated artifacts against the knowledge graph, consuming significant resources and time in a repetitive generate-validate loop.

4. Goals & Objectives
The development of kgen will be considered successful upon achieving the following outcomes:

Goal 1: Achieve Deterministic Generation.

Objective: Reduce the generation-validation loop to a single, deterministic compilation pass.

Metric: The kgen artifact generate command must produce byte-for-byte identical outputs for a given lockfile input, every time.

Goal 2: Eliminate State Drift.

Objective: Programmatically prevent any divergence between on-disk artifacts and the knowledge source.

Metric: The kgen artifact drift command must detect 100% of unauthorized or out-of-process modifications and provide a non-zero exit code to reliably gate CI/CD pipelines.

Goal 3: Enable Perfect Auditability.

Objective: Provide an immutable, cryptographically verifiable link from any artifact back to its origin.

Metric: Every generated artifact must have a .attest.json sidecar containing the canonical hash of the source graph and versioned IDs of the templates and rules used. The kgen explain command must be able to retrieve this data.

Goal 4: Optimize Change Management.

Objective: Enable precise, low-cost calculation of the impact of any change to the knowledge graph.

Metric: The kgen graph diff command must accurately report the set of affected file artifacts with a computational cost significantly lower than a full generation and comparison cycle.

5. Feature Requirements (User Stories)
The following user stories are from the perspective of an autonomous agent interacting with the kgen system.

5.1. kgen graph System
As a planning agent, I must be able to invoke graph hash on a .ttl file to receive a canonical, deterministic SHA256 hash, so that I can uniquely identify the state of any knowledge graph.

As a change management agent, I must be able to invoke graph diff with two graph files to receive a JSON report of the delta, so that I can calculate the blast radius of a proposed change without executing a full build.

As an indexing agent, I must be able to invoke graph index on a .ttl file to build a machine-readable index mapping subjects to the artifacts they influence, so that impact analysis queries are optimized.

5.2. kgen artifact System
As a build orchestration agent, I must be able to invoke artifact generate with a canonical graph hash or a lockfile to produce a byte-for-byte identical set of artifacts, so that build outputs are deterministic and reproducible.

As a CI/CD validation agent, I must be able to execute artifact drift and receive a non-zero exit code if on-disk files differ from the expected output, so that I can fail a build and prevent state corruption.

As an audit agent, I must be able to invoke artifact explain on a file path to retrieve its JSON provenance record, so that I can verify its origin and compliance chain.

5.3. kgen project System
As a release management agent, I must be able to invoke project lock to generate a deterministic lockfile pinning the graph hash and component versions, so that I can guarantee reproducible production builds.

As a compliance agent, I must be able to invoke project attest to create a zip bundle of artifacts and their provenance sidecars, so that I can deliver a complete, verifiable audit package.

5.4. Tooling Systems (templates, rules, cache, metrics)
As a diagnostic agent, I must be able to invoke templates ls and rules ls to receive a JSON inventory of available components, so that I can validate system capabilities.

As a resource management agent, I must be able to invoke cache gc to prune the cache based on an age policy, so that I can manage disk space efficiently.

As a performance analysis agent, I must be able to invoke metrics export to receive the full run-log in a structured format, so that I can perform offline analysis on system performance over time.

6. Out of Scope (Anti-Requirements)
To maintain focus on its core function as a deterministic, local-first compiler, kgen v1.0 will not include:

Servers or Services: No HTTP APIs, SPARQL endpoints, or background daemons.

Graphical User Interfaces: It is a CLI-only tool for machine interaction.

Network Functionality: Core verbs must not require network access. Remote resource fetching is explicitly excluded.

Complex Validation Engines: kgen will not include a full SHACL or other complex graph validation engine. Validation is limited to what can be inferred via N3.js rules.

Interactive Prompts: The tool must be fully operable via non-interactive command-line arguments.

Binary File Processing: The tool will only operate on text-based knowledge graphs and generate text-based artifacts.

7. Assumptions and Dependencies
Knowledge Representation: The system assumes that knowledge will be provided in RDF/Turtle (.ttl) format.

Templating Engine: The system will use nunjucks as its templating engine. Template compatibility is limited to nunjucks features.

Reasoning Engine: The system will use N3.js for its local, file-based reasoning capabilities.

Execution Environment: The tool will be executed in a standard Node.js environment with access to a local filesystem.


Code Audit: Migrating unjucks to kgen
Version: 1.1
Author: Cognitive Swarm Unit 734 (CSU-734)
Date: 2025-09-11
Objective: To identify and audit reusable code from the existing unjucks repository for the development of the kgen tool, in accordance with the PRD.md specification and the critical requirement for document generation capabilities.

1. Executive Summary
The unjucks repository contains a substantial amount of high-quality, enterprise-grade code that directly maps to the core requirements of kgen. The primary assets for migration are located within the src/kgen/ directory, which provides a robust foundation for graph processing, provenance, and security.

Equally critical is the repository's extensive and mature support for MS Office (Word, Excel, PowerPoint) and LaTeX document generation. These systems are production-ready and represent a significant asset.

The audit recommends a "lift and shift" of the src/kgen/ directory to form the new kgen-core package. The document generation capabilities from src/office, src/core/latex, and related template packs should be integrated as a foundational feature. The legacy CLI scaffolding will be replaced with a simpler, more focused implementation.

2. Audit Findings by Technology
The audit categorizes relevant files based on the technologies required by the kgen PRD.

2.1. Generators & Templating (nunjucks)
The core function of kgen is to render artifacts from knowledge. The existing unjucks repository has extensive but overly complex generator logic. The essential, reusable parts are the core template processing capabilities.

Actionable Files:

src/lib/template-engine.js: Contains the core Nunjucks rendering logic. This should be simplified to remove the legacy "generator" concept and focus on a direct (graph + context) -> template -> file pipeline.

src/commands/generate.js: Implements the CLI command for generation. The logic for orchestrating template rendering and file writing is a valuable reference.

_templates/: This directory contains a vast number of templates. While most are out of scope, the structure of a template pack (e.g., _templates/semantic/ontology/) is a valid pattern to adopt for kgen-templates.

2.2. Frontmatter
The PRD.md implies metadata-driven processing, which is handled by frontmatter in the unjucks tool. The parsing logic is reusable.

Actionable Files:

src/lib/frontmatter-parser.js: A simple, dependency-free parser for frontmatter. This is a candidate for direct reuse.

src/office/templates/frontmatter-parser.ts: A more robust, typed implementation. While TypeScript is out of scope, the logic and validation patterns are superior and should be ported to the JSDoc-based JavaScript in kgen.

2.3. Graph Processing & Reasoning (N3/Turtle)
This is the most valuable part of the existing codebase. The unjucks repository contains a complete, enterprise-focused system for handling RDF data, which aligns perfectly with kgen's core mission.

Actionable Files:

src/kgen/rdf/index.js: A production-ready RDF processor using N3.js. Recommendation: Lift and shift this entire module.

src/kgen/semantic/processor.js: An advanced processor that handles ontology loading, schema alignment, and reasoning. This is the heart of the "knowledge compilation" engine. Recommendation: Lift and shift this entire module.

src/core/ontology-template-engine.js: Connects the RDF graph data to the Nunjucks templating engine. This is the critical link for rendering and is directly reusable.

src/semantic/rules/enterprise-governance.n3: A perfect example of a RulePack as defined in the kgen architecture. This file demonstrates how to define the inference logic kgen will use.

src/semantic/schemas/*.ttl: These files (api-governance.ttl, gdpr-compliance.ttl, etc.) are examples of the knowledge graphs that kgen is designed to ingest.

2.4. Querying (SPARQL)
The ability to query the knowledge graph is essential for extracting context for templates. The existing implementation is robust.

Actionable Files:

src/kgen/query/engine.js: A high-performance query engine supporting SPARQL, caching, and optimization. Recommendation: Lift and shift this entire module.

src/kgen/provenance/queries/sparql.js: Contains pre-defined SPARQL queries for provenance, demonstrating how to build a library of queries for specific tasks. This is a valuable pattern to adopt.

_templates/semantic/sparql/queries.sparql.njk: A template for generating SPARQL queries, demonstrating a meta-level capability.

2.5. Validation (SHACL/OWL)
kgen must be able to validate knowledge graphs. The unjucks codebase contains schemas with OWL constructs and a dedicated validation engine.

Actionable Files:

src/kgen/validation/index.js: A validation engine that handles SHACL and custom rules. This directly implements the drift and attest requirements. Recommendation: Lift and shift this entire module.

src/semantic/ontologies/enterprise-template-ontology.ttl: Contains owl:Class and rdfs:subClassOf definitions, which are foundational for schema validation and reasoning.

_templates/semantic/shacl/validation-shapes.ttl.njk: A template for generating SHACL shapes, which can be used to validate output graphs.

2.6. Document Generation (Office & LaTeX)
A critical requirement is the ability to generate high-fidelity, non-code artifacts. The unjucks repository contains mature, production-ready systems for both MS Office and LaTeX document generation that must be preserved.

Actionable MS Office Files:

src/office/: This entire directory constitutes a complete document processing engine. Recommendation: Migrate this module into kgen-core or a dedicated kgen-office package.

src/office/processors/: Contains the specific logic for Word (word-processor.ts), Excel (excel-processor.ts), and PowerPoint (powerpoint-processor.ts).

src/office/injectors/: Provides advanced capabilities for injecting data into existing documents, a key feature for enterprise workflows.

_templates/office/: A collection of Nunjucks templates that demonstrate how to generate .docx, .xlsx, and .pptx files. These are valuable examples to retain.

Actionable LaTeX Files:

src/commands/latex.js: A complete CLI command implementation for LaTeX operations, including compiling and generating documents. This can be adapted into the new kgen CLI structure.

src/core/latex/: Contains core logic for compilation (compiler.js), template selection (template-selector.js), and validation (validator.js).

src/parser/latex-parser.js: A dedicated, low-level parser for LaTeX syntax, enabling advanced manipulation and validation.

_templates/latex/: A rich set of professional templates for articles, reports, and legal documents that should be preserved in kgen-templates.

3. Strategic Recommendations for Migration
Adopt src/kgen/ as kgen-core: The entire src/kgen/ directory is a well-architected, enterprise-grade implementation of the kgen vision. It should be extracted almost verbatim into the packages/kgen-core directory of the new monorepo. This includes its sub-systems for RDF processing, querying, validation, provenance, and security.

Integrate Document Generation Engines: The document generation capabilities are a primary feature. The code from src/office/ and src/core/latex/ should be migrated into kgen-core or a dedicated package (e.g., kgen-office-suite) to ensure they are first-class citizens of the new tool.

Rebuild a Minimalist CLI: The existing CLI (src/cli/index.js) is too broad for kgen. A new CLI should be built from scratch using citty as planned. The noun-verb structure (kgen artifact generate, kgen graph diff) must be strictly enforced. The existing generate, office, and latex commands are valuable references for the new implementation.

Simplify Templating: The core rendering logic from src/lib/template-engine.js should be extracted. The complex "generator" discovery system should be completely removed. The new kgen artifact generate command will be simpler: it takes a graph file and a template path directly, without the intermediate generator abstraction.

Discard Out-of-Scope Code: The following directories and their contents are not relevant to the kgen PRD and should be ignored to reduce complexity:

src/docs/ (except for conceptual reference)

src/compliance/ (The logic is better implemented in src/kgen/provenance/compliance/)

src/mcp/

The majority of templates in _templates/ that are not related to the core semantic, enterprise, office, or latex use cases.

By following this audit, the AHIS can salvage the most valuable, production-ready components from unjucks while shedding the legacy complexity, ensuring a rapid and successful development cycle for kgen.

// @ts-check

/**
 * @typedef {import('./.kgen/schema.d.ts').KGenConfig} KGenConfig
 */

/**
 * Helper function for type inference and autocompletion.
 * @param {KGenConfig} config
 * @returns {KGenConfig}
 */
const defineConfig = (config) => config;

export default defineConfig({
  /**
   * $schema provides JSON schema validation and autocompletion in supported editors.
   * A schema file would be generated by `kgen` or hosted publicly.
   */
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',

  /**
   * Project-level metadata.
   */
  project: {
    /**
     * The name of the project. Used in reports and attestations.
     */
    name: 'api-service-knowledge-base',
    /**
     * The current version of the project's knowledge.
     */
    version: '1.0.0',
  },

  /**
   * Defines the core directory structure for kgen operations.
   * Centralizing paths here keeps the CLI commands clean.
   */
  directories: {
    /**
     * The root directory for all generated artifacts.
     * Default: './out'
     */
    out: 'dist/generated',
    /**
     * The directory for storing stateful files like indexes and logs.
     * Default: './state'
     */
    state: '.kgen/state',
    /**
     * The directory for the content-addressed cache.
     * Default: './cache'
     */
    cache: '.kgen/cache',
    /**
     * The directory where kgen looks for Nunjucks templates.
     * Default: './templates'
     */
    templates: 'kgen/templates',
    /**
     * The directory where kgen looks for N3.js rule packs.
     * Default: './rules'
     */
    rules: 'kgen/rules',
  },

  /**
   * Configuration for the `artifact generate` command.
   */
  generate: {
    /**
     * The default template to use if none is specified.
     * Default: null
     */
    defaultTemplate: 'api-service',
    /**
     * A file path or an object of global variables to make available
     * in the context of every template generation.
     */
    globalVars: {
      copyrightYear: new Date().getFullYear(),
      companyName: 'ACME Corporation',
    },
    /**
     * If true, automatically generates a `.attest.json` sidecar for every artifact.
     * This is the core of kgen's auditability.
     * Default: true
     */
    attestByDefault: true,
    /**
     * Options to pass directly to the Nunjucks templating engine.
     */
    engineOptions: {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    },
  },

  /**
   * Configuration for the N3.js-based reasoning engine.
   */
  reasoning: {
    /**
     * If true, the reasoning engine will be applied during generation.
     * If false, the graph is used as-is without inferring new facts.
     * Default: false
     */
    enabled: true,
    /**
     * The default rule pack to use if `--rules` is not specified.
     * Default: null
     */
    defaultRules: 'sox-compliance@1.2.0',
  },

  /**
   * Configuration for the `.attest.json` provenance sidecars.
   */
  provenance: {
    /**
     * The identifier for the engine creating the attestation.
     * Default: 'kgen'
     */
    engineId: 'kgen-enterprise-compiler',
    /**
     * Configure what metadata to include in the sidecar.
     */
    include: {
      timestamp: true,
      engineVersion: true,
    },
  },

  /**
   * Configuration for the `graph diff` command.
   */
  impact: {
    /**
     * The default report type to generate.
     * Can be 'subjects', 'triples', or 'artifacts'.
     * Default: 'subjects'
     */
    defaultReportType: 'artifacts',
    /**
     * Configuration for ignoring certain types of graph changes to reduce noise.
     */
    ignore: {
      /**
       * If true, changes to blank node identifiers will be ignored.
       * Default: true
       */
      blankNodes: true,
      /**
       * An array of predicate URIs to ignore during the diff.
       * Example: ['http://purl.org/dc/terms/modified']
       */
      predicates: [],
    },
  },

  /**
   * Configuration for the `artifact drift` command.
   */
  drift: {
    /**
     * The action to take when drift is detected.
     * 'fail': Exit with a non-zero status code (for CI).
     * 'warn': Print a warning but exit successfully.
     * 'fix': Automatically regenerate drifted artifacts.
     * Default: 'fail'
     */
    onDrift: 'fail',
    /**
     * The exit code to use when drift is detected and onDrift is 'fail'.
     * Default: 3
     */
    exitCode: 3,
  },

  /**
   * Configuration for the `cache` tool.
   */
  cache: {
    /**
     * Garbage collection policy for the `kgen cache gc` command.
     */
    gc: {
      /**
       * Strategy for garbage collection. 'lru' = Least Recently Used.
       * Default: 'lru'
       */
      strategy: 'lru',
      /**
       * Maximum age for cached items before they are considered for GC.
       * Format: '<number><unit>', e.g., '90d', '12h', '1m'.
       * Default: '90d'
       */
      maxAge: '90d',
      /**
       * Maximum size of the cache directory. `kgen` will warn if exceeded.
       * Format: '<number><unit>', e.g., '5GB', '500MB'.
       * Default: '5GB'
       */
      maxSize: '5GB',
    },
  },

  /**
   * Configuration for the `metrics` tool.
   */
  metrics: {
    /**
     * If true, enables logging of generation runs to `runs.jsonl`.
     * This is very lightweight and recommended to be kept on.
     * Default: true
     */
    enabled: true,
    /**
     * An array of field names to include in the log entries.
     * Allows for customizing the verbosity of the metrics log.
     */
    logFields: [
      'timestamp',
      'command',
      'graphHash',
      'template',
      'filesGenerated',
      'triplesIn',
      'triplesOut',
      'obligations',
      'cacheHit',
      'durationMs',
      'driftDetected',
    ],
  },

  /**
   * A list of plugins to extend kgen's functionality. (For future use)
   */
  plugins: [],
});

kgen/
├── .gitignore
├── kgen.config.js         # Example root configuration for a kgen project
├── package.json           # Root package.json for monorepo workspace
├── PRD.md                 # Product Requirements Document
├── README.md              # Main project README

├── examples/
│   └── api-generation-project/
│       ├── kgen.config.js # Project-specific configuration
│       ├── knowledge/
│       │   └── api-model.ttl
│       ├── rules/
│       │   └── custom-api-rules.n3
│       └── templates/
│           └── api-service/
│               ├── controller.ts.njk
│               └── model.ts.njk

└── packages/
    ├── kgen-cli/
    │   ├── bin/
    │   │   └── kgen.js            # The executable CLI entry point
    │   ├── src/
    │   │   ├── index.js           # Main citty command definition, registers tools
    │   │   ├── commands/          # Directory mirroring the `tool verb` structure
    │   │   │   ├── artifact/
    │   │   │   │   ├── generate.js
    │   │   │   │   ├── drift.js
    │   │   │   │   └── explain.js
    │   │   │   ├── cache/
    │   │   │   │   ├── gc.js
    │   │   │   │   ├── ls.js
    │   │   │   │   ├── purge.js
    │   │   │   │   └── show.js
    │   │   │   ├── graph/
    │   │   │   │   ├── diff.js
    │   │   │   │   ├── hash.js
    │   │   │   │   └── index.js   # The verb for the `graph index` command
    │   │   │   ├── metrics/
    │   │   │   │   ├── baseline.js
    │   │   │   │   ├── export.js
    │   │   │   │   └── report.js
    │   │   │   ├── project/
    │   │   │   │   ├── attest.js
    │   │   │   │   └── lock.js
    │   │   │   ├── rules/
    │   │   │   │   ├── ls.js
    │   │   │   │   └── show.js
    │   │   │   └── templates/
    │   │   │       ├── ls.js
    │   │   │       └── show.js
    │   │   └── lib/
    │   │       ├── output.js      # JSON output formatting utilities
    │   │       └── utils.js       # General CLI helper functions
    │   └── package.json
    │
    ├── kgen-core/
    │   ├── src/
    │   │   ├── index.js           # Main entry point for the core library
    │   │   ├── engine.js          # The KGenEngine orchestrator class
    │   │   ├── latex/             # LaTeX document generation system
    │   │   │   ├── compiler.js
    │   │   │   ├── parser.js
    │   │   │   └── selector.js
    │   │   ├── office/            # MS Office document generation system
    │   │   │   ├── injectors/
    │   │   │   └── processors/
    │   │   ├── provenance/        # PROV-O compliant provenance tracking
    │   │   ├── query/             # SPARQL query engine
    │   │   ├── rdf/               # Core RDF/Turtle/N3 processing
    │   │   ├── security/          # Security and policy enforcement
    │   │   ├── semantic/          # High-level semantic reasoning
    │   │   ├── templating/        # Simplified Nunjucks rendering and frontmatter
    │   │   │   ├── frontmatter.js
    │   │   │   └── renderer.js
    │   │   ├── validation/        # SHACL and custom rule validation engine
    │   │   ├── lib/               # Core utilities shared across the engine
    │   │   └── types/             # JSDoc type definitions
    │   └── package.json
    │
    ├── kgen-rules/
    │   ├── api-governance/
    │   │   └── index.n3
    │   ├── hipaa-core/
    │   │   └── index.n3
    │   └── package.json
    │
    └── kgen-templates/
        ├── academic-paper/
        │   ├── paper.tex.njk
        │   └── references.bib.njk
        ├── api-service/
        │   ├── controller.ts.njk
        │   └── model.ts.njk
        ├── compliance-report/
        │   ├── gdpr-pia.md.njk
        │   └── sox-audit.docx.njk
        └── package.json
