import { UserCard } from './UserCard.js';

describe('UserCard', () => {
  let component;

  beforeEach(() => {
    component = new UserCard();
  });

  test('should create instance', () => {
    expect(component).toBeInstanceOf(UserCard);
    expect(component.name).toBe('UserCard');
  });

  test('should render correctly', () => {
    const result = component.render();
    expect(result).toContain('usercard');
    expect(result).toContain('UserCard');
  });
});