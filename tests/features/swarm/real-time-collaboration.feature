@collaboration @real-time @websocket @enterprise
Feature: Real-time Collaboration in Swarm Environment
  As an enterprise development team
  I want to collaborate in real-time on template generation
  So that multiple developers can work together efficiently

  Background:
    Given the MCP swarm is initialized with real-time capabilities
    And WebSocket server is running
    And I have valid collaboration credentials

  @collaboration @session-management
  Scenario: Join collaboration session
    Given a template editing session exists with ID "session-microservice-001"
    When I join the collaboration session
    And I provide my user details:
      | field        | value              |
      | userId       | dev-john-001       |
      | userName     | John Developer     |
      | tenantId     | enterprise-corp    |
      | role         | senior-developer   |
    Then I should be added to the session
    And I should receive current session state:
      | field          | type   |
      | sessionId      | string |
      | participants   | array  |
      | content        | string |
      | version        | number |
    And other participants should be notified of my joining

  @collaboration @presence-indicators
  Scenario: Real-time presence tracking
    Given I'm in a collaboration session with 4 other developers
    When participants change their status:
      | participant | status | activity      |
      | Alice       | active | editing       |
      | Bob         | idle   | reading       |
      | Carol       | away   | meeting       |
      | Dave        | active | debugging     |
    Then I should see updated presence indicators
    And presence should update within 500ms
    And each participant should have unique color coding
    And last activity timestamp should be tracked

  @collaboration @cursor-tracking
  Scenario: Real-time cursor and selection tracking
    Given I'm collaborating on template file "UserService.ts"
    When I move my cursor to line 45, column 12
    Then other participants should see my cursor position
    And my cursor should be colored with my assigned color
    When I select text from line 45-48
    Then other participants should see my selection
    And selection should be highlighted with my color
    When another participant moves their cursor
    Then I should see their cursor in real-time
    And cursor updates should be smooth and responsive

  @collaboration @content-synchronization
  Scenario: Operational transformation for concurrent edits
    Given I'm editing template content with another developer
    And current content is:
      ```typescript
      export class UserService {
        constructor() {}
      }
      ```
    When I insert "private db: Database;" at line 2, position 0
    And simultaneously Bob inserts "// User management service" at line 1
    Then operational transformation should resolve conflicts
    And final content should be:
      ```typescript
      // User management service
      export class UserService {
        private db: Database;
        constructor() {}
      }
      ```
    And both changes should be preserved
    And version history should be maintained

  @collaboration @conflict-resolution
  Scenario: Handle editing conflicts gracefully
    Given multiple developers edit the same line simultaneously
    When Alice types "getUserById" at position 10
    And Bob types "findUserById" at position 10
    And Carol types "getUser" at position 10
    Then the system should detect the conflict
    And should apply last-writer-wins strategy
    And should preserve all changes in version history
    And should notify participants of the conflict resolution
    And should allow manual conflict resolution if needed

  @collaboration @message-broadcasting
  Scenario: Team communication during collaboration
    Given I'm in a collaboration session with my team
    When I send a message "Let's refactor the auth logic"
    Then the message should broadcast to all participants
    And should include my user information:
      | field     | value              |
      | userId    | dev-john-001       |
      | userName  | John Developer     |
      | timestamp | current_time       |
      | message   | Let's refactor the auth logic |
    And message should appear in real-time chat
    And message history should be preserved
    When Bob replies "Good idea, I'll handle the JWT part"
    Then I should see his reply immediately
    And conversation thread should be maintained

  @collaboration @version-control
  Scenario: Track collaborative editing history
    Given we're collaboratively editing a microservice template
    When multiple developers make changes over time:
      | developer | timestamp | action              | content                    |
      | Alice     | 10:00:00  | insert              | Added import statements    |
      | Bob       | 10:02:30  | modify              | Updated constructor logic  |
      | Carol     | 10:05:15  | delete              | Removed deprecated method  |
      | Dave      | 10:08:45  | insert              | Added error handling       |
    Then version history should capture all changes
    And each version should include:
      | field       | type   | description           |
      | version     | number | Incremental version   |
      | timestamp   | date   | When change occurred  |
      | author      | object | Who made the change   |
      | operation   | object | What changed          |
      | content     | string | Full content snapshot |
    And I should be able to view any previous version
    And I should be able to rollback to any version

  @collaboration @permission-management
  Scenario: Role-based collaboration permissions
    Given I have "editor" permissions in the session
    And Bob has "viewer" permissions
    And Carol has "admin" permissions
    When I try to edit the template content
    Then I should be allowed to make changes
    When Bob tries to edit the template content
    Then he should be restricted to read-only mode
    And should see "View-only mode" indicator
    When Carol manages session permissions
    Then she should be able to promote Bob to "editor"
    And should be able to invite new participants
    And should be able to lock/unlock the session

  @collaboration @enterprise-integration
  Scenario: SSO integration for collaboration
    Given enterprise SSO is configured
    When I attempt to join a collaboration session
    Then I should be redirected to SSO login
    And should authenticate via corporate IdP
    When authentication succeeds
    Then I should be automatically added to session
    And my corporate profile should be populated:
      | field        | source           |
      | displayName  | LDAP directory   |
      | email        | Corporate email  |
      | department   | HR system        |
      | role         | Permission system|
    And my access level should match corporate permissions

  @collaboration @audit-logging
  Scenario: Comprehensive collaboration audit trail
    Given audit logging is enabled for the session
    When various collaboration events occur:
      | event_type           | details                        |
      | session_joined       | User Alice joined session     |
      | content_modified     | Line 25 changed by Bob        |
      | cursor_moved         | Carol cursor at line 30       |
      | message_sent         | Dave sent team message        |
      | permission_changed   | Admin promoted user role      |
      | session_left         | User Alice left session       |
    Then all events should be logged with:
      | field       | type      | description              |
      | eventId     | string    | Unique event identifier  |
      | timestamp   | datetime  | Precise event time       |
      | sessionId   | string    | Collaboration session    |
      | userId      | string    | Who performed action     |
      | eventType   | string    | Type of event            |
      | eventData   | object    | Event-specific details   |
      | ipAddress   | string    | Source IP address        |
    And logs should be tamper-proof
    And should be available for compliance reporting

  @collaboration @offline-sync
  Scenario: Handle offline participants and sync
    Given I'm collaborating with team members
    When my network connection is lost temporarily
    Then I should continue working in offline mode
    And my changes should be queued locally
    And I should see "Offline - changes will sync" indicator
    When my connection is restored
    Then my queued changes should sync automatically
    And should be merged with remote changes
    And conflicts should be resolved appropriately
    And I should see "Connected - all changes synced" indicator

  @collaboration @performance-optimization
  Scenario: High-performance real-time collaboration
    Given I'm in a session with 20 active collaborators
    When all participants are actively editing
    And generating high message frequency (>100 events/second)
    Then real-time updates should remain responsive
    And cursor tracking should have <50ms latency
    And content synchronization should be <200ms
    And WebSocket connection should remain stable
    And memory usage should not grow unbounded
    And CPU usage should remain reasonable (<30%)

  @collaboration @mobile-support
  Scenario: Mobile device collaboration support
    Given I'm using a mobile device for collaboration
    When I join a template editing session
    Then touch-friendly interface should be provided
    And virtual keyboard should not obstruct content
    And cursor positioning should work with touch
    And selection should work with touch gestures
    And chat interface should be mobile-optimized
    And presence indicators should be clearly visible
    And all features should work smoothly on mobile

  @collaboration @security-isolation
  Scenario: Secure multi-tenant collaboration
    Given multiple tenants have active collaboration sessions:
      | tenant      | session_id           | participants |
      | TenantA     | session-tenant-a-001 | 5            |
      | TenantB     | session-tenant-b-002 | 3            |
      | TenantC     | session-tenant-c-003 | 7            |
    When users from different tenants attempt cross-access
    Then access should be denied
    And tenant isolation should be maintained
    And no data leakage should occur between tenants
    And audit logs should capture unauthorized access attempts
    And each tenant should only see their own sessions

  @collaboration @backup-recovery
  Scenario: Session backup and recovery
    Given active collaboration session with important work
    When system backup occurs every 5 minutes
    Then session state should be saved:
      | component        | backup_frequency |
      | Content snapshots| Every minute     |
      | Version history  | Every change     |
      | Chat messages    | Real-time        |
      | Presence data    | Every 30 seconds |
    When system needs recovery
    Then latest session state should be restored
    And no data should be lost
    And participants should be reconnected seamlessly
    And work should continue from exact recovery point