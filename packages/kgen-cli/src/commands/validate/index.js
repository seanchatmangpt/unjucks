#!/usr/bin/env node

import { Command } from 'commander';
import { createValidateArtifactsCommand } from './artifacts.js';
import { createValidateConfigCommand } from './config.js';
import { createValidateGraphCommand } from './graph.js';
import { createValidateProvenanceCommand } from './provenance.js';
import { createValidateTemplatesCommand } from './templates.js';

/**
 * Create the main validate command with all subcommands
 * @returns {Command} The configured validate command
 */
export function createValidateCommand() {
  const validateCommand = new Command('validate')
    .description('Comprehensive validation system for KGEN artifacts, graphs, and configurations');

  // Add all validation subcommands
  validateCommand.addCommand(createValidateArtifactsCommand());
  validateCommand.addCommand(createValidateConfigCommand());
  validateCommand.addCommand(createValidateGraphCommand());
  validateCommand.addCommand(createValidateProvenanceCommand());
  validateCommand.addCommand(createValidateTemplatesCommand());

  return validateCommand;
}