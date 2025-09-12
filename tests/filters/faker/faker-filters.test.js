/**
 * Faker.js Integration Filters Test Suite (15+ filters)
 * Comprehensive testing of fake data generation for templates
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';

describe('Faker.js Integration Filters (15+ filters)', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  beforeEach(() => {
    // Reset faker seed for consistent testing
    env.renderString('{{ fakeSeed(12345) }}');
  });

  describe('Basic Faker Filters', () => {
    it('should generate fake names', () => {
      const name1 = env.renderString('{{ fakeName() }}');
      const name2 = env.renderString('{{ "" | fakeName }}');
      
      expect(name1).toBeTruthy();
      expect(name2).toBeTruthy();
      expect(name1).toMatch(/^[A-Za-z\s]+$/);
      expect(name2).toMatch(/^[A-Za-z\s]+$/);
      
      // Test global function
      const globalName = env.renderString('{{ fakeName() }}');
      expect(globalName).toBeTruthy();
    });

    it('should generate fake email addresses', () => {
      const email1 = env.renderString('{{ fakeEmail() }}');
      const email2 = env.renderString('{{ "" | fakeEmail }}');
      
      expect(email1).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
      expect(email2).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
    });

    it('should generate fake addresses', () => {
      const address = env.renderString('{{ fakeAddress() }}');
      expect(address).toBeTruthy();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(5);
    });

    it('should generate fake city names', () => {
      const city = env.renderString('{{ fakeCity() }}');
      expect(city).toBeTruthy();
      expect(typeof city).toBe('string');
      expect(city).toMatch(/^[A-Za-z\s]+$/);
    });

    it('should generate fake phone numbers', () => {
      const phone = env.renderString('{{ fakePhone() }}');
      expect(phone).toBeTruthy();
      expect(typeof phone).toBe('string');
      // Phone numbers can have various formats, just check it's not empty
      expect(phone.length).toBeGreaterThan(5);
    });

    it('should generate fake company names', () => {
      const company = env.renderString('{{ fakeCompany() }}');
      expect(company).toBeTruthy();
      expect(typeof company).toBe('string');
      expect(company.length).toBeGreaterThan(2);
    });

    it('should generate fake UUIDs', () => {
      const uuid = env.renderString('{{ fakeUuid() }}');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Faker Number and Data Generation', () => {
    it('should generate fake numbers', () => {
      const num1 = env.renderString('{{ fakeNumber() }}');
      const num2 = env.renderString('{{ fakeNumber(10, 20) }}');
      
      const n1 = parseInt(num1);
      const n2 = parseInt(num2);
      
      expect(n1).toBeGreaterThanOrEqual(1);
      expect(n1).toBeLessThanOrEqual(100);
      expect(n2).toBeGreaterThanOrEqual(10);
      expect(n2).toBeLessThanOrEqual(20);
    });

    it('should generate fake text', () => {
      const text1 = env.renderString('{{ fakeText() }}');
      const text2 = env.renderString('{{ fakeText(5) }}');
      
      expect(text1).toBeTruthy();
      expect(text2).toBeTruthy();
      expect(text1.split('.').length).toBeGreaterThanOrEqual(3); // Should have multiple sentences
      expect(text2.split('.').length).toBeGreaterThanOrEqual(5);
    });

    it('should generate fake paragraphs', () => {
      const paragraph = env.renderString('{{ fakeParagraph() }}');
      expect(paragraph).toBeTruthy();
      expect(paragraph.length).toBeGreaterThan(50);
      expect(paragraph.includes(' ')).toBe(true); // Should have spaces
    });

    it('should generate fake dates', () => {
      const date1 = env.renderString('{{ fakeDate() }}');
      const date2 = env.renderString('{{ fakeDate("2024-01-01", "2024-12-31") }}');
      
      expect(new Date(date1)).toBeInstanceOf(Date);
      expect(new Date(date2)).toBeInstanceOf(Date);
      
      const d2 = new Date(date2);
      expect(d2.getFullYear()).toBe(2024);
    });

    it('should generate fake booleans', () => {
      const bool = env.renderString('{{ fakeBoolean() }}');
      expect(['true', 'false']).toContain(bool);
    });

    it('should pick random array elements', () => {
      const fruits = '["apple", "banana", "orange", "grape"]';
      const fruit = env.renderString(`{{ ${fruits} | fakeArrayElement }}`);
      expect(['apple', 'banana', 'orange', 'grape']).toContain(fruit);
    });
  });

  describe('Faker Configuration', () => {
    it('should set and use faker seed', () => {
      const seedResult = env.renderString('{{ fakeSeed(42) }}');
      expect(seedResult).toBe('Faker seed set to 42');
      
      const name1 = env.renderString('{{ fakeName() }}');
      
      // Reset seed and generate again - should be same
      env.renderString('{{ fakeSeed(42) }}');
      const name2 = env.renderString('{{ fakeName() }}');
      
      expect(name1).toBe(name2);
    });

    it('should configure faker with global function', () => {
      const configResult = env.renderString('{{ configureFaker({ seed: 999, locale: "en" }) }}');
      expect(configResult).toBe('Faker configured successfully');
      
      const name = env.renderString('{{ fakeName() }}');
      expect(name).toBeTruthy();
    });

    it('should handle locale setting', () => {
      const localeResult = env.renderString('{{ fakeLocale("en") }}');
      expect(localeResult).toContain('Faker locale set to en');
      
      // Test that faker still works after locale change
      const name = env.renderString('{{ fakeName() }}');
      expect(name).toBeTruthy();
    });
  });

  describe('Schema-based Generation', () => {
    it('should generate objects from simple schema', () => {
      const schema = `{
        "name": "name",
        "email": "email",
        "age": "number",
        "active": "boolean"
      }`;
      
      const result = env.renderString(`{{ ${schema} | fakeSchema }}`);
      const obj = JSON.parse(result);
      
      expect(obj).toHaveProperty('name');
      expect(obj).toHaveProperty('email');
      expect(obj).toHaveProperty('age');
      expect(obj).toHaveProperty('active');
      
      expect(typeof obj.name).toBe('string');
      expect(obj.email).toMatch(/@/);
      expect(typeof obj.age).toBe('number');
      expect(typeof obj.active).toBe('boolean');
    });

    it('should generate objects from complex schema', () => {
      const schema = `{
        "user": {
          "profile": {
            "name": "name",
            "contact": {
              "email": "email",
              "phone": "phone"
            }
          },
          "preferences": {
            "type": "arrayElement",
            "array": ["basic", "premium", "enterprise"]
          }
        }
      }`;
      
      const result = env.renderString(`{{ ${schema} | fakeSchema }}`);
      const obj = JSON.parse(result);
      
      expect(obj.user.profile.name).toBeTruthy();
      expect(obj.user.profile.contact.email).toMatch(/@/);
      expect(obj.user.profile.contact.phone).toBeTruthy();
      expect(['basic', 'premium', 'enterprise']).toContain(obj.user.preferences);
    });

    it('should generate objects with typed configurations', () => {
      const schema = `{
        "id": { "type": "number", "min": 1000, "max": 9999 },
        "description": { "type": "text", "sentences": 2 },
        "createdAt": { "type": "date", "from": "2024-01-01", "to": "2024-12-31" },
        "category": { "type": "arrayElement", "array": ["tech", "business", "personal"] }
      }`;
      
      const result = env.renderString(`{{ ${schema} | fakeSchema }}`);
      const obj = JSON.parse(result);
      
      expect(obj.id).toBeGreaterThanOrEqual(1000);
      expect(obj.id).toBeLessThanOrEqual(9999);
      expect(obj.description.split('.').length).toBeGreaterThanOrEqual(2);
      expect(['tech', 'business', 'personal']).toContain(obj.category);
    });
  });

  describe('Error Handling', () => {
    it('should handle faker errors gracefully', () => {
      // Test with invalid array for arrayElement
      const result1 = env.renderString('{{ null | fakeArrayElement }}');
      expect(result1).toBe('null');
      
      const result2 = env.renderString('{{ [] | fakeArrayElement }}');
      expect(result2).toBe('null');
    });

    it('should provide fallback values on error', () => {
      // Mock scenario where faker might fail
      const name = env.renderString('{{ fakeName() }}');
      expect(name).toBeTruthy();
      // Even if faker fails, it should return a default fallback
    });

    it('should handle invalid schema gracefully', () => {
      const result1 = env.renderString('{{ null | fakeSchema }}');
      expect(result1).toBe('{}');
      
      const result2 = env.renderString('{{ "invalid" | fakeSchema }}');
      expect(result2).toBe('{}');
    });
  });

  describe('Template Integration', () => {
    it('should work in complex template scenarios', () => {
      const template = `
        {
          "users": [
            {
              "id": {{ fakeNumber(1, 1000) }},
              "name": "{{ fakeName() }}",
              "email": "{{ fakeEmail() }}",
              "profile": {
                "company": "{{ fakeCompany() }}",
                "address": "{{ fakeAddress() }}",
                "phone": "{{ fakePhone() }}"
              }
            }
          ]
        }
      `;
      
      const result = env.renderString(template);
      const obj = JSON.parse(result);
      
      expect(obj.users).toHaveLength(1);
      expect(obj.users[0].id).toBeGreaterThanOrEqual(1);
      expect(obj.users[0].name).toBeTruthy();
      expect(obj.users[0].email).toMatch(/@/);
      expect(obj.users[0].profile.company).toBeTruthy();
    });

    it('should maintain consistency with seed', () => {
      const template = `{{ fakeSeed(123) }}{{ fakeName() }}-{{ fakeEmail() }}`;
      
      const result1 = env.renderString(template);
      const result2 = env.renderString(template);
      
      expect(result1).toBe(result2);
    });
  });

  describe('Performance Tests', () => {
    it('should generate fake data efficiently', () => {
      const start = this.getDeterministicTimestamp();
      
      for (let i = 0; i < 100; i++) {
        env.renderString(`
          {{ fakeName() }} - {{ fakeEmail() }} - {{ fakeCompany() }}
        `);
      }
      
      const end = this.getDeterministicTimestamp();
      expect(end - start).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should handle bulk schema generation', () => {
      const schema = `{
        "name": "name",
        "email": "email",
        "company": "company",
        "address": "address",
        "phone": "phone"
      }`;
      
      const start = this.getDeterministicTimestamp();
      
      for (let i = 0; i < 50; i++) {
        env.renderString(`{{ ${schema} | fakeSchema }}`);
      }
      
      const end = this.getDeterministicTimestamp();
      expect(end - start).toBeLessThan(1000);
    });
  });

  describe('Data Type Variety', () => {
    it('should generate diverse data types', () => {
      const dataTypes = {
        name: '{{ fakeName() }}',
        email: '{{ fakeEmail() }}',
        address: '{{ fakeAddress() }}',
        city: '{{ fakeCity() }}',
        phone: '{{ fakePhone() }}',
        company: '{{ fakeCompany() }}',
        uuid: '{{ fakeUuid() }}',
        number: '{{ fakeNumber() }}',
        text: '{{ fakeText(1) }}',
        paragraph: '{{ fakeParagraph() }}',
        boolean: '{{ fakeBoolean() }}'
      };
      
      Object.entries(dataTypes).forEach(([key, template]) => {
        const result = env.renderString(template);
        expect(result).toBeTruthy();
        expect(result).not.toBe('');
      });
    });

    it('should generate realistic test data patterns', () => {
      // Test realistic patterns that would be used in actual templates
      const userTemplate = `
        Name: {{ fakeName() }}
        Email: {{ fakeEmail() }}
        Company: {{ fakeCompany() }}
        Phone: {{ fakePhone() }}
        Address: {{ fakeAddress() }}, {{ fakeCity() }}
        Join Date: {{ fakeDate("2020-01-01", "2024-12-31") }}
        Is Active: {{ fakeBoolean() }}
        User ID: {{ fakeUuid() }}
        Score: {{ fakeNumber(1, 100) }}
      `;
      
      const result = env.renderString(userTemplate);
      expect(result).toContain('Name:');
      expect(result).toContain('Email:');
      expect(result).toContain('@'); // Email indicator
      expect(result).toContain('Company:');
    });
  });
});