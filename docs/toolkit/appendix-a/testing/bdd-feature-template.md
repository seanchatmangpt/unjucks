# BDD Feature Template

## Document Information

| Field | Value |
|-------|-------|
| Feature Name | `[FEATURE_NAME]` |
| Epic | `[EPIC_NAME]` |
| Author | `[AUTHOR_NAME]` |
| Last Updated | `[DATE]` |
| Version | `[VERSION]` |

## Feature Template Structure

### Basic Feature Template
```gherkin
# Feature: [FEATURE_NAME]
#
# Epic: [EPIC_NAME]
# Story: [STORY_ID]
# 
# Description:
# [FEATURE_DESCRIPTION]
#
# Acceptance Criteria:
# - [ACCEPTANCE_CRITERION_1]
# - [ACCEPTANCE_CRITERION_2]
# - [ACCEPTANCE_CRITERION_3]
#
# Business Rules:
# - [BUSINESS_RULE_1]
# - [BUSINESS_RULE_2]

Feature: [FEATURE_NAME]
  As a [USER_ROLE]
  I want to [DESIRED_ACTION]
  So that [BUSINESS_VALUE]

  Background:
    Given [COMMON_PRECONDITION]
    And [ADDITIONAL_SETUP]

  Rule: [BUSINESS_RULE_NAME]
    
    Scenario: [SCENARIO_NAME]
      Given [INITIAL_STATE]
      When [ACTION_PERFORMED]
      Then [EXPECTED_OUTCOME]
      And [ADDITIONAL_VERIFICATION]

    Scenario Outline: [SCENARIO_OUTLINE_NAME]
      Given [INITIAL_STATE_WITH_PARAMETER]
      When [ACTION_WITH_PARAMETER] "<parameter>"
      Then [EXPECTED_OUTCOME_WITH_PARAMETER] "<expected_result>"
      
      Examples:
        | parameter | expected_result |
        | value1    | result1         |
        | value2    | result2         |
```

## Complete Feature Examples

### Example 1: User Authentication Feature
```gherkin
# Feature: User Authentication
#
# Epic: User Management
# Story: AUTH-001
# 
# Description:
# Users need to authenticate to access protected resources in the system.
# The system should support secure login, logout, and session management.
#
# Acceptance Criteria:
# - Users can log in with valid credentials
# - Invalid credentials are rejected with appropriate error messages
# - Users remain logged in for the duration of their session
# - Users can log out and terminate their session
# - Session timeout after 30 minutes of inactivity
#
# Business Rules:
# - Passwords must meet complexity requirements
# - Account lockout after 5 failed login attempts
# - Multi-factor authentication required for admin users

Feature: User Authentication
  As a registered user
  I want to authenticate with the system
  So that I can access my protected resources

  Background:
    Given the authentication system is available
    And the user database contains valid user accounts

  Rule: Valid credentials grant access
    
    Scenario: Successful login with valid credentials
      Given I am on the login page
      And I have valid credentials for user "john@example.com"
      When I enter my email "john@example.com"
      And I enter my password "SecurePass123!"
      And I click the login button
      Then I should be redirected to the dashboard
      And I should see a welcome message "Welcome back, John"
      And my session should be active

    Scenario: Login fails with invalid credentials
      Given I am on the login page
      When I enter my email "john@example.com"
      And I enter my password "wrongpassword"
      And I click the login button
      Then I should remain on the login page
      And I should see an error message "Invalid email or password"
      And my session should remain inactive

  Rule: Account security measures protect against abuse
    
    Scenario: Account lockout after multiple failed attempts
      Given I am on the login page
      And user "john@example.com" has made 4 failed login attempts
      When I enter my email "john@example.com"
      And I enter an invalid password
      And I click the login button
      Then I should see an error message "Account locked due to multiple failed attempts"
      And the user account should be locked for 15 minutes

  Rule: Session management maintains security
    
    Scenario: Session expires after inactivity
      Given I am logged in as "john@example.com"
      And I have been inactive for 30 minutes
      When I try to access a protected resource
      Then I should be redirected to the login page
      And I should see a message "Your session has expired. Please log in again."

    Scenario: User can logout
      Given I am logged in as "john@example.com"
      When I click the logout button
      Then I should be redirected to the login page
      And my session should be terminated
      And I should not be able to access protected resources
```

### Example 2: E-commerce Shopping Cart Feature
```gherkin
# Feature: Shopping Cart Management
#
# Epic: E-commerce Platform
# Story: CART-001
# 
# Description:
# Customers need to manage items in their shopping cart before checkout.
# The system should support adding, removing, and updating quantities.
#
# Acceptance Criteria:
# - Customers can add products to their cart
# - Customers can update quantities of items in their cart
# - Customers can remove items from their cart
# - Cart total is calculated correctly
# - Cart persists across browser sessions
#
# Business Rules:
# - Maximum 10 items per product in cart
# - Cart expires after 7 days of inactivity
# - Out-of-stock items cannot be added to cart

Feature: Shopping Cart Management
  As an online shopper
  I want to manage items in my shopping cart
  So that I can purchase the products I want

  Background:
    Given the e-commerce site is available
    And there are products available in the catalog
    And I am a registered customer

  Rule: Items can be added to cart
    
    Scenario: Add product to empty cart
      Given my cart is empty
      And product "Wireless Headphones" is available with price $99.99
      When I view the product "Wireless Headphones"
      And I click "Add to Cart"
      Then the product should be added to my cart with quantity 1
      And the cart total should be $99.99
      And I should see a confirmation message "Item added to cart"

    Scenario: Add multiple quantities of same product
      Given my cart contains 1 "Wireless Headphones" at $99.99
      When I view the product "Wireless Headphones"
      And I select quantity 2
      And I click "Add to Cart"
      Then my cart should contain 3 "Wireless Headphones"
      And the cart total should be $299.97

  Rule: Cart quantities can be modified
    
    Scenario Outline: Update item quantity in cart
      Given my cart contains 2 "Wireless Headphones" at $99.99 each
      When I change the quantity to "<new_quantity>"
      Then my cart should contain "<new_quantity>" "Wireless Headphones"
      And the cart total should be "<expected_total>"
      
      Examples:
        | new_quantity | expected_total |
        | 1           | $99.99         |
        | 3           | $299.97        |
        | 5           | $499.95        |

  Rule: Items can be removed from cart
    
    Scenario: Remove item from cart
      Given my cart contains:
        | Product            | Quantity | Price  |
        | Wireless Headphones| 2        | $99.99 |
        | Phone Case         | 1        | $19.99 |
      When I remove "Phone Case" from my cart
      Then my cart should contain only:
        | Product            | Quantity | Price  |
        | Wireless Headphones| 2        | $99.99 |
      And the cart total should be $199.98

  Rule: Business constraints are enforced
    
    Scenario: Cannot add out-of-stock items
      Given product "Limited Edition Speaker" is out of stock
      When I try to add "Limited Edition Speaker" to my cart
      Then the item should not be added to my cart
      And I should see an error message "This item is currently out of stock"

    Scenario: Cannot exceed maximum quantity per item
      Given my cart contains 10 "Wireless Headphones" (maximum allowed)
      When I try to add another "Wireless Headphones" to my cart
      Then the quantity should remain at 10
      And I should see an error message "Maximum quantity reached for this item"
```

### Example 3: API Integration Feature
```gherkin
# Feature: REST API User Management
#
# Epic: API Platform
# Story: API-001
# 
# Description:
# External systems need to manage users through our REST API.
# The API should support standard CRUD operations with proper authentication.
#
# Acceptance Criteria:
# - API endpoints support GET, POST, PUT, DELETE operations
# - Proper HTTP status codes are returned
# - Authentication is required for all operations
# - Data validation is performed on requests
# - Responses follow consistent JSON format
#
# Business Rules:
# - Email addresses must be unique
# - User roles are restricted to predefined values
# - Soft delete is used (users are marked as inactive)

Feature: REST API User Management
  As an external system
  I want to manage users through the REST API
  So that I can integrate user operations with my application

  Background:
    Given the API is running at "https://api.example.com"
    And I have valid API credentials
    And I am authenticated with Bearer token

  Rule: User creation follows validation rules
    
    Scenario: Create user with valid data
      Given the API endpoint "/api/v1/users" is available
      When I send a POST request to "/api/v1/users" with:
        """
        {
          "name": "John Doe",
          "email": "john.doe@example.com",
          "role": "user"
        }
        """
      Then the response status should be 201
      And the response should contain:
        """
        {
          "data": {
            "id": 123,
            "name": "John Doe",
            "email": "john.doe@example.com",
            "role": "user",
            "status": "active",
            "created_at": "2024-01-01T00:00:00Z"
          },
          "message": "User created successfully"
        }
        """

    Scenario: Create user with invalid email
      When I send a POST request to "/api/v1/users" with:
        """
        {
          "name": "John Doe",
          "email": "invalid-email",
          "role": "user"
        }
        """
      Then the response status should be 422
      And the response should contain:
        """
        {
          "error": {
            "code": "VALIDATION_ERROR",
            "message": "The request data is invalid",
            "details": {
              "field_errors": {
                "email": ["Email must be a valid email address"]
              }
            }
          }
        }
        """

  Rule: User retrieval supports filtering and pagination
    
    Scenario: List users with pagination
      Given there are 25 users in the system
      When I send a GET request to "/api/v1/users?page=2&limit=10"
      Then the response status should be 200
      And the response should contain 10 users
      And the pagination object should show:
        """
        {
          "page": 2,
          "limit": 10,
          "total": 25,
          "pages": 3,
          "has_next": true,
          "has_prev": true
        }
        """

    Scenario Outline: Filter users by status
      Given there are users with different statuses in the system
      When I send a GET request to "/api/v1/users?filter[status]=<status>"
      Then the response status should be 200
      And all returned users should have status "<status>"
      
      Examples:
        | status   |
        | active   |
        | inactive |
        | pending  |

  Rule: User updates modify only specified fields
    
    Scenario: Update user role
      Given user with ID 123 exists with role "user"
      When I send a PATCH request to "/api/v1/users/123" with:
        """
        {
          "role": "admin"
        }
        """
      Then the response status should be 200
      And the user's role should be updated to "admin"
      And other user fields should remain unchanged

  Rule: User deletion is handled as soft delete
    
    Scenario: Delete user (soft delete)
      Given user with ID 123 exists and is active
      When I send a DELETE request to "/api/v1/users/123"
      Then the response status should be 204
      And the user should be marked as inactive in the system
      And the user record should still exist in the database
```

## BDD Step Definition Templates

### Given Steps (Preconditions)
```javascript
// State setup steps
Given('I am on the {string} page', function(pageName) {
  // Navigate to specific page
});

Given('the {string} system is available', function(systemName) {
  // Verify system availability
});

Given('I have valid credentials for user {string}', function(email) {
  // Set up user credentials
});

Given('my cart contains {int} {string} at ${float} each', function(quantity, product, price) {
  // Set up cart state
});

Given('there are {int} users in the system', function(userCount) {
  // Set up test data
});
```

### When Steps (Actions)
```javascript
// User actions
When('I enter my email {string}', function(email) {
  // Input email in form
});

When('I click the {string} button', function(buttonName) {
  // Click specified button
});

When('I send a {string} request to {string} with:', function(method, endpoint, requestBody) {
  // Make API request
});

When('I change the quantity to {string}', function(newQuantity) {
  // Update cart quantity
});
```

### Then Steps (Verifications)
```javascript
// Outcome verification
Then('I should be redirected to the {string}', function(pageName) {
  // Verify page navigation
});

Then('I should see an error message {string}', function(errorMessage) {
  // Verify error message display
});

Then('the response status should be {int}', function(statusCode) {
  // Verify HTTP status code
});

Then('the cart total should be ${float}', function(expectedTotal) {
  // Verify cart calculation
});
```

## Template Usage Guidelines

### For Unjucks Integration:
```yaml
# frontmatter for BDD feature generation
---
to: features/<%= featureName.toLowerCase().replace(/\s+/g, '-') %>.feature
inject: false
skipIf: exists
---
```

### Best Practices:
1. **Use Business Language**: Write scenarios in domain language, not technical jargon
2. **Keep Scenarios Independent**: Each scenario should be able to run in isolation
3. **Use Meaningful Names**: Scenario names should clearly describe the behavior being tested
4. **Implement Given-When-Then**: Follow the BDD pattern consistently
5. **Use Background Wisely**: Share common setup, but don't overuse
6. **Include Examples**: Use Scenario Outlines for data-driven tests
7. **Add Business Context**: Include comments explaining business rules and context

### Integration Points:
- Link features to user stories and requirements
- Connect to test automation frameworks (Cucumber, SpecFlow, etc.)
- Reference API documentation for service-level features
- Trace to acceptance criteria in requirements documents

### Maintenance:
- Keep features updated as requirements change
- Review and refactor scenarios regularly
- Ensure step definitions are maintained
- Validate that examples match current system behavior