Feature: Linked Data Resource Generation with URI Filtering
  As a linked data publisher
  I want to generate properly formatted resource URIs and descriptions
  So that my data follows linked data principles and is discoverable

  Background:
    Given I have an unjucks template system for linked data generation
    And I have URI generation filters: slug, kebabCase, pascalCase
    And I have a base URI namespace configured

  Scenario: Generate person resource with slug-based URI
    Given I have a person with name "Dr. John A. Smith-Wilson"
    When I generate a linked data resource using slug filter
    Then the resource URI should be "http://example.org/person/dr-john-a-smith-wilson"
    And the resource description should be:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/person/> .
      
      ex:dr-john-a-smith-wilson a schema:Person ;
          schema:name "Dr. John A. Smith-Wilson" ;
          schema:url <http://example.org/person/dr-john-a-smith-wilson> ;
          schema:identifier "dr-john-a-smith-wilson" .
      """

  Scenario: Generate organization resource with hierarchical URIs
    Given I have an organization "MIT Computer Science & Artificial Intelligence Lab"
    And department "Natural Language Processing Group"
    When I generate hierarchical linked data resources using kebabCase filter
    Then the organization URI should be "http://example.org/org/mit-computer-science-artificial-intelligence-lab"
    And the department URI should be "http://example.org/org/mit-computer-science-artificial-intelligence-lab/dept/natural-language-processing-group"
    And the resources should be:
      """
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/org/> .
      
      ex:mit-computer-science-artificial-intelligence-lab a schema:Organization ;
          schema:name "MIT Computer Science & Artificial Intelligence Lab" ;
          schema:url <http://example.org/org/mit-computer-science-artificial-intelligence-lab> .
          
      ex:mit-computer-science-artificial-intelligence-lab/dept/natural-language-processing-group a schema:OrganizationRole ;
          schema:name "Natural Language Processing Group" ;
          schema:parentOrganization ex:mit-computer-science-artificial-intelligence-lab ;
          schema:url <http://example.org/org/mit-computer-science-artificial-intelligence-lab/dept/natural-language-processing-group> .
      """

  Scenario: Generate publication resource with DOI-based URIs
    Given I have a publication with title "Advances in Large Language Model Training: A Comprehensive Survey"
    And DOI "10.1000/182"
    And authors: ["Jane Smith", "Robert Johnson", "María García"]
    When I generate publication resource using multiple URI schemes
    Then I should get both DOI-based and slug-based URIs:
      """
      @prefix schema: <http://schema.org/> .
      @prefix bibo: <http://purl.org/ontology/bibo/> .
      @prefix ex: <http://example.org/publication/> .
      
      <https://doi.org/10.1000/182> a schema:ScholarlyArticle ;
          schema:name "Advances in Large Language Model Training: A Comprehensive Survey" ;
          schema:sameAs ex:advances-in-large-language-model-training-a-comprehensive-survey ;
          bibo:doi "10.1000/182" ;
          schema:author ex:person/jane-smith,
                        ex:person/robert-johnson,
                        ex:person/maria-garcia .
      
      ex:advances-in-large-language-model-training-a-comprehensive-survey a schema:ScholarlyArticle ;
          schema:sameAs <https://doi.org/10.1000/182> .
      """

  Scenario: Generate dataset resource with versioned URIs
    Given I have a dataset "COVID-19 Research Publications Dataset"
    And version "v2.1.3"
    And creation date "2025-01-15"
    When I generate versioned dataset resource using date and version filters
    Then the resource should include version-specific URIs:
      """
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix pav: <http://purl.org/pav/> .
      @prefix ex: <http://example.org/dataset/> .
      
      ex:covid-19-research-publications-dataset a dcat:Dataset ;
          dct:title "COVID-19 Research Publications Dataset" ;
          pav:hasCurrentVersion ex:covid-19-research-publications-dataset/v2.1.3 ;
          dcat:landingPage <http://example.org/dataset/covid-19-research-publications-dataset> .
      
      ex:covid-19-research-publications-dataset/v2.1.3 a dcat:Dataset ;
          dct:isVersionOf ex:covid-19-research-publications-dataset ;
          pav:version "v2.1.3" ;
          dct:created "2025-01-15"^^xsd:date ;
          dcat:downloadURL <http://example.org/dataset/covid-19-research-publications-dataset/v2.1.3/download> .
      """

  Scenario: Generate concept scheme with hierarchical concept URIs
    Given I have a concept scheme "Academic Subject Classification"
    And concepts with hierarchy:
      | Level 1 | Level 2 | Level 3 |
      | Computer Science | Artificial Intelligence | Machine Learning |
      | Computer Science | Artificial Intelligence | Natural Language Processing |
      | Computer Science | Software Engineering | Testing |
    When I generate SKOS concept scheme using hierarchical URI filtering
    Then the concept scheme should be:
      """
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix ex: <http://example.org/concepts/> .
      
      ex:academic-subject-classification a skos:ConceptScheme ;
          skos:prefLabel "Academic Subject Classification"@en .
      
      ex:computer-science a skos:Concept ;
          skos:inScheme ex:academic-subject-classification ;
          skos:prefLabel "Computer Science"@en ;
          skos:topConceptOf ex:academic-subject-classification .
      
      ex:computer-science/artificial-intelligence a skos:Concept ;
          skos:inScheme ex:academic-subject-classification ;
          skos:prefLabel "Artificial Intelligence"@en ;
          skos:broader ex:computer-science .
      
      ex:computer-science/artificial-intelligence/machine-learning a skos:Concept ;
          skos:inScheme ex:academic-subject-classification ;
          skos:prefLabel "Machine Learning"@en ;
          skos:broader ex:computer-science/artificial-intelligence .
      
      ex:computer-science/artificial-intelligence/natural-language-processing a skos:Concept ;
          skos:inScheme ex:academic-subject-classification ;
          skos:prefLabel "Natural Language Processing"@en ;
          skos:broader ex:computer-science/artificial-intelligence .
      
      ex:computer-science/software-engineering a skos:Concept ;
          skos:inScheme ex:academic-subject-classification ;
          skos:prefLabel "Software Engineering"@en ;
          skos:broader ex:computer-science .
      
      ex:computer-science/software-engineering/testing a skos:Concept ;
          skos:inScheme ex:academic-subject-classification ;
          skos:prefLabel "Testing"@en ;
          skos:broader ex:computer-science/software-engineering .
      """

  Scenario: Generate geo-referenced resource with coordinate-based URIs
    Given I have locations with coordinates:
      | Name | Latitude | Longitude |
      | MIT Campus | 42.3601 | -71.0942 |
      | Stanford University | 37.4275 | -122.1697 |
    When I generate geo-referenced resources using coordinate-based URI schemes
    Then the resources should include proper geo URIs:
      """
      @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
      @prefix gn: <http://www.geonames.org/ontology#> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/place/> .
      
      ex:mit-campus a schema:Place ;
          schema:name "MIT Campus" ;
          geo:lat 42.3601 ;
          geo:long -71.0942 ;
          schema:sameAs <geo:42.3601,-71.0942> ;
          ex:coordinateUri <http://example.org/geo/42.3601,-71.0942> .
      
      ex:stanford-university a schema:Place ;
          schema:name "Stanford University" ;
          geo:lat 37.4275 ;
          geo:long -122.1697 ;
          schema:sameAs <geo:37.4275,-122.1697> ;
          ex:coordinateUri <http://example.org/geo/37.4275,-122.1697> .
      """

  Scenario: Generate multimedia resource with content-based URIs
    Given I have multimedia files:
      | Type | Title | Format | Size |
      | Image | "Conference Presentation Slide 1" | PNG | 2MB |
      | Video | "Tutorial: Introduction to RDF" | MP4 | 150MB |
      | Audio | "Podcast Episode 42: Semantic Web" | MP3 | 45MB |
    When I generate multimedia resources using content-type and hash-based URIs
    Then the multimedia resources should be:
      """
      @prefix schema: <http://schema.org/> .
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix ex: <http://example.org/media/> .
      
      ex:image/conference-presentation-slide-1 a schema:ImageObject ;
          schema:name "Conference Presentation Slide 1" ;
          schema:encodingFormat "image/png" ;
          schema:contentSize "2097152"^^xsd:long ;
          dcat:downloadURL <http://example.org/media/image/conference-presentation-slide-1.png> ;
          ex:contentHash "sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" .
      
      ex:video/tutorial-introduction-to-rdf a schema:VideoObject ;
          schema:name "Tutorial: Introduction to RDF" ;
          schema:encodingFormat "video/mp4" ;
          schema:contentSize "157286400"^^xsd:long ;
          dcat:downloadURL <http://example.org/media/video/tutorial-introduction-to-rdf.mp4> ;
          ex:contentHash "sha256:b785c47d53bc4c1c35f6b9c4db1b36c4b7f01234567890abcdef1234567890ab" .
      
      ex:audio/podcast-episode-42-semantic-web a schema:AudioObject ;
          schema:name "Podcast Episode 42: Semantic Web" ;
          schema:encodingFormat "audio/mpeg" ;
          schema:contentSize "47185920"^^xsd:long ;
          dcat:downloadURL <http://example.org/media/audio/podcast-episode-42-semantic-web.mp3> ;
          ex:contentHash "sha256:c896d38a12b3c4d5e6f78901234567890abcdef1234567890abcdef1234567890" .
      """

  Scenario: Generate linked data with content negotiation headers
    Given I have a resource "research-group-nlp"
    And supported RDF formats: ["turtle", "rdf+xml", "jsonld", "n-triples"]
    When I generate content negotiation metadata
    Then the resource should support multiple representations:
      """
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix ex: <http://example.org/group/> .
      
      ex:research-group-nlp a schema:Organization ;
          schema:name "Natural Language Processing Research Group" ;
          dcat:distribution ex:research-group-nlp/turtle,
                           ex:research-group-nlp/rdf-xml,
                           ex:research-group-nlp/json-ld,
                           ex:research-group-nlp/n-triples .
      
      ex:research-group-nlp/turtle a dcat:Distribution ;
          dcat:accessURL <http://example.org/group/research-group-nlp> ;
          dct:format <http://www.w3.org/ns/formats/Turtle> ;
          dcat:mediaType "text/turtle" .
      
      ex:research-group-nlp/rdf-xml a dcat:Distribution ;
          dcat:accessURL <http://example.org/group/research-group-nlp> ;
          dct:format <http://www.w3.org/ns/formats/RDF_XML> ;
          dcat:mediaType "application/rdf+xml" .
      
      ex:research-group-nlp/json-ld a dcat:Distribution ;
          dcat:accessURL <http://example.org/group/research-group-nlp> ;
          dct:format <http://www.w3.org/ns/formats/JSON-LD> ;
          dcat:mediaType "application/ld+json" .
      
      ex:research-group-nlp/n-triples a dcat:Distribution ;
          dcat:accessURL <http://example.org/group/research-group-nlp> ;
          dct:format <http://www.w3.org/ns/formats/N-Triples> ;
          dcat:mediaType "application/n-triples" .
      """