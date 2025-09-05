import { describe, it, expect } from 'vitest';
import { createTestContext } from './support/test-context.js';

describe('Minimal CLI Test', () => {
  it('should execute CLI version command', async () => {
    const context = createTestContext();
    
    console.log('Test starting...');
    console.log('Working directory:', process.cwd());
    
    const cliPath = `${process.cwd()}/dist/cli.mjs`;
    const command = `node "${cliPath}" --version`;
    
    console.log('About to execute:', command);
    
    try {
      const result = await context.helper.executeCommand(command);
      
      console.log('Result received:', {
        exitCode: result.exitCode,
        stdout: JSON.stringify(result.stdout),
        stderr: JSON.stringify(result.stderr),
        duration: result.duration
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('0.0.0');
      
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });
});