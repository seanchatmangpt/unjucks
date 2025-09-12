#!/usr/bin/env node

import { Command } from 'commander';
import { createDriftDetectCommand } from './enhanced-detect.js';
import { createDriftReportCommand } from './report.js';
import { createDriftBaselineCommand } from './baseline.js';
import { createCIHelperCommand } from './ci-helper.js';

/**
 * Create the main drift command with all subcommands
 * @returns {Command} The configured drift command
 */
export function createDriftCommand() {
  const driftCommand = new Command('drift')
    .description('Artifact drift detection and analysis system');

  // Add all drift detection subcommands
  driftCommand.addCommand(createDriftDetectCommand());
  driftCommand.addCommand(createDriftReportCommand());
  driftCommand.addCommand(createDriftBaselineCommand());
  driftCommand.addCommand(createCIHelperCommand());

  return driftCommand;
}