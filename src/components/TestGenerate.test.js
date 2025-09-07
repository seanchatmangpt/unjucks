import { TestGenerate } from './TestGenerate.js';

describe('TestGenerate', () => {
  let component;

  beforeEach(() => {
    component = new TestGenerate();
  });

  test('should create instance', () => {
    expect(component).toBeInstanceOf(TestGenerate);
    expect(component.name).toBe('TestGenerate');
  });

  test('should render correctly', () => {
    const result = component.render();
    expect(result).toContain('testgenerate');
    expect(result).toContain('TestGenerate');
  });
});