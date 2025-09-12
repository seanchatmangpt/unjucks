import { defineCommand } from 'citty'
import lockCommand from './lock.js'
import attestCommand from './attest.js'
import verifyCommand from './verify.js'

export const projectCommand = defineCommand({
  meta: {
    name: 'project',
    description: 'Project-level operations for reproducible builds and configuration management'
  },
  subCommands: {
    lock: lockCommand,
    attest: attestCommand,
    verify: verifyCommand
  },
  async run({ args }) {
    const result = {
      command: 'project',
      subcommands: ['lock', 'attest', 'verify'],
      description: 'Project-level operations for reproducible builds'
    }
    
    console.log(JSON.stringify(result, null, 2))
  }
})

export default projectCommand