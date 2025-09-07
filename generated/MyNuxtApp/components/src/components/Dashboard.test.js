import { Dashboard } from './Dashboard.js';

describe('Dashboard', () => {
  let component;

  beforeEach(() => {
    component = new Dashboard();
  });

  test('should create instance', () => {
    expect(component).toBeInstanceOf(Dashboard);
    expect(component.name).toBe('Dashboard');
  });

  test('should render correctly', () => {
    const result = component.render();
    expect(result).toContain('dashboard');
    expect(result).toContain('Dashboard');
  });
});