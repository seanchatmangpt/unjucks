/**
 * UserCard component
 */
export class UserCard {
  constructor() {
    this.name = 'UserCard';
  }

  render() {
    return `<div class="usercard">${this.name}</div>`;
  }
}

  // Additional props validation
export default UserCard;