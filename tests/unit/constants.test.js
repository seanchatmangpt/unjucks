/**
 * Tests for Constants utility
 */

import { describe, it, expect } from 'vitest';
import { CONSTANTS, getEnvironmentConfig, validateSystemRequirements } from '../../src/utils/constants.js';

describe('Constants', () => {
  it('should have required application constants', () => {
    expect(CONSTANTS.APP_NAME).toBe('unjucks');
    expect(CONSTANTS.VERSION).toBe('3.0.0');
    expect(CONSTANTS.DESCRIPTION).toContain('template scaffolding');
  });

  it('should have proper file extensions', () => {
    expect(CONSTANTS.TEMPLATE_EXTENSIONS).toContain('.njk');
    expect(CONSTANTS.RDF_FILE_EXTENSIONS).toContain('.ttl');
  });

  it('should provide environment-specific config', () => {
    const devConfig = getEnvironmentConfig('development');
    expect(devConfig.LOG_LEVEL).toBe('debug');
    
    const prodConfig = getEnvironmentConfig('production');
    expect(prodConfig.LOG_LEVEL).toBe('info');
  });

  it('should validate system requirements', () => {
    const validation = validateSystemRequirements();
    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('issues');
    expect(validation).toHaveProperty('system');
  });
});