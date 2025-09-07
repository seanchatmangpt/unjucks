import { describe, it, expect } from 'vitest';
import { githubCommand } from '../../src/commands/github.js';

describe('GitHub Command', () => {
  it('should be defined with correct structure', () => {
    expect(githubCommand).toBeDefined();
    expect(githubCommand.meta.name).toBe('github');
    expect(githubCommand.meta.description).toContain('GitHub integration');
  });

  it('should have all required subcommands', () => {
    const expectedSubcommands = [
      'analyze',
      'pr',
      'issues',
      'release',
      'sync',
      'workflow',
      'stats'
    ];

    const actualSubcommands = Object.keys(githubCommand.subCommands || {});
    expect(actualSubcommands).toEqual(expect.arrayContaining(expectedSubcommands));
    expect(actualSubcommands.length).toBe(expectedSubcommands.length);
  });

  it('should have analyze subcommand with correct args', () => {
    const analyzeCmd = githubCommand.subCommands?.analyze;
    expect(analyzeCmd).toBeDefined();
    expect(analyzeCmd?.meta.name).toBe('analyze');
    
    const args = analyzeCmd?.args;
    expect(args?.repo).toBeDefined();
    expect(args?.repo.required).toBe(true);
    expect(args?.type).toBeDefined();
    expect(args?.type.default).toBe('code_quality');
  });

  it('should have pr subcommand with correct args', () => {
    const prCmd = githubCommand.subCommands?.pr;
    expect(prCmd).toBeDefined();
    expect(prCmd?.meta.name).toBe('pr');
    
    const args = prCmd?.args;
    expect(args?.action).toBeDefined();
    expect(args?.action.required).toBe(true);
    expect(args?.repo).toBeDefined();
    expect(args?.repo.required).toBe(true);
  });

  it('should have issues subcommand with correct args', () => {
    const issuesCmd = githubCommand.subCommands?.issues;
    expect(issuesCmd).toBeDefined();
    expect(issuesCmd?.meta.name).toBe('issues');
    
    const args = issuesCmd?.args;
    expect(args?.action).toBeDefined();
    expect(args?.action.required).toBe(true);
    expect(args?.repo).toBeDefined();
    expect(args?.repo.required).toBe(true);
  });

  it('should have release subcommand with correct args', () => {
    const releaseCmd = githubCommand.subCommands?.release;
    expect(releaseCmd).toBeDefined();
    expect(releaseCmd?.meta.name).toBe('release');
    
    const args = releaseCmd?.args;
    expect(args?.action).toBeDefined();
    expect(args?.action.required).toBe(true);
    expect(args?.repo).toBeDefined();
    expect(args?.repo.required).toBe(true);
  });

  it('should have sync subcommand with correct args', () => {
    const syncCmd = githubCommand.subCommands?.sync;
    expect(syncCmd).toBeDefined();
    expect(syncCmd?.meta.name).toBe('sync');
    
    const args = syncCmd?.args;
    expect(args?.repos).toBeDefined();
    expect(args?.repos.required).toBe(true);
    expect(args?.action).toBeDefined();
    expect(args?.action.default).toBe('labels');
  });

  it('should have workflow subcommand with correct args', () => {
    const workflowCmd = githubCommand.subCommands?.workflow;
    expect(workflowCmd).toBeDefined();
    expect(workflowCmd?.meta.name).toBe('workflow');
    
    const args = workflowCmd?.args;
    expect(args?.action).toBeDefined();
    expect(args?.action.required).toBe(true);
    expect(args?.repo).toBeDefined();
    expect(args?.repo.required).toBe(true);
  });

  it('should have stats subcommand with correct args', () => {
    const statsCmd = githubCommand.subCommands?.stats;
    expect(statsCmd).toBeDefined();
    expect(statsCmd?.meta.name).toBe('stats');
    
    const args = statsCmd?.args;
    expect(args?.repo).toBeDefined();
    expect(args?.repo.required).toBe(true);
    expect(args?.format).toBeDefined();
    expect(args?.format.default).toBe('table');
  });
});