/**
 * Deterministic Time Mixin
 * 
 * Mixin to add deterministic timestamp methods to classes
 */

import { getDeterministicTimestamp, getDeterministicDate, getDeterministicISOString } from './deterministic-time.js';

export const DeterministicTimeMixin = {
  /**
   * Get deterministic timestamp (replaces Date.now())
   */
  getDeterministicTimestamp() {
    return getDeterministicTimestamp();
  },
  
  /**
   * Get deterministic Date object (replaces new Date())
   */
  getDeterministicDate() {
    return getDeterministicDate();
  },
  
  /**
   * Get deterministic ISO string
   */
  getDeterministicISOString() {
    return getDeterministicISOString();
  }
};

/**
 * Apply deterministic time mixin to a class
 */
export function withDeterministicTime(BaseClass) {
  return class extends BaseClass {
    getDeterministicTimestamp() {
      return getDeterministicTimestamp();
    }
    
    getDeterministicDate() {
      return getDeterministicDate();
    }
    
    getDeterministicISOString() {
      return getDeterministicISOString();
    }
  };
}
