// Type shims for missing modules
declare module 'cli-table3' {
  export default class Table {
    constructor(options?: any);
    push(...args: any[]): void;
    toString(): string;
  }
}

declare module 'confbox' {
  export function loadConfig(options: any): Promise<any>;
  export function writeConfig(options: any): Promise<void>;
}

declare module '../lib/migration-validator' {
  export class MigrationValidator {
    validate(config: any): boolean;
  }
}

declare module '../lib/migration-reporter' {
  export class MigrationReporter {
    report(results: any): void;
  }
}

declare module 'react';