import { describe, it, expect } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';

describe('Enhanced Filters Integration', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  it('should register all enhanced inflection filters', () => {
    const template = `
      {{- 'user_posts' | classify -}}|
      {{- 'UserPost' | tableize -}}|  
      {{- 'Hello World!' | slug -}}|
      {{- 'user_name' | humanize -}}|
      {{- 'HelloWorld' | underscore -}}|
      {{- 'hello_world' | dasherize -}}|
      {{- 'hello world' | titleCase -}}|
      {{- 'hello_world' | sentenceCase -}}|
      {{- 'hello_world' | camelize -}}|
      {{- 'Admin::Users::User' | demodulize -}}
    `.trim();

    const result = env.renderString(template);
    const parts = result.split('|');

    expect(parts[0]).toBe('UserPost');
    expect(parts[1]).toBe('user_posts');
    expect(parts[2]).toBe('hello-world');
    expect(parts[3]).toBe('User name');
    expect(parts[4]).toBe('hello_world');
    expect(parts[5]).toBe('hello-world');
    expect(parts[6]).toBe('Hello World');
    expect(parts[7]).toBe('Hello world');
    expect(parts[8]).toBe('helloWorld');
    expect(parts[9]).toBe('User');
  });

  it('should register all string utility filters', () => {
    const template = `
      {{- 'This is a long string' | truncate(10) -}}|
      {{- 'test' | pad(8) -}}|
      {{- 'abc' | repeat(3) -}}|
      {{- 'hello' | reverse -}}|
      {{- 'Hello World' | swapCase -}}
    `.trim();

    const result = env.renderString(template);
    const parts = result.split('|');

    expect(parts[0]).toBe('This is...');
    expect(parts[1]).toBe('  test  ');
    expect(parts[2]).toBe('abcabcabc');
    expect(parts[3]).toBe('olleh');
    expect(parts[4]).toBe('hELLO wORLD');
  });

  it('should work with chained filters', () => {
    const template = '{{ "user_management_system" | classify | reverse | lower }}';
    const result = env.renderString(template);
    expect(result).toBe('metsystnemegamresu');
  });

  it('should handle edge cases gracefully', () => {
    const template = `
      {{- null | titleCase | default('N/A') -}}|
      {{- '' | slug | default('empty') -}}|
      {{- 'short' | truncate(10) -}}
    `.trim();

    const result = env.renderString(template);
    const parts = result.split('|');

    expect(parts[0]).toBe('N/A');
    expect(parts[1]).toBe('empty');
    expect(parts[2]).toBe('short');
  });

  it('should support filter parameters', () => {
    const template = `
      {{- 'Hello World!' | slug('_') -}}|
      {{- 'hello_world' | camelize(true) -}}|
      {{- 'Long text here' | truncate(8, '…') -}}
    `.trim();

    const result = env.renderString(template);
    const parts = result.split('|');

    expect(parts[0]).toBe('hello_world');
    expect(parts[1]).toBe('HelloWorld');
    expect(parts[2]).toBe('Long t…');
  });
});