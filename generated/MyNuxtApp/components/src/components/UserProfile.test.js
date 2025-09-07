import { UserProfile } from './UserProfile.js';

describe('UserProfile', () => {
  let component;

  beforeEach(() => {
    component = new UserProfile();
  });

  test('should create instance', () => {
    expect(component).toBeInstanceOf(UserProfile);
    expect(component.name).toBe('UserProfile');
  });

  test('should render correctly', () => {
    const result = component.render();
    expect(result).toContain('userprofile');
    expect(result).toContain('UserProfile');
  });
});