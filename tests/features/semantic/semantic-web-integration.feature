Feature: Semantic Web Integration Testing with Real-World Scenarios
  As a semantic web application developer
  I want to test complete integration workflows for semantic web data processing
  So that I can ensure my templates work correctly with real semantic web tools and data

  Background:
    Given I have a complete semantic web testing environment
    And I have access to RDF validation tools
    And I have SPARQL endpoint testing capabilities
    And I have semantic reasoning validation

  Scenario: End-to-end academic knowledge graph generation and validation
    Given I have a comprehensive academic dataset with:
      | Data Type | Source | Format | Records |
      | Researchers | ORCID API | JSON | 1000 |
      | Publications | CrossRef API | JSON | 5000 |
      | Organizations | ROR API | JSON | 100 |
      | Subjects | ACM Classification | RDF/XML | 2000 |
    When I process the complete dataset through semantic templates
    Then I should generate valid RDF that:
      - Passes W3C RDF validation
      - Contains proper namespace declarations
      - Includes bidirectional relationships
      - Maintains referential integrity
      - Supports SPARQL querying
    And the knowledge graph should answer complex queries like:
      """
      # Find researchers with similar expertise who haven't collaborated
      PREFIX ex: <http://example.org/>
      PREFIX schema: <http://schema.org/>
      
      SELECT ?researcher1 ?researcher2 ?sharedExpertise
      WHERE {
          ?researcher1 ex:expertise ?expertise .
          ?researcher2 ex:expertise ?expertise .
          ?researcher1 schema:name ?name1 .
          ?researcher2 schema:name ?name2 .
          
          FILTER(?researcher1 != ?researcher2)
          FILTER NOT EXISTS {
              ?researcher1 ex:collaboratesWith ?researcher2
          }
          
          BIND(?expertise as ?sharedExpertise)
      }
      GROUP BY ?researcher1 ?researcher2 ?sharedExpertise
      HAVING (COUNT(?sharedExpertise) >= 2)
      ORDER BY DESC(COUNT(?sharedExpertise))
      LIMIT 20
      """

  Scenario: Schema.org structured data generation for academic profiles
    Given I have academic profile data requiring schema.org markup
    And I need JSON-LD output for web publication
    When I generate schema.org compliant JSON-LD using semantic templates
    Then the output should validate against schema.org specifications:
      """
      {
        "@context": "https://schema.org/",
        "@type": "Person",
        "@id": "https://example.org/researcher/{{ researcher.slug }}",
        "name": "{{ researcher.fullName }}",
        "givenName": "{{ researcher.firstName }}",
        "familyName": "{{ researcher.lastName }}",
        "email": "{{ researcher.email }}",
        "jobTitle": "{{ researcher.position }}",
        "affiliation": {
          "@type": "Organization",
          "@id": "https://example.org/org/{{ researcher.organization.slug }}",
          "name": "{{ researcher.organization.name }}",
          "url": "{{ researcher.organization.website }}"
        },
        "alumniOf": [
          {% for degree in researcher.education %}
          {
            "@type": "EducationalOrganization",
            "name": "{{ degree.institution }}",
            "degree": {
              "@type": "EducationalOccupationalCredential",
              "educationalCredentialAwarded": "{{ degree.type }}",
              "about": "{{ degree.field }}"
            }
          }{% if not loop.last %},{% endif %}
          {% endfor %}
        ],
        "author": [
          {% for publication in researcher.publications %}
          {
            "@type": "ScholarlyArticle",
            "@id": "https://doi.org/{{ publication.doi }}",
            "name": "{{ publication.title }}",
            "datePublished": "{{ publication.date | formatDate('YYYY-MM-DD') }}",
            "publisher": {
              "@type": "Organization",
              "name": "{{ publication.journal }}"
            },
            "citation": "{{ publication.citationCount }}"
          }{% if not loop.last %},{% endif %}
          {% endfor %}
        ],
        "knowsAbout": [
          {% for expertise in researcher.expertiseAreas %}
          "{{ expertise }}"{% if not loop.last %},{% endif %}
          {% endfor %}
        ]
      }
      """
    And the JSON-LD should pass Google's Structured Data Testing Tool
    And it should be consumable by academic search engines

  Scenario: FAIR data principles compliance testing
    Given I have research datasets that must comply with FAIR principles
    And I need to generate metadata following FAIR guidelines
    When I create FAIR-compliant metadata using semantic templates
    Then the metadata should be:
      - **Findable**: Assigned persistent identifiers and rich metadata
      - **Accessible**: Available through standardized protocols
      - **Interoperable**: Uses standard vocabularies and formats
      - **Reusable**: Has clear usage licenses and provenance
    And should include:
      """
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/dataset/> .
      
      # Findable - Persistent ID and rich metadata
      ex:{{ dataset.slug }} a dcat:Dataset ;
          dct:identifier "{{ dataset.doi }}" ;
          dct:title "{{ dataset.title }}" ;
          dct:description "{{ dataset.description }}" ;
          dcat:keyword {% for keyword in dataset.keywords %}"{{ keyword }}"{% if not loop.last %}, {% endif %}{% endfor %} ;
          dct:subject <{{ dataset.subjectUri }}> ;
          dct:spatial <{{ dataset.spatialCoverage }}> ;
          dct:temporal "{{ dataset.temporalCoverage }}" .
      
      # Accessible - Standard protocols
      ex:{{ dataset.slug }} dcat:distribution [
          a dcat:Distribution ;
          dcat:accessURL <{{ dataset.accessUrl }}> ;
          dcat:downloadURL <{{ dataset.downloadUrl }}> ;
          dct:format <http://www.w3.org/ns/formats/{{ dataset.format | upper }}> ;
          dcat:mediaType "{{ dataset.mimeType }}" ;
          dct:license <{{ dataset.license }}> 
      ] .
      
      # Interoperable - Standard vocabularies
      ex:{{ dataset.slug }} dct:conformsTo <{{ dataset.metadataStandard }}> ;
          dcat:theme <{{ dataset.theme }}> ;
          dct:accrualPeriodicity <{{ dataset.updateFrequency }}> .
      
      # Reusable - Provenance and licensing
      ex:{{ dataset.slug }} prov:wasGeneratedBy [
          a prov:Activity ;
          prov:wasAssociatedWith <{{ dataset.creator }}> ;
          prov:used <{{ dataset.sourceData }}> ;
          prov:startedAtTime "{{ dataset.creationDate | formatDate('YYYY-MM-DDTHH:mm:ss') }}"^^xsd:dateTime
      ] ;
          dct:license <{{ dataset.license }}> ;
          dct:rights "{{ dataset.rightsStatement }}" ;
          dct:accessRights <{{ dataset.accessRights }}> .
      """

  Scenario: Cross-platform semantic data validation and transformation
    Given I have semantic data that needs validation across multiple platforms
    And I need to ensure compatibility with various RDF tools
    When I validate generated RDF using multiple validation services
    Then the RDF should pass validation by:
      - W3C RDF Validator
      - Apache Jena RIOT
      - RDF4J Rio parser
      - TopQuadrant SHACL validator
      - pySHACL validation
    And should support transformations between formats:
      | Source Format | Target Format | Tool |
      | Turtle | RDF/XML | rapper |
      | JSON-LD | N-Triples | jsonld-cli |
      | RDF/XML | N-Quads | rdf4j-tools |
      | Turtle | JSON-LD | pyld |

  Scenario: Performance testing for large-scale knowledge graph generation
    Given I have performance requirements for semantic data generation
    And I need to process large datasets efficiently
    When I generate knowledge graphs from datasets of various sizes:
      | Dataset Size | Expected Generation Time | Memory Usage Limit |
      | 1K entities | < 10 seconds | < 100MB |
      | 10K entities | < 2 minutes | < 500MB |
      | 100K entities | < 20 minutes | < 2GB |
      | 1M entities | < 3 hours | < 8GB |
    Then the generation process should:
      - Complete within time limits for each dataset size
      - Stay within memory constraints
      - Generate valid RDF for all entity counts
      - Maintain consistent quality across all scales
      - Support streaming/incremental processing for large datasets

  Scenario: Semantic search and discovery validation
    Given I have generated semantic data for research discovery
    And I need to test search and discovery capabilities
    When I query the knowledge graph using various discovery patterns
    Then I should be able to find relevant information using:
      """
      # Expertise-based researcher discovery
      PREFIX ex: <http://example.org/>
      PREFIX schema: <http://schema.org/>
      
      SELECT ?researcher ?name ?expertise ?score
      WHERE {
          ?researcher a ex:Researcher ;
                      schema:name ?name ;
                      ex:expertise ?expertise .
          
          # Text search across expertise areas
          ?expertise bif:contains "machine learning AND neural networks" .
          
          # Calculate relevance score
          BIND(
              IF(CONTAINS(LCASE(?expertise), "deep learning"), 10, 0) +
              IF(CONTAINS(LCASE(?expertise), "neural networks"), 8, 0) +
              IF(CONTAINS(LCASE(?expertise), "machine learning"), 6, 0)
              as ?score
          )
      }
      ORDER BY DESC(?score) ?name
      LIMIT 20
      """
    And support faceted search across multiple dimensions:
      - Research area facets
      - Institution facets  
      - Publication year facets
      - Collaboration network facets
      - Geographic location facets

  Scenario: Real-time semantic data integration and updates
    Given I have semantic data that changes frequently
    And I need to maintain consistency during updates
    When I implement incremental updates to the knowledge graph
    Then the system should:
      - Support atomic updates using SPARQL UPDATE
      - Maintain referential integrity during changes
      - Provide versioning and change tracking
      - Enable rollback capabilities
      - Support concurrent read access during updates
    And should handle update operations like:
      """
      # Add new publication with author linking
      PREFIX ex: <http://example.org/>
      PREFIX schema: <http://schema.org/>
      PREFIX dct: <http://purl.org/dc/terms/>
      
      INSERT {
          ex:publication/{{ newPub.slug }} a schema:ScholarlyArticle ;
              schema:name "{{ newPub.title }}" ;
              dct:date "{{ newPub.date | formatDate('YYYY-MM-DD') }}"^^xsd:date ;
              schema:author {% for author in newPub.authors %}ex:researcher/{{ author.slug }}{% if not loop.last %}, {% endif %}{% endfor %} .
          
          {% for author in newPub.authors %}
          ex:researcher/{{ author.slug }} ex:publicationCount ?newCount{{ loop.index }} .
          {% endfor %}
      }
      WHERE {
          {% for author in newPub.authors %}
          ex:researcher/{{ author.slug }} ex:publicationCount ?currentCount{{ loop.index }} .
          BIND(?currentCount{{ loop.index }} + 1 as ?newCount{{ loop.index }})
          {% endfor %}
      }
      """

  Scenario: Semantic web API generation and testing
    Given I have semantic data that needs API exposure
    And I need RESTful and GraphQL APIs for the knowledge graph
    When I generate API endpoints using semantic templates
    Then I should have working APIs that support:
      - RESTful resource access with content negotiation
      - GraphQL queries with semantic field resolution
      - SPARQL endpoint exposure
      - Linked Data Platform (LDP) compliance
    And API responses should include proper headers:
      ```
      # For RDF resources
      HTTP/1.1 200 OK
      Content-Type: {{ contentType }}
      Link: <{{ resourceUri }}>; rel="self"
      Link: <{{ ontologyUri }}>; rel="type"
      Vary: Accept
      ETag: "{{ resourceHash }}"
      Last-Modified: {{ lastModified | formatDate('ddd, DD MMM YYYY HH:mm:ss') }} GMT
      
      # For SPARQL endpoints
      HTTP/1.1 200 OK
      Content-Type: application/sparql-results+json
      Access-Control-Allow-Origin: *
      Cache-Control: no-cache
      ```