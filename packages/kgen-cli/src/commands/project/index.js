/**
 * Project Command Group
 * 
 * Commands for project-level operations and reproducible builds.
 */

import { defineCommand } from 'citty';

import lockCommand from './lock.js';
import attestCommand from './attest.js';

export default defineCommand({
  meta: {
    name: 'project',
    description: 'Project-level operations for reproducible builds'
  },
  subCommands: {
    lock: lockCommand,
    attest: attestCommand
  },
  async run() {
    const result = {
      success: true,
      data: {
        tool: 'project',
        description: 'Project-level operations for reproducible builds',
        verbs: [
          {
            name: 'lock',
            description: 'Generate deterministic lockfile for reproducible builds',
            usage: 'kgen project lock --graph <file.ttl> --output <lock.json>'
          },
          {
            name: 'attest',
            description: 'Create attestation bundle for compliance and audit',
            usage: 'kgen project attest --directory <path> --output <bundle.zip>'
          }
        ]
      },
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(result, null, 2));
  }
});