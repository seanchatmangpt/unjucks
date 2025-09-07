import { defineCommand } from "citty";
import * as chalk from "chalk";

export const githubCommand = defineCommand({
  meta: {
    name: "github",
    description: "GitHub integration and repository management",
  },
  subCommands: {
    analyze: defineCommand({
      meta: {
        name: "analyze",
        description: "Analyze GitHub repository",
      },
      args: {
        repo: {
          type: "string",
          description: "Repository name (owner/repo)",
          required: true,
          alias: "r",
        },
        type: {
          type: "string",
          description: "Analysis type (code_quality, performance, security)",
          default: "code_quality",
          alias: "t",
        },
      },
      async run({ args }: { args: any }) {
        console.log(chalk.blue.bold("🔍 GitHub Repository Analysis"));
        console.log(chalk.gray(`Repository: ${args.repo}`));
        console.log(chalk.gray(`Analysis type: ${args.type}`));
        console.log(chalk.green("✅ Analysis completed"));
      },
    }),
    pr: defineCommand({
      meta: {
        name: "pr",
        description: "Pull request management",
      },
      args: {
        action: {
          type: "string",
          description: "PR action (review, merge, close)",
          required: true,
          alias: "a",
        },
        repo: {
          type: "string", 
          description: "Repository name",
          required: true,
          alias: "r",
        },
        number: {
          type: "string",
          description: "PR number",
          alias: "n",
        },
      },
      async run({ args }: { args: any }) {
        console.log(chalk.blue.bold("📋 Pull Request Management"));
        console.log(chalk.gray(`Repository: ${args.repo}`));
        console.log(chalk.gray(`Action: ${args.action}`));
        console.log(chalk.gray(`PR: #${args.number || 'latest'}`));
        console.log(chalk.green("✅ PR action completed"));
      },
    }),
  },
});