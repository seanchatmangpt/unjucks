# Enhanced Build System Report

**Generated:** 2025-09-08T16:04:19.935Z  
**Duration:** 8.06s  
**Status:** FAILED

## Quality Gates Status

- **buildValidation**: ✅ PASSED (Required)
- **smokeTests**: ✅ PASSED (Required)
- **linting**: ❌ FAILED (Optional)
- **securityAudit**: ❌ FAILED (Optional)
- **dependencyCheck**: ✅ PASSED (Required)
- **packageIntegrity**: ❌ FAILED (Required)
- **cliValidation**: ❌ FAILED (Required)

## Metrics

- Package Size: N/A MB
- Build Duration: 8.06s

## Errors (1)

- ❌ Package missing required files: bin/unjucks.cjs

## Warnings (2)

- ⚠️  Linting check failed: Command failed: npx eslint src/ bin/ scripts/ --format=stylish
npm warn config optional Use `--omit=optional` to exclude optional dependencies, or
npm warn config `--include=optional` to include them.
npm warn config
npm warn config       Default value does install optional deps unless otherwise omitted.
npm warn config production Use `--omit=dev` instead.
npm warn config dev Please use --include=dev instead.

Oops! Something went wrong! :(

ESLint: 9.35.0

You are linting "bin/", but all of the files matching the glob pattern "bin/" are ignored.

If you don't want to lint these files, remove the pattern "bin/" from the list of arguments passed to ESLint.

If you do want to lint these files, explicitly list one or more of the files from this glob that you'd like to lint to see more details about why they are ignored.

  * If the file is ignored because of a matching ignore pattern, check global ignores in your config file.
    https://eslint.org/docs/latest/use/configure/ignore

  * If the file is ignored because no matching configuration was supplied, check file patterns in your config file.
    https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-with-arbitrary-extensions

  * If the file is ignored because it is located outside of the base path, change the location of your config file to be in a parent directory.


- ⚠️  Security audit failed: Command failed: npm audit --audit-level moderate --json
npm warn config optional Use `--omit=optional` to exclude optional dependencies, or
npm warn config `--include=optional` to include them.
npm warn config
npm warn config       Default value does install optional deps unless otherwise omitted.
npm warn config production Use `--omit=dev` instead.
npm warn config dev Please use --include=dev instead.


## Build System Architecture

This enhanced build system implements:

1. **Automated Quality Gates** - Zero-failure build process
2. **Dependency Management** - Auto-install missing dev dependencies  
3. **Security Scanning** - Automated vulnerability detection
4. **Package Integrity** - Comprehensive validation
5. **Advanced CLI Testing** - Performance and error handling
6. **Comprehensive Reporting** - Detailed build metrics

Built by Agent 8 - Build System Architect for bulletproof releases.
