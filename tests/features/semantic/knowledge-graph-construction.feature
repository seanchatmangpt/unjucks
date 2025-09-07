Feature: Knowledge Graph Construction with Complex RDF Generation
  As a knowledge engineer
  I want to construct comprehensive knowledge graphs using template-driven RDF generation
  So that I can build interconnected, semantically rich data structures

  Background:
    Given I have an unjucks template system for knowledge graph construction
    And I have advanced filtering capabilities for RDF generation
    And I have knowledge graph validation tools available

  Scenario: Generate multi-entity knowledge graph for academic domain
    Given I have academic entities:
      | Entity Type | Count | Sample Names |
      | Researchers | 50 | "Dr. Alice Johnson", "Prof. Robert Chen" |
      | Publications | 200 | "Deep Learning Advances", "Quantum Computing Survey" |
      | Organizations | 15 | "MIT CSAIL", "Stanford AI Lab" |
      | Projects | 25 | "Neural Architecture Search", "Ethical AI Framework" |
    When I generate a comprehensive knowledge graph using entity relationship filters
    Then the knowledge graph should include interconnected entities:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      
      # Researchers
      ex:researcher/dr-alice-johnson a schema:Person, ex:Researcher ;
          schema:name "Dr. Alice Johnson" ;
          schema:jobTitle "Associate Professor" ;
          schema:affiliation ex:org/mit-csail ;
          ex:researchArea ex:concept/machine-learning,
                         ex:concept/natural-language-processing ;
          ex:principalInvestigator ex:project/neural-architecture-search .
      
      # Publications with authorship
      ex:publication/deep-learning-advances a schema:ScholarlyArticle ;
          schema:name "Deep Learning Advances" ;
          schema:author ex:researcher/dr-alice-johnson,
                        ex:researcher/prof-robert-chen ;
          ex:citedBy ex:publication/quantum-computing-survey ;
          dct:subject ex:concept/deep-learning .
      
      # Organizations with hierarchical structure
      ex:org/mit-csail a schema:Organization ;
          schema:name "MIT Computer Science and Artificial Intelligence Laboratory" ;
          schema:parentOrganization ex:org/mit ;
          ex:hasResearcher ex:researcher/dr-alice-johnson ;
          ex:hostProject ex:project/neural-architecture-search .
      
      # Projects with complex relationships
      ex:project/neural-architecture-search a ex:ResearchProject ;
          schema:name "Neural Architecture Search" ;
          ex:fundedBy ex:org/nsf ;
          ex:principalInvestigator ex:researcher/dr-alice-johnson ;
          ex:produces ex:publication/deep-learning-advances ;
          ex:collaboratesWith ex:project/ethical-ai-framework .
      """

  Scenario: Generate temporal knowledge graph with event sequencing
    Given I have temporal events in academic careers:
      | Event Type | Date | Description |
      | Education | 2015-05-15 | "PhD in Computer Science completed" |
      | Employment | 2015-08-01 | "Started as Assistant Professor" |
      | Publication | 2016-03-10 | "First major paper published" |
      | Grant | 2017-01-01 | "NSF grant awarded" |
      | Promotion | 2021-09-01 | "Promoted to Associate Professor" |
    When I generate temporal knowledge graph using date sequencing filters
    Then the temporal relationships should be properly represented:
      """
      @prefix time: <http://www.w3.org/2006/time#> .
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      
      # Career timeline
      ex:researcher/dr-alice-johnson ex:hasCareerTimeline ex:timeline/alice-johnson .
      
      ex:timeline/alice-johnson a ex:CareerTimeline ;
          ex:hasEvent ex:event/phd-completion,
                      ex:event/assistant-professor-start,
                      ex:event/first-publication,
                      ex:event/nsf-grant-award,
                      ex:event/associate-professor-promotion .
      
      # Individual events with temporal ordering
      ex:event/phd-completion a ex:EducationEvent ;
          time:hasTime "2015-05-15"^^xsd:date ;
          prov:precedes ex:event/assistant-professor-start ;
          ex:degree "PhD in Computer Science" .
      
      ex:event/assistant-professor-start a ex:EmploymentEvent ;
          time:hasTime "2015-08-01"^^xsd:date ;
          prov:follows ex:event/phd-completion ;
          prov:precedes ex:event/first-publication ;
          ex:position "Assistant Professor" .
      
      ex:event/first-publication a ex:PublicationEvent ;
          time:hasTime "2016-03-10"^^xsd:date ;
          prov:follows ex:event/assistant-professor-start ;
          ex:enabledBy ex:event/nsf-grant-award ;
          ex:publication ex:publication/first-major-paper .
      
      # Causal relationships
      ex:event/nsf-grant-award ex:enables ex:event/first-publication .
      ex:event/first-publication ex:contributes-to ex:event/associate-professor-promotion .
      """

  Scenario: Generate knowledge graph with probabilistic relationships
    Given I have research collaborations with confidence scores:
      | Researcher A | Researcher B | Collaboration Type | Confidence |
      | Alice Johnson | Robert Chen | Direct Co-authorship | 0.95 |
      | Alice Johnson | Maria Garcia | Indirect via Conference | 0.72 |
      | Robert Chen | David Kim | Shared Research Area | 0.48 |
    When I generate probabilistic knowledge graph using confidence filtering
    Then the relationships should include uncertainty measures:
      """
      @prefix ex: <http://example.org/> .
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix schema: <http://schema.org/> .
      
      # High confidence direct collaboration
      ex:researcher/dr-alice-johnson ex:collaboratesWith ex:researcher/prof-robert-chen .
      
      ex:collaboration/alice-robert a ex:ResearchCollaboration ;
          ex:hasParticipant ex:researcher/dr-alice-johnson,
                           ex:researcher/prof-robert-chen ;
          ex:collaborationType "Direct Co-authorship" ;
          ex:confidenceScore 0.95 ;
          ex:evidenceType ex:CoAuthorshipEvidence ;
          prov:generatedBy ex:analysis/collaboration-detection .
      
      # Medium confidence indirect collaboration  
      ex:researcher/dr-alice-johnson ex:hasConnection [
          a ex:IndirectCollaboration ;
          ex:connectedTo ex:researcher/maria-garcia ;
          ex:connectionType "Conference Co-attendance" ;
          ex:confidenceScore 0.72 ;
          ex:requiresValidation true
      ] .
      
      # Low confidence potential collaboration
      ex:researcher/prof-robert-chen ex:potentialCollaboration [
          a ex:PotentialCollaboration ;
          ex:candidateCollaborator ex:researcher/david-kim ;
          ex:basisFor "Shared Research Area" ;
          ex:confidenceScore 0.48 ;
          ex:recommendationStrength ex:Weak
      ] .
      """

  Scenario: Generate knowledge graph with multi-modal data integration
    Given I have multi-modal research data:
      | Modality | Data Type | Examples |
      | Text | Research Papers | PDF documents, abstracts |
      | Image | Figures/Charts | Plots, diagrams, photos |
      | Audio | Presentations | Conference talks, interviews |
      | Video | Lectures | Recorded classes, demos |
      | Data | Datasets | CSV, JSON, RDF files |
    When I generate multi-modal knowledge graph using content-type filtering
    Then the graph should integrate all data modalities:
      """
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      
      # Research paper with multiple modalities
      ex:publication/neural-networks-survey a schema:ScholarlyArticle ;
          schema:name "Neural Networks: A Comprehensive Survey" ;
          ex:hasTextContent ex:content/paper-text ;
          ex:hasFigure ex:media/figure-1,
                      ex:media/figure-2 ;
          ex:hasSupplementaryData ex:dataset/neural-net-benchmarks ;
          ex:hasPresentation ex:media/conference-presentation .
      
      # Text content with NLP-derived metadata
      ex:content/paper-text a ex:TextualContent ;
          schema:text "Neural networks have revolutionized..." ;
          ex:wordCount 8500 ;
          ex:hasKeyword "neural networks", "deep learning", "artificial intelligence" ;
          ex:sentimentScore 0.7 ;
          ex:readabilityScore 0.65 .
      
      # Visual content with computer vision metadata
      ex:media/figure-1 a schema:ImageObject ;
          schema:name "Neural Network Architecture Diagram" ;
          schema:contentUrl <http://example.org/figures/nn-architecture.png> ;
          ex:imageWidth 800 ;
          ex:imageHeight 600 ;
          ex:detectedObjects "flowchart", "neural network", "arrows" ;
          ex:colorPalette "blue", "orange", "gray" .
      
      # Audio content with speech recognition metadata
      ex:media/conference-presentation a schema:AudioObject ;
          schema:name "ICML 2024 Presentation" ;
          schema:duration "PT25M30S" ;
          ex:transcription ex:content/presentation-transcript ;
          ex:speakerCount 1 ;
          ex:audioQuality "high" ;
          ex:detectedLanguage "en" .
      
      # Dataset with statistical metadata
      ex:dataset/neural-net-benchmarks a dcat:Dataset ;
          dcat:title "Neural Network Benchmark Results" ;
          dcat:format "text/csv" ;
          ex:rowCount 10000 ;
          ex:columnCount 25 ;
          ex:hasStatistics ex:stats/benchmark-summary ;
          ex:dataQuality 0.92 .
      """

  Scenario: Generate knowledge graph with provenance tracking
    Given I have research data with complex provenance chains:
      | Source | Transformation | Output | Agent |
      | Raw Survey Data | Statistical Analysis | Summary Report | Research Assistant |
      | Literature Search | Citation Analysis | Citation Network | PhD Student |  
      | Interview Transcripts | Content Analysis | Theme Categories | Professor |
    When I generate provenance-aware knowledge graph using PROV-O filtering
    Then the provenance information should be comprehensive:
      """
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      @prefix schema: <http://schema.org/> .
      
      # Final research output
      ex:publication/research-findings a schema:ScholarlyArticle ;
          schema:name "Emerging Trends in AI Research" ;
          prov:wasDerivedFrom ex:data/survey-summary,
                              ex:data/citation-network,
                              ex:data/interview-themes .
      
      # Survey data transformation chain
      ex:data/survey-summary a ex:SummaryReport ;
          prov:wasDerivedFrom ex:data/raw-survey-responses ;
          prov:wasGeneratedBy ex:activity/statistical-analysis .
      
      ex:activity/statistical-analysis a prov:Activity ;
          prov:used ex:data/raw-survey-responses ;
          prov:wasAssociatedWith ex:agent/research-assistant ;
          prov:startedAtTime "2024-01-15T09:00:00Z"^^xsd:dateTime ;
          prov:endedAtTime "2024-01-20T17:30:00Z"^^xsd:dateTime ;
          ex:analysisMethod "descriptive-statistics", "regression-analysis" .
      
      # Citation analysis chain
      ex:data/citation-network a ex:CitationGraph ;
          prov:wasDerivedFrom ex:data/literature-search-results ;
          prov:wasGeneratedBy ex:activity/citation-analysis .
      
      ex:activity/citation-analysis a prov:Activity ;
          prov:used ex:data/literature-search-results ;
          prov:wasAssociatedWith ex:agent/phd-student ;
          prov:used ex:software/citation-analysis-tool ;
          ex:algorithmUsed "co-citation-analysis" .
      
      # Qualitative analysis chain
      ex:data/interview-themes a ex:ThematicAnalysis ;
          prov:wasDerivedFrom ex:data/interview-transcripts ;
          prov:wasGeneratedBy ex:activity/content-analysis .
      
      ex:activity/content-analysis a prov:Activity ;
          prov:wasAssociatedWith ex:agent/professor ;
          ex:codingScheme ex:scheme/thematic-coding ;
          ex:interraterReliability 0.87 .
      
      # Agents and their roles
      ex:agent/research-assistant a prov:Person ;
          schema:name "Sarah Johnson" ;
          ex:role "Research Assistant" ;
          ex:expertise "statistical-analysis" .
      
      ex:agent/phd-student a prov:Person ;
          schema:name "Michael Chang" ;
          ex:role "PhD Student" ;
          ex:expertise "bibliometrics", "citation-analysis" .
      
      ex:agent/professor a prov:Person ;
          schema:name "Dr. Linda Rodriguez" ;
          ex:role "Principal Investigator" ;
          ex:expertise "qualitative-research", "thematic-analysis" .
      """

  Scenario: Generate cross-domain knowledge graph with ontology alignment
    Given I have data from multiple domains:
      | Domain | Ontology | Key Concepts |
      | Computer Science | ACM Computing Classification | "Machine Learning", "Human-Computer Interaction" |
      | Biomedicine | Gene Ontology | "Protein Function", "Cellular Process" |
      | Social Science | ELSST Thesaurus | "Social Behavior", "Research Methods" |
    When I generate cross-domain knowledge graph using ontology alignment filters
    Then the graph should bridge domain boundaries:
      """
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix acm: <http://dl.acm.org/ccs/> .
      @prefix go: <http://purl.obolibrary.org/obo/GO_> .
      @prefix elsst: <http://elsst.cessda.eu/> .
      @prefix ex: <http://example.org/> .
      
      # Cross-domain research project
      ex:project/computational-biology-hci a ex:InterdisciplinaryProject ;
          ex:involvesDomain ex:domain/computer-science,
                           ex:domain/biomedicine,
                           ex:domain/social-science ;
          ex:primaryConcept acm:10010147.10010178,  # Machine Learning
                           go:0003674,              # Protein Function  
                           elsst:research-methods . # Research Methods
      
      # Cross-domain concept alignments
      acm:10010147.10010257 skos:related go:0006807 .  # HCI related to metabolic process
      go:0008150 skos:broader elsst:social-behavior .   # biological process broader than social behavior
      
      # Interdisciplinary research output
      ex:publication/ai-protein-interaction-study a schema:ScholarlyArticle ;
          ex:addressesConcept acm:10010147.10010178,    # ML techniques
                              go:0005515,               # protein binding
                              elsst:human-computer-interaction ;
          ex:usesMethodology ex:method/ml-protein-analysis ;
          ex:validates ex:hypothesis/ai-enhances-protein-research .
      
      # Cross-domain methodology
      ex:method/ml-protein-analysis a ex:ComputationalMethod ;
          ex:combinesApproach ex:approach/machine-learning,
                              ex:approach/bioinformatics,
                              ex:approach/user-study ;
          ex:requiresExpertise acm:10010147,     # CS expertise
                               go:0003674,       # biological expertise
                               elsst:research-methods . # social science methods
      """