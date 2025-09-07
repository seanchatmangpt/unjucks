Feature: Faker Filters - Fake Data Generation
  As a developer using Unjucks templates
  I want to use Faker.js filters to generate realistic fake data
  So that I can create meaningful test fixtures, seed data, and example content

  Background:
    Given Nunjucks environment is initialized with Faker.js filters
    And Faker.js library is available for data generation
    And the template system is ready
    And faker seed is set to ensure reproducible results

  Scenario: Generate fake personal information
    Given I have a template with content:
      """
      export const testUser = {
        id: {{ faker.number.int({ min: 1, max: 1000 }) }},
        firstName: '{{ faker.person.firstName() }}',
        lastName: '{{ faker.person.lastName() }}',
        email: '{{ faker.internet.email() }}',
        avatar: '{{ faker.image.avatar() }}'
      };
      """
    When I render the template
    Then the output should contain "export const testUser"
    And the output should contain "id:" followed by a number
    And the output should contain "firstName:" followed by a quoted name
    And the output should contain "lastName:" followed by a quoted name
    And the output should contain "email:" followed by a valid email format
    And the output should contain "avatar:" followed by a URL

  Scenario: Generate fake company data for business models
    Given I have a template with content:
      """
      export class {{ companyName | pascalCase }}Service {
        static mockData = {
          name: '{{ faker.company.name() }}',
          industry: '{{ faker.company.buzzNoun() }}',
          address: {
            street: '{{ faker.location.streetAddress() }}',
            city: '{{ faker.location.city() }}',
            state: '{{ faker.location.state() }}',
            zipCode: '{{ faker.location.zipCode() }}'
          },
          website: '{{ faker.internet.url() }}',
          founded: {{ faker.date.past({ years: 20 }).getFullYear() }}
        };
      }
      """
    And the variable "companyName" has value "tech_startup"
    When I render the template
    Then the output should contain "export class TechStartupService"
    And the output should contain "name:" followed by a quoted company name
    And the output should contain "industry:" followed by a quoted industry term
    And the output should contain "street:" followed by a quoted address
    And the output should contain "website:" followed by a URL
    And the output should contain "founded:" followed by a year between 2004-2024

  Scenario: Generate fake product data for e-commerce
    Given I have a template with content:
      """
      export const {{ categoryName | camelCase }}Products = [
        {
          id: '{{ faker.string.uuid() }}',
          name: '{{ faker.commerce.productName() }}',
          description: '{{ faker.commerce.productDescription() }}',
          price: {{ faker.commerce.price({ min: 10, max: 1000, dec: 2 }) }},
          category: '{{ categoryName | humanize }}',
          sku: '{{ faker.string.alphanumeric(8).toUpperCase() }}',
          inStock: {{ faker.datatype.boolean() }},
          tags: [{{ faker.commerce.productAdjective() | dump }}, {{ faker.commerce.productMaterial() | dump }}]
        }
      ];
      """
    And the variable "categoryName" has value "home_electronics"
    When I render the template
    Then the output should contain "homeElectronicsProducts"
    And the output should contain "id:" followed by a UUID
    And the output should contain "name:" followed by a product name
    And the output should contain "price:" followed by a decimal number
    And the output should contain "category: 'Home electronics'"
    And the output should contain "sku:" followed by an 8-character alphanumeric string
    And the output should contain "inStock:" followed by true or false

  Scenario: Generate test database seeds with relationships
    Given I have a template with content:
      """
      exports.seed = function(knex) {
        const users = Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          username: '{{ faker.internet.userName() }}',
          email: '{{ faker.internet.email() }}',
          password: '{{ faker.internet.password() }}',
          bio: '{{ faker.lorem.paragraph(2) }}',
          avatar: '{{ faker.image.avatar() }}',
          created_at: '{{ faker.date.past().toISOString() }}',
          updated_at: '{{ now() }}'
        }));
        
        return knex('{{ tableName | tableize }}').insert(users);
      };
      """
    And the variable "tableName" has value "User"
    When I render the template
    Then the output should contain "knex('users')"
    And the output should contain "username:" followed by a generated username
    And the output should contain "password:" followed by a generated password
    And the output should contain "bio:" followed by lorem text
    And the output should contain "created_at:" followed by a past ISO date

  Scenario: Generate API mock responses
    Given I have a template with content:
      """
      export const {{ endpointName | camelCase }}MockResponse = {
        status: 200,
        data: {
          id: {{ faker.number.int({ min: 1, max: 10000 }) }},
          {{ resourceName | camelCase }}: {
            title: '{{ faker.lorem.words(3) }}',
            content: '{{ faker.lorem.paragraphs(2, '\n') }}',
            author: {
              name: '{{ faker.person.fullName() }}',
              email: '{{ faker.internet.email() }}'
            },
            publishedAt: '{{ faker.date.recent().toISOString() }}',
            views: {{ faker.number.int({ min: 0, max: 50000 }) }},
            tags: {{ faker.lorem.words(5).split(' ') | dump }}
          }
        },
        meta: {
          requestId: '{{ faker.string.uuid() }}',
          timestamp: '{{ now() }}'
        }
      };
      """
    And the variable "endpointName" has value "blog-post"
    And the variable "resourceName" has value "article"
    When I render the template
    Then the output should contain "blogPostMockResponse"
    And the output should contain "article:" 
    And the output should contain "title:" followed by 3 words
    And the output should contain "content:" followed by paragraphs
    And the output should contain "author:" with name and email
    And the output should contain "publishedAt:" followed by an ISO date
    And the output should contain "tags:" followed by an array of words

  Scenario: Generate test configuration with fake credentials
    Given I have a template with content:
      """
      export const {{ serviceName | constantCase }}_TEST_CONFIG = {
        database: {
          host: '{{ faker.internet.ip() }}',
          port: {{ faker.internet.port() }},
          username: '{{ faker.internet.userName() }}',
          password: '{{ faker.internet.password(12) }}',
          database: '{{ serviceName | snakeCase }}_test'
        },
        redis: {
          host: '{{ faker.internet.ip() }}',
          port: {{ faker.internet.port() }},
          password: '{{ faker.internet.password(16) }}'
        },
        jwt: {
          secret: '{{ faker.string.alphanumeric(32) }}',
          expiresIn: '{{ faker.number.int({ min: 1, max: 24 }) }}h'
        },
        email: {
          from: '{{ faker.internet.email() }}',
          host: '{{ faker.internet.domainName() }}',
          apiKey: '{{ faker.string.alphanumeric(40) }}'
        }
      };
      """
    And the variable "serviceName" has value "user-auth"
    When I render the template
    Then the output should contain "USER_AUTH_TEST_CONFIG"
    And the output should contain "host:" followed by an IP address
    And the output should contain "port:" followed by a port number
    And the output should contain "password:" followed by passwords of specified lengths
    And the output should contain "database: 'user_auth_test'"
    And the output should contain "secret:" followed by a 32-character string
    And the output should contain "expiresIn:" followed by hours

  Scenario: Generate fake lorem content for documentation
    Given I have a template with content:
      """
      # {{ title | titleCase }}
      
      ## Overview
      {{ faker.lorem.paragraph(3) }}
      
      ## Features
      {{ faker.lorem.sentences(5, '\n- ') | prepend('- ') }}
      
      ## Usage
      ```javascript
      const {{ componentName | camelCase }} = new {{ componentName | pascalCase }}({
        apiKey: '{{ faker.string.alphanumeric(32) }}',
        endpoint: '{{ faker.internet.url() }}',
        timeout: {{ faker.number.int({ min: 1000, max: 10000 }) }}
      });
      ```
      
      ## Examples
      {{ faker.lorem.paragraphs(2, '\n\n') }}
      """
    And the variable "title" has value "api-client-library"
    And the variable "componentName" has value "api_client"
    When I render the template
    Then the output should contain "# Api Client Library"
    And the output should contain "## Overview" followed by lorem text
    And the output should contain "## Features" with bullet points
    And the output should contain "const apiClient = new ApiClient"
    And the output should contain "apiKey:" followed by a 32-character key
    And the output should contain "endpoint:" followed by a URL
    And the output should contain "timeout:" followed by a number

  Scenario: Generate test fixtures with related data
    Given I have a template with content:
      """
      export const {{ fixtureName | camelCase }}Fixtures = {
        users: [
          {
            id: 1,
            name: '{{ faker.person.fullName() }}',
            email: '{{ faker.internet.email() }}',
            posts: [
              {
                id: 1,
                title: '{{ faker.lorem.sentence() }}',
                slug: '{{ faker.lorem.slug() }}',
                content: '{{ faker.lorem.paragraphs(3) }}',
                publishedAt: '{{ faker.date.recent().toISOString() }}'
              }
            ]
          }
        ],
        categories: [
          {
            id: 1,
            name: '{{ faker.lorem.word() | capitalize }}',
            description: '{{ faker.lorem.sentence() }}'
          }
        ]
      };
      """
    And the variable "fixtureName" has value "blog_data"
    When I render the template
    Then the output should contain "blogDataFixtures"
    And the output should contain "users:" with an array
    And the output should contain "name:" followed by a full name
    And the output should contain "posts:" with nested data
    And the output should contain "slug:" followed by a URL-friendly slug
    And the output should contain "categories:" with an array

  Scenario: Generate fake financial data
    Given I have a template with content:
      """
      export const {{ reportType | camelCase }}Data = {
        transactions: Array.from({ length: 20 }, (_, i) => ({
          id: `txn_{{ faker.string.alphanumeric(8) }}`,
          amount: {{ faker.finance.amount({ min: 1, max: 10000, dec: 2 }) }},
          currency: '{{ faker.finance.currencyCode() }}',
          description: '{{ faker.finance.transactionDescription() }}',
          account: '{{ faker.finance.accountNumber() }}',
          date: '{{ faker.date.recent({ days: 30 }).toISOString() }}'
        })),
        summary: {
          totalAmount: {{ faker.finance.amount({ min: 50000, max: 500000, dec: 2 }) }},
          currency: 'USD',
          period: '{{ faker.date.month() }} {{ faker.date.recent().getFullYear() }}'
        }
      };
      """
    And the variable "reportType" has value "monthly_financial"
    When I render the template
    Then the output should contain "monthlyFinancialData"
    And the output should contain "id: `txn_" followed by an 8-character string
    And the output should contain "amount:" followed by decimal amounts
    And the output should contain "currency:" followed by currency codes
    And the output should contain "account:" followed by account numbers
    And the output should contain "totalAmount:" followed by a large amount

  Scenario: Generate localized fake data
    Given I have a template with content:
      """
      export const {{ regionName | camelCase }}TestData = {
        users: [
          {
            name: '{{ faker.person.fullName() }}',
            address: '{{ faker.location.streetAddress() }}, {{ faker.location.city() }}, {{ faker.location.state() }}',
            phone: '{{ faker.phone.number() }}',
            company: '{{ faker.company.name() }}',
            jobTitle: '{{ faker.person.jobTitle() }}'
          }
        ],
        products: [
          {
            name: '{{ faker.commerce.productName() }}',
            price: '{{ faker.finance.amount() }} {{ faker.finance.currencySymbol() }}',
            color: '{{ faker.color.human() }}'
          }
        ]
      };
      """
    And the variable "regionName" has value "north_america"
    When I render the template
    Then the output should contain "northAmericaTestData"
    And the output should contain "address:" with street, city, and state
    And the output should contain "phone:" followed by a phone number
    And the output should contain "jobTitle:" followed by a job title
    And the output should contain "price:" with amount and currency symbol
    And the output should contain "color:" followed by a human-readable color