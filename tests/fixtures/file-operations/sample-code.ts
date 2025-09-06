// Sample TypeScript file for testing file operations
export class TestClass {
  private value: string;

  constructor(value: string) {
    this.value = value;
  }

  getValue(): string {
    return this.value;
  }

  setValue(newValue: string): void {
    this.value = newValue;
  }
}

export const utils = {
  format: (text: string) => text.toUpperCase(),
  validate: (input: any) => input != null
};