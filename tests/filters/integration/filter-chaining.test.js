/**
 * Filter Chaining and Integration Test Suite
 * Testing complex combinations and real-world usage scenarios
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';

describe('Filter Chaining and Integration', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('String + Date + Faker Combinations', () => {
    it('should chain string, date, and faker filters', () => {
      const template = `
        User: {{ fakeName() | titleCase }}
        Email: {{ fakeEmail() | lower }}
        Created: {{ fakeDate("2020-01-01", "2024-01-01") | formatDate("MMM Do, YYYY") }}
        Username: {{ fakeName() | snakeCase | truncate(20) }}
        Profile: {{ "user_profile" | classify }} 
      `;
      
      const result = env.renderString(template);
      expect(result).toContain('User:');
      expect(result).toContain('Email:');
      expect(result).toContain('@'); // Email should contain @
      expect(result).toContain('Created:');
    });

    it('should combine semantic web and string transformations', () => {
      const template = `
        Class: {{ "user_account" | rdfClass("foaf") | curie }}
        Property: {{ "has_friend" | rdfProperty("foaf") | curie }}
        Variable: {{ "user_name" | sparqlVar }}
        Namespace: {{ "http://example.org/ontology#" | namespacePrefix }}
      `;
      
      const result = env.renderString(template);
      expect(result).toContain('Class: foaf:UserAccount');
      expect(result).toContain('Property: foaf:hasFriend');
      expect(result).toContain('Variable: ?userName');
    });
  });

  describe('Complex Data Processing Chains', () => {
    it('should process user data through multiple transformations', () => {
      const userData = {
        firstName: 'john',
        lastName: 'DOE',
        email: 'JOHN.DOE@EXAMPLE.COM',
        tags: ['admin', 'developer', 'manager'],
        profile: null,
        joinDate: '2024-01-15T10:30:00Z'
      };

      const template = `
        Full Name: {{ firstName | capitalize }} {{ lastName | titleCase }}
        Email: {{ email | lower }}
        Username: {{ firstName | camelCase }}{{ lastName | pascalCase }}
        Tags: {{ tags | join(", ") | upper }}
        Profile: {{ profile | default("No profile") }}
        Member Since: {{ joinDate | formatDate("MMM YYYY") }}
        Slug: {{ firstName | slug }}-{{ lastName | slug }}
      `;
      
      const result = env.renderString(template, userData);
      expect(result).toContain('Full Name: John Doe');
      expect(result).toContain('Email: john.doe@example.com');
      expect(result).toContain('Username: johnDoe');
      expect(result).toContain('Tags: ADMIN, DEVELOPER, MANAGER');
      expect(result).toContain('Profile: No profile');
      expect(result).toContain('Member Since: Jan 2024');
      expect(result).toContain('Slug: john-doe');
    });

    it('should generate RDF data with dynamic values', () => {
      const template = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <{{ rdfNamespaces.foaf }}> .
        @prefix schema: <{{ rdfNamespaces.schema }}> .

        {{ "john_doe" | rdfResource }} a {{ "Person" | rdfClass("foaf") | curie }} ;
          {{ "name" | rdfProperty("foaf") | curie }} {{ fakeName() | rdfLiteral("en") }} ;
          {{ "email" | rdfProperty("foaf") | curie }} <mailto:{{ fakeEmail() }}> ;
          {{ "age" | rdfProperty("foaf") | curie }} {{ fakeNumber(18, 65) | rdfDatatype("integer") }} ;
          {{ "created" | dublinCore | curie }} {{ now().format() | rdfDatatype("dateTime") }} .
      `;
      
      const result = env.renderString(template);
      expect(result).toContain('@prefix ex:');
      expect(result).toContain('@prefix foaf:');
      expect(result).toContain('foaf:Person');
      expect(result).toContain('foaf:name');
      expect(result).toContain('@en');
      expect(result).toContain('mailto:');
      expect(result).toContain('^^xsd:integer');
      expect(result).toContain('^^xsd:dateTime');
    });
  });

  describe('Template Generation Scenarios', () => {
    it('should generate API endpoint documentation', () => {
      const endpoints = [
        { name: 'get_users', method: 'GET', path: '/users' },
        { name: 'create_user', method: 'POST', path: '/users' },
        { name: 'update_user_profile', method: 'PUT', path: '/users/{id}/profile' }
      ];

      const template = `
        # API Endpoints

        {% for endpoint in endpoints %}
        ## {{ endpoint.name | titleCase | humanize }}
        - **Method**: {{ endpoint.method }}
        - **Path**: {{ endpoint.path }}
        - **Handler**: {{ endpoint.name | classify }}Handler
        - **Constant**: {{ endpoint.name | constantCase }}
        
        {% endfor %}
      `;
      
      const result = env.renderString(template, { endpoints });
      expect(result).toContain('## Get User');
      expect(result).toContain('## Create User');
      expect(result).toContain('## Update User Profile');
      expect(result).toContain('**Handler**: GetUserHandler');
      expect(result).toContain('**Constant**: GET_USERS');
    });

    it('should generate database schema with semantic annotations', () => {
      const entities = [
        { name: 'User', properties: ['id', 'name', 'email', 'created_at'] },
        { name: 'Post', properties: ['id', 'title', 'content', 'user_id'] }
      ];

      const template = `
        # Database Schema with RDF Mapping

        {% for entity in entities %}
        ## {{ entity.name }} Table
        
        CREATE TABLE {{ entity.name | tableize }} (
        {% for prop in entity.properties %}
          {{ prop | snakeCase }} {{ prop | rdfDatatype("xsd:string") | replace('"', '').replace('^^xsd:string', 'VARCHAR(255)') }}{% if not loop.last %},{% endif %}
        {% endfor %}
        );

        -- RDF Mapping
        {{ entity.name | rdfClass }} a {{ "Class" | owl | curie }} .
        {% for prop in entity.properties %}
        {{ prop | rdfProperty }} {{ "domain" | rdfs }} {{ entity.name | rdfClass | curie }} .
        {% endfor %}

        {% endfor %}
      `;
      
      const result = env.renderString(template, { entities });
      expect(result).toContain('CREATE TABLE users');
      expect(result).toContain('CREATE TABLE posts');
      expect(result).toContain('owl:Class');
      expect(result).toContain('rdfs:domain');
    });
  });

  describe('Error Recovery in Chains', () => {
    it('should handle errors gracefully in filter chains', () => {
      const template = `
        Safe: {{ undefined | default("fallback") | upper }}
        Chained: {{ null | rdfResource | default("http://example.org/Unknown") }}
        Mixed: {{ "" | fakeName | default("Anonymous") | titleCase }}
      `;
      
      const result = env.renderString(template);
      expect(result).toContain('Safe: FALLBACK');
      expect(result).toContain('Chained: http://example.org/Unknown');
      expect(result).toContain('Mixed:'); // Should have some name
    });

    it('should maintain data integrity through complex chains', () => {
      const complexData = {
        users: [
          { name: 'alice cooper', role: 'admin', skills: ['js', 'python'] },
          { name: null, role: 'user', skills: [] },
          { name: 'bob smith', role: null, skills: ['java', 'go', 'rust'] }
        ]
      };

      const template = `
        {% for user in users %}
        User {{ loop.index }}:
          Name: {{ user.name | default("Anonymous") | titleCase }}
          Role: {{ user.role | default("guest") | upper }}
          Skills: {{ user.skills | join(", ") | default("none listed") | titleCase }}
          Username: {{ user.name | default("user") | slug }}_{{ user.role | default("guest") | slug }}
        {% endfor %}
      `;
      
      const result = env.renderString(template, complexData);
      expect(result).toContain('Name: Alice Cooper');
      expect(result).toContain('Name: Anonymous');
      expect(result).toContain('Role: ADMIN');
      expect(result).toContain('Role: GUEST');
      expect(result).toContain('Skills: Js, Python');
      expect(result).toContain('Skills: none listed');
      expect(result).toContain('Username: alice-cooper_admin');
      expect(result).toContain('Username: user_guest');
    });
  });

  describe('Performance with Complex Chains', () => {
    it('should handle complex chains efficiently', () => {
      const start = this.getDeterministicTimestamp();
      
      for (let i = 0; i < 100; i++) {
        env.renderString(`
          {{ "${i}_test_data" | pascalCase | rdfClass | curie | default("ex:Unknown") }}
          {{ "created_at" | rdfProperty("dct") | curie }}
          {{ now().format() | rdfDatatype("dateTime") }}
        `);
      }
      
      const end = this.getDeterministicTimestamp();
      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should maintain performance with nested data transformations', () => {
      const largeDataset = {
        items: new Array(50).fill(0).map((_, i) => ({
          id: i,
          name: `item_${i}`,
          category: `category_${i % 5}`,
          tags: [`tag_${i}`, `type_${i % 3}`]
        }))
      };

      const template = `
        {% for item in items %}
        {{ item.name | classify }}: {{ item.category | titleCase }} [{{ item.tags | join(", ") | upper }}]
        {% endfor %}
      `;
      
      const start = this.getDeterministicTimestamp();
      const result = env.renderString(template, largeDataset);
      const end = this.getDeterministicTimestamp();
      
      expect(result).toContain('Item0: Category 0');
      expect(result).toContain('[TAG_0, TYPE_0]');
      expect(end - start).toBeLessThan(200);
    });
  });
});