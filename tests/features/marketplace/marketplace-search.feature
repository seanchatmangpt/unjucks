Feature: Marketplace Search
  As a developer
  I want to search for KPacks in the marketplace
  So that I can find relevant knowledge packages for my projects

  Background:
    Given the marketplace contains published KPacks
    And search indexing is up to date
    And I have access to the marketplace

  @smoke @search
  Scenario: Basic text search
    Given the marketplace contains KPacks with various names and descriptions
    When I search for "data visualization"
    Then I should receive search results within 500ms
    And the results should be ranked by relevance
    And each result should include:
      | field       |
      | name        |
      | description |
      | version     |
      | author      |
      | rating      |
      | download_count |

  @faceted-search @multi-dimensional
  Scenario: Multi-dimensional faceted search
    Given the marketplace contains KPacks with various facets
    When I search with the following filters:
      | facet_type   | facet_value      |
      | category     | machine-learning |
      | technology   | python          |
      | difficulty   | beginner        |
    Then the results should include only KPacks matching all criteria
    And the search should complete within 500ms
    And facet counts should be updated for available refinements

  @advanced-search @boolean
  Scenario: Advanced boolean search queries
    Given the marketplace contains diverse KPacks
    When I search using the query: "data AND (visualization OR analytics) NOT deprecated"
    Then the results should match the boolean logic
    And include KPacks containing "data" and either "visualization" or "analytics"
    And exclude any KPacks marked as deprecated
    And the search latency should be under 500ms

  @search-suggestions @autocomplete
  Scenario: Search suggestions and autocomplete
    Given I am typing in the search box
    When I enter "mach"
    Then I should receive autocomplete suggestions including:
      | suggestion           |
      | machine-learning     |
      | machine-vision       |
      | mathematical-tools   |
    And suggestions should appear within 200ms
    And be ranked by popularity and relevance

  @pagination @large-results
  Scenario: Paginated search results
    Given I search for a broad term that returns many results
    When I search for "tools"
    Then the first page should show 20 results
    And pagination controls should be available
    And I should be able to navigate to subsequent pages
    And each page load should complete within 500ms

  @filtering @sorting
  Scenario: Sort and filter search results
    Given I have search results for "analytics tools"
    When I apply the following sorting and filters:
      | action | value              |
      | sort   | most_downloads     |
      | filter | last_30_days       |
      | filter | rating_above_4     |
    Then the results should be reordered accordingly
    And show only KPacks matching the filters
    And the filtering should complete within 300ms

  @semantic-search @similarity
  Scenario: Semantic similarity search
    Given the marketplace has semantic search enabled
    When I search for "graph neural networks"
    Then the results should include semantically related KPacks like:
      | related_term              |
      | graph machine learning    |
      | neural graph processing   |
      | network analysis tools    |
    And semantic matches should be clearly indicated
    And relevance scores should reflect semantic similarity

  @search-analytics @trending
  Scenario: Trending and popular search results
    Given search analytics are tracked
    When I search without specific terms
    Then I should see trending KPacks prominently
    And popular searches should be suggested
    And recently published KPacks should be highlighted
    And the trending section should update based on real usage data

  @empty-results @no-matches
  Scenario: Handle searches with no results
    Given I search for a very specific non-existent term
    When I search for "zxywvutsrqp123impossible"
    Then I should receive a helpful "no results" message
    And be presented with search suggestions
    And see related or popular KPacks as alternatives
    And the response should be immediate (under 100ms)

  @performance @load-testing
  Scenario: Search performance under load
    Given multiple users are searching simultaneously
    When 100 concurrent users perform different searches
    Then each search should complete within 500ms
    And the search service should maintain responsiveness
    And no search requests should timeout or fail
    And search accuracy should remain consistent

  @personalization @recommendations
  Scenario: Personalized search results
    Given I have a search and download history
    And my preferences indicate interest in "data science" and "python"
    When I search for "tools"
    Then data science tools should be ranked higher
    And Python-based KPacks should receive preference
    And my interaction history should influence relevance scoring
    And personalized results should be clearly marked

  @export-search @saved-searches
  Scenario: Save and export search results
    Given I have performed a complex search with filters
    When I choose to save the search
    Then I should be able to name and save the search criteria
    And export results in multiple formats (JSON, CSV)
    And set up alerts for new KPacks matching my criteria
    And access saved searches from my profile