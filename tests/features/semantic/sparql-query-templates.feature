Feature: SPARQL Query Templates with Dynamic Filtering
  As a semantic web developer
  I want to generate SPARQL queries with properly filtered variables and patterns
  So that my queries are syntactically correct and semantically meaningful

  Background:
    Given I have an unjucks template system with SPARQL query support
    And I have access to camelCase, kebabCase, and snakeCase filters
    And I have a knowledge graph with sample data loaded

  Scenario: Generate basic SELECT query with filtered variables
    Given I have entity properties: ["first name", "last updated", "email address"]
    When I generate a SPARQL SELECT query using camelCase filter
    Then the query should be:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX ex: <http://example.org/>
      
      SELECT ?person ?firstName ?lastUpdated ?emailAddress
      WHERE {
          ?person a schema:Person ;
                  schema:givenName ?firstName ;
                  dct:modified ?lastUpdated ;
                  schema:email ?emailAddress .
      }
      """

  Scenario: Generate filtered CONSTRUCT query for data transformation
    Given I have source properties: ["user name", "creation date", "status code"]
    And target schema with camelCase naming convention
    When I generate a CONSTRUCT query with property mapping
    Then the output should be:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX ex: <http://example.org/>
      
      CONSTRUCT {
          ?person a schema:Person ;
                  schema:name ?userName ;
                  dct:created ?creationDate ;
                  ex:statusCode ?statusCode .
      }
      WHERE {
          ?person ex:user_name ?userName ;
                  ex:creation_date ?creationDate ;
                  ex:status_code ?statusCode .
      }
      """

  Scenario: Generate parameterized query with filter chains
    Given I have search parameters: ["research topic", "publication year", "author affiliation"]
    When I generate a parameterized SPARQL query using multiple filters
    Then the query template should include:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX ex: <http://example.org/>
      
      SELECT ?publication ?researchTopic ?publicationYear ?authorAffiliation
      WHERE {
          ?publication a schema:ScholarlyArticle ;
                      ex:researchTopic ?researchTopic ;
                      dct:date ?publicationYear ;
                      schema:author ?author .
          ?author schema:affiliation ?authorAffiliation .
          
          FILTER(?researchTopic = "{{ researchTopic | titleCase }}")
          FILTER(?publicationYear = {{ publicationYear | int }})
          FILTER(CONTAINS(LCASE(?authorAffiliation), LCASE("{{ authorAffiliation | trim }}")))
      }
      ORDER BY DESC(?publicationYear)
      LIMIT {{ limit | default(10) }}
      """

  Scenario: Generate aggregation query with grouped results
    Given I have aggregation fields: ["author count", "avg score", "publication count"]
    When I generate a SPARQL aggregation query using appropriate filters
    Then the query should include:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX ex: <http://example.org/>
      
      SELECT ?affiliation 
             (COUNT(DISTINCT ?author) as ?authorCount)
             (AVG(?score) as ?avgScore)
             (COUNT(?publication) as ?publicationCount)
      WHERE {
          ?author schema:affiliation ?affiliation ;
                  ex:score ?score ;
                  schema:author ?publication .
          ?publication a schema:ScholarlyArticle .
      }
      GROUP BY ?affiliation
      HAVING (?authorCount > {{ minAuthors | default(5) }})
      ORDER BY DESC(?avgScore)
      """

  Scenario: Generate federated query across multiple endpoints
    Given I have endpoints: ["dbpedia", "wikidata", "local graph"]
    And common properties: ["same as", "birth date", "known for"]
    When I generate a federated SPARQL query with filtered SERVICE clauses
    Then the query should be:
      """
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>
      PREFIX schema: <http://schema.org/>
      
      SELECT ?person ?sameAs ?birthDate ?knownFor
      WHERE {
          ?person a schema:Person ;
                  schema:name "{{ personName | titleCase }}" .
          
          SERVICE <http://dbpedia.org/sparql> {
              ?person owl:sameAs ?dbpediaEntity .
              ?dbpediaEntity dbo:birthDate ?birthDate ;
                            dbo:knownFor ?knownFor .
          }
          
          SERVICE <https://query.wikidata.org/sparql> {
              ?person owl:sameAs ?wikidataEntity .
              ?wikidataEntity wdt:P569 ?wikidataBirthDate .
          }
          
          BIND(?dbpediaEntity as ?sameAs)
      }
      """

  Scenario: Generate temporal SPARQL query with date range filtering
    Given I have temporal properties: ["start date", "end date", "last modified"]
    And date range parameters
    When I generate a temporal query using date filters
    Then the query should include:
      """
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX time: <http://www.w3.org/2006/time#>
      PREFIX ex: <http://example.org/>
      
      SELECT ?event ?startDate ?endDate ?lastModified
      WHERE {
          ?event a ex:Event ;
                 time:hasBeginning ?start ;
                 time:hasEnd ?end ;
                 dct:modified ?lastModified .
          
          ?start time:inXSDDate ?startDate .
          ?end time:inXSDDate ?endDate .
          
          FILTER(?startDate >= "{{ startDate | formatDate('YYYY-MM-DD') }}"^^xsd:date)
          FILTER(?endDate <= "{{ endDate | formatDate('YYYY-MM-DD') }}"^^xsd:date)
          FILTER(?lastModified >= "{{ sinceModified | formatDate('YYYY-MM-DDTHH:mm:ss') }}"^^xsd:dateTime)
      }
      ORDER BY ?startDate
      """

  Scenario: Generate SPARQL UPDATE with filtered property paths
    Given I have update operations for properties: ["user profile", "contact info", "preferences"]
    When I generate SPARQL UPDATE statements using property filters
    Then the update should be:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX ex: <http://example.org/>
      
      DELETE {
          ?person ex:userProfile ?oldProfile ;
                  ex:contactInfo ?oldContact ;
                  ex:preferences ?oldPrefs .
      }
      INSERT {
          ?person ex:userProfile "{{ userProfile | escape }}" ;
                  ex:contactInfo "{{ contactInfo | escape }}" ;
                  ex:preferences "{{ preferences | tojson | escape }}" ;
                  dct:modified "{{ now() | formatDate('YYYY-MM-DDTHH:mm:ss') }}"^^xsd:dateTime .
      }
      WHERE {
          ?person schema:identifier "{{ userId | escape }}" .
          OPTIONAL { ?person ex:userProfile ?oldProfile }
          OPTIONAL { ?person ex:contactInfo ?oldContact }
          OPTIONAL { ?person ex:preferences ?oldPrefs }
      }
      """

  Scenario: Generate complex path query with property sequences
    Given I have relationship paths: ["knows/colleague", "works for/department", "authored/co-author"]
    When I generate SPARQL property path queries using filter chains
    Then the query should include:
      """
      PREFIX schema: <http://schema.org/>
      PREFIX ex: <http://example.org/>
      
      SELECT ?person ?colleague ?department ?coAuthor
      WHERE {
          ?person a schema:Person ;
                  schema:name "{{ personName | titleCase }}" .
          
          # Direct and colleague connections
          ?person (schema:knows/ex:colleagueOf*) ?colleague .
          
          # Organizational hierarchy
          ?person (ex:worksFor/ex:partOf*) ?department .
          
          # Academic collaboration
          ?person (ex:authored/ex:coAuthor*) ?coAuthor .
          
          FILTER(?person != ?colleague)
          FILTER(?person != ?coAuthor)
      }
      LIMIT {{ maxResults | default(100) }}
      """

  Scenario: Generate geospatial SPARQL query with coordinate filtering
    Given I have location properties: ["geo coordinates", "place name", "country code"]
    And bounding box parameters
    When I generate a geospatial query using coordinate filters
    Then the query should be:
      """
      PREFIX geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>
      PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
      PREFIX schema: <http://schema.org/>
      
      SELECT ?place ?geoCoordinates ?placeName ?countryCode
      WHERE {
          ?place a schema:Place ;
                 geo:lat ?lat ;
                 geo:long ?long ;
                 schema:name ?placeName ;
                 schema:addressCountry ?countryCode .
          
          BIND(CONCAT(STR(?lat), ",", STR(?long)) as ?geoCoordinates)
          
          FILTER(?lat >= {{ minLat | round(6) }} && ?lat <= {{ maxLat | round(6) }})
          FILTER(?long >= {{ minLong | round(6) }} && ?long <= {{ maxLong | round(6) }})
          FILTER(LANG(?placeName) = "{{ language | default('en') }}")
      }
      ORDER BY ?placeName
      """