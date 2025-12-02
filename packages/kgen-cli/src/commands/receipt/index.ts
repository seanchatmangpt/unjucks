/**
 * Receipt Command Group
 * 
 * Commands for displaying and managing attestation receipts
 * that provide cryptographic proof of artifact generation.
 */

import { defineCommand } from 'citty';
import showCommand from './show.js';

export default defineCommand({
  meta: {
    name: 'receipt',
    description: 'Display and manage attestation receipts for generated artifacts'
  },
  subCommands: {
    show: showCommand
  },
  async run() {
    const result = {
      success: true,
      data: {
        tool: 'receipt',
        description: 'Display and manage attestation receipts for generated artifacts',
        verbs: [
          {
            name: 'show',
            description: 'Display attestation details and git-note information',
            usage: 'kgen receipt show --file <path> [options]'
          }
        ],
        examples: [
          'kgen receipt show --file src/api.js',
          'kgen receipt show --file build.attest.json --verify',
          'kgen receipt show --file output.py --format table --show-inputs'
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});