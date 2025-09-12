Feature: Cache Management and Garbage Collection
  As a KGEN system administrator
  I want to manage cache lifecycle and perform garbage collection
  So that I can maintain optimal cache performance and prevent memory bloat

  Background:
    Given a KGEN cache management system is initialized
    And garbage collection policies are configured
    And cache monitoring is active

  Scenario: Execute mark-and-sweep garbage collection
    Given a cache with 1000 items
    And 200 items have not been accessed in 24 hours
    When mark-and-sweep garbage collection is triggered
    Then unreferenced items are identified and marked
    And marked items are swept from the cache
    And 200 items are removed from cache
    And cache memory is reclaimed

  Scenario: Implement LRU (Least Recently Used) eviction
    Given a cache at 95% capacity
    And new content needs to be cached
    When LRU eviction policy is applied
    Then least recently used items are identified
    And oldest items are evicted to make space
    And new content is successfully cached
    And cache capacity stays within limits

  Scenario: Execute generational garbage collection
    Given a cache with items of different ages:
      | Generation | Item Count | Age Range |
      | Young      | 300        | 0-1 hours |
      | Middle     | 500        | 1-24 hours |
      | Old        | 200        | >24 hours  |
    When generational GC is executed
    Then young generation is collected frequently
    And old generation is collected less frequently
    And cache performance is optimized

  Scenario: Schedule automatic garbage collection
    Given garbage collection is scheduled every 6 hours
    When the scheduled time arrives
    Then GC automatically executes
    And cache health is maintained
    And system performance impact is minimized
    And GC completion status is logged

  Scenario: Monitor cache health and trigger GC
    Given cache health thresholds:
      | Metric           | Threshold |
      | Memory Usage     | 90%       |
      | Fragmentation    | 15%       |
      | Stale Items      | 25%       |
    When any threshold is exceeded
    Then garbage collection is automatically triggered
    And cache health is restored
    And alerts are sent to administrators

  Scenario: Handle cache invalidation by pattern
    Given cached content with various patterns:
      | Content Pattern        | Item Count |
      | /api/users/*          | 50         |
      | /api/products/*       | 100        |
      | /static/images/*      | 200        |
    When pattern "/api/users/*" is invalidated
    Then all matching cached items are removed
    And other patterns remain unaffected
    And cache consistency is maintained

  Scenario: Implement time-based cache expiration
    Given cached items with TTL (Time To Live):
      | Content Hash | TTL      | Age      |
      | hash1        | 1 hour   | 2 hours  |
      | hash2        | 24 hours | 12 hours |
      | hash3        | 1 week   | 3 days   |
    When TTL expiration check runs
    Then expired items (hash1) are automatically removed
    And valid items (hash2, hash3) remain cached
    And cache space is freed up

  Scenario: Execute incremental garbage collection
    Given a large cache requiring GC
    When incremental garbage collection is enabled
    Then GC work is distributed over time
    And system responsiveness is maintained
    And cache cleanup progresses gradually
    And user operations are not blocked

  Scenario: Manage cache during system maintenance
    Given a scheduled system maintenance window
    When maintenance mode is activated
    Then cache is safely persisted to disk
    And active requests are completed
    And cache state is preserved
    And system can restart with warm cache

  Scenario: Handle memory pressure scenarios
    Given system memory usage reaches 85%
    When memory pressure is detected
    Then aggressive cache eviction is triggered
    And memory usage is reduced to safe levels
    And critical system operations continue
    And cache rebuild begins when memory is available

  Scenario: Implement cache size limits and enforcement
    Given cache size limits:
      | Limit Type    | Maximum Value |
      | Total Size    | 10GB         |
      | Item Count    | 100000       |
      | Memory Usage  | 8GB          |
    When any limit is approached (90%)
    Then proactive eviction begins
    And cache stays within configured limits
    And system stability is maintained

  Scenario: Execute emergency cache flush
    Given a critical system issue requires cache reset
    When emergency cache flush is initiated
    Then all cached content is immediately purged
    And cache data structures are reset
    And system returns to clean state
    And cache rebuild can begin fresh

  Scenario: Track garbage collection statistics
    Given GC operations are executed
    When GC completes
    Then the following statistics are recorded:
      | Metric                  | Example Value |
      | Items Collected         | 150          |
      | Memory Reclaimed        | 2.5GB        |
      | GC Duration            | 45ms         |
      | Fragmentation Reduced   | 8%           |
    And statistics are available for monitoring
    And GC performance trends are tracked