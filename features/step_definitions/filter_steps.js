/**
 * Template Filter Step Definitions for KGEN Templates
 * Tests for Nunjucks custom filters including case transformations and RDF processing
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { KgenTemplateEngine } from '../../packages/kgen-templates/src/template-engine.js';

/**
 * Filter test state interface
 * @typedef {Object} FilterTestState
 * @property {KgenTemplateEngine} engine - Template engine instance
 * @property {string} inputValue - Input value for filter testing
 * @property {string} filterName - Name of the filter being tested
 * @property {Array<any>} filterArgs - Arguments for the filter
 * @property {any} filterResult - Result of filter application
 * @property {string} templateWithFilter - Template content with filter
 * @property {string} renderedResult - Rendered template result
 * @property {Record<string, any>} context - Template rendering context
 */

/** @type {FilterTestState} */
const filterState = {
  engine: null,
  inputValue: '',
  filterName: '',
  filterArgs: [],
  filterResult: null,
  templateWithFilter: '',
  renderedResult: '',
  context: {}
};

// Initialize engine for filter testing
Given('I have a template engine with custom filters', function() {
  filterState.engine = new KgenTemplateEngine({
    templateDirs: ['/Users/sac/unjucks/features/fixtures/templates'],
    deterministic: true
  });
  expect(filterState.engine).to.not.be.null;
});

// String transformation filter tests
Given('I have the input string {string}', function(input) {
  filterState.inputValue = input;
});

When('I apply the {string} filter', function(filterName) {
  filterState.filterName = filterName;
  
  // Test direct filter access
  const filter = filterState.engine.env.filters[filterName];
  expect(filter).to.be.a('function', `Filter ${filterName} should exist`);
  
  filterState.filterResult = filter(filterState.inputValue);
});

When('I apply the {string} filter with arguments {string}', function(filterName, argsJson) {
  filterState.filterName = filterName;
  filterState.filterArgs = JSON.parse(argsJson);
  
  const filter = filterState.engine.env.filters[filterName];
  expect(filter).to.be.a('function', `Filter ${filterName} should exist`);
  
  filterState.filterResult = filter(filterState.inputValue, ...filterState.filterArgs);
});

Then('the filtered result should be {string}', function(expected) {
  expect(filterState.filterResult).to.equal(expected);
});

// Template-based filter tests
Given('I have a template {string} with filter {string}', function(template, filterName) {
  filterState.templateWithFilter = template;
  filterState.filterName = filterName;
});

When('I render the template with variable {string} = {string}', function(varName, varValue) {
  filterState.context[varName] = varValue;
  filterState.renderedResult = filterState.engine.env.renderString(
    filterState.templateWithFilter, 
    filterState.context
  );
});

Then('the rendered output should be {string}', function(expected) {
  expect(filterState.renderedResult.trim()).to.equal(expected);
});

// Case transformation specific tests
Then('the pascalCase result should be {string}', function(expected) {
  const filter = filterState.engine.env.filters.pascalCase;
  const result = filter(filterState.inputValue);
  expect(result).to.equal(expected);
});

Then('the camelCase result should be {string}', function(expected) {
  const filter = filterState.engine.env.filters.camelCase;
  const result = filter(filterState.inputValue);
  expect(result).to.equal(expected);
});

Then('the kebabCase result should be {string}', function(expected) {
  const filter = filterState.engine.env.filters.kebabCase;
  const result = filter(filterState.inputValue);
  expect(result).to.equal(expected);
});

Then('the snakeCase result should be {string}', function(expected) {
  const filter = filterState.engine.env.filters.snakeCase;
  const result = filter(filterState.inputValue);
  expect(result).to.equal(expected);
});

Then('the upperCase result should be {string}', function(expected) {
  const filter = filterState.engine.env.filters.upperCase;
  const result = filter(filterState.inputValue);
  expect(result).to.equal(expected);
});

Then('the lowerCase result should be {string}', function(expected) {
  const filter = filterState.engine.env.filters.lowerCase;
  const result = filter(filterState.inputValue);
  expect(result).to.equal(expected);
});

// Array filter tests
Given('I have an array input {string}', function(arrayJson) {
  filterState.inputValue = JSON.parse(arrayJson);
});

When('I apply the join filter with separator {string}', function(separator) {
  const filter = filterState.engine.env.filters.join;
  filterState.filterResult = filter(filterState.inputValue, separator);
});

When('I apply the map filter with property {string}', function(property) {
  const filter = filterState.engine.env.filters.map;
  filterState.filterResult = filter(filterState.inputValue, property);
});

Then('the joined result should be {string}', function(expected) {
  expect(filterState.filterResult).to.equal(expected);
});

Then('the mapped result should be {string}', function(expected) {
  const expectedArray = JSON.parse(expected);
  expect(filterState.filterResult).to.deep.equal(expectedArray);
});

// Hash filter tests
When('I apply the hash filter', function() {
  const filter = filterState.engine.env.filters.hash;
  filterState.filterResult = filter(filterState.inputValue);
});

Then('the result should be a hash string of length {int}', function(expectedLength) {
  expect(filterState.filterResult).to.be.a('string');
  expect(filterState.filterResult).to.have.length(expectedLength);
  expect(filterState.filterResult).to.match(/^[a-f0-9]+$/);
});

// Default filter tests
Given('I have an undefined variable', function() {
  filterState.inputValue = undefined;
});

When('I apply the default filter with value {string}', function(defaultValue) {
  const filter = filterState.engine.env.filters.default;
  filterState.filterResult = filter(filterState.inputValue, defaultValue);
});

Then('the result should be the default value {string}', function(expected) {
  expect(filterState.filterResult).to.equal(expected);
});

// Quote filter tests
When('I apply the quote filter', function() {
  const filter = filterState.engine.env.filters.quote;
  filterState.filterResult = filter(filterState.inputValue);
});

Then('the result should be quoted as {string}', function(expected) {
  expect(filterState.filterResult).to.equal(expected);
});

// Complex filter chain tests
Given('I have a template with chained filters {string}', function(template) {
  filterState.templateWithFilter = template;
});

When('I render with context {string}', function(contextJson) {
  filterState.context = JSON.parse(contextJson);
  filterState.renderedResult = filterState.engine.env.renderString(
    filterState.templateWithFilter,
    filterState.context
  );
});

// Filter existence tests
Then('the {string} filter should be available', function(filterName) {
  const filter = filterState.engine.env.filters[filterName];
  expect(filter).to.be.a('function', `Filter ${filterName} should be available`);
});

Then('all case transformation filters should be available', function() {
  const caseFilters = ['pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'upperCase', 'lowerCase'];
  caseFilters.forEach(filterName => {
    const filter = filterState.engine.env.filters[filterName];
    expect(filter).to.be.a('function', `Filter ${filterName} should be available`);
  });
});

Then('all utility filters should be available', function() {
  const utilityFilters = ['default', 'join', 'map', 'quote', 'hash'];
  utilityFilters.forEach(filterName => {
    const filter = filterState.engine.env.filters[filterName];
    expect(filter).to.be.a('function', `Filter ${filterName} should be available`);
  });
});

// Filter error handling tests
When('I apply an invalid filter {string}', function(filterName) {
  try {
    const filter = filterState.engine.env.filters[filterName];
    if (!filter) {
      throw new Error(`Filter ${filterName} not found`);
    }
    filterState.filterResult = filter(filterState.inputValue);
  } catch (error) {
    filterState.filterResult = error;
  }
});

Then('a filter error should be thrown', function() {
  expect(filterState.filterResult).to.be.an('error');
});

Then('the error message should contain {string}', function(expectedMessage) {
  expect(filterState.filterResult.message).to.contain(expectedMessage);
});

// Edge case tests
Given('I have null input', function() {
  filterState.inputValue = null;
});

Given('I have empty string input', function() {
  filterState.inputValue = '';
});

Given('I have whitespace-only input {string}', function(input) {
  filterState.inputValue = input;
});

Then('the filter should handle null gracefully', function() {
  const filter = filterState.engine.env.filters[filterState.filterName];
  expect(() => filter(null)).to.not.throw();
});

Then('the filter should handle empty string gracefully', function() {
  const filter = filterState.engine.env.filters[filterState.filterName];
  expect(() => filter('')).to.not.throw();
});

// Performance tests for filters
When('I apply the filter {int} times', function(iterations) {
  const filter = filterState.engine.env.filters[filterState.filterName];
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    filter(filterState.inputValue);
  }
  
  const endTime = performance.now();
  filterState.filterResult = endTime - startTime;
});

Then('the total execution time should be less than {int} milliseconds', function(maxTime) {
  expect(filterState.filterResult).to.be.lessThan(maxTime);
});

export { filterState };