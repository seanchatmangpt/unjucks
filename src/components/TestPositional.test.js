import { TestPositional } from './TestPositional.js';

describe('TestPositional', () => {
  let component;

  beforeEach(() => {
    component = new TestPositional();
  });

  test('should create instance', () => {
    expect(component).toBeInstanceOf(TestPositional);
    expect(component.name).toBe('TestPositional');
  });

  test('should render correctly', () => {
    const result = component.render();
    expect(result).toContain('testpositional');
    expect(result).toContain('TestPositional');
  });
});