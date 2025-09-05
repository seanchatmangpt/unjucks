Here’s a tight Gherkin test suite you can drop into features/ to drive the code swarm. It covers CLI + core engine, frontmatter, injections, unctx/untology defaults, filters, hooks, safety, and DX.

features/cli.feature
Feature: Unjucks CLI basics

  Background:
    Given a fresh temp workspace
    And a templates folder at "./templates"

  Scenario: Show version
    When I run "unjucks --version"
    Then the exit code is 0
    And stdout contains a semver

  Scenario: List templates
    Given file "./templates/commands/create-user.njk" with:
      """
      --- 
      to: src/commands/create-user.ts
      ---
      export const x = 1
      """
    When I run "unjucks list"
    Then stdout includes "commands/create-user.njk"

  Scenario: Init scaffolding
    When I run "unjucks init"
    Then it creates "./templates/.gitkeep"
    And it prints "Initialized templates/"

  Scenario: Generate from CLI with data
    Given file "./templates/components/component.njk" with:
      """
      ---
      to: src/components/{{ name }}.ts
      ---
      export const {{ name }} = '{{ name }}'
      """
    When I run 'unjucks generate components/component --data {"name":"Button"}'
    Then file "src/components/Button.ts" exists
    And its content equals "export const Button = 'Button'"

features/template-discovery.feature
Feature: Template discovery

  Background:
    Given a fresh temp workspace

  Scenario: Auto-walk default directory
    Given templates:
      | path                                   | content                        |
      | templates/a.njk                        | ---\nto: out/a\n---A          |
      | templates/nested/b.njk                 | ---\nto: out/b\n---B          |
      | templates/nested/deeper/c.njk          | ---\nto: out/c\n---C          |
    When I run "unjucks list"
    Then stdout includes "a.njk"
    And stdout includes "nested/b.njk"
    And stdout includes "nested/deeper/c.njk"

  Scenario: Namespace by folder
    When I run "unjucks list --namespace"
    Then stdout includes "nested/deeper/c"

features/frontmatter.feature
Feature: Frontmatter parsing and dynamics

  Background:
    Given a fresh temp workspace

  Scenario: YAML frontmatter is parsed
    Given file "templates/one.njk" with:
      """
      ---
      to: out/one.txt
      tag: demo
      ---
      Body
      """
    When I run "unjucks generate one"
    Then file "out/one.txt" exists

  Scenario: JSON frontmatter is parsed
    Given file "templates/two.njk" with:
      """
      ---json
      { "to": "out/two.txt", "flag": true }
      ---
      Body2
      """
    When I run "unjucks generate two"
    Then file "out/two.txt" exists

  Scenario: Dynamic frontmatter rendered with Nunjucks
    Given file "templates/dyn.njk" with:
      """
      ---
      to: out/{{ scope }}/{{ name | kebabCase }}.txt
      ---
      Hello {{ name }}
      """
    When I run 'unjucks generate dyn --data {"scope":"svc","name":"UserProfile"}'
    Then file "out/svc/user-profile.txt" exists
    And its content contains "Hello UserProfile"

  Scenario: Error on missing 'to'
    Given file "templates/bad.njk" with: "No frontmatter"
    When I run "unjucks generate bad"
    Then the exit code is 1
    And stderr contains "Missing 'to' in frontmatter"

features/rendering.feature
Feature: Rendering, context, filters

  Background:
    Given a fresh temp workspace
    And a registered custom filter "titleCase"

  Scenario: Merge user data with default unctx store
    Given unctx store has { "org":"bytestar" }
    And file "templates/info.njk" with:
      """
      ---
      to: out/info.txt
      ---
      {{ org }}: {{ name | titleCase }}
      """
    When I run 'unjucks generate info --data {"name":"api gateway"}'
    Then file "out/info.txt" exists
    And its content equals "bytestar: Api Gateway"

  Scenario: Partials and includes
    Given file "templates/partials/license.njk" with: "MIT © {{ author }}"
    And file "templates/pkg.njk" with:
      """
      ---
      to: out/PKG.txt
      ---
      {% include "partials/license.njk" %}
      """
    When I run 'unjucks generate pkg --data {"author":"rUv"}'
    Then file "out/PKG.txt" exists
    And its content equals "MIT © rUv"

features/injection.feature
Feature: File injection modes

  Background:
    Given a fresh temp workspace
    And file "src/index.ts" with:
      """
      export const A = 1
      // @inject:exports
      export const Z = 26
      """

  Scenario: Append injection
    Given file "templates/append.njk" with:
      """
      ---
      to: src/index.ts
      inject: true
      append: true
      skip_if: "export const B = 2"
      ---
      export const B = 2
      """
    When I run "unjucks generate append"
    Then file "src/index.ts" contains "export const B = 2"
    And content contains only one occurrence of "export const B = 2"

  Scenario: Before/after anchor injection
    Given file "templates/anchor.njk" with:
      """
      ---
      to: src/index.ts
      inject: true
      after: "// @inject:exports"
      ---
      export const C = 3
      """
    When I run "unjucks generate anchor"
    Then "export const C = 3" appears after the marker line

  Scenario: Line number insertion
    Given file "templates/line.njk" with:
      """
      ---
      to: src/index.ts
      inject: true
      line_at: 1
      ---
      // inserted
      """
    When I run "unjucks generate line"
    Then line 2 of "src/index.ts" equals "// inserted"

features/file-write.feature
Feature: File writing, mode, atomicity, dry run

  Background:
    Given a fresh temp workspace

  Scenario: Creates directories and writes atomically
    Given file "templates/make.njk" with:
      """
      ---
      to: deep/path/out.sh
      mode: 755
      ---
      echo ok
      """
    When I run "unjucks generate make"
    Then file "deep/path/out.sh" exists
    And its unix mode is executable
    And write was atomic

  Scenario: Dry run shows actions only
    When I run "unjucks generate make --dry"
    Then stdout contains "DRY"
    And no files were written

features/hooks.feature
Feature: Lifecycle hooks

  Background:
    Given a fresh temp workspace
    And a hook plugin printing labels

  Scenario: Pre/post render hooks fire
    Given file "templates/hook.njk" with:
      """
      ---
      to: out/hook.txt
      ---
      Hi
      """
    When I run "unjucks generate hook"
    Then stdout contains "template:will:render"
    And stdout contains "template:did:render"

  Scenario: Optional shell command after generate (disabled by default)
    Given file "templates/sh.njk" with:
      """
      ---
      to: out/sh.txt
      sh: "echo POST >> out/sh.log"
      ---
      ok
      """
    When I run "unjucks generate sh --allow-shell"
    Then file "out/sh.log" exists
    And its content contains "POST"

features/errors.feature
Feature: Error handling and messages

  Scenario: Malformed frontmatter error
    Given file "templates/broken.njk" with: "---\n: bad\n---\nX"
    When I run "unjucks generate broken"
    Then the exit code is 1
    And stderr contains "frontmatter"

  Scenario: Missing template
    When I run "unjucks generate not-found"
    Then the exit code is 1
    And stderr contains "Template not found"

features/security.feature
Feature: Path safety and sandbox

  Background:
    Given a fresh temp workspace

  Scenario: Prevent directory traversal in 'to'
    Given file "templates/escape.njk" with:
      """
      ---
      to: ../../etc/passwd
      ---
      nope
      """
    When I run "unjucks generate escape"
    Then the exit code is 1
    And stderr contains "path traversal"

  Scenario: Block writing outside cwd unless --unsafe allowed
    Given file "templates/outside.njk" with:
      """
      ---
      to: /tmp/outside.txt
      ---
      data
      """
    When I run "unjucks generate outside"
    Then the exit code is 1
    And stderr contains "outside workspace"

features/api-parity.feature
Feature: Programmatic API parity with CLI

  Scenario: renderTemplate() matches CLI output
    Given the same "templates/components/component.njk" as CLI test
    When I call the programmatic API renderTemplate with { name: "Button" }
    Then the returned actions include "write src/components/Button.ts"
    And file contents match the CLI-generated file

features/unctx.feature
Feature: Unctx store as default context

  Background:
    Given unctx store has { "org":"bytestar", "env":"prod" }

  Scenario: Render without passing context uses unctx
    Given file "templates/cfg.njk" with:
      """
      ---
      to: out/cfg.txt
      ---
      {{ org }}::{{ env }}
      """
    When I run "unjucks generate cfg"
    Then file "out/cfg.txt" contains "bytestar::prod"

features/untology-integration.feature
Feature: Untology (N3) as template data

  Background:
    Given an untology graph loaded in unctx with:
      | s                | p              | o           |
      | :User            | rdf:type       | :Entity     |
      | :User            | :hasField      | :id         |
      | :User            | :hasField      | :email      |
      | :id              | :fieldType     | :uuid       |
      | :email           | :fieldType     | :string     |

  Scenario: Generate code from ontology
    Given file "templates/models/user.njk" with:
      """
      ---
      to: out/models/User.ts
      ---
      export interface User {
      {% for f in ont.findFields('User') %}
        {{ f.name }}: {{ f.type }};
      {% endfor %}
      }
      """
    When I run "unjucks generate models/user"
    Then file "out/models/User.ts" exists
    And its content contains "id: uuid;"
    And its content contains "email: string;"

features/batch.feature
Feature: Batch rendering

  Scenario: Glob generate
    Given templates:
      | path                        | content                          |
      | templates/a.njk             | ---\nto: out/a\n---A            |
      | templates/b.njk             | ---\nto: out/b\n---B            |
    When I run "unjucks generate templates/*.njk"
    Then file "out/a" exists
    And file "out/b" exists

features/logging.feature
Feature: Logging with levels

  Scenario: Quiet mode
    When I run "unjucks list --quiet"
    Then stdout is empty

  Scenario: Verbose shows actions
    When I run "unjucks generate a --verbose"
    Then stdout contains "WRITE"

features/naming.feature
Feature: UnJS verb–noun API naming

  Scenario: Public API exports follow two-word verbs
    When I import the module
    Then it exports "loadTemplates", "compileTemplate", "renderTemplate", "defineFilters", "generateFiles"


These features intentionally assert:

Hygen-grade frontmatter (YAML/JSON, dynamic to, injections, skip-if)

Atomic, mkdirp writes + chmod

Dry-run, logging, hooks, optional shell (guarded by --allow-shell)

Default context from unctx + ontology helpers from untology

Safety (path traversal/out-of-root)

CLI/API parity and UnJS naming

If you want, I can also stub step definitions (TypeScript + vitest/cucumber) to wire these up.

You said:


UnJS
Packages
Blog
Relations

49.2k
Logo of confbox
confbox
Compact and high quality YAML, TOML, JSONC and JSON5 parsers.

Config parsers for:

✅ YAML (with js-yaml)

✅ TOML (with smol-toml)

✅ JSONC (with jsonc-parser)

✅ JSON5 (with json5)

With perfect bundling:

✨ Types exported out of the box

✨ Zero config and compact redistribution

✨ Dual ESM/CJS build

✨ Consistent and tested API

✨ Handpicked best libraries (bundle+perf)

 Use unjs/c12 for a full featured configuration loader!
Usage
Install package:

# ✨ Auto-detect
npx nypm i confbox

# npm
npm install confbox

# yarn
yarn add confbox

# pnpm
pnpm install confbox

# bun
bun install confbox
Copy to clipboard
Import:

ESM (Node.js, Bun)

import {
  parseJSON5,
  parseJSONC,
  parseYAML,
  stringifyYAML,
  parseTOML,
} from "confbox";
Copy to clipboard
CommonJS (Legacy Node.js)

const {
  parseJSON5,
  parseJSONC,
  parseYAML,
  stringifyYAML,
  parseTOML,
} = require("confbox");
Copy to clipboard
CDN (Deno, Bun and Browsers)

import {
  parseJSON5,
  parseJSONC,
  parseYAML,
  stringifyYAML,
  parseTOML,
} from "https://esm.sh/confbox";
Copy to clipboard
parseJSON5(text, options?)
Converts a JSON5 string into an object.

parseJSONC(text, options?)
Converts a JSONC string into an object.

parseTOML(text)
Converts a TOML string into an object.

parseYAML(text, options?)
Converts a YAML string into an object.

stringifyYAML(value, options?)
Converts a JavaScript value to a YAML string.

Contribution
Local development
License
Published under the MIT license. Made by @pi0 and community 💛

Documentation
Stars
42
Monthly Downloads
626.7k
Latest Version
v0.1.2
GitHub
View source
Report an issue
Resources
Explore Relations
Discover on npm

UnJS
Unlock the potential of your web development journey with UnJS - where innovation meets simplicity, and possibilities become limitless.

Community

Contribute
Discussions
Contact us
Content

Search
UnJS

Website
Design Kit
GitHub
Light
© 2023 UnJS Team. Website is licensed under CC BY-NC-SA 4.0
ChatGPT said:
Thought for 13s

Perfect—use confbox as the core parser for Unjucks front-matter (UnJS-native, zero-config, dual ESM/CJS). Here’s a tight, production-ready way to wire it in.

Unjucks + Confbox front-matter
Fences & formats (detected)

YAML: --- (or ---yaml)

JSON5: ---json5

JSONC: ---jsonc

JSON: ---json

TOML: +++

Two-word API (UnJS style)

parseFrontmatter

renderFrontmatter

renderTemplate

generateFiles

Minimal implementation
// src/frontmatter.ts
import { parseYAML, parseJSON5, parseJSONC, parseTOML } from "confbox"

export type Frontmatter = {
  data: Record<string, any>
  body: string
  lang: "yaml" | "json" | "json5" | "jsonc" | "toml" | null
}

const FENCE = /^(---|---yaml|---json5|---jsonc|---json|\+\+\+)\s*\n/

const parsers: Record<string, (t: string) => any> = {
  "---": parseYAML,
  "---yaml": parseYAML,
  "---json5": parseJSON5,
  "---jsonc": parseJSONC,
  "---json": (t) => JSON.parse(t),
  "+++": parseTOML
}

export function parseFrontmatter(src: string): Frontmatter {
  const m = src.match(FENCE)
  if (!m) return { data: {}, body: src, lang: null }

  const fence = m[1]
  const endFence = fence === "+++" ? "+++" : "---"

  // locate closing fence
  const start = m[0].length
  const endIdx = src.indexOf(`\n${endFence}`, start)
  if (endIdx === -1) return { data: {}, body: src, lang: null }

  const rawMeta = src.slice(start, endIdx).trim()
  const body = src.slice(endIdx + endFence.length + 2).replace(/^\n/, "")

  const parse = parsers[fence]
  const data = parse ? parse(rawMeta) : {}

  const lang =
    fence === "+++" ? "toml"
    : fence === "---json5" ? "json5"
    : fence === "---jsonc" ? "jsonc"
    : fence === "---json"  ? "json"
    : "yaml"

  return { data, body, lang }
}

// src/unjucks.ts
import nunjucks from "nunjucks"
import { parseFrontmatter } from "./frontmatter"
import { createContext } from "unctx" // your unctx store
import { resolve, join, dirname, normalize } from "pathe"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { constants } from "node:fs"
import { access } from "node:fs/promises"

const env = new nunjucks.Environment(null, { autoescape: false })

// unctx-provided defaults (ontology, org, etc.)
const useCtx = createContext<any>("unjucks")

export async function renderFrontmatter(path: string, inputCtx: any = {}) {
  const abs = resolve(path)
  const src = await readFile(abs, "utf8")
  const fm = parseFrontmatter(src)

  // merge context: unctx → user → frontmatter (frontmatter wins for its keys)
  const ctx = { ...(useCtx.use() || {}), ...inputCtx, ...fm.data }

  // allow templating *inside* front-matter values like `to: out/{{ name }}.ts`
  const renderedMeta: Record<string, any> = {}
  for (const [k, v] of Object.entries(fm.data)) {
    renderedMeta[k] =
      typeof v === "string" ? env.renderString(v, ctx) : v
  }

  const renderedBody = env.renderString(fm.body, { ...ctx, fm: renderedMeta })
  return { meta: renderedMeta, body: renderedBody }
}

function assertInsideCwd(outPath: string, cwd = process.cwd()) {
  const abs = resolve(outPath)
  if (!abs.startsWith(resolve(cwd) + "/")) {
    throw new Error(`Unsafe path outside workspace: ${outPath}`)
  }
  return abs
}

export async function renderTemplate(tplPath: string, data?: any) {
  const { meta, body } = await renderFrontmatter(tplPath, data)
  if (!meta.to) throw new Error(`Missing 'to' in frontmatter: ${tplPath}`)
  const outAbs = assertInsideCwd(meta.to)

  return { outPath: outAbs, content: body, meta }
}

export async function generateFiles(tplPath: string, data?: any, opts?: { dry?: boolean }) {
  const { outPath, content, meta } = await renderTemplate(tplPath, data)

  // injection modes
  if (meta.inject) {
    const target = await readFile(outPath, "utf8").catch(() => "")
    if (meta.skip_if && new RegExp(meta.skip_if).test(target)) return { action: "SKIP", outPath }
    let next = target

    if (meta.before || meta.after) {
      const needle = String(meta.before ?? meta.after)
      const idx = next.indexOf(needle)
      if (idx !== -1) {
        const pos = meta.before ? idx : idx + needle.length
        next = next.slice(0, pos) + "\n" + content + "\n" + next.slice(pos)
      }
    } else if (meta.prepend) {
      next = content + "\n" + next
    } else if (meta.append) {
      next = next + (next.endsWith("\n") ? "" : "\n") + content + "\n"
    } else if (typeof meta.line_at === "number") {
      const lines = next.split("\n")
      lines.splice(meta.line_at, 0, content)
      next = lines.join("\n")
    } else {
      // default append
      next = next + (next ? "\n" : "") + content
    }

    if (opts?.dry) return { action: "DRY-INJECT", outPath }
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath + ".tmp", next, "utf8")
    await writeFile(outPath, next, "utf8")
    return { action: "INJECT", outPath }
  }

  // write new
  if (opts?.dry) return { action: "DRY-WRITE", outPath }
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath + ".tmp", content, "utf8")
  await writeFile(outPath, content, "utf8")
  if (meta.mode) {
    const mode = typeof meta.mode === "string" ? parseInt(meta.mode, 8) : meta.mode
    await (await import("node:fs/promises")).chmod(outPath, mode)
  }
  return { action: "WRITE", outPath }
}

Example template
---
to: src/commands/{{ name | lower }}.ts
inject: false
mode: 755
---
import { defineCommand } from 'citty'
export default defineCommand({
  meta: { name: '{{ name | kebabCase }}' },
  run: async () => console.log('ok')
})

Why this is “core-team style”

UnJS-native: confbox parsing, pathe paths, unctx for default context.

Dual formats: YAML/TOML/JSON/JSON5/JSONC via one parser family.

Two-word verbs: parseFrontmatter, renderFrontmatter, renderTemplate, generateFiles.

Safety first: path sandbox; atomic writes; dry-run ready.

Templated meta: render front-matter values with Nunjucks before use.

Extensible: injection modes (append|prepend|before|after|line_at|skip_if), file mode.

If you want, I can add tiny citty commands (listTemplates, generateFrom) around these functions next.

You said:
#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
import { createDynamicGenerateCommand } from "./lib/dynamic-commands.js";
import { listCommand } from "./commands/list.js";
import { initCommand } from "./commands/init.js";
import { versionCommand } from "./commands/version.js";
import { createTemplateHelpCommand } from "./lib/dynamic-commands.js";

const main = defineCommand({
  meta: {
    name: "unjucks",
    version: "0.0.0",
    description:
      "A Hygen-style CLI generator for creating templates and scaffolding projects",
  },
  subCommands: {
    generate: createDynamicGenerateCommand(),
    list: listCommand,
    init: initCommand,
    version: versionCommand,
    help: createTemplateHelpCommand(),
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("🌆 Unjucks CLI"));
    console.log(
      chalk.gray(
        "A Hygen-style CLI generator for creating templates and scaffolding projects",
      ),
    );
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  generate  Generate files from templates"));
    console.log(chalk.gray("  list      List available generators"));
    console.log(chalk.gray("  init      Initialize a new project"));
    console.log(chalk.gray("  help      Show template variable help"));
    console.log(chalk.gray("  version   Show version information"));
    console.log();
    console.log(
      chalk.gray("Use --help with any command for more information."),
    );
  },
});

runMain(main);

import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "./generator.js";
import { promptForGenerator, promptForTemplate } from "./prompts.js";
import ora from "ora";

export interface DynamicGenerateOptions {
  generator?: string;
  template?: string;
  dest?: string;
  force?: boolean;
  dry?: boolean;
  [key: string]: any; // Allow dynamic properties
}

/**
 * Create a dynamic generate command that adapts to template variables
 */
export function createDynamicGenerateCommand() {
  return defineCommand({
    meta: {
      name: "generate",
      description: "Generate files from templates",
    },
    args: {
      generator: {
        type: "positional",
        description: "Name of the generator to use",
        required: false,
      },
      template: {
        type: "positional",
        description: "Name of the template to generate",
        required: false,
      },
      dest: {
        type: "string",
        description: "Destination directory for generated files",
        default: ".",
      },
      force: {
        type: "boolean",
        description: "Overwrite existing files without prompting",
        default: false,
      },
      dry: {
        type: "boolean",
        description: "Show what would be generated without creating files",
        default: false,
      },
    },
    async run({ args }: { args: any }) {
      try {
        const generator = new Generator();

        let generatorName = args.generator;
        let templateName = args.template;

        // Interactive mode if no generator/template specified
        if (!generatorName) {
          const availableGenerators = await generator.listGenerators();
          if (availableGenerators.length === 0) {
            console.log(
              chalk.red(
                "No generators found. Run 'unjucks init' to set up generators.",
              ),
            );
            return;
          }

          const selected = await promptForGenerator(availableGenerators);
          generatorName = selected.generator;
          templateName = selected.template;
        }

        if (!templateName) {
          const templates = await generator.listTemplates(generatorName);
          const selected = await promptForTemplate(templates);
          templateName = selected;
        }

        // Generate dynamic CLI arguments based on template variables
        const dynamicArgs = await generator.generateDynamicCliArgs(
          generatorName,
          templateName,
        );

        // Merge CLI arguments with dynamic template variables
        const templateVariables: Record<string, any> = {};

        // Extract template variables from CLI args
        for (const [key, value] of Object.entries(args)) {
          if (dynamicArgs[key]) {
            templateVariables[key] = value;
          }
        }

        const spinner = ora("Generating files...").start();

        const result = await generator.generate({
          generator: generatorName,
          template: templateName,
          dest: args.dest,
          force: args.force,
          dry: args.dry,
          ...templateVariables, // Pass template variables
        });

        spinner.stop();

        if (args.dry) {
          console.log(chalk.yellow("Dry run - no files were created:"));
          console.log(chalk.gray("Files that would be generated:"));
          result.files.forEach((file: any) => {
            console.log(chalk.green(  + ${file.path}));
          });
        } else {
          console.log(
            chalk.green(✅ Generated ${result.files.length} files:),
          );
          result.files.forEach((file: any) => {
            console.log(chalk.green(  + ${file.path}));
          });
        }

        // Show available template variables for future reference
        if (Object.keys(dynamicArgs).length > 0) {
          console.log();
          console.log(chalk.blue("Available template variables:"));
          for (const [varName, varConfig] of Object.entries(dynamicArgs)) {
            const type =
              (varConfig as any).type === "boolean" ? "boolean" : "string";
            console.log(
              chalk.gray(
                  --${varName} (${type}) - ${(varConfig as any).description},
              ),
            );
          }
        }
      } catch (error) {
        console.error(chalk.red("Error generating files:"), error);
        process.exit(1);
      }
    },
  });
}

/**
 * Create a help command that shows available template variables
 */
export function createTemplateHelpCommand() {
  return defineCommand({
    meta: {
      name: "help",
      description: "Show help for template variables",
    },
    args: {
      generator: {
        type: "positional",
        description: "Name of the generator",
        required: true,
      },
      template: {
        type: "positional",
        description: "Name of the template",
        required: true,
      },
    },
    async run({ args }: { args: any }) {
      try {
        const generator = new Generator();

        const { variables } = await generator.scanTemplateForVariables(
          args.generator,
          args.template,
        );

        console.log(
          chalk.blue.bold(
            Template Variables for ${args.generator}/${args.template}:,
          ),
        );
        console.log();

        if (variables.length === 0) {
          console.log(chalk.gray("No variables found in this template."));
          return;
        }

        for (const variable of variables) {
          const required = variable.required ? chalk.red(" (required)") : "";
          const type = chalk.gray([${variable.type}]);
          console.log(
            chalk.green(  --${variable.name}) +  ${type}${required},
          );
          console.log(chalk.gray(    ${variable.description}));
          if (variable.defaultValue !== undefined) {
            console.log(chalk.gray(    Default: ${variable.defaultValue}));
          }
          console.log();
        }

        console.log(chalk.yellow("Usage example:"));
        console.log(
          chalk.gray(
              unjucks generate ${args.generator} ${args.template} --${variables[0]?.name || "variableName"}="value",
          ),
        );
      } catch (error) {
        console.error(chalk.red("Error scanning template:"), error);
        process.exit(1);
      }
    },
  });
}

import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";
import yaml from "yaml";
import chalk from "chalk";
import { TemplateScanner, TemplateVariable } from "./template-scanner.js";

export interface TemplateFile {
  path: string;
  content: string;
}

export interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
}

export interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
  prompts?: PromptConfig[];
}

export interface PromptConfig {
  name: string;
  message: string;
  type: "input" | "confirm" | "list" | "checkbox";
  default?: any;
  choices?: string[];
}

export interface GenerateOptions {
  generator: string;
  template: string;
  dest: string;
  force: boolean;
  dry: boolean;
}

export interface GenerateResult {
  files: TemplateFile[];
}

export interface InitOptions {
  type: string;
  dest: string;
}

export class Generator {
  private templatesDir: string;
  private nunjucksEnv: nunjucks.Environment;
  private templateScanner: TemplateScanner;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || this.findTemplatesDirectory();
    this.nunjucksEnv = this.createNunjucksEnvironment();
    this.templateScanner = new TemplateScanner();
  }

  private findTemplatesDirectory(): string {
    // Start from current working directory and walk up the directory tree
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      // Check for package.json in current directory
      const packageJsonPath = path.join(currentDir, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        // Look for _templates directory in the same directory as package.json
        const templatesPath = path.join(currentDir, "_templates");
        if (fs.existsSync(templatesPath)) {
          return templatesPath;
        }

        // Also check for templates directory (alternative naming)
        const altTemplatesPath = path.join(currentDir, "templates");
        if (fs.existsSync(altTemplatesPath)) {
          return altTemplatesPath;
        }
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }

    // If no templates directory found, default to _templates in current directory
    return path.join(process.cwd(), "_templates");
  }

  getTemplatesDirectory(): string {
    return this.templatesDir;
  }

  /**
   * Scan a specific template for variables and generate CLI arguments
   */
  async scanTemplateForVariables(
    generatorName: string,
    templateName: string,
  ): Promise<{
    variables: TemplateVariable[];
    cliArgs: Record<string, any>;
  }> {
    const templatePath = path.join(
      this.templatesDir,
      generatorName,
      templateName,
    );

    if (!(await fs.pathExists(templatePath))) {
      throw new Error(
        Template '${templateName}' not found in generator '${generatorName}',
      );
    }

    const scanResult = await this.templateScanner.scanTemplate(templatePath);
    const cliArgs = this.templateScanner.generateCliArgs(scanResult.variables);

    return {
      variables: scanResult.variables,
      cliArgs,
    };
  }

  /**
   * Generate dynamic CLI arguments for a template
   */
  async generateDynamicCliArgs(
    generatorName: string,
    templateName: string,
  ): Promise<Record<string, any>> {
    const { cliArgs } = await this.scanTemplateForVariables(
      generatorName,
      templateName,
    );
    return cliArgs;
  }

  private createNunjucksEnvironment(): nunjucks.Environment {
    const env = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    // Add custom filters
    this.addCustomFilters(env);

    return env;
  }

  private addCustomFilters(env: nunjucks.Environment): void {
    // kebabCase filter
    env.addFilter("kebabCase", (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
    });

    // camelCase filter
    env.addFilter("camelCase", (str: string) => {
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, "");
    });

    // pascalCase filter
    env.addFilter("pascalCase", (str: string) => {
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
          return word.toUpperCase();
        })
        .replace(/\s+/g, "");
    });

    // snakeCase filter
    env.addFilter("snakeCase", (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase();
    });

    // pluralize filter
    env.addFilter("pluralize", (str: string) => {
      if (str.endsWith("y")) {
        return str.slice(0, -1) + "ies";
      } else if (
        str.endsWith("s") ||
        str.endsWith("sh") ||
        str.endsWith("ch") ||
        str.endsWith("x") ||
        str.endsWith("z")
      ) {
        return str + "es";
      } else {
        return str + "s";
      }
    });

    // singularize filter
    env.addFilter("singularize", (str: string) => {
      if (str.endsWith("ies")) {
        return str.slice(0, -3) + "y";
      } else if (str.endsWith("es") && str.length > 3) {
        return str.slice(0, -2);
      } else if (str.endsWith("s") && str.length > 1) {
        return str.slice(0, -1);
      }
      return str;
    });

    // capitalize filter (override default to handle edge cases)
    env.addFilter("capitalize", (str: string) => {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // titleCase filter
    env.addFilter("titleCase", (str: string) => {
      return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
      });
    });
  }

  async listGenerators(): Promise<GeneratorConfig[]> {
    const generators: GeneratorConfig[] = [];

    if (!(await fs.pathExists(this.templatesDir))) {
      return generators;
    }

    const entries = await fs.readdir(this.templatesDir);

    for (const entry of entries) {
      const entryPath = path.join(this.templatesDir, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const configPath = path.join(entryPath, "config.yml");

        if (await fs.pathExists(configPath)) {
          try {
            const configContent = await fs.readFile(configPath, "utf8");
            const config = yaml.parse(configContent) as GeneratorConfig;
            config.name = entry;
            generators.push(config);
          } catch {
            console.warn(
              chalk.yellow(
                Warning: Could not parse config for generator ${entry},
              ),
            );
          }
        } else {
          // Generator without config file - create basic config
          generators.push({
            name: entry,
            description: Generator for ${entry},
            templates: await this.discoverTemplates(entryPath),
          });
        }
      }
    }

    return generators;
  }

  async listTemplates(generatorName: string): Promise<TemplateConfig[]> {
    const generatorPath = path.join(this.templatesDir, generatorName);

    if (!(await fs.pathExists(generatorPath))) {
      throw new Error(Generator '${generatorName}' not found);
    }

    const configPath = path.join(generatorPath, "config.yml");

    if (await fs.pathExists(configPath)) {
      const configContent = await fs.readFile(configPath, "utf8");
      const config = yaml.parse(configContent) as GeneratorConfig;
      return config.templates || [];
    }

    // Discover templates if no config file
    return await this.discoverTemplates(generatorPath);
  }

  private async discoverTemplates(
    generatorPath: string,
  ): Promise<TemplateConfig[]> {
    const templates: TemplateConfig[] = [];
    const entries = await fs.readdir(generatorPath);

    for (const entry of entries) {
      const entryPath = path.join(generatorPath, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const templateFiles = await this.getTemplateFiles(entryPath);
        if (templateFiles.length > 0) {
          templates.push({
            name: entry,
            description: Template for ${entry},
            files: templateFiles,
          });
        }
      }
    }

    return templates;
  }

  private async getTemplateFiles(templatePath: string): Promise<string[]> {
    const files: string[] = [];

    const scanDir = async (dir: string, prefix = ""): Promise<void> => {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath);

        if (stat.isDirectory()) {
          await scanDir(entryPath, path.join(prefix, entry));
        } else {
          files.push(path.join(prefix, entry));
        }
      }
    };

    await scanDir(templatePath);
    return files;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const generatorPath = path.join(this.templatesDir, options.generator);
    const templatePath = path.join(generatorPath, options.template);

    if (!(await fs.pathExists(templatePath))) {
      throw new Error(
        Template '${options.template}' not found in generator '${options.generator}',
      );
    }

    // Load template configuration
    const config = await this.loadTemplateConfig(
      generatorPath,
      options.template,
    );

    // Scan template for variables
    const { variables: scannedVariables } = await this.scanTemplateForVariables(
      options.generator,
      options.template,
    );

    // Collect template variables from CLI args and prompts
    const variables = await this.collectVariables(
      config,
      scannedVariables,
      options,
    );

    // Process template files
    const files = await this.processTemplateFiles(
      templatePath,
      variables,
      options.dest,
    );

    // Write files if not dry run
    if (!options.dry) {
      await this.writeFiles(files, options.force);
    }

    return { files };
  }

  private async loadTemplateConfig(
    generatorPath: string,
    templateName: string,
  ): Promise<TemplateConfig> {
    const configPath = path.join(generatorPath, "config.yml");

    if (await fs.pathExists(configPath)) {
      const configContent = await fs.readFile(configPath, "utf8");
      const config = yaml.parse(configContent) as GeneratorConfig;
      const template = config.templates?.find((t) => t.name === templateName);

      if (template) {
        return template;
      }
    }

    // Fallback to discovered template
    const templatePath = path.join(generatorPath, templateName);
    const files = await this.getTemplateFiles(templatePath);

    return {
      name: templateName,
      description: Template for ${templateName},
      files,
    };
  }

  private async collectVariables(
    config: TemplateConfig,
    scannedVariables: TemplateVariable[],
    options: GenerateOptions,
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    // First, collect variables from CLI arguments (if provided)
    const cliArgs = this.templateScanner.convertArgsToVariables(
      options as any,
      scannedVariables,
    );
    Object.assign(variables, cliArgs);

    // Then, collect variables from config prompts (for missing variables that are actually used in templates)
    if (config.prompts) {
      const inquirer = await import("inquirer");

      for (const promptConfig of config.prompts) {
        // Skip if variable already provided via CLI
        if (variables[promptConfig.name] !== undefined) {
          continue;
        }

        // Only prompt for variables that are actually used in the templates
        const isUsedInTemplate = scannedVariables.some(
          (v) => v.name === promptConfig.name,
        );
        if (!isUsedInTemplate) {
          continue;
        }

        const answers = await inquirer.default.prompt([
          {
            name: promptConfig.name,
            message: promptConfig.message,
            type: promptConfig.type,
            default: promptConfig.default,
            choices: promptConfig.choices,
          },
        ]);

        Object.assign(variables, answers);
      }
    }

    // Finally, prompt for any remaining scanned variables that weren't provided
    const missingVariables = scannedVariables.filter(
      (v) => variables[v.name] === undefined,
    );

    if (missingVariables.length > 0) {
      const inquirer = await import("inquirer");

      for (const variable of missingVariables) {
        if (variables[variable.name] === undefined) {
          const answers = await inquirer.default.prompt([
            {
              name: variable.name,
              message: variable.description || Enter ${variable.name},
              type: variable.type === "boolean" ? "confirm" : "input",
              default: variable.defaultValue,
            },
          ]);

          Object.assign(variables, answers);
        }
      }
    }

    return variables;
  }

  private async processTemplateFiles(
    templatePath: string,
    variables: Record<string, any>,
    destDir: string,
  ): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    const processDir = async (dir: string, prefix = ""): Promise<void> => {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath);

        if (stat.isDirectory()) {
          await processDir(entryPath, path.join(prefix, entry));
        } else {
          const content = await fs.readFile(entryPath, "utf8");

          // Process content with Nunjucks
          const processedContent = this.nunjucksEnv.renderString(
            content,
            variables,
          );

          // Process filename with Nunjucks
          const processedFileName = this.nunjucksEnv.renderString(
            entry,
            variables,
          );

          const filePath = path.join(destDir, prefix, processedFileName);

          files.push({
            path: filePath,
            content: processedContent,
          });
        }
      }
    };

    await processDir(templatePath);
    return files;
  }

  private async writeFiles(
    files: TemplateFile[],
    force: boolean,
  ): Promise<void> {
    for (const file of files) {
      const dir = path.dirname(file.path);

      // Create directory if it doesn't exist
      await fs.ensureDir(dir);

      // Check if file exists
      if ((await fs.pathExists(file.path)) && !force) {
        const inquirer = await import("inquirer");
        const { overwrite } = await inquirer.default.prompt([
          {
            name: "overwrite",
            type: "confirm",
            message: File ${file.path} already exists. Overwrite?,
            default: false,
          },
        ]);

        if (!overwrite) {
          continue;
        }
      }

      await fs.writeFile(file.path, file.content, "utf-8");
    }
  }

  async initProject(options: InitOptions): Promise<void> {
    const projectPath = options.dest;

    // Create templates directory
    const templatesDir = path.join(projectPath, "_templates");
    await fs.ensureDir(templatesDir);

    // Create example generators based on project type
    await this.createExampleGenerators(templatesDir, options.type);

    // Create unjucks config file
    const config = {
      version: "1.0.0",
      generators: "_templates",
    };

    await fs.writeFile(
      path.join(projectPath, "unjucks.yml"),
      yaml.stringify(config),
      "utf-8",
    );
  }

  private async createExampleGenerators(
    templatesDir: string,
    projectType: string,
  ): Promise<void> {
    // Create command generator
    const commandDir = path.join(templatesDir, "command");
    await fs.ensureDir(commandDir);

    // Command config
    const commandConfig = {
      name: "command",
      description: "Generate Citty CLI commands",
      templates: [
        {
          name: "citty",
          description: "Citty command with subcommands",
          files: [
            "{{ commandName | pascalCase }}.ts",
            "{{ commandName | pascalCase }}.test.ts",
          ],
          prompts: [
            {
              name: "commandName",
              message: "Command name:",
              type: "input",
              default: "myCommand",
            },
            {
              name: "withTests",
              message: "Include tests?",
              type: "confirm",
              default: true,
            },
            {
              name: "withSubcommands",
              message: "Include subcommands?",
              type: "confirm",
              default: true,
            },
          ],
        },
      ],
    };

    await fs.writeFile(
      path.join(commandDir, "config.yml"),
      yaml.stringify(commandConfig),
      "utf-8",
    );

    // Create Citty command template
    const cittyDir = path.join(commandDir, "citty");
    await fs.ensureDir(cittyDir);

    // Command.ts template
    const commandTemplate = import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  {% if withSubcommands %}
  subCommands: {
    // Add your subcommands here
    // example: exampleCommand,
  },
  {% endif %}
  args: {
    // Add your command arguments here
    // name: {
    //   type: "string",
    //   description: "Name argument",
    // },
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("Running {{ commandName | kebabCase }} command..."));
    
    // Add your command logic here
    console.log(chalk.green("✅ {{ commandName | titleCase }} completed successfully!"));
  },
});
;

    await fs.writeFile(
      path.join(cittyDir, "{{ commandName | pascalCase }}.ts"),
      commandTemplate,
      "utf-8",
    );

    // Command test template
    const testTemplate = import { describe, expect, it } from "vitest";
import { {{ commandName | pascalCase }}Command } from "./{{ commandName | pascalCase }}";

describe("{{ commandName | pascalCase }}Command", () => {
  it("should be defined", () => {
    expect({{ commandName | pascalCase }}Command).toBeDefined();
  });

  it("should have correct meta", () => {
    expect({{ commandName | pascalCase }}Command.meta?.name).toBe("{{ commandName | kebabCase }}");
    expect({{ commandName | pascalCase }}Command.meta?.description).toBe("{{ commandName | titleCase }} command");
  });

  // Add more tests here
});
;

    await fs.writeFile(
      path.join(cittyDir, "{{ commandName | pascalCase }}.test.ts"),
      testTemplate,
      "utf-8",
    );

    // Create CLI generator
    const cliDir = path.join(templatesDir, "cli");
    await fs.ensureDir(cliDir);

    const cliConfig = {
      name: "cli",
      description: "Generate CLI applications",
      templates: [
        {
          name: "citty",
          description: "Citty CLI application",
          files: ["cli.ts", "package.json"],
          prompts: [
            {
              name: "cliName",
              message: "CLI name:",
              type: "input",
              default: "my-cli",
            },
            {
              name: "description",
              message: "CLI description:",
              type: "input",
              default: "A CLI tool built with Citty",
            },
          ],
        },
      ],
    };

    await fs.writeFile(
      path.join(cliDir, "config.yml"),
      yaml.stringify(cliConfig),
      "utf-8",
    );

    const cliCittyDir = path.join(cliDir, "citty");
    await fs.ensureDir(cliCittyDir);

    const cliTemplate = #!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
// Import your commands here
// import { {{ cliName | pascalCase }}Command } from "./commands/{{ cliName | kebabCase }}.js";

const main = defineCommand({
  meta: {
    name: "{{ cliName | kebabCase }}",
    version: "0.0.0",
    description: "{{ description }}",
  },
  subCommands: {
    // Add your commands here
    // {{ cliName | kebabCase }}: {{ cliName | pascalCase }}Command,
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ cliName | titleCase }} CLI"));
    console.log(chalk.gray("{{ description }}"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  --help    Show help information"));
    console.log(chalk.gray("  --version Show version information"));
    console.log();
    console.log(chalk.gray("Use {{ cliName | kebabCase }} <command> --help for more information about a command."));
  },
});

runMain(main);
;

    await fs.writeFile(path.join(cliCittyDir, "cli.ts"), cliTemplate, "utf-8");

    const packageJsonTemplate = {
  "name": "{{ cliName | kebabCase }}",
  "version": "0.0.0",
  "description": "{{ description }}",
  "type": "module",
  "bin": {
    "{{ cliName | kebabCase }}": "./dist/cli.mjs"
  },
  "exports": {
    ".": "./dist/index.mjs",
    "./cli": "./dist/cli.mjs"
  },
  "scripts": {
    "build": "obuild",
    "dev": "vitest dev",
    "test": "vitest run",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "citty": "^0.1.6",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "obuild": "^0.1.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "files": [
    "dist"
  ],
  "license": "MIT"
};

    await fs.writeFile(
      path.join(cliCittyDir, "package.json"),
      packageJsonTemplate,
      "utf-8",
    );
  }
}

import inquirer from "inquirer";
import chalk from "chalk";
import { GeneratorConfig, TemplateConfig } from "./generator.js";

export async function promptForGenerator(
  generators: GeneratorConfig[],
): Promise<{
  generator: string;
  template: string;
}> {
  const generatorChoices = generators.map((gen) => ({
    name: ${gen.name}${gen.description ?  - ${gen.description} : ""},
    value: gen.name,
  }));

  const { generator } = await inquirer.prompt([
    {
      name: "generator",
      type: "list",
      message: "Select a generator:",
      choices: generatorChoices,
    },
  ]);

  // Now prompt for template within the selected generator
  const templateChoices =
    generators
      .find((gen) => gen.name === generator)
      ?.templates.map((template) => ({
        name: ${template.name}${template.description ?  - ${template.description} : ""},
        value: template.name,
      })) || [];

  const { template } = await inquirer.prompt([
    {
      name: "template",
      type: "list",
      message: "Select a template:",
      choices: templateChoices,
    },
  ]);

  return { generator, template };
}

export async function promptForTemplate(
  templates: TemplateConfig[],
): Promise<string> {
  const templateChoices = templates.map((template) => ({
    name: ${template.name}${template.description ?  - ${template.description} : ""},
    value: template.name,
  }));

  const { template } = await inquirer.prompt([
    {
      name: "template",
      type: "list",
      message: "Select a template:",
      choices: templateChoices,
    },
  ]);

  return template;
}

export async function promptForProjectType(): Promise<string> {
  const projectTypes = [
    { name: "Citty CLI Tool", value: "citty" },
    { name: "Node.js Library", value: "nodejs" },
    { name: "TypeScript Package", value: "typescript" },
    { name: "Generic Project", value: "generic" },
  ];

  const { projectType } = await inquirer.prompt([
    {
      name: "projectType",
      type: "list",
      message: "What type of project are you initializing?",
      choices: projectTypes,
    },
  ]);

  return projectType;
}

import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";

export interface TemplateVariable {
  name: string;
  type: "string" | "boolean" | "number";
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

export interface TemplateScanResult {
  variables: TemplateVariable[];
  prompts: TemplateVariable[];
}

export class TemplateScanner {
  private nunjucksEnv: nunjucks.Environment;

  constructor() {
    this.nunjucksEnv = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
  }

  /**
   * Scan a template directory for variables used in templates
   */
  async scanTemplate(templatePath: string): Promise<TemplateScanResult> {
    const variables = new Set<string>();
    const prompts: TemplateVariable[] = [];

    // Scan all files in the template directory
    await this.scanDirectory(templatePath, variables);

    // Convert variables to TemplateVariable objects
    const templateVariables: TemplateVariable[] = [...variables].map(
      (varName) => ({
        name: varName,
        type: this.inferVariableType(varName),
        description: this.generateDescription(varName),
        required: this.isRequiredVariable(varName),
      }),
    );

    return {
      variables: templateVariables,
      prompts: prompts,
    };
  }

  /**
   * Scan a directory recursively for template variables
   */
  private async scanDirectory(
    dirPath: string,
    variables: Set<string>,
  ): Promise<void> {
    if (!(await fs.pathExists(dirPath))) {
      return;
    }

    const entries = await fs.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stat = await fs.stat(entryPath);

      await (stat.isDirectory() ? this.scanDirectory(entryPath, variables) : this.scanFile(entryPath, variables));
    }
  }

  /**
   * Scan a single file for template variables
   */
  private async scanFile(
    filePath: string,
    variables: Set<string>,
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf8");

      // Extract variables from Nunjucks syntax
      this.extractVariablesFromContent(content, variables);

      // Extract variables from filename
      const fileName = path.basename(filePath);
      this.extractVariablesFromContent(fileName, variables);
    } catch {
      // Skip files that can't be read
      console.warn(Warning: Could not read file ${filePath});
    }
  }

  /**
   * Extract variables from template content using regex patterns
   */
  private extractVariablesFromContent(
    content: string,
    variables: Set<string>,
  ): void {
    // Match {{ variable }} syntax
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1];

      // Skip Nunjucks built-in variables and filters
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }

    // Match {{ variable | filter }} syntax
    const filteredVariablePattern =
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*[^}]+\}\}/g;
    while ((match = filteredVariablePattern.exec(content)) !== null) {
      const varName = match[1];
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }

    // Match {% if variable %} syntax
    const ifPattern = /\{\%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = ifPattern.exec(content)) !== null) {
      const varName = match[1];
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }

    // Match {% for item in items %} syntax
    const forPattern =
      /\{\%\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = forPattern.exec(content)) !== null) {
      const varName = match[2]; // The collection variable
      if (!this.isBuiltinVariable(varName)) {
        variables.add(varName);
      }
    }
  }

  /**
   * Check if a variable is a Nunjucks built-in
   */
  private isBuiltinVariable(varName: string): boolean {
    const builtins = [
      "loop",
      "super",
      "self",
      "cycler",
      "joiner",
      "range",
      "true",
      "false",
      "null",
      "undefined",
      "NaN",
      "Infinity",
    ];

    return builtins.includes(varName);
  }

  /**
   * Infer the type of a variable based on its name and usage patterns
   */
  private inferVariableType(varName: string): "string" | "boolean" | "number" {
    const lowerName = varName.toLowerCase();

    // Boolean patterns
    if (
      lowerName.startsWith("is") ||
      lowerName.startsWith("has") ||
      lowerName.startsWith("can") ||
      lowerName.startsWith("should") ||
      lowerName.startsWith("with") ||
      lowerName.startsWith("enable") ||
      lowerName.startsWith("disable") ||
      lowerName.includes("flag")
    ) {
      return "boolean";
    }

    // Number patterns
    if (
      lowerName.includes("count") ||
      lowerName.includes("size") ||
      lowerName.includes("length") ||
      lowerName.includes("index") ||
      lowerName.includes("id") ||
      lowerName.includes("number")
    ) {
      return "number";
    }

    // Default to string
    return "string";
  }

  /**
   * Generate a description for a variable based on its name
   */
  private generateDescription(varName: string): string {
    // Convert camelCase/PascalCase to readable format
    const readable = varName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    return ${readable};
  }

  /**
   * Check if a variable is required based on naming patterns
   */
  private isRequiredVariable(varName: string): boolean {
    const lowerName = varName.toLowerCase();

    // Variables that are typically required
    const requiredPatterns = [
      "name",
      "title",
      "component",
      "page",
      "route",
      "path",
      "url",
      "id",
      "key",
      "type",
      "class",
      "namespace",
    ];

    return requiredPatterns.some((pattern) => lowerName.includes(pattern));
  }

  /**
   * Generate CLI argument definitions from template variables
   */
  generateCliArgs(templateVariables: TemplateVariable[]): Record<string, any> {
    const args: Record<string, any> = {};

    for (const variable of templateVariables) {
      const argName = variable.name;

      switch (variable.type) {
        case "boolean": {
          args[argName] = {
            type: "boolean",
            description: variable.description || Set ${variable.name},
            default: false,
          };
          break;
        }

        case "number": {
          args[argName] = {
            type: "string", // CLI args are always strings, we'll parse them
            description: variable.description || Set ${variable.name},
            default: variable.defaultValue?.toString() || "0",
          };
          break;
        }

        case "string":
        default: {
          args[argName] = {
            type: "string",
            description: variable.description || Set ${variable.name},
            default: variable.defaultValue || "",
          };
          break;
        }
      }
    }

    return args;
  }

  /**
   * Convert CLI arguments to template variables
   */
  convertArgsToVariables(
    args: Record<string, any>,
    templateVariables: TemplateVariable[],
  ): Record<string, any> {
    const variables: Record<string, any> = {};

    for (const variable of templateVariables) {
      const value = args[variable.name];

      if (value !== undefined) {
        switch (variable.type) {
          case "boolean": {
            variables[variable.name] = Boolean(value);
            break;
          }
          case "number": {
            variables[variable.name] = Number(value);
            break;
          }
          case "string":
          default: {
            variables[variable.name] = String(value);
            break;
          }
        }
      }
    }

    return variables;
  }

  /**
   * Scan multiple templates and merge their variables
   */
  async scanMultipleTemplates(
    templatePaths: string[],
  ): Promise<TemplateScanResult> {
    const allVariables = new Set<string>();
    const allPrompts: TemplateVariable[] = [];

    for (const templatePath of templatePaths) {
      const result = await this.scanTemplate(templatePath);

      for (const variable of result.variables) {
        allVariables.add(variable.name);
      }

      allPrompts.push(...result.prompts);
    }

    const templateVariables: TemplateVariable[] = [...allVariables].map(
      (varName) => ({
        name: varName,
        type: this.inferVariableType(varName),
        description: this.generateDescription(varName),
        required: this.isRequiredVariable(varName),
      }),
    );

    return {
      variables: templateVariables,
      prompts: allPrompts,
    };
  }
}
 
do you see how I am trying to implement hygen with citty and nunjucks?
ChatGPT said:
Thought for 26s

Yes—I see it. You’ve basically built “Hygen-on-UnJS”:

Citty drives the CLI (generate / list / init / help).

Nunjucks renders file contents + filenames.

Scanner infers template variables → dynamic CLI args.

YAML config per generator (config.yml) + auto template discover.

Interactive prompts fill missing vars, dry + force supported.

To hit true Hygen parity + UnJS polish, add these five pieces:

Front-matter per file (Hygen style)

Parse ---/+++/---json* blocks → meta.to | inject | before/after | append/prepend | line_at | skip_if | mode.

Use confbox parsers (YAML/TOML/JSONC/JSON5).

Render meta values with Nunjucks before use.

Wire into processTemplateFiles so each file decides its own output/action.

// inside processTemplateFiles loop
const { data: meta, body } = parseFrontmatter(content) // confbox-backed
const ctx = { ...variables, ...meta }
const rendered = env.renderString(body, ctx)
const outPath = meta.to
  ? env.renderString(meta.to, ctx)
  : join(destDir, prefix, env.renderString(entry, ctx))
files.push({ path: outPath, content: rendered, meta })


Injection engine

When meta.inject is true, modify existing file using:

before|after: string/regex, append|prepend, line_at, skip_if (regex).

Provide dry-run output of planned hunks.

Two-phase arg parsing (real dynamic args)

Citty needs args before run. Do a small pre-parse to get generator/template, scan, then rebuild the command with merged arg schema.

export function createDynamicGenerateCommand() {
  const base = { /* static args for generator/template/dest/dry/force */ }
  return defineCommand({
    meta:{ name:'generate' }, args: base,
    async run(ctx) {
      const g = ctx.args.generator ?? (await pick())
      const t = ctx.args.template  ?? (await pickTpl(g))
      const dyn = await new Generator().generateDynamicCliArgs(g,t)
      // Re-run parsing with extended schema:
      const full = defineCommand({ meta:{name:'generate'}, args: { ...base, ...dyn }, run: realRun(g,t) })
      return runMain(full) // or call its parser with process.argv
    }
  })
}


(This keeps Citty validation/help accurate for template vars.)

UnJS ergonomics & safety

Use pathe for paths; consola for logs; keep chalk/ora if you like.

Sandbox writes to CWD; atomic writes (.tmp → rename).

Pull default context from unctx (ontology, org, etc.) and merge with CLI vars.

Hooks (pre/post)

Add UnJS-style lifecycle: template:will:render, template:did:render, file:will:write, file:did:write, inject:did:apply.

Great for audit, dry-run previews, git checkpoints.

Tiny patches you’ll want now:

Replace custom case filters with scule (kebabCase, pascalCase, etc.) for correctness.

Keep your config.yml discovery, but let front-matter override to/actions per file.

Add --dry output to show a table: action (WRITE/INJECT/SKIP), path, reason.

You’re ~80% there. Front-matter + injection + two-phase args will make this feel exactly like Hygen—just UnJS-native.

You said:
Skip to content
Navigation Menu
unjs
c12

Type / to search

Code
Issues
22
Pull requests
8
Discussions
Actions
Projects
Security
Insights
Owner avatar
c12
Public
unjs/c12
Go to file
t
Name		
renovate[bot]
renovate[bot]
chore(deps): update all non-major dependencies (#264)
ce67862
 · 
4 days ago
.github/workflows
chore(deps): update actions/checkout action to v5 (#261)
3 weeks ago
playground
chore: lint project
2 years ago
src
feat: support configFileRequired (#241)
2 months ago
test
feat: support configFileRequired (#241)
2 months ago
.editorconfig
initial commit
3 years ago
.gitignore
fix: update dotenv assigned env variables on subsequent calls (#243)
6 months ago
.prettierrc
chore: lint project
2 years ago
.testrc
test: update tests
last year
CHANGELOG.md
chore(release): v3.2.0
2 months ago
LICENSE
refactor: update repo
3 years ago
README.md
chore: sort a-z
last month
build.config.ts
build!: esm-only
7 months ago
eslint.config.mjs
feat: support context for function config (#258)
2 months ago
package.json
chore(deps): update all non-major dependencies (#264)
4 days ago
pnpm-lock.yaml
chore(deps): update all non-major dependencies (#264)
4 days ago
renovate.json
style: lint with prettier v3
2 years ago
tsconfig.json
chore: stricter tsconfig
last year
vitest.config.ts
test: only include src for coverage report (#242)
6 months ago
Repository files navigation
README
MIT license
⚙️ c12
npm version npm downloads codecov

c12 (pronounced as /siːtwelv/, like c-twelve) is a smart configuration loader.

✅ Features
.js, .ts, .mjs, .cjs, .mts, .cts .json config loader with unjs/jiti
.jsonc, .json5, .yaml, .yml, .toml config loader with unjs/confbox
.config/ directory support (config dir proposal)
.rc config support with unjs/rc9
.env support with dotenv
Multiple sources merged with unjs/defu
Reads config from the nearest package.json file
Extends configurations from multiple local or git sources
Overwrite with environment-specific configuration
Config watcher with auto-reload and HMR support
Create or update configuration files with magicast
🦴 Used by
Hey API
Kysely
Nitro
Nuxt
Prisma
Trigger.dev
UnJS
WXT
Usage
Install package:

# ✨ Auto-detect
npx nypm install c12
Import:

// ESM import
import { loadConfig, watchConfig } from "c12";

// or using dynamic import
const { loadConfig, watchConfig } = await import("c12");
Load configuration:

// Get loaded config
const { config } = await loadConfig({});

// Get resolved config and extended layers
const { config, configFile, layers } = await loadConfig({});
Loading priority
c12 merged config sources with unjs/defu by below order:

Config overrides passed by options
Config file in CWD
RC file in CWD
Global RC file in the user's home directory
Config from package.json
Default config passed by options
Extended config layers
Options
cwd
Resolve configuration from this working directory. The default is process.cwd()

name
Configuration base name. The default is config.

configFile
Configuration file name without extension. Default is generated from name (f.e., if name is foo, the config file will be => foo.config).

rcFile
RC Config file name. Default is generated from name (name=foo => .foorc).

Set to false to disable loading RC config.

globalRC
Load RC config from the workspace directory and the user's home directory. Only enabled when rcFile is provided. Set to false to disable this functionality.

dotenv
Loads .env file if enabled. It is disabled by default.

packageJson
Loads config from nearest package.json file. It is disabled by default.

If true value is passed, c12 uses name field from package.json.

You can also pass either a string or an array of strings as a value to use those fields.

defaults
Specify default configuration. It has the lowest priority and is applied after extending config.

defaultConfig
Specify default configuration. It is applied before extending config.

overrides
Specify override configuration. It has the highest priority and is applied before extending config.

omit$Keys
Exclude environment-specific and built-in keys start with $ in the resolved config. The default is false.

jiti
Custom unjs/jiti instance used to import configuration files.

jitiOptions
Custom unjs/jiti options to import configuration files.

giget
Options passed to unjs/giget when extending layer from git source.

merger
Custom options merger function. Default is defu.

Note: Custom merge function should deeply merge options with arguments high -> low priority.

envName
Environment name used for environment specific configuration.

The default is process.env.NODE_ENV. You can set envName to false or an empty string to disable the feature.

context
Context object passed to dynamic config functions.

resolve
You can define a custom function that resolves the config.

configFileRequired
If this option is set to true, loader fails if the main config file does not exists.

Extending configuration
If resolved config contains a extends key, it will be used to extend the configuration.

Extending can be nested and each layer can extend from one base or more.

The final config is merged result of extended options and user options with unjs/defu.

Each item in extends is a string that can be either an absolute or relative path to the current config file pointing to a config file for extending or the directory containing the config file. If it starts with either github:, gitlab:, bitbucket:, or https:, c12 automatically clones it.

For custom merging strategies, you can directly access each layer with layers property.

Example:

// config.ts
export default {
  colors: {
    primary: "user_primary",
  },
  extends: ["./theme"],
};
// config.dev.ts
export default {
  dev: true,
};
// theme/config.ts
export default {
  extends: "../base",
  colors: {
    primary: "theme_primary",
    secondary: "theme_secondary",
  },
};
// base/config.ts
export default {
  colors: {
    primary: "base_primary",
    text: "base_text",
  },
};
The loaded configuration would look like this:

const config = {
  dev: true,
  colors: {
    primary: "user_primary",
    secondary: "theme_secondary",
    text: "base_text",
  },
};
Layers:

[
  {
    config: {
      /* theme config */
    },
    configFile: "/path/to/theme/config.ts",
    cwd: "/path/to/theme ",
  },
  {
    config: {
      /* base  config */
    },
    configFile: "/path/to/base/config.ts",
    cwd: "/path/to/base",
  },
  {
    config: {
      /* dev   config */
    },
    configFile: "/path/to/config.dev.ts",
    cwd: "/path/",
  },
];
Extending config layer from remote sources
You can also extend configuration from remote sources such as npm or github.

In the repo, there should be a config.ts (or config.{name}.ts) file to be considered as a valid config layer.

Example: Extend from a github repository

// config.ts
export default {
  extends: "gh:user/repo",
};
Example: Extend from a github repository with branch and subpath

// config.ts
export default {
  extends: "gh:user/repo/theme#dev",
};
Example: Extend a private repository and install dependencies:

// config.ts
export default {
  extends: ["gh:user/repo", { auth: process.env.GITHUB_TOKEN, install: true }],
};
You can pass more options to giget: {} in layer config or disable it by setting it to false.

Refer to unjs/giget for more information.

Environment-specific configuration
Users can define environment-specific configuration using these config keys:

$test: {...}
$development: {...}
$production: {...}
$env: { [env]: {...} }
c12 tries to match envName and override environment config if specified.

Note: Environment will be applied when extending each configuration layer. This way layers can provide environment-specific configuration.

Example:

export default {
  // Default configuration
  logLevel: "info",

  // Environment overrides
  $test: { logLevel: "silent" },
  $development: { logLevel: "warning" },
  $production: { logLevel: "error" },
  $env: {
    staging: { logLevel: "debug" },
  },
};
Watching configuration
you can use watchConfig instead of loadConfig to load config and watch for changes, add and removals in all expected configuration paths and auto reload with new config.

Lifecycle hooks
onWatch: This function is always called when config is updated, added, or removed before attempting to reload the config.
acceptHMR: By implementing this function, you can compare old and new functions and return true if a full reload is not needed.
onUpdate: This function is always called after the new config is updated. If acceptHMR returns true, it will be skipped.
import { watchConfig } from "c12";

const config = watchConfig({
  cwd: ".",
  // chokidarOptions: {}, // Default is { ignoreInitial: true }
  // debounce: 200 // Default is 100. You can set it to false to disable debounced watcher
  onWatch: (event) => {
    console.log("[watcher]", event.type, event.path);
  },
  acceptHMR({ oldConfig, newConfig, getDiff }) {
    const diff = getDiff();
    if (diff.length === 0) {
      console.log("No config changed detected!");
      return true; // No changes!
    }
  },
  onUpdate({ oldConfig, newConfig, getDiff }) {
    const diff = getDiff();
    console.log("Config updated:\n" + diff.map((i) => i.toJSON()).join("\n"));
  },
});

console.log("watching config files:", config.watchingFiles);
console.log("initial config", config.config);

// Stop watcher when not needed anymore
// await config.unwatch();
Updating config
Note

This feature is experimental

Update or create a new configuration files.

Add magicast peer dependency:

# ✨ Auto-detect
npx nypm install -D magicast
Import util from c12/update

const { configFile, created } = await updateConfig({
  cwd: ".",
  configFile: "foo.config",
  onCreate: ({ configFile }) => {
    // You can prompt user if wants to create a new config file and return false to cancel
    console.log(Creating new config file in ${configFile}...);
    return "export default { test: true }";
  },
  onUpdate: (config) => {
    // You can update the config contents just like an object
    config.test2 = false;
  },
});

console.log(Config file ${created ? "created" : "updated"} in ${configFile});
Configuration functions
You can use a function to define your configuration dynamically based on context.

// config.ts
export default (ctx) => {
  return {
    apiUrl: ctx?.dev ? "http://localhost:3000" : "https://api.example.com",
  };
};
// Usage
import { loadConfig } from "c12";

const config = await loadConfig({
  context: { dev: true },
});
Contribution
Local development
License
Published under the MIT license. Made by @pi0 and community 💛



🤖 auto updated with automd

About
⚙️ Smart Configuration Loader

Resources
 Readme
License
 MIT license
 Activity
 Custom properties
Stars
 750 stars
Watchers
 4 watching
Forks
 36 forks
Report repository
Releases 30
v3.2.0
Latest
on Jul 30
+ 29 releases
Used by 232k
@08-Joao
@cahetterich
@Shopify
@bcdarwin
@shunwuyu
@inclusion-numerique
@celenium-io
@richardimaoka
+ 232,109
Contributors
27
@pi0
@renovate[bot]
@danielroe
@atinux
@renovate-bot
@ysknsid25
@autofix-ci[bot]
@cawa-93
@Akryum
@harlan-zw
@cpreston321
@rijkvanzanten
@jkomyno
@mrlubos
+ 13 contributors
Languages
TypeScript
99.3%
 
JavaScript
0.7%
Footer
© 2025 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
GitHub Community
Docs
Contact
Manage cookies
Do not share my personal information


What would our config look like?
ChatGPT said:
Thought for 33s

Here’s a sane c12-powered UnJS config for Unjucks—TS first (functions allowed), with env-overrides, front-matter, ontology, hooks, and Nunjucks tuning:

// unjucks.config.ts
import { kebabCase, pascalCase, camelCase, snakeCase } from 'scule'
import type { Config } from 'unjucks/types' // <- your exported type

export default (ctx): Config => ({
  // —— Discovery
  templatesDir: '_templates',                // fallback to 'templates' if missing
  preferDirs: ['_templates', 'templates'],
  generatorConfigFile: 'config.yml',         // per-generator config (YAML/TOML/JSON5/JSONC via confbox)
  watch: false,

  // —— Nunjucks engine
  nunjucks: {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
    filters: { kebabCase, pascalCase, camelCase, snakeCase },
    globals: {
      projectName: ctx?.pkg?.name,
      nowISO: () => new Date().toISOString()
    }
  },

  // —— Front-matter (Hygen-style actions)
  frontmatter: {
    enabled: true,
    // YAML/TOML/JSON5/JSONC via confbox under the hood
    formats: ['yaml', 'toml', 'json5', 'jsonc'],
    delimiters: { open: '---', close: '---' },
    // render meta strings with nunjucks before use (e.g. to: "src/{{ name }}.ts")
    renderMeta: true,
    reservedKeys: [
      'to','inject','before','after','append','prepend','lineAt','skipIf','mode','chmod','sh','eofLast'
    ],
    injectDefaults: { eofLast: true }
  },

  // —— Generation & safety
  generation: {
    outputDir: ctx.cwd,
    atomicWrites: true,
    conflictStrategy: 'prompt',              // 'prompt' | 'overwrite' | 'skip'
    forceDefault: false,
    dryRunDefault: false
  },

  // —— Ontology (Untology as default data source)
  ontology: {
    enabled: true,
    sources: ['ontology/**/*.{ttl,n3}', 'schema/**/*.{ttl,n3}'],
    prefixes: { ex: 'https://example.com/', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
    cacheFile: '.unjucks/ontology.cache.db',
    // optional NL→SPARQL hook (if you wire an LLM)
    nlQuery: { enabled: false }
  },

  // —— Hooks (UnJS-style lifecycle)
  hooks: {
    async 'template:will:render'(e) { /* audit/log */ },
    async 'template:did:render'(e) { /* metrics */ },
    async 'file:will:write'(f) { /* git checkpoint, lint, fmt */ },
    async 'inject:will:apply'(op) { /* hunk preview */ },
    async 'file:did:write'(f) { /* success log */ }
  },

  // —— Env overrides (c12 $sections)
  $development: {
    watch: true,
    generation: { dryRunDefault: true }
  },
  $production: {
    generation: { conflictStrategy: 'skip', atomicWrites: true }
  }
})


RC / package.json alternatives (c12 will pick them up):

# .unjucksrc (YAML)
templatesDir: _templates
frontmatter:
  enabled: true
ontology:
  enabled: true

// package.json
{ "unjucks": { "templatesDir": "_templates", "watch": false } }


Notes

Per-file actions live in template front-matter (to, inject, before/after, append/prepend, skipIf, mode/chmod, sh).

generator/config.yml still defines prompts/sets; front-matter wins per file.

Uses c12 env sections ($development/$production) and can extends remote packs if needed.

You said:
can you write the BDD
ChatGPT said:
Thought for 11s

Here are concise Gherkin BDD specs for Unjucks. Copy each block into test/bdd/*.feature.

Feature: Template discovery
  As a user I want Unjucks to auto-discover templates like Hygen

  Scenario: Finds _templates at project root
    Given a project with "package.json" in "."
    And a "_templates/command/citty/{{ name | pascalCase }}.ts" template exists
    When I run "unjucks list"
    Then I see "command" generator
    And I see "citty" template

  Scenario: Falls back to templates/ when _templates/ missing
    Given a "templates/cli/citty/cli.ts" template exists
    When I run "unjucks list"
    Then I see "cli" generator

Feature: Dynamic args from template variables
  Scenario: CLI exposes args derived from template scan
    Given a template uses "{{ commandName }}" and "{% if withTests %}"
    When I run "unjucks help command citty"
    Then I see "--commandName [string]" and "--withTests [boolean]"

Feature: Front-matter driven generation
  Background:
    Given a template file with front-matter:
      """
      ---
      to: "src/commands/{{ commandName | kebabCase }}.ts"
      mode: overwrite
      ---
      export const {{ commandName | pascalCase }} = {}
      """
  Scenario: Renders meta with Nunjucks and writes file
    When I run "unjucks generate command citty --commandName User"
    Then file "src/commands/user.ts" is created
    And it contains "export const User = {}"

Feature: Injection modes
  Background:
    Given file "src/index.ts" contains:
      """
      // EXPORTS
      """
    And a template with front-matter:
      """
      ---
      to: "src/index.ts"
      inject: true
      after: "// EXPORTS"
      skipIf: "export .* User"
      ---
      export { User } from "./commands/user"
      """
  Scenario: Injects after marker and avoids duplicates
    When I run "unjucks generate command citty --commandName User"
    Then "src/index.ts" contains "export { User }"
    When I run it again
    Then "src/index.ts" contains "export { User }" only once

Feature: Append / Prepend / LineAt injection
  Scenario: Append to file
    Given front-matter "append: true" and to: "README.md"
    When I generate
    Then rendered content is appended to "README.md"

  Scenario: Prepend to file
    Given front-matter "prepend: true"
    When I generate
    Then rendered content is prepended

  Scenario: Insert at line
    Given front-matter "lineAt: 3"
    When I generate
    Then content is inserted at line 3

Feature: Conflict strategies & force
  Scenario: Prompt on conflict (default)
    Given "src/a.ts" already exists
    And generation would write "src/a.ts"
    When I run "unjucks generate ..."
    Then I am prompted to overwrite

  Scenario: Overwrite with --force
    When I run "unjucks generate ... --force"
    Then file is overwritten without prompt

  Scenario: Skip on config
    Given c12 config sets conflictStrategy: "skip"
    When I run generate
    Then existing files are not modified

Feature: Dry run
  Scenario: Lists files without writing
    When I run "unjucks generate ... --dry"
    Then no files are created
    And I see a list of paths that would be generated

Feature: Prompts vs CLI args precedence
  Scenario: CLI arg wins
    Given template variable "commandName" exists
    And config prompt provides default "Foo"
    When I run "unjucks generate ... --commandName Bar"
    Then output uses "Bar" not "Foo"

  Scenario: Prompts for missing variables actually used
    Given template variables: "name", "unusedVar"
    And only "name" is referenced in files
    When I run generate without args
    Then I am prompted for "name"
    And I am not prompted for "unusedVar"

Feature: Filename templating & filters
  Scenario: Renders file names with filters
    Given a file named "{{ name | pascalCase }}.ts" in template
    When I run "unjucks generate ... --name user_profile"
    Then a file "User_profile.ts" is created

  Scenario: Built-in string filters
    Given content uses kebabCase, camelCase, pascalCase, snakeCase
    When I generate with "--name UserProfile"
    Then rendered strings match expected cases

Feature: Ontology as default data (Untology)
  Background:
    Given c12 config enables ontology with sources "ontology/*.ttl"
    And ontology defines class "ex:User" with label "User"
  Scenario: Template can access ontology context
    Given template body "/* {{ ontology.classes['ex:User'].label }} */"
    When I run generate
    Then output contains "/* User */"

  Scenario: NL→SPARQL (optional)
    Given nlQuery is enabled
    When template calls "{{ ontQuery('users with email') }}"
    Then output includes results mapped from ontology

Feature: c12 configuration & env overrides
  Scenario: Loads unjucks.config.ts
    Given "unjucks.config.ts" sets templatesDir to "_templates"
    When I run any command
    Then templates are searched under "_templates"

  Scenario: Applies $development overrides
    Given NODE_ENV=development
    And config sets $development.generation.dryRunDefault=true
    When I run "unjucks generate" without --dry
    Then it runs in dry mode

Feature: List & Help commands
  Scenario: list shows generators and templates
    When I run "unjucks list"
    Then I see each generator and its templates

  Scenario: help shows template variables
    When I run "unjucks help command citty"
    Then I see variable names, types, and defaults

Feature: init command
  Scenario: Scaffolds example generators
    When I run "unjucks init --type citty --dest ."
    Then "_templates/command/citty/{{ commandName | pascalCase }}.ts" exists
    And "_templates/cli/citty/cli.ts" exists
    And "unjucks.yml" exists

Feature: Watch mode (optional)
  Scenario: Re-renders on template change
    Given config enables watch
    And I start "unjucks generate ... --dry"
    When I edit a template file
    Then Unjucks re-runs and shows updated outputs

Feature: Atomic writes & chmod
  Scenario: Writes via temp file then rename
    Given generation targets "bin/tool.sh" with "chmod: 755"
    When I generate
    Then file is written atomically
    And file mode is executable

Feature: Shell hook
  Scenario: Executes post-gen command
    Given front-matter "sh: npm run format"
    When I generate
    Then "npm run format" is executed after file writes

Feature: Error handling
  Scenario: Missing template
    When I run "unjucks generate missingGen missingTpl"
    Then exit code is non-zero
    And stderr contains "Template 'missingTpl' not found"

  Scenario: Invalid front-matter
    Given a template with malformed YAML
    When I generate
    Then exit code is non-zero
    And stderr mentions "front-matter"

Feature: Security & safety
  Scenario: No overwrite without confirmation
    Given a target file exists
    And --force not provided
    When I generate
    Then I am prompted before overwriting


These cover: discovery, dynamic args, front-matter actions, inject modes, conflicts, dry-run, prompts, filters/filenames, ontology context, c12 config/env, list/help/init, watch, atomic writes/chmod, shell hook, and errors.