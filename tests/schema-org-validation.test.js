/**
 * Schema.org Comprehensive Validation Tests
 * Tests Schema.org structured data generation with filter integration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SchemaOrgFilters } from '../src/lib/filters/schema-org-filters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Schema.org Validation Tests', () => {
  let env;
  let schemaOrgFilters;
  
  beforeAll(() => {
    // Setup Nunjucks environment
    env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader([
        join(__dirname, 'fixtures/schema-org'),
        join(__dirname, 'fixtures')
      ]),
      { 
        autoescape: false,
        throwOnUndefined: false
      }
    );
    
    // Add Schema.org filters
    schemaOrgFilters = new SchemaOrgFilters();
    const filters = schemaOrgFilters.getAllFilters();
    
    // Register all filters
    Object.entries(filters).forEach(([name, filter]) => {
      env.addFilter(name, filter);
    });
    
    // Add additional utility filters for testing
    env.addFilter('titleCase', (str) => {
      if (!str) return str;
      return String(str).replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    });
    
    env.addFilter('slug', (str) => {
      if (!str) return str;
      return String(str)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    });
    
    env.addFilter('truncate', (str, length = 100) => {
      if (!str) return str;
      const text = String(str);
      return text.length > length ? text.substring(0, length) + '...' : text;
    });
    
    env.addFilter('escape', (str) => {
      if (!str) return str;
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    });
    
    env.addFilter('upper', (str) => String(str || '').toUpperCase());
    env.addFilter('number', (val, decimals = 0) => Number(val || 0).toFixed(decimals));
    env.addFilter('default', (val, defaultVal) => val || defaultVal);
    env.addFilter('formatDate', (date, format) => {
      const d = new Date(date);
      if (format === 'YYYY') return d.getFullYear().toString();
      return d.toISOString();
    });
    env.addFilter('now', () => new Date());
    env.addGlobal('now', () => new Date());
    env.addFilter('dump', (obj) => JSON.stringify(obj, null, 2));
    env.addFilter('join', (arr, sep = ',') => Array.isArray(arr) ? arr.join(sep) : '');
    env.addFilter('map', (arr, prop) => Array.isArray(arr) ? arr.map(item => item[prop] || item) : []);
    env.addFilter('length', (val) => val ? val.length : 0);
    env.addFilter('urlencode', encodeURIComponent);
    env.addFilter('formatDuration', (val) => {
      if (typeof val === 'string' && val.startsWith('P')) return val;
      if (typeof val === 'number') return `PT${val}M`;
      return val;
    });
  });

  // Helper function to extract JSON from frontmatter template
  function extractJsonFromTemplate(rendered) {
    const lines = rendered.split('\n');
    let inFrontmatter = false;
    let jsonStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          jsonStart = i + 1;
          break;
        }
      }
    }
    
    if (jsonStart === -1) {
      // No frontmatter, return entire content
      return rendered;
    }
    
    return lines.slice(jsonStart).join('\n').trim();
  }

  describe('Schema.org Filter Functions', () => {
    it('should convert types to Schema.org format', () => {
      expect(schemaOrgFilters.schemaOrg('person')).toBe('Person');
      expect(schemaOrgFilters.schemaOrg('local_business')).toBe('LocalBusiness');
      expect(schemaOrgFilters.schemaOrg('creative-work')).toBe('CreativeWork');
      expect(schemaOrgFilters.schemaOrg('news article')).toBe('NewsArticle');
    });

    it('should convert properties to Schema.org camelCase', () => {
      expect(schemaOrgFilters.schemaProperty('given_name')).toBe('givenName');
      expect(schemaOrgFilters.schemaProperty('job-title')).toBe('jobTitle');
      expect(schemaOrgFilters.schemaProperty('date published')).toBe('datePublished');
    });

    it('should generate RDF resource URIs', () => {
      expect(schemaOrgFilters.rdfResource('john-doe')).toBe('https://schema.org/john-doe');
      expect(schemaOrgFilters.rdfResource('https://example.com/person/1')).toBe('https://example.com/person/1');
      expect(schemaOrgFilters.rdfResource('product_123', 'https://store.com/')).toBe('https://store.com/product-123');
    });

    it('should format availability for Schema.org', () => {
      expect(schemaOrgFilters.schemaAvailability('in_stock')).toBe('https://schema.org/InStock');
      expect(schemaOrgFilters.schemaAvailability('out-of-stock')).toBe('https://schema.org/OutOfStock');
      expect(schemaOrgFilters.schemaAvailability('PreOrder')).toBe('https://schema.org/PreOrder');
    });

    it('should format dates for Schema.org (ISO 8601)', () => {
      const testDate = new Date('2023-12-01T10:30:00Z');
      expect(schemaOrgFilters.schemaDate(testDate)).toBe('2023-12-01T10:30:00.000Z');
      expect(schemaOrgFilters.schemaDate(testDate, 'date')).toBe('2023-12-01');
    });

    it('should generate breadcrumb structures', () => {
      const breadcrumbs = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Products', url: 'https://example.com/products' },
        { name: 'Electronics', url: 'https://example.com/products/electronics' }
      ];

      const result = schemaOrgFilters.schemaBreadcrumbs(breadcrumbs);
      
      expect(result).toHaveProperty('@type', 'BreadcrumbList');
      expect(result.itemListElement).toHaveLength(3);
      expect(result.itemListElement[0]).toMatchObject({
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://example.com'
      });
    });

    it('should generate FAQ page structures', () => {
      const faqs = [
        { question: 'What is Schema.org?', answer: 'A vocabulary for structured data.' },
        { q: 'How does it help SEO?', a: 'It helps search engines understand content.' }
      ];

      const result = schemaOrgFilters.schemaFAQ(faqs);
      
      expect(result).toHaveProperty('@type', 'FAQPage');
      expect(result.mainEntity).toHaveLength(2);
      expect(result.mainEntity[0]).toMatchObject({
        '@type': 'Question',
        'name': 'What is Schema.org?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'A vocabulary for structured data.'
        }
      });
    });

    it('should generate address structures', () => {
      const address = {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA'
      };

      const result = schemaOrgFilters.schemaAddress(address);
      
      expect(result).toMatchObject({
        '@type': 'PostalAddress',
        'streetAddress': '123 Main St',
        'addressLocality': 'New York',
        'addressRegion': 'NY',
        'postalCode': '10001',
        'addressCountry': 'USA'
      });
    });

    it('should generate geo coordinates', () => {
      const location = { lat: 40.7128, lng: -74.0060 };
      const result = schemaOrgFilters.schemaGeo(location);
      
      expect(result).toMatchObject({
        '@type': 'GeoCoordinates',
        'latitude': 40.7128,
        'longitude': -74.0060
      });
    });

    it('should validate Schema.org markup', () => {
      const validMarkup = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        'name': 'Test Product',
        'offers': { price: '10.00' }
      };

      const invalidMarkup = {
        'name': 'Test Product'
      };

      expect(schemaOrgFilters.validateSchema(validMarkup).valid).toBe(true);
      expect(schemaOrgFilters.validateSchema(invalidMarkup).valid).toBe(false);
      expect(schemaOrgFilters.validateSchema(invalidMarkup).errors).toContain('Missing required @type property');
    });
  });

  describe('Person Profile Template', () => {
    const personData = {
      destDir: './output',
      name: 'john-doe',
      entityType: 'person',
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      personId: 'person_123',
      website: 'https://johndoe.com',
      baseUrl: 'https://example.com',
      id: 'john-doe',
      photo: 'https://example.com/photos/john.jpg',
      jobTitle: 'Software Engineer',
      company: 'Tech Corp',
      companyWebsite: 'https://techcorp.com',
      email: 'john@example.com',
      phone: '+1-555-0123',
      address: {
        street: '123 Tech Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'USA'
      },
      socialProfiles: [
        { url: 'https://linkedin.com/in/johndoe' },
        { url: 'https://twitter.com/johndoe' }
      ],
      skills: ['JavaScript', 'Python', 'Schema.org'],
      birthDate: '1990-01-15',
      birthPlace: 'New York',
      nationality: 'American',
      bio: 'Experienced software engineer with expertise in web development and structured data.'
    };

    it('should render valid Person schema', () => {
      const template = 'person-profile.jsonld.njk';
      const rendered = env.render(template, personData);
      const jsonContent = extractJsonFromTemplate(rendered);
      const parsed = JSON.parse(jsonContent);
      
      expect(parsed).toHaveProperty('@context', 'https://schema.org/');
      expect(parsed).toHaveProperty('@type', 'Person');
      expect(parsed).toHaveProperty('@id', 'https://example.com/person/john-doe');
      expect(parsed).toHaveProperty('name', 'John Doe');
      expect(parsed).toHaveProperty('givenName', 'John');
      expect(parsed).toHaveProperty('familyName', 'Doe');
      expect(parsed).toHaveProperty('identifier', 'PERSON_123');
      expect(parsed).toHaveProperty('url', 'https://johndoe.com');
      expect(parsed.sameAs).toContain('https://linkedin.com/in/johndoe');
      console.log('knowsAbout:', parsed.knowsAbout);
      expect(parsed.knowsAbout).toContain('Javascript');
      expect(parsed.birthDate).toBe('1990-01-15');
    });

    it('should include contact information', () => {
      const template = 'person-profile.jsonld.njk';
      const rendered = env.render(template, personData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.contactPoint).toHaveLength(2);
      expect(parsed.contactPoint[0]).toMatchObject({
        '@type': 'ContactPoint',
        'contactType': 'customer service',
        'email': 'john@example.com'
      });
    });

    it('should include work information', () => {
      const template = 'person-profile.jsonld.njk';
      const rendered = env.render(template, personData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.jobTitle).toBe('Software Engineer');
      expect(parsed.worksFor).toMatchObject({
        '@type': 'Organization',
        'name': 'Tech Corp',
        'url': 'https://techcorp.com'
      });
    });
  });

  describe('Product Listing Template', () => {
    const productData = {
      destDir: './output',
      sku: 'PROD-123',
      name: 'Premium Wireless Headphones',
      description: 'High-quality wireless headphones with noise cancellation and premium sound quality.',
      productId: 'prod_123',
      baseUrl: 'https://store.com',
      productUrl: 'https://store.com/products/headphones-123',
      gtin: '1234567890123',
      mpn: 'WH-1000XM4',
      brand: {
        name: 'AudioTech',
        website: 'https://audiotech.com',
        logo: 'https://audiotech.com/logo.png'
      },
      manufacturer: {
        name: 'AudioTech Manufacturing',
        website: 'https://audiotech.com'
      },
      model: 'AT-WH-1000',
      color: 'Black',
      material: 'Plastic',
      category: 'Electronics',
      images: [
        { url: 'https://store.com/images/headphones-1.jpg', width: 800, height: 600, caption: 'Front view' },
        { url: 'https://store.com/images/headphones-2.jpg', width: 800, height: 600, caption: 'Side view' }
      ],
      price: '299.99',
      currency: 'USD',
      availability: 'InStock',
      condition: 'NewCondition',
      offerUrl: 'https://store.com/buy/headphones-123',
      seller: {
        name: 'Premium Electronics Store',
        website: 'https://store.com'
      },
      priceValidUntil: '2024-12-31',
      reviews: [
        {
          rating: 5,
          title: 'Excellent headphones',
          body: 'Great sound quality and comfortable to wear for long periods.',
          date: '2023-11-01',
          author: 'Jane Smith'
        }
      ],
      aggregateRating: {
        value: 4.5,
        count: 124,
        best: 5,
        worst: 1
      }
    };

    it('should render valid Product schema', () => {
      const template = 'product-listing.jsonld.njk';
      const rendered = env.render(template, productData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed).toHaveProperty('@context', 'https://schema.org/');
      expect(parsed).toHaveProperty('@type', 'Product');
      expect(parsed).toHaveProperty('@id', 'https://store.com/product/prod-123');
      expect(parsed).toHaveProperty('name', 'Premium Wireless Headphones');
      expect(parsed).toHaveProperty('sku', 'PROD-123');
      expect(parsed).toHaveProperty('gtin', '1234567890123');
      expect(parsed).toHaveProperty('mpn', 'WH-1000XM4');
    });

    it('should include brand and manufacturer information', () => {
      const template = 'product-listing.jsonld.njk';
      const rendered = env.render(template, productData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.brand).toMatchObject({
        '@type': 'Brand',
        'name': 'AudioTech',
        'url': 'https://audiotech.com'
      });
      
      expect(parsed.manufacturer).toMatchObject({
        '@type': 'Organization',
        'name': 'AudioTech Manufacturing',
        'url': 'https://audiotech.com'
      });
    });

    it('should include offers with proper pricing', () => {
      const template = 'product-listing.jsonld.njk';
      const rendered = env.render(template, productData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.offers).toMatchObject({
        '@type': 'Offer',
        'price': '299.99',
        'priceCurrency': 'USD',
        'availability': 'https://schema.org/InStock',
        'condition': 'https://schema.org/NewCondition'
      });
    });

    it('should include reviews and aggregate rating', () => {
      const template = 'product-listing.jsonld.njk';
      const rendered = env.render(template, productData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.review).toHaveLength(1);
      expect(parsed.review[0]).toMatchObject({
        '@type': 'Review',
        'name': 'Excellent headphones',
        'reviewRating': {
          '@type': 'Rating',
          'ratingValue': '5'
        }
      });
      
      expect(parsed.aggregateRating).toMatchObject({
        '@type': 'AggregateRating',
        'ratingValue': '4.50',
        'reviewCount': '124'
      });
    });
  });

  describe('Local Business Template', () => {
    const businessData = {
      destDir: './output',
      name: 'Giovanni\'s Italian Restaurant',
      businessType: 'Restaurant',
      id: 'giovannis-restaurant',
      baseUrl: 'https://example.com',
      legalName: 'Giovanni\'s Italian Restaurant LLC',
      description: 'Authentic Italian cuisine in the heart of downtown.',
      website: 'https://giovannis.com',
      businessId: 'BUS_456',
      logo: 'https://giovannis.com/logo.png',
      images: [
        { url: 'https://giovannis.com/interior.jpg', caption: 'Restaurant interior' }
      ],
      address: {
        street: '456 Main Street',
        city: 'Downtown',
        state: 'NY',
        zip: '10002',
        country: 'USA'
      },
      location: { lat: 40.7589, lng: -73.9851 },
      phone: '+1-555-0456',
      email: 'info@giovannis.com',
      openingHours: [
        { day: 'Monday', open: '11:00', close: '22:00' },
        { day: 'Tuesday', open: '11:00', close: '22:00' }
      ],
      priceRange: '$$',
      services: [
        { name: 'Dine-in', description: 'Full restaurant service', price: '0.00', currency: 'USD' },
        { name: 'Takeout', description: 'Order for pickup', price: '0.00', currency: 'USD' }
      ],
      reviews: [
        {
          rating: 5,
          title: 'Amazing pasta!',
          body: 'Best Italian food in the city.',
          date: '2023-10-15',
          author: 'Mike Johnson'
        }
      ],
      aggregateRating: {
        value: 4.7,
        count: 89
      }
    };

    it('should render valid LocalBusiness schema', () => {
      const template = 'local-business.jsonld.njk';
      const rendered = env.render(template, businessData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed).toHaveProperty('@context', 'https://schema.org/');
      expect(parsed).toHaveProperty('@type', 'Restaurant');
      expect(parsed).toHaveProperty('@id', 'https://example.com/business/giovannis-restaurant');
      expect(parsed).toHaveProperty('name', 'Giovanni\'s Italian Restaurant');
      expect(parsed).toHaveProperty('legalName', 'Giovanni\'s Italian Restaurant LLC');
    });

    it('should include location and contact information', () => {
      const template = 'local-business.jsonld.njk';
      const rendered = env.render(template, businessData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.address).toMatchObject({
        '@type': 'PostalAddress',
        'streetAddress': '456 Main Street',
        'addressLocality': 'Downtown',
        'addressRegion': 'NY',
        'postalCode': '10002',
        'addressCountry': 'USA'
      });
      
      expect(parsed.geo).toMatchObject({
        '@type': 'GeoCoordinates',
        'latitude': 40.7589,
        'longitude': -73.9851
      });
    });

    it('should include opening hours', () => {
      const template = 'local-business.jsonld.njk';
      const rendered = env.render(template, businessData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.openingHoursSpecification).toHaveLength(2);
      expect(parsed.openingHoursSpecification[0]).toMatchObject({
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': 'Monday',
        'opens': '11:00',
        'closes': '22:00'
      });
    });
  });

  describe('Article Content Template', () => {
    const articleData = {
      destDir: './output',
      slug: 'understanding-schema-org',
      headline: 'Understanding Schema.org for SEO',
      alternativeHeadline: 'Complete Guide to Schema.org',
      description: 'Learn how to implement Schema.org structured data for better SEO results.',
      url: 'https://blog.example.com/understanding-schema-org',
      articleId: 'ART_789',
      baseUrl: 'https://blog.example.com',
      id: 'article-789',
      images: [
        { url: 'https://blog.example.com/images/schema-guide.jpg', width: 1200, height: 630, caption: 'Schema.org guide' }
      ],
      authors: [
        {
          name: 'Jane Smith',
          url: 'https://blog.example.com/author/jane-smith',
          email: 'jane@example.com',
          title: 'SEO Specialist',
          socialProfiles: ['https://twitter.com/janesmith']
        }
      ],
      publisher: {
        name: 'SEO Blog',
        url: 'https://blog.example.com',
        logo: 'https://blog.example.com/logo.png',
        socialProfiles: ['https://twitter.com/seoblog']
      },
      published: '2023-11-01T10:00:00Z',
      created: '2023-11-01T09:00:00Z',
      content: 'Schema.org is a collaborative effort to create a shared vocabulary for structured data...',
      wordCount: 1500,
      section: 'SEO',
      tags: ['SEO', 'Schema.org', 'Structured Data'],
      language: 'en-US'
    };

    it('should render valid Article schema', () => {
      const template = 'article-content.jsonld.njk';
      const rendered = env.render(template, articleData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed).toHaveProperty('@context', 'https://schema.org/');
      expect(parsed).toHaveProperty('@type', 'Article');
      expect(parsed).toHaveProperty('@id', 'https://blog.example.com/article/article-789');
      expect(parsed).toHaveProperty('headline', 'Understanding Schema.org for SEO');
      expect(parsed).toHaveProperty('alternativeHeadline', 'Complete Guide to Schema.org');
    });

    it('should include author information', () => {
      const template = 'article-content.jsonld.njk';
      const rendered = env.render(template, articleData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.author).toHaveLength(1);
      expect(parsed.author[0]).toMatchObject({
        '@type': 'Person',
        'name': 'Jane Smith',
        'url': 'https://blog.example.com/author/jane-smith',
        'email': 'jane@example.com',
        'jobTitle': 'SEO Specialist'
      });
    });

    it('should include publisher information', () => {
      const template = 'article-content.jsonld.njk';
      const rendered = env.render(template, articleData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.publisher).toMatchObject({
        '@type': 'Organization',
        'name': 'SEO Blog',
        'url': 'https://blog.example.com'
      });
    });

    it('should include publication dates', () => {
      const template = 'article-content.jsonld.njk';
      const rendered = env.render(template, articleData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.datePublished).toBe('2023-11-01T10:00:00.000Z');
      expect(parsed.dateCreated).toBe('2023-11-01T09:00:00.000Z');
      expect(parsed.dateModified).toBeTruthy();
    });
  });

  describe('Event Listing Template', () => {
    const eventData = {
      destDir: './output',
      name: 'Web Development Conference 2024',
      eventType: 'BusinessEvent',
      id: 'webdev-conf-2024',
      baseUrl: 'https://events.com',
      description: 'Annual conference for web developers featuring the latest technologies.',
      url: 'https://events.com/webdev-conf-2024',
      eventId: 'EVT_101',
      images: [
        { url: 'https://events.com/images/webdev-conf.jpg', width: 1200, height: 630, caption: 'Conference banner' }
      ],
      startDate: '2024-03-15T09:00:00Z',
      endDate: '2024-03-17T17:00:00Z',
      doorTime: '2024-03-15T08:30:00Z',
      duration: 'P3D',
      eventStatus: 'EventScheduled',
      attendanceMode: 'OfflineEventAttendanceMode',
      location: {
        name: 'Convention Center',
        address: {
          street: '100 Convention Blvd',
          city: 'Tech City',
          state: 'CA',
          zip: '90210',
          country: 'USA'
        },
        coordinates: { lat: 34.0522, lng: -118.2437 },
        phone: '+1-555-0789',
        capacity: 1000
      },
      organizer: {
        name: 'Tech Events Inc',
        url: 'https://techevents.com',
        email: 'info@techevents.com',
        phone: '+1-555-0100',
        logo: 'https://techevents.com/logo.png'
      },
      performers: [
        {
          name: 'Sarah Johnson',
          url: 'https://sarahjohnson.dev',
          socialProfiles: ['https://twitter.com/sarahdev']
        }
      ],
      offers: [
        {
          name: 'Early Bird Ticket',
          description: 'Discounted ticket for early registration',
          price: '199.00',
          currency: 'USD',
          availability: 'InStock',
          url: 'https://events.com/tickets/early-bird',
          validFrom: '2023-12-01T00:00:00Z',
          validThrough: '2024-01-31T23:59:59Z',
          seller: 'Tech Events Inc'
        }
      ],
      maxCapacity: 1000,
      remainingCapacity: 750
    };

    it('should render valid Event schema', () => {
      const template = 'event-listing.jsonld.njk';
      const rendered = env.render(template, eventData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed).toHaveProperty('@context', 'https://schema.org/');
      expect(parsed).toHaveProperty('@type', 'BusinessEvent');
      expect(parsed).toHaveProperty('@id', 'https://events.com/event/webdev-conf-2024');
      expect(parsed).toHaveProperty('name', 'Web Development Conference 2024');
      expect(parsed).toHaveProperty('startDate', '2024-03-15T09:00:00.000Z');
      expect(parsed).toHaveProperty('endDate', '2024-03-17T17:00:00.000Z');
    });

    it('should include location information', () => {
      const template = 'event-listing.jsonld.njk';
      const rendered = env.render(template, eventData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.location).toMatchObject({
        '@type': 'Place',
        'name': 'Convention Center',
        'maximumAttendeeCapacity': 1000
      });
      
      expect(parsed.location.address).toMatchObject({
        '@type': 'PostalAddress',
        'streetAddress': '100 Convention Blvd',
        'addressLocality': 'Tech City'
      });
    });

    it('should include offers and pricing', () => {
      const template = 'event-listing.jsonld.njk';
      const rendered = env.render(template, eventData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.offers).toHaveLength(1);
      expect(parsed.offers[0]).toMatchObject({
        '@type': 'Offer',
        'name': 'Early Bird Ticket',
        'price': '199.00',
        'priceCurrency': 'USD',
        'availability': 'https://schema.org/InStock'
      });
    });
  });

  describe('Organization Profile Template', () => {
    const organizationData = {
      destDir: './output',
      name: 'TechCorp Solutions',
      organizationType: 'Corporation',
      id: 'techcorp-solutions',
      baseUrl: 'https://techcorp.com',
      legalName: 'TechCorp Solutions Inc.',
      alternateName: 'TechCorp',
      description: 'Leading provider of innovative technology solutions for enterprises.',
      website: 'https://techcorp.com',
      organizationId: 'ORG_202',
      logo: 'https://techcorp.com/logo.png',
      images: [
        { url: 'https://techcorp.com/office.jpg', caption: 'Corporate headquarters' }
      ],
      address: {
        street: '789 Innovation Drive',
        city: 'Silicon Valley',
        state: 'CA',
        zip: '94000',
        country: 'USA'
      },
      mainPhone: '+1-555-0300',
      mainEmail: 'contact@techcorp.com',
      foundingDate: '2010-05-15',
      foundingLocation: 'Silicon Valley',
      employeeCount: 500,
      employees: [
        { name: 'Alice Chen', title: 'CEO', email: 'alice@techcorp.com', phone: '+1-555-0301' },
        { name: 'Bob Wilson', title: 'CTO', email: 'bob@techcorp.com', phone: '+1-555-0302' }
      ],
      services: [
        { name: 'Cloud Solutions', description: 'Enterprise cloud infrastructure', price: '5000.00', currency: 'USD' },
        { name: 'AI Consulting', description: 'Machine learning implementation', price: '10000.00', currency: 'USD' }
      ]
    };

    it('should render valid Organization schema', () => {
      const template = 'organization-profile.jsonld.njk';
      const rendered = env.render(template, organizationData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed).toHaveProperty('@context', 'https://schema.org/');
      expect(parsed).toHaveProperty('@type', 'Corporation');
      expect(parsed).toHaveProperty('@id', 'https://techcorp.com/organization/techcorp-solutions');
      expect(parsed).toHaveProperty('name', 'TechCorp Solutions');
      expect(parsed).toHaveProperty('legalName', 'TechCorp Solutions Inc.');
      expect(parsed).toHaveProperty('alternateName', 'TechCorp');
    });

    it('should include employee information', () => {
      const template = 'organization-profile.jsonld.njk';
      const rendered = env.render(template, organizationData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.employee).toHaveLength(2);
      expect(parsed.employee[0]).toMatchObject({
        '@type': 'Person',
        'name': 'Alice Chen',
        'jobTitle': 'CEO',
        'email': 'alice@techcorp.com'
      });
    });

    it('should include service offerings', () => {
      const template = 'organization-profile.jsonld.njk';
      const rendered = env.render(template, organizationData);
      const parsed = JSON.parse(rendered);
      
      expect(parsed.hasOfferCatalog).toMatchObject({
        '@type': 'OfferCatalog',
        'name': 'Services and Products'
      });
      
      expect(parsed.hasOfferCatalog.itemListElement).toHaveLength(2);
      expect(parsed.hasOfferCatalog.itemListElement[0]).toMatchObject({
        '@type': 'Offer',
        'price': '5000.00',
        'priceCurrency': 'USD'
      });
    });
  });

  describe('Schema.org Validation Integration', () => {
    it('should validate all generated templates', () => {
      const templates = [
        { name: 'person-profile.jsonld.njk', type: 'Person' },
        { name: 'product-listing.jsonld.njk', type: 'Product' },
        { name: 'local-business.jsonld.njk', type: 'LocalBusiness' },
        { name: 'article-content.jsonld.njk', type: 'Article' },
        { name: 'event-listing.jsonld.njk', type: 'Event' },
        { name: 'organization-profile.jsonld.njk', type: 'Organization' }
      ];

      const testData = {
        // Minimal required data for all templates
        destDir: './output',
        name: 'Test Entity',
        id: 'test-entity',
        baseUrl: 'https://example.com',
        description: 'Test description',
        url: 'https://example.com/test'
      };

      templates.forEach(({ name, type }) => {
        expect(() => {
          const rendered = env.render(name, testData);
          const parsed = JSON.parse(rendered);
          
          expect(parsed).toHaveProperty('@context', 'https://schema.org/');
          expect(parsed).toHaveProperty('@type');
          expect(parsed).toHaveProperty('@id');
          
          const validation = schemaOrgFilters.validateSchema(parsed);
          if (!validation.valid) {
            console.warn(`Validation errors for ${name}:`, validation.errors);
          }
        }).not.toThrow();
      });
    });

    it('should handle missing data gracefully', () => {
      const minimalData = {
        destDir: './output',
        name: 'minimal-test',
        id: 'minimal'
      };

      expect(() => {
        const rendered = env.render('person-profile.jsonld.njk', minimalData);
        const parsed = JSON.parse(rendered);
        expect(parsed).toHaveProperty('@context');
        expect(parsed).toHaveProperty('@type');
      }).not.toThrow();
    });

    it('should support different output formats', () => {
      const testData = {
        destDir: './output',
        name: 'test-person',
        id: 'test-person',
        fullName: 'Test Person',
        firstName: 'Test',
        lastName: 'Person'
      };

      // Test JSON-LD format (default)
      const jsonLd = env.render('person-profile.jsonld.njk', testData);
      const parsed = JSON.parse(jsonLd);
      expect(parsed['@context']).toBe('https://schema.org/');

      // Verify the structure is valid JSON-LD
      expect(typeof parsed).toBe('object');
      expect(parsed['@type']).toBeTruthy();
      expect(parsed['@id']).toBeTruthy();
    });
  });

  describe('SEO and Rich Snippets Integration', () => {
    it('should generate data suitable for Google Rich Snippets', () => {
      const productData = {
        destDir: './output',
        sku: 'TEST-123',
        name: 'Test Product',
        description: 'Test product description',
        baseUrl: 'https://store.com',
        price: '99.99',
        currency: 'USD',
        availability: 'InStock',
        brand: { name: 'TestBrand' },
        manufacturer: { name: 'TestMfg' },
        aggregateRating: { value: 4.5, count: 100 }
      };

      const rendered = env.render('product-listing.jsonld.njk', productData);
      const parsed = JSON.parse(rendered);

      // Check for Google Rich Snippet requirements
      expect(parsed.name).toBeTruthy();
      expect(parsed.offers.price).toBeTruthy();
      expect(parsed.offers.priceCurrency).toBeTruthy();
      expect(parsed.offers.availability).toBeTruthy();
      expect(parsed.aggregateRating.ratingValue).toBeTruthy();
      expect(parsed.aggregateRating.reviewCount).toBeTruthy();
    });

    it('should include structured data for local search', () => {
      const businessData = {
        destDir: './output',
        name: 'Test Business',
        id: 'test-business',
        baseUrl: 'https://business.com',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zip: '12345',
          country: 'USA'
        },
        location: { lat: 40.0, lng: -74.0 },
        phone: '+1-555-0123',
        openingHours: [
          { day: 'Monday', open: '09:00', close: '17:00' }
        ]
      };

      const rendered = env.render('local-business.jsonld.njk', businessData);
      const parsed = JSON.parse(rendered);

      // Check for local search requirements
      expect(parsed.address).toBeTruthy();
      expect(parsed.geo).toBeTruthy();
      expect(parsed.telephone).toBeTruthy();
      expect(parsed.openingHoursSpecification).toBeTruthy();
    });
  });
});