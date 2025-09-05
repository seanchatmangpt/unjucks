---
to: src/components/{{ componentName }}.test.ts
skipIf: "!withTests"
---
import { {{ componentName }} } from './{{ componentName }}';

describe('{{ componentName }}', () => {
  test('should render with title', () => {
    const component = new {{ componentName }}({ title: 'Test Title', visible: true });
    const result = component.render();
    
    expect(result).toContain('Test Title');
    expect(result).toContain('{{ componentName | kebabCase }}');
  });

  test('should not render when not visible', () => {
    const component = new {{ componentName }}({ title: 'Test Title', visible: false });
    const result = component.render();
    
    expect(result).toBe('');
  });
});